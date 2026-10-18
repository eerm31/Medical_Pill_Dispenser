"""Unit tests for CycleFrame derivation (T007, US1).

For every classified state (SINGLE, ZERO_DOSE+MISSED_DISPENSE,
ZERO_DOSE+JAM, ZERO_DOSE+STACKING, MULTI_DOSE+DOUBLE_DROP with actual
count, NO_PILL_AVAILABLE, UNCLASSIFIED, interrupted/FAULT) the derived
frame carries the event's outcome, failure mode, pills_dispensed,
jam_persistent, and pill attributes verbatim, with the
happy-path-or-truncated phase tuple of data-model.md.
"""

import pytest

from dispenser_sim.animation.frames import (
    CycleStage,
    derive_frame,
)
from dispenser_sim.models.events import DispenseEvent, Outcome

PILL = {
    "shape": "capsule",
    "length_mm": 18.2,
    "width_mm": 6.1,
    "friction_coefficient": 0.41,
    "orientation_deg": 73.0,
}

FULL = (
    CycleStage.PRESENTATION,
    CycleStage.SINGULATION,
    CycleStage.RELEASE,
    CycleStage.RESET,
)
TRUNCATED = (CycleStage.PRESENTATION, CycleStage.SINGULATION)
RETAINED = (CycleStage.PRESENTATION, CycleStage.SINGULATION, CycleStage.RESET)


def _event(**overrides) -> DispenseEvent:
    base = {
        "cycle_index": 7,
        "pills_dispensed": 1,
        "outcome": Outcome.SINGLE,
        "failure_mode": None,
        "jam_persistent": False,
        "pill_state": PILL,
    }
    base.update(overrides)
    return DispenseEvent(**base)


class TestFrameFidelity:
    def test_single_full_happy_path_verbatim(self):
        frame = derive_frame(_event())
        assert frame.cycle_index == 7
        assert frame.outcome is Outcome.SINGLE
        assert frame.failure_mode is None
        assert frame.pills_dispensed == 1
        assert frame.jam_persistent is False
        assert frame.pill == PILL
        assert frame.phases == FULL
        assert frame.in_span is None

    def test_zero_dose_missed_dispense_retained_at_reset(self):
        frame = derive_frame(
            _event(
                pills_dispensed=0,
                outcome=Outcome.ZERO_DOSE,
                failure_mode="MISSED_DISPENSE",
            )
        )
        assert frame.outcome is Outcome.ZERO_DOSE
        assert frame.failure_mode == "MISSED_DISPENSE"
        assert frame.pills_dispensed == 0
        assert frame.phases == RETAINED
        assert frame.pill == PILL

    def test_zero_dose_jam_truncated_with_persistence(self):
        frame = derive_frame(
            _event(
                pills_dispensed=0,
                outcome=Outcome.ZERO_DOSE,
                failure_mode="JAM",
                jam_persistent=True,
            )
        )
        assert frame.failure_mode == "JAM"
        assert frame.jam_persistent is True
        assert frame.phases == TRUNCATED
        assert frame.truncated is True

    def test_zero_dose_stacking_verbatim(self):
        frame = derive_frame(
            _event(
                pills_dispensed=0,
                outcome=Outcome.ZERO_DOSE,
                failure_mode="STACKING",
            )
        )
        assert frame.failure_mode == "STACKING"
        assert frame.phases == RETAINED

    def test_multi_dose_double_drop_keeps_actual_count(self):
        frame = derive_frame(
            _event(
                pills_dispensed=3,
                outcome=Outcome.MULTI_DOSE,
                failure_mode="DOUBLE_DROP",
            )
        )
        assert frame.outcome is Outcome.MULTI_DOSE
        assert frame.failure_mode == "DOUBLE_DROP"
        assert frame.pills_dispensed == 3  # truthful count, never generic
        assert frame.phases == FULL

    def test_no_pill_available_is_not_a_failure(self):
        frame = derive_frame(
            _event(
                pills_dispensed=0,
                outcome=Outcome.NO_PILL_AVAILABLE,
                failure_mode=None,
                pill_state=None,
            )
        )
        assert frame.outcome is Outcome.NO_PILL_AVAILABLE
        assert frame.failure_mode is None
        assert frame.pill is None
        assert frame.phases == FULL  # mechanism cycles normally (FR-009)

    def test_unclassified_verbatim(self):
        frame = derive_frame(
            _event(
                pills_dispensed=0,
                outcome=Outcome.ZERO_DOSE,
                failure_mode="UNCLASSIFIED",
            )
        )
        assert frame.failure_mode == "UNCLASSIFIED"
        assert frame.phases == TRUNCATED  # mid-stroke fault rendering

    def test_interrupted_fault_cycle_truncated(self):
        # Partial/interrupted actuation: FAULT scenario from feature 001,
        # recorded UNCLASSIFIED with the pill state preserved (FR-014).
        frame = derive_frame(
            _event(
                cycle_index=42,
                pills_dispensed=0,
                outcome=Outcome.ZERO_DOSE,
                failure_mode="UNCLASSIFIED",
            )
        )
        assert frame.cycle_index == 42
        assert frame.phases == TRUNCATED
        assert frame.truncated is True
        assert frame.pill == PILL

    def test_in_span_attached_when_supplied(self):
        from dispenser_sim.animation.spans import FailureSpan

        span = FailureSpan("JAM", 5, 9)
        frame = derive_frame(
            _event(
                pills_dispensed=0,
                outcome=Outcome.ZERO_DOSE,
                failure_mode="JAM",
            ),
            span=span,
        )
        assert frame.in_span is span


class TestFrameNeverContradictsEvent:
    def test_multi_dose_requires_at_least_two_pills(self):
        with pytest.raises(ValueError):
            _event(pills_dispensed=1, outcome=Outcome.MULTI_DOSE)

    def test_no_pill_available_never_carries_failure_mode(self):
        with pytest.raises(ValueError):
            _event(
                pills_dispensed=0,
                outcome=Outcome.NO_PILL_AVAILABLE,
                failure_mode="JAM",
            )
