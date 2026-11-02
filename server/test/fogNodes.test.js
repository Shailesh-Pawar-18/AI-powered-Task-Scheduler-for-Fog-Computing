import { describe, it, expect } from 'vitest';
import { planFogNodes, MIN_NODES, MAX_NODES } from '../src/lib/fogNodes.js';

describe('planFogNodes', () => {
  it('returns the example: 10,000 records -> 10 nodes', () => {
    expect(planFogNodes(10000).nodeCount).toBe(10);
  });
  it('floors at MIN_NODES for small datasets', () => {
    expect(planFogNodes(0).nodeCount).toBe(MIN_NODES);
    expect(planFogNodes(999).nodeCount).toBe(MIN_NODES);
  });
  it('caps at MAX_NODES for large datasets', () => {
    expect(planFogNodes(50000).nodeCount).toBe(MAX_NODES);
  });
  it('produces exactly nodeCount node specs with unique ids', () => {
    const { nodeCount, nodes } = planFogNodes(5000);
    expect(nodes).toHaveLength(nodeCount);
    expect(new Set(nodes.map(n => n.id)).size).toBe(nodeCount);
  });
  it('scales capacity beyond the cap', () => {
    // raw = ceil(50000/1000) = 50; mult = ceil(50/12) = 5; small base cpu 80 -> 400
    const small = planFogNodes(50000).nodes.find(n => n.profile === 'small');
    expect(small.maxCpu).toBe(80 * 5);
  });
  it('cycles capacity profiles', () => {
    const nodes = planFogNodes(3000).nodes; // 3 nodes
    expect(nodes.map(n => n.profile)).toEqual(['small', 'medium', 'large']);
  });
});
