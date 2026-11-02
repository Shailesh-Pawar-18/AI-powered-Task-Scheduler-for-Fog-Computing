# AI Fog Computing Scheduler — Platform Upgrade Design

**Date:** 2026-06-24
**Status:** Approved (design), pending spec review
**Author:** Atharva Bhosale (with Claude Code)

## 1. Summary

The project is currently a **frontend-only** React + TypeScript + Vite + Tailwind SPA that
simulates AI-driven task scheduling across fog nodes and a cloud node. There is no backend and
no persistence; datasets live only in browser memory. The `@supabase/supabase-js` dependency is
present but unused.

This upgrade adds a small **Node/Express + Mongoose backend** backed by **local MongoDB**, gates
the whole UI behind an **admin login**, persists dataset records, creates fog nodes
**dynamically from the record count**, adds a **structured task table**, **fixes the broken
Performance Metrics and Fog Node Status**, builds a **dataset cleaning/validation pipeline**, and
ships a **demonstration document**. Windows `.bat` files make setup and run one-click.

The simulation engine remains **client-side** (it is a visualization). The backend handles
persistence, authentication, and data cleaning. Python/DQN training (hinted at in
`public/modulename.md`) is explicitly **out of scope** for this effort.

## 2. Goals (the 7 requirements)

1. **Admin login** that gates access to the complete UI after successful login.
2. **MongoDB** integration to store and manage all dataset records permanently.
3. **Automatic fog-node creation** based on the number of dataset records, with defined logic and
   thresholds.
4. **Task records table** (Pending, Processing, Completed, Failed) with all relevant details and
   units.
5. **Fix Performance Metrics and Fog Node Status**, which currently do not update.
6. **Clean and validate the dataset**: remove duplicates and produce a complete unique dataset with
   appropriate values and units.
7. **Demonstration `.md`** explaining load balancing, system architecture, fog-node creation,
   performance metrics, and the overall workflow.

## 3. Non-goals (out of scope)

- Python files / DQN agent training / reinforcement-learning model code.
- Multi-user accounts, roles, or registration (single admin only).
- Cloud hosting / deployment pipeline (local development only).
- Rewriting the scheduling algorithms (they are kept; only the loop that drives them is fixed).

## 4. Root-cause analysis of the "broken" modules (Requirement 5)

`startSimulation()` runs `intervalRef.current = setInterval(simulationLoop, 1000)`. The
`simulationLoop` captured at that instant is **frozen**: it closes over the `tasks`, `fogNodes`,
and `cloudNode` values from the render when the simulation started. The interval keeps calling that
same frozen closure every second.

Consequence:
- `updateNodeStates()` reads `tasks` from the frozen closure (the initial **empty** array), so
  fog-node `currentCpu` / `currentMemory` / `energyConsumption` never change → **Fog Node Status
  appears dead**.
- `calculateMetrics()` reads the same stale `tasks`, so `totalTasks`, utilization, latency, and
  energy stay effectively stuck → **Performance Metrics appear broken**.

This is the same class of bug already fixed for the dataset progress bar (which now uses a ref).

**Fix:** adopt the `useInterval` pattern — keep the latest `simulationLoop` in a `loopRef`
(updated every render via `useEffect`) and have the interval call `loopRef.current()`. Every tick
then runs against the freshest committed state. This repairs node status and metrics together. The
dataset cursor ref added earlier remains compatible.

## 5. Architecture

```
Al-Fog-computing/
├─ server/                         # NEW backend — plain ESM JavaScript (no build step)
│  ├─ src/
│  │  ├─ index.js                  # Express app, CORS, route mounting, error handler
│  │  ├─ db.js                     # Mongoose connect → mongodb://localhost:27017/fog_scheduler
│  │  ├─ models/
│  │  │  ├─ DatasetRecord.js
│  │  │  └─ ImportBatch.js
│  │  ├─ routes/
│  │  │  ├─ auth.js                # POST /api/auth/login
│  │  │  ├─ datasets.js            # import / list / stats / clear
│  │  │  └─ nodes.js               # GET /api/nodes/plan?records=N
│  │  ├─ middleware/auth.js        # JWT verification
│  │  └─ lib/
│  │     ├─ cleaning.js            # validate + dedupe (shared by import and clean script)
│  │     └─ fogNodes.js            # node-creation logic + thresholds (source of truth)
│  ├─ scripts/clean-data.js        # CLI: clean SECOM CSV → data/clean/*
│  ├─ .env.example
│  └─ package.json                 # express, mongoose, jsonwebtoken, bcryptjs, cors, multer, dotenv
│
├─ src/                            # existing React app (TypeScript)
│  ├─ api/client.ts                # fetch wrappers; attaches Bearer token; base URL from env
│  ├─ context/AuthContext.tsx      # token state, login(), logout(), isAuthenticated
│  ├─ components/
│  │  ├─ LoginScreen.tsx           # NEW — gate
│  │  ├─ TaskTable.tsx             # NEW — requirement 4
│  │  └─ (existing components)
│  ├─ hooks/useSimulation.ts       # fixed loop + dynamic node creation
│  └─ utils/fogNodes.ts            # mirror of server node-creation rule (same constants)
│
├─ scripts/
│  ├─ setup.bat                    # install deps (root + server), copy .env, detect mongod
│  └─ start.bat                    # start mongod + backend + vite, each in its own window
│
├─ data/
│  └─ clean/                       # output of cleaning pipeline (clean_dataset.csv/.json)
│
└─ docs/
   └─ DEMONSTRATION.md             # requirement 7
```

**Process model at runtime (via `start.bat`):**
- `mongod` on `localhost:27017`, data dir `./.mongo-data` (gitignored).
- Backend on `http://localhost:4000`.
- Vite dev server on `http://localhost:5173`, proxying `/api` to the backend.

## 6. Data model (MongoDB)

### `DatasetRecord`
| Field        | Type     | Notes                                                       |
|--------------|----------|-------------------------------------------------------------|
| `batchId`    | ObjectId | references `ImportBatch`                                    |
| `timestamp`  | Date     | from source row                                            |
| `deviceType` | String   | enum: `healthcare` \| `traffic` \| `industrial`            |
| `priority`   | String   | enum: `low` \| `medium` \| `high` \| `critical`            |
| `cpu`        | Number   | percent (0–100)                                            |
| `memory`     | Number   | MB                                                         |
| `latency`    | Number   | ms                                                        |
| `sensorId`   | String   | optional                                                   |
| `rowHash`    | String   | **unique index** — sha1 of normalized fields (dedupe key)  |
| `createdAt`  | Date     | auto                                                       |

Unique index on `rowHash` enforces no duplicates at the DB layer. `deviceType`+`priority` indexed
for stats queries.

### `ImportBatch`
| Field             | Type   | Notes                                            |
|-------------------|--------|--------------------------------------------------|
| `source`          | String | `sample` \| `synthetic` \| `upload` \| `secom`   |
| `fileName`        | String | optional                                         |
| `rowsReceived`    | Number | raw count                                        |
| `rowsInvalid`     | Number | dropped by validation                            |
| `duplicatesRemoved`| Number| dropped by dedupe (within batch + vs DB)         |
| `rowsStored`      | Number | net inserted                                     |
| `createdAt`       | Date   | auto                                             |

## 7. API contract

All routes except `POST /api/auth/login` require `Authorization: Bearer <jwt>`.

| Method | Path                       | Body / Query                  | Response                                  |
|--------|----------------------------|-------------------------------|-------------------------------------------|
| POST   | `/api/auth/login`          | `{ username, password }`      | `{ token, expiresIn }` or `401`           |
| POST   | `/api/datasets/import`     | `{ source, rows: Row[] }`     | `{ batch: ImportBatch }`                  |
| GET    | `/api/datasets`            | `?limit&skip&type&priority`   | `{ total, records: DatasetRecord[] }`     |
| GET    | `/api/datasets/stats`      | —                             | `{ total, byType, byPriority }`           |
| DELETE | `/api/datasets`            | —                             | `{ deleted }` (clear all)                 |
| GET    | `/api/nodes/plan`          | `?records=N`                  | `{ nodeCount, nodes: FogNodeSpec[] }`     |

`Row` shape accepted by import: `{ timestamp, device_type, priority, cpu, memory, latency, sensor_id? }`.

## 8. Requirement details

### 8.1 Admin login (Req 1)
- Credentials configured in `server/.env`: `ADMIN_USERNAME`, `ADMIN_PASSWORD` (bcrypt-compared at
  startup by hashing the env value once in memory). **Defaults: `admin` / `admin123`.**
- `POST /api/auth/login` verifies and returns a JWT signed with `JWT_SECRET`, `expiresIn = 8h`.
- Frontend `AuthContext` stores the token in `localStorage`. While unauthenticated, only
  `LoginScreen` renders. After login, the full dashboard renders. Header gains a **Logout** button.
- Expired/invalid token → API returns `401` → client clears token and returns to `LoginScreen`.

### 8.2 MongoDB persistence (Req 2)
- The existing `DatasetLoader` actions (sample / synthetic / upload) call
  `POST /api/datasets/import` instead of only holding data in memory.
- The dashboard reads persisted records from `GET /api/datasets`, so a reload restores data.
- A "Clear stored data" control calls `DELETE /api/datasets`.
- **Graceful degradation:** if the backend/DB is unreachable, the app shows a clear banner and
  falls back to in-memory demo mode (existing behavior) so the simulation still runs.

### 8.3 Automatic fog-node creation (Req 3)
Single source of truth in `server/src/lib/fogNodes.js`, mirrored in `src/utils/fogNodes.ts` with
identical constants.

```
NODE_PER_RECORDS = 1000
MIN_NODES = 3
MAX_NODES = 12
nodeCount = clamp(ceil(recordCount / NODE_PER_RECORDS), MIN_NODES, MAX_NODES)
```

- Example: **10,000 records → 10 nodes**. `< 1,000 → 3`. `> 12,000 → 12` (capped).
- **Capacity scaling beyond the cap:** when `recordCount / NODE_PER_RECORDS > MAX_NODES`, multiply
  each node's `maxCpu`/`maxMemory` by `ceil((recordCount / NODE_PER_RECORDS) / MAX_NODES)` so total
  capacity keeps pace with load.
- Each node gets a cycling capacity **profile** (matched to the existing task scale — tasks need
  ~10–80% CPU and ~15–60 MB, so these keep nodes meaningfully fillable):
  - Small: `maxCpu 80`, `maxMemory 150` (MB)
  - Medium: `maxCpu 100`, `maxMemory 200` (MB)
  - Large: `maxCpu 120`, `maxMemory 250` (MB)
- `distance` increases with index (10, 15, 20, …). Positions auto-laid-out on an arc/grid for the
  topology view. The cloud node is unchanged.
- The simulation initializes its fog nodes from this plan based on the loaded record count (from the
  DB count, or the in-memory set in demo mode).

### 8.4 Task records table (Req 4)
- New `TaskTable.tsx`, full-width section below the topology.
- Status tabs: **All · Pending · Processing · Completed · Failed**, each with a count.
- Columns (with units): `Task ID`, `Type`, `Priority`, `Status`, `CPU (%)`, `Memory (MB)`,
  `Expected (ms)`, `Actual (ms)`, `Energy (kW)`, `Assigned Node`, `Created`, `Completed`.
- Sortable by column, client-side paginated (e.g., 20/page), scrollable, uses the slim dark
  scrollbar and lucide icons (consistent with existing UI). The live card queues remain for the
  topology panel.

### 8.5 Fix Metrics & Fog Node Status (Req 5)
- Implement the `loopRef`/`useInterval` fix in `useSimulation.ts` (Section 4).
- Verify: utilization, energy, average latency, fog-node CPU/memory bars all move during a run; the
  metrics cards reflect real totals.

### 8.6 Dataset cleaning & validation (Req 6)
- `server/src/lib/cleaning.js` exposes `cleanRows(rows)` returning
  `{ valid, invalidCount, duplicatesRemoved }`:
  - Trim strings; lowercase `device_type`/`priority`.
  - Validate enums; coerce `cpu`/`memory`/`latency` to numbers; drop rows where any is `NaN`,
    `<= 0`, or out of sane range (cpu 0–100, memory 0–8192, latency 0–100000).
  - Dedupe by `rowHash` = sha1 of `deviceType|priority|cpu|memory|latency|sensorId` (within the
    batch; the DB unique index also rejects cross-batch duplicates).
- Used by both `/api/datasets/import` and the offline script.
- `server/scripts/clean-data.js` (run via `npm run clean-data` and a `.bat`) reads the real
  **1,566-row SECOM** CSV (`public/industral - dataset/secom/secom_tasks.csv`, heavily duplicated)
  and writes `data/clean/clean_dataset.csv` and `.json` with **unit-labeled headers**
  (`timestamp,device_type,priority,cpu_pct,memory_mb,latency_ms,sensor_id`). Prints a report:
  rows in / invalid / duplicates removed / unique out.

### 8.7 Demonstration doc (Req 7)
`docs/DEMONSTRATION.md` with sections:
1. System architecture (components + a Mermaid diagram).
2. Load balancing & the four scheduling strategies, including the DRL scoring formula.
3. Fog-node creation process and thresholds (mirrors Section 8.3).
4. Performance metrics — definitions and units.
5. End-to-end workflow (login → import → clean → node plan → simulate → observe).
6. Key concepts (fog vs cloud, priority, energy model, dedupe).

## 9. `.bat` files (Windows one-click)

### `scripts/setup.bat`
1. Check `node` and `npm` exist; abort with a message if not.
2. `npm install` in repo root and in `server/`.
3. If `server/.env` is missing, copy `server/.env.example` → `server/.env`.
4. Detect `mongod` on PATH; if missing, print the one-time MongoDB Community Server install link and
   continue (setup still completes).

### `scripts/start.bat`
1. Ensure `./.mongo-data` exists; start `mongod --dbpath ./.mongo-data --port 27017` in a new window.
2. Start backend: `node server/src/index.js` in a new window (port from `.env`, default 4000).
3. Start frontend: `npm run dev` in a new window (Vite, port 5173).
4. Print the URLs.

`.gitignore` updated to exclude `.mongo-data/`, `server/.env`, and `server/node_modules/`.

## 10. Build sequence (phases)

1. **Engine fix (Req 5)** — `loopRef` in `useSimulation.ts`. Smallest, unblocks visible breakage.
2. **Backend skeleton + Mongo + `.bat`** (Sections 5, 9).
3. **Auth gate (Req 1)** — `/api/auth/login`, `AuthContext`, `LoginScreen`, logout.
4. **Persistence + cleaning (Req 2, 6)** — models, import route, cleaning lib, clean-data script.
5. **Dynamic fog nodes (Req 3)** — `fogNodes` lib (server + client), wire into simulation.
6. **Task table (Req 4)** — `TaskTable.tsx`.
7. **Demonstration doc (Req 7)**.

## 11. Acceptance criteria

- Visiting the app shows a login screen; correct admin credentials reveal the full dashboard; logout
  returns to login; wrong credentials show an error.
- Importing a dataset stores records in MongoDB; reloading the page restores them from the DB.
- With 10,000 records loaded, the simulation creates exactly 10 fog nodes; <1,000 creates 3.
- During a run, Fog Node Status bars and all Performance Metrics update continuously (no longer
  frozen at zero).
- The task table lists Pending/Processing/Completed/Failed tasks with the specified unit-labeled
  columns and working status tabs.
- The cleaning script turns the 1,566-row SECOM file into a smaller set of unique, validated,
  unit-labeled records and reports the duplicate count.
- `scripts/setup.bat` then `scripts/start.bat` bring up Mongo + backend + frontend on a clean
  Windows machine (with MongoDB installed).
- `docs/DEMONSTRATION.md` covers all six required topics.
- `npm run build` passes; no new TypeScript errors are introduced.

## 12. Risks & mitigations

- **MongoDB not installed** → `setup.bat` detects and instructs; app degrades to demo mode if DB is
  down, so the simulation still demonstrates.
- **End-to-end DB verification on this machine** may not be possible if MongoDB is absent; backend
  code will be written defensively and unit-validated where feasible (e.g., cleaning logic tested in
  isolation).
- **Server JS vs app TS drift** for node-creation constants → keep constants in one obvious place in
  each file and cross-reference in comments; covered by the 10,000→10 acceptance test on both sides.
