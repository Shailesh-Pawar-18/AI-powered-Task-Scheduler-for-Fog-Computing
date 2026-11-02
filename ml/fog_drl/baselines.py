"""Baseline schedulers. Each policy is  f(env) -> action  and may only use what a real
scheduler could observe at the arrival time of the task.

weighted_score / priority_aware / load_balanced / energy_efficient mirror the four
strategies in the web dashboard (src/utils/scheduler.ts); the mapping from the
dashboard's CPU/memory model to this queue-based simulator is approximate.
"""
import numpy as np

PRIORITY_MULT = (1.0, 1.5, 2.0, 3.0)         # low, medium, high, critical
CLOUD_PENALTY = (0.8, 0.6, 0.4, 0.1)
MAX_BACKLOG_OK = 2.0                          # s: a fog node with a longer queue "cannot process" the task


def _candidates(env):
    b = env.backlog()[: env.n_fog]
    ok = [j for j in range(env.n_fog) if b[j] <= MAX_BACKLOG_OK]
    return ok, b


def weighted_score(env):
    """The dashboard's 'DRL Optimized' strategy: hand-weighted score (0.3/0.2/0.2/0.3)."""
    t = env.task()
    ok, b = _candidates(env)
    bn = np.clip(b / env.cfg.backlog_scale, 0, 1)
    best_a, best_s = env.n_fog, -np.inf
    for j in ok:
        resource = (1 - bn[j] + 1 - 0.5 * bn[j]) / 2
        distance = 1 / (1 + env.latency[j] * 1000 / 100)
        energy = 1 / (1 + env.power[j] / 10)
        load = 1 - bn[j]
        s = (0.3 * resource + 0.2 * distance + 0.2 * energy + 0.3 * load) * PRIORITY_MULT[t["prio"]]
        if s > best_s:
            best_a, best_s = j, s
    if 0.7 * CLOUD_PENALTY[t["prio"]] > best_s:
        return env.n_fog
    return best_a


def priority_aware(env):
    t = env.task()
    ok, _ = _candidates(env)
    if not ok:
        return env.n_fog
    if t["prio"] >= 2:                                   # high / critical -> closest node
        return min(ok, key=lambda j: env.latency[j])
    return ok[0]                                          # others -> first available


def load_balanced(env):
    ok, b = _candidates(env)
    return min(ok, key=lambda j: b[j]) if ok else env.n_fog


def energy_efficient(env):
    ok, _ = _candidates(env)
    return min(ok, key=lambda j: env.power[j]) if ok else env.n_fog


def min_completion_time(env):
    """Strong greedy heuristic: send the task wherever its PREDICTED completion time is lowest
    (uses queue backlog, node speed, latency, bandwidth and the cloud uplink queue)."""
    t = env.task()
    b = env.backlog()
    best_a, best_c = 0, np.inf
    for j in range(env.n_nodes):
        net = env.latency[j] + t["data"] / env.bw[j]
        exec_t = t["length"] / env.mips[j]
        if j < env.n_fog:
            c = max(net, b[j]) + exec_t
        else:
            c = b[j] + t["data"] / env.bw[j] + env.latency[j] + exec_t
        if c < best_c:
            best_a, best_c = j, c
    return best_a


def random_policy(env):
    return int(env.rng.integers(env.n_actions))


def cloud_only(env):
    return env.n_fog


BASELINES = {
    "Weighted-score (dashboard)": weighted_score,
    "Priority-aware": priority_aware,
    "Load-balanced": load_balanced,
    "Energy-efficient": energy_efficient,
    "Min-completion-time (strong greedy)": min_completion_time,
    "Random": random_policy,
    "Cloud-only": cloud_only,
}
