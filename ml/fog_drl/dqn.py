"""Minimal Deep Q-Network in pure NumPy (MLP + Adam + replay buffer + target net).

Written from scratch so the whole learning loop is visible and explainable in a viva:
    Q(s, a) is approximated by an MLP  ->  y = r + gamma * Q_target(s', argmax_a' Q_online(s', a'))
    (Double-DQN target)  ->  Huber loss on the taken action only  ->  Adam step.
"""
import numpy as np


class MLP:
    def __init__(self, sizes, rng, lr=1e-3):
        self.W = [rng.normal(0.0, np.sqrt(2.0 / sizes[i]), (sizes[i], sizes[i + 1]))
                  for i in range(len(sizes) - 1)]
        self.b = [np.zeros(sizes[i + 1]) for i in range(len(sizes) - 1)]
        self.lr, self.t = lr, 0
        self.mW = [np.zeros_like(w) for w in self.W]; self.vW = [np.zeros_like(w) for w in self.W]
        self.mb = [np.zeros_like(b) for b in self.b]; self.vb = [np.zeros_like(b) for b in self.b]

    def forward(self, x):
        acts = [x]
        a = x
        last = len(self.W) - 1
        for k, (W, b) in enumerate(zip(self.W, self.b)):
            z = a @ W + b
            a = z if k == last else np.maximum(z, 0.0)   # ReLU on hidden layers
            acts.append(a)
        return a, acts

    def backward(self, acts, dout):
        gW, gb = [None] * len(self.W), [None] * len(self.W)
        d = dout
        for k in reversed(range(len(self.W))):
            gW[k] = acts[k].T @ d
            gb[k] = d.sum(axis=0)
            if k > 0:
                d = (d @ self.W[k].T) * (acts[k] > 0)
        return gW, gb

    def adam_step(self, gW, gb, clip=10.0, b1=0.9, b2=0.999, eps=1e-8):
        norm = np.sqrt(sum((g ** 2).sum() for g in gW + gb))
        scale = min(1.0, clip / (norm + 1e-12))
        self.t += 1
        for k in range(len(self.W)):
            for p, g, m, v in ((self.W, gW, self.mW, self.vW), (self.b, gb, self.mb, self.vb)):
                gk = g[k] * scale
                m[k] = b1 * m[k] + (1 - b1) * gk
                v[k] = b2 * v[k] + (1 - b2) * gk * gk
                mhat = m[k] / (1 - b1 ** self.t)
                vhat = v[k] / (1 - b2 ** self.t)
                p[k] -= self.lr * mhat / (np.sqrt(vhat) + eps)

    def copy_from(self, other):
        self.W = [w.copy() for w in other.W]
        self.b = [b.copy() for b in other.b]


class DQNAgent:
    def __init__(self, state_dim, n_actions, name, hidden=(64, 64), lr=1e-3, gamma=0.9, seed=0):
        rng = np.random.default_rng(seed)
        sizes = [state_dim, *hidden, n_actions]
        self.name, self.gamma, self.n_actions = name, gamma, n_actions
        self.online = MLP(sizes, rng, lr)
        self.target = MLP(sizes, rng, lr)
        self.target.copy_from(self.online)

    def q(self, state):
        return self.online.forward(state[None, :])[0][0]

    def update(self, s, a, r, s2, done):
        B = len(s)
        idx = np.arange(B)
        a2 = self.online.forward(s2)[0].argmax(axis=1)               # Double DQN
        q2 = self.target.forward(s2)[0][idx, a2]
        y = r + self.gamma * (1.0 - done) * q2
        out, acts = self.online.forward(s)
        td = out[idx, a] - y
        dout = np.zeros_like(out)
        dout[idx, a] = np.clip(td, -1.0, 1.0) / B                    # Huber gradient
        gW, gb = self.online.backward(acts, dout)
        self.online.adam_step(gW, gb)
        return float(np.mean(np.where(np.abs(td) <= 1, 0.5 * td ** 2, np.abs(td) - 0.5)))

    def sync_target(self):
        self.target.copy_from(self.online)

    def save(self, path):
        np.savez(path, **{f"W{k}": w for k, w in enumerate(self.online.W)},
                 **{f"b{k}": b for k, b in enumerate(self.online.b)})

    def load(self, path):
        d = np.load(path)
        self.online.W = [d[f"W{k}"] for k in range(len(self.online.W))]
        self.online.b = [d[f"b{k}"] for k in range(len(self.online.b))]
        self.sync_target()


class ReplayBuffer:
    """One shared buffer; every transition stores the reward of ALL objectives."""

    def __init__(self, capacity, state_dim, n_obj, rng):
        self.cap, self.rng, self.n, self.pos = capacity, rng, 0, 0
        self.s = np.zeros((capacity, state_dim)); self.s2 = np.zeros((capacity, state_dim))
        self.a = np.zeros(capacity, dtype=int); self.r = np.zeros((capacity, n_obj))
        self.d = np.zeros(capacity)

    def add(self, s, a, r, s2, d):
        i = self.pos
        self.s[i], self.a[i], self.r[i], self.s2[i], self.d[i] = s, a, r, s2, d
        self.pos = (self.pos + 1) % self.cap
        self.n = min(self.n + 1, self.cap)

    def sample(self, batch):
        idx = self.rng.integers(0, self.n, batch)
        return self.s[idx], self.a[idx], self.r[idx], self.s2[idx], self.d[idx]
