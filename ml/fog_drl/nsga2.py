"""NSGA-II selection operators (fast non-dominated sorting + crowding distance).

All objectives are MINIMISED.  F has shape (n_candidates, n_objectives).
"""
import numpy as np


def dominates(p, q):
    return bool(np.all(p <= q) and np.any(p < q))


def non_dominated_sort(F):
    """Returns a list of fronts; front 0 is the Pareto-optimal set."""
    n = len(F)
    dominated_by = [[] for _ in range(n)]      # S[p]: solutions that p dominates
    count = np.zeros(n, dtype=int)             # n[p]: how many dominate p
    fronts = [[]]
    for p in range(n):
        for q in range(n):
            if p == q:
                continue
            if dominates(F[p], F[q]):
                dominated_by[p].append(q)
            elif dominates(F[q], F[p]):
                count[p] += 1
        if count[p] == 0:
            fronts[0].append(p)
    k = 0
    while fronts[k]:
        nxt = []
        for p in fronts[k]:
            for q in dominated_by[p]:
                count[q] -= 1
                if count[q] == 0:
                    nxt.append(q)
        k += 1
        fronts.append(nxt)
    return fronts[:-1]


def crowding_distance(F, front):
    dist = np.zeros(len(front))
    if len(front) <= 2:
        return np.full(len(front), np.inf)
    sub = F[front]
    for m in range(F.shape[1]):
        order = np.argsort(sub[:, m])
        dist[order[0]] = dist[order[-1]] = np.inf
        span = sub[order[-1], m] - sub[order[0], m]
        if span <= 0:
            continue
        for j in range(1, len(front) - 1):
            dist[order[j]] += (sub[order[j + 1], m] - sub[order[j - 1], m]) / span
    return dist


def select(F):
    """Pick ONE candidate: best Pareto front, then the 'knee' (best average
    normalised objective); crowding distance breaks exact ties."""
    fronts = non_dominated_sort(F)
    front0 = fronts[0]
    if len(front0) == 1:
        return front0[0], fronts
    sub = F[front0]
    span = sub.max(axis=0) - sub.min(axis=0)
    span[span == 0] = 1.0
    knee_score = ((sub - sub.min(axis=0)) / span).mean(axis=1)
    crowd = crowding_distance(F, front0)
    best = min(range(len(front0)), key=lambda j: (knee_score[j], -min(crowd[j], 1e9)))
    return front0[best], fronts
