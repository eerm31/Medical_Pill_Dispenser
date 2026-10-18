"""US2 seam test: an in-memory RunSource drives the pure core (T016).

A minimal test double implementing the RunSource protocol (ordered
synthetic DispenseEvents + a MechanismConfig) feeds frames.py, spans.py,
and player.py identically to a recorded-run source, proving no
replay-only coupling exists (research.md Decision 9; FR-011 readiness).
"""

from dataclasses import dataclass

from dispenser_sim.animation.frames import derive_frame
from dispenser_sim.animation.loader import RunSource
from dispenser_sim.animation.player import PlaybackSession
from dispenser_sim.animation.spans import FailureSpan, SpanIndex
from dispenser_sim.models.events import DispenseEvent, Outcome
from dispenser_sim.models.mechanism import MechanismConfig

DIMENSIONS = {"length": 100.0, "width": 50.0, "height": 40.0}
SIMPLIFICATION = (
    "Synthetic test mechanism; justification: not a physical design."
)


def _mechanism() -> MechanismConfig:
    return MechanismConfig(
        name="synthetic-test",
        reservoir_capacity=10,
        passage_clearance_mm=8.0,
        metering_geometry={"stroke_length_mm": 20.0},
        actuation_energy_j=0.5,
        stroke_time_s=0.5,
        tolerances_mm={"passage_clearance": 0.1},
        overall_dimensions_mm=DIMENSIONS,
        mass_g=200.0,
        simplifications=[SIMPLIFICATION],
    )


@dataclass
class InMemoryRunSource:
    """Minimal engine-side double for the future live source (Phase 2)."""

    _events: list[DispenseEvent]
    _mechanism: MechanismConfig
    run_id: str = "in-memory"
    seed: int | None = 7
    geometry_approximate: bool = False

    @property
    def mechanism(self) -> MechanismConfig:
        return self._mechanism

    def events(self) -> list[DispenseEvent]:
        return self._events


def _synthetic_events() -> list[DispenseEvent]:
    return [
        DispenseEvent(cycle_index=0, pills_dispensed=1, outcome=Outcome.SINGLE),
        DispenseEvent(
            cycle_index=1,
            pills_dispensed=0,
            outcome=Outcome.ZERO_DOSE,
            failure_mode="JAM",
            jam_persistent=True,
        ),
        DispenseEvent(
            cycle_index=2,
            pills_dispensed=0,
            outcome=Outcome.ZERO_DOSE,
            failure_mode="JAM",
            jam_persistent=False,
        ),
        DispenseEvent(
            cycle_index=3, pills_dispensed=2, outcome=Outcome.MULTI_DOSE,
            failure_mode="DOUBLE_DROP",
        ),
        DispenseEvent(
            cycle_index=4, pills_dispensed=0,
            outcome=Outcome.NO_PILL_AVAILABLE,
        ),
    ]


def test_in_memory_source_satisfies_protocol_and_drives_core():
    source = InMemoryRunSource(_synthetic_events(), _mechanism())
    assert isinstance(source, RunSource)

    events = source.events()
    index = SpanIndex(events)
    assert index.spans == (FailureSpan("JAM", 1, 2),)
    assert index.violations == (1, 3)  # jam span counts once at its start

    frames = [derive_frame(e, index.span_containing(e.cycle_index)) for e in events]
    assert [f.cycle_index for f in frames] == [0, 1, 2, 3, 4]
    assert frames[1].in_span == FailureSpan("JAM", 1, 2)
    assert frames[3].pills_dispensed == 2  # truthful multi-dose count

    session = PlaybackSession(len(events), index)
    assert session.position == 0
    assert session.next_failure() == 1
    assert session.next_failure() == 3
    assert session.next_failure() is None
    assert session.previous_failure() == 1
