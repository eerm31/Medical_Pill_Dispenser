"""Unit tests for ActuationCycle state machine and DispenseEvent (T014).

Covers FR-001 (complete actuation cycle as the atomic unit) and FR-002/FR-012
(every cycle resolves to exactly one classified outcome, including FAULT
paths; NO_PILL_AVAILABLE never carries a failure mode).
"""

import pytest

from dispenser_sim.models.cycle import ActuationCycle, CycleStage
from dispenser_sim.models.events import DispenseEvent, Outcome


class TestActuationCycleStateMachine:
    def test_happy_path_stage_order(self):
        cycle = ActuationCycle(index=0)
        assert cycle.stage is CycleStage.LOADED
        for expected in (
            CycleStage.PRESENTED,
            CycleStage.SINGULATED,
            CycleStage.RELEASED,
            CycleStage.RESET,
        ):
            cycle.advance()
            assert cycle.stage is expected
        assert cycle.is_complete
        assert cycle.history == [
            CycleStage.LOADED,
            CycleStage.PRESENTED,
            CycleStage.SINGULATED,
            CycleStage.RELEASED,
            CycleStage.RESET,
        ]

    def test_advance_beyond_reset_rejected(self):
        cycle = ActuationCycle(index=1)
        for _ in range(4):
            cycle.advance()
        with pytest.raises(ValueError):
            cycle.advance()

    @pytest.mark.parametrize("faults_at", range(4))
    def test_fault_from_any_stage(self, faults_at):
        cycle = ActuationCycle(index=2)
        for _ in range(faults_at):
            cycle.advance()
        cycle.fault("interrupted stroke")
        assert cycle.stage is CycleStage.FAULT
        assert cycle.is_fault
        assert cycle.fault_reason == "interrupted stroke"
        # A faulted cycle is resolved: no further advance possible.
        with pytest.raises(ValueError):
            cycle.advance()

    def test_fault_path_still_yields_classified_outcome(self):
        # A jam mid-cycle faults the state machine, and the engine still
        # records exactly one classified outcome for the cycle (FR-002).
        cycle = ActuationCycle(index=3)
        cycle.advance()  # PRESENTED
        cycle.advance()  # SINGULATED
        cycle.fault("jam: pill transverse width exceeds effective clearance")
        event = DispenseEvent(
            cycle_index=cycle.index,
            pills_dispensed=0,
            outcome=Outcome.ZERO_DOSE,
            failure_mode=None,
            jam_persistent=True,
            pill_state={"shape": "capsule", "length_mm": 18.2},
        )
        assert event.outcome is Outcome.ZERO_DOSE
        assert cycle.is_fault


class TestDispenseEvent:
    def test_single_requires_exactly_one_pill(self):
        with pytest.raises(ValueError):
            DispenseEvent(cycle_index=0, pills_dispensed=0, outcome=Outcome.SINGLE)
        with pytest.raises(ValueError):
            DispenseEvent(cycle_index=0, pills_dispensed=2, outcome=Outcome.SINGLE)

    def test_zero_dose_requires_zero_pills(self):
        with pytest.raises(ValueError):
            DispenseEvent(cycle_index=0, pills_dispensed=1, outcome=Outcome.ZERO_DOSE)

    def test_multi_dose_requires_two_or_more_pills(self):
        with pytest.raises(ValueError):
            DispenseEvent(cycle_index=0, pills_dispensed=1, outcome=Outcome.MULTI_DOSE)
        event = DispenseEvent(cycle_index=0, pills_dispensed=3, outcome=Outcome.MULTI_DOSE)
        assert event.pills_dispensed == 3

    def test_no_pill_available_forbids_failure_mode(self):
        # FR-012: empty reservoir is an outcome, not a failure mode.
        with pytest.raises(ValueError):
            DispenseEvent(
                cycle_index=0,
                pills_dispensed=0,
                outcome=Outcome.NO_PILL_AVAILABLE,
                failure_mode="MISSED_DISPENSE",
            )

    def test_negative_values_rejected(self):
        with pytest.raises(ValueError):
            DispenseEvent(cycle_index=-1, pills_dispensed=1, outcome=Outcome.SINGLE)
        with pytest.raises(ValueError):
            DispenseEvent(cycle_index=0, pills_dispensed=-1, outcome=Outcome.ZERO_DOSE)

    def test_to_dict_contract_keys(self):
        event = DispenseEvent(
            cycle_index=7,
            pills_dispensed=1,
            outcome=Outcome.SINGLE,
            failure_mode=None,
            jam_persistent=False,
            pill_state={"shape": "round_tablet"},
        )
        record = event.to_dict()
        assert record == {
            "cycle_index": 7,
            "pills_dispensed": 1,
            "outcome": "SINGLE",
            "failure_mode": None,
            "jam_persistent": False,
            "pill_state": {"shape": "round_tablet"},
        }
