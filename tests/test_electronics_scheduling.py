"""The electronics firmware (electronics/rotation-mechanism and electronics/scheduling-system) must pass its own host tests
and stay in step with the simulation.

ASSUMED / NOT_VALIDATED. The C++ tests run only when a C++ compiler and make are installed.
"""
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCHED = ROOT / "electronics" / "scheduling-system"
ROT = ROOT / "electronics" / "rotation-mechanism"
VIS = ROOT / "docs" / "visualizer"


def _read(path):
    return path.read_text(encoding="utf-8")


@pytest.mark.skipif(not (shutil.which("make") and (shutil.which("g++") or shutil.which("c++"))), reason="needs make and a C++ compiler")
@pytest.mark.parametrize("system", [ROT, SCHED], ids=["rotation-mechanism", "scheduling-system"])
def test_firmware_host_tests_pass(system):
    try:
        done = subprocess.run(["make", "-C", str(system / "test")], capture_output=True, text=True, timeout=300)
        assert done.returncode == 0, done.stdout + done.stderr
        assert "ALL PASSED" in done.stdout
    finally:
        subprocess.run(["make", "-C", str(system / "test"), "clean"], capture_output=True)


def test_schedule_constants_match_the_simulation():
    js, cpp = _read(VIS / "schedule-controller.js"), _read(SCHED / "firmware" / "core" / "schedule.h")
    assert re.search(r"GRACE_MIN = (\d+)", js).group(1) == re.search(r"#define GRACE_MIN (\d+)", cpp).group(1)
    assert re.search(r"MAX_ENTRIES = (\d+)", js).group(1) == re.search(r"#define MAX_ENTRIES (\d+)", cpp).group(1)
    colors = re.findall(r"'(\w+)'", re.search(r"COLORS = \[(.*?)\]", js).group(1))
    names = _read(ROT / "firmware" / "core" / "colors.cpp")
    assert colors == [n for n in re.findall(r'return "(\w+)";', names) if n != "none"]


def test_rotation_constants_match_the_simulation():
    js, cpp = _read(VIS / "rotation-controller.js"), _read(ROT / "firmware" / "core" / "rotation.cpp")
    for js_name, cpp_name in (("home_offset_deg", "homeOffsetDeg"), ("overshoot_deg", "overshootDeg")):
        assert float(re.search(js_name + r": ([0-9.]+)", js).group(1)) == float(re.search(cpp_name + r" = ([0-9.]+)f;", cpp).group(1))
    full_steps = int(re.search(r"steps_per_rev: (\d+)", js).group(1))
    assert int(re.search(r"stepsPerRev = (\d+)", cpp).group(1)) == 2 * full_steps  # the firmware counts half-steps
    assert int(re.search(r"home_search_limit_steps: (\d+)", js).group(1)) * 100 // full_steps == int(re.search(r"searchLimitPercent = (\d+)", cpp).group(1))


def test_pins_match_the_wiring_spec():
    text = _read(VIS / "wiring-spec.js")
    spec = json.loads(text[text.index("{"):text.rindex("}") + 1])
    gpio = {w["id"]: w["gpio"] for w in spec["signals"] if "gpio" in w}
    cfg = _read(ROT / "firmware" / "config.h")
    for i in range(1, 5):
        assert int(re.search(r"PIN_STEP_IN%d (\d+)" % i, cfg).group(1)) == gpio["STEP_IN%d" % i]
    assert int(re.search(r"PIN_HALL_HOME (\d+)", cfg).group(1)) == gpio["HALL_HOME"]
    reserved = {g for r in spec["reserved_gpio"] for g in r["gpio"]}
    assert not reserved & {gpio[k] for k in ("STEP_IN1", "STEP_IN2", "STEP_IN3", "STEP_IN4", "HALL_HOME")}


def test_core_stays_free_of_arduino_and_hardware_headers():
    for system in (ROT, SCHED):
        for path in (system / "firmware" / "core").iterdir():
            assert "Arduino.h" not in _read(path), path
