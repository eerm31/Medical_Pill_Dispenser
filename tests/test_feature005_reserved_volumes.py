"""Feature 005 future-ready reserved volumes (ASSUMED / NOT_VALIDATED; positions are proposals)."""
import re

from feature005_spec import (AXLE, G, Item, circle, clearance, drum_items, fixed_items,
                             load_spec, rect, separation2d)

SLOT_X = (8.5, 10.7)
SLOT_OUT_Y = (-12.7, -8.3)
SLOT_IN_Y = (3.3, 5.3)
BAND = dict(x=(-20.0, 20.0), y=(-12.7, 5.3), z=(-12.5, -3.0))
CLIP_KEEPOUT = dict(x=(8.3, 9.5), y=(-3.0, 3.0))
PLATFORM_Z = (-3.0, 3.7)
DECK_Z = (4.0, 5.0)
# Cartridge, clip, hook and ledge items belong to the weighing features (clip root keep-out is theirs).
CARTRIDGE_FAMILY = re.compile(r"^(deck\d|clip|hook|ledge|tube)")
# Latch body bounds from the canonical red-cap-latch-body part (build_concept_assembly, home pose).
LATCH_BOX = ((-1.0, 1.0), (-6.75, -5.25), (47.35, 48.85))
# PROPOSED lid-release actuator keep-out: latch box widened 3 mm in x, reaching out 7.25 mm in -y, +-1 mm in z.
ACTUATOR_KEEPOUT = ((-4.0, 4.0), (-14.0, LATCH_BOX[1][1]), (46.35, 49.85))


def _box(x, y, z, name="reserved"):
    return Item(name, rect(x[0], x[1], y[0], y[1]), z[0], z[1])


def _mirror(x):
    return [(x[0], x[1]), (-x[1], -x[0])]


def _slot_boxes(z):
    return [_box(xr, y, z) for xr in _mirror(SLOT_X) for y in (SLOT_OUT_Y, SLOT_IN_Y)]


def _extra_fixed(g):
    ax, ay = AXLE
    items = [Item("seat-boss", circle(ax, ay, g["seat_r_out"]), g["bearing_z0"], g["platform_top"])]
    h = g["collar_half"]
    for sx in (-1, 1):
        x, my = sx * g["column_x"], ay + g["motor_offset_y"]
        items.append(Item(f"collar{sx:+d}", rect(x - h, x + h, my - h, my + h), -3.0, -0.8))
    return items


def _min_clearance(items, reserved):
    return min((clearance(i, r), i.name, ) for i in items for r in reserved)


def test_fixed_rotation_items_clear_of_platform_slots_and_band():
    g = G()
    drum = [i for i in drum_items(g) if not CARTRIDGE_FAMILY.match(i.name)]
    items = [i for i in fixed_items(g) + _extra_fixed(g) + drum if i.name != "platform"]
    slots = _slot_boxes(PLATFORM_Z)
    band = [_box(BAND["x"], BAND["y"], BAND["z"], "band")]
    c_slot, n_slot = _min_clearance(items, slots)
    c_band, n_band = _min_clearance(items, band)
    print(f"RESERVED platform slot min {c_slot:.3f} ({n_slot}); band min {c_band:.3f} ({n_band})")
    assert c_slot >= 1.7, (c_slot, n_slot)  # hand value: hall 1.8 mm
    assert c_band >= 1.65, (c_band, n_band)  # hand value: seat boss 1.7 mm (coupler 2.7 mm)


def test_hand_values_hall_and_coupler():
    g = G()
    by = {i.name: i for i in fixed_items(g)}
    by.update({i.name: i for i in drum_items(g)})
    slots = _slot_boxes(PLATFORM_Z)
    hall = min(clearance(by["hall"], s) for s in slots)
    coupler = clearance(by["coupler"], _box(BAND["x"], BAND["y"], BAND["z"], "band"))
    assert abs(hall - 1.8) < 0.05
    assert abs(coupler - 2.7) < 0.05  # axle y 15 - coupler r 7.0 - band y end 5.3


def test_drum_items_clear_of_deck_slots_and_clip_keepout():
    g = G()
    items = [i for i in drum_items(g) if not CARTRIDGE_FAMILY.match(i.name)]
    slots = _slot_boxes(DECK_Z)
    c, n = _min_clearance(items, slots)
    print(f"RESERVED deck slot min {c:.3f} ({n})")
    assert c >= 1.0, (c, n)  # hand value: boss ~1.1 mm
    keepouts = [_box(xr, CLIP_KEEPOUT["y"], (DECK_Z[1], g["clip_z1"])) for xr in _mirror(CLIP_KEEPOUT["x"])]
    ck, nk = _min_clearance([i for i in items if i.name not in ("hub", "rod", "coupler")], keepouts)
    assert ck > 0.0, (ck, nk)
    for i in fixed_items(g) + _extra_fixed(g):
        for k in keepouts:
            assert clearance(i, k) > 0.0, i.name


def test_drum_frame_carries_only_passive_parts():
    spec = load_spec()
    forbidden = re.compile(r"hall|sensor|wire|board|pcb|motor-body|m3|solenoid|servo", re.I)
    allowed = {"hub", "deck0", "rod", "coupler", "cscrew", "motor-shaft", "magnet", "boss", "clip", "ledge", "cartridge", "cap", "blade", "bspring"}
    pieces = {p for d in spec["dims"] if d["frame"] == "drum" for p in d["pieces"]}
    assert pieces <= allowed, pieces - allowed
    assert not [p for p in pieces if forbidden.search(p)]
    assert not [i.name for i in drum_items(spec["g"]) if forbidden.search(i.name)]
    magnets = [d for d in spec["dims"] if d["frame"] == "drum" and "magnet" in d["pieces"]]
    assert magnets and all(d["kind"] == "bought" for d in magnets)  # passive magnet only


def test_hook_clears_ledge_by_at_least_0_8():
    g = G()
    assert g["hook_z0"] - g["ledge_z1"] >= 0.8 - 1e-9


def test_nothing_above_deck_z21_over_a_cartridge_position():
    g = G()
    assert g["clip_z1"] <= 21.0 and g["hook_z1"] <= g["clip_z1"] and g["boss_z1"] <= 6.0
    tubes = [i for i in drum_items(g) if i.name.startswith("tube")]
    tall = [i for i in drum_items(g) + fixed_items(g) if i.z1 > 21.0 and not i.name.startswith("tube")]
    assert tubes and tall
    for t in tall:
        for tube in tubes:
            xy = separation2d(t.shape, tube.shape)
            assert xy >= 0.0, (t.name, tube.name, xy)


def test_lid_release_actuator_keepout_is_proposed_and_clear():
    g = G()
    keep = _box(*ACTUATOR_KEEPOUT, name="lid-release-keepout")
    assert ACTUATOR_KEEPOUT[1][1] == LATCH_BOX[1][1]  # touches the latch face, nothing else
    assert all(ACTUATOR_KEEPOUT[k][0] <= LATCH_BOX[k][0] and LATCH_BOX[k][1] <= ACTUATOR_KEEPOUT[k][1]
               for k in range(3))
    for i in drum_items(g, include_cartridge=False) + fixed_items(g) + _extra_fixed(g):
        assert clearance(i, keep) > 0.0, i.name
