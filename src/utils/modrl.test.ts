import { describe, expect, it } from 'vitest';
import parity from '../models/modrl.parity.json';
import { MODEL, buildModrlState, modrlAct, modrlSchedule, nsga2Select, qValues } from './modrl';
import { CloudNode, FogNode, Task } from '../types';

interface ParityCase { state: number[]; q: Record<string, number[]>; action: number }
const cases = parity as unknown as ParityCase[];

const fogNode = (i: number, over: Partial<FogNode> = {}): FogNode => ({
  id: `fog_${i}`, name: `Fog ${i}`, position: { x: 0, y: 0 },
  maxCpu: 80 + i * 10, maxMemory: 150 + i * 10, currentCpu: 0, currentMemory: 0,
  energyConsumption: 0, processingTasks: [], isActive: true, distance: 10 + i * 5, ...over,
});
const cloud: CloudNode = { id: 'cloud', name: 'Cloud', latency: 150, processingTasks: [] };
const task: Task = {
  id: 't', deviceId: 'd', type: 'healthcare', priority: 'critical', cpuRequirement: 40,
  memoryRequirement: 30, expectedLatency: 100, createdAt: 0, status: 'pending',
};

describe('MODRL parity with the Python implementation', () => {
  it('has the expected network shape', () => {
    expect(cases.length).toBeGreaterThan(20);
    expect(cases[0].state).toHaveLength(MODEL.state_dim);
  });

  it('reproduces the Python Q-values of all three agents', () => {
    for (const c of cases) {
      const q = qValues(c.state);
      MODEL.objectives.forEach((name, k) => {
        q[k].forEach((v, a) => expect(Math.abs(v - c.q[name][a])).toBeLessThan(1e-3));
      });
    }
  });

  it('chooses the same node as the Python scheduler (NSGA-II selection)', () => {
    const mismatches = cases.filter((c) => modrlAct(c.state).action !== c.action);
    expect(mismatches).toHaveLength(0);
  });
});

describe('NSGA-II selection', () => {
  it('picks a Pareto-optimal knee point', () => {
    const F = [[1, 5, 3], [2, 2, 2], [3, 1, 4], [4, 6, 5]];
    expect(nsga2Select(F).index).toBe(1); // same as the Python unit check
  });
});

describe('dashboard -> agent state adapter', () => {
  it('builds a finite, well-scaled state vector', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => fogNode(i));
    const { state, valid } = buildModrlState(task, nodes, cloud, () => true);
    expect(state).toHaveLength(MODEL.state_dim);
    expect(state.every((v) => Number.isFinite(v) && v >= 0 && v <= 1.0001)).toBe(true);
    expect(valid).toEqual([true, true, true, true, true, true, true]);
  });

  it('masks padding slots when there are fewer than 6 fog nodes', () => {
    const nodes = Array.from({ length: 3 }, (_, i) => fogNode(i));
    const { valid, slotNodeIds } = buildModrlState(task, nodes, cloud, () => true);
    expect(valid).toEqual([true, true, true, false, false, false, true]);
    expect(slotNodeIds.slice(3, 6)).toEqual([null, null, null]);
  });

  it('returns a real node id and never an infeasible node', () => {
    const nodes = Array.from({ length: 8 }, (_, i) => fogNode(i));
    const id = modrlSchedule(task, nodes, cloud, (n) => n.id !== 'fog_0');
    expect([...nodes.map((n) => n.id), 'cloud']).toContain(id);
    expect(id).not.toBe('fog_0');
  });

  it('falls back to the cloud when no fog node can take the task', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => fogNode(i));
    expect(modrlSchedule(task, nodes, cloud, () => false)).toBe('cloud');
  });
});
