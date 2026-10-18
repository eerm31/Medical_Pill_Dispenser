import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys

import pytest

from dispenser_sim.viz3d.geometry_schema import (
    canonical_json, load_geometry, validate_geometry,
)

ROOT = Path(__file__).resolve().parents[2]
EXPECTED = [
    "Station Housing", "Central Post", "Rotating Drum",
    "Red Cartridge", "Blue Cartridge", "Green Cartridge", "Orange Cartridge",
    "Red Cap", "Blue Cap", "Green Cap", "Orange Cap",
    "Red Upper Blade Tab", "Blue Upper Blade Tab", "Green Upper Blade Tab", "Orange Upper Blade Tab",
    "Red Upper Blade Return Spring", "Blue Upper Blade Return Spring", "Green Upper Blade Return Spring", "Orange Upper Blade Return Spring",
    "Servo Unit", "Servo Crank", "Connecting Rod", "Pin Carriage",
    "Carriage Rail Left", "Carriage Rail Right", "Pull Solenoid", "Engagement Pin",
    "Shared Lower Tongue", "Tongue Actuator Rod", "Tongue Return Spring", "Barcode Scanner Housing", "Outlet Tray",
]
EXPECTED_IDS = [
    "station-housing", "central-post", "rotating-drum",
    "red-cartridge", "blue-cartridge", "green-cartridge", "orange-cartridge",
    "red-cap", "blue-cap", "green-cap", "orange-cap",
    "red-upper-blade-tab", "blue-upper-blade-tab", "green-upper-blade-tab", "orange-upper-blade-tab",
    "red-upper-blade-return-spring", "blue-upper-blade-return-spring", "green-upper-blade-return-spring", "orange-upper-blade-return-spring",
    "servo-unit", "servo-crank", "connecting-rod", "pin-carriage",
    "carriage-rail-left", "carriage-rail-right", "pull-solenoid", "engagement-pin",
    "shared-lower-tongue", "tongue-actuator-rod", "tongue-return-spring", "barcode-scanner-housing", "outlet-tray",
]
ADDED_COMPONENTS = [
    (f"{color}-cap-label-plate", f"{label} Cap Label Plate")
    for color, label in (("red", "Red"), ("blue", "Blue"), ("green", "Green"), ("orange", "Orange"))
] + [
    (f"{color}-passive-tag-carrier", f"{label} Passive Tag Carrier")
    for color, label in (("red", "Red"), ("blue", "Blue"), ("green", "Green"), ("orange", "Orange"))
] + [
    (f"{color}-cap-hinge-assembly", f"{label} Cap Hinge Assembly")
    for color, label in (("red", "Red"), ("blue", "Blue"), ("green", "Green"), ("orange", "Orange"))
] + [
    (f"{color}-cap-latch-body", f"{label} Cap Latch Body")
    for color, label in (("red", "Red"), ("blue", "Blue"), ("green", "Green"), ("orange", "Orange"))
] + [
    ("electronics-deck", "Electronics Deck"),
    ("controller-board-placeholder", "Controller Board Placeholder"),
    ("scanner-head-placeholder", "Scanner Head Placeholder"),
    ("scanner-mount", "Scanner Mount"),
]

DIRECT_STATION_POSITIONS = {
    "station-housing": (0, 0, 0),
    "central-post": (0, 15, 23),
    "rotating-drum": (0, 15, 25),
    "servo-crank": (0, -54, 15.2),
    "outlet-tray": (0, -13, -13.25),
}


def test_canonical_source_inventory_provenance_and_hash():
    data = load_geometry()
    assert data["schema_version"] == 3
    assert [item["name"] for item in data["components"][:32]] == EXPECTED
    assert [item["component_id"] for item in data["components"][:32]] == EXPECTED_IDS
    assert len({item["component_id"] for item in data["components"]}) == 52
    assert all(item["export_inclusion"] == "physical_component" for item in data["components"])
    assert data["export"]["physical_component_count"] == 52
    assert data["dimensions"][-1]["value"] is None
    assert all(item["verification_status"] == "NOT_VALIDATED" for item in data["dimensions"])
    assert len(hashlib.sha256(canonical_json(data)).hexdigest()) == 64
    assert not any(name in {item["name"] for item in data["components"]} for name in ("Hopper", "Gate", "Guide"))


def test_schema_rejects_bad_version_duplicate_ids_nonfinite_and_missing_provenance():
    base = load_geometry()
    bad = dict(base, schema_version=999)
    with pytest.raises(ValueError, match="schema_version"):
        validate_geometry(bad)
    bad = json.loads(json.dumps(base))
    bad["components"][1]["component_id"] = bad["components"][0]["component_id"]
    with pytest.raises(ValueError, match="unique"):
        validate_geometry(bad)
    bad = json.loads(json.dumps(base))
    bad["dimensions"][0]["value"] = float("inf")
    with pytest.raises(ValueError, match="finite"):
        validate_geometry(bad)
    bad = json.loads(json.dumps(base))
    bad["components"][0].pop("provenance")
    with pytest.raises(ValueError, match="provenance"):
        validate_geometry(bad)


def test_generated_bundle_is_stable_and_matches_source_hash(tmp_path):
    data = load_geometry()
    source_hash = hashlib.sha256(canonical_json(data)).hexdigest()
    checked_in = (ROOT / "docs/visualizer/concept-data.js").read_text(encoding="utf-8")
    assert source_hash in checked_in
    regenerated = tmp_path / "concept-data.js"
    subprocess.run([sys.executable, str(ROOT / "tools/build_visualizer_data.py"), "--output", str(regenerated)], check=True)
    assert regenerated.read_text(encoding="utf-8") == checked_in
    assert "Math.random" not in checked_in


def test_two_gate_station_source_is_user_attributed_and_explicitly_assumed():
    data = load_geometry()
    station = data["station"]
    assert "USER_SPECIFIED" in data["provenance_sources"]
    assert station["axes"] == {"x": "right", "y": "depth/back", "z": "up"}
    assert station["channel"]["size_mm"] == [10.8, 8.4]
    assert station["channel"]["axis_order"] == "X long, Y short"
    assert station["pill"]["size_mm"] == [10, 7, 5]
    assert station["outlet"]["aperture_mm"] == [11.8, 9.4]
    assert station["outlet"]["source_axis_order"] == "unspecified"
    assert station["outlet"]["axis_order_assumption"].endswith("unverified")
    assert station["outlet"]["axis_order_assumption"].startswith("X=11.8 long span, Y=9.4 short span")
    assert station["chamber"] == {"z_min_mm": 0, "z_max_mm": 5, "parked_occupancy": 0}
    assert station["parked_stack"]["lowest_pill_bottom_z_mm"] == 6
    assert station["blade"]["stroke_mm"] == 10.4
    assert station["blade"]["tip_y_closed_open_mm"] == [-5.2, 5.2]
    assert station["blade"]["stroke_axis"] == "component_local_y"
    assert {key: station["blade"]["top_wedge"][key] for key in ("thickness_start_mm", "thickness_end_mm", "length_mm")} == {"thickness_start_mm": 0.3, "thickness_end_mm": 1, "length_mm": 2.6}
    assert station["tongue"]["z_bounds_mm"] == [-1.5, 0]
    assert station["tongue"]["edge_y_closed_open_mm"] == [5.7, -5.7]
    assert station["tongue"]["stroke_mm"] == 11.4
    assert all(data["unknowns"][key] is None for key in ("fit_mm", "flexure_mm", "spring_force_n", "friction", "tolerance_mm"))
    assert data["export"]["validation_status"] == "NOT_VALIDATED"
    assert data["export"]["print_ready"] is False
    assert data["export"]["fabricable_as_designed"] is False


def test_a_k_tongue_spring_and_fr033_description_remain_an_explicit_conflict():
    data = load_geometry()
    parts = {item["component_id"]: item for item in data["components"]}
    recipes = {item["recipe_id"]: item for item in data["component_recipes"]}
    tongue = parts["shared-lower-tongue"]
    spring = parts["tongue-return-spring"]
    spring_recipe = recipes[spring["recipe_id"]]
    schedule = data["assembly_schedule"]
    bracket = next(feature for feature in schedule["integrated_features"] if feature["feature_id"] == "tongue-return-fixed-bracket")
    assert math.isclose(spring["rotation"][0], -math.pi / 2, abs_tol=1e-10)
    assert spring["rotation"][1:] == [0, 0]
    assert math.isclose(-math.sin(spring["rotation"][0]), 1, abs_tol=1e-10)
    assert math.isclose(math.cos(spring["rotation"][0]), 0, abs_tol=1e-10)
    assert spring_recipe["recipe_id"] == "tongue-return-spring"
    assert spring_recipe["parameters"]["travel_axis"] == "canonical_y"
    assert spring["provenance"] == "ASSUMED"
    assert spring["return_action"] == "SC029_lower_plunger_compression_visual_only"
    assert spring["fixed_anchor_component_id"] == "station-housing"
    assert spring["moving_anchor_component_id"] == "tongue-actuator-rod"
    assert any("spring" in value for value in spring["missing_inputs"])
    assert bracket["y_bounds_mm"] == [-70, -68]
    assert bracket["cross_section_xz_mm"] == [20.8, 24.5]
    assert spring_recipe["parameters"]["closed_length_mm"] == 21.7
    assert spring_recipe["parameters"]["open_length_mm"] == 10.3
    assert schedule["tongue_group_schedule"]["spring_length_closed_open_mm"] == [21.7, 10.3]
    assert any(item["conflict_id"] == "tongue-spring-fr033-ak" and item["status"] == "UNRESOLVED"
               for item in schedule["conflicts"])
    assert "tongue_spring_reaction_pad" not in recipes[parts["station-housing"]["recipe_id"]]["parameters"]
    assert len(data["components"]) == data["export"]["physical_component_count"] == 52


@pytest.mark.parametrize("mutate, message", [
    (lambda d: d["station"].pop("channel"), "station"),
    (lambda d: d["provenance_sources"].pop("USER_SPECIFIED"), "provenance"),
    (lambda d: d["station"].update(axes={"x": "depth", "y": "right", "z": "up"}), "axis"),
    (lambda d: d["unknowns"].update(fit_mm=0), "unknown"),
    (lambda d: d["export"].update(print_ready=True), "readiness"),
])
def test_two_gate_source_rejects_missing_or_promoted_contract(mutate, message):
    data = json.loads(json.dumps(load_geometry()))
    mutate(data)
    with pytest.raises(ValueError, match=message):
        validate_geometry(data)


def test_main_scene_demo_starts_empty_with_only_four_exact_color_fixtures():
    data = load_geometry()
    assert [item["id"] for item in data["palette"]] == ["red", "blue", "green", "orange"]
    assert data["demo"]["initial_pills_per_cartridge"] == 0
    assert data["demo"]["loaded_pills_per_container"] == 5
    assert data["demo"]["barcodes"] == {
        "5012345678900": "red",
        "5012345678917": "blue",
        "5012345678924": "green",
        "5012345678931": "orange",
        "5012345678948": None,
        "9999999999999": None,
    }


@pytest.mark.parametrize("mutate", [
    lambda data: data["palette"].__setitem__(2, dict(data["palette"][2], id="purple")),
    lambda data: data["demo"].update(initial_pills_per_cartridge=5),
    lambda data: data["demo"]["barcodes"].update({"5012345678924": "purple"}),
])
def test_main_scene_demo_rejects_legacy_palette_filled_start_or_wrong_mapping(mutate):
    data = json.loads(json.dumps(load_geometry()))
    mutate(data)
    with pytest.raises(ValueError, match="main-scene"):
        validate_geometry(data)


def test_fr034_target_inventory_is_52_without_changing_the_original_32_ids():
    data = load_geometry()
    components = data["components"]
    assert [item["component_id"] for item in components[:32]] == EXPECTED_IDS
    assert [item["name"] for item in components[:32]] == EXPECTED
    assert [(item["component_id"], item["name"]) for item in components[32:]] == ADDED_COMPONENTS
    assert len(components) == data["export"]["physical_component_count"] == 52
    assert all(item["export_inclusion"] == "physical_component" for item in components)


def test_fr034_corrected_station_datum_and_four_socket_local_frames():
    data = load_geometry()
    schedule = data["assembly_schedule"]
    assert schedule["datum"] == {
        "station_s_mm": [0, 0, 0],
        "drum_post_axis_xy_mm": [0, 15],
        "closed_tongue_upper_z_mm": 0,
        "axes": {"x": "right", "y": "depth/back", "z": "up"},
        "units": "mm",
        "provenance": "ASSUMED",
        "verification_status": "NOT_VALIDATED",
    }
    assert schedule["frame_conversion"]["translation_mm"] == [0, 15, 0]
    assert schedule["frame_conversion"]["applies_only_when_source_frame_is_explicitly_axle_centered"] is True
    assert schedule["frame_conversion"]["applied_component_ids"] == []
    assert schedule["frame_conversion"]["direct_station_frame_placements_are_not_translated"] is True
    assert schedule["frame_conversion"]["verification_status"] == "NOT_VALIDATED"
    parts = {item["component_id"]: item for item in data["components"]}
    placements = {item["component_id"]: item for item in schedule["component_placements"]}
    for component_id, expected_position in DIRECT_STATION_POSITIONS.items():
        part = parts[component_id]
        placement = placements[component_id]
        if component_id == "outlet-tray":
            assert placement["source_position_mm"] is None
            assert placement["world_position_mm"] is None
            assert placement["rendered_fallback_position_mm"] == part["position"]
            assert schedule["station_stack"]["tray_size_and_position"]["historical_k_center_mm"] == list(expected_position)
            assert schedule["station_stack"]["tray_size_and_position"]["historical_k_status"] == "CONFLICT_NOT_CURRENT_POSITION"
            continue
        assert placement["source_position_mm"] == list(expected_position)
        assert placement["world_position_mm"] == list(expected_position)
        assert placement["source_frame"] == "station_world"
        assert part["position"] == pytest.approx(expected_position)
        assert placement["placement_provenance"] == "ASSUMED"
        assert placement["verification_status"] == "NOT_VALIDATED"

    for component_id in ("barcode-scanner-housing", "connecting-rod", "tongue-actuator-rod", "tongue-return-spring",
                         "scanner-head-placeholder", "scanner-mount", "electronics-deck", "controller-board-placeholder",
                         "red-cap-label-plate", "red-passive-tag-carrier", "red-cap-hinge-assembly", "red-cap-latch-body"):
        placement = placements[component_id]
        assert placement["source_position_mm"] is None
        assert placement["world_position_mm"] is None
        assert placement["rendered_fallback_provenance"] == "ASSUMED"
        assert placement["rendered_fallback_position_mm"] == parts[component_id]["position"]

    expected_centers = [[0, 0], [15, 15], [0, 30], [-15, 15]]
    expected_axes = [
        {"u": [0, -1, 0], "v": [1, 0, 0], "w": [0, 0, 1]},
        {"u": [1, 0, 0], "v": [0, 1, 0], "w": [0, 0, 1]},
        {"u": [0, 1, 0], "v": [-1, 0, 0], "w": [0, 0, 1]},
        {"u": [-1, 0, 0], "v": [0, -1, 0], "w": [0, 0, 1]},
    ]
    sockets = schedule["socket_frames"]
    assert [item["color"] for item in sockets] == ["red", "blue", "green", "orange"]
    for index, socket in enumerate(sockets):
        angle = index * math.pi / 2
        expected = [15 * math.sin(angle), 15 - 15 * math.cos(angle)]
        assert socket["center_mm"] == pytest.approx(expected_centers[index])
        assert socket["center_mm"] == pytest.approx(expected)
        assert socket["angle_rad"] == pytest.approx(angle)
        assert socket["rotation_rad"] == pytest.approx([0, 0, angle - math.pi/2])
        assert socket["cartridge_center_z_mm"] == 26
        assert socket["tube_bounds_z_mm"] == [6, 46]
        assert socket["local_axes"] == expected_axes[index]
        cartridge = parts[socket["color"] + "-cartridge"]
        assert cartridge["position"] == pytest.approx([*expected, 26])
        assert cartridge["rotation"] == pytest.approx([0, 0, angle - math.pi/2])


def test_fr034_source_conflicts_nulls_clearance_and_reference_card_stay_unresolved():
    data = load_geometry()
    schedule = data["assembly_schedule"]
    conflicts = {item["conflict_id"]: item for item in schedule["conflicts"]}
    for conflict_id in (
        "drum-radius-discrepancy", "blade-axis-conflict", "blade-spring-housing-extents",
        "servo-pivot-rod-closure", "vertical-stack-clearance", "scanner-read-point-basis",
        "pin-carriage-rail-endpoint", "tongue-spring-fr033-ak", "fr031-cartridge-recipe-envelope",
    ):
        assert conflicts[conflict_id]["status"] in {"CONFLICT", "UNRESOLVED"}
        assert conflicts[conflict_id]["verification_status"] == "NOT_VALIDATED"
    scanner = schedule["scanner_read_point_ambiguity"]
    assert scanner["candidate_canonical_mm"] == [[-17, 29.85, 10], [-17, -10, 29.85]]
    assert scanner["status"] == "UNRESOLVED"
    assert scanner["used_as_datum"] is False
    assert any(value is None for value in schedule["missing_values"].values())
    checks = {item["check_id"]: item for item in schedule["clearance_checks"]}
    for check_id in ("K-tray-outlet-interface", "K-credit-card-reference-separation"):
        assert checks[check_id]["status"] in {"CONFLICT", "UNRESOLVED", "NOT_CHECKED"}
        assert checks[check_id]["status"] != "PASS"
    reference = schedule["credit_card_reference"]
    assert reference["physical_component"] is False
    assert reference["export_included"] is False
    assert not any("card" in item["component_id"].lower() for item in data["components"])
    assert data["export"]["physical_component_count"] == 52


def test_sc026_requested_size_ratio_audit_and_axis_normalization_records():
    data = load_geometry()
    audit = data["scale_audit"]
    requested = {
        "cartridge": ([14.8, 12.4, 40], ["tangential_v", "radial_u", "vertical_z"], ["red-cartridge", "blue-cartridge", "green-cartridge", "orange-cartridge"]),
        "servo": ([23, 12.2, 23], ["body_long_axis", "body_short_axis", "body_height"], ["servo-unit"]),
        "lower_tongue_pull_solenoid": ([29.5, 20.6, 23.9], ["body_length", "body_width", "body_height"], ["tongue-actuator-rod"]),
        "upper_pin_solenoid": ([16, 8, 10], ["canonical_x", "canonical_y", "canonical_z"], ["pull-solenoid"]),
        "microswitch": ([12.8, 5.8, 6.5], ["body_length", "body_width", "body_height"], ["pin-carriage"]),
        "scanner": ([21.4, 13.5, 11.8], ["canonical_x", "canonical_y", "canonical_z"], ["barcode-scanner-housing"]),
        "stepper": ([28, 19], ["diameter", "height"], ["electronics-deck"]),
        "pill": ([10, 7, 5], ["canonical_x", "canonical_y", "canonical_z"], []),
    }
    expected_ratios = {
        "cartridge": [1.0000, 0.8378, 2.7027],
        "servo": [1.5541, 0.8243, 1.5541],
        "lower_tongue_pull_solenoid": [1.9932, 1.3919, 1.6149],
        "upper_pin_solenoid": [1.0811, 0.5405, 0.6757],
        "microswitch": [0.8649, 0.3919, 0.4392],
        "scanner": [1.4459, 0.9122, 0.7973],
        "stepper": [1.8919, 1.2838],
        "pill": [0.6757, 0.4730, 0.3378],
    }

    assert data["schema_version"] == 3
    assert audit["reference_width_mm"] == 14.8
    assert audit["reference_component_axis"] == "cartridge.tangential_v"
    assert audit["ratio_rounding_decimal_places"] == 4
    assert audit["relative_mismatch_formula"] == "abs(model-requested)/requested"
    assert audit["normalization_threshold_fraction"] == 0.25
    assert audit["readability_scale_factor"] == 1.0
    assert audit["verification_status"] == "NOT_VALIDATED"
    records = {record["record_id"]: record for record in audit["records"]}
    assert set(records) == set(requested)

    for record_id, (size, axes, owners) in requested.items():
        record = records[record_id]
        assert record["requested_size_mm"] == size
        assert record["requested_axes"] == axes
        assert record["owner_component_ids"] == owners
        assert record["provenance"] == "USER_SPECIFIED"
        assert record["source_ref"] == "user-request:phase18-step1-2026-10-12"
        assert record["verification_status"] == "NOT_VALIDATED"
        assert record["ratio_to_reference"] == [round(value / 14.8, 4) for value in size]
        assert record["ratio_to_reference"] == expected_ratios[record_id]
        assert len(record["axis_correspondence"]) == len(size)
        assert record["model_size_before_mm"] is None or len(record["model_size_before_mm"]) == len(size)
        assert len(record["model_size_current_mm"]) == len(size)
        assert len(record["relative_mismatch_before"]) == len(size)
        assert len(record["relative_mismatch_current"]) == len(size)
        for index, requested_value in enumerate(size):
            before = record["model_size_before_mm"]
            before_mismatch = (None if before is None else abs(before[index] - requested_value) / requested_value)
            assert record["relative_mismatch_before"][index] == pytest.approx(before_mismatch)
            current_mismatch = abs(record["model_size_current_mm"][index] - requested_value) / requested_value
            assert record["relative_mismatch_current"][index] == pytest.approx(current_mismatch)
            if before is not None and before_mismatch > audit["normalization_threshold_fraction"]:
                assert record["model_size_current_mm"][index] == requested_value
                assert record["axis_disposition"][index] == "NORMALIZED_TO_REQUESTED"
            elif before is not None and before_mismatch == audit["normalization_threshold_fraction"]:
                expected = ("OVERRIDDEN_TO_REQUESTED_BY_SC029"
                            if (record_id, index) == ("upper_pin_solenoid", 1) else "REPORTED_AT_THRESHOLD")
                assert record["axis_disposition"][index] == expected
            elif before is not None and before_mismatch > 0:
                assert record["axis_disposition"][index] == "REPORTED_BELOW_THRESHOLD"
            else:
                assert record["model_size_current_mm"][index] == requested_value
        assert record["axis_mapping_status"] in {"ASSUMED", "UNRESOLVED"}
        assert record["readability_scale_factor"] == 1.0

    recipe_by_id = {recipe["recipe_id"]: recipe for recipe in data["component_recipes"]}
    parts_by_id = {part["component_id"]: part for part in data["components"]}
    assert recipe_by_id["cartridge"]["parameters"]["size"] == [12.4, 14.8, 40]
    assert recipe_by_id["cartridge"]["parameters"]["size_axes"] == "local X=radial u, local Y=tangential v"
    assert recipe_by_id["cartridge-recipe-fr031"]["parameters"]["size"] == [12.8, 10.4, 40]
    assert records["cartridge"]["historical_recipe_conflict"]["recipe_id"] == "cartridge-recipe-fr031"
    assert records["cartridge"]["historical_recipe_conflict"]["status"] == "HISTORICAL_CONFLICT"
    assert all(parts_by_id[f"{color}-cartridge"]["recipe_id"] == "cartridge"
               for color in ("red", "blue", "green", "orange"))
    assert len(parts_by_id) == data["export"]["physical_component_count"] == 52

    from dispenser_sim.viz3d.mesh import bounds
    from dispenser_sim.viz3d.scene import build_concept_assembly

    assembly_by_id = {part.component_id: part for part in build_concept_assembly().parts}
    cartridge_bounds = bounds(assembly_by_id["red-cartridge"].mesh,
                              assembly_by_id["red-cartridge"].placement_transform)
    assert cartridge_bounds[0][2] == pytest.approx(6)
    assert cartridge_bounds[1][2] == pytest.approx(46)
    servo = parts_by_id["servo-unit"]
    servo_recipe = recipe_by_id[servo["recipe_id"]]
    assert servo_recipe["parameters"]["size"] == [12.2, 23, 22.7]
    assert servo["position"] == [0, -59.7, 27.95]
    assert records["servo"]["model_size_before_mm"] == [23, 12.2, 22.7]
    assert records["servo"]["axis_disposition"][2] == "REPORTED_BELOW_THRESHOLD"

    for recipe_id, submesh_id, requested_size in (
        ("tongue-rod", "lower-tongue-pull-solenoid-body", [29.5, 20.6, 23.9]),
        ("carriage", "microswitch-body", [12.8, 5.8, 6.5]),
        ("electronics-deck", "stepper-body", [28, 19]),
    ):
        integrated = recipe_by_id[recipe_id]["integrated_submeshes"]
        feature = next(item for item in integrated if item["submesh_id"] == submesh_id)
        assert feature["parameters"]["size_mm"] == requested_size
        assert feature["provenance"] == "USER_SPECIFIED"
        assert feature["verification_status"] == "NOT_VALIDATED"
        assert feature["owner_component_id"] in {component_id for component_id in records["lower_tongue_pull_solenoid"]["owner_component_ids"] + records["microswitch"]["owner_component_ids"] + records["stepper"]["owner_component_ids"]}
    assert parts_by_id["pull-solenoid"]["recipe_id"] == "solenoid"
    assert parts_by_id["pull-solenoid"]["name"] == "Pull Solenoid"


@pytest.mark.parametrize("mutation", [
    lambda data: data["scale_audit"]["records"][0].update(provenance="ASSUMED"),
    lambda data: data["scale_audit"]["records"][0]["ratio_to_reference"].__setitem__(0, 2.0),
    lambda data: data["scale_audit"]["records"][0]["requested_size_mm"].__setitem__(0, 15.0),
    lambda data: data["scale_audit"]["records"][0].update(verification_status="VALIDATED"),
])
def test_sc026_schema_rejects_mutated_size_ratio_or_provenance(mutation):
    data = json.loads(json.dumps(load_geometry()))
    mutation(data)
    with pytest.raises(ValueError, match="scale|size|ratio|provenance|NOT_VALIDATED"):
        validate_geometry(data)


def test_sc029_source_declares_distinct_upper_and_lower_actuator_zones_and_chains():
    data = load_geometry()
    schedule = data["assembly_schedule"]
    zones = schedule.get("actuator_zones")
    assert isinstance(zones, dict), "SC-029 actuator-zone schedule is missing"

    upper = zones["upper"]
    assert upper["carriage_rail_z_band_mm"] == [14, 20]
    assert upper["pin_solenoid_component_id"] == "pull-solenoid"
    assert upper["pin_solenoid_role"] == "upper_vertical_pin_solenoid"
    assert upper["pin_solenoid_z_bounds_mm"] == [20.5, 34]
    assert upper["pin_solenoid_tower_zone_relation"] == "separate_from_four_tower_bank"
    assert upper["pin_solenoid_tower_zone_status"] == "ASSUMED"
    assert upper["servo_tower_zone_relation"] == "separate_from_four_tower_bank"
    assert upper["servo_tower_zone_status"] == "ASSUMED"
    assert upper["drive_chain"] == [
        "servo-unit", "servo-crank", "connecting-rod", "pin-carriage",
    ]
    assert upper["shaft_to_selected_slot_chain"] == [
        "servo-unit", "servo-output-shaft", "servo-crank", "crank-pin",
        "connecting-rod", "pin-carriage", "carriage-rail-left",
        "carriage-rail-right", "pull-solenoid", "upper-solenoid-armature",
        "engagement-pin", "selected-blade-slot",
    ]
    assert upper["guide_component_ids"] == ["carriage-rail-left", "carriage-rail-right"]
    assert upper["pin_chain"] == ["pull-solenoid", "engagement-pin", "selected-blade-slot"]
    assert upper["crank_radius_mm"] == 5.2
    assert upper["connecting_rod_length_mm"] == 34
    assert upper["exact_mount_offsets_mm"] is None
    assert upper["interface_status"] == "UNRESOLVED"

    lower = zones["lower_tongue"]
    assert lower["center_z_mm"] == pytest.approx(-0.75)
    assert lower["tower_zone_relation"] == "separate_from_four_tower_bank"
    assert lower["tower_zone_status"] == "ASSUMED"
    assert lower["pull_axis_canonical"] == [0, -1, 0]
    assert lower["pull_solenoid_submesh_id"] == "lower-tongue-pull-solenoid-body"
    assert lower["pull_solenoid_owner_component_id"] == "tongue-actuator-rod"
    assert lower["actuator_chain"] == [
        "lower-tongue-pull-solenoid", "lower-plunger", "lower-tongue-moving-carriage",
        "lower-tongue-strap", "shared-lower-tongue",
    ]
    assert lower["compression_spring_component_id"] == "tongue-return-spring"
    assert lower["spring_concentric_with_node_id"] == "lower-plunger"
    assert lower["spring_moving_endpoint_node_id"] == "lower-tongue-moving-carriage"
    assert lower["spring_fixed_endpoint_component_id"] == "station-housing"
    assert lower["exact_mount_offsets_mm"] is None
    assert lower["interface_status"] == "UNRESOLVED"

    component_ids = {item["component_id"] for item in data["components"]}
    assert len(component_ids) == data["export"]["physical_component_count"] == 52
    assert "lower-tongue-pull-solenoid" not in component_ids
    assert "lower-plunger" not in component_ids
    assert "lower-tongue-moving-carriage" not in component_ids
    assert "lower-tongue-strap" not in component_ids


def test_sc029_source_keeps_unspecified_actuator_contacts_null_and_unresolved():
    data = load_geometry()
    schedule = data["assembly_schedule"]
    zones = schedule.get("actuator_zones")
    assert isinstance(zones, dict), "SC-029 actuator-zone schedule is missing"
    assert zones["upper"]["crank_pin_offset_mm"] is None
    assert zones["upper"]["rod_carriage_joint_offset_mm"] is None
    assert zones["upper"]["selected_slot_contact_mm"] is None
    assert zones["lower_tongue"]["plunger_carriage_contact_mm"] is None
    assert zones["lower_tongue"]["spring_end_seat_offsets_mm"] is None
    assert zones["lower_tongue"]["interface_status"] == "UNRESOLVED"
    assert schedule["servo_schedule"]["angle_to_pin_coordinate_mapping"] is None
    assert schedule["servo_schedule"]["mapping_status"] == "UNRESOLVED"

    topology = schedule["touch_topology"]
    edges = {
        (edge["source_node_id"], edge["target_node_id"]): edge
        for edge in topology["edges"]
    }
    for pair in (
        ("crank-pin", "connecting-rod"),
        ("connecting-rod", "pin-carriage"),
        ("lower-plunger", "lower-tongue-moving-carriage"),
        ("tongue-return-spring", "lower-tongue-moving-carriage"),
        ("tongue-return-spring", "tongue-fixed-bracket"),
    ):
        assert edges[pair]["contact_point_mm"] is None
        assert edges[pair]["status"] == "UNRESOLVED"


@pytest.mark.parametrize("mutation", [
    lambda data: data["assembly_schedule"]["drive_train"].update(provenance="USER_SPECIFIED"),
    lambda data: data["assembly_schedule"]["drive_train"].update(pass_claimed=True),
    lambda data: data["assembly_schedule"]["conflicts"].pop(-1),
    lambda data: data["assembly_schedule"]["drive_train"]["members"].pop(),
])
def test_drive_train_schema_rejects_promoted_or_incomplete_records(mutation):
    data = json.loads(json.dumps(load_geometry()))
    mutation(data)
    with pytest.raises(ValueError):
        validate_geometry(data)
