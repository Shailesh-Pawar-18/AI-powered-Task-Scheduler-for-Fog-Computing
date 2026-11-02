export const NODE_PER_RECORDS = 1000;
export const MIN_NODES = 3;
export const MAX_NODES = 12;

const PROFILES = [
  { profile: 'small', maxCpu: 80, maxMemory: 150 },
  { profile: 'medium', maxCpu: 100, maxMemory: 200 },
  { profile: 'large', maxCpu: 120, maxMemory: 250 },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Deterministic arc/grid layout for the topology view (percent coordinates).
function layout(index) {
  const col = index % 5;
  const row = Math.floor(index / 5);
  return { x: 25 + col * 12, y: 40 + row * 18 };
}

export function planFogNodes(recordCount) {
  const raw = Math.ceil((recordCount || 0) / NODE_PER_RECORDS);
  const nodeCount = clamp(raw, MIN_NODES, MAX_NODES);
  const mult = raw > MAX_NODES ? Math.ceil(raw / MAX_NODES) : 1;

  const nodes = Array.from({ length: nodeCount }, (_, i) => {
    const p = PROFILES[i % PROFILES.length];
    return {
      id: `fog_${i + 1}`,
      name: `Fog Node ${i + 1}`,
      maxCpu: p.maxCpu * mult,
      maxMemory: p.maxMemory * mult,
      distance: 10 + i * 5,
      position: layout(i),
      profile: p.profile,
    };
  });

  return { nodeCount, nodes };
}
