"""The 'Current build' tab (docs/visualizer/build-controller.js) mirrors the electronics firmware.

ASSUMED / NOT_VALIDATED. Keeps the viewer's constants equal to electronics/scheduling-system.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIS = ROOT / "docs" / "visualizer"
SCHED = ROOT / "electronics-ESP32" / "scheduling-system" / "firmware"


def _read(path):
    return path.read_text(encoding="utf-8")


def _num(pattern, text):
    return float(re.search(pattern, text).group(1))


def test_build_constants_match_the_firmware():
    js = _read(VIS / "build-controller.js")
    header = _read(SCHED / "core" / "schedule.h")
    mine = _read(SCHED / "my_schedule.h")
    assert _num(r"GRACE_MIN = (\d+)", js) == _num(r"#define GRACE_MIN (\d+)", header)
    assert _num(r"MAX_ENTRIES = (\d+)", js) == _num(r"#define MAX_ENTRIES (\d+)", header)
    assert _num(r"MAX_PILLS = (\d+)", js) == _num(r"#define MAX_PILLS (\d+)", header)
    # the firmware has the pause in milliseconds, the viewer in seconds
    assert _num(r"DEGREES_PER_PILL = (\d+)", js) == _num(r"#define DEGREES_PER_PILL (\d+)", mine)
    assert _num(r"PAUSE_S = (\d+)", js) * 1000 == _num(r"#define PAUSE_MS_AFTER_MOVE (\d+)", mine)
    assert _num(r"STEP_INTERVAL_US = (\d+)", js) == _num(r"#define STEP_INTERVAL_US (\d+)", mine)
    assert _num(r"STEPS_PER_REV = (\d+)", js) == _num(r"#define STEPS_PER_REV (\d+)", _read(ROOT / "electronics-ESP32" / "rotation-mechanism" / "firmware" / "config.h"))


def test_build_tab_is_wired_into_the_viewer():
    html = _read(VIS / "index.html")
    assert 'name="designOpt" value="build"' in html
    assert 'id="buildSection"' in html
    assert html.index("subsystem-ui.js") < html.index("build-controller.js") < html.index("build-ui.js")


def test_build_scripts_stay_offline():
    for name in ("build-controller.js", "build-ui.js"):
        text = _read(VIS / name)
        assert not re.search(r"https?://|eval\(|new Function|createElement\('script'\)", text), name
