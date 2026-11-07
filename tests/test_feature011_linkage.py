"""Feature 011: the ring-magazine pin carriage, wedge lift and cable drive (ASSUMED / NOT_VALIDATED).

The numbers are read from ring-magazine.js so the model and these checks cannot drift apart.
"""
import json
import math
import re
from pathlib import Path

import pytest

VIS = Path(__file__).resolve().parents[1] / "docs" / "visualizer"
JS = (VIS / "ring-magazine.js").read_text(encoding="utf-8")


def _num(name):
    m = re.search(r"\b%s = (-?[0-9.]+)" % re.escape(name), JS)
    assert m, name
    return float(m.group(1))


@pytest.fixture(scope="module")
def g():
    text = (VIS / "rotation-spec.js").read_text(encoding="utf-8")
    return json.loads(text[text.index("{"):text.rindex("}") + 1])["g"]


def test_wedge_lifts_the_pin_exactly_from_retracted_to_engaged(g):
    pin = g["ring"]["pin"]
    lift = pin["engaged_z"] - pin["retracted_z"]
    run = _num("SLT")
    assert re.search(r"\[3\.2, -4\.6\], \[0\.2, -2\.0\]", JS)  # ramp: 3.0 mm run, 2.6 mm rise
    assert abs((-2.0 + 4.6) - lift) < 1e-9 and abs(lift / run - math.tan(math.radians(41))) < 0.01
    assert _num("PIN_LEN") == 6.6 and abs((pin["retracted_z"] - 6.6) - (-4.6)) < 1e-9  # foot rests on the low end of the ramp


def test_carriage_clears_the_coupler_and_the_floor(g):
    rp0 = g["ring"]["tracks"][0][0] + 0.4
    assert rp0 + _num("CX0") >= g["coupler_r"] + 0.3  # innermost carriage face clears the flexible coupler
    top = 2.2
    assert top < g["ring"]["floor_z"] - 0.3 - 0.5  # carriage top stays under the pocket floor plate (z 3.4..3.7)
    assert g["ring"]["arm_z"][0] < -9.0 + 1e-9 and "ringGeo(9, 7.1, 2.9)" in JS  # hub sleeve sits below the carriage, not in it


def test_cable_legs_never_reach_zero_or_negative_length(g):
    tracks = g["ring"]["tracks"]
    rp0, rp3 = tracks[0][0] + 0.4, tracks[3][0] + 0.4
    shx, shr = _num("SHX"), _num("SHR")
    slt, sla, sln = _num("SLT"), _num("SLA"), _num("SLN")
    assert 8.9 + 1.0 <= rp0 - 1.5 and rp0 - 1.5 - 8.9 >= 1.0  # cable B (pull inward) at the innermost ring
    assert shx - (rp3 + 0.5) >= 4.0  # cable A return leg at the outermost ring
    assert shx - (rp3 + sla + sln + slt) >= 3.5  # cable C return leg, pin engaged, outermost ring
    assert shx + shr + 0.5 <= 45.5 + 0.1  # sheaves sit inside the arm end wall
    assert rp3 + _num("CX1") < shx - shr + 2.5  # carriage body (lateral +-4.5) is beside, not under, the sheaves


def test_spools_turn_less_than_180_degrees(g):
    tracks = g["ring"]["tracks"]
    stroke1 = tracks[3][0] - tracks[0][0]
    stroke2 = stroke1 + _num("SLT")
    assert math.degrees(stroke1 / _num("RS1")) < 180 and math.degrees(stroke2 / _num("RS2")) < 180


def test_spools_fit_between_servo_top_and_arm_underside(g):
    sv = g["act"]["servo"]
    top = g["bay_z0"] + sv["h"]
    spool_top = top + 0.3 + 2.6
    assert spool_top < g["ring"]["arm_z"][0] - 0.3
    for cx, vc, rs in ((-12, 29, _num("RS1")), (20, 29, _num("RS2"))):
        assert math.hypot(cx, vc) + rs + 1.2 < g["shell_r0"] if "shell_r0" in g else math.hypot(cx, vc) + rs + 1.2 < 48


def test_cables_and_spring_are_in_the_locking_rod_view():
    look = (VIS / "reference-look.js").read_text(encoding="utf-8")
    assert "'Carriage pin spring'" in look and "'Push-pull cable'" in look
    assert "SH_END" in JS and "wCr" in JS and "spG" in JS


def test_balls_are_drawn_at_true_size():
    assert _num("BR") == 0.5 and "SphereGeometry(BR," in JS  # 1.0 mm balls
    assert "setScalar(on ? 3" not in JS
