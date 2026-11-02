# MODRL integration (3×DQN + NSGA-II) in the dashboard

Reference: M. A. Ibrahim and S. Askar, "An Intelligent Scheduling Strategy in Fog Computing System Based on
Multi-Objective Deep Reinforcement Learning Algorithm," IEEE Access, vol. 11, 2023, doi 10.1109/ACCESS.2023.3337034.
This is a simplified re-implementation, not the authors' code.

## What was added

| File | Purpose |
|---|---|
| `ml/` | Python part: simulator, 3 DQN agents (NumPy), NSGA-II selection, baselines, training, evaluation |
| `src/models/modrl.json` | Trained weights of the 3 agents (exported from `ml/models`) |
| `src/utils/modrl.ts` | Runtime in TypeScript: MLP forward pass, NSGA-II selection, dashboard → agent state adapter |
| `src/utils/modrl.test.ts` | Parity tests: TS gives the same Q-values and the same chosen node as Python on 40 recorded states |
| `src/utils/scheduler.ts` | New strategy id `modrl` |
| `src/components/ResultsPanel.tsx`, `public/results/*.png`, `src/models/modrlResults.json` | "Results" page |

The old strategy "DRL Optimized" was **renamed "Weighted Score (DRL-inspired)"** (id unchanged): it is a hand-weighted
formula with no trained model.

## How the dashboard is mapped to the agents' inputs (approximate)

| Agent input (Python simulator) | Dashboard value used |
|---|---|
| Node backlog (queue delay) | max(CPU load %, memory load %) of the fog node; cloud: tasks in flight / 20 |
| Node speed | `maxCpu`, min-max scaled to 1000-3500 MIPS |
| Network latency | `distance`, min-max scaled to 5-40 ms (cloud 150 ms) |
| Node power | `maxCpu`, min-max scaled to 5-15 W |
| Task length / data size | `cpuRequirement` / `memoryRequirement`, scaled to 200-2000 MI / 0.5-4 MB |
| Task deadline | by priority: 6 / 3 / 1.5 / 0.8 s (as in training) |

* The agents see **6 fog slots**: the 6 least-loaded nodes that can accept the task (padding slots are masked if fewer exist).
* Nodes that cannot take the task are excluded; if none can, the task goes to the cloud.

## Limits to state in the report

* The dashboard finishes tasks at random (20 % per tick), so its live latency/energy charts mostly reflect that rule, not
  decision quality. **The evidence for MODRL is the Python evaluation (Results page), not the live charts.**
* Agents are applied to approximate inputs (table above), unlike in training.
* In the evaluation MODRL beats the four dashboard heuristics but not a strong greedy "lowest predicted completion time"
  baseline; the 3-agent ensemble is not faster than its own load agent. See `ml/README_ML.md`.

## Retrain and re-export

```bash
cd ml
pip install -r requirements.txt
python train.py && python evaluate.py
python export_to_dashboard.py ..      # refreshes weights, parity vectors, results table and plots
cd .. && npm test                     # parity tests must still pass
```
