"""Fog-cloud task scheduling simulator (gym-style: reset / step).

Each step = one arriving IoT task that must be placed on one of the fog nodes
(actions 0..n_fog-1) or on the cloud (action n_fog).

Fog node  : single FIFO queue, so it can build up a backlog and tasks must wait.
Cloud     : unlimited compute, but far away (WAN latency) and reached through ONE shared
            uplink (FIFO, limited bandwidth) -> offloading too much saturates the link.

Every step returns THREE rewards, one per objective of the paper:
    load      - short queue wait and balanced fog backlog
    distance  - low network delay to the chosen node
    priority  - finish before the deadline, weighted by task priority
"""
import numpy as np

from .config import EnvConfig

PRIORITY_NAMES = ("low", "medium", "high", "critical")
PRIORITY_WEIGHTS = np.array([0.25, 0.5, 0.75, 1.0])


class FogEnv:
    def __init__(self, cfg: EnvConfig | None = None):
        self.cfg = cfg or EnvConfig()
        self.n_fog = self.cfg.n_fog
        self.n_nodes = self.n_fog + 1            # last node = cloud
        self.n_actions = self.n_nodes
        self.state_dim = 7 * self.n_nodes + 4    # 7 features / node + 4 task features

    # ------------------------------------------------------------------ reset
    def reset(self, seed=None, lam=None):
        c = self.cfg
        rng = np.random.default_rng(seed)
        self.rng = rng
        n = self.n_fog

        # topology is re-sampled every episode so agents must read the state
        self.mips = np.append(rng.uniform(*c.fog_mips, n), c.cloud_mips)
        self.latency = np.append(rng.uniform(*c.fog_latency, n), c.cloud_latency)
        self.power = np.append(rng.uniform(*c.fog_power, n), 0.0)
        self.bw = np.append(np.full(n, c.fog_bw), c.cloud_bw)
        self.lam = float(lam) if lam is not None else float(rng.uniform(*c.lam_range))

        # workload
        T = c.tasks_per_episode
        self.arrivals = np.cumsum(rng.exponential(1.0 / self.lam, T))
        self.length = rng.uniform(*c.task_len, T)
        self.data = rng.uniform(*c.task_data, T)
        self.prio = rng.choice(4, T, p=c.priority_probs)
        self.deadline = np.asarray(c.deadlines)[self.prio]

        self.busy_until = np.zeros(self.n_nodes)       # fog queues (cloud unused)
        self.node_exec_time = np.zeros(self.n_nodes)   # total busy time per node
        self.i = 0
        self.log = {k: [] for k in
                    ("completion", "wait", "energy", "cloud", "miss", "prio", "finish")}
        return self._obs()

    # ------------------------------------------------------------ observation
    def backlog(self):
        """Seconds of queued work in front of a task arriving now, per node (cloud: uplink queue)."""
        return np.maximum(0.0, self.busy_until - self.arrivals[self.i])   # cloud entry = uplink queue

    def task(self):
        i = self.i
        return dict(length=self.length[i], data=self.data[i],
                    prio=int(self.prio[i]), deadline=self.deadline[i])

    def _obs(self):
        c, i = self.cfg, self.i
        b = np.clip(self.backlog() / c.backlog_scale, 0.0, 1.0)
        speed = np.clip(self.mips / c.fog_mips[1], 0.0, 2.0) / 2.0
        lat = np.clip(self.latency / 0.2, 0.0, 1.0)
        pw = self.power / c.fog_power[1]
        is_cloud = np.zeros(self.n_nodes)
        is_cloud[-1] = 1.0
        # estimated service / network time of THIS task on every node (computable by a real scheduler)
        est_exec = np.clip(self.length[i] / self.mips / 2.0, 0.0, 1.0)
        est_net = np.clip((self.latency + self.data[i] / self.bw) / 0.6, 0.0, 1.0)
        node_feats = np.stack([b, speed, lat, pw, is_cloud, est_exec, est_net], axis=1).ravel()
        task_feats = np.array([
            self.length[i] / c.task_len[1],
            self.prio[i] / 3.0,
            self.deadline[i] / c.deadlines[0],
            self.data[i] / c.task_data[1],
        ])
        return np.concatenate([node_feats, task_feats]).astype(np.float64)

    # ------------------------------------------------------------------- step
    def step(self, a: int):
        c, i = self.cfg, self.i
        t = self.arrivals[i]
        L, D = self.length[i], self.data[i]
        p, dl = int(self.prio[i]), self.deadline[i]

        net = self.latency[a] + D / self.bw[a]
        exec_t = L / self.mips[a]
        is_fog = a < self.n_fog
        if is_fog:
            arrive = t + net
            start = max(arrive, self.busy_until[a])
            wait = start - arrive
            finish = start + exec_t
            self.busy_until[a] = finish
            self.node_exec_time[a] += exec_t
            energy = self.power[a] * exec_t
        else:
            tx = D / self.bw[a]                          # time on the shared uplink
            tx_start = max(t, self.busy_until[a])
            wait = tx_start - t                          # queueing for the uplink
            self.busy_until[a] = tx_start + tx
            finish = tx_start + tx + self.latency[a] + exec_t
            energy = c.cloud_tx_energy * D
        completion = finish - t
        miss = completion > dl

        # --- three objective rewards (all <= 0) ---
        b_after = np.maximum(0.0, self.busy_until[: self.n_fog] - t)
        r_load = -min(wait / 2.0, 1.0) - 0.5 * min(np.std(b_after) / 2.0, 1.0)
        r_dist = -min(net / 0.4, 1.0)
        w = PRIORITY_WEIGHTS[p]
        r_prio = -w * (min(completion / dl, 2.0) / 2.0 + 0.5 * float(miss))
        rewards = np.array([r_load, r_dist, r_prio])

        lg = self.log
        lg["completion"].append(completion); lg["wait"].append(wait)
        lg["energy"].append(energy); lg["cloud"].append(0 if is_fog else 1)
        lg["miss"].append(int(miss)); lg["prio"].append(p); lg["finish"].append(finish)

        self.i += 1
        done = self.i >= len(self.arrivals)
        obs = np.zeros(self.state_dim) if done else self._obs()
        return obs, rewards, done, {"completion": completion, "miss": miss}

    # ---------------------------------------------------------------- metrics
    def metrics(self):
        lg = {k: np.asarray(v) for k, v in self.log.items()}
        high = lg["prio"] >= 2
        fog_busy = self.node_exec_time[: self.n_fog]
        cv = float(fog_busy.std() / fog_busy.mean()) if fog_busy.mean() > 0 else 0.0
        return {
            "avg_completion_s": float(lg["completion"].mean()),
            "p95_completion_s": float(np.percentile(lg["completion"], 95)),
            "avg_wait_s": float(lg["wait"].mean()),
            "makespan_s": float(lg["finish"].max() - self.arrivals[0]),
            "total_energy_J": float(lg["energy"].sum()),
            "cloud_offload_%": float(100 * lg["cloud"].mean()),
            "deadline_miss_%": float(100 * lg["miss"].mean()),
            "miss_high_prio_%": float(100 * lg["miss"][high].mean()) if high.any() else 0.0,
            "load_imbalance_cv": cv,
        }
