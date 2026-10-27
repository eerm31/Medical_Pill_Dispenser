"""Feature 010 touchscreen, status LED, schedule and reader on the housing (ASSUMED / NOT_VALIDATED)."""

import math
import re
from pathlib import Path

import pytest

from feature005_spec import load_spec

VIS = Path(__file__).resolve().parents[1] / "docs" / "visualizer"


def read(name):
    return (VIS / name).read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def g():
    return load_spec()["g"]


def pod():
    m = re.search(r"POD = \{ angle: (\d+) \* DEG, w: (\d+), z0: (-?\d+), z1: (\d+), front: (\d+), back: S\.shell_r1 - 1 \}", read("housing-modules.js"))
    assert m, "POD constants not found"
    return dict(zip(("angle", "w", "z0", "z1", "front"), map(int, m.groups())))


def wall_outer(g, z):
    pts = g["housing_outer"]
    for (r0, z0), (r1, z1) in zip(pts, pts[1:]):
        if z0 - 1e-9 <= z <= z1 + 1e-9:
            return r0 + (r1 - r0) * (z - z0) / max(1e-9, z1 - z0)
    return pts[-1][0]


def test_schedule_rules_and_panel_ids():
    js, html = read("schedule-controller.js"), read("index.html")
    assert "GRACE_MIN = 30" in js and "MAX_ENTRIES = 8" in js and "SPEED = 60" in js
    for state in ("PENDING", "DUE", "TAKING", "TAKEN", "FAILED", "MISSED"):
        assert state in js, state
    assert "verdict === 'VERIFIED'" in js  # only a verified dispense counts as taken
    for ident in ("schedAdd", "schedTime", "schedList", "takeBtn", "clockPlus1", "clockPlus15", "clockPlus60", "clockPlay", "clockSet", "displaySubsystemToggle"):
        assert f'id="{ident}"' in html, ident
    ui = read("subsystem-ui.js")
    assert ui.index("ver.canDispense(due.color)") < ui.index("ctl.requestDispense(")  # the verification check comes first
    assert "requestDispense" not in js  # the clock never starts a dispense


def test_reader_is_on_the_housing_not_on_the_table(g):
    look, app = read("reference-look.js"), read("app.js")
    dx = g["scanner_dx"]
    assert dx == -29 and f"SCAN_DX={dx}" in app
    assert "box(-58.4, -18.5, -4, 4, 21, 24" in look and "box(-21, -17, -9, 9, 17, 28" in look
    assert "S.table_z, S.table_z + 1.6, M_DSTEEL, scanRoot" not in look  # the foot plate is gone
    cy, ri, ro = g["axle"][1], g["shell_r0"], g["shell_r1"]
    arm_end = (-18.5 + dx, 4)
    assert ri <= math.hypot(arm_end[0], arm_end[1] - cy) <= ro + 1.0  # the arm end reaches into the wall
    assert -37 + dx < -(ro + 8)  # the reader face keeps clear of the wall
    ang = [math.degrees(math.atan2(y - cy, x)) % 360 for x in (-21 + dx, -17 + dx) for y in (-9, 9)]
    assert 180 < min(ang) and max(ang) < 300  # arm and saddle sit in shell sector 3 (180..300 degrees)


def test_display_pod_sits_in_one_shell_sector_and_follows_the_wall(g):
    p = pod()
    ro = g["shell_r1"]
    half = math.degrees(math.asin(p["w"] / 2 / (ro - 1)))
    lo, hi = p["angle"] - half, p["angle"] + half
    assert 180 + 3 < lo and hi < 300 - 3  # inside sector 3 with margin to both joints
    assert hi - lo < 120
    ang = [math.degrees(math.atan2(y - g["axle"][1], x)) % 360 for x in (-21 + g["scanner_dx"], -17 + g["scanner_dx"]) for y in (-9, 9)]
    assert max(ang) + 5 < lo  # clear of the reader saddle
    for z in (p["z0"], 0, p["z1"]):  # the pod back (r = shell_r1 - 1) lies inside the wall thickness over the pod height
        assert g["shell_r0"] < ro - 1 <= wall_outer(g, z) + 1e-9, z
    assert g["shell_z0"] <= p["z0"] and p["z1"] <= g["shell_z1"]
    cups = [w for w in g["shell_windows"] if w["id"] in ("cup", "jack")]
    for w in cups:  # windows are far from the pod
        assert abs(((w["a"] - p["angle"] + 180) % 360) - 180) > half + w["half"]


def test_module_and_led_fit_the_pod():
    p = pod()
    js = read("housing-modules.js")
    assert "DZ0 = -9, DZ1 = 33.7" in js and "-30.15, 30.15" in js and "-14.5, -11.5" in js
    assert p["z0"] <= -14.5 and 33.7 <= p["z1"] and 30.15 <= p["w"] / 2 and 18 <= p["w"] / 2
    assert -11.5 < -9  # the LED bar sits below the module
    assert 36.7 <= 33.7 + 9 and 49.0 <= 60.3  # active area inside the module
    assert "onHousing" in js and "housingMount" in js
    look = read("reference-look.js")
    assert "o.userData.onHousing" in look and "housingMount: function" in look  # hide / explode with the wall


def test_led_rules_are_in_the_viewer():
    js = read("housing-modules.js")
    for word in ("amber pulsing", "red steady", "green (dispense verified)", "dim teal", "8000", "5000"):
        assert word in js, word
