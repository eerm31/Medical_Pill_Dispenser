"""Integrity checks for the exported 3D-printing files (docs/visualizer/print)."""

from __future__ import annotations

import hashlib
import json
import re
import struct
import zipfile

import pytest
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRINT = ROOT / "docs" / "visualizer" / "print"
MANIFEST = json.loads((PRINT / "print-manifest.json").read_text(encoding="utf-8"))


def read_stl(path: Path):
    data = path.read_bytes()
    n = struct.unpack("<I", data[80:84])[0]
    assert len(data) == 84 + 50 * n, "not a binary STL of the declared size"
    tris = []
    for k in range(n):
        v = struct.unpack("<12fH", data[84 + 50 * k : 134 + 50 * k])
        tris.append(((v[3], v[4], v[5]), (v[6], v[7], v[8]), (v[9], v[10], v[11])))
    return tris


def closed_and_oriented(tris):
    key = lambda p: tuple(round(c, 4) for c in p)
    edges = Counter()
    for a, b, c in tris:
        for u, w in ((a, b), (b, c), (c, a)):
            edges[(key(u), key(w))] += 1
    return all(n == 1 and edges.get((w, u)) == 1 for (u, w), n in edges.items())


def signed_volume(tris):
    total = 0.0
    for a, b, c in tris:
        total += (
            a[0] * (b[1] * c[2] - b[2] * c[1])
            - a[1] * (b[0] * c[2] - b[2] * c[0])
            + a[2] * (b[0] * c[1] - b[1] * c[0])
        )
    return total / 6.0


def bbox(tris):
    pts = [p for t in tris for p in t]
    lo = [min(p[i] for p in pts) for i in range(3)]
    hi = [max(p[i] for p in pts) for i in range(3)]
    return lo, hi


def test_manifest_discloses_status():
    assert MANIFEST["print_ready"] is False
    assert MANIFEST["fabricable_as_designed"] is False
    assert "NOT_VALIDATED" in MANIFEST["status"]
    assert "Nothing was printed" in MANIFEST["disclosure"]


def test_every_part_is_one_closed_solid_on_the_bed():
    assert {p["id"] for p in MANIFEST["parts"]} == {
        "drum", "housing-platform", "stepper-mount", "base-tray", "tray-foot", "cylindrical-shell-right",
        "cylindrical-shell-back", "cylindrical-shell-left", "service-lid", "station-bracket", "pin-lever",
        "tongue-lever", "tongue-gate", "pin-cam", "cartridge", "cap", "slide-blade",
    }
    for part in MANIFEST["parts"]:
        path = PRINT / part["file"]
        tris = read_stl(path)
        assert part["bodies"] == 1, part["id"]
        assert closed_and_oriented(tris), part["id"]
        vol = signed_volume(tris)
        assert vol > 0 and abs(vol - part["volume_mm3"]) < 0.5, part["id"]
        lo, hi = bbox(tris)
        assert abs(lo[2]) < 1e-3, (part["id"], lo)  # sits on the bed
        assert all(abs((h - l) - s) < 0.02 for l, h, s in zip(lo, hi, part["size_mm"])), part["id"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == part["sha256"], part["id"]


def test_part_sizes_match_the_design_values():
    sizes = {p["id"]: p["size_mm"] for p in MANIFEST["parts"]}
    qty = {p["id"]: p["quantity"] for p in MANIFEST["parts"]}
    assert sizes["drum"] == [71.0, 71.0, 42.0]
    assert sizes["housing-platform"] == [95.6, 95.6, 41.7]   # 6.7 mm plate plus 35 mm chute walls, turned over
    assert sizes["stepper-mount"] == [42.0, 25.0, 15.6]
    assert sizes["base-tray"] == [102.0, 102.0, 40.0]       # plate, 35 mm platform posts, no feet
    assert sizes["tray-foot"] == [10.0, 10.0, 11.0] and qty["tray-foot"] == 3
    assert sizes["service-lid"] == [87.0, 87.0, 6.5]
    assert all(sizes[k][2] == 92.0 for k in ("cylindrical-shell-right", "cylindrical-shell-back", "cylindrical-shell-left"))
    assert sizes["tongue-gate"] == [14.0, 24.0, 1.5] and sizes["pin-lever"][2] == 2.0
    assert sizes["tongue-lever"][2] == 5.2  # 1.8 mm arm with a 3.4 mm crank pin standing up
    assert sizes["station-bracket"][1:] == [12.5, 13.9]
    assert sizes["cartridge"] == [16.4, 24.2, 41.0]
    assert sizes["cap"] == [14.8, 12.4, 5.5]
    assert sizes["slide-blade"] == [10.5, 24.0, 6.8]


def test_every_part_fits_a_220_mm_bed_and_the_small_ones_a_110_mm_bed():
    for p in MANIFEST["parts"]:
        assert p["fits_bed_mm"] is not None and p["fits_bed_mm"] <= 220, p["id"]
        assert p["size_mm"][2] <= 100, p["id"]
    assert max(p["fits_bed_mm"] for p in MANIFEST["parts"]) <= 120


def test_every_interface_keeps_its_play_after_the_hole_shrinks():
    assert MANIFEST["interfaces"]
    for row in MANIFEST["interfaces"]:
        assert row["ok"], row
        assert row["as_printed_mm"] >= row["needed_min_mm"], row


def test_thin_wall_findings_are_recorded_and_the_bad_ones_were_fixed():
    thin = {p["id"]: p["thin_features"]["slices_with_thinner_material"] for p in MANIFEST["parts"]}
    for fixed in ("stepper-mount", "base-tray", "cylindrical-shell-right", "cylindrical-shell-back", "cylindrical-shell-left", "service-lid", "station-bracket"):
        assert thin[fixed] == 0, fixed
    drum = next(p for p in MANIFEST["parts"] if p["id"] == "drum")
    assert any("0.58 mm" in w for w in drum["warnings"])  # the magnet boss wall stays thin and is disclosed
    cam = next(p for p in MANIFEST["parts"] if p["id"] == "pin-cam")
    assert "support" in cam["orientation"] and cam["overhangs"]["area_mm2"] > 40


def test_design_changes_for_printing_are_listed():
    text = " ".join(MANIFEST["design_changes_for_printing"])
    for word in ("Feet are separate", "posts", "bosses", "cam post", "Bracket legs", "chamfer"):
        assert word in text, word


def test_coupons_exist_and_are_closed():
    assert len(MANIFEST["coupons"]) == 7
    for c in MANIFEST["coupons"]:
        path = PRINT / c["file"]
        tris = read_stl(path)
        assert closed_and_oriented(tris), c["id"]
        assert signed_volume(tris) > 0, c["id"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == c["sha256"], c["id"]


def test_zip_contains_every_file():
    names = {p["file"] for p in MANIFEST["parts"]} | {c["file"] for c in MANIFEST["coupons"]}
    with zipfile.ZipFile(PRINT / "smart-dispenser-print-files.zip") as z:
        inside = set(z.namelist())
    assert names | {"print-manifest.json"} <= {Path(n).name for n in inside}


def test_viewer_links_every_print_file():
    html = (ROOT / "docs" / "visualizer" / "index.html").read_text(encoding="utf-8")
    linked = set(re.findall(r'href="print/([^"]+)" download', html))
    expected = {p["file"] for p in MANIFEST["parts"]} | {c["file"] for c in MANIFEST["coupons"]}
    expected |= {"smart-dispenser-print-files.zip", "print-manifest.json"}
    assert linked == expected
    assert all((PRINT / name).is_file() for name in linked)
    assert "NOT PRINT-READY" in html
    assert "feature004" not in html.lower()


def test_manifest_states_support_needs():
    for part in MANIFEST["parts"]:
        assert part["supports"] and "overhangs" in part, part["id"]
        assert "no supports" not in part["settings"] or part["overhangs"]["area_mm2"] < 1, part["id"]


def _spec_g():
    text = (ROOT / "docs" / "visualizer" / "rotation-spec.js").read_text(encoding="utf-8")
    return json.loads(re.sub(r"^window\.DispenserRotationSpec\s*=\s*", "", text.strip()).rstrip(";"))["g"]


def test_base_tray_clears_the_motor_and_the_screw_bosses_stand_inside_it():
    import math

    g = _spec_g()
    cy = g["axle"][1]
    my = cy + g["motor_offset_y"]
    assert g["motor_body_z0"] > g["base_z1"]  # the motor hangs above the tray floor
    assert g["motor_body_z0"] - g["base_z1"] >= 2.0
    s = g["base_screws"]
    assert len(s["angles"]) == 3
    for ang in s["angles"]:
        bx, by = s["r"] * math.cos(math.radians(ang)), cy + s["r"] * math.sin(math.radians(ang))
        reach = math.hypot(bx, by - cy) + s["boss_r"]
        assert g["shell_r0"] + 0.3 <= reach <= g["shell_r1"] - 1.0  # fused into the wall, not through it
        assert math.hypot(bx, by - my) > g["motor_body_r"] + s["boss_r"]
    a = sorted(s["angles"])
    assert all(abs((b - c) % 360 - 120) < 1e-6 for b, c in zip(a[1:] + a[:1], a))  # 120 degrees apart


def test_housing_fits_inside_the_shell_and_the_boards_fit_the_tray():
    import math

    g = _spec_g()
    cy = g["axle"][1]
    ri = g["shell_r0"]
    reach = lambda x, y: math.hypot(x, y - cy)
    corners = lambda b: [(x, y) for x in b[0:2] for y in b[2:4]]
    assert g["platform_r"] <= g["ledge"][1] and g["platform_r"] <= ri
    assert -37 + g["scanner_dx"] < -(g["shell_r1"] + 8)  # the reader stands outside the wall
    mods = g["bay_modules"]
    assert len(mods) == 2  # ESP32-S3 mini and ULN2003; the servos run from 5 V
    boxes = []
    for name, b in mods.items():
        assert max(reach(x, y) for x, y in corners(b)) <= ri - 1.0, name
        boxes.append((name, *b))
    for i, a in enumerate(boxes):  # boards never overlap each other
        for b in boxes[i + 1:]:
            assert a[2] <= b[1] or b[2] <= a[1] or a[4] <= b[3] or b[4] <= a[3], (a[0], b[0])
    my = cy + g["motor_offset_y"]
    for name, x0, x1, y0, y1 in boxes:  # and keep out of the stepper footprint
        nx, ny = min(max(0, x0), x1), min(max(my, y0), y1)
        assert math.hypot(nx, ny - my) > g["motor_body_r"], name
    assert g["shell_r1"] - g["shell_r0"] == 3 and g["shell_r1"] <= g["base_r"]
    assert all(sec[1] - sec[0] == 120 for sec in g["shell_sectors"])
    assert sorted(sec[0] for sec in g["shell_sectors"]) == [-60, 60, 180]
    for w in g["shell_windows"]:
        assert any(sec[0] < w["a"] % 360 - w["half"] and w["a"] % 360 + w["half"] < sec[1] for sec in g["shell_sectors"]) or any(sec[0] < w["a"] - w["half"] and w["a"] + w["half"] < sec[1] for sec in g["shell_sectors"]), w["id"]
    assert g["shell_z1"] == g["lid"]["z0"] and g["lid"]["z0"] > 49.1 + 0.5  # the service lid covers the open caps
