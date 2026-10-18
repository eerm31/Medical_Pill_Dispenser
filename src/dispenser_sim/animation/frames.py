"""CycleFrame derivation from DispenseEvent (T004, FR-002/004/006/007/014).

Pure, lazy, O(1) per frame: the frame carries the event's recorded outcome,
failure mode, pills_dispensed, jam flag, and pill snapshot verbatim, plus a
deterministic happy-path-or-truncated phase tuple (data-model.md). Replay
never re-simulates and never re-rolls randomness (FR-002); frames are
derived on demand and never stored for the whole run (FR-014). A frame
never contradicts its event (MULTI_DOSE implies pills_dispensed >= 2 —
enforced by DispenseEvent itself).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Sequence

from ..models.events import DispenseEvent, Outcome
from .spans import FailureSpan


class CycleStage(str, Enum):
    """Presentation phases of one actuation cycle (happy path order)."""

    PRESENTATION = "PRESENTATION"
    SINGULATION = "SINGULATION"
    RELEASE = "RELEASE"
    RESET = "RESET"


#: The unobstructed cycle: pill presented, singulated, released, reset.
HAPPY_PATH: tuple[CycleStage, ...] = (
    CycleStage.PRESENTATION,
    CycleStage.SINGULATION,
    CycleStage.RELEASE,
    CycleStage.RESET,
)

#: Wedged at the passage or interrupted mid-stroke: no release, no reset.
_TRUNCATED: tuple[CycleStage, ...] = (
    CycleStage.PRESENTATION,
    CycleStage.SINGULATION,
)

#: Pill retained through reset (missed dispense / stacking): no release.
_RETAINED: tuple[CycleStage, ...] = (
    CycleStage.PRESENTATION,
    CycleStage.SINGULATION,
    CycleStage.RESET,
)


@dataclass(frozen=True)
class CycleFrame:
    """Visual state of the mechanism and pills for one cycle."""

    cycle_index: int
    outcome: Outcome
    failure_mode: str | None
    pills_dispensed: int  # actual released count (truthful for multi-dose)
    jam_persistent: bool
    pill: dict | None  # recorded pill snapshot (shape, mm, friction, orientation)
    phases: tuple[CycleStage, ...]
    in_span: FailureSpan | None = None

    @property
    def truncated(self) -> bool:
        """True when the cycle faulted mid-stroke (jam / interrupted)."""
        return CycleStage.RESET not in self.phases


def _phases_for(event: DispenseEvent) -> tuple[CycleStage, ...]:
    if event.outcome is not Outcome.ZERO_DOSE:
        # SINGLE and MULTI_DOSE release; NO_PILL_AVAILABLE cycles the
        # mechanism normally with an empty reservoir (FR-009).
        return HAPPY_PATH
    if event.failure_mode in ("JAM", "UNCLASSIFIED"):
        # Wedged at the passage, or interrupted/partial actuation (FAULT).
        return _TRUNCATED
    # MISSED_DISPENSE / STACKING / unattributed: retained through reset.
    return _RETAINED


def derive_frame(
    event: DispenseEvent, span: FailureSpan | None = None
) -> CycleFrame:
    """Derive the O(1) presentation frame for one recorded event.

    ``span`` is the jam FailureSpan containing this cycle, when the caller
    (e.g. the player via SpanIndex.span_containing) has it — the view keeps
    the stuck pill drawn for the whole span (FR-008).
    """
    return CycleFrame(
        cycle_index=event.cycle_index,
        outcome=event.outcome,
        failure_mode=event.failure_mode,
        pills_dispensed=event.pills_dispensed,
        jam_persistent=event.jam_persistent,
        pill=event.pill_state,
        phases=_phases_for(event),
        in_span=span,
    )


def consumption_prefix(events: Sequence[DispenseEvent]) -> list[int]:
    """Pills removed from the reservoir before each cycle (prefix sums).

    Released pills (``pills_dispensed``) and wedged jam pills (a JAM cycle
    with a recorded pill snapshot) are consumed; jam-persistence cycles
    (no pill presented) and missed dispenses (pill falls back) consume
    nothing. Used by the view for truthful reservoir counts.
    """
    prefix: list[int] = []
    total = 0
    for event in events:
        prefix.append(total)
        total += event.pills_dispensed
        if event.failure_mode == "JAM" and event.pill_state is not None:
            total += 1  # the wedged pill is stuck in the mechanism
    return prefix


def depletion_cycle(events: Sequence[DispenseEvent]) -> int | None:
    """First NO_PILL_AVAILABLE cycle, if the run depletes its reservoir."""
    for event in events:
        if event.outcome is Outcome.NO_PILL_AVAILABLE:
            return event.cycle_index
    return None
