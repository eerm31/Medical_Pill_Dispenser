"""Envelope validation: check a MechanismConfig against a PortabilityEnvelope.

Returns the list of violated constraints with their limits per FR-004 and the
cli-contract ``validate`` behavior.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..models.envelope import PortabilityEnvelope
from ..models.mechanism import MechanismConfig


@dataclass(frozen=True)
class EnvelopeViolation:
    """One violated portability constraint with its limit (FR-004)."""

    constraint: str  # e.g. "dimensions.length", "mass", "actuation_energy"
    actual: float
    limit: float
    units: str

    def __str__(self) -> str:
        return (
            f"{self.constraint}: {self.actual} {self.units} exceeds "
            f"limit {self.limit} {self.units}"
        )


def validate_envelope(
    config: MechanismConfig, envelope: PortabilityEnvelope
) -> list[EnvelopeViolation]:
    """Check ``config`` against ``envelope``; return all violated constraints.

    An empty list means the config is VALID. Checks overall dimensions
    (length/width/height), mass, and actuation energy (FR-004).
    """
    violations: list[EnvelopeViolation] = []
    for dim in ("length", "width", "height"):
        actual = config.overall_dimensions_mm[dim]
        limit = envelope.max_dimensions_mm[dim]
        if actual > limit:
            violations.append(
                EnvelopeViolation(
                    constraint=f"dimensions.{dim}",
                    actual=actual,
                    limit=limit,
                    units="mm",
                )
            )
    if config.mass_g > envelope.max_mass_g:
        violations.append(
            EnvelopeViolation(
                constraint="mass",
                actual=config.mass_g,
                limit=envelope.max_mass_g,
                units="g",
            )
        )
    if config.actuation_energy_j > envelope.max_actuation_energy_j:
        violations.append(
            EnvelopeViolation(
                constraint="actuation_energy",
                actual=config.actuation_energy_j,
                limit=envelope.max_actuation_energy_j,
                units="J",
            )
        )
    return violations
