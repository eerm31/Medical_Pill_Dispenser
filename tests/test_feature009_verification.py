"""Feature 009 verification subsystem (ASSUMED / NOT_VALIDATED): sources, wiring in the page, sensor and beam geometry from the spec."""

import hashlib
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


def test_scripts_are_loaded_in_order_and_the_demo_controller_is_untouched():
    html = read("index.html")
    order = ["ring-magazine.js", "verification-controller.js", "schedule-controller.js", "housing-modules.js", "reference-look.js", "ring-ui.js", "subsystem-ui.js"]
    assert [html.index(f'src="{n}"') for n in order] == sorted(html.index(f'src="{n}"') for n in order)
    assert hashlib.sha1((VIS / "demo-controller.js").read_bytes()).hexdigest() == "0c8396023ca6fc85cb135fbbf58ea39e903cee11"


def test_new_modules_are_offline_and_deterministic():
    for name in ("verification-controller.js", "schedule-controller.js", "housing-modules.js", "subsystem-ui.js"):
        js = read(name)
        assert "Math.random" not in js and "http://" not in js and "https://" not in js and "fetch(" not in js, name


def test_controller_contract_and_panel_ids():
    js, html = read("verification-controller.js"), read("index.html")
    for word in ("VERIFIED", "NO_PILL", "MULTIPLE", "COUNT_MISMATCH", "canDispense", "canStore", "EMPTY", "PARTIAL", "FULL", "400"):
        assert word in js, word
    for ident in ("verRings", "verLast", "verBeam", "verifySubsystemToggle"):
        assert f'id="{ident}"' in html, ident
    ring = read("ring-magazine.js")
    assert "queuePocket: function" in ring and "sense: function" in ring and "capacity: CAP" in ring and "addLabel: tagLabel" in ring
    assert "canStore" in read("ring-ui.js")  # the add-pill buttons use the storage check


def pocket_angle(g, k, u):
    ring = g["ring"]
    r0, r1 = ring["tracks"][k]
    rc = (r0 + r1) / 2
    th = math.asin(ring["slot"]["v"][0] / rc)
    return rc, th - (u - 0.5) * 2 * math.pi / ring["n"]


def test_sensors_clear_the_arm_the_posts_and_the_cable_hole(g):
    ring, posts = g["ring"], g["platform_posts"]
    hole = [-38.0, -26.0, -9.4, -1.4]  # servo cable hole in the deck (x, y relative to the axle)
    sweep = (min(a["a0"] for a in ring["arc_slots"]), max(max(a["a1"] for a in ring["arc_slots"]), ring["park_deg"]))
    for k in range(4):
        for u in (1, ring["cap"]):
            rc, phi = pocket_angle(g, k, u)
            deg = math.degrees(phi) % 360
            assert min(abs(deg - sweep[0]), abs(deg - sweep[1])) > 40 and not sweep[0] - 40 < deg < sweep[1] + 40  # clear of the arm's park and sweep
            x, y = rc * math.cos(phi), rc * math.sin(phi)
            for a in posts["angles"]:
                assert math.hypot(x - posts["r"] * math.cos(math.radians(a)), y - posts["r"] * math.sin(math.radians(a))) > 20
            xs, ys = [], []
            for dr in (-2.5, 2.5):  # module 5 mm radial x 6 mm tangential (housing-modules.js BoxGeometry(5, 3.5, 6))
                for dt in (-3, 3):
                    xs.append((rc + dr) * math.cos(phi) - dt * math.sin(phi))
                    ys.append((rc + dr) * math.sin(phi) + dt * math.cos(phi))
            dx, dy = max(hole[0] - max(xs), min(xs) - hole[1], 0), max(hole[2] - max(ys), min(ys) - hole[3], 0)
            assert math.hypot(dx, dy) >= 0.5, (k, u)


def test_level_sensors_sit_over_queue_pockets_not_over_the_exit_slot(g):
    ring = g["ring"]
    assert ring["cap"] == 5
    for k in range(4):
        rc, phi = pocket_angle(g, k, 1)
        lateral = rc * math.sin(phi)
        assert lateral < ring["slot"]["v"][0] - 2.0 + 1e-9  # pocket 1 is past the exit slot's front edge, window radius 1.5 mm included


def test_break_beam_sits_between_the_funnel_walls_above_the_funnel_floor(g):
    f, slot = g["ring"]["funnel"], g["ring"]["slot"]
    x = 44.0
    assert re.search(r"bx = 44\b", read("housing-modules.js"))
    floor = f["z0"] + (f["z1"] - f["z0"]) * (x - f["x0"]) / (f["x1"] - f["x0"])
    beam_z = floor + 6.0
    assert floor < beam_z < -3.0  # between the funnel floor and the deck underside, where the walls stand
    assert f["x0"] < x < 47.5 and slot["v"][0] < slot["v"][1]
