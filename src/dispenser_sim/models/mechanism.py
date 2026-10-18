"""MechanismConfig model: parametric physical description of a candidate design.

Per data-model.md and contracts/config-schema.md: JSON loading rejects unknown
fields, enforces positive numerics (tolerances >= 0), and requires each
simplification to state a physical justification (FR-003/005).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

_REQUIRED_KEYS = {
    "name",
    "reservoir_capacity",
    "passage_clearance_mm",
    "metering_geometry",
    "actuation_energy_j",
    "stroke_time_s",
    "tolerances_mm",
    "overall_dimensions_mm",
    "mass_g",
    "simplifications",
}
_DIMENSION_KEYS = {"length", "width", "height"}

#: Minimum length (characters) for a simplification to count as stating a
#: physical justification rather than a bare label (FR-005).
_MIN_SIMPLIFICATION_LEN = 20


@dataclass(frozen=True)
class MechanismConfig:
    """A candidate dispensing mechanism design (FR-003)."""

    name: str
    reservoir_capacity: int  # pills
    passage_clearance_mm: float  # key singulation dimension
    metering_geometry: dict[str, float]  # stroke length, gate widths, angles
    actuation_energy_j: float
    stroke_time_s: float
    tolerances_mm: dict[str, float]  # parameter -> +/- mm, each >= 0
    overall_dimensions_mm: dict[str, float]  # keys: length, width, height
    mass_g: float
    simplifications: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.name or not self.name.strip():
            raise ValueError("name must be a non-empty string")
        if self.reservoir_capacity <= 0:
            raise ValueError(
                f"reservoir_capacity must be > 0, got {self.reservoir_capacity}"
            )
        if self.passage_clearance_mm <= 0:
            raise ValueError(
                f"passage_clearance_mm must be > 0, got {self.passage_clearance_mm}"
            )
        if not self.metering_geometry:
            raise ValueError("metering_geometry must not be empty")
        for key, value in self.metering_geometry.items():
            if value <= 0:
                raise ValueError(
                    f"metering_geometry.{key} must be > 0, got {value}"
                )
        if self.actuation_energy_j <= 0:
            raise ValueError(
                f"actuation_energy_j must be > 0, got {self.actuation_energy_j}"
            )
        if self.stroke_time_s <= 0:
            raise ValueError(f"stroke_time_s must be > 0, got {self.stroke_time_s}")
        for key, value in self.tolerances_mm.items():
            if value < 0:
                raise ValueError(
                    f"tolerances_mm.{key} must be >= 0, got {value}"
                )
        unknown_dims = set(self.overall_dimensions_mm) - _DIMENSION_KEYS
        if unknown_dims:
            raise ValueError(
                f"unknown overall_dimensions_mm keys: {sorted(unknown_dims)}"
            )
        missing_dims = _DIMENSION_KEYS - set(self.overall_dimensions_mm)
        if missing_dims:
            raise ValueError(
                f"missing overall_dimensions_mm keys: {sorted(missing_dims)}"
            )
        for key, value in self.overall_dimensions_mm.items():
            if value <= 0:
                raise ValueError(
                    f"overall_dimensions_mm.{key} must be > 0, got {value}"
                )
        if self.mass_g <= 0:
            raise ValueError(f"mass_g must be > 0, got {self.mass_g}")
        if not self.simplifications:
            raise ValueError(
                "simplifications is required and must not be empty (FR-005)"
            )
        for entry in self.simplifications:
            if not isinstance(entry, str) or len(entry.strip()) < _MIN_SIMPLIFICATION_LEN:
                raise ValueError(
                    "each simplification must state a physical justification "
                    f"(>= {_MIN_SIMPLIFICATION_LEN} chars), got: {entry!r}"
                )

    @classmethod
    def from_dict(cls, data: dict, *, source: str = "<dict>") -> "MechanismConfig":
        """Build from a dict, rejecting unknown fields (config-schema.md)."""
        if not isinstance(data, dict):
            raise ValueError(f"{source}: mechanism config must be a JSON object")
        unknown = set(data) - _REQUIRED_KEYS
        if unknown:
            raise ValueError(
                f"{source}: unknown mechanism config fields: {sorted(unknown)}"
            )
        missing = _REQUIRED_KEYS - set(data)
        if missing:
            raise ValueError(
                f"{source}: missing mechanism config fields: {sorted(missing)}"
            )
        for map_field in ("metering_geometry", "tolerances_mm", "overall_dimensions_mm"):
            if not isinstance(data[map_field], dict):
                raise ValueError(f"{source}: {map_field} must be an object")
        if not isinstance(data["simplifications"], list):
            raise ValueError(f"{source}: simplifications must be an array")
        return cls(
            name=str(data["name"]),
            reservoir_capacity=int(data["reservoir_capacity"]),
            passage_clearance_mm=float(data["passage_clearance_mm"]),
            metering_geometry={k: float(v) for k, v in data["metering_geometry"].items()},
            actuation_energy_j=float(data["actuation_energy_j"]),
            stroke_time_s=float(data["stroke_time_s"]),
            tolerances_mm={k: float(v) for k, v in data["tolerances_mm"].items()},
            overall_dimensions_mm={
                k: float(v) for k, v in data["overall_dimensions_mm"].items()
            },
            mass_g=float(data["mass_g"]),
            simplifications=[str(s) for s in data["simplifications"]],
        )

    @classmethod
    def from_json(cls, path: str | Path) -> "MechanismConfig":
        """Load and validate from a JSON file."""
        path = Path(path)
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"{path}: malformed JSON: {exc}") from exc
        return cls.from_dict(data, source=str(path))

    def to_dict(self) -> dict:
        """Serialize to the mechanism_config shape embedded in run records."""
        return {
            "name": self.name,
            "reservoir_capacity": self.reservoir_capacity,
            "passage_clearance_mm": self.passage_clearance_mm,
            "metering_geometry": dict(self.metering_geometry),
            "actuation_energy_j": self.actuation_energy_j,
            "stroke_time_s": self.stroke_time_s,
            "tolerances_mm": dict(self.tolerances_mm),
            "overall_dimensions_mm": dict(self.overall_dimensions_mm),
            "mass_g": self.mass_g,
            "simplifications": list(self.simplifications),
        }
