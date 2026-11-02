# Multi-Objective DRL Task Scheduling for Fog Computing (Python)

Implementation of the scheduling idea from

> M. A. Ibrahim and S. Askar, "An Intelligent Scheduling Strategy in Fog Computing System Based on
> Multi-Objective Deep Reinforcement Learning Algorithm," *IEEE Access*, vol. 11, 2023,
> doi: 10.1109/ACCESS.2023.3337034.

This is a **from-scratch, simplified re-implementation** (NumPy only, no PyTorch needed) that follows the paper's
structure; it is **not** the authors' code and does not reproduce their exact simulator or numbers.

## What is implemented

| Paper component | This project |
|---|---|
| Three DQN agents, one per objective (load, distance, priority) | `fog_drl/dqn.py` - Double-DQN, replay buffer, target network, MLP + Adam written in NumPy. Each agent learns its own reward from the same experience. |
| NSGA-II to resolve disagreement between the agents | `fog_drl/nsga2.py` - fast non-dominated sorting + crowding distance. Each agent nominates its top-3 nodes; the candidates are ranked on the three agents' Q-values and the knee point of the first Pareto front is chosen. **Only the NSGA-II ranking/selection operators are used, not a full evolutionary run.** |
| Fog nodes + cloud environment | `fog_drl/env.py` - FIFO queues on heterogeneous fog nodes, WAN latency and a shared cloud uplink, 4 priority classes with deadlines, Poisson arrivals. |
| Comparison with other schedulers | `fog_drl/baselines.py` - the 4 strategies from the web dashboard (re-implemented, mapping approximate), a strong greedy baseline, random, cloud-only. |

## Run it

```bash
pip install -r requirements.txt
python train.py            # ~6 min on CPU; saves models/ + results/training_curves.png
python evaluate.py         # 30 unseen test episodes x 4 load levels -> results/summary.md + plots
```

Seeds: training episodes use seeds >= 1000, validation 500-509 (used only to pick the best checkpoint),
test 0-29, so test episodes are never seen in training.

## Results (arrival rate 10 tasks/s, mean +/- std over 30 unseen episodes; full tables in `results/summary.md`)

| Strategy | Avg completion (s) | Deadline miss % | Miss % high/critical | Energy (J) |
|---|---|---|---|---|
| **MODRL (3xDQN + NSGA-II)** | 0.57 +/- 0.08 | 0.80 | 2.6 | 917 |
| DQN load-agent only (ablation) | 0.46 +/- 0.05 | 0.42 | 1.3 | 852 |
| DQN distance-agent only (ablation) | 33.4 +/- 21.6 | 86.1 | 89.5 | 974 |
| Weighted-score (dashboard "DRL Optimized") | 0.87 +/- 0.34 | 7.20 | 22.6 | 1023 |
| Load-balanced | 0.79 +/- 0.35 | 5.78 | 18.6 | 1075 |
| Priority-aware | 1.84 +/- 0.13 | 20.0 | 62.5 | 1049 |
| Energy-efficient | 1.98 +/- 0.08 | 25.9 | 81.4 | 965 |
| **Min-completion-time (strong greedy)** | **0.44 +/- 0.06** | **0.35** | **1.1** | **743** |
| Random | 1.88 +/- 0.94 | 19.3 | 37.9 | 1181 |
| Cloud-only | 12.7 +/- 0.9 | 86.6 | 96.7 | 1123 |

### What the results do and do not show

* **MODRL clearly beats the four dashboard strategies** (about 28 % lower completion time than the best of them, Load-balanced,
  and roughly 7x fewer deadline misses at 10 tasks/s; same direction at every load level 6-12).
* **It does NOT beat a strong greedy heuristic** that picks the node with the lowest predicted completion time:
  the greedy rule wins at every load level (paired test: MODRL better in 0 % of episodes at 10 tasks/s).
  In this simulator the best decision is almost entirely determined by the current state, so there is little
  long-horizon structure for reinforcement learning to exploit.
* **The multi-agent + NSGA-II ensemble is not better than its own load agent on latency.** The ensemble trades a bit of
  latency for the distance objective (it offloads 16 % of tasks to the cloud instead of 39 %). The distance-only agent
  fails completely (always picks the nearest node and overloads it), which shows why a single objective is not enough,
  but the load agent alone is already a strong policy here.
* All results come from a **synthetic simulator that we designed**; they say nothing about real fog deployments.
  Numbers are from one training run (one seed); retrain with `--seed` to check variance.

## Honest limitations / ideas for future work

1. Single training seed; report mean +/- std over several training seeds for a stronger claim.
2. Reward design matters a lot (the three rewards here are our own choices, not taken from the paper).
3. Add scenarios where greedy fails (multi-step dependencies, energy budgets, node failures, task chains).
4. Replace the toy simulator with iFogSim / real traces; swap NumPy DQN for PyTorch DQN/PPO.
5. Full NSGA-II (evolving a population) instead of selection among the agents' candidates.
