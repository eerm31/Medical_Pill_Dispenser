"""Performance test: 10,000-cycle navigation budgets (T018, US3).

Over a synthetic 10,000-event run, SpanIndex construction plus
jump-to-index and next/previous-failure seeks each complete well under
2 seconds, and no frames are derived until requested (lazy derivation,
FR-014/SC-004).
"""

import time

from dispenser_sim.animation.frames import derive_frame
from dispenser_sim.animation.player import PlaybackSession
from dispenser_sim.animation.spans import SpanIndex
from dispenser_sim.models.events import DispenseEvent, Outcome

BUDGET_S = 2.0


def _synthetic_run(n: int = 10_000) -> list[DispenseEvent]:
    """10k contiguous events: a 3-cycle jam span every ~1000 cycles, a
    missed dispense every ~500, SINGLE otherwise."""
    events: list[DispenseEvent] = []
    index = 0
    while index < n:
        if index % 997 == 0 and index + 2 < n:
            for offset in range(3):
                events.append(
                    DispenseEvent(
                        cycle_index=index + offset,
                        pills_dispensed=0,
                        outcome=Outcome.ZERO_DOSE,
                        failure_mode="JAM",
                        jam_persistent=offset < 2,
                    )
                )
            index += 3
        elif index % 501 == 0:
            events.append(
                DispenseEvent(
                    cycle_index=index,
                    pills_dispensed=0,
                    outcome=Outcome.ZERO_DOSE,
                    failure_mode="MISSED_DISPENSE",
                )
            )
            index += 1
        else:
            events.append(
                DispenseEvent(
                    cycle_index=index,
                    pills_dispensed=1,
                    outcome=Outcome.SINGLE,
                )
            )
            index += 1
    return events


def test_span_index_and_navigation_within_budget():
    events = _synthetic_run()
    assert len(events) == 10_000

    start = time.perf_counter()
    index = SpanIndex(events)
    build_s = time.perf_counter() - start
    assert build_s < BUDGET_S

    session = PlaybackSession(len(events), index)

    start = time.perf_counter()
    for target in (9999, 0, 5000, 9999, 123):
        session.seek(target)
    seek_s = time.perf_counter() - start
    assert seek_s < BUDGET_S

    start = time.perf_counter()
    session.seek(0)
    while session.next_failure() is not None:
        pass
    session.seek(9999)
    while session.previous_failure() is not None:
        pass
    nav_s = time.perf_counter() - start
    assert nav_s < BUDGET_S


def test_no_frames_derived_until_requested():
    # Building the index and navigating derives zero frames: the SpanIndex
    # stores only violation ints and span records, never CycleFrames.
    events = _synthetic_run()
    index = SpanIndex(events)
    assert all(isinstance(v, int) for v in index.violations)
    session = PlaybackSession(len(events), index)
    session.seek(9999)
    session.previous_failure()
    # Frames are derived on demand, one at a time (O(1), lazy).
    frame = derive_frame(events[9999], index.span_containing(9999))
    assert frame.cycle_index == 9999
