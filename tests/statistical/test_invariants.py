"""Statistical invariant tests over seeded runs (T022, US2).

Asserts invariants rather than exact values (research.md R5):
- SC-001: 100% of cycles are classified, no gaps.
- FR-012: empty-reservoir cycles are NO_PILL_AVAILABLE and never counted
  as invariant violations.
- SC-003: the failure-mode breakdown sums to exactly the number of
  zero-dose + multi-dose violations.
- FR-009: sampled pill properties stay within the configured ranges.
"""

import random

from dispenser_sim.mechanism.validation import validate_envelope
from dispenser_sim.models.distribution import PillDistribution
from dispenser_sim.models.envelope import PortabilityEnvelope
from dispenser_sim.models.mechanism import MechanismConfig
from dispenser_sim.models.pill import ShapeCategory
from dispenser_sim.models.events import Outcome
from dispenser_sim.reporting.report import compute_summary
from dispenser_sim.simulation.engine import run_simulation
from dispenser_sim.simulation.population import sample_population
from dispenser_sim.simulation.rng import RunRng

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SLIDER_GATE = REPO_ROOT / "configs" / "mechanisms" / "slider_gate_v1.json"
STANDARD_MIX = REPO_ROOT / "configs" / "pills" / "standard_mix.json"
ENVELOPE = REPO_ROOT / "configs" / "portability_envelope.json"

VIOLATION_OUTCOMES = {Outcome.ZERO_DOSE, Outcome.MULTI_DOSE}


def _run(cycles: int = 2000, seed: int = 42):
    mechanism = MechanismConfig.from_json(SLIDER_GATE)
    distribution = PillDistribution.from_json(STANDARD_MIX)
    envelope = PortabilityEnvelope.from_json(ENVELOPE)
    assert validate_envelope(mechanism, envelope) == []
    return run_simulation(mechanism, distribution, envelope, cycles, seed=seed)


class TestExhaustiveClassification:
    def test_every_cycle_classified_no_gaps(self):
        run = _run(cycles=2000)
        assert run.cycles_completed == 2000  # SC-001
        assert [e.cycle_index for e in run.events] == list(range(2000))
        for event in run.events:
            assert event.outcome in set(Outcome)
            # FR-010/011: outcome consistent with pills dispensed.
            if event.outcome is Outcome.SINGLE:
                assert event.pills_dispensed == 1
            elif event.outcome is Outcome.MULTI_DOSE:
                assert event.pills_dispensed >= 2
            else:
                assert event.pills_dispensed == 0

    def test_zero_and_multi_dose_violations_all_attributed(self):
        # FR-014/SC-003: every violation carries exactly one failure mode.
        run = _run(cycles=2000)
        for event in run.events:
            if event.outcome in VIOLATION_OUTCOMES:
                assert event.failure_mode is not None
            if event.outcome is Outcome.NO_PILL_AVAILABLE:
                assert event.failure_mode is None


class TestEmptyReservoirExclusion:
    def test_empty_reservoir_cycles_not_violations(self):
        # FR-012: with a tiny reservoir, most cycles have no pill available;
        # those cycles must be NO_PILL_AVAILABLE and excluded from violation
        # math (single_dispense_success_rate denominator and breakdown).
        distribution = PillDistribution.from_dict(
            {
                "reservoir_size": 2,
                "category_weights": {"round_tablet": 1.0},
                "categories": {
                    "round_tablet": {
                        "length_mm": [5.0, 7.0],
                        "width_mm": [5.0, 7.0],
                        "thickness_mm": [2.0, 4.0],
                        "mass_g": [0.1, 0.4],
                    }
                },
                "friction_coefficient": [0.2, 0.4],
                "orientation_deg": {"mode": "uniform", "min": 0.0, "max": 180.0},
            }
        )
        mechanism = MechanismConfig.from_json(SLIDER_GATE)
        envelope = PortabilityEnvelope.from_json(ENVELOPE)
        run = run_simulation(mechanism, distribution, envelope, 10, seed=7)

        no_pill = [e for e in run.events if e.outcome is Outcome.NO_PILL_AVAILABLE]
        assert len(no_pill) >= 8  # only 2 pills in the reservoir
        for event in no_pill:
            assert event.failure_mode is None
            assert event.pills_dispensed == 0

        summary = compute_summary(run)
        violations = (
            summary["zero_dose"]["count"] + summary["multi_dose"]["count"]
        )
        assert sum(summary["failure_mode_breakdown"].values()) == violations
        evaluated = 10 - summary["no_pill_available"]["count"]
        expected_rate = summary["single_dose"]["count"] / evaluated
        assert summary["single_dispense_success_rate"] == expected_rate


class TestFailureModeAccounting:
    def test_breakdown_sums_to_violations(self):
        # SC-003: breakdown accounts for 100% of violations.
        run = _run(cycles=5000, seed=123)
        summary = compute_summary(run)
        violations = (
            summary["zero_dose"]["count"] + summary["multi_dose"]["count"]
        )
        assert sum(summary["failure_mode_breakdown"].values()) == violations
        if violations:
            assert set(summary["failure_mode_breakdown"]) <= {
                "JAM",
                "STACKING",
                "DOUBLE_DROP",
                "MISSED_DISPENSE",
                "UNCLASSIFIED",
            }

    def test_rates_and_threshold_verdict(self):
        # SC-002: aggregate rate, per-category rates, PASS/FAIL vs 99.5%.
        run = _run(cycles=5000, seed=123)
        summary = compute_summary(run)
        assert summary["pass_threshold"] == 0.995
        assert summary["pass"] == (
            summary["single_dispense_success_rate"] >= 0.995
        )
        total = run.cycles_completed
        for key in ("single_dose", "zero_dose", "multi_dose", "no_pill_available"):
            assert summary[key]["rate"] == summary[key]["count"] / total
        assert summary["per_category"]  # non-empty breakdown
        for entry in summary["per_category"].values():
            assert 0.0 <= entry["success_rate"] <= 1.0
            assert entry["cycles"] > 0


class TestDistributionSanity:
    def test_sampled_pills_within_configured_ranges(self):
        # FR-009: population sampling respects configured ranges.
        distribution = PillDistribution.from_json(STANDARD_MIX)
        rng = RunRng(99)
        pills = sample_population(distribution, rng.population)
        assert len(pills) == distribution.reservoir_size
        for pill in pills:
            spec = distribution.categories[pill.shape]
            assert spec.length_mm[0] <= pill.length <= spec.length_mm[1]
            if pill.shape is ShapeCategory.ROUND_TABLET:
                assert pill.width == pill.length
            else:
                assert spec.width_mm[0] <= pill.width <= spec.width_mm[1]
            assert pill.width <= pill.length
            assert spec.thickness_mm[0] <= pill.thickness <= spec.thickness_mm[1]
            assert spec.mass_g[0] <= pill.mass <= spec.mass_g[1]
            f_lo, f_hi = distribution.friction_coefficient
            assert f_lo <= pill.friction_coefficient <= f_hi
            assert (
                distribution.orientation_deg.min
                <= pill.orientation
                <= distribution.orientation_deg.max
            )
