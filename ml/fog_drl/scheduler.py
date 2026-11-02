"""MODRL scheduler: three DQN agents (load / distance / priority) + NSGA-II selection."""
import os
import numpy as np

from .config import OBJECTIVES, TrainConfig
from .dqn import DQNAgent
from .nsga2 import select


class MODRLScheduler:
    def __init__(self, agents, top_k=3):
        self.agents, self.top_k = agents, top_k
        self.last_front_size = 0

    def q_values(self, state):
        return np.stack([ag.q(state) for ag in self.agents])          # (3, n_actions)

    def act(self, state):
        Q = self.q_values(state)
        # each agent nominates its top-k nodes -> candidate pool
        cand = sorted({int(a) for q in Q for a in np.argsort(-q)[: self.top_k]})
        # per-agent min-max normalisation (over ALL actions) so objectives are comparable
        lo, hi = Q.min(axis=1, keepdims=True), Q.max(axis=1, keepdims=True)
        Qn = (Q - lo) / np.where(hi - lo == 0, 1.0, hi - lo)
        F = 1.0 - Qn[:, cand].T                                       # minimise (1 - Q)
        idx, fronts = select(F)
        self.last_front_size = len(fronts[0])
        return cand[idx]

    @classmethod
    def load(cls, model_dir, state_dim, n_actions, cfg: TrainConfig | None = None, top_k=3):
        cfg = cfg or TrainConfig()
        agents = []
        for name in OBJECTIVES:
            ag = DQNAgent(state_dim, n_actions, name, cfg.hidden, cfg.lr, cfg.gamma)
            ag.load(os.path.join(model_dir, f"agent_{name}.npz"))
            agents.append(ag)
        return cls(agents, top_k)
