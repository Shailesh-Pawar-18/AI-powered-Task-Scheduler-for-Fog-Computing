"""All tunable constants in one place."""
from dataclasses import dataclass


@dataclass
class EnvConfig:
    # topology
    n_fog: int = 6                       # fog nodes (+ 1 cloud node = n_fog + 1 actions)
    fog_mips: tuple = (1000.0, 3500.0)   # processing speed of fog nodes (million instr / s)
    fog_latency: tuple = (0.005, 0.040)  # device -> fog one-way latency (s)
    fog_power: tuple = (5.0, 15.0)       # fog node power while executing (W)
    fog_bw: float = 100.0                # device -> fog bandwidth (MB/s)
    cloud_mips: float = 12000.0
    cloud_latency: float = 0.150         # WAN latency (s)
    cloud_bw: float = 10.0               # shared device -> cloud uplink bandwidth (MB/s)
    cloud_tx_energy: float = 2.5         # device-side transmission energy (J / MB)

    # workload
    tasks_per_episode: int = 200
    lam_range: tuple = (6.0, 12.0)       # Poisson arrival rate range (tasks / s)
    task_len: tuple = (200.0, 2000.0)    # task length (million instructions)
    task_data: tuple = (0.5, 4.0)        # task input size (MB)
    priority_probs: tuple = (0.40, 0.30, 0.20, 0.10)  # low, medium, high, critical
    deadlines: tuple = (6.0, 3.0, 1.5, 0.8)           # seconds, per priority class

    # normalisation of the observation
    backlog_scale: float = 5.0           # seconds of queue that map to 1.0


@dataclass
class TrainConfig:
    episodes: int = 600
    hidden: tuple = (128, 128)
    lr: float = 1e-3
    gamma: float = 0.9
    batch_size: int = 64
    buffer_size: int = 50_000
    warmup: int = 1_000
    target_sync: int = 250               # gradient steps between target-network copies
    update_every: int = 2                # env steps between gradient steps
    eps_start: float = 1.0
    eps_end: float = 0.05
    eps_decay_frac: float = 0.6          # fraction of episodes used to decay epsilon
    seed: int = 0
    train_seed_offset: int = 1000        # train episodes use seeds >= this (test uses < this)


OBJECTIVES = ("load", "distance", "priority")
