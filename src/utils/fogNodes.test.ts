import { describe, it, expect } from 'vitest';
import { planFogNodes, buildFogNodes } from './fogNodes';

describe('client planFogNodes (mirrors server)', () => {
  it('10,000 records -> 10 nodes', () => {
    expect(planFogNodes(10000).nodeCount).toBe(10);
  });
  it('floors at 3 and caps at 12', () => {
    expect(planFogNodes(100).nodeCount).toBe(3);
    expect(planFogNodes(999999).nodeCount).toBe(12);
  });
  it('buildFogNodes returns runtime-ready nodes', () => {
    const nodes = buildFogNodes(5000);
    expect(nodes).toHaveLength(5);
    expect(nodes[0].currentCpu).toBe(0);
    expect(nodes[0].processingTasks).toEqual([]);
    expect(nodes[0].isActive).toBe(true);
  });
});
