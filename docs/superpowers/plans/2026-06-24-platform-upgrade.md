# Fog Scheduler Platform Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-gated, MongoDB-backed fog-computing scheduler: persistent datasets, automatic fog-node creation by record count, a structured task table, fixed live metrics/node status, a dataset cleaning pipeline, Windows `.bat` runners, and a demonstration doc.

**Architecture:** Keep the existing React/TS/Vite/Tailwind SPA as the visualization layer. Add a plain-ESM-JavaScript Express + Mongoose backend (`server/`) connected to local MongoDB. The browser talks to the backend over `/api` (Vite proxy). Pure logic (dataset cleaning, fog-node planning) lives in small testable modules; the same node-creation constants exist on both server and client.

**Tech Stack:** Frontend: React 18, TypeScript, Vite 7, Tailwind 3, lucide-react. Backend: Node ≥18, Express 4, Mongoose 8, jsonwebtoken, bcryptjs, cors, multer, dotenv. Tests: vitest. DB: MongoDB Community (local, `mongodb://localhost:27017`).

## Global Constraints

- Node-creation rule (verbatim): `nodeCount = clamp(ceil(recordCount / 1000), 3, 12)`; constants `NODE_PER_RECORDS = 1000`, `MIN_NODES = 3`, `MAX_NODES = 12`. 10,000 records → 10 nodes.
- Capacity multiplier when `ceil(recordCount/1000) > MAX_NODES`: `mult = ceil(ceil(recordCount/1000) / MAX_NODES)`, applied to each node's `maxCpu`/`maxMemory`.
- Node capacity profiles (MB for memory, % for cpu): small `cpu 80 / mem 150`, medium `cpu 100 / mem 200`, large `cpu 120 / mem 250`. Distance `10 + index*5`.
- Units everywhere: CPU `%`, memory `MB`, latency `ms`, energy `kW`.
- Backend base URL: `http://localhost:4000`; Vite proxies `/api` → backend. Default admin `admin` / `admin123` (from `server/.env`). JWT `expiresIn = 8h`.
- Server code is plain ESM JavaScript (`.js`, `"type":"module"`); no build step. Frontend stays TypeScript.
- `dedupe key` (rowHash): `sha1(deviceType|priority|cpu|memory|latency|sensorId)` on normalized fields.
- Do not introduce new TypeScript errors; `npm run build` must pass after every frontend task.
- Out of scope: Python/DQN training, multi-user accounts, cloud deployment.

---

## Phase 1 — Fix the simulation engine (Requirement 5)

### Task 1: Make the interval run against live state (loopRef)

**Files:**
- Modify: `src/hooks/useSimulation.ts` (around the `simulationLoop`/`startSimulation` definitions, ~lines 342–361)

**Interfaces:**
- Consumes: existing `simulationLoop` useCallback, `intervalRef`.
- Produces: a `loopRef` that always holds the latest `simulationLoop`; `startSimulation` drives the interval through it. No signature changes to the hook's public API.

**Why:** `setInterval(simulationLoop, 1000)` freezes a stale closure; `updateNodeStates`/`calculateMetrics` then read the initial empty `tasks`, so node status and metrics never move.

- [ ] **Step 1: Add `loopRef` synced to the latest loop.** Immediately after the `simulationLoop` `useCallback` definition (currently ending at `}, [generateTasks, scheduleTasks, processTasks, updateNodeStates, calculateMetrics]);`), insert:

```ts
  // Keep the interval pointed at the freshest loop so each tick runs against
  // current state (fixes frozen metrics + fog node status).
  const loopRef = useRef(simulationLoop);
  useEffect(() => {
    loopRef.current = simulationLoop;
  }, [simulationLoop]);
```

- [ ] **Step 2: Drive the interval through the ref.** In `startSimulation`, replace:

```ts
    setIsRunning(true);
    // Run immediately once, then set interval
    simulationLoop();
    intervalRef.current = setInterval(simulationLoop, 1000); // Run every second
```

with:

```ts
    setIsRunning(true);
    // Run immediately once, then set interval. Call through loopRef so the
    // interval always invokes the latest loop (current state), not a stale one.
    loopRef.current();
    intervalRef.current = setInterval(() => loopRef.current(), 1000); // Run every second
```

- [ ] **Step 3: Build to verify it compiles.**

Run: `npm run build`
Expected: `✓ built in …` with no errors.

- [ ] **Step 4: Manual verification (the test for this task).** Run `npm run dev`, open the app, load Synthetic data, click **Use Dataset**, then **Start**. Observe for ~10s:
  - Fog Node Status CPU/Memory bars rise and fall (not stuck at 0).
  - Metrics cards show Total Tasks climbing, Avg Latency / Energy / Fog Utilization / Cloud Offload non-zero and changing.
  - Dataset progress reaches and stops at exactly `100%`.
  Expected: all true. If any stays frozen, the loopRef wiring is wrong — re-check Steps 1–2.

- [ ] **Step 5: Commit.**

```bash
git add src/hooks/useSimulation.ts
git commit -m "fix: run simulation interval against live state via loopRef"
```

---

## Phase 2 — Test harness + backend foundation

### Task 2: Add vitest and the node-creation + cleaning module skeletons

**Files:**
- Modify: `package.json` (add `test` script + `vitest` devDep)
- Create: `server/src/lib/fogNodes.js`, `server/src/lib/cleaning.js` (empty exports to start)
- Create: `server/test/.gitkeep`

**Interfaces:**
- Produces: `npm test` runs vitest; `fogNodes.js` and `cleaning.js` exist for Tasks 3–4 to fill.

- [ ] **Step 1: Install vitest.**

Run: `npm install -D vitest`
Expected: `vitest` appears in `devDependencies`.

- [ ] **Step 2: Add the test script.** In `package.json` `scripts`, add:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create placeholder modules** so imports resolve.

`server/src/lib/fogNodes.js`:
```js
export const NODE_PER_RECORDS = 1000;
export const MIN_NODES = 3;
export const MAX_NODES = 12;
```

`server/src/lib/cleaning.js`:
```js
import crypto from 'node:crypto';
export function rowHash() { return ''; }
```

- [ ] **Step 4: Verify vitest runs (no tests yet).**

Run: `npx vitest run`
Expected: "No test files found" (exit 0) — confirms the runner works.

- [ ] **Step 5: Commit.**

```bash
git add package.json package-lock.json server/src/lib/fogNodes.js server/src/lib/cleaning.js server/test/.gitkeep
git commit -m "chore: add vitest and backend lib skeletons"
```

### Task 3: Fog-node planning logic + tests

**Files:**
- Modify: `server/src/lib/fogNodes.js`
- Create: `server/test/fogNodes.test.js`

**Interfaces:**
- Produces: `planFogNodes(recordCount) -> { nodeCount: number, nodes: FogNodeSpec[] }` where
  `FogNodeSpec = { id, name, maxCpu, maxMemory, distance, position: {x,y}, profile }`. Consumed by Task 8 (`/api/nodes/plan`) and mirrored by Task 11 (client).

- [ ] **Step 1: Write the failing tests.** `server/test/fogNodes.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npx vitest run server/test/fogNodes.test.js`
Expected: FAIL — `planFogNodes is not a function`.

- [ ] **Step 3: Implement `planFogNodes`.** Replace `server/src/lib/fogNodes.js` contents:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass.**

Run: `npx vitest run server/test/fogNodes.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit.**

```bash
git add server/src/lib/fogNodes.js server/test/fogNodes.test.js
git commit -m "feat(server): fog-node planning logic with thresholds"
```

### Task 4: Dataset cleaning + dedupe logic + tests

**Files:**
- Modify: `server/src/lib/cleaning.js`
- Create: `server/test/cleaning.test.js`

**Interfaces:**
- Produces:
  - `rowHash(record) -> string` (sha1 of normalized fields)
  - `cleanRows(rows) -> { valid: CleanRecord[], invalidCount: number, duplicatesRemoved: number }`
  - `CleanRecord = { timestamp: Date|null, deviceType, priority, cpu, memory, latency, sensorId, rowHash }`
  - Input `Row = { timestamp?, device_type, priority, cpu, memory, latency, sensor_id? }`
  Consumed by Task 8 (import route) and Task 10 (clean script).

- [ ] **Step 1: Write the failing tests.** `server/test/cleaning.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify failure.**

Run: `npx vitest run server/test/cleaning.test.js`
Expected: FAIL — `cleanRows is not a function`.

- [ ] **Step 3: Implement cleaning.** Replace `server/src/lib/cleaning.js`:

```js
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
```

- [ ] **Step 4: Run to verify pass.**

Run: `npx vitest run server/test/cleaning.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit.**

```bash
git add server/src/lib/cleaning.js server/test/cleaning.test.js
git commit -m "feat(server): dataset cleaning + dedupe logic"
```

### Task 5: Backend package, DB connection, and Express app

**Files:**
- Create: `server/package.json`, `server/.env.example`, `server/src/db.js`, `server/src/index.js`
- Modify: `.gitignore`
- Modify: `vite.config.ts` (add `/api` proxy)

**Interfaces:**
- Produces: a runnable Express server on port 4000 with `GET /api/health` → `{ ok: true, db: 'connected'|'disconnected' }`. Mongoose connection helper `connectDb()`. Route files mounted in later tasks.

- [ ] **Step 1: Create `server/package.json`.**

```json
{
  "name": "fog-scheduler-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "clean-data": "node scripts/clean-data.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.4.0",
    "multer": "^1.4.5-lts.1"
  }
}
```

- [ ] **Step 2: Create `server/.env.example`.**

```
PORT=4000
MONGODB_URI=mongodb://localhost:27017/fog_scheduler
JWT_SECRET=change-this-dev-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
CLIENT_ORIGIN=http://localhost:5173
```

- [ ] **Step 3: Create `server/src/db.js`.**

```js
import mongoose from 'mongoose';

let connected = false;

export async function connectDb(uri) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
    connected = true;
    console.log('[db] connected to', uri);
  } catch (err) {
    connected = false;
    console.error('[db] connection failed:', err.message);
    console.error('[db] API will run but data routes will return 503 until MongoDB is up.');
  }
}

export function dbStatus() {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}

export function requireDb(_req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database unavailable. Start MongoDB and retry.' });
  }
  next();
}
```

- [ ] **Step 4: Create `server/src/index.js`.**

```js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDb, dbStatus } from './db.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, db: dbStatus() }));

// Routes mounted in later tasks:
// app.use('/api/auth', authRouter);
// app.use('/api/datasets', datasetsRouter);
// app.use('/api/nodes', nodesRouter);

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
await connectDb(process.env.MONGODB_URI || 'mongodb://localhost:27017/fog_scheduler');
app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
```

- [ ] **Step 5: Add the Vite proxy.** In `vite.config.ts`, add a `server.proxy` entry so the SPA can call `/api`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ['lucide-react'] },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
```

(Preserve any existing options already in the file; only add the `server.proxy` block.)

- [ ] **Step 6: Update `.gitignore`.** Append:

```
# Backend / DB
server/node_modules/
server/.env
.mongo-data/
```

- [ ] **Step 7: Install backend deps and smoke-test.**

Run:
```bash
cd server && npm install && cd ..
node server/src/index.js
```
In another terminal: `curl http://localhost:4000/api/health`
Expected: `{"ok":true,"db":"connected"}` if MongoDB is running, or `{"ok":true,"db":"disconnected"}` if not (server still starts). Stop the server (Ctrl+C).

- [ ] **Step 8: Commit.**

```bash
git add server/package.json server/package-lock.json server/.env.example server/src/db.js server/src/index.js vite.config.ts .gitignore
git commit -m "feat(server): express app, mongo connection, vite proxy"
```

---

## Phase 3 — Admin authentication (Requirement 1)

### Task 6: Auth route + JWT middleware

**Files:**
- Create: `server/src/routes/auth.js`, `server/src/middleware/auth.js`
- Modify: `server/src/index.js` (mount auth router)

**Interfaces:**
- Produces: `POST /api/auth/login { username, password } -> 200 { token, expiresIn } | 401 { error }`. Middleware `requireAuth(req,res,next)` verifying `Authorization: Bearer <jwt>`. Consumed by Task 8 (protected routes) and Task 7 (client).

- [ ] **Step 1: Create `server/src/middleware/auth.js`.**

```js
import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev');
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

- [ ] **Step 2: Create `server/src/routes/auth.js`.**

```js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

// Hash the configured admin password once at module load.
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
const EXPIRES_IN = '8h';

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const userOk = username === ADMIN_USER;
  const passOk = bcrypt.compareSync(password, ADMIN_HASH);
  if (!userOk || !passOk) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ sub: username, role: 'admin' }, process.env.JWT_SECRET || 'dev', {
    expiresIn: EXPIRES_IN,
  });
  res.json({ token, expiresIn: EXPIRES_IN });
});

export default router;
```

- [ ] **Step 3: Mount the router.** In `server/src/index.js`, add the import near the top and mount it where the route comment block is:

```js
import authRouter from './routes/auth.js';
// ...
app.use('/api/auth', authRouter);
```

- [ ] **Step 4: Manual verification.** Start the server (`node server/src/index.js`). Then:

```bash
curl -s -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
curl -s -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"wrong\"}"
```
Expected: first returns `{"token":"…","expiresIn":"8h"}`; second returns `{"error":"Invalid credentials"}` (HTTP 401).

- [ ] **Step 5: Commit.**

```bash
git add server/src/routes/auth.js server/src/middleware/auth.js server/src/index.js
git commit -m "feat(server): admin login with JWT"
```

### Task 7: Frontend API client, AuthContext, LoginScreen, and gate

**Files:**
- Create: `src/api/client.ts`, `src/context/AuthContext.tsx`, `src/components/LoginScreen.tsx`
- Modify: `src/main.tsx` (wrap with `AuthProvider`), `src/App.tsx` (gate + Logout button)

**Interfaces:**
- Consumes: `POST /api/auth/login` (Task 6).
- Produces:
  - `src/api/client.ts`: `getToken()`, `setToken(t|null)`, `apiFetch(path, opts)` (attaches Bearer, throws `ApiError` with `.status`), `login(username,password): Promise<void>`.
  - `AuthContext`: `{ isAuthenticated, login(u,p), logout() }` via `useAuth()`.
  Consumed by Tasks 9 and 12.

- [ ] **Step 1: Create `src/api/client.ts`.**

```ts
const TOKEN_KEY = 'fog_token';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`/api${path}`, { ...opts, headers });
  if (res.status === 401) {
    setToken(null);
    throw new ApiError(401, 'Session expired. Please log in again.');
  }
  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : null;
  if (!res.ok) throw new ApiError(res.status, (data && (data as any).error) || res.statusText);
  return data as T;
}

export async function login(username: string, password: string): Promise<void> {
  const { token } = await apiFetch<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(token);
}
```

- [ ] **Step 2: Create `src/context/AuthContext.tsx`.**

```tsx
import React, { createContext, useContext, useMemo, useState } from 'react';
import { login as apiLogin, setToken, getToken } from '../api/client';

interface AuthValue {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTok] = useState<string | null>(getToken());

  const value = useMemo<AuthValue>(() => ({
    isAuthenticated: !!token,
    login: async (u, p) => {
      await apiLogin(u, p);
      setTok(getToken());
    },
    logout: () => {
      setToken(null);
      setTok(null);
    },
  }), [token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 3: Create `src/components/LoginScreen.tsx`.**

```tsx
import React, { useState } from 'react';
import { Brain, Lock, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-xl p-8 space-y-5">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg"><Brain className="w-6 h-6" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Admin Login</h1>
            <p className="text-sm text-gray-400">AI Fog Computing Scheduler</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        <label className="block">
          <span className="text-sm text-gray-400">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-400">Password</span>
          <div className="mt-1 relative">
            <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <LogIn className="w-4 h-4" />
          <span>{busy ? 'Signing in…' : 'Sign in'}</span>
        </button>
      </form>
    </div>
  );
};
```

- [ ] **Step 4: Wrap the app with `AuthProvider`.** Replace `src/main.tsx` body:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
```

- [ ] **Step 5: Gate `App` and add Logout.** At the top of `App()` in `src/App.tsx`, before the existing `useSimulation()` usage, add the gate (and import `useAuth` + `LogOut` icon):

```tsx
import { useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
// add LogOut to the existing lucide-react import:
import { Play, Pause, RotateCcw, Settings, Brain, Zap, Database, HelpCircle, LogOut } from 'lucide-react';
```

Inside `function App() {`, as the first lines:

```tsx
  const { isAuthenticated, logout } = useAuth();
  if (!isAuthenticated) return <LoginScreen />;
```

Then add a Logout button at the end of the header control row (just after the Reset button's closing `</button>`, inside the same `Control Buttons` flex container):

```tsx
                <button
                  onClick={logout}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
```

- [ ] **Step 6: Build + manual verification.**

Run: `npm run build`
Expected: passes.
Then with backend + `npm run dev` running: visiting the app shows the login screen; `admin`/`admin123` reveals the dashboard; wrong password shows "Invalid credentials"; Logout returns to the login screen.

- [ ] **Step 7: Commit.**

```bash
git add src/api/client.ts src/context/AuthContext.tsx src/components/LoginScreen.tsx src/main.tsx src/App.tsx
git commit -m "feat: admin login gate for the full UI"
```

---

## Phase 4 — Dataset persistence (Requirements 2 + 6 wiring)

### Task 8: Models + dataset/nodes routes

**Files:**
- Create: `server/src/models/DatasetRecord.js`, `server/src/models/ImportBatch.js`, `server/src/routes/datasets.js`, `server/src/routes/nodes.js`
- Modify: `server/src/index.js` (mount routers)

**Interfaces:**
- Consumes: `cleanRows` (Task 4), `planFogNodes` (Task 3), `requireAuth` (Task 6), `requireDb` (Task 5).
- Produces (all require auth):
  - `POST /api/datasets/import { source, fileName?, rows }` → `{ batch }`
  - `GET /api/datasets?limit&skip&type&priority` → `{ total, records }`
  - `GET /api/datasets/stats` → `{ total, byType, byPriority }`
  - `DELETE /api/datasets` → `{ deleted }`
  - `GET /api/nodes/plan?records=N` → `{ nodeCount, nodes }`

- [ ] **Step 1: Create `server/src/models/DatasetRecord.js`.**

```js
import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportBatch', index: true },
  timestamp: { type: Date, default: null },
  deviceType: { type: String, enum: ['healthcare', 'traffic', 'industrial'], index: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], index: true },
  cpu: Number,
  memory: Number,
  latency: Number,
  sensorId: String,
  rowHash: { type: String, unique: true },
}, { timestamps: true });

export const DatasetRecord = mongoose.model('DatasetRecord', schema);
```

- [ ] **Step 2: Create `server/src/models/ImportBatch.js`.**

```js
import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  source: { type: String, enum: ['sample', 'synthetic', 'upload', 'secom'], default: 'upload' },
  fileName: String,
  rowsReceived: Number,
  rowsInvalid: Number,
  duplicatesRemoved: Number,
  rowsStored: Number,
}, { timestamps: true });

export const ImportBatch = mongoose.model('ImportBatch', schema);
```

- [ ] **Step 3: Create `server/src/routes/datasets.js`.**

```js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireDb } from '../db.js';
import { cleanRows } from '../lib/cleaning.js';
import { DatasetRecord } from '../models/DatasetRecord.js';
import { ImportBatch } from '../models/ImportBatch.js';

const router = Router();
router.use(requireAuth, requireDb);

router.post('/import', async (req, res, next) => {
  try {
    const { source = 'upload', fileName, rows } = req.body || {};
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows[] required' });

    const { valid, invalidCount, duplicatesRemoved } = cleanRows(rows);

    const batch = await ImportBatch.create({
      source, fileName,
      rowsReceived: rows.length,
      rowsInvalid: invalidCount,
      duplicatesRemoved,
      rowsStored: 0,
    });

    let stored = 0;
    if (valid.length) {
      const docs = valid.map((r) => ({ ...r, batchId: batch._id }));
      // ordered:false → keep going past cross-batch duplicate-key collisions
      const result = await DatasetRecord.insertMany(docs, { ordered: false }).catch((e) => e);
      stored = result?.insertedCount ?? (Array.isArray(result) ? result.length : 0);
    }
    batch.rowsStored = stored;
    await batch.save();

    res.json({ batch });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const skip = parseInt(req.query.skip) || 0;
    const filter = {};
    if (req.query.type) filter.deviceType = req.query.type;
    if (req.query.priority) filter.priority = req.query.priority;
    const [total, records] = await Promise.all([
      DatasetRecord.countDocuments(filter),
      DatasetRecord.find(filter).sort({ timestamp: 1 }).skip(skip).limit(limit).lean(),
    ]);
    res.json({ total, records });
  } catch (err) { next(err); }
});

router.get('/stats', async (_req, res, next) => {
  try {
    const total = await DatasetRecord.countDocuments();
    const group = async (field) =>
      Object.fromEntries((await DatasetRecord.aggregate([
        { $group: { _id: `$${field}`, n: { $sum: 1 } } },
      ])).map((d) => [d._id, d.n]));
    res.json({ total, byType: await group('deviceType'), byPriority: await group('priority') });
  } catch (err) { next(err); }
});

router.delete('/', async (_req, res, next) => {
  try {
    const { deletedCount } = await DatasetRecord.deleteMany({});
    await ImportBatch.deleteMany({});
    res.json({ deleted: deletedCount });
  } catch (err) { next(err); }
});

export default router;
```

- [ ] **Step 4: Create `server/src/routes/nodes.js`.**

```js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { planFogNodes } from '../lib/fogNodes.js';

const router = Router();
router.use(requireAuth);

router.get('/plan', (req, res) => {
  const records = parseInt(req.query.records) || 0;
  res.json(planFogNodes(records));
});

export default router;
```

- [ ] **Step 5: Mount routers** in `server/src/index.js` (imports + `app.use`):

```js
import datasetsRouter from './routes/datasets.js';
import nodesRouter from './routes/nodes.js';
// ...
app.use('/api/datasets', datasetsRouter);
app.use('/api/nodes', nodesRouter);
```

- [ ] **Step 6: Manual verification (requires MongoDB running).** Start MongoDB and the server. Get a token (Task 6 curl), then:

```bash
TOKEN=<paste token>
curl -s -X POST http://localhost:4000/api/datasets/import -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"source\":\"upload\",\"rows\":[{\"device_type\":\"healthcare\",\"priority\":\"high\",\"cpu\":40,\"memory\":30,\"latency\":120},{\"device_type\":\"healthcare\",\"priority\":\"high\",\"cpu\":40,\"memory\":30,\"latency\":120}]}"
curl -s http://localhost:4000/api/datasets/stats -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:4000/api/nodes/plan?records=10000" -H "Authorization: Bearer $TOKEN"
```
Expected: import returns a batch with `duplicatesRemoved: 1`, `rowsStored: 1`; stats `total: 1`; node plan `nodeCount: 10`. Without a token, routes return `401`.

- [ ] **Step 7: Commit.**

```bash
git add server/src/models server/src/routes/datasets.js server/src/routes/nodes.js server/src/index.js
git commit -m "feat(server): dataset persistence + node-plan routes"
```

### Task 9: Wire the dataset UI to the backend (with demo fallback)

**Files:**
- Modify: `src/api/client.ts` (add dataset helpers)
- Modify: `src/components/DatasetLoader.tsx` (persist on load; show banner on DB failure)

**Interfaces:**
- Consumes: `/api/datasets/import` (Task 8).
- Produces in `client.ts`:
  - `importDataset(source, rows): Promise<{ batch: ImportBatch }>`
  - `getDatasetStats(): Promise<{ total: number; byType: Record<string,number>; byPriority: Record<string,number> }>`
  - `DatasetRow` type `{ timestamp?: string; device_type: string; priority: string; cpu: number; memory: number; latency: number; sensor_id?: string }`.

- [ ] **Step 1: Add dataset helpers to `src/api/client.ts`** (append):

```ts
export interface DatasetRow {
  timestamp?: string;
  device_type: string;
  priority: string;
  cpu: number;
  memory: number;
  latency: number;
  sensor_id?: string;
}

export interface ImportBatch {
  source: string;
  rowsReceived: number;
  rowsInvalid: number;
  duplicatesRemoved: number;
  rowsStored: number;
}

export function importDataset(source: string, rows: DatasetRow[]) {
  return apiFetch<{ batch: ImportBatch }>('/datasets/import', {
    method: 'POST',
    body: JSON.stringify({ source, rows }),
  });
}

export function getNodePlan(records: number) {
  return apiFetch<{ nodeCount: number; nodes: any[] }>(`/nodes/plan?records=${records}`);
}
```

- [ ] **Step 2: Persist loaded tasks in `DatasetLoader.tsx`.** Add a helper that maps `Task[]` to `DatasetRow[]` and calls `importDataset`, invoked from each successful load (`handleLoadSample`, `handleLoadSynthetic`, `handleFileUpload`) right after `onTasksLoaded(tasks)`. Add near the top (after imports):

```tsx
import { importDataset, ApiError, type DatasetRow } from '../api/client';
```

Add inside the component:

```tsx
  const [persistNote, setPersistNote] = useState<string | null>(null);

  const persist = async (source: string, tasks: Task[]) => {
    const rows: DatasetRow[] = tasks.map((t) => ({
      timestamp: new Date(t.createdAt).toISOString(),
      device_type: t.type,
      priority: t.priority,
      cpu: t.cpuRequirement,
      memory: t.memoryRequirement,
      latency: t.expectedLatency,
      sensor_id: t.deviceId,
    }));
    try {
      const { batch } = await importDataset(source, rows);
      setPersistNote(`Saved to database: ${batch.rowsStored} stored, ${batch.duplicatesRemoved} duplicates removed, ${batch.rowsInvalid} invalid.`);
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 503
        ? 'Database offline — running in demo mode (data not saved).'
        : 'Could not save to database — running in demo mode.';
      setPersistNote(msg);
    }
  };
```

Then in each handler, after `onTasksLoaded(tasks); onStatsUpdate(stats);` add `await persist('synthetic', tasks);` (use `'sample'`, `'synthetic'`, `'upload'` respectively).

- [ ] **Step 3: Render the persistence note.** Just below the existing `success` banner block, add:

```tsx
      {persistNote && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg text-sm text-blue-300">
          {persistNote}
        </div>
      )}
```

- [ ] **Step 4: Build + manual verification.**

Run: `npm run build` (passes).
With backend + Mongo up: loading Synthetic shows "Saved to database: … duplicates removed …". With Mongo stopped: shows "Database offline — running in demo mode", and the simulation still works.

- [ ] **Step 5: Commit.**

```bash
git add src/api/client.ts src/components/DatasetLoader.tsx
git commit -m "feat: persist imported datasets to MongoDB with demo fallback"
```

---

## Phase 5 — Dataset cleaning script (Requirement 6)

### Task 10: `clean-data` script for the SECOM dataset

**Files:**
- Create: `server/scripts/clean-data.js`
- Create: `scripts/clean-data.bat`

**Interfaces:**
- Consumes: `cleanRows` (Task 4).
- Produces: reads `public/industral - dataset/secom/secom_tasks.csv`, writes `data/clean/clean_dataset.csv` and `data/clean/clean_dataset.json` with unit-labeled headers; prints a report.

- [ ] **Step 1: Create `server/scripts/clean-data.js`.**

```js
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
```

- [ ] **Step 2: Create `scripts/clean-data.bat`.**

```bat
@echo off
cd /d "%~dp0\.."
node server\scripts\clean-data.js
pause
```

- [ ] **Step 3: Run it.**

Run: `node server/scripts/clean-data.js`
Expected: a report where `duplicates removed` is large (the SECOM file is heavily duplicated) and `unique written` < input rows; files appear in `data/clean/`.

- [ ] **Step 4: Commit.**

```bash
git add server/scripts/clean-data.js scripts/clean-data.bat data/clean/.gitkeep
git commit -m "feat: SECOM dataset cleaning script with unit-labeled output"
```

(Create `data/clean/.gitkeep` if you prefer to keep the folder but ignore generated files; otherwise commit the generated `clean_dataset.*`.)

---

## Phase 6 — Automatic fog-node creation in the simulation (Requirement 3)

### Task 11: Client fog-node builder mirrored from the server rule

**Files:**
- Create: `src/utils/fogNodes.ts`
- Create: `src/utils/fogNodes.test.ts`
- Modify: `src/hooks/useSimulation.ts` (use builder; add `applyRecordCount`)
- Modify: `src/App.tsx` (call `applyRecordCount` when a dataset loads)

**Interfaces:**
- Produces:
  - `src/utils/fogNodes.ts`: `planFogNodes(recordCount)` (same constants as server) and `buildFogNodes(recordCount): FogNode[]` (adds runtime fields `currentCpu:0, currentMemory:0, energyConsumption:0, processingTasks:[], isActive:true`).
  - `useSimulation` gains `applyRecordCount(count: number): void` that rebuilds `fogNodes` when not running.
- Consumes: `FogNode` type from `src/types`.

- [ ] **Step 1: Write the failing test.** `src/utils/fogNodes.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure.**

Run: `npx vitest run src/utils/fogNodes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/utils/fogNodes.ts`.**

```ts
import { FogNode } from '../types';

export const NODE_PER_RECORDS = 1000;
export const MIN_NODES = 3;
export const MAX_NODES = 12;

const PROFILES = [
  { profile: 'small', maxCpu: 80, maxMemory: 150 },
  { profile: 'medium', maxCpu: 100, maxMemory: 200 },
  { profile: 'large', maxCpu: 120, maxMemory: 250 },
] as const;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function layout(index: number) {
  const col = index % 5;
  const row = Math.floor(index / 5);
  return { x: 25 + col * 12, y: 40 + row * 18 };
}

export interface FogNodeSpec {
  id: string; name: string; maxCpu: number; maxMemory: number;
  distance: number; position: { x: number; y: number }; profile: string;
}

export function planFogNodes(recordCount: number): { nodeCount: number; nodes: FogNodeSpec[] } {
  const raw = Math.ceil((recordCount || 0) / NODE_PER_RECORDS);
  const nodeCount = clamp(raw, MIN_NODES, MAX_NODES);
  const mult = raw > MAX_NODES ? Math.ceil(raw / MAX_NODES) : 1;
  const nodes = Array.from({ length: nodeCount }, (_, i) => {
    const p = PROFILES[i % PROFILES.length];
    return {
      id: `fog_${i + 1}`, name: `Fog Node ${i + 1}`,
      maxCpu: p.maxCpu * mult, maxMemory: p.maxMemory * mult,
      distance: 10 + i * 5, position: layout(i), profile: p.profile,
    };
  });
  return { nodeCount, nodes };
}

export function buildFogNodes(recordCount: number): FogNode[] {
  return planFogNodes(recordCount).nodes.map((s) => ({
    id: s.id, name: s.name, position: s.position,
    maxCpu: s.maxCpu, maxMemory: s.maxMemory,
    currentCpu: 0, currentMemory: 0, energyConsumption: 0,
    processingTasks: [], isActive: true, distance: s.distance,
  }));
}
```

- [ ] **Step 4: Run to verify pass.**

Run: `npx vitest run src/utils/fogNodes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Expose `applyRecordCount` from `useSimulation`.** Add the import and function, then return it.

Import at top of `src/hooks/useSimulation.ts`:
```ts
import { buildFogNodes } from '../utils/fogNodes';
```
Add inside the hook (near `loadDataset`):
```ts
  const applyRecordCount = (count: number) => {
    if (isRunning) return; // only reshape the topology while stopped
    setFogNodes(buildFogNodes(count));
  };
```
Add `applyRecordCount` to the returned object (next to `loadDataset`).

- [ ] **Step 6: Call it when a dataset loads.** In `src/App.tsx` `handleDatasetLoad`, after `loadDataset(tasks);` add:

```tsx
    applyRecordCount(tasks.length);
```
and add `applyRecordCount` to the destructured `useSimulation()` return.

- [ ] **Step 7: Build + manual verification.**

Run: `npm run build` (passes) and `npx vitest run` (all green).
Manual: load Synthetic (150 tasks) → Fog Node Status still shows 3 nodes. Upload/generate a dataset with ≥10,000 rows → after load, the Fog Node Status grid and topology show 10 nodes. (You can verify the count quickly by generating a large synthetic CSV.)

- [ ] **Step 8: Commit.**

```bash
git add src/utils/fogNodes.ts src/utils/fogNodes.test.ts src/hooks/useSimulation.ts src/App.tsx
git commit -m "feat: automatic fog-node creation from dataset record count"
```

---

## Phase 7 — Task records table (Requirement 4)

### Task 12: `TaskTable` component with status tabs and units

**Files:**
- Create: `src/components/TaskTable.tsx`
- Modify: `src/App.tsx` (render the table; pass all tasks)

**Interfaces:**
- Consumes: `Task[]` from the hook (`tasks`), `FogNode[]`/`CloudNode` for node-name lookup.
- Produces: `TaskTable` with props `{ tasks: Task[]; nodeNames: Record<string,string> }`.

- [ ] **Step 1: Create `src/components/TaskTable.tsx`.**

```tsx
import React, { useMemo, useState } from 'react';
import { Task } from '../types';
import { Clock, Loader, CheckCircle, XCircle, ListChecks } from 'lucide-react';

type Status = 'all' | 'pending' | 'processing' | 'completed' | 'failed';

interface TaskTableProps {
  tasks: Task[];
  nodeNames: Record<string, string>;
}

const PAGE_SIZE = 20;

const statusMeta: Record<Exclude<Status, 'all'>, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: 'Pending', icon: <Clock className="w-4 h-4" />, color: 'text-yellow-400' },
  processing: { label: 'Processing', icon: <Loader className="w-4 h-4" />, color: 'text-blue-400' },
  completed: { label: 'Completed', icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-400' },
  failed: { label: 'Failed', icon: <XCircle className="w-4 h-4" />, color: 'text-red-400' },
};

export const TaskTable: React.FC<TaskTableProps> = ({ tasks, nodeNames }) => {
  const [status, setStatus] = useState<Status>('all');
  const [page, setPage] = useState(0);

  const counts = useMemo(() => ({
    all: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    processing: tasks.filter((t) => t.status === 'processing').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
  }), [tasks]);

  const filtered = useMemo(
    () => (status === 'all' ? tasks : tasks.filter((t) => t.status === status)),
    [tasks, status]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const fmtTime = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString() : '—');

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg">
      <div className="p-4 border-b border-gray-700 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-blue-400" /> Task Records
        </h2>
        <div className="flex flex-wrap gap-2">
          {(['all', 'pending', 'processing', 'completed', 'failed'] as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(0); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                status === s ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {s} ({counts[s]})
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="px-4 py-2 font-medium">Task ID</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Priority</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">CPU (%)</th>
              <th className="px-4 py-2 font-medium">Memory (MB)</th>
              <th className="px-4 py-2 font-medium">Expected (ms)</th>
              <th className="px-4 py-2 font-medium">Actual (ms)</th>
              <th className="px-4 py-2 font-medium">Energy (kW)</th>
              <th className="px-4 py-2 font-medium">Assigned Node</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium">Completed</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-500">No tasks in this view.</td></tr>
            ) : rows.map((t) => {
              const m = statusMeta[t.status];
              return (
                <tr key={t.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-4 py-2 font-mono text-gray-300">{t.id.slice(-8)}</td>
                  <td className="px-4 py-2 capitalize">{t.type}</td>
                  <td className="px-4 py-2 capitalize">{t.priority}</td>
                  <td className={`px-4 py-2 ${m.color}`}>
                    <span className="inline-flex items-center gap-1.5">{m.icon}{m.label}</span>
                  </td>
                  <td className="px-4 py-2">{t.cpuRequirement}</td>
                  <td className="px-4 py-2">{t.memoryRequirement}</td>
                  <td className="px-4 py-2">{t.expectedLatency}</td>
                  <td className="px-4 py-2">{t.actualLatency ?? '—'}</td>
                  <td className="px-4 py-2">{t.energyConsumed != null ? t.energyConsumed.toFixed(2) : '—'}</td>
                  <td className="px-4 py-2 text-gray-300">{t.assignedTo ? (nodeNames[t.assignedTo] ?? t.assignedTo) : '—'}</td>
                  <td className="px-4 py-2 text-gray-400">{fmtTime(t.createdAt)}</td>
                  <td className="px-4 py-2 text-gray-400">{fmtTime(t.completedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="p-3 flex items-center justify-between text-sm text-gray-400">
          <span>Page {current + 1} of {pageCount} · {filtered.length} tasks</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(Math.max(0, current - 1))} disabled={current === 0}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50">Prev</button>
            <button onClick={() => setPage(Math.min(pageCount - 1, current + 1))} disabled={current >= pageCount - 1}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Render it in `App.tsx`.** Add the import:

```tsx
import { TaskTable } from './components/TaskTable';
```
Build the node-name map and render the table after the Performance/Completed grid (before "Node Status Details"):

```tsx
        {/* Task Records Table */}
        <div className="mt-6">
          <TaskTable
            tasks={tasks}
            nodeNames={{
              ...Object.fromEntries(fogNodes.map((n) => [n.id, n.name])),
              [cloudNode.id]: cloudNode.name,
            }}
          />
        </div>
```

- [ ] **Step 3: Build + manual verification.**

Run: `npm run build` (passes).
Manual: run a dataset simulation; the Task Records table fills; status tabs filter correctly with live counts; columns show units; pagination works past 20 rows.

- [ ] **Step 4: Commit.**

```bash
git add src/components/TaskTable.tsx src/App.tsx
git commit -m "feat: structured task records table with status tabs and units"
```

---

## Phase 8 — Windows runners (.bat)

### Task 13: `setup.bat` and `start.bat`

**Files:**
- Create: `scripts/setup.bat`, `scripts/start.bat`

**Interfaces:** none (operational scripts).

- [ ] **Step 1: Create `scripts/setup.bat`.**

```bat
@echo off
setlocal
cd /d "%~dp0\.."

echo === Checking Node.js ===
where node >nul 2>nul || (echo Node.js not found. Install Node 18+ from https://nodejs.org && exit /b 1)

echo === Installing frontend dependencies ===
call npm install || exit /b 1

echo === Installing backend dependencies ===
pushd server
call npm install || (popd & exit /b 1)
popd

if not exist "server\.env" (
  echo === Creating server\.env from example ===
  copy "server\.env.example" "server\.env" >nul
)

echo === Checking MongoDB ===
where mongod >nul 2>nul && (echo MongoDB found.) || (echo WARNING: mongod not on PATH. Install MongoDB Community Server from https://www.mongodb.com/try/download/community)

echo.
echo Setup complete. Run scripts\start.bat to launch everything.
pause
```

- [ ] **Step 2: Create `scripts/start.bat`.**

```bat
@echo off
setlocal
cd /d "%~dp0\.."

if not exist ".mongo-data" mkdir ".mongo-data"

echo === Starting MongoDB (new window) ===
start "MongoDB" cmd /k mongod --dbpath ".mongo-data" --port 27017

echo === Starting backend API (new window) ===
start "Fog API" cmd /k "cd server && node src\index.js"

echo === Starting frontend (new window) ===
start "Fog UI" cmd /k npm run dev

echo.
echo Frontend:  http://localhost:5173
echo Backend:   http://localhost:4000/api/health
echo (Three windows opened. Close them to stop.)
```

- [ ] **Step 3: Manual verification.** Run `scripts\setup.bat` (completes), then `scripts\start.bat` — three windows open; `http://localhost:5173` shows the login screen; `http://localhost:4000/api/health` returns `{"ok":true,"db":"connected"}`.

- [ ] **Step 4: Commit.**

```bash
git add scripts/setup.bat scripts/start.bat
git commit -m "chore: windows setup/start batch runners"
```

---

## Phase 9 — Demonstration document (Requirement 7)

### Task 14: `docs/DEMONSTRATION.md`

**Files:**
- Create: `docs/DEMONSTRATION.md`
- Modify: `README.md` (link to the demonstration doc and `.bat` quickstart)

**Interfaces:** none (documentation).

- [ ] **Step 1: Write `docs/DEMONSTRATION.md`** covering exactly these sections (use real values from this codebase):
  1. **System Architecture** — SPA + Express/Mongoose + MongoDB; a Mermaid diagram (`Browser → /api proxy → Express → MongoDB`); the simulation runs client-side.
  2. **Load Balancing & Scheduling Strategies** — DRL Optimized, Priority Aware, Load Balanced, Energy Efficient; include the DRL scoring formula from `src/utils/scheduler.ts` (`resource*0.3 + distance*0.2 + energy*0.2 + load*0.3` × priority multiplier) and the cloud-offload fallback.
  3. **Fog-Node Creation** — the `clamp(ceil(records/1000), 3, 12)` rule, the example (10,000 → 10), capacity profiles and the beyond-cap multiplier.
  4. **Performance Metrics** — definitions and units for Total Tasks, Completion Rate (%), Avg Latency (ms), Energy (kW), Fog Utilization (%), Cloud Offload (%); note the loopRef fix that keeps them live.
  5. **Workflow** — login → import dataset (cleaned + deduped + stored) → automatic node plan → select strategy → Start → observe topology/metrics/table.
  6. **Key Concepts** — fog vs cloud, priority multipliers, the energy model (`cpu*0.5 + mem*0.1`), dedupe by rowHash.

- [ ] **Step 2: Link it from `README.md`** — add a "Quickstart (Windows)" note (`scripts\setup.bat` then `scripts\start.bat`) and a link to `docs/DEMONSTRATION.md`.

- [ ] **Step 3: Commit.**

```bash
git add docs/DEMONSTRATION.md README.md
git commit -m "docs: demonstration guide + windows quickstart"
```

---

## Self-Review

**Spec coverage:**
- Req 1 (Admin login) → Tasks 6, 7. ✓
- Req 2 (MongoDB persistence) → Tasks 5, 8, 9. ✓
- Req 3 (auto fog nodes) → Tasks 3, 11. ✓
- Req 4 (task table) → Task 12. ✓
- Req 5 (fix metrics/node status) → Task 1. ✓
- Req 6 (clean/validate dataset) → Tasks 4, 9, 10. ✓
- Req 7 (demonstration doc) → Task 14. ✓
- `.bat` runners → Task 13. ✓

**Type consistency:** `planFogNodes` returns `{ nodeCount, nodes }` on both server (Task 3) and client (Task 11) with the same constants; `FogNodeSpec` fields match `buildFogNodes`'s mapping to `FogNode`. `cleanRows` return shape `{ valid, invalidCount, duplicatesRemoved }` is used identically in Tasks 8 and 10. `apiFetch`/`ApiError`/`importDataset` names are consistent across Tasks 7 and 9. `Task` fields referenced in Task 12 (`actualLatency`, `energyConsumed`, `assignedTo`, `completedAt`) all exist in `src/types/index.ts`.

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N" — each code step contains complete content.

**Notes for the executor:**
- Tasks 6, 8 manual verifications need MongoDB running for the DB-backed paths; Task 1, 7 (gate), 11, 12 build/UI checks do not.
- `data/clean/` generated files: choose to commit them or `.gitignore` and keep `.gitkeep` (Task 10 Step 4).
