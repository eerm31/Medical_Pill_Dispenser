"""Unit tests for jam-span coalescing and the violation index (T008, US1).

Multi-cycle jams coalesce into one span with correct start/end/length;
single-cycle jams are length-1 spans; span boundaries are identifiable;
the violation index is sorted for bisect navigation with a jam span
counting once at its start (FR-008/013).
"""

from dispenser_sim.animation.spans import FailureSpan, SpanIndex
from dispenser_sim.models.events import DispenseEvent, Outcome


def _events(spec: list[tuple[int, str | None]]) -> list[DispenseEvent]:
    """Build events from (pills_dispensed, failure_mode) pairs."""
    events = []
    for index, (pills, mode) in enumerate(spec):
        if mode is None and pills == 1:
            outcome = Outcome.SINGLE
        elif mode is None:
            outcome = Outcome.NO_PILL_AVAILABLE
        elif pills == 0:
            outcome = Outcome.ZERO_DOSE
        else:
            outcome = Outcome.MULTI_DOSE
        events.append(
            DispenseEvent(
                cycle_index=index,
                pills_dispensed=pills,
                outcome=outcome,
                failure_mode=mode,
                jam_persistent=mode == "JAM",
            )
        )
    return events


class TestSpanCoalescing:
    def test_multi_cycle_jam_coalesces_with_boundaries(self):
        # cycles: 0 SINGLE, 1-3 JAM, 4 SINGLE, 5 JAM (single), 6 SINGLE,
        #         7 MISSED_DISPENSE
        events = _events(
            [
                (1, None),
                (0, "JAM"),
                (0, "JAM"),
                (0, "JAM"),
                (1, None),
                (0, "JAM"),
                (1, None),
                (0, "MISSED_DISPENSE"),
            ]
        )
        index = SpanIndex(events)
        assert index.spans == (
            FailureSpan("JAM", 1, 3),
            FailureSpan("JAM", 5, 5),
        )
        span = index.spans[0]
        assert (span.start_cycle, span.end_cycle, span.length) == (1, 3, 3)
        assert index.spans[1].length == 1  # single-cycle jam

    def test_jam_span_open_at_end_of_run(self):
        events = _events([(1, None), (0, "JAM"), (0, "JAM")])
        index = SpanIndex(events)
        assert index.spans == (FailureSpan("JAM", 1, 2),)

    def test_no_failures(self):
        index = SpanIndex(_events([(1, None)] * 5))
        assert index.spans == ()
        assert index.violations == ()
        assert index.next_failure(0) is None
        assert index.previous_failure(4) is None

    def test_no_pill_available_is_not_a_violation(self):
        events = _events([(1, None), (0, None), (0, "JAM")])
        index = SpanIndex(events)
        assert index.violations == (2,)  # NO_PILL_AVAILABLE excluded


class TestViolationNavigation:
    def setup_method(self):
        # violations at 1 (jam span 1-3), 5 (jam span 5-5), 7 (missed)
        self.index = SpanIndex(
            _events(
                [
                    (1, None),
                    (0, "JAM"),
                    (0, "JAM"),
                    (0, "JAM"),
                    (1, None),
                    (0, "JAM"),
                    (1, None),
                    (0, "MISSED_DISPENSE"),
                    (1, None),
                ]
            )
        )

    def test_violation_index_sorted_jam_counts_once_at_start(self):
        assert self.index.violations == (1, 5, 7)

    def test_next_failure_from_inside_span_jumps_to_span_start_only(self):
        assert self.index.next_failure(0) == 1
        assert self.index.next_failure(1) == 5  # span 1-3 counts once
        assert self.index.next_failure(2) == 5
        assert self.index.next_failure(5) == 7
        assert self.index.next_failure(7) is None

    def test_previous_failure(self):
        assert self.index.previous_failure(1) is None
        assert self.index.previous_failure(4) == 1
        assert self.index.previous_failure(7) == 5
        assert self.index.previous_failure(8) == 7

    def test_span_containing(self):
        assert self.index.span_containing(2) == FailureSpan("JAM", 1, 3)
        assert self.index.span_containing(5) == FailureSpan("JAM", 5, 5)
        assert self.index.span_containing(4) is None
        assert self.index.span_containing(0) is None
