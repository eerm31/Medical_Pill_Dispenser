#!/usr/bin/env python3
"""Build printable STL files for the Feature 005 printed parts and the calibration coupons.

ASSUMED / NOT_VALIDATED. Nothing here has been printed or measured: print_ready=false and
fabricable_as_designed=false. Print the coupons first, then put the measured offsets into
scripts/print_profile.json and run this script again.

Needs: python3 -m pip install manifold3d numpy
Run from the repository root: python3 scripts/export_print_files.py

Numbers come from docs/visualizer/rotation-spec.js (the same numbers the viewer draws); the printer
offsets come from scripts/print_profile.json. Output: docs/visualizer/print/.
"""
import hashlib
import json
import math
import re
import struct
import sys
import zipfile
from functools import reduce
from pathlib import Path

import numpy as np
from manifold3d import CrossSection, Error, FillRule, Manifold

ROOT = Path(__file__).resolve().parents[1]
SPEC_FILE = ROOT / "docs" / "visualizer" / "rotation-spec.js"
PROFILE_FILE = ROOT / "scripts" / "print_profile.json"
OUT = ROOT / "docs" / "visualizer" / "print"
SEG = 96  # round features: 96 segments keeps the polygon within 0.003 mm of a true circle at r 2.7


def load_spec():
    text = SPEC_FILE.read_text(encoding="utf-8").strip()
    return json.loads(re.sub(r"^window\.DispenserRotationSpec\s*=\s*", "", text).rstrip(";"))


def load_profile(spec):
    profile = {
        "hole_comp_mm": spec["process"]["hole_comp_mm"],
        "xy_scale": 1.0,
        "layer_mm": spec["process"]["layer_mm"],
        "nozzle_mm": spec["process"]["nozzle_mm"],
        "material": spec["process"]["material"],
        "seat_model_mm": 15.85,
    }
    if PROFILE_FILE.exists():
        profile.update({k: v for k, v in json.loads(PROFILE_FILE.read_text(encoding="utf-8")).items() if not k.startswith("_")})
    return profile


# ----------------------------------------------------------------------------- solids
# Geometry is built in whole micrometres so faces that should touch are bit-identical (floating-point noise
# of 1e-16 mm would otherwise leave hairline gaps and split one part into several bodies); finish() scales to mm.
U = 1000.0


def _i(v):
    return round(v * U)


def box(x0, x1, y0, y1, z0, z1):
    X0, X1, Y0, Y1, Z0, Z1 = (_i(v) for v in (x0, x1, y0, y1, z0, z1))
    return Manifold.cube((X1 - X0, Y1 - Y0, Z1 - Z0)).translate((X0, Y0, Z0))


def circle_pts(r, cx=0, cy=0):
    """SEG-gon in micrometres built from one quadrant, so quarter-turn copies of it coincide exactly."""
    n = SEG // 4
    quad = [(round(r * U * math.cos(2 * math.pi * j / SEG), 4), round(r * U * math.sin(2 * math.pi * j / SEG), 4)) for j in range(n)]
    turns = [lambda x, y: (x, y), lambda x, y: (-y, x), lambda x, y: (-x, -y), lambda x, y: (y, -x)]
    return [(_i(cx) + f(x, y)[0], _i(cy) + f(x, y)[1]) for f in turns for x, y in quad]


def cyl(cx, cy, z0, z1, r):
    return um_prism([circle_pts(r, cx, cy)], z0, z1)


def um_prism(rings_um, z0, z1):
    cs = CrossSection([np.array(r, dtype=float) for r in rings_um], FillRule.EvenOdd)
    return cs.extrude(_i(z1) - _i(z0)).translate((0, 0, _i(z0)))


def prism(rings, z0, z1):
    cs = CrossSection([np.round(np.array(r, dtype=float) * U, 4) for r in rings], FillRule.EvenOdd)
    return cs.extrude(_i(z1) - _i(z0)).translate((0, 0, _i(z0)))


def tr(m, x, y, z):
    return m.translate((_i(x), _i(y), _i(z)))


def finish(m):
    return m.scale((1 / U, 1 / U, 1 / U))


def rect_ring(cx, cy, w, d):
    return [(cx - w / 2, cy - d / 2), (cx + w / 2, cy - d / 2), (cx + w / 2, cy + d / 2), (cx - w / 2, cy + d / 2)]


def union(items):
    return reduce(lambda a, b: a + b, items)


def d_bore(r, flat_x, z0, z1):
    """Circle of radius r cut flat at x = flat_x (material is removed where x <= flat_x)."""
    return cyl(0, 0, z0, z1, r) ^ box(-r - 1, flat_x, -r - 1, r + 1, z0, z1)


def min_corner_to_origin(m):
    x0, y0, z0, x1, y1, z1 = m.bounding_box()
    return m.translate((-x0, -y0, -z0))


# ----------------------------------------------------------------------------- parts
def build_drum(g, P):
    hc = P["hole_comp_mm"]
    hub_r, z0, z1, ax_y = g["hub_r"], g["hub_z0"], g["hub_z1"], g["axle"][1]
    hub = cyl(0, 0, z0, z1, hub_r) - d_bore(g["bore_r"] + hc / 2, g["bore_flat_x"], z0 - 1, z1 + 1)
    AY = _i(ax_y)
    hole = [(_i(x), _i(y) - AY) for x, y in rect_ring(0, 0, 2 * g["deck_hole_x"] + hc, 2 * g["deck_hole_y"] + hc)]
    turn = lambda pts, k: [(x, y) if k % 4 == 0 else (-y, x) if k % 4 == 1 else (-x, -y) if k % 4 == 2 else (y, -x) for x, y in pts]
    # one round deck shared by the four sockets; its centre hole is 1 mm inside the hub radius so the two overlap and merge
    deck = um_prism([circle_pts(g["deck_r"]), circle_pts(hub_r - 1.0)] + [turn(hole, k) for k in range(4)], z0, z0 + g["deck_t"])
    clips = []
    for sx in (-1, 1):
        arm = box(min(sx * g["clip_x0"], sx * g["clip_x1"]), max(sx * g["clip_x0"], sx * g["clip_x1"]),
                  -g["clip_half_y"], g["clip_half_y"], z0 + g["deck_t"], g["clip_z1"])
        hook = box(min(sx * g["hook_x0"], sx * g["clip_x0"]), max(sx * g["hook_x0"], sx * g["clip_x0"]),
                   -g["clip_half_y"], g["clip_half_y"], g["hook_z0"], g["hook_z1"])
        clips += [arm, hook]
    arms = union([tr(c, 0, -ax_y, 0) for c in clips])
    bx, by = g["magnet_xy"]
    boss = cyl(bx, by - ax_y, z0 + g["deck_t"], g["boss_z1"], g["boss_r"])
    pocket = cyl(bx, by - ax_y, g["magnet_z0"], g["boss_z1"] + 1, (3.1 + hc) / 2)
    body = union([hub, deck] + [arms.rotate((0, 0, 90 * k)) for k in range(4)] + [boss])
    return tr(body - pocket, 0, 0, -z0)


def build_platform(g, P):
    hc = P["hole_comp_mm"]
    body = union([box(*b) for b in g["platform_boxes"]])
    ax_y = g["axle"][1]
    body = body - cyl(0, ax_y, g["bearing_z0"], g["platform_top"] + 1, P["seat_model_mm"] / 2)
    body = body - cyl(0, ax_y, -4, g["bearing_z0"] + 0.5, 6.0 + hc / 2)
    my = ax_y + g["motor_offset_y"]
    for sx in (-1, 1):
        s = g["socket_half"]
        body = body - box(sx * g["column_x"] - s, sx * g["column_x"] + s, my - s, my + s, -4, g["socket_z1"])
    hx, hy = g["hall_x"], g["hall_y"]
    body = body - box(hx[0], hx[1], hy[0], hy[1], g["hall_z0"], g["platform_top"] + 1)
    flipped = tr(body.rotate((0, 180, 0)), 0, 0, g["platform_top"])  # top face on the bed
    return min_corner_to_origin(flipped)


def build_mount(g, P):
    hc = P["hole_comp_mm"]
    my = g["axle"][1] + g["motor_offset_y"]
    z0, z1 = g["plate_z0"], g["plate_z1"]
    plate = box(-g["plate_x"], g["plate_x"], g["plate_y0"], g["plate_y1"], z0, z1)
    plate = plate - cyl(g["axle"][0], g["axle"][1], z0 - 1, z1 + 1, (9.5 + hc) / 2)
    parts = [plate]
    for sx in (-1, 1):
        x = sx * g["column_x"]
        parts.append(box(x - g["column_half"], x + g["column_half"], my - g["column_half"], my + g["column_half"], z1, g["column_z1"]))
        parts.append(box(x - g["spigot_half"], x + g["spigot_half"], my - g["spigot_half"], my + g["spigot_half"], g["column_z1"], g["spigot_z1"]))
    body = union(parts)
    for sx in (-1, 1):
        x = sx * g["column_x"]
        body = body - cyl(x, my, z0 - 1, z1 + 1, (3.4 + hc) / 2)          # screw hole through the plate
        body = body - cyl(x, my, z1 - 0.01, -18.0, 2.6 / 2)               # M3 pilot hole, 9.4 mm into the column
    for sx in (-1, 1):
        for y in g["post_ys"]:
            body = body - cyl(sx * g["post_x"], y, z0 - 1, z1 + 1, (3.4 + hc) / 2)  # screw hole for the levelling base
    return min_corner_to_origin(body)


def build_base(g, P):
    z0, z1, cy = g["base_z0"], g["base_z1"], g["axle"][1]
    parts = [cyl(0, cy, z0, z1, g["base_r"])]
    for sx in (-1, 1):
        for y in g["post_ys"]:
            x, h = sx * g["post_x"], g["post_half"]
            parts.append(box(x - h, x + h, y - h, y + h, z1, g["plate_z0"]))
    sh, h = g["shelf"], g["shelf_post_half"]
    for x, y in g["shelf_posts"]:
        parts.append(box(x - h, x + h, y - h, y + h, z1, sh[4]))
    parts.append(box(*sh))  # controller shelf: a bridge between the four posts
    parts.append(box(*g["trough_post"]))
    for name, b in g["bay_modules"].items():  # four standoffs under every board but the battery
        if name == "battery":
            continue
        d = g["standoff_inset"]
        for x, y in ((b[0] + d, b[2] + d), (b[1] - d, b[2] + d), (b[0] + d, b[3] - d), (b[1] - d, b[3] - d)):
            parts.append(cyl(x, y, z1, g["bay_z0"], g["standoff_r"]))
    body = union(parts)
    gr0, gr1 = g["wall_groove"]  # the wall stands in a ring groove
    body = body - (cyl(0, cy, g["shell_z0"], z1 + 1, gr1) - cyl(0, cy, g["shell_z0"] - 1, z1 + 2, gr0))
    hexr = g["foot_nut_af"] / math.sqrt(3)  # circumradius of the nut pocket
    hexagon = [(hexr * math.cos(math.radians(60 * k)), hexr * math.sin(math.radians(60 * k))) for k in range(6)]
    for fx, fy in g["foot_xy"]:
        body = body - cyl(fx, fy, z0 - 1, z1 + 1, g["foot_hole_r"])
        body = body - prism([[(fx + px, fy + py) for px, py in hexagon]], z0 - 1, g["foot_nut_z1"])  # M5 nut pocket, open to the bed
    for sx in (-1, 1):
        for y in g["post_ys"]:
            body = body - cyl(sx * g["post_x"], y, g["plate_z0"] - g["post_pilot_depth"], g["plate_z0"] + 1, g["post_pilot_r"])
    return min_corner_to_origin(body)


def wedge(g, a0, a1, z0, z1):
    cy, steps = g["axle"][1], 24
    ang = [a1 if k == steps else a0 + (a1 - a0) * k / steps for k in range(steps + 1)]  # the last ray is exactly a1
    pts = [(0.0, cy)] + [(300 * math.cos(math.radians(a)), cy + 300 * math.sin(math.radians(a))) for a in ang]
    return prism([pts], z0, z1)


def build_shell(g, P, sector):
    z0, z1, cy = g["shell_z0"], g["shell_z1"], g["axle"][1]
    a0, a1 = g["shell_sectors"][sector]
    tube = cyl(0, cy, z0, z1, g["shell_r1"]) - cyl(0, cy, z0 - 1, z1 + 1, g["shell_r0"])
    body = tube ^ wedge(g, a0, a1, z0 - 1, z1 + 1)
    jt = g["shell_joint"]  # tongue on the a0 edge, matching groove on the a1 edge
    ring = lambda r0, r1: cyl(0, cy, z0, z1, r1) - cyl(0, cy, z0 - 1, z1 + 1, r0)
    arc = lambda length: math.degrees(length / ((jt["tongue_r0"] + jt["tongue_r1"]) / 2))
    body = body + (ring(jt["tongue_r0"], jt["tongue_r1"]) ^ wedge(g, a0 - arc(jt["tongue_len"]), a0 + 1.0, z0 - 1, z1 + 1))  # overlaps the wall so the union merges
    body = body - (ring(jt["groove_r0"], jt["groove_r1"]) ^ wedge(g, a1 - arc(jt["groove_len"]), a1, z0 - 1, z1 + 1))
    for w in g["shell_windows"]:
        if a0 <= w["a"] <= a1:
            body = body - wedge(g, w["a"] - w["half"], w["a"] + w["half"], w["z0"], w["z1"])
    sv = g["pin_servo_shelf"]
    mid = math.degrees(math.atan2((sv[2] + sv[3]) / 2 - cy, (sv[0] + sv[1]) / 2))
    if a0 <= mid <= a1:  # the pin-servo shelf and web (cut to the inside of the wall) belong to this sector
        clip = lambda b: box(*b) ^ cyl(0, cy, b[4] - 1, b[5] + 1, g["shell_r1"] - 1.5)
        body = union([body, clip(sv), clip(g["pin_servo_web"])])
    return min_corner_to_origin(body)


def build_lid(g, P):
    """Printed top face down so the visible face is the smooth first layer; the engraved ring is then a bridged pocket."""
    L, cy = g["lid"], g["axle"][1]
    body = cyl(0, cy, L["z0"], L["z1"], L["r"])
    body = body + (cyl(0, cy, L["lip_z0"], L["z0"] + 0.5, L["lip_r1"]) - cyl(0, cy, L["lip_z0"] - 1, L["z0"] + 1, L["lip_r0"]))
    body = body - (cyl(0, cy, L["z1"] - L["groove_depth"], L["z1"] + 1, L["groove_r1"]) - cyl(0, cy, L["z1"] - 2, L["z1"] + 2, L["groove_r0"]))
    flipped = tr(body.rotate((0, 180, 0)), 0, 0, L["z1"])
    return min_corner_to_origin(flipped)


def build_trough(g, P):
    """Printed flat: the floor is horizontal here and tilted 15 degrees only when assembled."""
    tr = g["trough"]
    length = (tr["x1"] - tr["x0"]) / math.cos(math.radians(tr["slope_deg"]))
    t, wh, wt, y0, y1 = tr["t"], tr["wall_h"], tr["wall_t"], tr["y0"], tr["y1"]
    return min_corner_to_origin(union([box(0, length, y0, y1, 0, t), box(0, length, y0, y0 + wt, t, t + wh), box(0, length, y1 - wt, y1, t, t + wh)]))


def build_cup(g, P):
    x0, x1, y0, y1, z0, z1 = g["cup"]
    w = g["cup_wall"]
    return min_corner_to_origin(box(x0, x1, y0, y1, z0, z1) - box(x0 + w, x1 - w, y0 + w, y1 - w, z0 + w, z1 + 1))


def build_rail(g, P):
    rb = g["rail_block"]
    return min_corner_to_origin(union([box(*rb["plate"]), box(*rb["post"])] + [box(*r) for r in rb["rails"]]))


def peg(x, y, z0, g):
    shaft = cyl(x, y, z0, z0 + g["peg_h"], g["peg_r"])
    head = cyl(x, y, z0 + g["peg_h"], z0 + g["peg_h"] + 0.5, 0.9)
    return shaft + head


def build_cartridge(g, P):
    hc = P["hole_comp_mm"]
    zp, top, hx, hy = 6.0, 46.0, g["tube_half_x"], g["tube_half_y"]
    tube = prism([rect_ring(0, 0, 2 * hx, 2 * hy), rect_ring(0, 0, 10.8 + hc, 8.4 + hc)], zp, top)
    parts = [tube]
    for s in (-1, 1):
        parts.append(box(min(s * 5.4, s * 7.4), max(s * 5.4, s * 7.4), -18.0, hy, 5.0, zp))                       # guide rails
        parts.append(box(min(s * hx, s * g["ledge_x1"]), max(s * hx, s * g["ledge_x1"]), -g["clip_half_y"], g["clip_half_y"], g["ledge_z0"], g["ledge_z1"]))
    parts.append(box(-4, 4, -hy - 1.2, -hy, 34.0, top))                                                        # colour tag plate
    parts.append(box(g["spring_x"] - 1.5, g["spring_x"] + 1.5, g["peg_fixed_y"] - 1.2, -hy, zp, 9.0))             # spring lug
    parts.append(peg(g["spring_x"], g["peg_fixed_y"], 9.0, g))
    return min_corner_to_origin(union(parts))


def build_cap(g, P):
    plate = box(-g["tube_half_x"], g["tube_half_x"], -g["tube_half_y"], g["tube_half_y"], 0, 1.5)
    knob = cyl(0, 0, 1.5, 5.5, 3.0)
    return min_corner_to_origin(plate + knob)


def build_blade(g, P):
    prof = [(0, 5.0), (0, 5.3), (2.6, 6.0), (22.0, 6.0), (22.0, 5.0)]               # (length from the tip, z)
    sheet = CrossSection([np.array(prof, dtype=float) * U], FillRule.EvenOdd).extrude(10.5 * U)
    plate = sheet.transform(np.array([[0, 0, -1, 5.25 * U], [-1, 0, 0, 0], [0, 1, 0, 0]], dtype=float))         # width along x, length along -y
    tab = box(-4.5, 4.5, -24.0, -16.0, 6.0, 8.5) - box(-2.5, 2.5, -22.0, -18.0, 5.9, 8.6)
    body = plate + tab + peg(g["spring_x"], g["peg_blade_y"], 8.5, g)
    return min_corner_to_origin(body)


# ----------------------------------------------------------------------------- coupons
def pips(n, x, y):
    return [cyl(x + 3 * i, y, 0, 1.0, 0.7) for i in range(n)]


def coupon_c1(g, P):
    parts, x = [], 0.0
    for i, d in enumerate((15.80, 15.85, 15.90, 16.00)):
        od = d + 2 * 0.8
        parts.append(cyl(x + od / 2, od / 2, 0, 5.0, od / 2) - cyl(x + od / 2, od / 2, -1, 6, d / 2))
        parts += pips(i + 1, x + od / 2 - 3 * i / 2, od + 3)
        x += od + 4
    return union(parts)


def coupon_c2(g, P):
    hc = P["hole_comp_mm"]
    block = box(0, 30, 0, 16, 0, 14)
    block = block - cyl(8, 8, -1, 15, (5.2 + hc) / 2)
    block = block - tr(d_bore(g["bore_r"] + hc / 2, g["bore_flat_x"], -1, 15), 22, 8, 0)
    parts = [block]
    for i, d in enumerate((4.85, 4.90, 4.95, 5.00, 5.05)):
        parts.append(cyl(6 + 7 * i, 24, 0, 18 + 3 * i, d / 2))   # pin length 18 + 3 mm per step identifies the diameter
    return union(parts)


def coupon_c3(g, P):
    body = box(0, 36, 0, 12, 0, 1.0)
    for i in range(3):
        body = body + cyl(6 + 12 * i, 6, 1.0, 2.0, g["boss_r"])
    for i, d in enumerate((3.15, 3.25, 3.35)):
        body = body - cyl(6 + 12 * i, 6, 0.6, 3.0, d / 2)         # 1.4 mm deep from the boss top, 0.6 mm floor
    return body


def coupon_c4(g, P):
    hc = P["hole_comp_mm"]
    plate = box(-21, 21, 0, 23, 0, 1.6) - cyl(0, 5, -1, 3, (9.5 + hc) / 2)
    parts = [plate]
    for sx in (-1, 1):
        x = sx * 17.5
        parts += [box(x - 2, x + 2, 11, 15, 1.6, 14.0), box(x - 1.5, x + 1.5, 11.5, 14.5, 14.0, 16.0)]
    body = union(parts)
    for sx, pilot in ((-1, 2.5), (1, 2.7)):
        x = sx * 17.5
        body = body - cyl(x, 13, -1, 3, (3.4 + hc) / 2) - cyl(x, 13, 1.59, 11.0, pilot / 2)
    return body


def coupon_c5(g, P):
    block = box(0, 30, 0, 14, 0, 6.0)
    for x in (7.5, 22.5):
        block = block - box(x - 1.65, x + 1.65, 7 - 1.65, 7 + 1.65, 6.0 - 2.2, 6.1)
    return block


def clip_solid():
    arm = box(0, 1.2, 0, 6, 0, 16.0)
    hook = box(-0.7, 0, 0, 6, 13.8, 15.4)
    return arm + hook


def coupon_c6(g, P):
    upright = min_corner_to_origin(box(-6, 7.2, -1, 7, 0, 1.0) + tr(clip_solid(), 0, 0, 1.0))
    side = min_corner_to_origin(clip_solid().rotate((90, 0, 0)))     # arm lies on its long edge
    flat = min_corner_to_origin(clip_solid().rotate((0, 90, 0)))     # arm lies on its wide face
    out, x = [], 0.0
    for part in (upright, side, flat):
        x0, _, _, x1, _, _ = part.bounding_box()
        out.append(part.translate((x - x0, 0, 0)))
        x += (x1 - x0) + 6 * U
    return union(out)


def coupon_c7(g, P):
    hc = P["hole_comp_mm"]
    return cyl(0, 0, 0, 20.0, 8.0) - d_bore(g["bore_r"] + hc / 2, g["bore_flat_x"], -1, 21)


COUPONS = [
    ("C-1", "coupon-c1-bearing-seat", coupon_c1, "Four rings modelled 15.80 / 15.85 / 15.90 / 16.00 mm (1 to 4 dots), 5 mm deep, 0.8 mm wall. Ream the 15.85 ring to 16.00 and test a 625ZZ."),
    ("C-2", "coupon-c2-rod-fit", coupon_c2, "Round bore and D bore (5.35, flat 2.10) plus five pins 4.85 / 4.90 / 4.95 / 5.00 / 5.05 mm; pin length 18 / 21 / 24 / 27 / 30 mm gives the diameter. Finds the hole compensation."),
    ("C-3", "coupon-c3-magnet-pocket", coupon_c3, "Three boss pockets 3.15 / 3.25 / 3.35 mm, 1.4 mm deep, 0.6 mm floor, for the 3 x 1 mm magnet."),
    ("C-4", "coupon-c4-mount-joint", coupon_c4, "Plate with the 9.65 boss hole, two 3.55 screw holes, and two 4 x 4 column stubs with M3 pilot holes 2.5 (left) and 2.7 (right)."),
    ("C-5", "coupon-c5-column-socket", coupon_c5, "Block with two 3.30 mm square sockets 2.2 mm deep for the C-4 spigots."),
    ("C-6", "coupon-c6-clip-bend", coupon_c6, "Clip arm 1.2 x 6 x 16 mm with a 0.7 mm hook printed three ways: upright on a base, on its long edge, and flat."),
    ("C-7", "coupon-c7-dbore-bond", coupon_c7, "Hub stub 16 mm diameter, 20 mm tall with the D bore (5.35, flat 2.10) for the epoxy bond test on the real rod."),
]


# ----------------------------------------------------------------------------- files and checks
def welded_triangles(m, name):
    """Merge vertices that land on the same float32 position and drop the zero-area slivers that leaves."""
    mesh = m.to_mesh()
    verts = mesh.vert_properties[:, :3].astype(np.float32).astype(np.float64)
    keys = np.round(verts, 4)
    _, first, inverse = np.unique(keys, axis=0, return_index=True, return_inverse=True)
    inverse = inverse.reshape(-1)
    tri = inverse[mesh.tri_verts]
    keep = (tri[:, 0] != tri[:, 1]) & (tri[:, 1] != tri[:, 2]) & (tri[:, 0] != tri[:, 2])
    tri = tri[keep]
    edges = {}
    for a, b, c in tri.tolist():
        for e in ((a, b), (b, c), (c, a)):
            edges[e] = edges.get(e, 0) + 1
    if any(n != 1 or edges.get((e[1], e[0])) != 1 for e, n in edges.items()):
        raise SystemExit(f"{name}: not a closed, consistently oriented surface after welding")
    return verts[first][tri]


def write_stl(path, m, name):
    tris = welded_triangles(m, name)
    normals = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    lengths = np.linalg.norm(normals, axis=1)
    normals = np.where(lengths[:, None] > 0, normals / np.where(lengths[:, None] > 0, lengths[:, None], 1), 0)
    data = np.zeros(len(tris), dtype=[("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")])
    data["n"], data["v"] = normals, tris
    with open(path, "wb") as fh:
        fh.write(struct.pack("<80s", ("ASSUMED NOT_VALIDATED " + name).encode()[:80]))
        fh.write(struct.pack("<I", len(tris)))
        fh.write(data.tobytes())
    return len(tris)


def check(m, name):
    if m.status() != Error.NoError:
        raise SystemExit(f"{name}: mesh error {m.status()}")
    if m.volume() <= 0:
        raise SystemExit(f"{name}: non-positive volume")


def overhang_report(m, name):
    """Downward faces steeper than 45 degrees that are not on the bed: they need supports or a bridge."""
    t = welded_triangles(m, name)
    n = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
    area = np.linalg.norm(n, axis=1) / 2
    nz = n[:, 2] / np.where(area > 0, 2 * area, 1)
    bad = (nz < -0.7071) & (t[:, :, 2].max(axis=1) > 0.05)
    levels = {}
    for z, a in zip(np.round(t[bad][:, :, 2].mean(axis=1), 2), area[bad]):
        levels[float(z)] = levels.get(float(z), 0) + float(a)
    return {"area_mm2": round(float(area[bad].sum()), 1),
            "levels": [{"z_mm": z, "area_mm2": round(a, 1)} for z, a in sorted(levels.items()) if a > 0.5]}


def layer_report(m, layer):
    z = np.unique(np.round(m.to_mesh().vert_properties[:, 2].astype(np.float64), 3))
    out = []
    for v in z:
        steps = v / layer
        dev = abs(steps - round(steps)) * layer
        if dev > 0.011:
            out.append({"z_mm": float(v), "nearest_layer_mm": round(round(steps) * layer, 3), "deviation_mm": round(float(dev), 3)})
    return out


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


PART_NOTES = {
    "drum": {
        "settings": "0.4 mm nozzle, 0.2 mm layer, 4 walls, 5 top/bottom layers, about 30 % gyroid, 5 mm brim, no supports",
        "orientation": "Upright, deck undersides on the bed, hub pointing up",
        "coupons": ["C-2", "C-3", "C-6", "C-7"],
        "warnings": [
            "Eight clip arms are 1.2 mm thick and print upright, so they bend across layer lines; coupon C-6 decides whether to print them separately and flat (R17).",
            "Each hook overhangs 0.7 mm with nothing under it; expect a rough underside.",
            "The four decks are 1.0 mm thick plates up to 24 mm wide on the bed; use the brim and watch for warp (R8). Avoid ABS.",
            "The D bore keeps its flat at 2.10 from the axis; only the round part grows with the hole compensation.",
            "Zero rod play depends on the epoxy bond, not on the print (R13, coupon C-7).",
        ],
    },
    "housing-platform": {
        "settings": "0.4 mm nozzle, 0.2 mm layer, 4 walls, 5 top/bottom layers, about 30 % gyroid, no brim needed",
        "orientation": "Flipped: the top face (where the thrust ring lies) is on the bed, so it is the smooth first layer",
        "coupons": ["C-1", "C-5"],
        "warnings": [
            "The bearing seat is modelled 15.85 mm and must be reamed to 16.00 mm after printing (coupon C-1).",
            "Printed this way the bearing ledge (hole 12 mm to seat 15.85 mm) is a 1.9 mm wide overhang ring 5 mm above the bed; it may need local support or a clean bridge.",
            "The wall between the hall pocket and the tongue pocket is about 0.71 mm, below the proposed 0.8 mm minimum (C10, open).",
            "The wall between the bearing seat and the tongue pocket is about 0.7-0.9 mm (C4, open).",
            "The hall pocket is 4.0 x 3.0 x 3.0 mm with no wire exit; the exit is not designed yet (R18).",
            "The four outlet-chute wall boxes under the platform (z -12 to -3) are drawn in the viewer but are not in the print list, so they are NOT in this file.",
            "The platform plate is 6.70 mm thick, which is not a whole number of 0.20 mm layers; the slicer will round it by 0.1 mm.",
            "Two 2 x 13 mm cheeks hang 23 mm below the floor (z -26 to -3) to hold the tongue servo; printed flipped they stand up from the bed. The 14 x 14.5 mm opening for the servo crank arm is cut through the floor at the front.",
            "The servo seat is 23 mm between the cheeks for a 22.7 mm servo body; screw holes for the servo ears are NOT designed.",
        ],
    },
    "stepper-mount": {
        "settings": "0.4 mm nozzle, 0.2 mm layer, 4 walls (the 4 mm columns print nearly solid), 30-40 % infill, no supports",
        "orientation": "Plate flat on the bed, columns and spigots standing up",
        "coupons": ["C-4", "C-5"],
        "warnings": [
            "The M3 pilot hole wall is about 0.7 mm (R14); coupon C-4 chooses the pilot diameter between 2.5 and 2.7 mm.",
            "The two 4 x 4 x 24.4 mm columns are tall and slender; check rigidity and print them without a draft in the slicer.",
            "The screw heads and the motor boss clearance depend on the 9.65 and 3.55 mm holes (coupon C-4).",
        ],
    },
    "levelling-base": {
        "settings": "0.4 mm nozzle, 0.2 mm layer, 4 walls, 5 top/bottom layers, 30 % gyroid",
        "orientation": "Plate underside (z = -58) on the bed, the four posts standing up",
        "coupons": ["C-4"],
        "warnings": [
            "Three M5 hex-nut pockets open to the bed side: print them as 8.3 mm bridges and keep the nut flat; check the nut turns freely and cannot spin (coupon C-4 style fit test).",
            "The four 4 x 4 x 23 mm mount posts are slender; the M3 pilot hole leaves about 0.7 mm of wall (R14).",
            "The controller shelf (54.4 x 28 x 1.6 mm) is a bridge between four 4 x 4 x 28 mm posts; its underside is an unsupported span, so print it with supports or tune bridging.",
            "The plate is a round 144 mm disc, so a 150 mm bed is enough.",
            "A 3.6 mm wide, 2.5 mm deep ring groove holds the wall (0.3 mm clearance per side); a thin 3.5 mm floor remains under it. The fit is ASSUMED, so print a short test ring of the wall first.",
            "Layer-1 boards lie on the plate with 2 mm spacing; nothing fixes them (screw bosses are not designed).",
        ],
    },
    "cylindrical-shell-right": {
        "settings": "0.4 mm nozzle, 0.2 mm layer, 3 walls, 20 % infill, 5 mm brim",
        "orientation": "Sector stood on its lower edge (the z = -54.5 edge on the bed)",
        "coupons": [],
        "warnings": [
            "A 3 mm wall standing 117.5 mm tall and curved: expect wobble and layer-line weakness; use the brim and print slowly.",
            "The cup opening is 18 degrees wide (about 21 mm) and 16 mm tall (z -52 to -36), open to the bottom of the wall: print it as a bridge or add temporary supports.",
            "The pin-servo shelf (23 mm wide, 2 mm thick, cut to the inside of the wall) and its web carry the servo; check rigidity.",
            "Each sector has a 1 mm x 3 mm tongue on one edge and a matching 1.4 x 3.4 mm groove on the other (0.2 mm radial and 0.4 mm length clearance); the 0.8 mm skins either side of the groove are thin and may break. Fit is ASSUMED.",
        ],
    },
    "cylindrical-shell-back": {
        "settings": "0.4 mm nozzle, 0.2 mm layer, 3 walls, 20 % infill, 5 mm brim",
        "orientation": "Sector stood on its lower edge (the z = -54.5 edge on the bed)",
        "coupons": [],
        "warnings": [
            "3 mm curved wall, 117.5 mm tall; expect wobble and use the brim.",
            "Each sector has a 1 mm x 3 mm tongue on one edge and a matching 1.4 x 3.4 mm groove on the other (0.2 mm radial and 0.4 mm length clearance); the 0.8 mm skins either side of the groove are thin and may break. Fit is ASSUMED.",
        ],
    },
    "cylindrical-shell-left": {
        "settings": "0.4 mm nozzle, 0.2 mm layer, 3 walls, 20 % infill, 5 mm brim",
        "orientation": "Sector stood on its lower edge (the z = -54.5 edge on the bed)",
        "coupons": [],
        "warnings": [
            "3 mm curved wall, 117.5 mm tall; expect wobble and use the brim.",
            "Each sector has a 1 mm x 3 mm tongue on one edge and a matching 1.4 x 3.4 mm groove on the other (0.2 mm radial and 0.4 mm length clearance); the 0.8 mm skins either side of the groove are thin and may break. Fit is ASSUMED.",
        ],
    },
    "service-lid": {
        "settings": "0.4 mm nozzle, 0.2 mm layer, 3 walls, 20 % infill, 5 mm brim, no supports",
        "orientation": "Flipped: the top face is on the bed (smooth visible face), the 2 mm lip stands up",
        "coupons": [],
        "warnings": [
            "A 144 mm x 3 mm disc: expect warp at the edge; use the brim and avoid ABS.",
            "The engraved ring (1.2 mm wide, 0.8 mm deep) prints as a short bridge above the bed; it may sag.",
            "The 2 mm lip is a single-wall-pair rib standing 3 mm up: handle with care.",
            "It is held by gravity only: nothing stops it sliding off if the product is tipped (magnets or a bayonet are NOT designed).",
        ],
    },
    "pill-trough": {
        "settings": "0.4 mm nozzle, 0.2 mm layer, 3 walls, 20 % infill, no supports",
        "orientation": "Floor flat on the bed, side walls standing up (it is only tilted 15 degrees when assembled)",
        "coupons": [],
        "warnings": [
            "Pills sliding at 15 degrees is ASSUMED; the real friction of the printed floor is unknown (a smoother floor or a steeper slope may be needed).",
            "The high end rests on the chute walls and the low end on one 2 mm post from the base; screws or clips are NOT designed.",
            "It stays inside the wall and ends over the cup; the 1.5 mm walls are thin.",
        ],
    },
    "pill-cup": {
        "settings": "0.4 mm nozzle, 0.2 mm layer, 3 walls, 20 % infill, no supports",
        "orientation": "Floor on the bed, walls standing up",
        "coupons": [],
        "warnings": ["It stands on the plinth and slides out through the wall opening; it has no guide rails or stop yet, and nothing keeps it from sliding in too far."],
    },
    "rail-block": {
        "settings": "0.4 mm nozzle, 0.2 mm layer, 4 walls, 30 % gyroid, no supports",
        "orientation": "Foot plate on the bed, post and rails standing up",
        "coupons": [],
        "warnings": [
            "The two carriage rails are 1.6 mm wide and 24 mm long, cantilevered from the post: print them slowly and check that they do not sag.",
            "The foot plate sits on the platform top; its screw holes are NOT designed.",
        ],
    },
    "cartridge": {
        "settings": "0.4 mm nozzle, 0.2 mm layer, 3 walls, 20 % infill, no supports unless the bridge below sags",
        "orientation": "Upright, the guide-rail undersides (z = 5) on the bed",
        "coupons": ["C-1"],
        "warnings": [
            "With the rails on the bed, the tube underside is 1 mm above the bed and bridges the 10.8 mm gap between the rails; use a clean bridge or add supports.",
            "The catch ledges overhang 0.8 mm with nothing under them; chamfer if they sag.",
            "The spring lug underside is 1 mm above the bed (it overhangs the rail line) and the peg is 1.2 mm thick; print the peg slowly and check the loop fit.",
            "The bore is modelled 10.95 x 8.55 mm for a nominal 10.8 x 8.4 mm channel; the 1.925 mm walls are 4 to 5 perimeters.",
            "The colour tag is a 1.2 mm raised plate; change filament at that layer or paint it.",
        ],
    },
    "cap": {
        "settings": "0.4 mm nozzle, 0.2 mm layer, 3 walls, 20 % infill, no supports",
        "orientation": "Plate flat on the bed, knob up",
        "coupons": [],
        "warnings": [
            "ASSUMED to be its own print. The hinge and the latch are not designed, so this file is only the lid plate and its knob.",
            "The 14.8 x 12.4 mm plate matches the tube outside; with the real fit gap it may need trimming once the hinge exists.",
        ],
    },
    "slide-blade": {
        "settings": "0.4 mm nozzle, 0.2 mm layer, 3 walls, 100 % infill recommended, no supports",
        "orientation": "Flat on the bed, wedge nose and tab up",
        "coupons": [],
        "warnings": [
            "The blade is 1.0 mm thick and slides in a 1.0 mm channel: the fit needs a test print, and elephant foot on the first layer will make it thicker.",
            "The wedge nose is 0.3 mm thick at the tip, thinner than one 0.4 mm line or the 0.2 mm layer step; it will print as stair steps and rounded.",
            "The outer 2 mm of the tab (where the spring peg stands) overhangs the blade with nothing under it; use a bridge or local support.",
            "The tab slot is 5 x 4 mm; the pin is 3 mm, so no hole compensation is applied.",
        ],
    },
}

PARTS = [
    ("drum", "Drum", "one", 1, build_drum),
    ("housing-platform", "Housing platform", "one", 1, build_platform),
    ("stepper-mount", "Stepper mount", "one", 1, build_mount),
    ("levelling-base", "Levelling base", "one", 1, build_base),
    ("cylindrical-shell-right", "Cylindrical shell, right sector", "one", 1, lambda g, P: build_shell(g, P, 0)),
    ("cylindrical-shell-back", "Cylindrical shell, back sector", "one", 1, lambda g, P: build_shell(g, P, 1)),
    ("cylindrical-shell-left", "Cylindrical shell, left sector", "one", 1, lambda g, P: build_shell(g, P, 2)),
    ("service-lid", "Service lid", "one", 1, build_lid),
    ("pill-trough", "Pill trough", "one", 1, build_trough),
    ("pill-cup", "Pill cup", "one", 1, build_cup),
    ("rail-block", "Pin rail block", "one", 1, build_rail),
    ("cartridge", "Cartridge", "separate", 4, build_cartridge),
    ("cap", "Cap", "separate", 4, build_cap),
    ("slide-blade", "Slide blade", "separate", 4, build_blade),
]


def compensation_table(g, P):
    hc = P["hole_comp_mm"]
    return {
        "drum": [
            {"feature": "D bore round part", "nominal_mm": 5.2, "model_mm": round(5.2 + hc, 3), "rule": "nominal + hole compensation", "check": "pin gauge or rod (coupon C-2)"},
            {"feature": "D bore flat from axis", "nominal_mm": 2.1, "model_mm": 2.1, "rule": "unchanged", "check": "caliper on the rod flat"},
            {"feature": "Deck channel X / Y", "nominal_mm": "10.8 / 8.4", "model_mm": f"{10.8 + hc:.2f} / {8.4 + hc:.2f}", "rule": "nominal + hole compensation", "check": "caliper, fit the cartridge"},
            {"feature": "Magnet pocket diameter", "nominal_mm": 3.1, "model_mm": round(3.1 + hc, 3), "rule": "nominal + hole compensation", "check": "3 x 1 magnet (coupon C-3)"},
            {"feature": "Hub height", "nominal_mm": 42.0, "model_mm": 42.0, "rule": "whole layers (210)", "check": "caliper"},
        ],
        "housing-platform": [
            {"feature": "Bearing seat diameter", "nominal_mm": 16.0, "model_mm": P["seat_model_mm"], "rule": "undersize, ream to 16.00 after printing", "check": "625ZZ press fit (coupon C-1)"},
            {"feature": "Column socket", "nominal_mm": 3.3, "model_mm": 3.3, "rule": "already 0.15 mm per side over the 3.0 spigot", "check": "spigot enters by hand (coupon C-5)"},
            {"feature": "Hall pocket", "nominal_mm": "4.0 x 3.0 x 3.0", "model_mm": "4.0 x 3.0 x 3.0", "rule": "unchanged; measure the real sensor first", "check": "caliper on the sensor"},
        ],
        "stepper-mount": [
            {"feature": "Boss hole diameter", "nominal_mm": 9.5, "model_mm": round(9.5 + hc, 3), "rule": "nominal + hole compensation", "check": "motor boss fits without wobble (coupon C-4)"},
            {"feature": "Screw holes", "nominal_mm": 3.4, "model_mm": round(3.4 + hc, 3), "rule": "nominal + hole compensation", "check": "M3 screw passes (coupon C-4)"},
            {"feature": "M3 pilot hole", "nominal_mm": 2.6, "model_mm": 2.6, "rule": "unchanged; coupon C-4 chooses 2.5 to 2.7", "check": "M3 x 12 bites 9.4 mm without splitting"},
        ],
        "levelling-base": [
            {"feature": "Foot bolt hole", "nominal_mm": 5.3, "model_mm": 5.3, "rule": "already 0.3 mm loose over the M5 thread", "check": "M5 bolt turns in the nut without binding"},
            {"feature": "Nut pocket across flats", "nominal_mm": 8.0, "model_mm": g["foot_nut_af"], "rule": "nut AF + 0.3 mm", "check": "nut drops in and cannot spin"},
            {"feature": "Post pilot hole", "nominal_mm": 2.6, "model_mm": 2.6, "rule": "unchanged; coupon C-4 chooses 2.5 to 2.7", "check": "M3 x 10 bites 8.4 mm without splitting"},
        ],
        "cartridge": [
            {"feature": "Bore X / Y", "nominal_mm": "10.8 / 8.4", "model_mm": f"{10.8 + hc:.2f} / {8.4 + hc:.2f}", "rule": "nominal + hole compensation", "check": "pill gauge, caliper"},
            {"feature": "Spring peg diameter", "nominal_mm": 1.2, "model_mm": 1.2, "rule": "unchanged; pegs print slightly large", "check": "spring eye drops over it"},
        ],
        "slide-blade": [
            {"feature": "Thickness", "nominal_mm": 1.0, "model_mm": 1.0, "rule": "five layers; elephant foot adds to the first one", "check": "caliper, slides in the 1.0 mm channel"},
        ],
    }


def main():
    spec = load_spec()
    g, P = spec["g"], load_profile(spec)
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.stl"):
        old.unlink()
    comp = compensation_table(g, P)
    manifest = {
        "title": "Feature 005 printed parts (rotation subsystem and the first compartments)",
        "status": "ASSUMED / NOT_VALIDATED",
        "print_ready": False,
        "fabricable_as_designed": False,
        "units": "mm, right-handed, z up, bed at z = 0, STL binary",
        "disclosure": "Nothing was printed, measured or fitted. The files carry the hole compensation below as a starting guess. Print the coupons first, fix scripts/print_profile.json from what you measure, then run scripts/export_print_files.py again.",
        "profile": P,
        "parts": [],
        "coupons": [],
    }
    for key, label, mode, qty, builder in PARTS:
        m = finish(builder(g, P))
        check(m, key)
        if P["xy_scale"] != 1.0:
            m = m.scale((P["xy_scale"], P["xy_scale"], 1.0))
        fname = f"{key}.stl"
        write_stl(OUT / fname, m, label)
        x0, y0, z0, x1, y1, z1 = m.bounding_box()
        notes = PART_NOTES[key]
        oh = overhang_report(m, key)
        base = re.sub(r",? no supports[^,;]*", "", notes["settings"])
        supports = ("none: no downward face steeper than 45 degrees off the bed" if oh["area_mm2"] < 1 else
                    f"needed, or tune bridging: {oh['area_mm2']} mm2 of downward faces off the bed at z = "
                    + ", ".join(f"{lv['z_mm']}" for lv in oh["levels"]) + " mm")
        manifest["parts"].append({
            "id": key, "label": label, "file": fname, "mode": mode, "quantity": qty, "material": P["material"],
            "orientation": notes["orientation"], "settings": base, "supports": supports, "overhangs": oh,
            "size_mm": [round(x1 - x0, 3), round(y1 - y0, 3), round(z1 - z0, 3)],
            "volume_mm3": round(m.volume(), 1), "triangles": m.num_tri(), "bodies": len(m.decompose()),
            "sha256": digest(OUT / fname), "features": comp.get(key, []),
            "z_levels_off_layer_grid": layer_report(m, P["layer_mm"]),
            "coupons": notes["coupons"], "warnings": notes["warnings"],
        })
        print(f"{fname:24s} {x1 - x0:7.2f} x {y1 - y0:7.2f} x {z1 - z0:6.2f} mm  {m.volume():10.1f} mm3  bodies {len(m.decompose())}")
    for cid, key, builder, text in COUPONS:
        m = finish(builder(g, P))
        check(m, key)
        m = min_corner_to_origin(m)
        fname = f"{key}.stl"
        write_stl(OUT / fname, m, key)
        x0, y0, z0, x1, y1, z1 = m.bounding_box()
        manifest["coupons"].append({"id": cid, "file": fname, "what": text, "size_mm": [round(x1 - x0, 2), round(y1 - y0, 2), round(z1 - z0, 2)], "sha256": digest(OUT / fname)})
        print(f"{fname:34s} {x1 - x0:7.2f} x {y1 - y0:7.2f} x {z1 - z0:6.2f} mm")
    (OUT / "print-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    zip_path = OUT / "smart-dispenser-print-files.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(OUT.glob("*.stl")) + [OUT / "print-manifest.json"]:
            zf.write(f, f.name)
    print("wrote", zip_path.relative_to(ROOT))


if __name__ == "__main__":
    sys.exit(main())
