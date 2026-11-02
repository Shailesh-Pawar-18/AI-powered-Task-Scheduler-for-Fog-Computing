# Installation Guide — AI Fog Computing Scheduler

This guide gets the project running on **Windows** with the bundled `.bat` scripts.
For what the app does once it's running, see [DEMONSTRATION.md](./DEMONSTRATION.md).

---

## 0. One-click (TL;DR)

From the project root, just run:

```bat
run.bat
```

`run.bat` installs dependencies (first run only), creates `server\.env`, **auto-installs
MongoDB if it's missing** (via Chocolatey — you'll see a one-time Administrator/UAC prompt
to approve; falls back to winget, then to demo mode), frees stale ports, and launches the
backend and frontend. Then open **http://localhost:5173** and log in with **admin /
admin123**.

The detailed steps below explain everything `run.bat` does, plus manual equivalents and
troubleshooting. (Step 3 covers installing MongoDB yourself if you'd rather not let the
script do it.)

---

## 1. Prerequisites

| Requirement | Why | How to get it |
|-------------|-----|---------------|
| **Node.js 20.19+** (or 22.12+) | Runs the build, the Vite dev server, and the backend | https://nodejs.org (LTS). Vite 7 requires Node ≥ 20.19. |
| **MongoDB Community Server** | Persists dataset records (Requirement 2) | See step 3 — the app still runs in *demo mode* without it. |
| **Git** | Cloning the repo | https://git-scm.com |

Check Node is present:

```bat
node -v
```

---

## 2. Get the code & install dependencies

From the repo root:

```bat
scripts\setup.bat
```

`setup.bat` does all of this for you:
1. Verifies Node.js is on PATH.
2. Runs `npm install` in the repo root (frontend).
3. Runs `npm install` in `server/` (backend).
4. Creates `server\.env` from `server\.env.example` if it doesn't exist.
5. Checks whether MongoDB is installed and prints guidance if it isn't.

> **Manual equivalent** (if you prefer not to use the script):
> ```bat
> npm install
> cd server && npm install && cd ..
> copy server\.env.example server\.env
> ```

---

## 3. Install MongoDB

The app **persists data in MongoDB**, but it also runs without it (demo mode — data
just isn't saved). To enable persistence:

### Option A — Chocolatey (fastest, sets up an auto-start service)

In a terminal **Run as administrator**:

```bat
choco install mongodb -y
```

This installs MongoDB (e.g. to `C:\Program Files\MongoDB\Server\<version>\bin\mongod.exe`)
and registers a **Windows service** named `MongoDB` that starts automatically and listens
on `localhost:27017`. Nothing else to start — it's already running.

Verify the service:

```bat
powershell -Command "Get-Service MongoDB"
```
Expected: `Status = Running`.

### Option B — Official installer

Download MongoDB Community Server from
https://www.mongodb.com/try/download/community and install with the "Run as a Windows
Service" option checked.

### Option C — Skip it (demo mode)

Do nothing. The app runs; login, the simulation, fog-node creation, metrics, and the
task table all work — only saving/reloading datasets is disabled.

---

## 4. Run everything

```bat
scripts\start.bat
```

`start.bat` opens up to three windows:
- **MongoDB** — only if it isn't already running. If MongoDB is installed as a service
  (Option A), the script detects port `27017` is already served and **does not** launch a
  duplicate.
- **Fog API** — the backend on `http://localhost:4000`.
- **Fog UI** — the Vite dev server on `http://localhost:5173`.

Then open **http://localhost:5173** and log in:

| Field | Default |
|-------|---------|
| Username | `admin` |
| Password | `admin123` |

Change these in `server\.env` (`ADMIN_USERNAME`, `ADMIN_PASSWORD`).

> **Manual equivalent:**
> ```bat
> :: ensure MongoDB is running (service, or:  mongod --dbpath .mongo-data --port 27017)
> cd server && node src\index.js     ::  backend  (new terminal)
> npm run dev                        ::  frontend (another terminal, from repo root)
> ```

---

## 5. Verify the install

With the backend running, check its health:

```bat
curl http://localhost:4000/api/health
```

| Response | Meaning |
|----------|---------|
| `{"ok":true,"db":"connected"}` | Backend up, MongoDB reachable — full persistence. |
| `{"ok":true,"db":"disconnected"}` | Backend up, MongoDB not reachable — demo mode. |

Then in the UI: **Datasets → load Sample** → you should see *"Saved to database: N stored…"*.
**Reload the page** — the data comes back (restore-on-reload).

---

## 6. Configuration — `server/.env`

```
PORT=4000                                       # backend port
MONGODB_URI=mongodb://localhost:27017/fog_scheduler
JWT_SECRET=change-this-dev-secret               # set a real secret outside local dev
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
CLIENT_ORIGIN=http://localhost:5173             # CORS origin
```

---

## 7. Ports used

| Service | Port |
|---------|------|
| Frontend (Vite) | 5173 |
| Backend (Express API) | 4000 |
| MongoDB | 27017 |

---

## 8. Troubleshooting

**`'mongod' is not recognized as an internal or external command`**
MongoDB isn't installed (or isn't on PATH). Install it (step 3). `start.bat` finds it on
PATH, under `C:\Program Files\MongoDB\Server\...`, or a local `.\mongodb\bin\` copy — and
otherwise continues in demo mode.

**Login shows "Internal Server Error" (HTTP 500)**
The frontend is up but the **backend on `:4000` isn't running**, so the Vite proxy returns
500. Start the backend (run `scripts\start.bat`, or `cd server && node src\index.js`), then
retry login. Confirm with `curl http://localhost:4000/api/health`.

**`listen EADDRINUSE: address already in use :::4000` (or :5173)**
A previous backend/frontend is still running on that port. Either reuse it, or free the port:
```bat
powershell -Command "Get-NetTCPConnection -LocalPort 4000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"
```
Close stray `Fog API` / `Fog UI` windows from earlier runs before re-running `start.bat`.

**Datasets don't persist / "running in demo mode" banner**
MongoDB isn't reachable. Confirm the service is running
(`powershell -Command "Get-Service MongoDB"`) and `/api/health` reports `db:connected`.

**MongoDB window says "address already in use" but the app works**
MongoDB is installed as a service and already owns `:27017`; the extra `mongod` window
`start.bat` opened is redundant and can be closed. The backend still connects to the
service.

**`npm run lint` crashes**
Known, unrelated tooling issue (an ESLint 9 / `@typescript-eslint` plugin version
mismatch). It does not affect the build or tests. Use `npm run build` and `npm test` to
verify the code.

---

## 9. Useful commands

```bat
npm run dev        :: frontend dev server (Vite)
npm run build      :: production build (type-checks + bundles)
npm test           :: unit tests (vitest) — fog-node planning + dataset cleaning
npm run preview    :: preview the production build
node server\scripts\clean-data.js   :: clean/dedupe the SECOM dataset → data\clean\
```
