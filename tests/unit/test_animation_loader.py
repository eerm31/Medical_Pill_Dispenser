"""Unit tests for the animation run loader (T006, US1).

JsonRunSource loads an existing runs/<run_id>/run.json (events ordered,
mechanism embedded, seed preserved); CsvRunSource reconstructs the same
outcome sequence from cycles.csv with geometry_approximate=True; error
paths (missing path, corrupt JSON, non-contiguous cycles, directory with
neither record) raise the contract's load errors.
"""

import json
import shutil
from pathlib import Path

import pytest

from dispenser_sim.animation.loader import (
    CsvRunSource,
    JsonRunSource,
    RunSource,
    load_run_source,
)
from dispenser_sim.models.events import Outcome
from dispenser_sim.simulation.replay import load_run_record

REPO_ROOT = Path(__file__).resolve().parents[2]
RUN_DIR = REPO_ROOT / "runs" / "00d370d37c0b"  # 10,000 cycles, seed 42


@pytest.fixture(scope="module")
def recorded_events():
    return load_run_record(RUN_DIR / "run.json").run.events


class TestJsonRunSource:
    def test_loads_run_json_with_events_ordered_and_seed(self, recorded_events):
        source = JsonRunSource(RUN_DIR / "run.json")
        assert isinstance(source, RunSource)
        assert source.run_id == "00d370d37c0b"
        assert source.seed == 42
        assert source.geometry_approximate is False
        assert source.mechanism is not None
        assert source.mechanism.name == "slider-gate-v1"
        events = source.events()
        assert len(events) == 10000
        assert [e.cycle_index for e in events] == list(range(10000))
        assert [e.outcome for e in events] == [
            e.outcome for e in recorded_events
        ]

    def test_load_run_source_accepts_directory(self):
        source = load_run_source(RUN_DIR)
        assert isinstance(source, JsonRunSource)
        assert len(source.events()) == 10000


class TestCsvRunSource:
    def test_csv_fallback_reconstructs_same_outcome_sequence(
        self, tmp_path, recorded_events
    ):
        shutil.copy(RUN_DIR / "cycles.csv", tmp_path / "cycles.csv")
        source = load_run_source(tmp_path)
        assert isinstance(source, CsvRunSource)
        assert source.geometry_approximate is True
        assert source.mechanism is None
        assert source.seed is None
        events = source.events()
        assert len(events) == len(recorded_events)
        for rebuilt, recorded in zip(events, recorded_events):
            assert rebuilt.cycle_index == recorded.cycle_index
            assert rebuilt.outcome == recorded.outcome
            assert rebuilt.pills_dispensed == recorded.pills_dispensed
            assert rebuilt.failure_mode == recorded.failure_mode
            assert rebuilt.jam_persistent == recorded.jam_persistent

    def test_csv_pill_snapshot_rebuilt_when_present(self, tmp_path):
        (tmp_path / "cycles.csv").write_text(
            "cycle_index,pills_dispensed,outcome,failure_mode,jam_persistent,"
            "pill_shape,pill_length_mm,pill_width_mm,pill_friction,"
            "pill_orientation_deg\n"
            "0,1,SINGLE,,false,capsule,18.2,6.1,0.41,73.0\n",
            encoding="utf-8",
        )
        source = CsvRunSource(tmp_path / "cycles.csv")
        pill = source.events()[0].pill_state
        assert pill == {
            "shape": "capsule",
            "length_mm": 18.2,
            "width_mm": 6.1,
            "friction_coefficient": 0.41,
            "orientation_deg": 73.0,
        }

    def test_csv_no_pill_cycles_have_no_snapshot(self, tmp_path):
        (tmp_path / "cycles.csv").write_text(
            "cycle_index,pills_dispensed,outcome,failure_mode,jam_persistent,"
            "pill_shape,pill_length_mm,pill_width_mm,pill_friction,"
            "pill_orientation_deg\n"
            "0,0,NO_PILL_AVAILABLE,,false,,,,,\n",
            encoding="utf-8",
        )
        source = CsvRunSource(tmp_path / "cycles.csv")
        event = source.events()[0]
        assert event.outcome is Outcome.NO_PILL_AVAILABLE
        assert event.pill_state is None


class TestLoadErrors:
    def test_missing_path(self, tmp_path):
        with pytest.raises(ValueError, match="file not found"):
            load_run_source(tmp_path / "does-not-exist")

    def test_corrupt_json(self, tmp_path):
        bad = tmp_path / "run.json"
        bad.write_text("{not json", encoding="utf-8")
        with pytest.raises(ValueError, match="malformed JSON"):
            load_run_source(tmp_path)

    def test_non_contiguous_cycles_rejected(self, tmp_path):
        record = json.loads((RUN_DIR / "run.json").read_text(encoding="utf-8"))
        del record["events"][500]  # introduce a gap
        (tmp_path / "run.json").write_text(json.dumps(record), encoding="utf-8")
        with pytest.raises(ValueError, match="gaps or is reordered"):
            load_run_source(tmp_path)

    def test_empty_events_rejected(self, tmp_path):
        record = json.loads((RUN_DIR / "run.json").read_text(encoding="utf-8"))
        record["events"] = []
        (tmp_path / "run.json").write_text(json.dumps(record), encoding="utf-8")
        with pytest.raises(ValueError, match="no events"):
            load_run_source(tmp_path)

    def test_directory_with_neither_record(self, tmp_path):
        with pytest.raises(
            ValueError,
            match=r"no run record \(run\.json\) or per-cycle export "
            r"\(cycles\.csv\) found",
        ):
            load_run_source(tmp_path)

    def test_bad_schema_version(self, tmp_path):
        record = json.loads((RUN_DIR / "run.json").read_text(encoding="utf-8"))
        record["schema_version"] = "9.9"
        (tmp_path / "run.json").write_text(json.dumps(record), encoding="utf-8")
        with pytest.raises(ValueError, match="schema_version"):
            load_run_source(tmp_path)
