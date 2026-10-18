"""Integration tests for the `validate` and `run` CLI subcommands (T015).

Covers quickstart Scenarios 1-2 and SC-001: a seeded 1,000-cycle run writes
run.json / cycles.csv / report.md with exactly 1,000 classified events and
contiguous cycle_index 0..999; envelope-violating configs are refused with
each violated constraint named unless --allow-envelope-violation is passed.
"""

import csv
import json
from pathlib import Path

import pytest

from dispenser_sim.cli import main

REPO_ROOT = Path(__file__).resolve().parents[2]
SLIDER_GATE = REPO_ROOT / "configs" / "mechanisms" / "slider_gate_v1.json"
OVERSIZED = REPO_ROOT / "configs" / "mechanisms" / "oversized_demo.json"
STANDARD_MIX = REPO_ROOT / "configs" / "pills" / "standard_mix.json"
ENVELOPE = REPO_ROOT / "configs" / "portability_envelope.json"

VALID_OUTCOMES = {"SINGLE", "ZERO_DOSE", "MULTI_DOSE", "NO_PILL_AVAILABLE"}
CSV_HEADER = (
    "cycle_index,pills_dispensed,outcome,failure_mode,jam_persistent,"
    "pill_shape,pill_length_mm,pill_width_mm,pill_friction,pill_orientation_deg"
)


def _run_dir_from_stdout(capsys) -> Path:
    out = capsys.readouterr().out.strip().splitlines()
    assert out, "run must print the run directory path on stdout"
    return Path(out[-1])


class TestRunSubcommand:
    def test_seeded_1000_cycle_run_writes_complete_artifacts(self, tmp_path, capsys):
        rc = main(
            [
                "run",
                "--mechanism", str(SLIDER_GATE),
                "--pills", str(STANDARD_MIX),
                "--envelope", str(ENVELOPE),
                "--cycles", "1000",
                "--seed", "42",
                "--out", str(tmp_path),
            ]
        )
        assert rc == 0
        run_dir = _run_dir_from_stdout(capsys)
        assert (run_dir / "run.json").is_file()
        assert (run_dir / "cycles.csv").is_file()
        assert (run_dir / "report.md").is_file()

        record = json.loads((run_dir / "run.json").read_text(encoding="utf-8"))
        assert record["seed"] == 42
        assert record["cycles_requested"] == 1000
        assert record["cycles_completed"] == 1000
        events = record["events"]
        assert len(events) == 1000  # SC-001: every cycle classified
        assert [e["cycle_index"] for e in events] == list(range(1000))  # no gaps
        for event in events:
            assert event["outcome"] in VALID_OUTCOMES
            # Exactly one outcome per event; NO_PILL_AVAILABLE never carries
            # a failure mode (FR-012).
            assert isinstance(event["outcome"], str)
            if event["outcome"] == "NO_PILL_AVAILABLE":
                assert event["failure_mode"] is None
        # Embedded config + seed make the run reproducible (FR-017).
        assert record["mechanism_config"]["name"] == "slider-gate-v1"
        assert "pill_distribution" in record
        assert "envelope" in record

    def test_cycles_csv_header_and_row_count(self, tmp_path, capsys):
        rc = main(
            [
                "run",
                "--mechanism", str(SLIDER_GATE),
                "--pills", str(STANDARD_MIX),
                "--cycles", "1000",
                "--seed", "42",
                "--out", str(tmp_path),
            ]
        )
        assert rc == 0
        run_dir = _run_dir_from_stdout(capsys)
        text = (run_dir / "cycles.csv").read_text(encoding="utf-8")
        assert text.splitlines()[0] == CSV_HEADER
        with (run_dir / "cycles.csv").open(newline="", encoding="utf-8") as fh:
            rows = list(csv.DictReader(fh))
        assert len(rows) == 1000
        assert [int(r["cycle_index"]) for r in rows] == list(range(1000))

    def test_run_refuses_envelope_violation_without_override(self, tmp_path, capsys):
        rc = main(
            [
                "run",
                "--mechanism", str(OVERSIZED),
                "--pills", str(STANDARD_MIX),
                "--envelope", str(ENVELOPE),
                "--cycles", "10",
                "--seed", "1",
                "--out", str(tmp_path),
            ]
        )
        assert rc == 1
        err = capsys.readouterr().err
        assert "dimensions.length" in err
        assert "mass" in err
        assert "actuation_energy" in err
        assert list(tmp_path.iterdir()) == []  # refused: no run directory created

    def test_run_with_override_flags_violations_in_record(self, tmp_path, capsys):
        rc = main(
            [
                "run",
                "--mechanism", str(OVERSIZED),
                "--pills", str(STANDARD_MIX),
                "--envelope", str(ENVELOPE),
                "--cycles", "10",
                "--seed", "1",
                "--out", str(tmp_path),
                "--allow-envelope-violation",
            ]
        )
        assert rc == 0
        run_dir = _run_dir_from_stdout(capsys)
        record = json.loads((run_dir / "run.json").read_text(encoding="utf-8"))
        envelope_section = record["envelope"]
        assert envelope_section["violated"] is True
        named = " ".join(envelope_section["violations"])
        assert "dimensions.length" in named
        assert "mass" in named
        assert "actuation_energy" in named


class TestValidateSubcommand:
    def test_validate_valid_config(self, capsys):
        rc = main(
            [
                "validate",
                "--mechanism", str(SLIDER_GATE),
                "--pills", str(STANDARD_MIX),
                "--envelope", str(ENVELOPE),
            ]
        )
        assert rc == 0
        assert "VALID" in capsys.readouterr().out

    def test_validate_oversized_names_each_violated_constraint(self, capsys):
        rc = main(
            [
                "validate",
                "--mechanism", str(OVERSIZED),
                "--pills", str(STANDARD_MIX),
                "--envelope", str(ENVELOPE),
            ]
        )
        assert rc == 1
        out = capsys.readouterr().out
        assert "dimensions.length" in out
        assert "mass" in out
        assert "actuation_energy" in out

    def test_validate_malformed_config_exits_1_with_path(self, tmp_path, capsys):
        bad = tmp_path / "bad.json"
        bad.write_text('{"name": "x", "unknown_field": 1}', encoding="utf-8")
        rc = main(["validate", "--mechanism", str(bad), "--pills", str(STANDARD_MIX)])
        assert rc == 1
        assert "unknown_field" in capsys.readouterr().err


class TestUsageErrors:
    def test_cycles_less_than_one_is_usage_error(self):
        with pytest.raises(SystemExit) as excinfo:
            main(
                [
                    "run",
                    "--mechanism", str(SLIDER_GATE),
                    "--pills", str(STANDARD_MIX),
                    "--cycles", "0",
                ]
            )
        assert excinfo.value.code == 2
