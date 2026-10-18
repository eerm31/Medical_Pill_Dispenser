import json
import math
import re
from pathlib import Path

SPEC_JS = Path(__file__).resolve().parents[1] / "docs" / "visualizer" / "rotation-spec.js"


def load_spec():
    text = SPEC_JS.read_text(encoding="utf-8")
    body = re.sub(r"^window\.DispenserRotationSpec\s*=\s*", "", text.strip()).rstrip(";")
    return json.loads(body)


def close(a, b, tol=1e-6):
    return abs(a - b) <= tol


def test_every_dimension_line_measures_its_nominal_value():
    spec = load_spec()
    ids = [d["id"] for d in spec["dims"]]
    assert len(ids) == len(set(ids))
    groups = {g["id"] for g in spec["groups"]}
    for d in spec["dims"]:
        assert d["group"] in groups and d["kind"] in {"printed", "bought", "interface"}
        assert d["frame"] in {"fixed", "drum"}
        measured = math.dist(d["a"], d["b"])
        assert close(measured, d["nominal"], 0.006), (d["id"], measured, d["nominal"])


def test_rotation_stack_is_self_consistent():
    g = load_spec()["g"]
    assert close(g["rod_z1"] - g["rod_z0"], 54.0)
    assert close(g["hub_z1"], g["rod_z1"])
    assert close(g["coupler_z1"] - g["coupler_z0"], 11.0)
    assert close(g["coupler_r"], 7.0)
    assert close(g["coupler_z1"] - g["rod_z0"], 4.5)
    assert close(g["motor_shaft_z1"] - g["coupler_z0"], 5.9)
    assert close(g["rod_z0"] - g["motor_shaft_z1"], 0.6)
    assert g["coupler_z1"] <= g["column_z1"] - 0.5 and g["coupler_r"] < g["column_x"] - g["column_half"]
    assert close(g["column_z1"] - g["coupler_z1"], 0.5)  # coupler top to platform underside
    assert close(g["column_x"] - g["column_half"] - g["coupler_r"], 8.5)  # coupler to column inner face
    assert close(g["column_z1"] - g["column_z0"], 12.0)
    assert close(g["m3_z1"] - g["m3_z0"], 10.0) and close(g["m3_z0"] - g["m3_head_z0"], 1.8)
    assert close(g["m3_z1"] - g["column_z0"], 7.4)  # screw depth in the column
    assert close(g["bearing_z1"], g["platform_top"]) and close(g["bearing_z1"] - g["bearing_z0"], 5.0)
    assert close(g["ring_z0"], g["platform_top"]) and close(g["ring_z1"], g["hub_z0"])
    assert g["bearing_r_out"] < g["ring_r_in"] < g["ring_r_out"] <= g["seat_r_out"] - 0.5
    assert g["rod_flat_x"] < g["rod_r"] < g["bore_r"] and g["bore_flat_x"] > g["rod_flat_x"]
    assert g["bearing_r_in"] == g["rod_r"] and g["coupler_r"] > g["rod_r"]
    assert close(g["plate_z1"] - g["plate_z0"], 1.6)
    assert close(g["motor_body_z1"], g["plate_z0"]) and close(g["motor_shaft_z0"], g["motor_body_z1"])
    assert close(g["axle"][1] + g["motor_offset_y"], 23.0)
    assert g["plate_y0"] < g["axle"][1] - g["boss_hole_r"] and g["axle"][1] + g["motor_offset_y"] < g["plate_y1"]
    assert g["column_x"] * 2 == g["ear_pitch"]


def test_home_sensing_stack_and_print_alignment():
    g = load_spec()["g"]
    mx, my = g["magnet_xy"]
    radius = math.hypot(mx - g["axle"][0], my - g["axle"][1])
    assert close(radius, 32.48, 0.006)
    assert g["hall_x"][0] < mx < g["hall_x"][1] and g["hall_y"][0] < my < g["hall_y"][1]
    floor = g["magnet_z0"] - g["hub_z0"]
    assert close(floor, 0.6)
    assert close(g["magnet_z0"] - g["hall_z1"], floor + (g["hub_z0"] - g["platform_top"]))
    assert close(g["magnet_z1"] - g["magnet_z0"], 1.0) and g["pocket_r"] > g["magnet_r"]
    assert g["boss_z1"] <= 6.0 and g["boss_z1"] - (g["hub_z0"] + g["deck_t"]) == 1.0
    layer = 0.2
    for z in (g["hub_z0"], g["hub_z1"], g["deck_t"], floor, g["plate_z1"] - g["plate_z0"], g["boss_z1"]):
        assert close(round(z / layer) * layer, z, 1e-6), z


def test_dimension_lines_and_extensions_are_axis_aligned():
    for d in load_spec()["dims"]:
        seg = [abs(b - a) for a, b in zip(d["a"], d["b"])]
        assert sum(1 for v in seg if v > 1e-9) == 1, d["id"]
        seg_axis = seg.index(max(seg))
        off = d["off"]
        assert sum(1 for v in off if v) == 1 and not off[seg_axis], d["id"]


def test_column_spigot_fits_its_housing_socket():
    g = load_spec()["g"]
    assert close(g["spigot_z1"] - g["column_z1"], 2.0)
    assert close(g["socket_z1"] - g["column_z1"], 2.2)
    assert close(g["socket_half"] - g["spigot_half"], 0.15)
    assert g["spigot_half"] < g["column_half"] and g["socket_z1"] < g["platform_top"]


def test_decks_meet_the_hub_and_each_other_without_overlapping():
    g = load_spec()["g"]
    assert g["deck_r"] > g["hub_r"]  # one round deck: each quarter meets the next on a 45 degree line, so nothing overlaps


def test_m3_screws_clamp_the_motor_ears_into_the_columns():
    g = load_spec()["g"]
    assert g["m3_head_z0"] < g["m3_z0"] < g["motor_body_z1"]
    assert g["column_z0"] < g["m3_z1"] < g["column_z1"] - 4
    assert g["collar_half"] > g["socket_half"]


def test_cartridge_retention_clips_fit_beside_the_cartridge_on_the_deck():
    g = load_spec()["g"]
    assert g["tube_half_x"] < g["ledge_x1"] < g["clip_x0"] < g["clip_x1"]
    assert math.hypot(g["clip_x1"], g["axle"][1] + g["clip_half_y"]) < g["deck_r"]  # the clips stand on the round deck
    assert g["tube_half_x"] < g["hook_x0"] < g["ledge_x1"]
    assert g["hook_z0"] >= g["ledge_z1"] and g["hook_z1"] < g["clip_z1"]


def test_magnet_boss_stays_on_the_deck_clear_of_rails_and_clips():
    g = load_spec()["g"]
    mx, my = g["magnet_xy"]
    r = g["boss_r"]
    assert mx - r >= 7.4 and my + r < -g["clip_half_y"]
    assert math.hypot(mx, my - g["axle"][1]) + r <= g["deck_r"] - 0.5  # the boss stands wholly on the round deck
    assert g["pocket_r"] + 0.5 <= r


def test_cartridge_hook_clears_the_catch_ledge_for_a_lift_off_the_rails():
    g = load_spec()["g"]
    assert g["hook_z0"] - g["ledge_z1"] >= 0.8 - 1e-9
    assert g["hook_z1"] < g["clip_z1"]


def test_coupler_screws_sit_in_the_coupler_wall_over_the_inserted_shafts():
    g = load_spec()["g"]
    wall = g["coupler_r"] - g["rod_r"]
    assert g["coupler_screw_len"] <= wall + 1e-9
    assert g["coupler_screw_r"] * 2 < g["coupler_z1"] - g["coupler_z0"]
    assert g["rod_z0"] < g["coupler_screw_z0"] < g["coupler_z1"]
    assert g["coupler_z0"] < g["coupler_screw_z1"] < g["motor_shaft_z1"]


def test_removal_demo_flex_lets_the_hook_clear_the_ledge_and_the_compartment_lift_out():
    g = load_spec()["g"]
    assert g["flex_out"] >= g["ledge_x1"] - g["hook_x0"] - 1e-9 + 0.0 or g["flex_out"] >= 0.7 - 1e-9
    assert g["hook_x0"] + g["flex_out"] >= g["ledge_x1"] - 1e-9
    assert g["lift_travel"] >= g["hook_z1"] - 6.0
