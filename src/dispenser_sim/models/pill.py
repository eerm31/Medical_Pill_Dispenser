"""Pill model: shape category, physical dimensions, 2D profile derivation.

All physical quantities carry explicit units (mm, g, degrees) per Constitution II.
A pill's singulation-relevant geometry is its 2D profile (circle for round
tablets, stadium for oblong caplets and capsules) and its maximum transverse
width at a given orientation (research.md R2).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import Enum


class ShapeCategory(str, Enum):
    """Supported pill shape categories (FR-006)."""

    ROUND_TABLET = "round_tablet"
    OBLONG_CAPLET = "oblong_caplet"
    CAPSULE = "capsule"


#: Maximum documented Coulomb friction coefficient (sticky/uncoated, research.md R2).
MAX_FRICTION_COEFFICIENT = 1.0


@dataclass(frozen=True)
class Pill:
    """A single medication unit sampled from a PillDistribution.

    Fields per data-model.md. ``length`` equals diameter for round tablets.
    ``orientation`` is the angle of the pill's long axis at the singulation
    point in degrees, within [0, 180].
    """

    shape: ShapeCategory
    length: float  # mm; diameter for round tablets
    width: float  # mm; <= length
    thickness: float  # mm
    mass: float  # g
    friction_coefficient: float  # Coulomb mu
    orientation: float  # degrees, long axis at singulation, 0-180

    def __post_init__(self) -> None:
        if isinstance(self.shape, str):
            object.__setattr__(self, "shape", ShapeCategory(self.shape))
        if self.length <= 0:
            raise ValueError(f"length must be > 0, got {self.length}")
        if self.width <= 0:
            raise ValueError(f"width must be > 0, got {self.width}")
        if self.width > self.length + 1e-9:
            raise ValueError(
                f"width ({self.width}) must be <= length ({self.length})"
            )
        if self.thickness <= 0:
            raise ValueError(f"thickness must be > 0, got {self.thickness}")
        if self.mass <= 0:
            raise ValueError(f"mass must be > 0, got {self.mass}")
        if not 0 < self.friction_coefficient <= MAX_FRICTION_COEFFICIENT:
            raise ValueError(
                f"friction_coefficient must be in (0, {MAX_FRICTION_COEFFICIENT}], "
                f"got {self.friction_coefficient}"
            )
        if not 0.0 <= self.orientation <= 180.0:
            raise ValueError(
                f"orientation must be within [0, 180] degrees, got {self.orientation}"
            )

    @property
    def is_circular_profile(self) -> bool:
        """Round tablets have a circular 2D profile; caplets/capsules are stadiums."""
        return self.shape is ShapeCategory.ROUND_TABLET

    def transverse_width(self, orientation: float | None = None) -> float:
        """Maximum transverse width (mm) of the 2D profile at ``orientation``.

        This is the singulation-relevant dimension: the width presented
        perpendicular to the direction of travel through the passage.

        - Round tablet (circle): constant, equal to diameter (``length``).
        - Stadium (caplet/capsule): the width of the stadium projected onto the
          axis perpendicular to travel. With the long axis at angle ``theta``
          to the direction of travel, the transverse extent is
          ``width + (length - width) * |sin(theta)|``; the maximum over the
          profile is that value.
        """
        theta = self.orientation if orientation is None else orientation
        if self.is_circular_profile:
            return self.length
        # Stadium profile: two semicircles of radius width/2 joined by a
        # rectangle of length (length - width).
        return self.width + (self.length - self.width) * abs(
            math.sin(math.radians(theta))
        )

    def to_dict(self) -> dict:
        """Serialize to the pill_state snapshot shape used in run records."""
        return {
            "shape": self.shape.value,
            "length_mm": round(self.length, 4),
            "width_mm": round(self.width, 4),
            "thickness_mm": round(self.thickness, 4),
            "mass_g": round(self.mass, 4),
            "friction_coefficient": round(self.friction_coefficient, 4),
            "orientation_deg": round(self.orientation, 2),
        }
