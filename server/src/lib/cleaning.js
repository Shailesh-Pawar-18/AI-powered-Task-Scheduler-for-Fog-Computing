import crypto from 'node:crypto';

const DEVICE_TYPES = new Set(['healthcare', 'traffic', 'industrial']);
const PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);
const RANGES = { cpu: [0, 100], memory: [0, 8192], latency: [0, 100000] };

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v).trim());
  return Number.isFinite(n) ? n : NaN;
};
const inRange = (n, [lo, hi]) => n > lo && n <= hi;

export function rowHash({ deviceType, priority, cpu, memory, latency, sensorId }) {
  const key = `${deviceType}|${priority}|${cpu}|${memory}|${latency}|${sensorId || ''}`;
  return crypto.createHash('sha1').update(key).digest('hex');
}

export function cleanRows(rows) {
  const seen = new Set();
  const valid = [];
  let invalidCount = 0;
  let duplicatesRemoved = 0;

  for (const row of rows || []) {
    const deviceType = String(row.device_type ?? '').trim().toLowerCase();
    const priority = String(row.priority ?? '').trim().toLowerCase();
    const cpu = num(row.cpu);
    const memory = num(row.memory);
    const latency = num(row.latency);

    const ok =
      DEVICE_TYPES.has(deviceType) &&
      PRIORITIES.has(priority) &&
      inRange(cpu, RANGES.cpu) &&
      inRange(memory, RANGES.memory) &&
      inRange(latency, RANGES.latency);

    if (!ok) { invalidCount++; continue; }

    const sensorId = row.sensor_id ? String(row.sensor_id).trim() : '';
    const rec = { deviceType, priority, cpu, memory, latency, sensorId };
    const hash = rowHash(rec);
    if (seen.has(hash)) { duplicatesRemoved++; continue; }
    seen.add(hash);

    const ts = row.timestamp ? new Date(row.timestamp) : null;
    valid.push({
      timestamp: ts && !isNaN(ts.getTime()) ? ts : null,
      ...rec,
      rowHash: hash,
    });
  }

  return { valid, invalidCount, duplicatesRemoved };
}
