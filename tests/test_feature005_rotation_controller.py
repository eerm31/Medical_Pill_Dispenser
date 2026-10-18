"""Runs the Feature 005 rotation-controller harness headless under the macOS system `jsc`.

ASSUMED / NOT_VALIDATED: this verifies standalone control logic only, not the viewer
controller and not any hardware.
"""

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
VIEWER = ROOT / "docs" / "visualizer"
HARNESS = ROOT / "tests" / "browser" / "feature005"
JSC_CANDIDATES = [
    "/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc",
    "/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc",
]
JSC = next((p for p in JSC_CANDIDATES if Path(p).exists()), shutil.which("jsc"))

pytestmark = pytest.mark.skipif(
    JSC is None, reason="macOS system 'jsc' (JavaScriptCore helper) not found; headless controller harness cannot run"
)

FILES = [
    VIEWER / "concept-data.js",
    VIEWER / "demo-controller.js",
    VIEWER / "rotation-controller.js",
    HARNESS / "harness-core.js",
    HARNESS / "cases-index.js",
    HARNESS / "cases-refusals.js",
    HARNESS / "cases-faults.js",
    HARNESS / "cases-home.js",
    HARNESS / "cases-timing.js",
    HARNESS / "jsc-runner.js",
]
COLORS = ["red", "blue", "green", "orange"]
CRITERIA = ["ROT-C01", "ROT-C02", "ROT-C03", "ROT-C04", "ROT-C06", "ROT-C07", "ROT-C08"]


def run_jsc(*args):
    return subprocess.run([JSC, *args], cwd=ROOT, capture_output=True, text=True, timeout=300)


def run_harness_text():
    result = run_jsc("-e", "var window = this;", *[str(p) for p in FILES])
    assert result.returncode == 0, result.stderr
    assert result.stderr == ""
    return result.stdout


@pytest.fixture(scope="module")
def runs():
    return run_harness_text(), run_harness_text()


@pytest.fixture(scope="module")
def log(runs):
    return json.loads(runs[0])


def test_every_case_passes(log):
    failures = [r for r in log["results"] if r.get("verdict") == "fail"]
    assert failures == []
    assert log["summary"]["fail"] == 0
    assert log["summary"]["checks"] > 100


def test_log_follows_the_contract(log):
    assert log["feature"] == "005-first-subsystem-rotation-pin-gates"
    assert (log["scope"], log["mode"]) == ("rotation", "a")
    assert log["print_ready"] is False and log["fabricable_as_designed"] is False
    assert log["disclosure"].startswith("NOT VALIDATED / NOT PRINT-READY")
    assert log["assumptions"]["status"] == "ASSUMED / NOT_VALIDATED"
    criteria = [r for r in log["results"] if "verdict" in r]
    for r in criteria:
        assert list(r) == ["criterion_id", "step", "observed", "threshold", "threshold_label", "verdict"]
        assert r["threshold_label"] == "proposed" and r["verdict"] in ("pass", "fail")
        assert isinstance(r["observed"], (int, float, str)) and isinstance(r["threshold"], (int, float, str))
    ids = [r["criterion_id"] for r in criteria]
    assert ids == sorted(ids)
    assert sorted(set(ids)) == CRITERIA


def test_sixteen_moves_in_color_order(log):
    steps = [r["step"] for r in log["results"] if r["criterion_id"] == "ROT-C01" and r["step"].endswith(":at_station")]
    assert steps == [f"{a}->{b}:at_station" for a in COLORS for b in COLORS]


def test_physical_criteria_are_never_passed(log):
    rr = [r for r in log["results"] if r["criterion_id"].startswith("ROT-R")]
    assert [r["criterion_id"] for r in rr] == [f"ROT-R0{i}" for i in range(1, 7)]
    assert all(r == {"criterion_id": r["criterion_id"], "status": "not validated \u2014 to be measured on a built rig"} for r in rr)


def test_log_is_byte_identical_on_a_second_run(runs):
    assert runs[0] == runs[1]


def test_log_carries_no_claim_words(runs):
    text = runs[0]
    for allowed in ("NOT VALIDATED / NOT PRINT-READY", "NOT_VALIDATED", "not validated", "print_ready", "fabricable_as_designed"):
        text = text.replace(allowed, "")
    banned = re.compile(r"validat|\bready\b|fabricab|single-dose|\bsafe|medication|\bdose|certif|verified|approved", re.I)
    assert banned.findall(text) == []


def test_controller_adds_exactly_one_global():
    snippet = (
        "var __b = Object.getOwnPropertyNames(this); load('docs/visualizer/rotation-controller.js'); "
        "print(JSON.stringify(Object.getOwnPropertyNames(this).filter(function (n) { return __b.indexOf(n) < 0; })));"
    )
    result = run_jsc("-e", snippet)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == ["DispenserRotationController"]


def test_controller_loads_without_a_window_shim():
    result = run_jsc(str(VIEWER / "rotation-controller.js"), "-e", "print(typeof DispenserRotationController)")
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "function"
