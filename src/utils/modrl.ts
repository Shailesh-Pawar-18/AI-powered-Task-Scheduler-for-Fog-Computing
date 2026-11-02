/**
 * MODRL scheduler runtime: 3 trained DQN agents (load / distance / priority) + NSGA-II selection.
 *
 * The agents were trained in the Python fog simulator (see fog_drl/ in the project's Python part).
 * Here only INFERENCE runs: an MLP forward pass for every agent, then the NSGA-II selection
 * operators (non-dominated sorting + crowding distance) pick the final node.
 *
 * IMPORTANT: the dashboard models nodes by CPU/memory capacity, the Python simulator by node speed
 * and queue delay. buildModrlState() maps one world to the other approximately (see the table in
 * docs/MODRL_INTEGRATION.md), so decisions here are "agents applied to approximate inputs".
 */
import { CloudNode, FogNode, Task } from '../types';
import weights from '../models/modrl.json';

interface AgentWeights { W: number[][][]; b: number[][] }
interface ModrlWeights {
  state_dim: number;
  n_actions: number;
  n_fog: number;
  top_k: number;
  objectives: string[];
  agents: Record<string, AgentWeights>;
}

export const MODEL = weights as unknown as ModrlWeights;

// ---------------------------------------------------------------- neural network
export function mlpForward(agent: AgentWeights, x: number[]): number[] {
  let a = x;
  const last = agent.W.length - 1;
  for (let k = 0; k <= last; k++) {
    const W = agent.W[k];
    const b = agent.b[k];
    const out = new Array<number>(b.length);
    for (let j = 0; j < b.length; j++) {
      let z = b[j];
      for (let i = 0; i < a.length; i++) z += a[i] * W[i][j];
      out[j] = k === last ? z : Math.max(0, z); // ReLU on hidden layers
    }
    a = out;
  }
  return a;
}

export function qValues(state: number[]): number[][] {
  return MODEL.objectives.map((name) => mlpForward(MODEL.agents[name], state));
}

// ---------------------------------------------------------------- NSGA-II (minimise all)
function dominates(p: number[], q: number[]): boolean {
  let better = false;
  for (let i = 0; i < p.length; i++) {
    if (p[i] > q[i]) return false;
    if (p[i] < q[i]) better = true;
  }
  return better;
}

export function nonDominatedSort(F: number[][]): number[][] {
  const n = F.length;
  const dominatedBy: number[][] = Array.from({ length: n }, () => []);
  const count = new Array<number>(n).fill(0);
  let fronts: number[][] = [[]];
  for (let p = 0; p < n; p++) {
    for (let q = 0; q < n; q++) {
      if (p === q) continue;
      if (dominates(F[p], F[q])) dominatedBy[p].push(q);
      else if (dominates(F[q], F[p])) count[p] += 1;
    }
    if (count[p] === 0) fronts[0].push(p);
  }
  let k = 0;
  while (fronts[k].length > 0) {
    const next: number[] = [];
    for (const p of fronts[k]) {
      for (const q of dominatedBy[p]) {
        count[q] -= 1;
        if (count[q] === 0) next.push(q);
      }
    }
    k += 1;
    fronts.push(next);
  }
  fronts = fronts.slice(0, -1);
  return fronts;
}

export function crowdingDistance(F: number[][], front: number[]): number[] {
  const dist = new Array<number>(front.length).fill(0);
  if (front.length <= 2) return new Array<number>(front.length).fill(Infinity);
  const sub = front.map((i) => F[i]);
  for (let m = 0; m < F[0].length; m++) {
    const order = sub.map((_, i) => i).sort((a, b) => sub[a][m] - sub[b][m]);
    dist[order[0]] = Infinity;
    dist[order[order.length - 1]] = Infinity;
    const span = sub[order[order.length - 1]][m] - sub[order[0]][m];
    if (span <= 0) continue;
    for (let j = 1; j < front.length - 1; j++) {
      dist[order[j]] += (sub[order[j + 1]][m] - sub[order[j - 1]][m]) / span;
    }
  }
  return dist;
}

/** Best Pareto front, then the "knee" (lowest mean normalised objective); crowding distance breaks ties. */
export function nsga2Select(F: number[][]): { index: number; frontSize: number } {
  const fronts = nonDominatedSort(F);
  const front0 = fronts[0];
  if (front0.length === 1) return { index: front0[0], frontSize: 1 };
  const m = F[0].length;
  const sub = front0.map((i) => F[i]);
  const mins = Array.from({ length: m }, (_, k) => Math.min(...sub.map((r) => r[k])));
  const maxs = Array.from({ length: m }, (_, k) => Math.max(...sub.map((r) => r[k])));
  const span = maxs.map((hi, k) => (hi - mins[k] === 0 ? 1 : hi - mins[k]));
  const knee = sub.map((r) => r.reduce((s, v, k) => s + (v - mins[k]) / span[k], 0) / m);
  const crowd = crowdingDistance(F, front0);
  let best = 0;
  for (let j = 1; j < front0.length; j++) {
    const a = [knee[j], -Math.min(crowd[j], 1e9)];
    const b = [knee[best], -Math.min(crowd[best], 1e9)];
    if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) best = j;
  }
  return { index: front0[best], frontSize: front0.length };
}

// ---------------------------------------------------------------- decision
export interface ModrlDecision { action: number; frontSize: number; q: number[][] }

/** `valid[a] === false` removes action a (padding slot or a node that cannot take the task). */
export function modrlAct(state: number[], valid?: boolean[]): ModrlDecision {
  const nA = MODEL.n_actions;
  const ok = valid ?? new Array<boolean>(nA).fill(true);
  const Q = qValues(state);
  const validIdx = [...Array(nA).keys()].filter((i) => ok[i]);

  const cand = new Set<number>();
  for (const q of Q) {
    [...validIdx].sort((a, b) => q[b] - q[a]).slice(0, MODEL.top_k).forEach((a) => cand.add(a));
  }
  const candidates = [...cand].sort((a, b) => a - b);

  const F: number[][] = candidates.map(() => []);
  for (const q of Q) {
    const vals = validIdx.map((i) => q[i]);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const denom = hi - lo === 0 ? 1 : hi - lo;
    candidates.forEach((a, ci) => F[ci].push(1 - (q[a] - lo) / denom));
  }
  const { index, frontSize } = nsga2Select(F);
  return { action: candidates[index], frontSize, q: Q };
}

// ---------------------------------------------------------------- dashboard -> agent state
const PRIORITY_INDEX = { low: 0, medium: 1, high: 2, critical: 3 } as const;
const DEADLINES = [6.0, 3.0, 1.5, 0.8]; // seconds per priority class (as in training)
const clip = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const norm01 = (v: number, lo: number, hi: number) => (hi - lo < 1e-9 ? 0.5 : (v - lo) / (hi - lo));

export interface ModrlInput {
  state: number[];
  valid: boolean[];
  /** slot -> dashboard node id (null = padding slot); last slot is the cloud */
  slotNodeIds: (string | null)[];
}

export function buildModrlState(
  task: Task,
  fogNodes: FogNode[],
  cloudNode: CloudNode,
  canProcess: (node: FogNode) => boolean
): ModrlInput {
  const nFog = MODEL.n_fog;
  const loadFrac = (n: FogNode) =>
    clip(Math.max(n.currentCpu / n.maxCpu, n.currentMemory / n.maxMemory), 0, 1);

  // static node properties are normalised over ALL fog nodes so they stay stable between decisions
  const cpus = fogNodes.map((n) => n.maxCpu);
  const dists = fogNodes.map((n) => n.distance);
  const [cpuLo, cpuHi] = [Math.min(...cpus), Math.max(...cpus)];
  const [distLo, distHi] = [Math.min(...dists), Math.max(...dists)];

  // the agents see 6 fog slots: feasible nodes first, least loaded first
  const feasible = fogNodes.filter((n) => n.isActive && canProcess(n)).sort((a, b) => loadFrac(a) - loadFrac(b));
  const chosen = feasible.slice(0, nFog);

  const lengthMI = clip((task.cpuRequirement / 80) * 2000, 200, 2000);
  const dataMB = clip((task.memoryRequirement / 60) * 4, 0.5, 4);
  const p = PRIORITY_INDEX[task.priority];

  const node: number[][] = [];
  for (let s = 0; s < nFog; s++) {
    const n = chosen[s];
    if (!n) {
      node.push([1, 0.14, 0.2, 0.33, 0, 1, 1]); // padding slot: looks saturated and slow (and is masked)
      continue;
    }
    const tCpu = norm01(n.maxCpu, cpuLo, cpuHi);
    const mips = 1000 + 2500 * tCpu;
    const latency = 0.005 + 0.035 * norm01(n.distance, distLo, distHi);
    const power = 5 + 10 * tCpu;
    node.push([
      loadFrac(n),
      clip(mips / 3500, 0, 2) / 2,
      clip(latency / 0.2, 0, 1),
      power / 15,
      0,
      clip(lengthMI / mips / 2, 0, 1),
      clip((latency + dataMB / 100) / 0.6, 0, 1),
    ]);
  }
  node.push([
    clip(cloudNode.processingTasks.length / 20, 0, 1),
    1,
    0.75,
    0,
    1,
    clip(lengthMI / 12000 / 2, 0, 1),
    clip((0.15 + dataMB / 10) / 0.6, 0, 1),
  ]);

  const state = [...node.flat(), lengthMI / 2000, p / 3, DEADLINES[p] / 6, dataMB / 4];
  const valid = [...chosen.map(() => true), ...new Array<boolean>(nFog - chosen.length).fill(false), true];
  const slotNodeIds = [...chosen.map((n) => n.id), ...new Array<null>(nFog - chosen.length).fill(null), cloudNode.id];
  return { state, valid, slotNodeIds };
}

/** Returns the dashboard node id the MODRL agents choose for this task. */
export function modrlSchedule(
  task: Task,
  fogNodes: FogNode[],
  cloudNode: CloudNode,
  canProcess: (node: FogNode) => boolean
): string {
  const { state, valid, slotNodeIds } = buildModrlState(task, fogNodes, cloudNode, canProcess);
  const { action } = modrlAct(state, valid);
  return slotNodeIds[action] ?? cloudNode.id;
}
