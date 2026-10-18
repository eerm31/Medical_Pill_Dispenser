"""Unit tests for failure-mode classifiers (T023, US2).

Each classifier fires on its constructed scenario state (FR-013); violations
not matching any classifier are UNCLASSIFIED with the cycle state preserved
(FR-014); jam persistence is reported on subsequent cycles.
"""

import pytest

from dispenser_sim.simulation.failure_modes import (
    CycleState,
    FailureMode,
    classify_violation,
    is_double_drop,
    is_jam,
    is_missed_dispense,
    is_stacking,
)

PILL_SNAPSHOT = {
    "shape": "capsule",
    "length_mm": 18.2,
    "width_mm": 6.1,
    "thickness_mm": 6.1,
    "mass_g": 0.9,
    "friction_coefficient": 0.41,
    "orientation_deg": 73.0,
}


class TestJamClassifier:
    def test_width_exceeds_clearance_is_jam(self):
        state = CycleState(
            pills_dispensed=0,
            pills_available=True,
            jammed=True,
            pill_state=PILL_SNAPSHOT,
        )
        assert is_jam(state)
        assert classify_violation(state) is FailureMode.JAM

    def test_persistent_jam_on_subsequent_cycles_is_jam(self):
        # A jam carrying over blocks presentation; the affected cycles are
        # still JAM violations and jam_persistent is reported on them.
        state = CycleState(
            pills_dispensed=0,
            pills_available=True,
            jammed=True,
            jam_persistent=True,
        )
        assert is_jam(state)
        assert classify_violation(state) is FailureMode.JAM
        assert state.jam_persistent is True

    def test_non_jam_zero_dose_is_not_jam(self):
        state = CycleState(
            pills_dispensed=0,
            pills_available=True,
            jammed=False,
            force_sufficient=False,
        )
        assert not is_jam(state)


class TestMissedDispenseClassifier:
    def test_force_balance_failure_is_missed_dispense(self):
        # Pills available, none released because actuation force could not
        # overcome friction resistance.
        state = CycleState(
            pills_dispensed=0,
            pills_available=True,
            jammed=False,
            force_sufficient=False,
            pill_state=PILL_SNAPSHOT,
        )
        assert is_missed_dispense(state)
        assert classify_violation(state) is FailureMode.MISSED_DISPENSE

    def test_jam_takes_precedence_over_missed_dispense(self):
        state = CycleState(
            pills_dispensed=0,
            pills_available=True,
            jammed=True,
            force_sufficient=False,
        )
        assert classify_violation(state) is FailureMode.JAM


class TestDoubleDropClassifier:
    def test_side_by_side_multi_release_is_double_drop(self):
        # Multi-release through an outlet oversized relative to the pills.
        state = CycleState(
            pills_dispensed=2,
            pills_available=True,
            follower_presented=True,
            side_by_side_release=True,
            pill_state=PILL_SNAPSHOT,
        )
        assert is_double_drop(state)
        assert classify_violation(state) is FailureMode.DOUBLE_DROP


class TestStackingClassifier:
    def test_aligned_follower_multi_release_is_stacking(self):
        # Two pills aligned through the metering point (not side by side).
        state = CycleState(
            pills_dispensed=2,
            pills_available=True,
            follower_presented=True,
            side_by_side_release=False,
            pill_state=PILL_SNAPSHOT,
        )
        assert is_stacking(state)
        assert classify_violation(state) is FailureMode.STACKING

    def test_multi_release_without_follower_is_unclassified(self):
        state = CycleState(
            pills_dispensed=3,
            pills_available=True,
            follower_presented=False,
        )
        assert not is_double_drop(state)
        assert not is_stacking(state)
        assert classify_violation(state) is FailureMode.UNCLASSIFIED


class TestUnclassified:
    def test_interrupted_stroke_is_unclassified_with_state_preserved(self):
        # Partial/interrupted actuation: a fault scenario that matches no
        # named classifier; the recorded state is preserved (FR-014).
        state = CycleState(
            pills_dispensed=0,
            pills_available=True,
            interrupted=True,
            pill_state=PILL_SNAPSHOT,
        )
        assert classify_violation(state) is FailureMode.UNCLASSIFIED
        assert state.pill_state == PILL_SNAPSHOT

    def test_non_violation_states_rejected(self):
        single = CycleState(pills_dispensed=1, pills_available=True)
        with pytest.raises(ValueError):
            classify_violation(single)
        no_pill = CycleState(pills_dispensed=0, pills_available=False)
        with pytest.raises(ValueError):
            classify_violation(no_pill)
