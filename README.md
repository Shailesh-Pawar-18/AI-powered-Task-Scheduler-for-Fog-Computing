# AI-Powered Task Scheduler for Fog Computing (MODRL)

Final-year project (B.E. Computer Engineering, MET's Institute of Engineering, Nashik, SPPU, 2025-26).

IoT devices (healthcare monitors, traffic sensors, industrial controllers) generate tasks. The scheduler decides, for each task, whether it runs on a nearby **fog node** (fast, limited capacity) or in the **cloud** (large capacity, far away), to cut delay and missed deadlines.

**How it works:** three Deep Q-Network agents (**load**, **distance**, **priority**) each propose a node, and **NSGA-II** selection picks the best compromise. The agents are trained in a Python fog-cloud simulator (`ml/`) and run live inside a React dashboard.

The repository has two parts:

| Part | Folder | What it is |
|---|---|---|
| Machine learning | `ml/` | Python (NumPy) simulator, 3 DQN agents, NSGA-II selection, baselines, training and evaluation |
| Dashboard | `src/`, `server/` | React + TypeScript dashboard with a Node.js / Express / MongoDB backend, runs the trained agents live |

---

## Results

Evaluated in the Python simulator on **30 unseen test episodes** per load level (mean over episodes). Arrival rate: 10 tasks/s.

| Strategy | Avg completion (s) | Deadline miss % | Miss % (high/critical tasks) | Energy (J) |
|---|---|---|---|---|
| **MODRL (3×DQN + NSGA-II)** | 0.57 | 0.80 | 2.6 | 917 |
| Load-balanced (dashboard) | 0.79 | 5.78 | 18.6 | 1075 |
| Weighted Score (dashboard) | 0.87 | 7.20 | 22.6 | 1023 |
| Priority-aware (dashboard) | 1.84 | 20.03 | 62.5 | 1049 |
| Energy-efficient (dashboard) | 1.98 | 25.92 | 81.4 | 965 |
| Min-completion-time (strong greedy) | **0.44** | **0.35** | **1.1** | **743** |
| Cloud-only | 12.66 | 86.63 | 96.7 | 1123 |

- MODRL is about **28% faster** and has about **7× fewer missed deadlines** than the best heuristic strategy of the dashboard.
- It does **not** beat a strong greedy rule that sends each task where its predicted completion time is lowest. In this simulator the best choice depends mostly on the current state, so reinforcement learning has little extra to learn.
- The three-agent ensemble is not faster than its own load agent alone. It trades some latency for less cloud use.
- Results come from a **synthetic simulator** and a **single training run**. They do not describe real deployments. Full tables, ablations and plots: `ml/results/` and the dashboard's **Results** page.

---

## Quickstart (Windows)

**Prerequisites:** Node.js **20.19 or newer**. [MongoDB Community Server](https://www.mongodb.com/try/download/community) is optional: without it the app runs in demo mode and datasets are not saved.

**One click:** double-click `run.bat`. It installs dependencies, creates `server/.env`, starts MongoDB, the API (port 4000) and the frontend (port 5173).

Then open **http://localhost:5173** and log in with `admin` / `admin123` (a demo default from `server/.env.example`; change it for any real use).

Manual start (any OS), in two terminals:

```
cd server && npm install && node src/index.js   # backend, http://localhost:4000
npm install && npm run dev                       # frontend, http://localhost:5173
```

More detail: [docs/OVERVIEW.md](./docs/OVERVIEW.md), [docs/INSTALL.md](./docs/INSTALL.md), [docs/DEMONSTRATION.md](./docs/DEMONSTRATION.md), [docs/MODRL_INTEGRATION.md](./docs/MODRL_INTEGRATION.md).

### Using the dashboard

1. Choose a **scheduling strategy** (the dropdown is available while the simulation is stopped).
2. Load a **dataset**: sample (30 tasks), synthetic (150 tasks), SECOM manufacturing data (1,567 tasks) or your own CSV.
3. Press **Start** and watch tasks flow from devices to fog nodes or the cloud, with live metrics.
4. Open **Results** to see the evaluation of MODRL against the other strategies.
5. Open **How it Works** for an explanation of each strategy.

---

## Scheduling strategies

| Strategy | Type | Idea |
|---|---|---|
| **MODRL (3×DQN + NSGA-II)** | Trained model | Three DQN agents propose nodes; NSGA-II ranks the candidates (Pareto fronts, crowding distance) and picks the best compromise |
| **Weighted Score (DRL-inspired)** | Heuristic | Hand-weighted score `(0.3·Resource + 0.2·Distance + 0.2·Energy + 0.3·Load) × PriorityMultiplier`; no trained model |
| **Priority Aware** | Heuristic | High and critical tasks go to the closest node |
| **Load Balanced** | Heuristic | Task goes to the least-loaded fog node |
| **Energy Efficient** | Heuristic | Task goes to the node with the lowest energy use |

The trained agents run in the browser (TypeScript port of the Python model). Because the dashboard models nodes by CPU/memory load instead of queue delay, their inputs are mapped approximately (table in [docs/MODRL_INTEGRATION.md](./docs/MODRL_INTEGRATION.md)). The dashboard finishes tasks at random, so its live charts are a demo; the evaluation above is the evidence.

A parity test checks that the TypeScript version gives the same Q-values and the same chosen node as the Python version.

---

## Machine learning part (`ml/`)

```
cd ml
pip install -r requirements.txt
python train.py                      # about 6 minutes on CPU
python evaluate.py                   # tables and plots in ml/results/
python export_to_dashboard.py ..     # copy weights and results into the dashboard
```

Details, design and limitations: [ml/README_ML.md](./ml/README_ML.md).

---

## Datasets

- `public/data/sample_dataset.csv`: 30 sample tasks.
- **SECOM manufacturing dataset** (1,567 production examples, UCI Machine Learning Repository), converted to tasks in `public/industral - dataset/secom/secom_tasks.csv`. Used as input data only; no model is trained on it. Citation: McCann, M. and Johnston, A. (2008). SECOM. UCI Machine Learning Repository. https://doi.org/10.24432/C54305
- **Custom CSV** upload with this format:

```
timestamp,device_type,priority,cpu,memory,latency
2024-01-01T08:00:00.000Z,healthcare,critical,45,35,80
```

| Field | Meaning |
|---|---|
| `timestamp` | ISO 8601 task creation time |
| `device_type` | `healthcare`, `traffic` or `industrial` |
| `priority` | `critical`, `high`, `medium` or `low` |
| `cpu` | CPU requirement (%) |
| `memory` | Memory (MB) |
| `latency` | Expected latency (ms) |

The backend also cleans uploaded data (validation and SHA-1 duplicate removal) and creates fog nodes automatically (one node per 1,000 records, between 3 and 12).

---

## Technology

- **Dashboard:** React 18, TypeScript, Vite 7, Tailwind CSS, Lucide icons
- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT login, bcrypt
- **Machine learning:** Python 3, NumPy, Matplotlib (no deep-learning framework needed)
- **Testing:** Vitest (frontend and Python-vs-TypeScript parity), Node tests (backend)

---

## Project structure

```
├── src/                  React dashboard
│   ├── components/       Topology, metrics, charts, dataset loader, Results page
│   ├── hooks/            Simulation engine (useSimulation)
│   ├── utils/            scheduler.ts, modrl.ts (agents + NSGA-II), data loading
│   └── models/           Trained weights, parity test vectors, results table
├── server/               Express API, MongoDB models, data cleaning, login
├── ml/                   Python simulator, DQN agents, NSGA-II, training, evaluation
│   ├── fog_drl/          env.py, dqn.py, nsga2.py, scheduler.py, baselines.py
│   ├── models/           Trained agents (.npz)
│   └── results/          Evaluation tables and plots
├── public/               Datasets (sample, SECOM) and result images
├── docs/                 Overview, install, demonstration and integration guides
├── scripts/              setup.bat, start.bat, clean-data.bat
└── run.bat               One-click install and start
```

---

## Publication and registration

- **Paper:** O. Sawant, G. Shahade, A. Sanap, S. Pawar, M. Shinde, "AI-Driven Multi-Objective Task Scheduling in Fog Computing Using Deep Reinforcement Learning," *IJSRET*, vol. 12, issue 3, June 2026. DOI: [10.5281/zenodo.20769734](https://doi.org/10.5281/zenodo.20769734). (Review and proposed framework.)
- **Copyright:** registered with the Copyright Office, Government of India, for "AI-Powered Task Scheduler for Fog Computing". Certificate No. LD-20260184096, filed 15 January 2026.

## Reference

M. A. Ibrahim and S. Askar, "An Intelligent Scheduling Strategy in Fog Computing System Based on Multi-Objective Deep Reinforcement Learning Algorithm," *IEEE Access*, vol. 11, pp. 133607-133622, 2023. DOI: 10.1109/ACCESS.2023.3337034. The multi-agent DQN + NSGA-II structure of this project follows this work; the simulator, reward functions and code are our own.

---

## Limitations and future work

- Single training run and a synthetic simulator; train with several seeds before drawing strong conclusions.
- The reward functions are our own design choices.
- In the dashboard, the agents use approximate inputs; task completion there is random.
- Future work: more seeds and harder scenarios (node failures, task chains), FCFS / Min-Min baselines, real traces or iFogSim, a PyTorch version, and a full evolutionary NSGA-II.

## Team

Gunjan Shahade, Om Sawant, Atul Sanap, Shailesh Pawar. Guide: Prof. Madhuri Shinde. Department of Computer Engineering, MET's Institute of Engineering, Nashik (Savitribai Phule Pune University).

## License

No open-source license has been chosen yet.
