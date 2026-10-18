"""Reproducibility tests (T029, US3, SC-004, FR-015/016/017).

Two runs with identical seed + config produce semantically identical events
lists; a run without an explicit seed records the generated seed and replays
identically from it; a persisted run.json reloads and replays with zero
mismatched cycles.
"""

import json
from pathlib import Path

from dispenser_sim.models.distribution import PillDistribution
from dispenser_sim.models.envelope import PortabilityEnvelope
from dispenser_sim.models.mechanism import MechanismConfig
from dispenser_sim.reporting.export import write_run
from dispenser_sim.simulation.engine import run_simulation
from dispenser_sim.simulation.replay import (
    load_run_record,
    replay_run,
    verify_replay,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
SLIDER_GATE = REPO_ROOT / "configs" / "mechanisms" / "slider_gate_v1.json"
STANDARD_MIX = REPO_ROOT / "configs" / "pills" / "standard_mix.json"
ENVELOPE = REPO_ROOT / "configs" / "portability_envelope.json"


def _configs():
    return (
        MechanismConfig.from_json(SLIDER_GATE),
        PillDistribution.from_json(STANDARD_MIX),
        PortabilityEnvelope.from_json(ENVELOPE),
    )


def _events(run):
    return [event.to_dict() for event in run.events]


class TestIdenticalSeedReproduces:
    def test_same_seed_same_config_identical_events(self):
        # SC-004: identical seed + config => identical per-cycle outcomes.
        mechanism, distribution, envelope = _configs()
        run_a = run_simulation(mechanism, distribution, envelope, 2000, seed=42)
        run_b = run_simulation(mechanism, distribution, envelope, 2000, seed=42)
        assert _events(run_a) == _events(run_b)

    def test_different_seed_changes_outcomes(self):
        # FR-016: the seed actually governs randomness (not a constant run).
        mechanism, distribution, envelope = _configs()
        run_a = run_simulation(mechanism, distribution, envelope, 2000, seed=1)
        run_b = run_simulation(mechanism, distribution, envelope, 2000, seed=2)
        assert _events(run_a) != _events(run_b)


class TestGeneratedSeedReplay:
    def test_unseeded_run_records_seed_and_replays_identically(self):
        # FR-015/017: no explicit seed => one is generated, recorded, and the
        # run replays identically from the recorded seed.
        mechanism, distribution, envelope = _configs()
        run = run_simulation(mechanism, distribution, envelope, 500)
        assert isinstance(run.seed, int)
        replayed = run_simulation(
            mechanism, distribution, envelope, 500, seed=run.seed
        )
        assert _events(run) == _events(replayed)


class TestRunRecordReplay:
    def test_persisted_record_replays_with_zero_mismatches(self, tmp_path):
        mechanism, distribution, envelope = _configs()
        run = run_simulation(mechanism, distribution, envelope, 2000, seed=42)
        run_dir = write_run(run, tmp_path)

        loaded = load_run_record(run_dir / "run.json")
        assert loaded.run.seed == 42
        assert loaded.run.run_id == run.run_id
        assert loaded.run.cycles_requested == 2000
        assert loaded.violations == []

        # Re-executing the embedded config + seed reproduces every cycle.
        assert verify_replay(loaded) == []
        replayed = replay_run(loaded)
        assert _events(replayed) == _events(run)

    def test_load_rejects_malformed_record_with_path(self, tmp_path):
        bad = tmp_path / "run.json"
        bad.write_text("{not json", encoding="utf-8")
        try:
            load_run_record(bad)
        except ValueError as exc:
            message = str(exc)
        else:
            raise AssertionError("expected ValueError for malformed JSON")
        assert str(bad) in message
        assert "malformed JSON" in message

    def test_load_rejects_missing_file_with_path(self, tmp_path):
        missing = tmp_path / "nope" / "run.json"
        try:
            load_run_record(missing)
        except ValueError as exc:
            assert str(missing) in str(exc)
        else:
            raise AssertionError("expected ValueError for missing file")

    def test_loaded_record_round_trips_summary(self, tmp_path):
        # The summary recomputed from the loaded events equals the persisted
        # summary (byte-identical report regeneration relies on this, T028).
        from dispenser_sim.reporting.report import compute_summary

        mechanism, distribution, envelope = _configs()
        run = run_simulation(mechanism, distribution, envelope, 2000, seed=42)
        run_dir = write_run(run, tmp_path)
        record = json.loads((run_dir / "run.json").read_text(encoding="utf-8"))
        loaded = load_run_record(run_dir / "run.json")
        assert compute_summary(loaded.run) == record["summary"]
