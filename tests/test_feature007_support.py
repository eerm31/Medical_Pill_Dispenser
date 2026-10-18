"""Support audit for the flask layout: every part has a declared support, each declared contact is checked geometrically,
and every support chain ends on the base plate (or the table for the outside reader). ASSUMED / NOT_VALIDATED."""
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOL = 0.25  # mm: touching faces count as contact


def spec():
    text = (ROOT / "docs" / "visualizer" / "rotation-spec.js").read_text(encoding="utf-8")
    return json.loads(re.sub(r"^window\.DispenserRotationSpec\s*=\s*", "", text.strip()).rstrip(";"))["g"]


def box(cx, cy, hx, hy, z0, z1):
    return (cx - hx, cx + hx, cy - hy, cy + hy, z0, z1)


def gap(a, b):
    return max(0.0, max(max(a[2 * i] - b[2 * i + 1], b[2 * i] - a[2 * i + 1]) for i in range(3)))


def _bbox(center, direction, length, width):
    """Axis-aligned bounding rectangle of a (length x width) rectangle whose long axis follows `direction`."""
    dx, dy = direction
    hx = abs(dx) * length / 2 + abs(dy) * width / 2
    hy = abs(dy) * length / 2 + abs(dx) * width / 2
    return center[0] - hx, center[0] + hx, center[1] - hy, center[1] + hy


def parts():
    g = spec()
    cy, my = g["axle"][1], g["axle"][1] + g["motor_offset_y"]
    A, SV = g["act"], g["act"]["servo"]
    items, support = {}, {}

    def add(name, aabb, *supports):
        items[name] = tuple(float(v) for v in aabb)
        support[name] = list(supports)

    f = g["feet"]
    add("base", (-g["base_r"], g["base_r"], cy - g["base_r"], cy + g["base_r"], g["base_z0"], g["base_z1"]), *[f"foot{i}" for i in range(3)])
    for i, a in enumerate(f["angles"]):
        fx, fy = f["r"] * math.cos(math.radians(a)), cy + f["r"] * math.sin(math.radians(a))
        add(f"foot{i}", box(fx, fy, f["rad"], f["rad"], g["table_z"], g["base_z0"]), "table")
    R1, R0 = g["shell_r1"], g["shell_r0"]
    add("wall", (-R1, R1, cy - R1, cy + R1, g["shell_z0"], g["shell_z1"]), "base")
    add("wall-top", (-R1, R1, cy - R1, cy + R1, g["shell_z1"] - 0.1, g["shell_z1"]), "wall")
    L = g["lid"]
    add("lid", (-L["r"], L["r"], cy - L["r"], cy + L["r"], L["z0"], L["z1"]), "wall-top")
    lg = g["ledge"]
    add("ledge", (-lg[1], lg[1], cy - lg[1], cy + lg[1], lg[2], lg[3]), "wall")
    pr = g["platform_r"]
    pp = g["platform_posts"]
    for i, ang in enumerate(pp["angles"]):
        px, py = pp["r"] * math.cos(math.radians(ang)), cy + pp["r"] * math.sin(math.radians(ang))
        add(f"post{i}", box(px, py, pp["rad"], pp["rad"], g["base_z1"], -3.0), "base")
    add("platform", (-pr, pr, cy - pr, cy + pr, -3.0, g["platform_top"]), "ledge", *[f"post{i}" for i in range(3)])
    for i, sx in enumerate((-1, 1)):
        add(f"column{i}", box(sx * g["column_x"], my, g["column_half"], g["column_half"], g["column_z0"], g["column_z1"]), "platform")
    add("mount-plate", (-g["plate_x"], g["plate_x"], g["plate_y0"], g["plate_y1"], g["plate_z0"], g["plate_z1"]), "column0", "column1")
    add("motor", box(0, my, g["motor_body_r"], g["motor_body_r"], g["motor_body_z0"], g["motor_body_z1"]), "mount-plate")
    add("motor-shaft", box(0, cy, g["motor_shaft_r"], g["motor_shaft_r"], g["motor_shaft_z0"], g["motor_shaft_z1"]), "motor")
    add("coupler", box(0, cy, g["coupler_r"], g["coupler_r"], g["coupler_z0"], g["coupler_z1"]), "motor-shaft")
    add("rod", box(0, cy, g["rod_r"], g["rod_r"], g["rod_z0"], g["rod_z1"]), "coupler")
    add("bearing", box(0, cy, g["bearing_r_out"], g["bearing_r_out"], g["bearing_z0"], g["bearing_z1"]), "platform")
    add("thrust-ring", box(0, cy, g["ring_r_out"], g["ring_r_out"], g["ring_z0"], g["ring_z1"]), "platform")
    add("hub", box(0, cy, g["hub_r"], g["hub_r"], g["hub_z0"], g["hub_z1"]), "rod", "thrust-ring")
    add("decks", box(0, cy, g["deck_r"], g["deck_r"], g["hub_z0"], g["hub_z0"] + g["deck_t"]), "hub")
    for name, (cx, y) in {"red": (0, 0), "blue": (15, 15), "green": (0, 30), "orange": (-15, 15)}.items():
        add(f"cartridge-{name}", box(cx, y, 7.4, 7.4, g["hub_z0"] + g["deck_t"], 46), "decks")
        add(f"cap-{name}", box(cx, y, 7.4, 7.4, 46, 49.1), f"cartridge-{name}")
    def body_box(P, d, z0, z1, x0, x1, hw):
        th = math.atan2(d[1], d[0])
        pts = [(P[0] + x * math.cos(th) - y * math.sin(th), P[1] + x * math.sin(th) + y * math.cos(th)) for x in (x0, x1) for y in (-hw, hw)]
        return (min(p[0] for p in pts), max(p[0] for p in pts), min(p[1] for p in pts), max(p[1] for p in pts), z0, z1)

    # S1: servo hangs upside down from a plate on two legs; the horn arm below the plate is the pin lever
    s1 = A["s1"]
    P1 = (s1["pivot"][0], s1["pivot"][1] + cy)
    x0, x1 = -SV["shaft_off"], SV["len"] - SV["shaft_off"]
    add("bracket", body_box(P1, s1["body_dir"], s1["plate_z"][0], s1["plate_z"][1], x0 - 0.5, x1 + 0.5, SV["w"] / 2), *[f"bracket-leg{i}" for i in range(2)])
    th = math.atan2(s1["body_dir"][1], s1["body_dir"][0])
    for i, (lx, ly) in enumerate(s1["legs"]):
        wx, wy = P1[0] + lx * math.cos(th) - ly * math.sin(th), P1[1] + lx * math.sin(th) + ly * math.cos(th)
        add(f"bracket-leg{i}", box(wx, wy, s1["leg"] / 2, s1["leg"] / 2, g["platform_top"], s1["plate_z"][0]), "platform")
    add("s1", body_box(P1, s1["body_dir"], s1["plate_z"][1], s1["plate_z"][1] + SV["h"], x0, x1, SV["w"] / 2), "bracket")
    add("s1-shaft", box(P1[0], P1[1], 2.5, 2.5, s1["lever_z"][0], s1["plate_z"][1]), "s1")
    ppx, ppy = s1["pin_parked"][0], s1["pin_parked"][1] + cy
    add("pin-lever", (min(P1[0], ppx) - 4.5, max(P1[0], ppx) + 4.5, min(P1[1], ppy) - 4.5, max(P1[1], ppy) + 4.5, s1["lever_z"][0], s1["lever_z"][1]), "s1-shaft")
    add("pin", (ppx - 1.5, ppx + 1.5, ppy - 1.5, ppy + 1.5, g["pin_z"][1], s1["pin"]["tip_eng"] + s1["pin"]["rod"]), "pin-lever")
    pin, cam = s1["pin"], s1["cam"]
    add("pin-head", (ppx - pin["head_r"], ppx + pin["head_r"], ppy - pin["head_r"], ppy + pin["head_r"], pin["tip_eng"] + pin["rod"], pin["tip_eng"] + pin["rod"] + pin["head_t"]), "pin")
    cpy = cam["post_v"] + cy
    add("cam-post", (ppx - cam["post_r"], ppx + cam["post_r"], cpy - cam["post_r"], cpy + cam["post_r"], g["platform_top"], cam["z0"] + cam["t"]), "platform")
    add("cam-arm", (ppx - cam["hw"], ppx + cam["hw"], cpy - cam["post_r"], ppy, cam["z0"], cam["z0"] + cam["t"]), "cam-post")
    add("pin-hold", (ppx - pin["head_r"], ppx + pin["head_r"], ppy - pin["head_r"], ppy + pin["head_r"], pin["tip_eng"] + pin["rod"] + pin["head_t"], cam["z0"]), "cam-arm", "pin-head")
    # S2 hangs under the deck from two posts at its ears; the horn arm on top of it is the tongue lever
    s2 = A["s2"]
    P2 = (s2["pivot"][0], s2["pivot"][1] + cy)
    ztop = s2["body_z0"] + SV["h"]
    add("s2", body_box(P2, s2["body_dir"], s2["body_z0"], ztop, x0, x1, SV["w"] / 2), "s2-ears")
    add("s2-ears", body_box(P2, s2["body_dir"], ztop - 1.5, ztop, x0 - SV["ear"], x1 + SV["ear"], SV["w"] / 2), "s2-post0", "s2-post1")
    th2 = math.atan2(s2["body_dir"][1], s2["body_dir"][0])
    for i, xl in enumerate((x0 - SV["ear"] / 2, x1 + SV["ear"] / 2)):
        add(f"s2-post{i}", box(P2[0] + xl * math.cos(th2), P2[1] + xl * math.sin(th2), s2["post_r"], s2["post_r"], ztop, -3.0), "platform")
    add("s2-shaft", box(P2[0], P2[1], 2.5, 2.5, ztop, s2["lever_z"][1]), "s2")
    add("tongue-lever", (min(P2[0], s2["pin_parked"][0]) - 4.5, max(P2[0], s2["pin_parked"][0]) + 4.5, min(P2[1], s2["pin_parked"][1] + cy) - 4.5, max(P2[1], s2["pin_parked"][1] + cy) + 4.5, s2["lever_z"][0], s2["lever_z"][1]), "s2-shaft")
    add("tongue-plate", (-7, 7, -18.3, 5.7, -1.5, 0), "platform")  # rides in the deck channel (z -1.65)
    for name, b in g["bay_modules"].items():
        d, r = g["standoff_inset"], g["standoff_r"]
        stands = []
        for k, (x, y) in enumerate(((b[0] + d, b[2] + d), (b[1] - d, b[2] + d), (b[0] + d, b[3] - d), (b[1] - d, b[3] - d))):
            add(f"standoff-{name}{k}", box(x, y, r, r, g["base_z1"], g["bay_z0"]), "base")
            stands.append(f"standoff-{name}{k}")
        add(f"board-{name}", (b[0], b[1], b[2], b[3], g["bay_z0"], g["bay_z0"] + 1.6), *stands)
    c = g["chute"]
    add("chute", (c["x"][0] - c["t"], c["x"][1] + c["t"], c["y"][0] - c["t"], c["y"][1] + c["t"], c["z0"], c["z1"]), "platform", "base")
    jk = g["jack"]
    jx, jy = jk["xy"]
    add("jack-saddle", (jx - jk["w"] / 2, jx + jk["w"] / 2, jy - jk["d"] / 2, jy + jk["d"] / 2, g["base_z1"], jk["z0"]), "base")
    add("jack", (jx - jk["w"] / 2, jx + jk["w"] / 2, jy - jk["d"] / 2, jy + jk["d"] / 2 + 2, jk["z0"], jk["z1"]), "jack-saddle", "wall")
    # the barcode reader stands outside on the table, not on the product
    dx = g["scanner_dx"]
    add("reader-plate", (-64 + dx, -32 + dx, -10, 10, g["table_z"], g["table_z"] + 1.6), "table")
    add("reader-column", (-50.7 + dx, -44.7 + dx, -3, 3, g["table_z"] + 1.6, 24), "reader-plate")
    add("reader-housing", (-58.4 + dx, -37 + dx, -6.75, 6.75, 24, 35.8), "reader-column")
    add("reader-bracket", (-38 + dx, -33 + dx, -4, 4, 23.8, 25.2), "reader-housing")
    add("reader-stage", (-34 + dx + 0.5, -25 + dx, -6, 6, 24.2, 24.9), "reader-bracket")
    add("reader-guide0", (-29.5 + dx - 0.4, -29.5 + dx + 0.4, 4.2, 5.0, 23.9, 35.9), "reader-stage")
    add("reader-guide1", (-29.5 + dx - 0.4, -29.5 + dx + 0.4, -5.0, -4.2, 23.9, 35.9), "reader-stage")
    items["table"] = (-1e3, 1e3, -1e3, 1e3, g["table_z"] - 5, g["table_z"])
    support["table"] = []
    return g, items, support


def test_every_declared_contact_is_geometric():
    g, items, support = parts()
    cy = g["axle"][1]
    for name, supports in support.items():
        for s in supports:
            if s == "wall":  # the wall is a ring: the part must reach into it
                reach = max(math.hypot(x, y - cy) for x in items[name][0:2] for y in items[name][2:4])
                assert reach >= g["shell_r0"] and items[name][4] >= g["shell_z0"] and items[name][5] <= g["shell_z1"], name
                continue
            assert gap(items[name], items[s]) <= TOL, (name, s, gap(items[name], items[s]))


def test_every_part_reaches_the_base_or_the_table():
    _, items, support = parts()
    for name in items:
        seen, stack = {name}, [name]
        reached = name in ("base", "table")
        while stack and not reached:
            for s in support[stack.pop()]:
                if s in ("base", "table"):
                    reached = True
                    break
                if s not in seen:
                    seen.add(s)
                    stack.append(s)
        assert reached, f"{name} is floating"


def test_wall_sits_in_the_base_tray_and_the_chute_stands_on_the_floor():
    g, items, _ = parts()
    assert g["shell_z0"] == g["base_z1"]  # the wall bottom meets the tray floor
    assert g["base_ridge"][0] < g["shell_r0"] and g["shell_r0"] - g["base_ridge"][1] >= 0.25 and g["base_ridge"][1] < g["shell_r1"]
    assert g["base_r"] >= g["shell_r1"]
    assert items["chute"][4] == g["base_z1"] and items["chute"][5] == -3.0  # the chute links the deck underside to the tray floor


def test_lid_covers_everything_and_the_joints_fit():
    g = spec()
    L, J = g["lid"], g["shell_joint"]
    assert L["z0"] == g["shell_z1"] and L["z1"] - L["z0"] == 3.5
    assert L["lip_r1"] <= g["shell_r0"] - 0.3 and L["lip_r0"] < L["lip_r1"] and L["lip_z0"] < L["z0"]  # the lip enters the wall
    top = g["housing_outer"][-1]
    assert L["r"] >= top[0] and L["r"] <= g["base_r"]  # the lid overhangs the neck, never the body
    assert L["z0"] - 49.1 >= 0.5  # clears the open cap knobs
    assert L["groove_depth"] < L["z1"] - L["z0"]
    assert g["shell_r0"] < J["groove_r0"] < J["tongue_r0"] < J["tongue_r1"] < J["groove_r1"] < g["shell_r1"]
    assert J["groove_r0"] - g["shell_r0"] >= 0.79 and g["shell_r1"] - J["groove_r1"] >= 0.79
    assert (J["tongue_r0"] - J["groove_r0"]) >= 0.15 and (J["groove_r1"] - J["tongue_r1"]) >= 0.15
    assert J["groove_len"] - J["tongue_len"] >= 0.3
    for w in g["shell_windows"]:  # no window cuts through a joint
        for a in (sec[0] for sec in g["shell_sectors"]):
            assert abs(w["a"] - a) > w["half"] + 5


def test_bay_boards_clear_the_chute_the_bosses_the_servo_and_the_stepper():
    g, items, _ = parts()
    my = g["axle"][1] + g["motor_offset_y"]
    cy = g["axle"][1]
    rects = {n: items[n][:4] for n in ("chute", "jack-saddle")}
    for name, (x0, x1, y0, y1) in g["bay_modules"].items():
        for other, r in rects.items():
            d = math.hypot(max(x0 - r[1], r[0] - x1, 0), max(y0 - r[3], r[2] - y1, 0))
            assert d >= 1.0, (name, other, d)
        for ang in g["base_screws"]["angles"]:  # the three base screw bosses
            bx = g["base_screws"]["r"] * math.cos(math.radians(ang))
            by = cy + g["base_screws"]["r"] * math.sin(math.radians(ang))
            d = math.hypot(max(x0 - bx, 0, bx - x1), max(y0 - by, 0, by - y1)) - g["base_screws"]["boss_r"]
            assert d >= 1.0, (name, "boss", ang, d)
        nx, ny = min(max(0, x0), x1), min(max(my, y0), y1)
        assert math.hypot(nx, ny - my) > g["motor_body_r"], name
        top = g["bay_z0"] + 1.6 + (10.1 if name == "uln" else 4.4)
        s2 = items["s2"]
        if top > s2[4] - 0.5:  # tall boards must not sit under the tongue servo
            assert x1 <= s2[0] or s2[1] <= x0 or y1 <= s2[2] or s2[3] <= y0, (name, "s2")
        assert max(math.hypot(x, y - cy) for x in (x0, x1) for y in (y0, y1)) <= g["shell_r0"] - 1.0, name


def test_platform_posts_carry_the_deck_without_the_wall_and_clear_everything():
    g, items, support = parts()
    assert all(f"post{i}" in support["platform"] for i in range(3))
    cy = g["axle"][1]
    for i in range(3):
        p = items[f"post{i}"]
        assert gap(p, items["platform"]) <= TOL
        assert max(math.hypot(x, y - cy) for x in p[0:2] for y in p[2:4]) < g["ledge"][0]  # inside the ledge ring
        for other in [k for k in items if k.startswith(("board-", "jack-saddle", "chute", "standoff"))]:
            assert gap(p, items[other]) >= 1.5, (i, other)
