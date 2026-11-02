import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanRows } from '../src/lib/cleaning.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../');
const INPUT = path.join(repoRoot, 'public', 'industral - dataset', 'secom', 'secom_tasks.csv');
const OUT_DIR = path.join(repoRoot, 'data', 'clean');

function parseCsv(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const headers = lines[0].toLowerCase().split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const v = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = (v[i] ?? '').trim(); });
    return row;
  });
}

function toCsv(records) {
  const header = 'timestamp,device_type,priority,cpu_pct,memory_mb,latency_ms,sensor_id';
  const rows = records.map((r) =>
    [r.timestamp ? r.timestamp.toISOString() : '', r.deviceType, r.priority, r.cpu, r.memory, r.latency, r.sensorId].join(','));
  return [header, ...rows].join('\n');
}

const raw = parseCsv(fs.readFileSync(INPUT, 'utf8'));
const { valid, invalidCount, duplicatesRemoved } = cleanRows(raw);

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'clean_dataset.csv'), toCsv(valid));
fs.writeFileSync(path.join(OUT_DIR, 'clean_dataset.json'), JSON.stringify(valid, null, 2));

console.log('Dataset cleaning report');
console.log('  input rows      :', raw.length);
console.log('  invalid dropped :', invalidCount);
console.log('  duplicates removed:', duplicatesRemoved);
console.log('  unique written  :', valid.length);
console.log('  output dir      :', OUT_DIR);
