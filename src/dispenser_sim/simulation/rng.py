"""Seeded RNG management (research.md R3, FR-015/016/017).

One ``random.Random`` per run; deterministic sub-streams for population
sampling vs per-cycle process noise are derived from the run seed via
namespacing, so population changes stay explicit in the config record.
The global ``random`` module state is never touched.
"""

from __future__ import annotations

import hashlib
import random


def generate_seed() -> int:
    """Generate a random seed for runs where the user supplied none (FR-015).

    Uses ``random.Random()`` seeded from OS entropy internally, so the global
    module state is never affected.
    """
    return random.Random().randrange(0, 2**63)


def _derive_seed(run_seed: int, namespace: str) -> int:
    """Derive a deterministic sub-seed from the run seed and a namespace."""
    digest = hashlib.sha256(f"{run_seed}:{namespace}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big")


class RunRng:
    """Seeded RNG holder with deterministic sub-streams per run.

    Sub-streams:
    - ``population``: pill population sampling (shape, size, mass, friction,
      orientation draws when building the reservoir).
    - ``cycles``: per-cycle process noise (tolerance jitter, presentation
      order, singulation noise).

    Splitting the streams means adding cycles to a run does not change the
    sampled population and vice versa (research.md R3).
    """

    def __init__(self, run_seed: int) -> None:
        self.run_seed = int(run_seed)
        self.population = random.Random(_derive_seed(self.run_seed, "population"))
        self.cycles = random.Random(_derive_seed(self.run_seed, "cycles"))
