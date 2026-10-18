"""DispenseEvent and outcome enums (FR-002, FR-012).

Every actuation cycle resolves to exactly one classified outcome. The event
record is the per-cycle evidence unit persisted in run.json / cycles.csv
(contracts/run-record-schema.md).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Outcome(str, Enum):
    """The single classified outcome of an actuation cycle (FR-002)."""

    SINGLE = "SINGLE"  # exactly one pill dispensed
    ZERO_DOSE = "ZERO_DOSE"  # zero pills dispensed while pills were available
    MULTI_DOSE = "MULTI_DOSE"  # two or more pills dispensed
    NO_PILL_AVAILABLE = "NO_PILL_AVAILABLE"  # empty reservoir (FR-012)


@dataclass(frozen=True)
class DispenseEvent:
    """Recorded outcome of one ActuationCycle.

    ``failure_mode`` is nullable in Phase 3 (US1); failure-mode classifiers
    arrive with US2 (FR-013/014). NO_PILL_AVAILABLE never carries a failure
    mode and is excluded from violation counts (FR-012). ``pill_state`` is a
    snapshot dict of the involved pill (see Pill.to_dict) or None when no
    pill was involved.
    """

    cycle_index: int
    pills_dispensed: int
    outcome: Outcome
    failure_mode: str | None = None
    jam_persistent: bool = False
    pill_state: dict | None = None

    def __post_init__(self) -> None:
        if isinstance(self.outcome, str):
            object.__setattr__(self, "outcome", Outcome(self.outcome))
        if self.cycle_index < 0:
            raise ValueError(f"cycle_index must be >= 0, got {self.cycle_index}")
        if self.pills_dispensed < 0:
            raise ValueError(
                f"pills_dispensed must be >= 0, got {self.pills_dispensed}"
            )
        expected = {
            Outcome.SINGLE: self.pills_dispensed == 1,
            Outcome.ZERO_DOSE: self.pills_dispensed == 0,
            Outcome.MULTI_DOSE: self.pills_dispensed >= 2,
            Outcome.NO_PILL_AVAILABLE: self.pills_dispensed == 0,
        }[self.outcome]
        if not expected:
            raise ValueError(
                f"outcome {self.outcome.value} inconsistent with "
                f"pills_dispensed={self.pills_dispensed}"
            )
        if (
            self.outcome is Outcome.NO_PILL_AVAILABLE
            and self.failure_mode is not None
        ):
            raise ValueError(
                "NO_PILL_AVAILABLE must not carry a failure mode (FR-012)"
            )

    def to_dict(self) -> dict:
        """Serialize to the per-event shape of contracts/run-record-schema.md."""
        return {
            "cycle_index": self.cycle_index,
            "pills_dispensed": self.pills_dispensed,
            "outcome": self.outcome.value,
            "failure_mode": self.failure_mode,
            "jam_persistent": self.jam_persistent,
            "pill_state": self.pill_state,
        }
