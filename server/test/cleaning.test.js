import { describe, it, expect } from 'vitest';
import { cleanRows, rowHash } from '../src/lib/cleaning.js';

const base = { device_type: 'healthcare', priority: 'high', cpu: 40, memory: 30, latency: 120 };

describe('cleanRows', () => {
  it('keeps a valid row', () => {
    const { valid, invalidCount, duplicatesRemoved } = cleanRows([{ ...base }]);
    expect(valid).toHaveLength(1);
    expect(invalidCount).toBe(0);
    expect(duplicatesRemoved).toBe(0);
    expect(valid[0].deviceType).toBe('healthcare');
    expect(valid[0].rowHash).toBeTruthy();
  });
  it('removes exact duplicates within the batch', () => {
    const r = cleanRows([{ ...base }, { ...base }, { ...base }]);
    expect(r.valid).toHaveLength(1);
    expect(r.duplicatesRemoved).toBe(2);
  });
  it('lowercases and trims enum fields before comparing', () => {
    const r = cleanRows([{ ...base }, { ...base, device_type: ' Healthcare ', priority: 'HIGH' }]);
    expect(r.valid).toHaveLength(1);
    expect(r.duplicatesRemoved).toBe(1);
  });
  it('drops rows with invalid enums or out-of-range numbers', () => {
    const r = cleanRows([
      { ...base, device_type: 'spaceship' },
      { ...base, priority: 'urgent' },
      { ...base, cpu: -5 },
      { ...base, cpu: 'abc' },
      { ...base, latency: 0 },
    ]);
    expect(r.valid).toHaveLength(0);
    expect(r.invalidCount).toBe(5);
  });
  it('rowHash is stable and field-sensitive', () => {
    expect(rowHash({ deviceType: 'traffic', priority: 'low', cpu: 1, memory: 2, latency: 3, sensorId: 's' }))
      .toBe(rowHash({ deviceType: 'traffic', priority: 'low', cpu: 1, memory: 2, latency: 3, sensorId: 's' }));
    expect(rowHash({ deviceType: 'traffic', priority: 'low', cpu: 1, memory: 2, latency: 3, sensorId: 's' }))
      .not.toBe(rowHash({ deviceType: 'traffic', priority: 'low', cpu: 9, memory: 2, latency: 3, sensorId: 's' }));
  });
});
