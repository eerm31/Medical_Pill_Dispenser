"""Pin servo: the fixed-height pin leaves the open-ended blade tab slot sideways (ASSUMED / NOT_VALIDATED)."""
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def spec():
    text = (ROOT / "docs" / "visualizer" / "rotation-spec.js").read_text(encoding="utf-8")
    return json.loads(re.sub(r"^window\.DispenserRotationSpec\s*=\s*", "", text.strip()).rstrip(";"))["g"]


def pin_at(cfg, v):
    """Pin position (plan frame) when the lever tip is on the line y = v, picking the smaller servo turn."""
    px, py = cfg["pivot"]
    a0 = math.atan2(cfg["pin_parked"][1] - py, cfg["pin_parked"][0] - px)
    c1 = math.asin(max(-1, min(1, (v - py) / cfg["arm1"])))
    turns = [((c - a0 + math.pi) % (2 * math.pi)) - math.pi for c in (c1, math.pi - c1)]
    phi = min(turns, key=abs)
    return phi, (px + cfg["arm1"] * math.cos(a0 + phi), py + cfg["arm1"] * math.sin(a0 + phi))


def test_released_pin_clears_the_slot_and_the_tubes_and_the_servo_turn_is_small():
    g = spec()
    s1 = g["act"]["s1"]
    v0 = s1["pin_parked"][1]
    slot_depth, pin_r = 4.0, 1.5  # the tab notch runs 4 mm from the pulling wall to the open end
    assert s1["release"] >= slot_depth - 0.5  # engaged 0.5 mm off the wall, the pin leaves the notch by its own radius
    phi_rel, p_rel = pin_at(s1, v0 + s1["release"])
    phi_pull, p_pull = pin_at(s1, v0 - 10.4)
    assert math.isclose(p_pull[1], v0 - 10.4, abs_tol=1e-6)
    assert math.degrees(phi_pull) - math.degrees(phi_rel) < 100  # one micro servo turns about 180 degrees
    assert math.hypot(p_rel[0], p_rel[1]) > 7.4 + 15 + 1.0  # released pin stays outside the swept tubes (r 15 + 7.4)
    assert math.hypot(p_pull[0], p_pull[1]) > 7.4 + 15 + 1.0


def test_pin_cam_spring_and_clearances():
    g = spec()
    s1 = g["act"]["s1"]
    pin, cam, SV = s1["pin"], s1["cam"], g["act"]["servo"]
    head_eng = pin["tip_eng"] + pin["rod"]  # head underside with the pin down
    head_rel = pin["tip_rel"] + pin["rod"]
    assert math.isclose(head_eng + pin["head_t"], cam["z0"], abs_tol=1e-9)  # the cam arm presses the head down at the engaged height
    assert cam["ramp_top"] >= head_rel + pin["head_t"]  # the ramp lets the head rise to the released height
    ears_top = s1["plate_z"][1] + 1.5
    assert head_eng - ears_top >= 0.4  # the head passes over the servo ears
    assert pin["tip_rel"] >= 11.4 + 0.5  # released: the tip clears the rotating blade spring (top 11.4) at the pin radius
    assert s1["lever_z"][0] >= 9.0 + 3.0 + 0.5  # the lever bottom is above the blade peg tops (9 + 3 + 0.5)
    free = head_rel - s1["lever_z"][1]  # spring length when the pin is up
    comp = head_eng - s1["lever_z"][1]  # spring length when the cam holds the pin down
    assert free > comp >= 4.0  # the spring compresses by the pin stroke and stays above its solid height (about 4 mm)
    post_r = math.hypot(s1["pin_parked"][0], cam["post_v"])  # post radius from the axle in plan
    assert post_r - cam["post_r"] > 38 + 0.6 + 1.0  # the post stands outside the rotating peg circle
    assert cam["post_v"] - cam["post_r"] > -(g["shell_r0"] - 0.5)  # and inside the wall
