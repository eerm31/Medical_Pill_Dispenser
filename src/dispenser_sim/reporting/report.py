"""RunReport computation (T026, FR-018/019, SC-002/003).

Derives the run.json ``summary`` section from a run's events: totals for
single/zero/multi/no-pill outcomes, aggregate single-dispense success rate
with PASS/FAIL vs the 99.5% threshold (SC-002), per shape-category success
rates, a failure-mode breakdown summing to 100% of violations (SC-003,
FR-012 excludes NO_PILL_AVAILABLE), and notable jam-persistence spans.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..models.events import Outcome
from ..simulation.engine import SimulationRun

#: SC-002: a mechanism passes at >= 99.5% single-dispense reliability.
PASS_THRESHOLD = 0.995

_OUTCOME_KEYS = {
    Outcome.SINGLE: "single_dose",
    Outcome.ZERO_DOSE: "zero_dose",
    Outcome.MULTI_DOSE: "multi_dose",
    Outcome.NO_PILL_AVAILABLE: "no_pill_available",
}


@dataclass(frozen=True)
class RunReport:
    """Derived reliability view over a SimulationRun (FR-018/019)."""

    run_id: str
    summary: dict

    @classmethod
    def from_run(cls, run: SimulationRun) -> "RunReport":
        return cls(run_id=run.run_id, summary=compute_summary(run))

    def to_dict(self) -> dict:
        """The run.json ``summary`` section."""
        return dict(self.summary)


def compute_summary(run: SimulationRun) -> dict:
    """Compute the run.json ``summary`` section from the run's events."""
    events = run.events
    total = len(events)
    counts = {outcome: 0 for outcome in Outcome}
    per_category: dict[str, dict[str, int]] = {}
    failure_mode_breakdown: dict[str, int] = {}
    jam_spans: list[dict[str, int]] = []
    open_jam_start: int | None = None

    for event in events:
        counts[event.outcome] += 1
        if event.pill_state is not None:
            shape = event.pill_state.get("shape", "unknown")
            bucket = per_category.setdefault(shape, {"cycles": 0, "single": 0})
            bucket["cycles"] += 1
            if event.outcome is Outcome.SINGLE:
                bucket["single"] += 1
        if event.outcome in (Outcome.ZERO_DOSE, Outcome.MULTI_DOSE):
            # FR-014/SC-003: every violation is counted under exactly one
            # failure mode; unattributed violations are UNCLASSIFIED.
            key = event.failure_mode or "UNCLASSIFIED"
            failure_mode_breakdown[key] = failure_mode_breakdown.get(key, 0) + 1
        if event.jam_persistent:
            if open_jam_start is None:
                open_jam_start = event.cycle_index
        elif open_jam_start is not None:
            jam_spans.append(
                {"start_cycle": open_jam_start, "end_cycle": event.cycle_index - 1}
            )
            open_jam_start = None
    if open_jam_start is not None:
        jam_spans.append(
            {"start_cycle": open_jam_start, "end_cycle": events[-1].cycle_index}
        )

    no_pill = counts[Outcome.NO_PILL_AVAILABLE]
    evaluated = total - no_pill
    success_rate = (
        counts[Outcome.SINGLE] / evaluated if evaluated > 0 else 0.0
    )

    return {
        "single_dose": {
            "count": counts[Outcome.SINGLE],
            "rate": counts[Outcome.SINGLE] / total if total else 0.0,
        },
        "zero_dose": {
            "count": counts[Outcome.ZERO_DOSE],
            "rate": counts[Outcome.ZERO_DOSE] / total if total else 0.0,
        },
        "multi_dose": {
            "count": counts[Outcome.MULTI_DOSE],
            "rate": counts[Outcome.MULTI_DOSE] / total if total else 0.0,
        },
        "no_pill_available": {
            "count": no_pill,
            "rate": no_pill / total if total else 0.0,
        },
        "single_dispense_success_rate": success_rate,
        "pass_threshold": PASS_THRESHOLD,
        "pass": success_rate >= PASS_THRESHOLD,
        "per_category": {
            shape: {
                "cycles": bucket["cycles"],
                "success_rate": (
                    bucket["single"] / bucket["cycles"]
                    if bucket["cycles"]
                    else 0.0
                ),
            }
            for shape, bucket in sorted(per_category.items())
        },
        "failure_mode_breakdown": failure_mode_breakdown,
        "jam_persistence_spans": jam_spans,
    }
