"""PillDistribution model: configurable statistical pill population description.

Per data-model.md and contracts/config-schema.md: category weights sum to
1.0 (±1e-9), only the three supported shape keys, every range is [min, max]
with 0 < min <= max; ranges outside the documented realistic envelope
(research.md R2) are accepted but flagged (FR-006-009).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from .pill import ShapeCategory

_REQUIRED_KEYS = {
    "reservoir_size",
    "category_weights",
    "categories",
    "friction_coefficient",
    "orientation_deg",
}
_CATEGORY_RANGE_KEYS = {"length_mm", "width_mm", "thickness_mm", "mass_g"}
_WEIGHT_TOLERANCE = 1e-9

#: Documented realistic ranges from research.md R2. Values outside these are
#: accepted but flagged so worst-case-loaded populations remain possible (FR-009).
REALISTIC_RANGES: dict[str, dict[str, tuple[float, float]]] = {
    "round_tablet": {
        "length_mm": (3.0, 13.0),
        "width_mm": (3.0, 13.0),
        "thickness_mm": (2.0, 6.0),
        "mass_g": (0.05, 0.8),
    },
    "oblong_caplet": {
        "length_mm": (6.0, 19.0),
        "width_mm": (3.0, 8.0),
        "thickness_mm": (2.5, 7.0),
        "mass_g": (0.15, 1.2),
    },
    "capsule": {
        "length_mm": (11.0, 26.0),
        "width_mm": (3.0, 10.0),
        "thickness_mm": (3.0, 10.0),
        "mass_g": (0.05, 1.5),
    },
}
REALISTIC_FRICTION = (0.2, 0.6)


def _validate_range(value: object, *, field_path: str) -> tuple[float, float]:
    """Validate a [min, max] pair with 0 < min <= max (FR-009)."""
    if not isinstance(value, (list, tuple)) or len(value) != 2:
        raise ValueError(f"{field_path} must be a [min, max] pair")
    lo, hi = float(value[0]), float(value[1])
    if lo <= 0:
        raise ValueError(f"{field_path} min must be > 0, got {lo}")
    if lo > hi:
        raise ValueError(f"{field_path} min ({lo}) must be <= max ({hi})")
    return lo, hi


@dataclass(frozen=True)
class CategorySpec:
    """Size/mass ranges for one shape category."""

    length_mm: tuple[float, float]
    width_mm: tuple[float, float]
    thickness_mm: tuple[float, float]
    mass_g: tuple[float, float]

    def to_dict(self) -> dict:
        return {
            "length_mm": list(self.length_mm),
            "width_mm": list(self.width_mm),
            "thickness_mm": list(self.thickness_mm),
            "mass_g": list(self.mass_g),
        }


@dataclass(frozen=True)
class OrientationDistribution:
    """Orientation sampling parameters; mode is 'uniform' for v1."""

    mode: str = "uniform"
    min: float = 0.0
    max: float = 180.0

    def __post_init__(self) -> None:
        if self.mode != "uniform":
            raise ValueError(
                f"orientation_deg mode must be 'uniform', got {self.mode!r}"
            )
        if not 0.0 <= self.min <= self.max <= 180.0:
            raise ValueError(
                f"orientation_deg range must satisfy 0 <= min <= max <= 180, "
                f"got [{self.min}, {self.max}]"
            )

    def to_dict(self) -> dict:
        return {"mode": self.mode, "min": self.min, "max": self.max}


@dataclass(frozen=True)
class PillDistribution:
    """Statistical description of a pill population (FR-009)."""

    reservoir_size: int
    category_weights: dict[ShapeCategory, float]
    categories: dict[ShapeCategory, CategorySpec]
    friction_coefficient: tuple[float, float]
    orientation_deg: OrientationDistribution
    flags: list[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict, *, source: str = "<dict>") -> "PillDistribution":
        """Build and validate from a dict, rejecting unknown fields."""
        if not isinstance(data, dict):
            raise ValueError(f"{source}: pill distribution must be a JSON object")
        unknown = set(data) - _REQUIRED_KEYS
        if unknown:
            raise ValueError(
                f"{source}: unknown pill distribution fields: {sorted(unknown)}"
            )
        missing = _REQUIRED_KEYS - set(data)
        if missing:
            raise ValueError(
                f"{source}: missing pill distribution fields: {sorted(missing)}"
            )

        reservoir_size = int(data["reservoir_size"])
        if reservoir_size < 0:
            raise ValueError(
                f"{source}: reservoir_size must be >= 0, got {reservoir_size}"
            )

        supported = {s.value for s in ShapeCategory}
        flags: list[str] = []

        raw_weights = data["category_weights"]
        if not isinstance(raw_weights, dict):
            raise ValueError(f"{source}: category_weights must be an object")
        bad_keys = set(raw_weights) - supported
        if bad_keys:
            raise ValueError(
                f"{source}: unsupported shape keys in category_weights: "
                f"{sorted(bad_keys)}"
            )
        weights = {ShapeCategory(k): float(v) for k, v in raw_weights.items()}
        for shape, w in weights.items():
            if w < 0:
                raise ValueError(
                    f"{source}: category_weights.{shape.value} must be >= 0, got {w}"
                )
        total = sum(weights.values())
        if abs(total - 1.0) > _WEIGHT_TOLERANCE:
            raise ValueError(
                f"{source}: category_weights must sum to 1.0 (±{_WEIGHT_TOLERANCE}), "
                f"got {total}"
            )

        raw_categories = data["categories"]
        if not isinstance(raw_categories, dict):
            raise ValueError(f"{source}: categories must be an object")
        bad_cat_keys = set(raw_categories) - supported
        if bad_cat_keys:
            raise ValueError(
                f"{source}: unsupported shape keys in categories: "
                f"{sorted(bad_cat_keys)}"
            )
        categories: dict[ShapeCategory, CategorySpec] = {}
        for key, spec in raw_categories.items():
            shape = ShapeCategory(key)
            if not isinstance(spec, dict):
                raise ValueError(f"{source}: categories.{key} must be an object")
            unknown_spec = set(spec) - _CATEGORY_RANGE_KEYS
            if unknown_spec:
                raise ValueError(
                    f"{source}: unknown fields in categories.{key}: "
                    f"{sorted(unknown_spec)}"
                )
            missing_spec = _CATEGORY_RANGE_KEYS - set(spec)
            if missing_spec:
                raise ValueError(
                    f"{source}: missing fields in categories.{key}: "
                    f"{sorted(missing_spec)}"
                )
            ranges = {
                rng_key: _validate_range(
                    spec[rng_key], field_path=f"{source}: categories.{key}.{rng_key}"
                )
                for rng_key in _CATEGORY_RANGE_KEYS
            }
            # Width must not exceed length at either extreme (Pill invariant).
            if ranges["width_mm"][1] > ranges["length_mm"][1]:
                raise ValueError(
                    f"{source}: categories.{key}.width_mm max "
                    f"({ranges['width_mm'][1]}) exceeds length_mm max "
                    f"({ranges['length_mm'][1]})"
                )
            realistic = REALISTIC_RANGES[key]
            for rng_key, (lo, hi) in ranges.items():
                r_lo, r_hi = realistic[rng_key]
                if lo < r_lo or hi > r_hi:
                    flags.append(
                        f"categories.{key}.{rng_key} [{lo}, {hi}] outside "
                        f"documented realistic range [{r_lo}, {r_hi}] (research.md R2)"
                    )
            categories[shape] = CategorySpec(
                length_mm=ranges["length_mm"],
                width_mm=ranges["width_mm"],
                thickness_mm=ranges["thickness_mm"],
                mass_g=ranges["mass_g"],
            )

        friction = _validate_range(
            data["friction_coefficient"],
            field_path=f"{source}: friction_coefficient",
        )
        f_lo, f_hi = REALISTIC_FRICTION
        if friction[0] < f_lo or friction[1] > f_hi:
            flags.append(
                f"friction_coefficient [{friction[0]}, {friction[1]}] outside "
                f"documented realistic range [{f_lo}, {f_hi}] (research.md R2)"
            )

        raw_orientation = data["orientation_deg"]
        if not isinstance(raw_orientation, dict):
            raise ValueError(f"{source}: orientation_deg must be an object")
        unknown_orient = set(raw_orientation) - {"mode", "min", "max"}
        if unknown_orient:
            raise ValueError(
                f"{source}: unknown orientation_deg fields: {sorted(unknown_orient)}"
            )
        orientation = OrientationDistribution(
            mode=str(raw_orientation.get("mode", "uniform")),
            min=float(raw_orientation.get("min", 0.0)),
            max=float(raw_orientation.get("max", 180.0)),
        )

        return cls(
            reservoir_size=reservoir_size,
            category_weights=weights,
            categories=categories,
            friction_coefficient=friction,
            orientation_deg=orientation,
            flags=flags,
        )

    @classmethod
    def from_json(cls, path: str | Path) -> "PillDistribution":
        """Load and validate from a JSON file."""
        path = Path(path)
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"{path}: malformed JSON: {exc}") from exc
        return cls.from_dict(data, source=str(path))

    def to_dict(self) -> dict:
        """Serialize to the pill_distribution shape embedded in run records.

        Includes ``flags`` so out-of-realistic-range values stay visible in
        the persisted configuration record (FR-009).
        """
        return {
            "reservoir_size": self.reservoir_size,
            "category_weights": {
                shape.value: self.category_weights[shape]
                for shape in sorted(self.category_weights, key=lambda s: s.value)
            },
            "categories": {
                shape.value: self.categories[shape].to_dict()
                for shape in sorted(self.categories, key=lambda s: s.value)
            },
            "friction_coefficient": list(self.friction_coefficient),
            "orientation_deg": self.orientation_deg.to_dict(),
            "flags": list(self.flags),
        }
