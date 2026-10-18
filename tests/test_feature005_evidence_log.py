"""Feature 005 stored rotation check log: harness log (jsc, twice) merged with ROT-C05 records.

ASSUMED / NOT_VALIDATED. Regenerate: `python tests/test_feature005_evidence_log.py` (writes the file).
"""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_feature005_rotation_controller import JSC, run_harness_text  # noqa: E402

EVIDENCE = Path(__file__).resolve().parents[1] / "specs" / "005-first-subsystem-rotation-pin-gates" / "evidence"
LOG = EVIDENCE / "rotation-check-log.json"
C05 = EVIDENCE / "rot-c05-results.json"


def merged_log():
    first = run_harness_text()
    assert first == run_harness_text()  # byte-identical harness runs
    log = json.loads(first)
    log["results"] = sorted(log["results"] + json.loads(C05.read_text(encoding="utf-8"))["results"],
                            key=lambda r: r["criterion_id"])  # stable: keeps in-criterion order
    verdicts = [r for r in log["results"] if "verdict" in r]
    log["summary"] = {"checks": len(verdicts), "fail": sum(r["verdict"] == "fail" for r in verdicts)}
    return json.dumps(log, indent=2, ensure_ascii=False) + "\n"


@pytest.mark.skipif(JSC is None, reason="macOS system 'jsc' not found")
def test_stored_log_matches_fresh_merged_run():
    assert LOG.read_text(encoding="utf-8") == merged_log()


def test_stored_log_orders_and_discloses():
    log = json.loads(LOG.read_text(encoding="utf-8"))
    ids = [r["criterion_id"] for r in log["results"]]
    assert ids == sorted(ids)
    assert {"ROT-C05", "ROT-R01"} <= set(ids)
    assert log["print_ready"] is False and log["fabricable_as_designed"] is False
    assert log["disclosure"].startswith("NOT VALIDATED / NOT PRINT-READY")
    assert all(r.get("verdict") != "pass" for r in log["results"] if r["criterion_id"].startswith("ROT-R"))


if __name__ == "__main__":
    LOG.write_text(merged_log(), encoding="utf-8")
