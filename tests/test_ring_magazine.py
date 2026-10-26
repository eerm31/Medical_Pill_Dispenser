"""Ring-magazine alternative mechanism (ASSUMED / NOT_VALIDATED): spec numbers, shared exit and file wiring stay consistent."""

import hashlib
import math
import re
from pathlib import Path

import pytest

from feature005_spec import load_spec

VIS = Path(__file__).resolve().parents[1] / "docs" / "visualizer"
PILL_LEN = [4.2, 6.0, 9.5, 12.0]  # small round, large round, oval, capsule (ring-magazine.js PILLS)


@pytest.fixture(scope="module")
def g():
    return load_spec()["g"]


def test_rings_fit_between_post_and_wall_with_distinct_tracks(g):
    ring = g["ring"]
    tracks = ring["tracks"]
    assert len(tracks) == 4 and ring["cap"] == 5
    assert tracks[0][0] > 10.0  # clear of the centre post
    assert tracks[-1][1] < g["platform_r"] - 1.0  # rim stays on the deck
    for (a0, a1), (b0, _) in zip(tracks, tracks[1:]):
        assert b0 - a1 >= 0.5  # neighbouring rings do not touch


def test_pockets_hold_every_pill_shape_with_a_printable_divider(g):
    ring = g["ring"]
    for (r0, r1), length in zip(ring["tracks"], PILL_LEN):
        rc = (r0 + r1) / 2
        pitch = 2 * math.pi * rc / ring["n"]
        width = r1 - r0 - 2 * ring["rim_t"]
        assert width >= 6.0 or length <= 4.2  # pills are at most 6.2 across
        assert pitch - length - 0.6 >= ring["vane_t"] + 0.5  # divider at least 1 mm even at the smallest clearance
        assert length + 0.6 < pitch  # pocket wider than the pill


def test_one_exit_slot_runs_through_every_deck_layer_and_clears_the_columns(g):
    slot = g["ring"]["slot"]
    box = [slot["x"][0], slot["x"][1], slot["v"][0] + g["axle"][1], slot["v"][1] + g["axle"][1]]
    for layer in g["deck_layers"]:
        assert box in layer["holes"]
    far = max(math.hypot(x, y - g["axle"][1]) for x in box[:2] for y in box[2:])
    assert far < g["platform_r"] - 1.5  # at least 1.5 mm of deck rim beyond the slot
    my = g["axle"][1] + g["motor_offset_y"]
    assert box[3] + 1.0 <= my - g["column_half"] + 1e-9  # funnel wall stays clear of the stepper columns


def test_cup_window_is_a_single_wall_opening_inside_one_sector(g):
    cup = [w for w in g["shell_windows"] if w["id"] == "cup"]
    assert len(cup) == 1
    w = cup[0]
    lo, hi = w["a"] - w["half"], w["a"] + w["half"]
    assert sum(1 for s0, s1 in g["shell_sectors"] if s0 < lo and hi < s1 or (s0 - 360 < lo and hi < s1 - 360)) == 1
    funnel = g["ring"]["funnel"]
    assert w["z0"] < funnel["z1"] - funnel["t"] and funnel["z1"] < w["z1"]  # funnel floor passes through the opening


def test_ring_files_are_loaded_in_order_and_the_controller_is_untouched():
    html = (VIS / "index.html").read_text(encoding="utf-8")
    assert html.index("ring-magazine.js") < html.index("reference-look.js") < html.index("ring-ui.js")
    for ident in ("pocketSize", "ringOpenLid", "ringLoad", "ringIndex", "ringFill", "ringCloseLid", 'name="designOpt"'):
        assert ident in html
    assert hashlib.sha1((VIS / "demo-controller.js").read_bytes()).hexdigest() == "0c8396023ca6fc85cb135fbbf58ea39e903cee11"


def test_ring_module_has_no_network_and_a_single_exit_model():
    js = (VIS / "ring-magazine.js").read_text(encoding="utf-8")
    assert "http://" not in js and "https://" not in js
    assert len(re.findall(r"PILLS\s*=", js)) == 1
    assert "pushed by the divider behind it" in js
    for length in PILL_LEN:
        assert re.search(r"L: %s\b" % re.escape(str(length)), js)
    wiring = (VIS / "wiring-3d.js").read_text(encoding="utf-8")
    assert "function invalidate" in wiring and "ringAct" in wiring


def test_stability_readout_and_ballast_are_wired():
    js = (VIS / "ring-magazine.js").read_text(encoding="utf-8")
    html = (VIS / "index.html").read_text(encoding="utf-8")
    assert "function stability" in js and "BALLAST" in js
    for ident in ("stabMass", "stabCom", "stabRot", "stabTip"):
        assert ident in html


def test_under_deck_arm_sweeps_between_posts_and_clear_of_stepper_columns(g):
    ring, posts = g["ring"], sorted(a % 360 for a in g["platform_posts"]["angles"])
    lo, hi = min(a["a0"] for a in ring["arc_slots"]), max(a["a1"] for a in ring["arc_slots"])
    reach = math.degrees(math.asin((3.0 + 0.5) / 45.5)) + math.degrees(math.asin(g["platform_posts"]["rad"] / g["platform_posts"]["r"])) + 2.0
    before = max(p for p in posts if p < lo)
    after = min(p for p in posts if p > hi)
    assert lo - before > reach and after - max(hi, ring["park_deg"]) > reach
    my = g["axle"][1] + g["motor_offset_y"]
    s, cx = g["collar_half"] + 1.2, g["column_x"]
    for a in ring["arc_slots"]:
        for k in range(41):
            ang = math.radians(a["a0"] + (a["a1"] - a["a0"]) * k / 40)
            x, y = a["r"] * math.cos(ang), g["axle"][1] + a["r"] * math.sin(ang)
            assert not (abs(abs(x) - cx) < s and abs(y - my) < s)  # slot stays out of the column collars


def test_servos_stand_on_the_tray_not_above_the_rings(g):
    js = (VIS / "ring-magazine.js").read_text(encoding="utf-8")
    assert "var ZB = " in js or "ZB = S.bay_z0" in js
    assert "S1Z0" not in js and "arm_z" in js
    assert g["ring"]["arm_z"][1] < g["platform_top"]


def test_prototype_2_has_its_own_refill_animation():
    steps = (VIS / "step-animations.js").read_text(encoding="utf-8")
    ring = (VIS / "ring-magazine.js").read_text(encoding="utf-8")
    assert "id: 'ringrefill'" in steps and "legacy: true" in steps and "rf.drop()" in steps
    assert "bottle" in ring and "prepare: function" in ring and "advance: function" in ring


def test_prototype_2_is_a_slim_tall_flask_with_everything_that_moves_below_the_deck():
    js = (VIS / "flask-magazine.js").read_text(encoding="utf-8")
    html = (VIS / "index.html").read_text(encoding="utf-8")
    assert "http://" not in js and "https://" not in js
    assert html.index("flask-magazine.js") < html.index("reference-look.js")
    for value in ('value="legacy"', 'value="flask"', 'value="ring"'):
        assert value in html
    radii = [float(x) for x in re.search(r"RR = \[([\d., ]+)\]", js).group(1).split(",")]
    deck, lid, shell = (float(re.search(name + r" = ([\d.]+)", js).group(1)) for name in ("ZR", "ZLID", "SR"))
    table = load_spec()["g"]["table_z"]
    assert radii == sorted(radii) and radii[-1] + 4 < shell - 1.5  # concentric rings sit inside the wall
    assert 2 * shell <= 92.0 and (lid + 11 - table) / (2 * shell) >= 1.9  # slim and tall like a flask
    assert lid - deck >= 12.0  # room under the lid to pour
    for name in ("stepper", "ESP32 controller", "Battery 18650", "Micro servo S1"):
        assert name in js  # electronics and drive live in the same housing, below the rings
