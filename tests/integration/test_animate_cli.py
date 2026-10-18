"""Integration tests for the `animate` subcommand in --check mode (T014).

Covers quickstart scenarios 2, 5, 6: `animate --check` against an existing
runs/<run_id> exits 0 and prints the machine-verifiable summary with
`frames: OK (<n> derived)` where n equals the record's cycle count;
CSV-fallback directories replay with the `geometry approximate
(cycles.csv only)` stdout note; missing paths and empty directories exit 1
with the contract's stderr messages; tkinter is never imported in --check
mode (verified in a subprocess).
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

from dispenser_sim.cli import main

REPO_ROOT = Path(__file__).resolve().parents[2]
RUN_DIR = REPO_ROOT / "runs" / "00d370d37c0b"  # 10,000 cycles, seed 42


class TestCheckMode:
    def test_check_on_run_directory_prints_machine_verifiable_summary(
        self, capsys
    ):
        rc = main(["animate", "--run", str(RUN_DIR), "--check"])
        assert rc == 0
        out = capsys.readouterr().out
        assert "run_id: 00d370d37c0b" in out
        assert "cycles: 10000" in out
        assert "frames: OK (10000 derived)" in out
        assert "jam_spans:" in out
        assert "seed: 42" in out

    def test_check_accepts_run_json_directly(self, capsys):
        rc = main(["animate", "--run", str(RUN_DIR / "run.json"), "--check"])
        assert rc == 0
        assert "frames: OK (10000 derived)" in capsys.readouterr().out

    def test_check_failure_breakdown_matches_record(self, capsys):
        rc = main(["animate", "--run", str(RUN_DIR), "--check"])
        assert rc == 0
        out = capsys.readouterr().out
        record = json.loads((RUN_DIR / "run.json").read_text(encoding="utf-8"))
        breakdown = record["summary"]["failure_mode_breakdown"]
        for mode, count in breakdown.items():
            if count:
                assert f"failure_mode {mode}: {count}" in out

    def test_check_never_imports_tkinter(self):
        import os

        code = (
            "import sys\n"
            "from dispenser_sim.cli import main\n"
            f"rc = main(['animate', '--run', {str(RUN_DIR)!r}, '--check'])\n"
            "assert rc == 0\n"
            "assert 'tkinter' not in sys.modules, sorted(\n"
            "    m for m in sys.modules if 'tkinter' in m)\n"
        )
        env = dict(os.environ)
        env["PYTHONPATH"] = str(REPO_ROOT / "src")
        result = subprocess.run(
            [sys.executable, "-c", code],
            cwd=REPO_ROOT,
            env=env,
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr


class TestCsvFallback:
    def test_csv_only_directory_replays_with_approximate_note(
        self, tmp_path, capsys
    ):
        shutil.copy(RUN_DIR / "cycles.csv", tmp_path / "cycles.csv")
        rc = main(["animate", "--run", str(tmp_path), "--check"])
        assert rc == 0
        out = capsys.readouterr().out
        assert "geometry approximate (cycles.csv only)" in out
        assert "frames: OK (10000 derived)" in out


class TestErrorPaths:
    def test_missing_path_exits_1(self, capsys):
        rc = main(["animate", "--run", "runs/does-not-exist", "--check"])
        assert rc == 1
        err = capsys.readouterr().err
        assert "error: runs/does-not-exist: file not found" in err

    def test_directory_with_neither_record_exits_1(self, tmp_path, capsys):
        rc = main(["animate", "--run", str(tmp_path), "--check"])
        assert rc == 1
        err = capsys.readouterr().err
        assert (
            "no run record (run.json) or per-cycle export (cycles.csv) found"
            in err
        )

    def test_corrupt_record_exits_1_no_partial_animation(self, tmp_path, capsys):
        (tmp_path / "run.json").write_text("{not json", encoding="utf-8")
        rc = main(["animate", "--run", str(tmp_path), "--check"])
        assert rc == 1
        assert "malformed JSON" in capsys.readouterr().err

    def test_missing_run_argument_is_usage_error(self, capsys):
        import pytest

        with pytest.raises(SystemExit) as excinfo:
            main(["animate"])
        assert excinfo.value.code == 2  # argparse usage error
