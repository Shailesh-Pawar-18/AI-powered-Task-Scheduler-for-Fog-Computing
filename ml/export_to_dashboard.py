"""Export trained agents, TS parity test vectors and evaluation results for the React dashboard.

Usage: python export_to_dashboard.py <dashboard_project_dir>
"""
import csv, json, os, sys
import numpy as np

from fog_drl.config import EnvConfig, OBJECTIVES
from fog_drl.env import FogEnv
from fog_drl.scheduler import MODRLScheduler


def r(a, nd=6):
    return np.round(np.asarray(a, dtype=float), nd).tolist()


def main(dst):
    env = FogEnv(EnvConfig())
    sched = MODRLScheduler.load("models", env.state_dim, env.n_actions)
    os.makedirs(os.path.join(dst, "src", "models"), exist_ok=True)

    weights = {
        "state_dim": env.state_dim, "n_actions": env.n_actions, "n_fog": env.n_fog,
        "top_k": sched.top_k, "objectives": list(OBJECTIVES),
        "agents": {ag.name: {"W": [r(w) for w in ag.online.W], "b": [r(b) for b in ag.online.b]}
                   for ag in sched.agents},
    }
    with open(os.path.join(dst, "src", "models", "modrl.json"), "w") as f:
        json.dump(weights, f, separators=(",", ":"))

    # ---- parity vectors: states seen while the TRAINED scheduler and a random policy run
    # Use the exact rounded weights the dashboard will use, so parity is end-to-end.
    for ag in sched.agents:
        ag.online.W = [np.round(w, 6) for w in ag.online.W]
        ag.online.b = [np.round(b, 6) for b in ag.online.b]
    rng = np.random.default_rng(123)
    cases = []
    for ep in range(6):
        s = env.reset(seed=9000 + ep, lam=float(rng.choice([6, 9, 12])))
        done = False
        while not done:
            if env.i % 7 == 0 and len(cases) < 40:
                Q = sched.q_values(s)
                a = sched.act(s)
                cases.append({"state": r(s, 8), "q": {n: r(Q[k], 6) for k, n in enumerate(OBJECTIVES)},
                              "action": int(a)})
            a = sched.act(s) if rng.random() < 0.6 else int(rng.integers(env.n_actions))
            s, _, done, _ = env.step(a)
    with open(os.path.join(dst, "src", "models", "modrl.parity.json"), "w") as f:
        json.dump(cases, f, separators=(",", ":"))

    # ---- evaluation results table for the Results page
    rows = list(csv.DictReader(open("results/summary.csv")))
    keep = ["avg_completion_s", "p95_completion_s", "deadline_miss_%", "miss_high_prio_%",
            "cloud_offload_%", "total_energy_J"]
    out = {}
    for row in rows:
        lam = f"{float(row['lambda']):g}"
        out.setdefault(lam, []).append({"strategy": row["strategy"],
            **{k: round(float(row[k]), 3) for k in keep},
            **{k + "_std": round(float(row[k + "_std"]), 3) for k in keep}})
    with open(os.path.join(dst, "src", "models", "modrlResults.json"), "w") as f:
        json.dump(out, f, separators=(",", ":"))

    # ---- plots
    pub = os.path.join(dst, "public", "results"); os.makedirs(pub, exist_ok=True)
    import shutil
    for fn in ("comparison.png", "load_sweep.png", "training_curves.png"):
        shutil.copy(os.path.join("results", fn), pub)
    print("exported:", len(cases), "parity cases;", os.path.getsize(os.path.join(dst, "src", "models", "modrl.json")) // 1024, "KB weights")


if __name__ == "__main__":
    main(sys.argv[1])
