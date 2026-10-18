"""Failure-mode detection and classification (T024, FR-013/FR-014).

Every single-dose invariant violation (zero pills dispensed while pills were
available, or two or more pills dispensed) is attributed to exactly one named
failure mode; violations matching no classifier are UNCLASSIFIED with the
cycle's recorded state preserved for analysis.

Classifiers (FR-013):
- JAM: geometric interference at the passage — the pill's maximum transverse
  width at its orientation exceeds the effective clearance, so the pill
  wedges (the force balance can never rescue a wedged pill). A jam that
  persists into subsequent cycles classifies those cycles as JAM as well.
- MISSED_DISPENSE: pills available but none released because the mean
  actuation force over the stroke could not overcome the Coulomb friction
  resistance at the gate (the pill falls back; it is not consumed).
- DOUBLE_DROP: multi-release through an oversized outlet — a follower pill
  fits the metering gate side by side with the lead pill and both release.
- STACKING: two pills aligned through the metering point — the follower
  cannot pass side by side but is dragged through aligned behind the lead.
- UNCLASSIFIED: any other violation (e.g. partial/interrupted actuation);
  the cycle state is preserved on the event for analysis (FR-014).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class FailureMode(str, Enum):
    """Named classification of a single-dose invariant violation (FR-013)."""

    JAM = "JAM"
    STACKING = "STACKING"
    DOUBLE_DROP = "DOUBLE_DROP"
    MISSED_DISPENSE = "MISSED_DISPENSE"
    UNCLASSIFIED = "UNCLASSIFIED"


@dataclass(frozen=True)
class CycleState:
    """Recorded state of one resolved actuation cycle, for classification.

    ``pill_state`` preserves the involved pill's snapshot (Pill.to_dict) so
    UNCLASSIFIED violations remain analyzable (FR-014).
    """

    pills_dispensed: int
    pills_available: bool
    jammed: bool = False  # width exceeded effective clearance (wedged)
    force_sufficient: bool = True  # actuation force overcame friction
    follower_presented: bool = False
    side_by_side_release: bool = False  # both pills fit the gate side by side
    interrupted: bool = False  # partial/interrupted actuation (fault)
    jam_persistent: bool = False  # a jam carried into/through this cycle
    pill_state: dict | None = None

    @property
    def is_violation(self) -> bool:
        """FR-011/012: zero pills while available, or >= 2 pills."""
        if not self.pills_available:
            return False  # NO_PILL_AVAILABLE is never a violation
        return self.pills_dispensed == 0 or self.pills_dispensed >= 2


def is_jam(state: CycleState) -> bool:
    """Width exceeded effective clearance, or a prior jam persists."""
    return state.jammed or state.jam_persistent


def is_missed_dispense(state: CycleState) -> bool:
    """Pills available but none released: force balance failed."""
    return (
        state.pills_available
        and state.pills_dispensed == 0
        and not state.jammed
        and not state.jam_persistent
        and not state.force_sufficient
    )


def is_double_drop(state: CycleState) -> bool:
    """Multi-release through an oversized outlet (side-by-side fit)."""
    return state.pills_dispensed >= 2 and state.side_by_side_release


def is_stacking(state: CycleState) -> bool:
    """Two pills aligned through the metering point (follower dragged)."""
    return (
        state.pills_dispensed >= 2
        and state.follower_presented
        and not state.side_by_side_release
    )


def classify_violation(state: CycleState) -> FailureMode:
    """Classify one single-dose invariant violation (FR-013/014).

    Exactly one mode is returned; unmatched violations are UNCLASSIFIED.
    Raises ValueError if the state is not a violation (SINGLE, or
    NO_PILL_AVAILABLE — empty reservoir is excluded per FR-012).
    """
    if not state.is_violation:
        raise ValueError(
            "classify_violation requires a violation state "
            f"(pills_dispensed={state.pills_dispensed}, "
            f"pills_available={state.pills_available})"
        )
    if is_jam(state):
        return FailureMode.JAM
    if state.pills_dispensed >= 2:
        if is_double_drop(state):
            return FailureMode.DOUBLE_DROP
        if is_stacking(state):
            return FailureMode.STACKING
        return FailureMode.UNCLASSIFIED
    if is_missed_dispense(state):
        return FailureMode.MISSED_DISPENSE
    return FailureMode.UNCLASSIFIED
