"""Pill population sampler: draw a reservoir of Pills from a PillDistribution.

Uses the seeded population sub-stream (FR-015/016): shape by category_weights,
size/mass/friction/orientation uniformly within configured ranges (FR-009).
"""

from __future__ import annotations

import random

from ..models.distribution import PillDistribution
from ..models.pill import Pill, ShapeCategory


def sample_population(
    distribution: PillDistribution, rng: random.Random
) -> list[Pill]:
    """Draw ``reservoir_size`` pills from ``distribution`` using ``rng``.

    Sampling is deterministic for a given seeded ``rng``. Every sampled pill
    lies within the configured ranges by construction.
    """
    shapes = sorted(
        distribution.category_weights, key=lambda s: s.value
    )  # deterministic iteration order
    weights = [distribution.category_weights[s] for s in shapes]
    pills: list[Pill] = []
    for _ in range(distribution.reservoir_size):
        shape = rng.choices(shapes, weights=weights, k=1)[0]
        spec = distribution.categories[shape]
        length = rng.uniform(*spec.length_mm)
        # For round tablets the profile is circular: width equals diameter.
        # For other shapes, width is drawn within the configured range but
        # capped by the sampled length to preserve the Pill invariant
        # width <= length.
        if shape is ShapeCategory.ROUND_TABLET:
            width = length
        else:
            width = rng.uniform(spec.width_mm[0], min(spec.width_mm[1], length))
        thickness = rng.uniform(*spec.thickness_mm)
        mass = rng.uniform(*spec.mass_g)
        friction = rng.uniform(*distribution.friction_coefficient)
        orientation = rng.uniform(
            distribution.orientation_deg.min, distribution.orientation_deg.max
        )
        pills.append(
            Pill(
                shape=shape,
                length=length,
                width=width,
                thickness=thickness,
                mass=mass,
                friction_coefficient=friction,
                orientation=orientation,
            )
        )
    return pills
