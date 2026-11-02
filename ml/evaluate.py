"""Compare MODRL (3xDQN + NSGA-II) with the baselines on UNSEEN test episodes.

Usage: python evaluate.py [--models models] [--seeds 30]
Outputs: results/summary.csv, results/summary.md, results/comparison.png, results/load_sweep.png
"""
import argparse, csv
import numpy as np

from fog_drl.config import EnvConfig, OBJECTIVES
from fog_drl.env import FogEnv
from fog_drl.baselines import BASELINES
from fog_drl.scheduler import MODRLScheduler

LAMBDAS = (6.0, 8.0, 10.0, 12.0)
METRICS = ["avg_completion_s", "p95_completion_s", "avg_wait_s", "makespan_s", "total_energy_J",
           "cloud_offload_%", "deadline_miss_%", "miss_high_prio_%", "load_imbalance_cv"]


def build_policies(env, model_dir):
    sched = MODRLScheduler.load(model_dir, env.state_dim, env.n_actions)
    pols = {"MODRL (3xDQN + NSGA-II)": lambda e: sched.act(e._obs())}
    for k, name in enumerate(OBJECTIVES):                       # ablation: one agent alone
        pols[f"DQN {name}-only"] = (lambda e, k=k: int(np.argmax(sched.agents[k].q(e._obs()))))
    pols.update(BASELINES)
    return pols, sched


def run(env, policy, seed, lam):
    env.reset(seed=seed, lam=lam)
    done = False
    while not done:
        _, _, done, _ = env.step(policy(env))
    return env.metrics()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default="models"); ap.add_argument("--seeds", type=int, default=30)
    args = ap.parse_args()
    env = FogEnv(EnvConfig())
    pols, sched = build_policies(env, args.models)

    rows, raw = [], {}
    for lam in LAMBDAS:
        for name, pol in pols.items():
            ms = [run(env, pol, seed, lam) for seed in range(args.seeds)]      # test seeds 0..N-1
            raw[(name, lam)] = ms
            row = {"strategy": name, "lambda": lam}
            for m in METRICS:
                v = np.array([x[m] for x in ms]); row[m] = v.mean(); row[m + "_std"] = v.std()
            rows.append(row)

    with open("results/summary.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

    # ---- markdown tables
    cols = [("avg_completion_s", "Avg completion (s)"), ("p95_completion_s", "P95 (s)"),
            ("deadline_miss_%", "Deadline miss %"), ("miss_high_prio_%", "Miss % high/crit"),
            ("cloud_offload_%", "Cloud %"), ("total_energy_J", "Energy (J)"), ("load_imbalance_cv", "Imbalance CV")]
    md = [f"# Results: mean +/- std over {args.seeds} unseen test episodes\n"]
    for lam in LAMBDAS:
        md.append(f"\n## Arrival rate = {lam:g} tasks/s\n")
        md.append("| Strategy | " + " | ".join(c[1] for c in cols) + " |")
        md.append("|---|" + "---|" * len(cols))
        for r in [r for r in rows if r["lambda"] == lam]:
            md.append(f"| {r['strategy']} | " + " | ".join(
                f"{r[k]:.2f} ± {r[k+'_std']:.2f}" for k, _ in cols) + " |")
    open("results/summary.md", "w").write("\n".join(md))
    print("\n".join(md))

    # ---- paired comparison vs the best heuristic baseline at lam=10
    lam = 10.0
    base = min(BASELINES, key=lambda n: np.mean([x["avg_completion_s"] for x in raw[(n, lam)]]))
    mod = "MODRL (3xDQN + NSGA-II)"
    a = np.array([x["avg_completion_s"] for x in raw[(mod, lam)]])
    b = np.array([x["avg_completion_s"] for x in raw[(base, lam)]])
    print(f"\nPaired, lambda=10: MODRL vs best baseline '{base}': "
          f"MODRL better in {np.mean(a < b)*100:.0f}% of episodes, mean diff {np.mean(a-b):+.3f}s "
          f"({np.mean(a-b)/b.mean()*100:+.1f}%)")

    # ---- plots
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    names = list(pols.keys())
    show = [n for n in names if n not in ("Cloud-only", "Random", "DQN distance-only")]

    def colour(n):
        if n.startswith("MODRL"): return "tab:green"
        if n.startswith("DQN"): return "tab:olive"
        if n.startswith("Min-completion"): return "tab:purple"
        return "tab:blue"

    fig, ax = plt.subplots(2, 2, figsize=(14, 8))
    for a_, (k, title) in zip(ax.ravel(), [("avg_completion_s", "Avg completion time (s)"),
                                          ("deadline_miss_%", "Deadline miss (%)"),
                                          ("total_energy_J", "Total energy (J)"),
                                          ("cloud_offload_%", "Cloud offload (%)")]):
        vals = [next(r for r in rows if r["strategy"] == n and r["lambda"] == 10.0) for n in show]
        a_.barh(show, [v[k] for v in vals], xerr=[v[k + "_std"] for v in vals],
                color=[colour(n) for n in show])
        a_.set_title(title + "  (lambda = 10 tasks/s)"); a_.invert_yaxis()
    fig.text(0.5, 0.005, "Not shown (off-scale): Cloud-only, Random, DQN distance-only - see results/summary.md",
             ha="center", fontsize=8)
    plt.tight_layout(rect=(0, 0.02, 1, 1)); plt.savefig("results/comparison.png", dpi=130); plt.close()

    fig, ax = plt.subplots(1, 3, figsize=(16, 4.2))
    for a_, (k, title) in zip(ax, [("avg_completion_s", "Avg completion (s)"),
                                   ("deadline_miss_%", "Deadline miss (%)"),
                                   ("miss_high_prio_%", "Miss % (high + critical tasks)")]):
        for n in show:
            ys = [next(r for r in rows if r["strategy"] == n and r["lambda"] == l)[k] for l in LAMBDAS]
            a_.plot(LAMBDAS, ys, "o-", lw=3 if n.startswith("MODRL") else 1.3, label=n)
        a_.set_xlabel("arrival rate (tasks/s)"); a_.set_title(title)
    ax[0].legend(fontsize=7)
    plt.tight_layout(); plt.savefig("results/load_sweep.png", dpi=130)


if __name__ == "__main__":
    main()
