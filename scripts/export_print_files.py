#!/usr/bin/env python3
"""Build printable STL files for the Feature 005 printed parts (flask housing design) and the calibration coupons.

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
from manifold3d import CrossSection, Error, FillRule, JoinType, Manifold

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
        "blade_clear_mm": 0.1,
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



# ----------------------------------------------------------------------------- drum
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


def revolve_um(pts_mm, a0, a1):
    """Revolve an (r, z) polygon given in mm about the z axis from angle a0 to a1 (degrees); result is in micrometres."""
    cs = CrossSection([np.round(np.array(pts_mm, dtype=float) * U, 4)], FillRule.EvenOdd)
    m = Manifold.revolve(cs, 2 * SEG, float(a1 - a0))
    return m.rotate((0, 0, float(a0)))


def band_profile(outer, k0, k1):
    """Closed (r, z) polygon between the flask outline offset inwards by k0 and by k1 (k0 < k1), following the outline."""
    return [(r - k0, z) for r, z in outer] + [(r - k1, z) for r, z in reversed(outer)]


def rot_z(deg, x, y):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return x * c - y * s, x * s + y * c


def flip_on_bed(m, top):
    """Turn a part over (rotate 180 degrees about y) so the face at z = top lies on the bed."""
    return tr(m.rotate((0, 180, 0)), 0, 0, top)


# ----------------------------------------------------------------------------- parts
def build_platform(g, P):
    """Housing deck: three layers, bearing seat, column sockets, chute walls and the S2 servo posts."""
    hc, cy = P["hole_comp_mm"], g["axle"][1]
    layers = []
    for ly in g["deck_layers"]:
        layer = cyl(0, cy, ly["z0"], ly["z1"], g["platform_r"])
        for h in ly["holes"]:
            layer = layer - box(h[0], h[1], h[2], h[3], ly["z0"] - 1, ly["z1"] + 1)
        for a in g.get("ring", {}).get("arc_slots", []):
            ro, ri, a0, a1 = a["r"] + a["w"] / 2, a["r"] - a["w"] / 2, math.radians(a["a0"]), math.radians(a["a1"])
            steps = max(4, int((a1 - a0) / math.radians(2)))
            outer = [(ro * math.cos(a0 + (a1 - a0) * k / steps), cy + ro * math.sin(a0 + (a1 - a0) * k / steps)) for k in range(steps + 1)]
            inner = [(ri * math.cos(a1 + (a0 - a1) * k / steps), cy + ri * math.sin(a1 + (a0 - a1) * k / steps)) for k in range(steps + 1)]
            layer = layer - prism([outer + inner], ly["z0"] - 1, ly["z1"] + 1)
        layers.append(layer)
    body = union(layers)
    body = body - cyl(0, cy, g["bearing_z0"], g["platform_top"] + 1, P["seat_model_mm"] / 2)      # bearing seat (reamed to 16.00 later)
    body = body - cyl(0, cy, -4, g["bearing_z0"] + 0.5, 6.0 + hc / 2)                            # shield / rod clearance under the seat
    my = cy + g["motor_offset_y"]
    for sx in (-1, 1):
        s = g["socket_half"]
        body = body - box(sx * g["column_x"] - s, sx * g["column_x"] + s, my - s, my + s, -4, g["socket_z1"])
    C, th = g["chute"], g["chute"]["t"]
    for b in ([C["x"][0] - th, C["x"][1] + th, C["y"][0] - th, C["y"][0]], [C["x"][0] - th, C["x"][1] + th, C["y"][1], C["y"][1] + th],
              [C["x"][0] - th, C["x"][0], C["y"][0], C["y"][1]], [C["x"][1], C["x"][1] + th, C["y"][0], C["y"][1]]):
        body = body + box(b[0], b[1], b[2], b[3], C["z0"], C["z1"] + 0.1)                         # 0.1 mm into the deck so it fuses
    A2, SV = g["act"]["s2"], g["act"]["servo"]
    ang = math.atan2(A2["body_dir"][1], A2["body_dir"][0])
    ztop = A2["body_z0"] + SV["h"]
    for xl in (-SV["shaft_off"] - SV["ear"] / 2, SV["len"] - SV["shaft_off"] + SV["ear"] / 2):
        wx, wy = A2["pivot"][0] + xl * math.cos(ang), A2["pivot"][1] + xl * math.sin(ang) + cy
        body = body + cyl(wx, wy, ztop, -3.0 + 0.1, A2["post_r"])
    return min_corner_to_origin(flip_on_bed(body, g["platform_top"]))


def build_mount(g, P):
    hc = P["hole_comp_mm"]
    my = g["axle"][1] + g["motor_offset_y"]
    z0, z1 = g["plate_z0"], g["plate_z1"]
    plate = box(-g["plate_x"], g["plate_x"], g["plate_y0"], g["plate_y1"], z0, z1)
    plate = plate - cyl(g["axle"][0], g["axle"][1], z0 - 1, z1 + 1, (2 * g["boss_hole_r"] + hc) / 2)
    parts = [plate]
    for sx in (-1, 1):
        x = sx * g["column_x"]
        parts.append(box(x - g["column_half"], x + g["column_half"], my - g["column_half"], my + g["column_half"], z1, g["column_z1"]))
        parts.append(box(x - g["spigot_half"], x + g["spigot_half"], my - g["spigot_half"], my + g["spigot_half"], g["column_z1"], g["spigot_z1"]))
    body = union(parts)
    for sx in (-1, 1):
        x = sx * g["column_x"]
        body = body - cyl(x, my, z0 - 1, z1, (3.4 + hc) / 2)                          # screw hole through the plate
        body = body - cyl(x, my, z1 - 0.5, g["m3_z1"] + 1.0, 2.6 / 2)                  # M3 pilot hole, ends 1 mm above the screw tip
    return min_corner_to_origin(body)


def build_base(g, P):
    """Base tray: chamfered disc, ridge (notched at the bosses), standoffs, platform posts, jack saddle, foot sockets, screw holes."""
    hc, cy = P["hole_comp_mm"], g["axle"][1]
    z0, z1, R, c = g["base_z0"], g["base_z1"], g["base_r"], g["base_chamfer"]
    disc = tr(revolve_um([(0, z0), (R - c, z0), (R, z0 + c), (R, z1), (0, z1)], 0, 360), 0, cy, 0)
    parts = [disc]
    BS = g["base_screws"]
    ridge = cyl(0, cy, z1, z1 + g["base_ridge"][2], g["base_ridge"][1]) - cyl(0, cy, z1 - 1, z1 + g["base_ridge"][2] + 1, g["base_ridge"][0])
    for a in BS["angles"]:  # the wall's screw bosses stand where the ridge would be: notch it with 0.4 mm of clearance
        ridge = ridge - cyl(BS["r"] * math.cos(math.radians(a)), cy + BS["r"] * math.sin(math.radians(a)), z1 - 1, z1 + 10, BS["boss_r"] + 0.4)
    parts.append(ridge)
    for name, b in g["bay_modules"].items():  # four standoffs under every board
        d = g["standoff_inset"]
        for x, y in ((b[0] + d, b[2] + d), (b[1] - d, b[2] + d), (b[0] + d, b[3] - d), (b[1] - d, b[3] - d)):
            parts.append(cyl(x, y, z1, g["bay_z0"], g["standoff_r"]))
    PP = g["platform_posts"]
    for a in PP["angles"]:
        parts.append(cyl(PP["r"] * math.cos(math.radians(a)), cy + PP["r"] * math.sin(math.radians(a)), z1, -3.0, PP["rad"]))
    JK = g["jack"]
    parts.append(box(JK["xy"][0] - JK["w"] / 2, JK["xy"][0] + JK["w"] / 2, JK["xy"][1] - JK["d"] / 2, JK["xy"][1] + JK["d"] / 2, z1, JK["z0"]))
    body = union(parts)
    FH = g["floor_hole"]
    body = body - box(FH["x"][0], FH["x"][1], FH["y"][0], FH["y"][1], z0 - 1, z1 + 1)
    F = g["feet"]
    for a in F["angles"]:  # sockets for the separately printed feet, open to the bed side
        body = body - cyl(F["r"] * math.cos(math.radians(a)), cy + F["r"] * math.sin(math.radians(a)), z0 - 1, z0 + F["socket_h"], F["spigot_r"] + 0.15)
    for a in BS["angles"]:
        bx, by = BS["r"] * math.cos(math.radians(a)), cy + BS["r"] * math.sin(math.radians(a))
        body = body - cyl(bx, by, z0 - 1, z1 + 1, (3.4 + hc) / 2)                      # M3 clearance hole through the tray
        body = body - cyl(bx, by, z0 - 1, z0 + 2.2, (2 * BS["head_r"] + 0.5) / 2)       # recess for the 2 mm screw head
    return min_corner_to_origin(body)


def build_foot(g, P):
    F = g["feet"]
    return min_corner_to_origin(cyl(0, 0, 0, F["h"], F["rad"]) + cyl(0, 0, F["h"] - 0.1, F["h"] + F["spigot_h"], F["spigot_r"]))


def build_shell(g, P, sector):
    cy = g["axle"][1]
    a0, a1 = g["shell_sectors"][sector]
    outer, WT = g["housing_outer"], g["shell_r1"] - g["shell_r0"]
    body = revolve_um(band_profile(outer, 0, WT), a0, a1)
    lg = g["ledge"]  # deck ledge, chamfered under (about 40 degrees from vertical) so it prints without support
    r0, r1 = lg[0], lg[1] + 0.3
    z_top, z_bot = lg[3], lg[2]
    body = body + revolve_um([(r0, z_top), (r1, z_top), (r1, z_bot), (lg[1], z_bot), (r0, z_bot + 2.4)], a0, a1)
    jt = g["shell_joint"]  # tongue on the a0 edge (1 mm thick, mid wall), matching groove on the a1 edge
    mid = (g["shell_r0"] + g["shell_r1"]) / 2
    tongue_deg = math.degrees(jt["tongue_len"] / mid)
    groove_deg = math.degrees(jt["groove_len"] / mid)
    body = body + revolve_um(band_profile(outer, 1.0, 2.0), a0 - tongue_deg, a0 + 1.0)
    body = body - revolve_um(band_profile(outer, 0.8, 2.2), a1 - groove_deg, a1 + 1.0)
    BS = g["base_screws"]
    for a in BS["angles"]:
        if a0 <= a <= a1:
            bx, by = BS["r"] * math.cos(math.radians(a)), BS["r"] * math.sin(math.radians(a))
            body = body + cyl(bx, by, g["shell_z0"], BS["boss_z1"], BS["boss_r"])
    for a in BS["angles"]:
        if a0 <= a <= a1:
            bx, by = BS["r"] * math.cos(math.radians(a)), BS["r"] * math.sin(math.radians(a))
            body = body - cyl(bx, by, g["shell_z0"] - 1, g["shell_z0"] + 6.0, BS["pilot_r"])  # M3 pilot hole, 6 mm deep
    for w in g["shell_windows"]:
        if a0 <= w["a"] <= a1:
            body = body - revolve_um([(30, w["z0"]), (60, w["z0"]), (60, w["z1"]), (30, w["z1"])], w["a"] - w["half"], w["a"] + w["half"])
    return min_corner_to_origin(tr(body, 0, cy, 0))


def build_lid(g, P):
    """Printed top face down so the visible face is the smooth first layer; the engraved ring is then a bridged pocket."""
    L, cy = g["lid"], g["axle"][1]
    body = cyl(0, cy, L["z0"], L["z1"], L["r"])
    body = body + (cyl(0, cy, L["lip_z0"], L["z0"] + 0.5, L["lip_r1"]) - cyl(0, cy, L["lip_z0"] - 1, L["z0"] + 1, L["lip_r0"]))
    body = body - (cyl(0, cy, L["z1"] - L["groove_depth"], L["z1"] + 1, L["groove_r1"]) - cyl(0, cy, L["z1"] - 2, L["z1"] + 2, L["groove_r0"]))
    return min_corner_to_origin(flip_on_bed(body, L["z1"]))


def build_bracket(g, P):
    """Servo bracket in its own frame (x along the servo body, origin on the horn shaft): plate with a shaft hole and two legs."""
    hc = P["hole_comp_mm"]
    SV, A1 = g["act"]["servo"], g["act"]["s1"]
    th = math.atan2(A1["body_dir"][1], A1["body_dir"][0])
    t = A1["plate_z"][1] - A1["plate_z"][0]
    height = A1["plate_z"][0] - g["platform_top"]
    hw = SV["w"] / 2
    leg_pts = []
    for q in A1["legs"]:  # the legs are world-aligned squares in the viewer; express their corners in the bracket frame
        h = A1["leg"] / 2
        leg_pts.append([(q[0] + rot_z(-math.degrees(th), sx * h, sy * h)[0], q[1] + rot_z(-math.degrees(th), sx * h, sy * h)[1]) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    x0 = min(-SV["shaft_off"] - 0.5, min(p[0] for L in leg_pts for p in L))
    x1 = max(SV["len"] - SV["shaft_off"] + 0.5, max(p[0] for L in leg_pts for p in L))
    y0, y1 = min(-hw, min(p[1] for L in leg_pts for p in L)), max(hw, max(p[1] for L in leg_pts for p in L))
    body = box(x0, x1, y0, y1, 0, t)
    for L in leg_pts:
        body = body + prism([L], -height, 0.5)
    body = body - cyl(0, 0, -1, t + 1, 3.0 + hc / 2)                                                   # horn shaft passes through
    return min_corner_to_origin(tr(body.rotate((0, 180, 0)), 0, 0, t))                                  # plate top face on the bed, legs up


def lever(g, P, cfg, h, hole=None, crank=None):
    """Lever with the horn bore at the pivot, arm to the pin point, optional pin guide hole or integral crank pin."""
    hc = P["hole_comp_mm"]
    dx, dy = cfg["pin_parked"][0] - cfg["pivot"][0], cfg["pin_parked"][1] - cfg["pivot"][1]
    length = math.hypot(dx, dy)
    hw, tip = 2.5, 2.5
    body = box(-hw, length + tip, -hw, hw, 0, h) + cyl(0, 0, 0, h, 3.8)
    body = body - cyl(0, 0, -1, h + 1, (5.0 + hc) / 2)                                                  # bore for the 5 mm output shaft (spline not modelled)
    if hole:
        body = body - cyl(length, 0, -1, h + 1, hole / 2)
    if crank:
        body = body + cyl(length, 0, 0, crank["h"], crank["r"])
    return min_corner_to_origin(body)


def build_pin_lever(g, P):
    A1 = g["act"]["s1"]
    return lever(g, P, A1, A1["lever_z"][1] - A1["lever_z"][0], hole=A1["pin"]["rod_r"] * 2 + 0.4 + P["hole_comp_mm"])


def build_tongue_lever(g, P):
    A2 = g["act"]["s2"]
    return lever(g, P, A2, A2["lever_z"][1] - A2["lever_z"][0], crank={"r": 1.5, "h": 5.2})


def build_tongue(g, P):
    sh = [(-7, -24), (7, -24), (7, -1), (6, 0), (-6, 0), (-7, -1)]
    A = g["act"]
    ty, sh_half = A["tongue_slot_y"], A["s2"]["slot_half"]
    plate = prism([sh], 0, 1.5) - box(-sh_half, sh_half, ty - 1.8, ty + 1.8, -1, 2.5)
    return min_corner_to_origin(plate)


def lever_pin_at(cfg, v_target):
    """Port of the viewer's leverAt(): pin position when the lever tip is at v_target (axle-relative y)."""
    px, py = cfg["pivot"]
    ax, ay = cfg["pin_parked"]
    a0 = math.atan2(ay - py, ax - px)
    sn = max(-1.0, min(1.0, (v_target - py) / cfg["arm1"]))
    c1 = math.asin(sn)
    c2 = math.pi - c1
    wrap = lambda a: math.atan2(math.sin(a), math.cos(a))
    p1, p2 = wrap(c1 - a0), wrap(c2 - a0)
    phi = p1 if abs(p1) <= abs(p2) else p2
    return px + cfg["arm1"] * math.cos(a0 + phi), py + cfg["arm1"] * math.sin(a0 + phi)


def build_cam(g, P):
    """Pin cam: square foot on the deck, post, holding arm and release ramp. Printed upright on the foot."""
    cy = g["axle"][1]
    A1 = g["act"]["s1"]
    C, pin = A1["cam"], A1["pin"]
    E = (A1["pin_parked"][0], A1["pin_parked"][1] + cy)
    Rx, Ry = lever_pin_at(A1, A1["pin_parked"][1] + A1["release"])
    R = (Rx, Ry + cy)
    py = C["post_v"] + cy
    top = g["platform_top"]
    body = box(E[0] - C["hw"], E[0] + C["hw"], py - C["post_r"], py + C["post_r"], top, C["z0"] + C["t"])
    body = body + box(E[0] - C["flange"], E[0] + C["flange"], py - C["flange"], py + C["flange"], top, top + C["flange_t"])
    body = body + box(E[0] - C["hw"], E[0] + C["hw"], py - C["post_r"], E[1], C["z0"], C["z0"] + C["t"])
    d = (R[0] - E[0], R[1] - E[1])
    L = math.hypot(*d)
    Lr, rt = L - pin["head_r"], C["ramp_top"]
    prof = [(0, C["z0"]), (Lr, rt), (Lr + 0.6, rt), (Lr + 0.6, rt + C["t"]), (Lr, rt + C["t"]), (0, C["z0"] + C["t"])]
    ramp = CrossSection([np.round(np.array(prof, dtype=float) * U, 4)], FillRule.EvenOdd).extrude(_i(2 * C["hw"]))
    ramp = ramp.rotate((90, 0, 0)).translate((0, _i(C["hw"]), 0))                                      # profile in x-z, width along y
    ramp = ramp.rotate((0, 0, math.degrees(math.atan2(d[1], d[0]))))
    body = body + tr(ramp, E[0], E[1], 0)
    return min_corner_to_origin(tr(body, 0, 0, -top))


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
    c = P["blade_clear_mm"]   # the 1.0 mm channel has no nominal clearance: the blade is printed thinner by c on each face
    lo, hi = 5.0 + c, 6.0 - c
    prof = [(0, lo), (0, 5.3 + c), (2.6, hi), (22.0, hi), (22.0, lo)]                  # (length from the tip, z)
    sheet = CrossSection([np.array(prof, dtype=float) * U], FillRule.EvenOdd).extrude(10.5 * U)
    plate = sheet.transform(np.array([[0, 0, -1, 5.25 * U], [-1, 0, 0, 0], [0, 1, 0, 0]], dtype=float))         # width along x, length along -y
    tab = box(-4.5, 4.5, -24.0, -16.0, hi, hi + 2.5) - box(-2.5, 2.5, -22.0, -18.0, hi - 0.1, hi + 2.6)
    body = plate + tab + peg(g["spring_x"], g["peg_blade_y"], hi + 2.5, g)
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



def thin_report(m, nozzle):
    """Slice every 0.5 mm and find material thinner than 1.8 nozzle widths (morphological opening, mitred offset)."""
    nozzle = 0.9 * nozzle
    x0, y0, z0, x1, y1, z1 = m.bounding_box()
    worst, count, z = (0.0, None), 0, z0 + 0.07
    while z < z1:
        cs = m.slice(z)
        if not cs.is_empty():
            lost = cs.area() - cs.offset(-nozzle, JoinType.Miter, 10.0, 0).offset(nozzle, JoinType.Miter, 10.0, 0).area()
            if lost > 0.3:
                count += 1
                if lost > worst[0]:
                    worst = (lost, z - z0)
        z += 0.5
    return {"min_feature_mm": round(2 * nozzle, 2), "slices_with_thinner_material": count,
            "worst_area_mm2": round(worst[0], 2), "worst_height_mm": None if worst[1] is None else round(worst[1], 2)}


def interface_table(g, P):
    """Clearances between mating parts, from the same numbers the parts are built from."""
    hc, A = P["hole_comp_mm"], g["act"]
    ch = g["deck_layers"][1]["holes"][0]
    rows = []

    def add(parts, feature, modelled, as_printed=None, need=0.1):
        ap = modelled if as_printed is None else as_printed
        rows.append({"parts": parts, "feature": feature, "modelled_mm": round(modelled, 3), "as_printed_mm": round(ap, 3), "needed_min_mm": need, "ok": ap >= need - 1e-9})

    add("tongue gate / deck channel", "width (total play, 14.5 vs 14.0)", (ch[1] - ch[0]) - 14.0, (ch[1] - ch[0]) - 14.0 - hc)
    add("tongue gate / deck channel", "thickness (total play, 1.8 vs 1.5)", (g["deck_layers"][1]["z1"] - g["deck_layers"][1]["z0"]) - 1.5)
    add("tongue lever crank pin / gate slot", "slot width minus pin diameter", 3.6 - 3.0, 3.6 - 3.0 - hc)
    add("engagement pin / pin lever hole", "hole minus rod diameter", (2 * A["s1"]["pin"]["rod_r"] + 0.4 + hc) - 2 * A["s1"]["pin"]["rod_r"], (2 * A["s1"]["pin"]["rod_r"] + 0.4) - 2 * A["s1"]["pin"]["rod_r"])
    add("slide blade / cartridge channel", "channel 1.0 minus blade thickness", 1.0 - (1.0 - 2 * P["blade_clear_mm"]), need=0.15)
    add("slide blade / guide rails", "rail gap 10.8 minus blade width 10.5", 10.8 - 10.5, 10.8 - 10.5 - hc, 0.1)
    jt = g["shell_joint"]
    add("shell tongue / groove", "radial play (1.4 vs 1.0)", (jt["groove_r1"] - jt["groove_r0"]) - (jt["tongue_r1"] - jt["tongue_r0"]), need=0.2)
    add("shell tongue / groove", "length play (3.4 vs 3.0)", jt["groove_len"] - jt["tongue_len"], need=0.2)
    add("housing deck / shell wall", "radial gap, deck radius 47.8 in wall radius 48.0", 2 * (g["shell_r0"] - g["platform_r"]), need=0.2)
    add("tray ridge / shell wall", "radial gap, ridge 47.7 in wall 48.0", 2 * (g["shell_r0"] - g["base_ridge"][1]), need=0.2)
    add("service lid lip / shell neck", "radial gap, lip 38.6 in neck bore 39.0", 2 * ((g["housing_outer"][-1][0] - (g["shell_r1"] - g["shell_r0"])) - g["lid"]["lip_r1"]), need=0.2)
    add("mount spigot / deck socket", "play across the 3.3 socket and 3.0 spigot", 2 * (g["socket_half"] - g["spigot_half"]), 2 * (g["socket_half"] - g["spigot_half"]) - hc, 0.1)
    add("tray foot spigot / tray socket", "play across the 4.3 socket and 4.0 spigot", 0.3, 0.3 - hc, 0.1)
    add("pin lever bore / servo shaft", "bore 5.15 minus shaft 5.0 (spline not modelled)", hc, 0.0, 0.0)
    add("hall pocket / A3144 body", "pocket 4.4 x 3.4 minus body 4.0 x 3.0", min(4.4 - 4.0, 3.4 - 3.0), min(4.4 - 4.0, 3.4 - 3.0) - hc, 0.1)
    return rows


def bed_fit(size):
    dx, dy, dz = size
    for bed in (100, 120, 150, 180, 220, 256):
        if max(dx, dy) <= bed - 4:
            return bed
    return None


DENSITY = {"PLA": 1.24, "PETG": 1.27, "ABS": 1.04, "ASA": 1.07}


FLAT = "0.4 mm nozzle, 0.2 mm layer, 4 walls, 5 top/bottom layers, about 30 % gyroid"
THIN = "0.4 mm nozzle, 0.2 mm layer, 3 walls, 20 % infill"

PART_NOTES = {
    "drum": {
        "settings": FLAT + ", 5 mm brim, no supports",
        "orientation": "Upright, deck undersides on the bed, hub pointing up",
        "coupons": ["C-2", "C-3", "C-6", "C-7"],
        "warnings": [
            "Eight clip arms are 1.2 mm thick and print upright, so they bend across layer lines; coupon C-6 decides whether to print them separately and flat (R17).",
            "Each hook overhangs 0.7 mm with nothing under it; expect a rough underside.",
            "The four decks are 1.0 mm thick plates up to 24 mm wide on the bed; use the brim and watch for warp (R8). Avoid ABS.",
            "The D bore keeps its flat at 2.10 from the axis; only the round part grows with the hole compensation.",
            "Zero rod play depends on the epoxy bond, not on the print (R13, coupon C-7).",
            "The magnet boss is 4.4 mm round around a 3.25 mm pocket, so its wall is only 0.58 mm (below 0.8 mm). It cannot be thicker: it would touch the cartridge guide rail (0.05 mm clearance test). Print slowly or move the magnet and the hall sensor outwards.",
        ],
    },
    "housing-platform": {
        "settings": FLAT + ", 5 mm brim, supports off (the listed bridges are short)",
        "orientation": "Turned over: the top face (where the thrust ring lies) is on the bed; the chute walls and the two servo posts stand up",
        "coupons": ["C-1", "C-5"],
        "warnings": [
            "The bearing seat is modelled 15.85 mm and must be reamed to 16.00 mm after printing (coupon C-1).",
            "The tongue channel is a closed 1.8 mm slot, so its ceiling is a bridge about 14.5 mm wide (z 5.35 mm in this orientation); tune bridging or the gate will rub. This is inherent to a closed slot.",
            "The bearing ledge (12 mm hole stepping to the 15.85 mm seat) is a 1.9 mm wide ring 5 mm above the bed: a short bridge.",
            "The four chute walls are 1.2 mm thick and 35 mm tall; they print as thin vertical walls (about 3 perimeters). Print slowly; the wall is thinner than the 1.6 mm needed for 4 perimeters.",
            "The two S2 servo posts are 3.2 mm round and 2.8 mm tall; they carry the servo through glue or a screw that is NOT designed.",
            "The wall between the hall pocket and the tongue channel is about 0.7 mm, below the proposed 0.8 mm minimum (C10, open); the wall between the bearing seat and the channel is about 0.9 mm.",
            "The platform is 6.70 mm thick, which is not a whole number of 0.20 mm layers; the slicer rounds it by 0.1 mm. The 0.15 and -1.65 steps of the deck layers fall between layers; the tongue channel height (1.8 mm) therefore prints as 1.8 or 2.0 mm depending on the slicer.",
            "It sits on a 2 mm ledge of each shell sector with 0.2 mm radial play; it is held by gravity and the three posts, not by screws.",
            "Screw holes for the servo ears are NOT designed.",
        ],
    },
    "stepper-mount": {
        "settings": FLAT.replace("4 walls", "4 walls (the 4 mm columns print nearly solid)").replace("about 30 % gyroid", "30-40 % infill") + ", no supports",
        "orientation": "Plate flat on the bed, columns and spigots standing up",
        "coupons": ["C-4", "C-5"],
        "warnings": [
            "The M3 pilot hole leaves a wall of about 0.7 mm (R14); coupon C-4 chooses the pilot diameter between 2.5 and 2.7 mm.",
            "The two 4 x 4 x 12 mm columns are slender; check rigidity.",
            "The boss hole (9.65 mm) and the 3.55 mm screw holes depend on the printer offset (coupon C-4). The plate edge was moved from y = 10 to y = 9.2 mm so 1.0 mm of plate remains around the boss hole (before: 0.18 mm).",
            "The screw heads sit under the plate, outside the deck; confirm the screw length (about 10 mm) before cutting anything.",
        ],
    },
    "base-tray": {
        "settings": FLAT + ", 5 mm brim only if the edge lifts",
        "orientation": "Underside on the bed (the 2 mm 45 degree chamfer lies on the bed side), ridge, standoffs and posts standing up",
        "coupons": ["C-4"],
        "warnings": [
            "The three feet are NOT in this file: they are separate parts (tray-foot.stl, 3 pieces) that press into three blind sockets from below. Glue them with a drop of cyanoacrylate.",
            "Each screw hole has a 6.1 mm head recess 2.2 mm deep that opens to the bed; the 3.55 mm hole above it is a 1.3 mm bridge ring (short).",
            "The three platform posts (4.8 mm round, 35 mm tall) are slender; they have no spigot or pocket at the deck, so the joint is glue only (NOT designed).",
            "The wall ridge (1.2 mm wide, 3 mm tall) is notched 4.8 degrees either side of each screw boss; the ridge locates the wall with 0.3 mm play.",
            "Eight board standoffs (4 mm round, 3 mm tall) carry the two boards; they have no screw holes (the boards are NOT fixed).",
            "The USB-C saddle is 12 x 8 x 7 mm; the connector fixing is NOT designed.",
            "The exit hole 12 x 9.6 mm lines up with the deck hole; the chute walls above it are in the housing deck.",
        ],
    },
    "tray-foot": {
        "settings": THIN + ", 100 % infill (the part is tiny), no supports",
        "orientation": "Flat 10 mm face on the bed, 4 mm spigot standing up",
        "coupons": [],
        "warnings": [
            "Three identical pieces. The 4.0 mm spigot enters a 4.3 mm socket 3.4 mm deep (0.15 mm play per side); there is no thread, so the feet are glued.",
            "A printed foot is a rigid plastic disc; add a stick-on rubber pad (not designed) if the tray should not slide.",
        ],
    },
    "cylindrical-shell-right": {
        "settings": THIN + ", 5 mm brim, slow outer walls",
        "orientation": "Upright, the lower rim (z = -38) on the bed",
        "coupons": [],
        "warnings": [
            "A 3 mm curved wall 92 mm tall with a 51 mm radius: expect wobble and layer-line weakness; use the brim and print slowly.",
            "The shoulder leans inwards up to 40 degrees from vertical and the deck ledge is chamfered underneath, so neither needs supports.",
            "One 3 mm tongue (1.0 mm thick, mid-wall) on one edge and a matching 3.4 mm groove on the other. The 0.8 mm skins either side of the groove are thinner than two perimeters and may break. Fit is ASSUMED.",
            "A screw boss (7 mm round, 8 mm tall, 2.6 mm pilot hole 6 mm deep) is fused into the inner face; the M3 screw cuts its own thread in the hole.",
            "The ledge chamfer is in this file only; the viewer draws the ledge square.",
        ],
    },
    "cylindrical-shell-back": {
        "settings": THIN + ", 5 mm brim, slow outer walls",
        "orientation": "Upright, the lower rim (z = -38) on the bed",
        "coupons": [],
        "warnings": [
            "A 3 mm curved wall 92 mm tall; expect wobble and use the brim.",
            "The USB-C window is 8.9 mm wide and 9 mm tall (z -32 to -23 mm) and prints as a short bridge 15 mm above the bed.",
            "One tongue and one groove as on the other sectors (0.2 mm play per side); fit is ASSUMED.",
            "A screw boss with a 2.6 mm pilot hole is fused into the inner face.",
        ],
    },
    "cylindrical-shell-left": {
        "settings": THIN + ", 5 mm brim, slow outer walls",
        "orientation": "Upright, the lower rim (z = -38) on the bed",
        "coupons": [],
        "warnings": [
            "A 3 mm curved wall 92 mm tall; expect wobble and use the brim.",
            "One tongue and one groove as on the other sectors (0.2 mm play per side); fit is ASSUMED.",
            "A screw boss with a 2.6 mm pilot hole is fused into the inner face.",
        ],
    },
    "service-lid": {
        "settings": THIN + ", 5 mm brim, no supports",
        "orientation": "Turned over: the top face is on the bed (smooth visible face), the 3 mm lip stands up",
        "coupons": [],
        "warnings": [
            "An 87 mm x 3.5 mm disc: expect warp at the edge; use the brim and avoid ABS.",
            "The engraved ring (1.2 mm wide, 0.8 mm deep) opens to the bed and is bridged by the layers above; it may sag.",
            "The lip is a 2 mm wide ring standing 3 mm up: handle with care.",
            "It is held by gravity only; nothing stops it sliding off if the product is tipped (magnets or a bayonet are NOT designed).",
        ],
    },
    "station-bracket": {
        "settings": FLAT.replace("about 30 % gyroid", "40 % infill") + ", no supports",
        "orientation": "Turned over: the plate top face (where the servo sits) is on the bed, the two legs stand up",
        "coupons": [],
        "warnings": [
            "The plate has a 6.15 mm hole for the servo output shaft. The servo ears rest on the plate; their screw holes are NOT designed.",
            "The two 3 mm legs are 11.9 mm tall, are glued to the deck, and have no pocket or spigot (NOT designed).",
            "The plate is 0.1 mm longer than the servo footprint at one end so that the leg corners stay on the plate.",
        ],
    },
    "pin-lever": {
        "settings": THIN + ", 4 walls, no supports",
        "orientation": "Flat on the bed",
        "coupons": ["C-2"],
        "warnings": [
            "The 5.15 mm bore fits the 5 mm output shaft; the real servo output is a 4.8 mm splined shaft that is not modelled: measure the shaft or glue the lever to the stock horn (NOT designed).",
            "The engagement pin passes through a 3.55 mm hole 15 mm from the pivot; a 0.8 mm wall surrounds it at the lever tip.",
        ],
    },
    "tongue-lever": {
        "settings": THIN + ", 4 walls, no supports",
        "orientation": "Flat on the bed, crank pin standing up",
        "coupons": ["C-2"],
        "warnings": [
            "The 3 mm crank pin is printed upright, so it is weak across layer lines; check that it survives the gate load or use a 3 mm steel pin pressed into a hole (NOT designed).",
            "The bore fits a 5 mm shaft; the servo spline is not modelled (see the pin lever).",
        ],
    },
    "tongue-gate": {
        "settings": THIN + ", 4 walls, no supports",
        "orientation": "Flat on the bed",
        "coupons": [],
        "warnings": [
            "1.5 mm plate sliding in a 1.8 mm channel (0.15 mm play per face); elephant foot on the first layer adds to the thickness: chamfer the bed edge or lower the first layer flow.",
            "The slot is 12 x 3.6 mm and the pin is 3.0 mm.",
        ],
    },
    "pin-cam": {
        "settings": FLAT + ", 100 % infill advised for the thin arm",
        "orientation": "Upright on the 5 mm square foot; the arm and ramp are cantilevered, so print with a small support under the arm",
        "coupons": [],
        "warnings": [
            "The arm is a 3 mm plate cantilevered 14.7 mm from a 4 x 3 mm post (21 mm tall). It needs a support under the arm; without it the bridge sags and the pin head will not clear.",
            "The ramp is a 60 degree wedge in a plane turned about 26 degrees from the arm; the pin head rim must be tested on a print.",
            "The ramp crest is a 0.6 mm wide flat, thinner than two perimeters; expect it to print rounded.",
            "The foot is glued to the deck (no pocket or screw, NOT designed). The foot corner is 0.7 mm inside the deck edge.",
        ],
    },
    "cartridge": {
        "settings": THIN + ", no supports unless the bridge below sags",
        "orientation": "Upright, the guide-rail undersides (z = 5) on the bed",
        "coupons": ["C-1"],
        "warnings": [
            "With the rails on the bed, the tube underside is 1 mm above the bed and bridges the 10.8 mm gap between the rails; use a clean bridge or add supports.",
            "The catch ledges overhang 0.8 mm with nothing under them; chamfer if they sag.",
            "The spring lug underside is 1 mm above the bed and the peg is 1.2 mm thick; print the peg slowly.",
            "The bore is modelled 10.95 x 8.55 mm for a nominal 10.8 x 8.4 mm channel.",
            "The colour tag is a 1.2 mm raised plate; change filament at that layer or paint it.",
        ],
    },
    "cap": {
        "settings": THIN + ", no supports",
        "orientation": "Plate flat on the bed, knob up",
        "coupons": [],
        "warnings": [
            "ASSUMED to be its own print. The hinge and the latch are not designed, so this file is only the lid plate and its knob.",
            "The 14.8 x 12.4 mm plate matches the tube outside; with the real fit gap it may need trimming once the hinge exists.",
        ],
    },
    "slide-blade": {
        "settings": THIN + ", 100 % infill, no supports",
        "orientation": "Flat on the bed, wedge nose and tab up",
        "coupons": [],
        "warnings": [
            "The viewer draws the blade 1.0 mm thick in a 1.0 mm channel (no play). This file is 0.8 mm thick (0.1 mm per face, profile blade_clear_mm) so it can slide; elephant foot may still bind it.",
            "The wedge nose is 0.3 mm thick at the tip, thinner than one 0.4 mm line; it prints rounded.",
            "The outer 2 mm of the tab (where the spring peg stands) overhangs the blade with nothing under it; use a bridge or local support.",
        ],
    },
}

PARTS = [
    ("drum", "Drum", "one", 1, build_drum),
    ("housing-platform", "Housing deck", "one", 1, build_platform),
    ("stepper-mount", "Stepper mount", "one", 1, build_mount),
    ("base-tray", "Base tray", "one", 1, build_base),
    ("tray-foot", "Tray foot", "separate", 3, build_foot),
    ("cylindrical-shell-right", "Cylindrical shell, right sector", "one", 1, lambda g, P: build_shell(g, P, 0)),
    ("cylindrical-shell-back", "Cylindrical shell, back sector", "one", 1, lambda g, P: build_shell(g, P, 1)),
    ("cylindrical-shell-left", "Cylindrical shell, left sector", "one", 1, lambda g, P: build_shell(g, P, 2)),
    ("service-lid", "Service lid", "one", 1, build_lid),
    ("station-bracket", "Station bracket", "one", 1, build_bracket),
    ("pin-lever", "Pin lever", "one", 1, build_pin_lever),
    ("tongue-lever", "Tongue lever", "one", 1, build_tongue_lever),
    ("tongue-gate", "Tongue gate", "one", 1, build_tongue),
    ("pin-cam", "Pin cam", "one", 1, build_cam),
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
        ],
        "housing-platform": [
            {"feature": "Bearing seat diameter", "nominal_mm": 16.0, "model_mm": P["seat_model_mm"], "rule": "undersize, ream to 16.00 after printing", "check": "625ZZ press fit (coupon C-1)"},
            {"feature": "Column socket", "nominal_mm": 3.3, "model_mm": 3.3, "rule": "already 0.15 mm per side over the 3.0 spigot", "check": "spigot enters by hand (coupon C-5)"},
            {"feature": "Hall pocket", "nominal_mm": "4.4 x 3.4 x 3.55", "model_mm": "4.4 x 3.4 x 3.55", "rule": "unchanged; measure the real sensor first", "check": "caliper on the sensor"},
        ],
        "stepper-mount": [
            {"feature": "Boss hole diameter", "nominal_mm": 9.5, "model_mm": round(9.5 + hc, 3), "rule": "nominal + hole compensation", "check": "motor boss fits without wobble (coupon C-4)"},
            {"feature": "Screw holes", "nominal_mm": 3.4, "model_mm": round(3.4 + hc, 3), "rule": "nominal + hole compensation", "check": "M3 screw passes (coupon C-4)"},
            {"feature": "M3 pilot hole", "nominal_mm": 2.6, "model_mm": 2.6, "rule": "unchanged; coupon C-4 chooses 2.5 to 2.7", "check": "M3 x 10 bites without splitting"},
        ],
        "base-tray": [
            {"feature": "Screw clearance hole", "nominal_mm": 3.4, "model_mm": round(3.4 + hc, 3), "rule": "nominal + hole compensation", "check": "M3 screw passes"},
            {"feature": "Head recess", "nominal_mm": 5.6, "model_mm": 6.1, "rule": "head 5.6 + 0.5", "check": "head sits flush"},
            {"feature": "Foot socket", "nominal_mm": 4.0, "model_mm": 4.3, "rule": "spigot + 0.3", "check": "foot spigot enters by hand"},
        ],
        "tray-foot": [
            {"feature": "Spigot diameter", "nominal_mm": 4.0, "model_mm": 4.0, "rule": "unchanged", "check": "caliper"},
        ],
        "cartridge": [
            {"feature": "Bore X / Y", "nominal_mm": "10.8 / 8.4", "model_mm": f"{10.8 + hc:.2f} / {8.4 + hc:.2f}", "rule": "nominal + hole compensation", "check": "pill gauge, caliper"},
            {"feature": "Spring peg diameter", "nominal_mm": 1.2, "model_mm": 1.2, "rule": "unchanged; pegs print slightly large", "check": "spring eye drops over it"},
        ],
        "slide-blade": [
            {"feature": "Thickness", "nominal_mm": 1.0, "model_mm": round(1.0 - 2 * P["blade_clear_mm"], 3), "rule": "nominal minus 2 x blade_clear_mm", "check": "caliper, slides in the 1.0 mm channel"},
        ],
        "pin-lever": [
            {"feature": "Pin guide hole", "nominal_mm": 3.4, "model_mm": round(3.4 + hc, 3), "rule": "rod 3.0 + 0.4 + hole compensation", "check": "rod slides freely"},
            {"feature": "Shaft bore", "nominal_mm": 5.0, "model_mm": round(5.0 + hc, 3), "rule": "nominal + hole compensation", "check": "measure the servo shaft"},
        ],
        "tongue-lever": [
            {"feature": "Shaft bore", "nominal_mm": 5.0, "model_mm": round(5.0 + hc, 3), "rule": "nominal + hole compensation", "check": "measure the servo shaft"},
        ],
        "station-bracket": [
            {"feature": "Servo shaft hole", "nominal_mm": 6.0, "model_mm": round(6.0 + hc, 3), "rule": "nominal + hole compensation", "check": "servo output boss passes"},
        ],
    }


def main():
    spec = load_spec()
    g, P = spec["g"], load_profile(spec)
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.stl"):
        old.unlink()
    comp = compensation_table(g, P)
    density = DENSITY.get(str(P["material"]).split()[0].upper(), 1.24)
    manifest = {
        "title": "Feature 005 printed parts (flask housing, rotation subsystem and first compartments)",
        "status": "ASSUMED / NOT_VALIDATED",
        "print_ready": False,
        "fabricable_as_designed": False,
        "units": "mm, right-handed, z up, bed at z = 0, STL binary",
        "disclosure": "Nothing was printed, measured or fitted. The files carry the hole compensation below as a starting guess. Print the coupons first, fix scripts/print_profile.json from what you measure, then run scripts/export_print_files.py again.",
        "profile": P,
        "design_changes_for_printing": [
            "Feet are separate printed parts with a spigot, so the base tray lies flat on the bed without supports.",
            "Platform posts moved from radius 41.5 to 38 mm and rotated to -50 / 70 / 190 degrees so they clear the screw bosses and the USB-C saddle.",
            "Screw bosses moved to radius 45 mm so they fuse into the 3 mm wall (before, they floated 0.5 mm away from it); the base ridge is notched around them.",
            "The cam post is a 4 x 3 mm box on a 5 mm square foot; the pin and tongue levers end 2.5 mm beyond the pin so the hole keeps a wall.",
            "Bracket legs moved inside the plate outline (local y 5.5 to 4.0); the bracket plate has a servo shaft hole.",
            "Stepper-mount plate widened from y = 10 to y = 9.2 mm (the motor boss hole left 0.18 mm of plate); base chamfer reduced from 3 to 2 mm so the screw head recesses stay inside the bed-side outline.",
            "The deck ledge is chamfered underneath (print file only); the slide blade is printed 0.2 mm thinner than the channel (profile blade_clear_mm).",
        ],
        "parts": [],
        "coupons": [],
        "interfaces": interface_table(g, P),
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
        base = re.sub(r",? (?:no supports|supports off)[^,;]*", "", notes["settings"])
        supports = ("none: no downward face steeper than 45 degrees off the bed" if oh["area_mm2"] < 1 else
                    f"needed, or tune bridging: {oh['area_mm2']} mm2 of downward faces off the bed at z = "
                    + ", ".join(f"{lv['z_mm']}" for lv in oh["levels"]) + " mm")
        size = [round(x1 - x0, 3), round(y1 - y0, 3), round(z1 - z0, 3)]
        bodies = len(m.decompose())
        if bodies != 1:
            raise SystemExit(f"{key}: {bodies} bodies, expected one connected solid")
        manifest["parts"].append({
            "id": key, "label": label, "file": fname, "mode": mode, "quantity": qty, "material": P["material"],
            "orientation": notes["orientation"], "settings": base, "supports": supports, "overhangs": oh,
            "size_mm": size, "fits_bed_mm": bed_fit(size),
            "volume_mm3": round(m.volume(), 1), "solid_mass_g": round(m.volume() / 1000 * density, 1),
            "triangles": m.num_tri(), "bodies": bodies,
            "sha256": digest(OUT / fname), "features": comp.get(key, []),
            "thin_features": thin_report(m, P["nozzle_mm"] if isinstance(P["nozzle_mm"], (int, float)) else 0.4),
            "z_levels_off_layer_grid": layer_report(m, P["layer_mm"]),
            "coupons": notes["coupons"], "warnings": notes["warnings"],
        })
        print(f"{fname:30s} {size[0]:7.2f} x {size[1]:7.2f} x {size[2]:6.2f} mm  {m.volume():10.1f} mm3  bodies {bodies}")
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
