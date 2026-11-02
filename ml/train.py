"""Train the three DQN agents (load / distance / priority) in the fog simulator.

Usage:  python train.py [--episodes 400] [--seed 0]
Outputs: models/agent_<objective>.npz (best validation checkpoint),
         results/training_log.csv, results/training_curves.png
"""
import argparse, csv, os, time
import numpy as np

from fog_drl.config import EnvConfig, TrainConfig, OBJECTIVES
from fog_drl.env import FogEnv
from fog_drl.dqn import DQNAgent, ReplayBuffer
from fog_drl.scheduler import MODRLScheduler

VAL_SEEDS = range(500, 510)      # validation episodes (never used for training or final test)
VAL_LAMBDA = (7.0, 10.0)


def run_episode(env, policy, seed, lam):
    env.reset(seed=seed, lam=lam)
    done = False
    while not done:
        _, _, done, _ = env.step(policy(env))
    return env.metrics()


def validate(env, sched):
    ms = []
    for k, seed in enumerate(VAL_SEEDS):
        lam = VAL_LAMBDA[k % 2]
        env.reset(seed=seed, lam=lam)
        s, done = env._obs(), False
        while not done:
            s, _, done, _ = env.step(sched.act(s))
        ms.append(env.metrics())
    comp = np.mean([m["avg_completion_s"] for m in ms])
    miss = np.mean([m["deadline_miss_%"] for m in ms])
    return comp + 0.1 * miss, comp, miss          # lower is better


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--episodes", type=int, default=None)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", default="models")
    args = ap.parse_args()

    tc, ec = TrainConfig(), EnvConfig()
    tc.seed = args.seed
    if args.episodes:
        tc.episodes = args.episodes
    os.makedirs(args.out, exist_ok=True); os.makedirs("results", exist_ok=True)

    env = FogEnv(ec)
    rng = np.random.default_rng(tc.seed)
    agents = [DQNAgent(env.state_dim, env.n_actions, name, tc.hidden, tc.lr, tc.gamma, tc.seed + i)
              for i, name in enumerate(OBJECTIVES)]
    sched = MODRLScheduler(agents)
    buf = ReplayBuffer(tc.buffer_size, env.state_dim, len(OBJECTIVES), rng)

    decay_eps = max(1, int(tc.episodes * tc.eps_decay_frac))
    step_count = grad_steps = 0
    best_val, log, t0 = np.inf, [], time.time()

    for ep in range(tc.episodes):
        eps = max(tc.eps_end, tc.eps_start - (tc.eps_start - tc.eps_end) * ep / decay_eps)
        s = env.reset(seed=tc.train_seed_offset + tc.seed * 100_000 + ep)
        done, ep_r, losses = False, np.zeros(len(OBJECTIVES)), []
        while not done:
            a = int(rng.integers(env.n_actions)) if rng.random() < eps else sched.act(s)
            s2, r, done, _ = env.step(a)
            buf.add(s, a, r, s2, float(done))
            s, ep_r = s2, ep_r + r
            step_count += 1
            if buf.n >= tc.warmup and step_count % tc.update_every == 0:
                bs, ba, br, bs2, bd = buf.sample(tc.batch_size)
                for k, ag in enumerate(agents):          # each agent learns ITS OWN reward
                    losses.append(ag.update(bs, ba, br[:, k], bs2, bd))
                grad_steps += 1
                if grad_steps % tc.target_sync == 0:
                    for ag in agents:
                        ag.sync_target()

        m = env.metrics()
        row = {"episode": ep, "epsilon": round(eps, 3),
               **{f"reward_{n}": ep_r[k] / ec.tasks_per_episode for k, n in enumerate(OBJECTIVES)},
               "avg_completion_s": m["avg_completion_s"], "deadline_miss_%": m["deadline_miss_%"],
               "loss": float(np.mean(losses)) if losses else np.nan}
        if (ep + 1) % 20 == 0 or ep == tc.episodes - 1:
            score, vc, vm = validate(env, sched)
            row.update(val_score=score, val_completion_s=vc, val_miss_pct=vm)
            tag = ""
            if score < best_val and buf.n >= tc.warmup:
                best_val = score
                for ag in agents:
                    ag.save(os.path.join(args.out, f"agent_{ag.name}.npz"))
                tag = "  <- saved"
            print(f"ep {ep+1:4d}/{tc.episodes} eps={eps:.2f} val: comp={vc:.3f}s miss={vm:.1f}% "
                  f"score={score:.3f}{tag}  [{time.time()-t0:.0f}s]", flush=True)
        log.append(row)

    keys = sorted({k for r in log for k in r}, key=lambda k: list(log[-1].keys()).index(k)
                  if k in log[-1] else 99)
    with open("results/training_log.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keys); w.writeheader(); w.writerows(log)
    print(f"done in {time.time()-t0:.0f}s, best validation score {best_val:.3f}")

    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(1, 3, figsize=(15, 4))
    sm = lambda x, k=10: np.convolve(x, np.ones(k) / k, mode="valid")
    for n in OBJECTIVES:
        ax[0].plot(sm([r[f"reward_{n}"] for r in log]), label=n)
    ax[0].set_title("Mean reward per task (smoothed)"); ax[0].set_xlabel("episode"); ax[0].legend()
    ax[1].plot(sm([r["avg_completion_s"] for r in log]), color="tab:red")
    ax[1].set_title("Avg completion time during training (s)"); ax[1].set_xlabel("episode")
    v = [(r["episode"], r["val_completion_s"], r["val_miss_pct"]) for r in log if "val_score" in r]
    ax[2].plot([x[0] for x in v], [x[1] for x in v], "o-", label="completion (s)")
    ax2 = ax[2].twinx(); ax2.plot([x[0] for x in v], [x[2] for x in v], "s--", color="tab:orange")
    ax2.set_ylabel("deadline miss %"); ax[2].set_title("Validation (greedy policy)"); ax[2].set_xlabel("episode")
    plt.tight_layout(); plt.savefig("results/training_curves.png", dpi=130)


if __name__ == "__main__":
    main()
