"""Feature 011: the ring-magazine pin arm, four fixed pins each lifted by a micro pull solenoid (ASSUMED / NOT_VALIDATED).

The numbers are read from ring-magazine.js so the model and these checks cannot drift apart.
"""
import json
import math
import re
from pathlib import Path

import pytest

VIS = Path(__file__).resolve().parents[1] / "docs" / "visualizer"
JS = (VIS / "ring-magazine.js").read_text(encoding="utf-8")


def _num(pattern):
    m = re.search(pattern, JS)
    assert m, pattern
    return float(m.group(1))


@pytest.fixture(scope="module")
def g():
    text = (VIS / "rotation-spec.js").read_text(encoding="utf-8")
    return json.loads(text[text.index("{"):text.rindex("}") + 1])["g"]


def test_one_solenoid_pin_per_ring_and_no_moving_carriage():
    assert "rp.map(function (x, k)" in JS and "'Pin solenoid'" in JS
    for gone in ("carG", "slG", "SHX", "servoAt", "wedge", "sheave", "spool"):
        assert gone not in JS, gone


def test_pin_stroke_fits_the_solenoid_and_the_floor(g):
    pin, floor = g["ring"]["pin"], g["ring"]["floor_z"]
    stroke = pin["engaged_z"] - pin["retracted_z"]
    assert abs(stroke - 2.6) < 1e-9 and stroke <= 3.0  # assumed 3 mm solenoid stroke
    assert pin["retracted_z"] < floor - 0.3 < pin["engaged_z"]  # tip is under the floor plate (z 3.4) when retracted, through it when engaged
    assert _num(r"z1: (-?[0-9.]+), stroke") < floor - 0.3 - 2.0  # solenoid body top stays well under the floor plate


def test_solenoids_fit_the_ring_pitch_the_coupler_and_the_arm(g):
    rp = [t[0] + 0.4 for t in g["ring"]["tracks"]]
    r = _num(r"SOL = \{ r: ([0-9.]+),")
    assert min(b - a for a, b in zip(rp, rp[1:])) >= 2 * r + 2.0  # at least 2 mm between bodies
    assert rp[0] - r >= g["coupler_r"] + 0.3  # first body clears the flexible coupler
    assert r + 0.8 <= _num(r"ARM_W = ([0-9.]+)")  # socket wall fits inside the arm width


def test_driver_board_stays_inside_the_shell_and_clear_of_the_stepper(g):
    bx, bv, bl, bw = (_num(r"\b%s = (-?[0-9.]+)" % n) for n in ("BX", "BV", "BL", "BW"))
    corners = [(bx - bl, bv - bw / 2), (bx, bv - bw / 2), (bx - bl, bv + bw / 2), (bx, bv + bw / 2)]
    assert max(math.hypot(x, y) for x, y in corners) < 46  # shell inner radius 48
    my = g["motor_offset_y"]
    near = math.hypot(max(bx - bl, min(0, bx)) - 0, max(bv - bw / 2, min(my, bv + bw / 2)) - my)
    assert near > 14.0 + 1.0  # nearest board point clears the 28BYJ-48 body (radius 14) by 1 mm


def test_servos_cables_and_spring_are_gone():
    assert "'Carriage pin spring'" not in JS and "Push-pull cable" not in JS


def test_balls_are_drawn_at_true_size():
    assert _num(r"\bBR = ([0-9.]+),") == 0.5 and "SphereGeometry(BR," in JS  # 1.0 mm balls
    assert "setScalar(on ? 3" not in JS


def test_locking_rod_view_lists_the_new_parts_and_steps_through_each_motion():
    look = (VIS / "reference-look.js").read_text(encoding="utf-8")
    steps = (VIS / "step-animations.js").read_text(encoding="utf-8")
    app = (VIS / "app.js").read_text(encoding="utf-8")
    assert all(f"'{label}'" in look for label in ("Pin solenoid", "Solenoid driver board", "Flex cable", "Index plunger"))
    block = steps[steps.index("ringDemo('ringlock'"):steps.index("ringDemo('ringflap'")]
    assert block.count("localStep(") == 5 and "view('pin')" in block and "view('overview')" in block and "view('detent')" in block
    assert all(call in block for call in ("rd().select(", "rd().swing(", "rd().pin(1", "rd().pin(0", "rd().turn(", "rd().park("))
    assert "unlock" not in block and "lockOpen" not in block
    assert "camPose" in JS and "flyTo:function(g)" in app and "look.ringMagazine.camPose('overview')" in app


def test_arm_clears_the_stepper_columns_at_every_angle_it_sweeps(g):
    ring, half = g["ring"], _num(r"ARM_W = ([0-9.]+)")
    lo, hi = min(a["a0"] for a in ring["arc_slots"]), max(max(a["a1"] for a in ring["arc_slots"]), ring["park_deg"])
    x1 = _num(r"rp\[3\] \+ ([0-9.]+)") + ring["tracks"][3][0] + 0.4
    for sign in (-1, 1):
        cx, cy = sign * g["column_x"], g["motor_offset_y"]
        for k in range(61):
            a = math.radians(lo + (hi - lo) * k / 60)
            along, lateral = cx * math.cos(a) + cy * math.sin(a), abs(cx * math.sin(a) - cy * math.cos(a))
            assert not (7 < along < x1 and lateral < g["column_half"] + half), (sign, math.degrees(a))
