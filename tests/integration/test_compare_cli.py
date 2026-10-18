"""Integration test for the `compare` CLI subcommand (T030, US3).

Quickstart Scenario 5: `compare` with slider_gate_v1 and rotary_disk_v1 at
1,000 cycles under an identical seed writes one run directory per mechanism
plus comparison.md containing per-mechanism aggregate and per-category
success rates, failure-mode breakdowns, and pass/fail verdicts.
"""

import json
import re
from pathlib import Path

from dispenser_sim.cli import main

REPO_ROOT = Path(__file__).resolve().parents[2]
SLIDER_GATE = REPO_ROOT / "configs" / "mechanisms" / "slider_gate_v1.json"
ROTARY_DISK = REPO_ROOT / "configs" / "mechanisms" / "rotary_disk_v1.json"
STANDARD_MIX = REPO_ROOT / "configs" / "pills" / "standard_mix.json"
ENVELOPE = REPO_ROOT / "configs" / "portability_envelope.json"


def _compare_args(out: Path) -> list[str]:
    return [
        "compare",
        "--mechanism", str(SLIDER_GATE),
        "--mechanism", str(ROTARY_DISK),
        "--pills", str(STANDARD_MIX),
        "--envelope", str(ENVELOPE),
        "--cycles", "1000",
        "--seed", "42",
        "--out", str(out),
    ]


class TestCompareSubcommand:
    def test_compare_writes_runs_and_comparison(self, tmp_path, capsys):
        out = tmp_path / "compare_out"
        rc = main(_compare_args(out))
        assert rc == 0
        stdout = capsys.readouterr().out

        # One run directory per mechanism, each with the three artifacts.
        record = {}
        for name in ("slider-gate-v1", "rotary-disk-v1"):
            match = re.search(rf"{name}: run_id (\w+) -> (\S+)", stdout)
            assert match, f"missing run line for {name}"
            run_dir = Path(match.group(2))
            assert run_dir.is_dir()
            for artifact in ("run.json", "cycles.csv", "report.md"):
                assert (run_dir / artifact).is_file()
            record[name] = json.loads(
                (run_dir / "run.json").read_text(encoding="utf-8")
            )

        # Identical seed across mechanisms (US3).
        assert record["slider-gate-v1"]["seed"] == 42
        assert record["rotary-disk-v1"]["seed"] == 42
        assert record["slider-gate-v1"]["cycles_completed"] == 1000
        assert record["rotary-disk-v1"]["cycles_completed"] == 1000

        comparison_path = out / "comparison.md"
        assert comparison_path.is_file()
        text = comparison_path.read_text(encoding="utf-8")

        # Side-by-side aggregate success rates and verdicts.
        assert "slider-gate-v1" in text
        assert "rotary-disk-v1" in text
        assert "Verdict vs 0.995" in text
        assert re.search(r"\b(PASS|FAIL)\b", text)

        # Per-category success rates for all three shape categories.
        for category in ("capsule", "oblong_caplet", "round_tablet"):
            assert category in text

        # Failure-mode breakdown section present with per-mechanism columns.
        assert "## Failure-mode breakdown" in text

        # comparison.md path is printed last (cli-contract global behavior).
        assert stdout.strip().splitlines()[-1] == str(comparison_path)

    def test_compare_requires_two_mechanisms(self, tmp_path, capsys):
        rc = main(
            [
                "compare",
                "--mechanism", str(SLIDER_GATE),
                "--pills", str(STANDARD_MIX),
                "--cycles", "10",
                "--out", str(tmp_path),
            ]
        )
        assert rc == 2
        assert "at least 2" in capsys.readouterr().err

    def test_compare_refuses_envelope_violation(self, tmp_path, capsys):
        oversized = REPO_ROOT / "configs" / "mechanisms" / "oversized_demo.json"
        rc = main(
            [
                "compare",
                "--mechanism", str(SLIDER_GATE),
                "--mechanism", str(oversized),
                "--pills", str(STANDARD_MIX),
                "--cycles", "10",
                "--seed", "1",
                "--out", str(tmp_path),
            ]
        )
        assert rc == 1
        err = capsys.readouterr().err
        assert "envelope violation" in err
        assert "oversized-demo" in err
