"""PortabilityEnvelope model: documented limits for a portable device.

Values live in a version-controlled config file
(``configs/portability_envelope.json``), not in code (Constitution V).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

_REQUIRED_KEYS = {"max_dimensions_mm", "max_mass_g", "max_actuation_energy_j"}
_DIMENSION_KEYS = {"length", "width", "height"}


@dataclass(frozen=True)
class PortabilityEnvelope:
    """Limits for a portable, battery-operated device (mm, g, J)."""

    max_dimensions_mm: dict[str, float]  # keys: length, width, height
    max_mass_g: float
    max_actuation_energy_j: float

    def __post_init__(self) -> None:
        unknown_dims = set(self.max_dimensions_mm) - _DIMENSION_KEYS
        if unknown_dims:
            raise ValueError(
                f"unknown max_dimensions_mm keys: {sorted(unknown_dims)}"
            )
        missing = _DIMENSION_KEYS - set(self.max_dimensions_mm)
        if missing:
            raise ValueError(f"missing max_dimensions_mm keys: {sorted(missing)}")
        for key, value in self.max_dimensions_mm.items():
            if value <= 0:
                raise ValueError(f"max_dimensions_mm.{key} must be > 0, got {value}")
        if self.max_mass_g <= 0:
            raise ValueError(f"max_mass_g must be > 0, got {self.max_mass_g}")
        if self.max_actuation_energy_j <= 0:
            raise ValueError(
                f"max_actuation_energy_j must be > 0, got {self.max_actuation_energy_j}"
            )

    @classmethod
    def from_dict(cls, data: dict, *, source: str = "<dict>") -> "PortabilityEnvelope":
        """Build from a dict, rejecting unknown fields (config-schema.md)."""
        if not isinstance(data, dict):
            raise ValueError(f"{source}: envelope must be a JSON object")
        unknown = set(data) - _REQUIRED_KEYS
        if unknown:
            raise ValueError(
                f"{source}: unknown envelope fields: {sorted(unknown)}"
            )
        missing = _REQUIRED_KEYS - set(data)
        if missing:
            raise ValueError(f"{source}: missing envelope fields: {sorted(missing)}")
        dims = data["max_dimensions_mm"]
        if not isinstance(dims, dict):
            raise ValueError(f"{source}: max_dimensions_mm must be an object")
        return cls(
            max_dimensions_mm={k: float(v) for k, v in dims.items()},
            max_mass_g=float(data["max_mass_g"]),
            max_actuation_energy_j=float(data["max_actuation_energy_j"]),
        )

    @classmethod
    def from_json(cls, path: str | Path) -> "PortabilityEnvelope":
        """Load and validate from a JSON file."""
        path = Path(path)
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"{path}: malformed JSON: {exc}") from exc
        return cls.from_dict(data, source=str(path))

    def to_dict(self) -> dict:
        """Serialize to the envelope shape embedded in run records."""
        return {
            "max_dimensions_mm": dict(self.max_dimensions_mm),
            "max_mass_g": self.max_mass_g,
            "max_actuation_energy_j": self.max_actuation_energy_j,
        }
