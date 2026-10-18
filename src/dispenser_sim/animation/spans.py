"""FailureSpan coalescing and SpanIndex navigation (T005, FR-008/013).

One O(n) pass over the ordered events coalesces consecutive JAM cycles
into ``FailureSpan(start, end)`` records (single-cycle jams are length-1
spans) and collects the sorted violation-cycle list for bisect-based
next/previous failure lookup, where a jam span counts once at its start
(research.md Decisions 4–5). NO_PILL_AVAILABLE is never a violation
(FR-012 of feature 001). Pure and display-free; built once at load.
"""

from __future__ import annotations

import bisect
from dataclasses import dataclass
from typing import Sequence

from ..models.events import DispenseEvent


@dataclass(frozen=True)
class FailureSpan:
    """A contiguous range of cycles sharing a persistent condition."""

    failure_mode: str  # MVP: only JAM spans are coalesced
    start_cycle: int  # inclusive
    end_cycle: int  # inclusive

    @property
    def length(self) -> int:
        return self.end_cycle - self.start_cycle + 1

    def contains(self, cycle_index: int) -> bool:
        return self.start_cycle <= cycle_index <= self.end_cycle


class SpanIndex:
    """Sorted violation cycles plus jam spans, built once at load."""

    def __init__(self, events: Sequence[DispenseEvent]) -> None:
        violations: list[int] = []
        spans: list[FailureSpan] = []
        open_start: int | None = None
        for event in events:
            if event.failure_mode == "JAM":
                if open_start is None:
                    open_start = event.cycle_index
                    # A jam span counts once, at its start (FR-013).
                    violations.append(event.cycle_index)
            else:
                if open_start is not None:
                    spans.append(
                        FailureSpan("JAM", open_start, event.cycle_index - 1)
                    )
                    open_start = None
                if event.failure_mode is not None:
                    violations.append(event.cycle_index)
        if open_start is not None:
            spans.append(FailureSpan("JAM", open_start, events[-1].cycle_index))
        self._violations = tuple(violations)
        self._spans = tuple(spans)
        self._span_starts = [span.start_cycle for span in spans]

    @property
    def violations(self) -> tuple[int, ...]:
        """Sorted violation cycle indices (jam spans at their start only)."""
        return self._violations

    @property
    def spans(self) -> tuple[FailureSpan, ...]:
        """Coalesced jam spans, ordered by start_cycle."""
        return self._spans

    def next_failure(self, position: int) -> int | None:
        """First violation cycle strictly after ``position`` (bisect)."""
        index = bisect.bisect_right(self._violations, position)
        if index < len(self._violations):
            return self._violations[index]
        return None

    def previous_failure(self, position: int) -> int | None:
        """Last violation cycle strictly before ``position`` (bisect)."""
        index = bisect.bisect_left(self._violations, position) - 1
        if index >= 0:
            return self._violations[index]
        return None

    def span_containing(self, cycle_index: int) -> FailureSpan | None:
        """The jam span containing ``cycle_index``, if any (bisect)."""
        index = bisect.bisect_right(self._span_starts, cycle_index) - 1
        if index >= 0 and self._spans[index].contains(cycle_index):
            return self._spans[index]
        return None
