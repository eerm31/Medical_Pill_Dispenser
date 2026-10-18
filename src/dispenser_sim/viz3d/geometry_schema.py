"""Strict stdlib loader for the canonical scan-derived concept geometry."""
from __future__ import annotations

import hashlib
import json
import math
from importlib.resources import files
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 3
EXPECTED_COMPONENTS = 52
SC026_SOURCE_REF = "user-request:phase18-step1-2026-10-12"
SC026_REFERENCE_WIDTH_MM = 14.8
SC026_THRESHOLD = 0.25
REFERENCE_MODEL_REF = "user-supplied reference model: Dispenser with cartridge barcode subsystem (3D, animated)-2.html"
OVERLAP_EPS_MM = 0.05
DRIVE_TRAIN_SOURCE_REF = "user-request:stepper-under-base-2026-10-12"
CONTACT_KINDS = {"SEAT", "BEARING", "HINGE", "LATCH", "SHAFT", "THROUGH", "CONCENTRIC"}
SC026_EXPECTED = {
    "cartridge": ([14.8, 12.4, 40], ["tangential_v", "radial_u", "vertical_z"],
                  ["red-cartridge", "blue-cartridge", "green-cartridge", "orange-cartridge"],
                  [14.8, 12.4, 40], "cartridge", None, ["radial_u", "tangential_v", "vertical_z"], [1, 0, 2]),
    "servo": ([23, 12.2, 23], ["body_long_axis", "body_short_axis", "body_height"], ["servo-unit"],
              [23, 12.2, 22.7], "servo", None, ["canonical_x", "canonical_y", "canonical_z"], [1, 0, 2]),
    "lower_tongue_pull_solenoid": ([29.5, 20.6, 23.9], ["body_length", "body_width", "body_height"], ["tongue-actuator-rod"],
                                   None, "tongue-rod", "lower-tongue-pull-solenoid-body", ["local_x", "local_y", "local_z"], [0, 1, 2]),
    "upper_pin_solenoid": ([16, 8, 10], ["canonical_x", "canonical_y", "canonical_z"], ["pull-solenoid"],
                            [6, 6, 13.5], "solenoid", None, ["canonical_x", "canonical_y", "canonical_z"], [0, 1, 2]),
    "microswitch": ([12.8, 5.8, 6.5], ["body_length", "body_width", "body_height"], ["pin-carriage"],
                    None, "carriage", "microswitch-body", ["local_x", "local_y", "local_z"], [0, 1, 2]),
    "scanner": ([21.4, 13.5, 11.8], ["canonical_x", "canonical_y", "canonical_z"], ["barcode-scanner-housing"],
                [12, 8, 9], "scanner", None, ["canonical_x", "canonical_y", "canonical_z"], [0, 1, 2]),
    "stepper": ([28, 19], ["diameter", "height"], ["electronics-deck"],
                None, "electronics-deck", "stepper-body", ["diameter", "height"], [0, 1]),
    "pill": ([10, 7, 5], ["canonical_x", "canonical_y", "canonical_z"], [],
             [10, 7, 5], None, None, ["canonical_x", "canonical_y", "canonical_z"], [0, 1, 2]),
}
EXPECTED_IDS = (
    "station-housing", "central-post", "rotating-drum",
    "red-cartridge", "blue-cartridge", "green-cartridge", "orange-cartridge",
    "red-cap", "blue-cap", "green-cap", "orange-cap",
    "red-upper-blade-tab", "blue-upper-blade-tab", "green-upper-blade-tab", "orange-upper-blade-tab",
    "red-upper-blade-return-spring", "blue-upper-blade-return-spring", "green-upper-blade-return-spring", "orange-upper-blade-return-spring",
    "servo-unit", "servo-crank", "connecting-rod", "pin-carriage", "carriage-rail-left", "carriage-rail-right",
    "pull-solenoid", "engagement-pin", "shared-lower-tongue", "tongue-actuator-rod", "tongue-return-spring",
    "barcode-scanner-housing", "outlet-tray",
    "red-cap-label-plate", "blue-cap-label-plate", "green-cap-label-plate", "orange-cap-label-plate",
    "red-passive-tag-carrier", "blue-passive-tag-carrier", "green-passive-tag-carrier", "orange-passive-tag-carrier",
    "red-cap-hinge-assembly", "blue-cap-hinge-assembly", "green-cap-hinge-assembly", "orange-cap-hinge-assembly",
    "red-cap-latch-body", "blue-cap-latch-body", "green-cap-latch-body", "orange-cap-latch-body",
    "electronics-deck", "controller-board-placeholder", "scanner-head-placeholder", "scanner-mount",
)
EXPECTED_NAMES = (
    "Station Housing", "Central Post", "Rotating Drum",
    "Red Cartridge", "Blue Cartridge", "Green Cartridge", "Orange Cartridge",
    "Red Cap", "Blue Cap", "Green Cap", "Orange Cap",
    "Red Upper Blade Tab", "Blue Upper Blade Tab", "Green Upper Blade Tab", "Orange Upper Blade Tab",
    "Red Upper Blade Return Spring", "Blue Upper Blade Return Spring", "Green Upper Blade Return Spring", "Orange Upper Blade Return Spring",
    "Servo Unit", "Servo Crank", "Connecting Rod", "Pin Carriage", "Carriage Rail Left", "Carriage Rail Right",
    "Pull Solenoid", "Engagement Pin", "Shared Lower Tongue", "Tongue Actuator Rod", "Tongue Return Spring",
    "Barcode Scanner Housing", "Outlet Tray",
    "Red Cap Label Plate", "Blue Cap Label Plate", "Green Cap Label Plate", "Orange Cap Label Plate",
    "Red Passive Tag Carrier", "Blue Passive Tag Carrier", "Green Passive Tag Carrier", "Orange Passive Tag Carrier",
    "Red Cap Hinge Assembly", "Blue Cap Hinge Assembly", "Green Cap Hinge Assembly", "Orange Cap Hinge Assembly",
    "Red Cap Latch Body", "Blue Cap Latch Body", "Green Cap Latch Body", "Orange Cap Latch Body",
    "Electronics Deck", "Controller Board Placeholder", "Scanner Head Placeholder", "Scanner Mount",
)
LEGACY_COMPONENT_COUNT = 32
PLACEHOLDER_COMPONENT_IDS = EXPECTED_IDS[LEGACY_COMPONENT_COUNT:]
PROVENANCE = {"USER_SPECIFIED", "SCAN_EXPLICIT", "SCAN_INFERRED", "ASSUMED", "DERIVED", "DEMO_FIXTURE", "MISSING"}
RECIPE_KINDS = {"box", "compound_box", "slotted_gate", "blade_with_wedge", "cylinder", "ring", "cone", "rod", "helix", "extrusion", "profile"}


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def source_hash(value: Any) -> str:
    return hashlib.sha256(canonical_json(value)).hexdigest()


def _finite(value: Any) -> bool:
    if isinstance(value, bool):
        return True
    if isinstance(value, (int, float)):
        return math.isfinite(value)
    if isinstance(value, list):
        return all(_finite(item) for item in value)
    if isinstance(value, dict):
        return all(_finite(item) for item in value.values())
    return True


def _positive_finite_vector(value: Any, length: int, field: str) -> list[float]:
    if (not isinstance(value, list) or len(value) != length
            or any(not isinstance(item, (int, float)) or isinstance(item, bool)
                   or not math.isfinite(item) or item <= 0 for item in value)):
        raise ValueError(f"scale audit {field} must contain {length} finite positive values")
    return value


def _validate_sc026_scale_audit(data: dict[str, Any], recipes_by_id: dict[str, dict[str, Any]],
                                by_component: dict[str, dict[str, Any]], dimension_by_id: dict[str, dict[str, Any]]) -> None:
    audit = data.get("scale_audit")
    if (not isinstance(audit, dict) or audit.get("schema_version") != 1
            or audit.get("reference_width_mm") != SC026_REFERENCE_WIDTH_MM
            or audit.get("reference_component_axis") != "cartridge.tangential_v"
            or audit.get("ratio_rounding_decimal_places") != 4
            or audit.get("relative_mismatch_formula") != "abs(model-requested)/requested"
            or audit.get("normalization_threshold_fraction") != SC026_THRESHOLD
            or audit.get("normalization_is_strictly_greater_than_threshold") is not True
            or audit.get("readability_scale_factor") != 1.0
            or audit.get("source_ref") != SC026_SOURCE_REF
            or audit.get("verification_status") != "NOT_VALIDATED"):
        raise ValueError("SC-026 scale audit reference, threshold, provenance, or status is invalid")
    records = audit.get("records")
    if not isinstance(records, list) or [item.get("record_id") for item in records] != list(SC026_EXPECTED):
        raise ValueError("SC-026 scale audit must contain the eight requested records in stable order")

    for record in records:
        record_id = record["record_id"]
        (requested, requested_axes, owners, before, recipe_id, submesh_id,
         raw_axes, requested_order) = SC026_EXPECTED[record_id]
        count = len(requested)
        if (record.get("dimension_id") not in dimension_by_id
                or record.get("requested_size_mm") != requested
                or record.get("requested_axes") != requested_axes
                or record.get("provenance") != "USER_SPECIFIED"
                or record.get("source_ref") != SC026_SOURCE_REF
                or record.get("verification_status") != "NOT_VALIDATED"
                or record.get("owner_component_ids") != owners
                or record.get("axis_mapping_status") not in {"ASSUMED", "UNRESOLVED"}
                or record.get("readability_scale_factor") != 1.0):
            raise ValueError(f"SC-026 requested size/provenance contract is invalid for {record_id}")
        dimension = dimension_by_id[record["dimension_id"]]
        if (dimension.get("value") != requested or dimension.get("unit") != "mm"
                or dimension.get("provenance") != "USER_SPECIFIED"
                or dimension.get("verification_status") != "NOT_VALIDATED"):
            raise ValueError(f"SC-026 dimension record differs from the requested source value for {record_id}")
        axis_correspondence = record.get("axis_correspondence")
        if (not isinstance(axis_correspondence, list) or len(axis_correspondence) != count
                or any(not isinstance(axis, str) or not axis for axis in axis_correspondence)):
            raise ValueError(f"SC-026 axis correspondence must be explicit for {record_id}")
        source = record.get("model_source")
        if not isinstance(source, dict) or source.get("recipe_id") != recipe_id:
            if record_id != "pill":
                raise ValueError(f"SC-026 recipe source is missing for {record_id}")
        if record_id == "pill":
            if (source.get("source") != "demo.pill_size_mm"
                    or data["demo"].get("pill_size_mm") != requested
                    or record.get("demo_only") is not True
                    or record.get("exported_physical_component") is not False):
                raise ValueError("SC-026 pill size must remain fictional demo-only and unexported")
            raw_size = data["demo"].get("pill_size_mm")
        else:
            if recipe_id not in recipes_by_id:
                raise ValueError(f"SC-026 model recipe is missing for {record_id}")
            recipe = recipes_by_id[recipe_id]
            if submesh_id is None:
                raw_size = recipe.get("parameters", {}).get("size")
            else:
                integrated = recipe.get("integrated_submeshes", ())
                submesh = next((item for item in integrated if item.get("submesh_id") == submesh_id), None)
                if (submesh is None or submesh.get("owner_component_id") not in by_component
                        or submesh.get("provenance") != "USER_SPECIFIED"
                        or submesh.get("source_ref") != SC026_SOURCE_REF
                        or submesh.get("verification_status") != "NOT_VALIDATED"
                        or submesh.get("placement_status") not in {"ASSUMED", "UNRESOLVED"}):
                    raise ValueError(f"SC-026 integrated submesh ownership/source is invalid for {record_id}")
                raw_size = submesh.get("parameters", {}).get("size_mm")
                if record_id == "stepper" and submesh.get("kind") != "cylinder":
                    raise ValueError("SC-026 stepper submesh must retain its diameter/height cylinder recipe")
                if record_id != "stepper" and submesh.get("kind") != "box":
                    raise ValueError(f"SC-026 bounded submesh recipe kind is invalid for {record_id}")
                expected_owner = owners[0]
                if submesh.get("owner_component_id") != expected_owner:
                    raise ValueError(f"SC-026 integrated submesh must remain within {expected_owner}")
        _positive_finite_vector(raw_size, count, f"{record_id}.model source")
        if (source.get("raw_size_mm") != raw_size
                or source.get("raw_axis_order") != raw_axes
                or source.get("requested_order_from_model") != requested_order):
            raise ValueError(f"SC-026 model axis mapping/source dimensions differ for {record_id}")
        current = [raw_size[index] for index in requested_order]
        if record.get("model_size_current_mm") != current:
            raise ValueError(f"SC-026 current recipe size differs from its audit record for {record_id}")
        if before is None:
            if (record.get("model_size_before_mm") is not None
                    or record.get("relative_mismatch_before") != [None] * count
                    or any(value != requested_value for value, requested_value in zip(current, requested))
                    or record.get("axis_disposition") != ["ADDED_INTEGRATED_SUBMESH"] * count):
                raise ValueError(f"SC-026 new integrated geometry must use exact requested sizes for {record_id}")
        else:
            _positive_finite_vector(before, count, f"{record_id}.pre-correction size")
            if record.get("model_size_before_mm") != before:
                raise ValueError(f"SC-026 historical model size differs for {record_id}")
        before_mismatch = ([None] * count if before is None else
                           [abs(value - requested_value) / requested_value for value, requested_value in zip(before, requested)])
        current_mismatch = [abs(value - requested_value) / requested_value for value, requested_value in zip(current, requested)]
        if (len(record.get("relative_mismatch_before", ())) != count
                or len(record.get("relative_mismatch_current", ())) != count
                or len(record.get("axis_disposition", ())) != count):
            raise ValueError(f"SC-026 per-axis mismatch/disposition records are incomplete for {record_id}")
        for index in range(count):
            old_error = before_mismatch[index]
            new_error = current_mismatch[index]
            if old_error is None:
                if record["relative_mismatch_before"][index] is not None:
                    raise ValueError(f"SC-026 missing pre-correction geometry must remain null for {record_id}")
                expected_disposition = "ADDED_INTEGRATED_SUBMESH"
            else:
                if not math.isclose(record["relative_mismatch_before"][index], old_error, rel_tol=0, abs_tol=1e-12):
                    raise ValueError(f"SC-026 pre-correction mismatch calculation is invalid for {record_id}")
                if old_error > SC026_THRESHOLD:
                    if current[index] != requested[index]:
                        raise ValueError(f"SC-026 mismatch above 25% was not normalized for {record_id}")
                    expected_disposition = "NORMALIZED_TO_REQUESTED"
                elif math.isclose(old_error, SC026_THRESHOLD, rel_tol=0, abs_tol=1e-12):
                    if record_id == "upper_pin_solenoid" and index == 1:
                        override = record.get("sc029_exact_size_override")
                        if (current[index] != requested[index]
                                or override != {
                                    "source_ref": "user-request:phase18-t122-sc029-2026-10-12",
                                    "reason": "Explicitly reaffirmed 16x8x10 mm upper Pull Solenoid envelope",
                                    "supersedes": "strict SC-026 exactly-threshold keep-original disposition",
                                    "provenance": "USER_SPECIFIED",
                                    "verification_status": "NOT_VALIDATED",
                                }):
                            raise ValueError("SC-029 upper Pull Solenoid exact-size override must remain source-attributed and unresolved")
                        expected_disposition = "OVERRIDDEN_TO_REQUESTED_BY_SC029"
                    else:
                        if current[index] != before[index]:
                            raise ValueError(f"SC-026 exactly-threshold dimension must be reported, not normalized, for {record_id}")
                        expected_disposition = "REPORTED_AT_THRESHOLD"
                elif old_error > 0:
                    if current[index] != before[index]:
                        raise ValueError(f"SC-026 below-threshold dimension must be reported, not normalized, for {record_id}")
                    expected_disposition = "REPORTED_BELOW_THRESHOLD"
                else:
                    if current[index] != requested[index]:
                        raise ValueError(f"SC-026 matching dimension changed silently for {record_id}")
                    expected_disposition = "MATCH"
            if (not math.isclose(record["relative_mismatch_current"][index], new_error, rel_tol=0, abs_tol=1e-12)
                    or record["axis_disposition"][index] != expected_disposition):
                raise ValueError(f"SC-026 current mismatch/disposition is invalid for {record_id}")
            expected_ratio = round(requested[index] / SC026_REFERENCE_WIDTH_MM, 4)
            if record.get("ratio_to_reference", [])[index] != expected_ratio:
                raise ValueError(f"SC-026 derived ratio is invalid for {record_id}")
        if len(record.get("ratio_to_reference", ())) != count:
            raise ValueError(f"SC-026 ratio dimensions are incomplete for {record_id}")

    cartridge_recipe = recipes_by_id.get("cartridge")
    history = recipes_by_id.get("cartridge-recipe-fr031")
    if (cartridge_recipe is None or history is None
            or history.get("historical_only") is not True
            or history.get("current_for_components") is not False
            or history.get("conflict_id") != "fr031-cartridge-recipe-envelope"
            or history.get("parameters", {}).get("size") != [12.8, 10.4, 40]
            or history.get("parameters", {}).get("status") != "HISTORICAL_RECIPE_CONFLICT_NOT_CURRENT"
            or any(component.get("recipe_id") == "cartridge-recipe-fr031" for component in by_component.values())):
        raise ValueError("FR-031 cartridge recipe must remain historical-only and not define current geometry")
    if (by_component["pull-solenoid"].get("name") != "Pull Solenoid"
            or len(by_component) != EXPECTED_COMPONENTS):
        raise ValueError("SC-026 must preserve the existing upper solenoid identity and exact 52-part inventory")


def _validate_sc029_actuator_zones(data: dict[str, Any], schedule: dict[str, Any],
                                   components: dict[str, dict[str, Any]],
                                   recipes: dict[str, dict[str, Any]]) -> None:
    zones = schedule.get("actuator_zones")
    if (not isinstance(zones, dict) or zones.get("provenance") != "ASSUMED"
            or zones.get("verification_status") != "NOT_VALIDATED"):
        raise ValueError("SC-029 actuator zones must be explicit ASSUMED/NOT_VALIDATED source records")
    upper = zones.get("upper", {})
    upper_recipe = recipes.get(components["pull-solenoid"]["recipe_id"], {})
    upper_placement = next(item for item in schedule["component_placements"]
                           if item["component_id"] == "pull-solenoid")
    if (upper.get("carriage_rail_z_band_mm") != [14, 20]
            or upper.get("guide_component_ids") != ["carriage-rail-left", "carriage-rail-right"]
            or upper.get("pin_solenoid_component_id") != "pull-solenoid"
            or upper.get("pin_solenoid_name") != "Pull Solenoid"
            or upper.get("pin_solenoid_role") != "upper_vertical_pin_solenoid"
            or upper.get("pin_solenoid_size_mm") != [16, 8, 10]
            or upper_recipe.get("parameters", {}).get("size") != [16, 8, 10]
            or upper.get("pin_solenoid_z_bounds_mm") != [20.5, 34]
            or upper.get("pin_solenoid_source_z_bounds_mm") != [20.5, 34]
            or upper.get("pin_solenoid_rendered_recipe_z_bounds_mm") != [22.25, 32.25]
            or upper.get("pin_solenoid_source_bounds_status") != "UNRESOLVED_CONFLICT"
            or upper.get("pin_solenoid_tower_zone_relation") != "separate_from_four_tower_bank"
            or upper.get("pin_solenoid_tower_zone_status") != "ASSUMED"
            or upper.get("servo_tower_zone_relation") != "separate_from_four_tower_bank"
            or upper.get("servo_tower_zone_status") != "ASSUMED"
            or upper.get("pin_solenoid_motion_owner_component_id") != "pin-carriage"
            or upper_placement.get("parent_component_id") != "pin-carriage"
            or upper_placement.get("rendered_fallback_position_mm") != [0, -14.8, 27.25]
            or upper.get("drive_chain") != ["servo-unit", "servo-crank", "connecting-rod", "pin-carriage"]
            or upper.get("shaft_to_selected_slot_chain") != [
                "servo-unit", "servo-output-shaft", "servo-crank", "crank-pin", "connecting-rod",
                "pin-carriage", "carriage-rail-left", "carriage-rail-right", "pull-solenoid",
                "upper-solenoid-armature", "engagement-pin", "selected-blade-slot"]
            or upper.get("pin_chain") != ["pull-solenoid", "engagement-pin", "selected-blade-slot"]
            or upper.get("crank_radius_mm") != 5.2
            or upper.get("connecting_rod_length_mm") != 34
            or upper.get("exact_mount_offsets_mm") is not None
            or upper.get("crank_pin_offset_mm") is not None
            or upper.get("rod_carriage_joint_offset_mm") is not None
            or upper.get("selected_slot_contact_mm") is not None
            or upper.get("interface_status") != "UNRESOLVED"):
        raise ValueError("SC-029 upper actuator identity, envelope, fallback bounds, chain, or unresolved contacts changed")

    carriage_recipe = recipes.get(components["pin-carriage"]["recipe_id"], {})
    carriage_parameters = carriage_recipe.get("parameters", {})
    microswitch = next((item for item in carriage_recipe.get("integrated_submeshes", ())
                        if item.get("submesh_id") == "microswitch-body"), None)
    if (carriage_parameters.get("size") != [14, 9, 6]
            or carriage_parameters.get("specified_z_bounds_mm") != [14, 20]
            or microswitch is None
            or microswitch.get("owner_component_id") != "pin-carriage"
            or microswitch.get("parameters", {}).get("size_mm") != [12.8, 5.8, 6.5]
            or microswitch.get("source_position_mm") is not None
            or microswitch.get("position_status") != "ASSUMED_RENDERED_FALLBACK"
            or microswitch.get("rendered_fallback_provenance") != "ASSUMED"
            or microswitch.get("rotation_rad") != [math.pi / 2, 0, 0]
            or microswitch.get("orientation_status") != "ASSUMED_RENDERED_FALLBACK"):
        raise ValueError("SC-029 carriage/microswitch bounded recipe and assumed fallback orientation are invalid")

    lower = zones.get("lower_tongue", {})
    lower_recipe = recipes.get(components["tongue-actuator-rod"]["recipe_id"], {})
    integrated = {item.get("submesh_id"): item for item in lower_recipe.get("integrated_submeshes", ())}
    expected_submeshes = {
        "lower-tongue-pull-solenoid-body", "lower-plunger",
        "lower-tongue-moving-carriage", "lower-tongue-strap",
    }
    if (lower.get("center_z_mm") != -0.75
            or lower.get("actuator_group_center_fallback_mm") != [0, -62.15, -0.75]
            or lower.get("tower_zone_relation") != "separate_from_four_tower_bank"
            or lower.get("tower_zone_status") != "ASSUMED"
            or lower.get("pull_axis_canonical") != [0, -1, 0]
            or lower.get("pull_solenoid_submesh_id") != "lower-tongue-pull-solenoid-body"
            or lower.get("pull_solenoid_size_mm") != [29.5, 20.6, 23.9]
            or lower.get("pull_solenoid_owner_component_id") != "tongue-actuator-rod"
            or lower.get("integrated_submesh_owner_component_id") != "tongue-actuator-rod"
            or set(lower.get("integrated_submesh_ids", ())) != expected_submeshes
            or lower.get("actuator_chain") != [
                "lower-tongue-pull-solenoid", "lower-plunger", "lower-tongue-moving-carriage",
                "lower-tongue-strap", "shared-lower-tongue"]
            or lower.get("compression_spring_component_id") != "tongue-return-spring"
            or lower.get("spring_axis_canonical") != [0, 1, 0]
            or lower.get("spring_concentric_with_node_id") != "lower-plunger"
            or lower.get("spring_center_fallback_mm") != [0, -57.15, -0.75]
            or lower.get("spring_rendered_fallback_provenance") != "ASSUMED"
            or lower.get("spring_moving_endpoint_node_id") != "lower-tongue-moving-carriage"
            or lower.get("spring_fixed_endpoint_component_id") != "station-housing"
            or lower.get("fixed_bracket_feature_id") != "tongue-return-fixed-bracket"
            or lower.get("fixed_bracket_owner_component_id") != "station-housing"
            or lower.get("fixed_bracket_position_mm") is not None
            or lower.get("plunger_carriage_contact_mm") is not None
            or lower.get("spring_end_seat_offsets_mm") is not None
            or lower.get("exact_mount_offsets_mm") is not None
            or lower.get("interface_status") != "UNRESOLVED"):
        raise ValueError("SC-029 lower actuator zone, chain ownership, or unresolved interface data changed")
    if not expected_submeshes <= integrated.keys():
        raise ValueError("SC-029 lower chain is missing an integrated Tongue Actuator Rod submesh")
    for feature_id in expected_submeshes:
        feature = integrated[feature_id]
        if (feature.get("owner_component_id") != "tongue-actuator-rod"
                or feature.get("source_position_mm") is not None
                or feature.get("position_status") != "ASSUMED_RENDERED_FALLBACK"
                or feature.get("rendered_fallback_provenance") != "ASSUMED"
                or feature.get("provenance") not in {"USER_SPECIFIED", "ASSUMED"}
                or feature.get("verification_status") != "NOT_VALIDATED"):
            raise ValueError(f"SC-029 integrated submesh ownership/source status is invalid: {feature_id}")
    lower_body = integrated["lower-tongue-pull-solenoid-body"]
    if lower_body.get("parameters", {}).get("size_mm") != [29.5, 20.6, 23.9]:
        raise ValueError("SC-029 lower Pull Solenoid must retain the exact requested envelope")
    for feature_id in ("lower-plunger", "lower-tongue-moving-carriage", "lower-tongue-strap"):
        if (integrated[feature_id].get("display_size_only") is not True
                or integrated[feature_id].get("source_dimensions_mm") is not None):
            raise ValueError(f"SC-029 unsourced lower-actuator display geometry must remain schematic: {feature_id}")

    spring_component = components["tongue-return-spring"]
    spring_placement = next(item for item in schedule["component_placements"]
                            if item["component_id"] == "tongue-return-spring")
    spring_parameters = recipes[spring_component["recipe_id"]].get("parameters", {})
    if (spring_component.get("position") != [0, -57.15, -0.75]
            or spring_placement.get("rendered_fallback_position_mm") != [0, -57.15, -0.75]
            or lower.get("fixed_bracket_rendered_fallback_mm") != [0, -68, -0.75]
            or spring_placement.get("source_position_mm") is not None
            or lower.get("spring_end_seat_offsets_mm") is not None
            or spring_parameters.get("legacy_dimension_status") != "HISTORICAL_CONFLICT_NOT_CURRENT_SPRING_LENGTH"):
        raise ValueError("SC-029 lower compression-spring rendering must keep its assumed fallback and null source seats")


def _validate_contact_entries(schedule: dict[str, Any], key: str, ids: set[str]) -> set[tuple[str, str]]:
    entries = schedule.get(key)
    if not isinstance(entries, list) or not entries:
        raise ValueError(f"assembly_schedule.{key} must be a non-empty list")
    seen_ids: set[str] = set()
    pairs: set[tuple[str, str]] = set()
    for entry in entries:
        pair = entry.get("component_ids") if isinstance(entry, dict) else None
        contact_id = entry.get("contact_id") if isinstance(entry, dict) else None
        if (not isinstance(contact_id, str) or not contact_id or contact_id in seen_ids
                or not isinstance(pair, list) or len(pair) != 2 or pair != sorted(pair)
                or pair[0] == pair[1] or not set(pair) <= ids or tuple(pair) in pairs
                or entry.get("status") != "ASSUMED"
                or entry.get("verification_status") != "NOT_VALIDATED"
                or entry.get("pass_claimed") is not False
                or not isinstance(entry.get("rationale"), str) or not entry["rationale"]):
            raise ValueError(f"{key} entries need unique IDs, a sorted distinct known component pair, ASSUMED/NOT_VALIDATED status and no PASS claim: {contact_id}")
        if key == "intended_contacts" and entry.get("kind") not in CONTACT_KINDS:
            raise ValueError(f"intended contact kind is invalid: {contact_id}")
        if key == "face_contacts" and (
                entry.get("contact_axis") not in {"x", "y", "z"}
                or not isinstance(entry.get("plane_mm"), (int, float)) or isinstance(entry.get("plane_mm"), bool)
                or not math.isfinite(entry["plane_mm"])):
            raise ValueError(f"face contact needs an axis and a finite plane: {contact_id}")
        seen_ids.add(contact_id)
        pairs.add(tuple(pair))
    return pairs


def _validate_reference_layout(data: dict[str, Any], schedule: dict[str, Any],
                               components: dict[str, dict[str, Any]],
                               recipes: dict[str, dict[str, Any]]) -> None:
    layout = schedule.get("reference_layout")
    if (not isinstance(layout, dict) or layout.get("source_ref") != REFERENCE_MODEL_REF
            or layout.get("provenance") != "USER_SPECIFIED"
            or layout.get("verification_status") != "NOT_VALIDATED"
            or not layout.get("deviations")):
        raise ValueError("reference layout must stay USER_SPECIFIED/NOT_VALIDATED with its deviations listed")
    audit = schedule.get("overlap_audit")
    if (not isinstance(audit, dict) or audit.get("eps_mm") != OVERLAP_EPS_MM
            or audit.get("unlisted_overlaps_allowed") is not False
            or audit.get("status") != "ASSUMED" or audit.get("verification_status") != "NOT_VALIDATED"
            or audit.get("pass_claimed") is not False):
        raise ValueError("overlap audit must declare eps 0.05 mm, no unlisted overlaps, and no PASS claim")
    ids = set(components)
    intended = _validate_contact_entries(schedule, "intended_contacts", ids)
    faces = _validate_contact_entries(schedule, "face_contacts", ids)
    if intended & faces:
        raise ValueError("a component pair cannot be both an intended overlap and a face contact")
    for placement in schedule.get("component_placements", ()):
        if "reference_placement_provenance" in placement and (
                placement["reference_placement_provenance"] != "USER_SPECIFIED"
                or placement.get("reference_source_ref") != REFERENCE_MODEL_REF
                or placement.get("verification_status") != "NOT_VALIDATED"):
            raise ValueError(f"reference placement provenance must be USER_SPECIFIED/NOT_VALIDATED: {placement['component_id']}")
    housing = recipes[components["station-housing"]["recipe_id"]]["parameters"]
    features = housing.get("fixed_feature_boxes", [])
    feature_ids = [item.get("feature_id") for item in features]
    if (not features or len(set(feature_ids)) != len(feature_ids)
            or housing.get("fixed_feature_boxes_provenance") != "USER_SPECIFIED"
            or housing.get("fixed_feature_boxes_source_ref") != REFERENCE_MODEL_REF
            or housing.get("fixed_feature_boxes_verification_status") != "NOT_VALIDATED"
            or any(not isinstance(item.get("box"), list) or len(item["box"]) != 6
                   or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in item["box"])
                   or any(v <= 0 for v in item["box"][3:]) for item in features)):
        raise ValueError("housing fixed feature boxes need unique IDs, finite positive boxes and USER_SPECIFIED/NOT_VALIDATED attribution")
    optical = schedule.get("scanner_optical_schedule")
    housing_part = components["barcode-scanner-housing"]
    size = recipes[housing_part["recipe_id"]]["parameters"]["size"]
    red = components["red-cartridge"]
    tangential = recipes[red["recipe_id"]]["parameters"]["size"][1]
    optical_point = [housing_part["position"][0] + size[0] / 2, housing_part["position"][1], housing_part["position"][2]]
    label_x = red["position"][0] - tangential / 2
    if (not isinstance(optical, dict) or optical.get("status") != "ASSUMED"
            or optical.get("provenance") != "ASSUMED" or optical.get("verification_status") != "NOT_VALIDATED"
            or optical.get("historical_candidates_used") is not False
            or optical.get("aim_axis_canonical") != [1, 0, 0]
            or optical.get("target_component_id") != "red-cartridge"
            or any(not math.isclose(a, b, abs_tol=1e-8) for a, b in zip(optical.get("optical_point_mm", ()), optical_point))
            or any(not math.isclose(a, b, abs_tol=1e-8) for a, b in zip(
                optical.get("label_point_mm", ()), [label_x, optical_point[1], optical_point[2]]))
            or not math.isclose(optical.get("label_plane_x_mm", math.nan), label_x, abs_tol=1e-8)
            or not math.isclose(optical.get("line_of_sight_mm", math.nan), label_x - optical_point[0], abs_tol=1e-8)):
        raise ValueError("scanner optical schedule must be ASSUMED and match the housing face center and red cartridge -v face")


def _validate_drive_train(schedule: dict[str, Any], recipes: dict[str, dict[str, Any]],
                          components: dict[str, dict[str, Any]]) -> None:
    drive = schedule.get("drive_train")
    if (not isinstance(drive, dict) or drive.get("concept") != "direct_drive"
            or drive.get("source_ref") != DRIVE_TRAIN_SOURCE_REF
            or drive.get("provenance") != "ASSUMED" or drive.get("status") != "ASSUMED"
            or drive.get("verification_status") != "NOT_VALIDATED" or drive.get("pass_claimed") is not False
            or drive.get("post_role_conflict_id") != "fixed-post-vs-rotating-shaft"
            or drive.get("tray_conflict_id") != "tray-length-reduced-for-drive-shaft"
            or drive.get("steps_per_quarter_turn_full_step") != 512
            or drive.get("step_basis_status") != "UNVERIFIED_PER_LISTING"):
        raise ValueError("drive train must stay an ASSUMED/NOT_VALIDATED direct-drive record with its conflicts and unverified step basis")
    contact_ids = {item["contact_id"] for item in schedule["intended_contacts"]}
    if not set(drive.get("intended_contact_ids", ())) <= contact_ids:
        raise ValueError("drive train references an unknown intended contact")
    for member in drive.get("members", ()):
        owner = member.get("owner_component_id")
        features = {item.get("submesh_id"): item
                    for item in recipes[components[owner]["recipe_id"]].get("integrated_submeshes", ())}
        feature = features.get(member.get("submesh_id"))
        if feature is None or feature.get("owner_component_id") != owner or feature.get("verification_status") != "NOT_VALIDATED":
            raise ValueError(f"drive train member is not an owned NOT_VALIDATED integrated submesh: {member.get('submesh_id')}")
        if member["submesh_id"] != "stepper-body" and (
                feature.get("provenance") != "ASSUMED" or feature.get("source_ref") != DRIVE_TRAIN_SOURCE_REF
                or feature.get("position_status") != "ASSUMED"):
            raise ValueError(f"new drive train submesh must be ASSUMED with the request source ref: {member['submesh_id']}")
    if len(drive.get("members", ())) != 6:
        raise ValueError("drive train must list its six integrated submeshes")


def validate_geometry(data: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(data, dict) or data.get("schema_version") != SCHEMA_VERSION:
        raise ValueError(f"schema_version must be {SCHEMA_VERSION}")
    required = {"concept_id", "generator_revision", "source", "provenance_sources", "station", "unknowns", "frames", "assembly_schedule", "scale_audit", "dimensions", "component_recipes", "components", "demo", "export"}
    if not required <= data.keys():
        raise ValueError(f"missing required geometry fields: {sorted(required - data.keys())}")
    if not _finite(data):
        raise ValueError("geometry values must be finite")
    if "USER_SPECIFIED" not in data["provenance_sources"]:
        raise ValueError("controlling user-spec provenance is required")
    station = data["station"]
    if station.get("axes") != {"x": "right", "y": "depth/back", "z": "up"}:
        raise ValueError("canonical axis convention must be X right, Y depth/back, Z up")
    expected_station = {
        "channel": {"size_mm": [10.8, 8.4], "axis_order": "X long, Y short"},
        "pill": {"size_mm": [10, 7, 5], "axis_order": "X length, Y short width, Z height"},
        "outlet": {"aperture_mm": [11.8, 9.4], "source_axis_order": "unspecified", "axis_order_assumption": "X=11.8 long span, Y=9.4 short span to fit assumed pill X=10, Y=7; unverified"},
        "chamber": {"z_min_mm": 0, "z_max_mm": 5, "parked_occupancy": 0},
        "parked_stack": {"lowest_pill_bottom_z_mm": 6, "drop_to_tongue_mm": 6, "remaining_stack_lift_mm": 1, "pill_pitch_mm": 5, "pill_pitch_provenance": "DERIVED_FROM_ASSUMED_PILL_HEIGHT"},
        "blade": {"width_mm": 10.5, "length_mm": 22, "body_thickness_mm": 1, "underside": "flat", "top_wedge": {"thickness_start_mm": 0.3, "thickness_end_mm": 1, "length_mm": 2.6, "side": "top", "leading_edge_local_y": 0}, "tip_y_closed_open_mm": [-5.2, 5.2], "stroke_mm": 10.4, "stroke_axis": "component_local_y"},
        "tongue": {"length_mm": 24, "z_bounds_mm": [-1.5, 0], "edge_y_closed_open_mm": [5.7, -5.7], "stroke_mm": 11.4, "stroke_axis": "canonical_y"},
    }
    for section, expected in expected_station.items():
        if station.get(section) != expected:
            raise ValueError(f"station {section} dimensions/axes differ from controlling two-gate values")
    demo = data["demo"]
    expected_palette = ["red", "blue", "green", "orange"]
    if [item.get("id") for item in data.get("palette", ())] != expected_palette:
        raise ValueError("main-scene demo palette must be exactly red, blue, green, orange")
    expected_barcodes = {
        "5012345678900": "red",
        "5012345678917": "blue",
        "5012345678924": "green",
        "5012345678931": "orange",
        "5012345678948": None,
        "9999999999999": None,
    }
    if demo.get("barcodes") != expected_barcodes:
        raise ValueError("main-scene barcode fixtures must map only the four supported colors")
    if demo.get("initial_pills_per_cartridge") != 0 or demo.get("loaded_pills_per_container") != 5:
        raise ValueError("main-scene inventory must start empty and load only as assumed demo contents")
    examples = demo.get("scan_examples", {})
    if any(examples.get(key) != value for key, value in {
        "unsupported_color": "5012345678948",
        "unmapped": "5012345678999",
        "unknown": "9999999999999",
        "ambiguous": "5012345678955",
        "invalid": "###",
    }.items()):
        raise ValueError("main-scene refusal scan examples are incomplete or changed")
    for name in ("fit_mm", "flexure_mm", "spring_force_n", "friction", "tolerance_mm", "blade_tongue_clearance_mm", "actuator_force_n"):
        if name not in data["unknowns"] or data["unknowns"][name] is not None:
            raise ValueError(f"unknown design input {name} must remain null")
    ids = [item.get("component_id") for item in data["components"]]
    names = [item.get("name") for item in data["components"]]
    recipes = {item.get("recipe_id") for item in data["component_recipes"]}
    if (len(data["components"]) != EXPECTED_COMPONENTS or ids != list(EXPECTED_IDS)
            or names != list(EXPECTED_NAMES) or len(set(ids)) != EXPECTED_COMPONENTS
            or len(set(names)) != EXPECTED_COMPONENTS):
        raise ValueError("component IDs and names must be unique, preserve the original 32 prefix, and match the exact 52-part inventory")
    if any(item.get("provenance") not in PROVENANCE for item in data["components"]):
        raise ValueError("component provenance is required")
    if any(item.get("verification_status", "NOT_VALIDATED") != "NOT_VALIDATED" for item in data["components"]):
        raise ValueError("component verification status must remain NOT_VALIDATED")
    for component in data["components"]:
        if component.get("recipe_id") not in recipes:
            raise ValueError(f"unknown recipe for {component.get('name')}")
        if len(component.get("position", ())) != 3 or len(component.get("rotation", ())) != 3:
            raise ValueError(f"invalid transform for {component.get('name')}")
        if component.get("export_inclusion") not in {"physical_component", "demo_only"}:
            raise ValueError(f"invalid export inclusion for {component.get('name')}")
        if component.get("export_inclusion") != "physical_component":
            raise ValueError("all scheduled inventory entries must be physical components")
        if component.get("verification_status", "NOT_VALIDATED") != "NOT_VALIDATED":
            raise ValueError("component verification status must remain NOT_VALIDATED")

    schedule = data["assembly_schedule"]
    if data.get("generator_revision") != "rotating-drum-concept-fr034-ak-sc026-sc029-actuator-zones-v4":
        raise ValueError("canonical generator revision must identify the SC-026 audit, SC-029 actuator zones, and FR-034 52-part source")
    if schedule.get("coordinate_status") != {
            "approximate": True, "provenance": "ASSUMED", "verification_status": "NOT_VALIDATED"}:
        raise ValueError("FR-034 coordinates must remain approximate ASSUMED/NOT_VALIDATED placements")
    expected_datum = {
        "station_s_mm": [0, 0, 0], "drum_post_axis_xy_mm": [0, 15],
        "closed_tongue_upper_z_mm": 0,
        "axes": {"x": "right", "y": "depth/back", "z": "up"},
        "units": "mm", "provenance": "ASSUMED", "verification_status": "NOT_VALIDATED",
    }
    if schedule.get("datum") != expected_datum:
        raise ValueError("FR-034 station datum and post/drum axis are immutable assumed values")
    frame = schedule.get("frame_conversion", {})
    if (frame.get("translation_mm") != [0, 15, 0]
            or frame.get("applies_only_when_source_frame_is_explicitly_axle_centered") is not True
            or frame.get("applied_component_ids") != []
            or frame.get("direct_station_frame_placements_are_not_translated") is not True
            or frame.get("verification_status") != "NOT_VALIDATED"
            or frame.get("provenance") != "ASSUMED"):
        raise ValueError("FR-034 may translate only individually identified axle-centered placements; direct station poses must not shift")

    placements = schedule.get("component_placements", ())
    if [item.get("component_id") for item in placements] != list(EXPECTED_IDS):
        raise ValueError("FR-034 placements must cover all 52 components in stable inventory order")
    by_component = {item["component_id"]: item for item in data["components"]}
    group_ids = {item.get("group_id") for item in schedule.get("browser_groups", ())}
    if len(group_ids) != len(schedule.get("browser_groups", ())):
        raise ValueError("FR-034 browser motion groups must have unique IDs")
    for group in schedule.get("browser_groups", ()):
        if group.get("parent_group_id") is not None and group["parent_group_id"] not in group_ids:
            raise ValueError(f"unknown parent browser group: {group.get('group_id')}")
        if group.get("parent_component_id") not in by_component:
            raise ValueError(f"unknown browser-group component: {group.get('group_id')}")
    for component, placement in zip(data["components"], placements):
        component_id = component["component_id"]
        parent_id = placement.get("parent_component_id")
        if (component_id == "station-housing" and parent_id is not None
                or component_id != "station-housing" and parent_id is None):
            raise ValueError(f"invalid station-root parent relationship: {component_id}")
        if parent_id is not None and parent_id not in by_component:
            raise ValueError(f"invalid parent component for {component_id}")
        if parent_id == component_id:
            raise ValueError(f"component cannot parent itself: {component_id}")
        if placement.get("motion_group") not in group_ids:
            raise ValueError(f"unknown motion group for {component_id}")
        if (placement.get("placement_provenance") != "ASSUMED"
                or placement.get("verification_status") != "NOT_VALIDATED"):
            raise ValueError(f"placement must remain ASSUMED/NOT_VALIDATED: {component_id}")
        world_position = placement.get("world_position_mm")
        fallback_position = placement.get("rendered_fallback_position_mm")
        if world_position is not None:
            if (not isinstance(world_position, list) or len(world_position) != 3
                    or any(not math.isclose(float(a), float(b), abs_tol=1e-8)
                           for a, b in zip(world_position, component.get("position", ())))):
                raise ValueError(f"scheduled canonical world pose differs from component transform: {component_id}")
            if placement.get("world_position_provenance") not in {None, "DERIVED", "DERIVED_FROM_BOUNDS"}:
                raise ValueError(f"invalid world-position provenance: {component_id}")
        else:
            if (not isinstance(fallback_position, list) or len(fallback_position) != 3
                    or placement.get("rendered_fallback_provenance") != "ASSUMED"
                    or any(not math.isclose(float(a), float(b), abs_tol=1e-8)
                           for a, b in zip(fallback_position, component.get("position", ())))):
                raise ValueError(f"missing world pose requires a distinctly marked ASSUMED rendered fallback: {component_id}")
        if placement.get("source_provenance") not in PROVENANCE:
            raise ValueError(f"placement source provenance is required: {component_id}")
        source_position = placement.get("source_position_mm")
        if source_position is not None:
            if (not isinstance(source_position, list) or len(source_position) != 3
                    or placement.get("source_frame") != "station_world"
                    or world_position != source_position):
                raise ValueError(f"source coordinates must be complete direct station-frame coordinates: {component_id}")
        elif world_position is None and placement.get("rendered_fallback_provenance") != "ASSUMED":
            raise ValueError(f"unknown source placement must remain null and mark any display fallback ASSUMED: {component_id}")

    expected_ownership: dict[str, tuple[str | None, str]] = {
        "station-housing": (None, "fixed-housing"),
        "central-post": ("station-housing", "fixed-housing"),
        "rotating-drum": ("station-housing", "rotating-drum"),
        "servo-unit": ("station-housing", "servo-linkage"),
        "servo-crank": ("servo-unit", "servo-linkage"),
        "connecting-rod": ("servo-crank", "servo-linkage"),
        "pin-carriage": ("station-housing", "carriage-slide"),
        "carriage-rail-left": ("station-housing", "carriage-slide"),
        "carriage-rail-right": ("station-housing", "carriage-slide"),
        "pull-solenoid": ("pin-carriage", "carriage-slide"),
        "engagement-pin": ("pull-solenoid", "carriage-slide"),
        "shared-lower-tongue": ("station-housing", "tongue-slide"),
        "tongue-actuator-rod": ("shared-lower-tongue", "tongue-slide"),
        "tongue-return-spring": ("station-housing", "tongue-slide"),
        "barcode-scanner-housing": ("station-housing", "scanner-electronics"),
        "outlet-tray": ("station-housing", "fixed-housing"),
        "electronics-deck": ("station-housing", "scanner-electronics"),
        "controller-board-placeholder": ("electronics-deck", "scanner-electronics"),
        "scanner-head-placeholder": ("barcode-scanner-housing", "scanner-electronics"),
        "scanner-mount": ("barcode-scanner-housing", "scanner-electronics"),
    }
    for color in ("red", "blue", "green", "orange"):
        group = f"station-{color}"
        expected_ownership[f"{color}-cartridge"] = ("rotating-drum", group)
        expected_ownership[f"{color}-cap"] = (f"{color}-cartridge", group)
        expected_ownership[f"{color}-upper-blade-tab"] = ("rotating-drum", group)
        expected_ownership[f"{color}-upper-blade-return-spring"] = ("rotating-drum", group)
        for suffix in ("cap-label-plate", "passive-tag-carrier", "cap-hinge-assembly", "cap-latch-body"):
            expected_ownership[f"{color}-{suffix}"] = (f"{color}-cap", group)
    if set(expected_ownership) != set(EXPECTED_IDS):
        raise ValueError("internal FR-034 ownership contract is incomplete")
    for placement in placements:
        parent_id, motion_group = expected_ownership[placement["component_id"]]
        if (placement.get("parent_component_id") != parent_id
                or placement.get("motion_group") != motion_group):
            raise ValueError(f"invalid FR-034 parent/motion ownership: {placement['component_id']}")
        seen = {placement["component_id"]}
        ancestor = parent_id
        while ancestor is not None:
            if ancestor in seen:
                raise ValueError(f"cyclic FR-034 parent relationship: {placement['component_id']}")
            seen.add(ancestor)
            ancestor = next(item["parent_component_id"] for item in placements
                            if item["component_id"] == ancestor)

    expected_features = {
        "post-support": ("station-housing", "INTEGRATED_ASSUMED"),
        "station-sockets": ("rotating-drum", "INTEGRATED_ASSUMED"),
        "cartridge-channels": ("red-cartridge,blue-cartridge,green-cartridge,orange-cartridge", "INTEGRATED_ASSUMED"),
        "carriage-ears": ("pin-carriage", "INTEGRATED_ASSUMED"),
        "carriage-flags": ("pin-carriage", "INTEGRATED_ASSUMED"),
        "plunger-head": ("engagement-pin", "INTEGRATED_ASSUMED"),
        "scanner-optics-guide": ("scanner-head-placeholder,barcode-scanner-housing", "INTEGRATED_VISUAL_ONLY"),
        "tongue-return-fixed-bracket": ("station-housing", "SCHEDULED_FIXED_FEATURE_REFERENCE_SECTION"),
        "outlet-tray-mount": ("station-housing", "INTEGRATED_ASSUMED"),
    }
    features = schedule.get("integrated_features", ())
    if ([feature.get("feature_id") for feature in features] != list(expected_features)
            or any((feature.get("owner_component_id"), feature.get("status")) != expected_features[feature["feature_id"]]
                   for feature in features)):
        raise ValueError("FR-034 integrated features and named owners must remain exact and excluded from physical inventory")
    bracket = next(feature for feature in features if feature["feature_id"] == "tongue-return-fixed-bracket")
    if bracket.get("y_bounds_mm") != [-70, -68] or bracket.get("cross_section_xz_mm") != [20.8, 24.5]:
        raise ValueError("fixed bracket Y bounds [-70,-68] and the user-reference X/Z section [20.8,24.5] must be recorded")
    if any("reaction-pad" in feature.get("feature_id", "") for feature in features):
        raise ValueError("the superseded housing-integral tongue spring reaction pad must not be represented")

    expected_centers = ([0, 0, 26], [15, 15, 26], [0, 30, 26], [-15, 15, 26])
    expected_axes = (
        {"u": [0, -1, 0], "v": [1, 0, 0], "w": [0, 0, 1]},
        {"u": [1, 0, 0], "v": [0, 1, 0], "w": [0, 0, 1]},
        {"u": [0, 1, 0], "v": [-1, 0, 0], "w": [0, 0, 1]},
        {"u": [-1, 0, 0], "v": [0, -1, 0], "w": [0, 0, 1]},
    )
    sockets = schedule.get("socket_frames", ())
    if len(sockets) != 4:
        raise ValueError("FR-034 requires exactly four socket frames")
    for index, socket in enumerate(sockets):
        angle = index * math.pi / 2
        center = [15 * math.sin(angle), 15 - 15 * math.cos(angle)]
        if (socket.get("index") != index
                or socket.get("color") != ("red", "blue", "green", "orange")[index]
                or socket.get("provenance") != "ASSUMED"
                or socket.get("verification_status") != "NOT_VALIDATED"
                  or socket.get("center_mm") != list(expected_centers[index][:2])
                  or socket.get("deck_center_z_mm") != 4.5
                  or socket.get("deck_bounds_z_mm") != [4, 5]
                  or socket.get("cartridge_center_z_mm") != 26
                  or socket.get("tube_bounds_z_mm") != [6, 46]
                or any(not math.isclose(a, b, abs_tol=1e-8)
                       for a, b in zip(socket.get("center_mm", ()), center))
                or any(not math.isclose(a, b, abs_tol=1e-8)
                      for a, b in zip(socket.get("rotation_rad", ()), [0, 0, angle-math.pi/2]))
                or socket.get("local_axes") != expected_axes[index]):
            raise ValueError(f"invalid FR-034 socket frame {index}")
        cartridge = by_component[f"{socket['color']}-cartridge"]
        if (any(not math.isclose(a, b, abs_tol=1e-8)
                for a, b in zip(cartridge["position"], expected_centers[index]))
            or not math.isclose(cartridge["rotation"][2], angle-math.pi/2, abs_tol=1e-8)):
            raise ValueError(f"cartridge transform differs from socket {index}")

    required_unknowns = (
        "tray_height_mm", "electronics_deck_source_center_mm", "controller_board_source_center_mm",
        "scanner_head_source_center_mm", "scanner_mount_source_center_mm",
        "cap_subpart_authoritative_sizes_mm", "scanner_read_point_datum_mm",
        "slider_crank_closure_error_mm", "required_clearances_mm",
    )
    missing_values = schedule.get("missing_values", {})
    if any(data["unknowns"].get(name) is not None or missing_values.get(name) is not None
           for name in required_unknowns):
        raise ValueError("FR-034 missing dimensions and clearances must remain null")
    conflict_map = {item.get("conflict_id"): item for item in schedule.get("conflicts", ())}
    required_conflicts = {
        "drum-radius-discrepancy", "blade-axis-conflict", "blade-spring-housing-extents",
        "servo-pivot-rod-closure", "vertical-stack-clearance", "scanner-read-point-basis",
        "pin-carriage-rail-endpoint", "tongue-spring-fr033-ak", "fr031-cartridge-recipe-envelope",
        "K-tray-reference-envelope", "sc029-upper-solenoid-source-bounds",
        "fixed-post-vs-rotating-shaft", "tray-length-reduced-for-drive-shaft",
        "sc029-lower-actuator-envelope-and-clearance", "sc029-microswitch-axis-placement",
    }
    if not required_conflicts <= conflict_map.keys():
        raise ValueError("FR-034 source and placement conflicts must remain explicit")
    if any(item.get("status") not in {"CONFLICT", "UNRESOLVED"}
           or item.get("verification_status") != "NOT_VALIDATED"
           for item in conflict_map.values()):
        raise ValueError("FR-034 conflicts cannot be promoted to validated status")
    ambiguity = schedule.get("scanner_read_point_ambiguity", {})
    if (ambiguity.get("candidate_canonical_mm") != [[-17, 29.85, 10], [-17, -10, 29.85]]
            or ambiguity.get("status") != "UNRESOLVED"
            or ambiguity.get("used_as_datum") is not False
            or ambiguity.get("verification_status") != "NOT_VALIDATED"):
        raise ValueError("scanner read-point candidates must remain unresolved non-datums")
    card = schedule.get("credit_card_reference", {})
    if (card.get("physical_component") is not False or card.get("export_included") is not False
            or card.get("canonical_position_mm") is not None
            or card.get("must_not_overlap_status") not in {"CONFLICT", "UNRESOLVED", "NOT_CHECKED"}):
        raise ValueError("K credit-card reference must remain visual-only and excluded")
    allowed_clearance_statuses = {"CONFLICT", "UNRESOLVED", "NOT_CHECKED", "INTENDED_CONTACT"}
    checks = schedule.get("clearance_checks", ())
    if (not checks or any(item.get("status") not in allowed_clearance_statuses for item in checks)):
        raise ValueError("clearance checks cannot claim PASS or physical validation")
    if not {"K-tray-outlet-interface", "K-credit-card-reference-separation"} <= {
            item.get("check_id") for item in checks}:
        raise ValueError("K tray and scale-reference checks must remain listed")

    recipes_by_id = {item.get("recipe_id"): item for item in data["component_recipes"]}
    _validate_sc029_actuator_zones(data, schedule, by_component, recipes_by_id)
    _validate_reference_layout(data, schedule, by_component, recipes_by_id)
    _validate_drive_train(schedule, recipes_by_id, by_component)
    for component_id in PLACEHOLDER_COMPONENT_IDS:
        component = by_component[component_id]
        extent = component.get("assumed_extent_mm")
        recipe = recipes_by_id[component["recipe_id"]]
        parameters = recipe.get("parameters", {})
        size = parameters.get("size")
        if (component.get("provenance") != "ASSUMED"
                or component.get("source_provenance") != "MISSING"
                or component.get("placement_provenance") != "ASSUMED"
                or component.get("extent_provenance") != "ASSUMED"
                or component.get("verification_status") != "NOT_VALIDATED"
                or not isinstance(extent, list) or len(extent) != 3
                or any(not isinstance(value, (int, float)) or isinstance(value, bool)
                       or not math.isfinite(value) or value <= 0 or value > 1000 for value in extent)
                or recipe.get("kind") not in {"box", "cylinder", "rod", "extrusion", "profile"}
                or recipe.get("provenance") != "ASSUMED"
                or recipe.get("verification_status") != "NOT_VALIDATED"
                or not isinstance(size, list) or len(size) != 3
                or any(not isinstance(value, (int, float)) or isinstance(value, bool)
                       or not math.isfinite(value) or value <= 0 or value > 1000 for value in size)
                or any(not math.isclose(a, b, abs_tol=1e-8) for a, b in zip(size, extent))):
            raise ValueError(f"placeholder must have finite bounded ASSUMED/NOT_VALIDATED geometry: {component_id}")
    dimension_by_id = {dimension.get("id"): dimension for dimension in data["dimensions"]}
    for dimension in data["dimensions"]:
        if dimension.get("provenance") not in PROVENANCE or dimension.get("verification_status") != "NOT_VALIDATED":
            raise ValueError("dimension provenance and NOT_VALIDATED status are required")
        if dimension.get("provenance") == "MISSING" and dimension.get("value") is not None:
            raise ValueError("missing dimensions must remain null")
        if (dimension.get("provenance") == "USER_SPECIFIED"
            and not dimension.get("source_ref", "").startswith(("gate-spec:", "user-request:"))):
            raise ValueError("user-specified dimension needs controlling gate-spec or user-request attribution")
        dimension_ids = set(dimension_by_id)
    for component in data["components"]:
        if not set(component.get("dimension_refs", ())) <= dimension_ids:
            raise ValueError(f"unknown dimension reference for {component['name']}")
        if any(rule not in {item.get("rule_id") for item in data["derived_rules"]} for rule in component.get("rule_refs", ())):
            raise ValueError(f"unknown derivation reference for {component['name']}")
    _validate_sc026_scale_audit(data, recipes_by_id, by_component, dimension_by_id)
    blades = [component for component in data["components"] if component.get("category") == "blade"]
    if len(blades) != 4 or any(component["position"][2] != 5 for component in blades):
        raise ValueError("four upper blade undersides must occupy the chamber-top z=5 datum")
    expected_blade_positions = {"red": (0.,5.2,5.), "blue": (9.8,15.,5.),"green": (0.,24.8,5.), "orange": (-9.8,15.,5.)}
    expected_blade_rotations = {"red":math.pi,"blue":3*math.pi/2,"green":0.,"orange":math.pi/2}
    for color,position in expected_blade_positions.items():
        blade=next(item for item in blades if item.get("color")==color)
        if any(abs(a-b)>1e-8 for a,b in zip(blade["position"],position)) or abs(blade["rotation"][2]-expected_blade_rotations[color])>1e-8:
            raise ValueError(f"{color} upper blade closed nose must start at the -5.2 mm channel edge with local Y directed outward")
    carriage=next(item for item in data["components"] if item.get("component_id")=="pin-carriage")
    if carriage["position"][:2] != [0,-14.8]:
        raise ValueError("pin carriage must retain the directly specified closed Y coordinate -14.8 mm")
    tongue = next(component for component in data["components"] if component.get("component_id") == "shared-lower-tongue")
    if tongue["position"][2] != -0.75:
        raise ValueError("lower tongue plate must occupy canonical z=-1.5..0 at its parked transform")
    housing_recipe = next(recipe for recipe in data["component_recipes"] if recipe.get("recipe_id") == "housing")
    tongue_spring = next(component for component in data["components"] if component.get("component_id") == "tongue-return-spring")
    tongue_spring_recipe = next(recipe for recipe in data["component_recipes"] if recipe.get("recipe_id") == "tongue-return-spring")
    spring_parameters = tongue_spring_recipe.get("parameters", {})
    housing_boxes = housing_recipe["parameters"]["boxes"]
    housing_min_y = min(box[1] - box[4] / 2 for box in housing_boxes)
    housing_max_y = max(box[1] + box[4] / 2 for box in housing_boxes)
    housing_min_x = min(box[0] - box[3] / 2 for box in housing_boxes)
    housing_max_x = max(box[0] + box[3] / 2 for box in housing_boxes)
    if not (math.isclose(housing_min_y, -38, abs_tol=1e-8)
            and math.isclose(housing_max_y, 36, abs_tol=1e-8)
            and math.isclose(housing_min_x, -22, abs_tol=1e-8)
            and math.isclose(housing_max_x, 22, abs_tol=1e-8)
            and "tongue_spring_reaction_pad" not in housing_recipe["parameters"]):
        raise ValueError("station housing must preserve the station-frame bounds and omit the superseded reaction pad")
    if (tongue_spring.get("recipe_id") != "tongue-return-spring"
            or not math.isclose(tongue_spring.get("rotation", [0])[0], -math.pi / 2, abs_tol=1e-10)
            or tongue_spring.get("rotation", [0, 1, 1])[1:] != [0, 0]
            or tongue_spring.get("provenance") != "ASSUMED"
            or tongue_spring.get("return_action") != "SC029_lower_plunger_compression_visual_only"
            or tongue_spring.get("fixed_anchor_component_id") != "station-housing"
            or tongue_spring.get("moving_anchor_component_id") != "tongue-actuator-rod"
            or tongue_spring.get("source_endpoints_mm") is not None):
        raise ValueError("SC-029 spring must remain an assumed lower-plunger visualization with unresolved source endpoints")
    if (tongue_spring_recipe.get("recipe_revision") != "fr034-ak-tongue-spring-1"
            or spring_parameters.get("height") != 21.7
            or spring_parameters.get("radius") != 0.75
            or spring_parameters.get("tube_radius") != 0.18
            or spring_parameters.get("turns") != 5
            or spring_parameters.get("closed_length_mm") != 21.7
            or spring_parameters.get("open_length_mm") != 10.3
            or spring_parameters.get("legacy_dimension_status") != "HISTORICAL_CONFLICT_NOT_CURRENT_SPRING_LENGTH"):
        raise ValueError("tongue-return-spring historical display mesh or SC-029 unresolved status changed")
    for recipe in data["component_recipes"]:
        if recipe.get("kind") not in RECIPE_KINDS:
            raise ValueError(f"unsupported geometry recipe kind: {recipe.get('kind')}")
        if recipe.get("kind") == "blade_with_wedge":
            p = recipe.get("parameters", {})
            expected = {"width": 10.5, "length": 22, "thickness": 1, "tab_width": 8, "tab_start_y": 16, "tab_end_y": 24, "slot_center_y": 20, "slot_width": 5, "slot_length": 4}
            if recipe.get("recipe_revision") != "fr034-tab-slot-18-22-1" or any(p.get(k) != v for k, v in expected.items()):
                raise ValueError("unknown or invalid blade profile recipe revision/dimensions")
            if p.get("wedge") != {"length": 2.6, "leading_thickness": 0.3, "body_thickness": 1.0, "side": "top", "leading_edge_local_y": 0} or p.get("stroke_axis") != "local_y" or p.get("local_y_start") != "nose_at_closed_tip" or p.get("slot_axis") != "y":
                raise ValueError("blade wedge profile/axis is invalid")
        if recipe.get("recipe_id") == "cartridge":
            p=recipe.get("parameters",{})
            if (p.get("size") != [12.4,14.8,40] or p.get("wall_inset_mm") is not None
                    or p.get("channel_size_mm") != [8.4,10.8]
                    or p.get("size_axes") != "local X=radial u, local Y=tangential v"
                    or p.get("channel_axes") != "local X=u radial 8.4, local Y=v tangential 10.8"
                    or p.get("channel_geometry_status") != "UNRESOLVED"):
                raise ValueError("A-K cartridge section/tube recipe or unresolved channel status changed")
        if recipe.get("recipe_id") == "cartridge-recipe-fr031":
            if (recipe.get("parameters", {}).get("size") != [12.8,10.4,40]
                    or recipe.get("parameters", {}).get("status") != "HISTORICAL_RECIPE_CONFLICT_NOT_CURRENT"
                    or recipe.get("historical_only") is not True
                    or recipe.get("current_for_components") is not False):
                raise ValueError("the FR-031 recipe envelope must remain historical-only, not current geometry")
        if recipe.get("kind") == "compound_box" and recipe.get("recipe_id")=="housing":
            # Central floor keep-outs match the assumed X=11.8 by Y=9.4 outlet aperture.
            boxes=recipe.get("parameters",{}).get("boxes",[])
            outlet_x,outlet_y=station["outlet"]["aperture_mm"]
            for cx,cy,cz,sx,sy,sz in boxes:
                is_floor_layer=abs(cz+2.325)<1e-8 and sz<=1.35+1e-8
                overlaps_x=abs(cx)<(outlet_x+sx)/2-1e-8
                overlaps_y=abs(cy+15)<(outlet_y+sy)/2-1e-8
                if is_floor_layer and overlaps_x and overlaps_y:
                    raise ValueError("station housing floor blocks the outlet aperture")
        if recipe.get("kind") == "box" and recipe.get("recipe_id") == "tongue":
            p = recipe.get("parameters", {})
            if recipe.get("recipe_revision") != "lower-floor-1" or p.get("size") != [14, 24, 1.5] or p.get("travel_axis") != "canonical_y":
                raise ValueError("unknown or invalid lower tongue recipe revision/datum")
        if recipe.get("kind") == "slotted_gate":
            values=recipe.get("parameters", {})
            required=("width","tab_width","body_length","tab_length","slot_center_y","end_bridge","slot_width","slot_length","thickness")
            positive=(k for k in required if k!="slot_center_y")
            if any(not isinstance(values.get(k),(int,float)) or not math.isfinite(values[k]) or values[k]<=0 for k in positive):
                raise ValueError("slotted_gate dimensions must be finite positive numbers")
            if not isinstance(values.get("slot_center_y"),(int,float)) or not math.isfinite(values["slot_center_y"]):
                raise ValueError("slotted_gate slot center must be finite")
            if values["tab_width"]>values["width"] or values["slot_width"]>=values["tab_width"] or values["slot_length"]+values["end_bridge"]>=values["tab_length"]:
                raise ValueError("slotted_gate slot must remain inside tab material")
        if recipe.get("kind") == "compound_box":
            boxes = recipe.get("parameters", {}).get("boxes", [])
            if not boxes or any(len(box) != 6 or not all(isinstance(value, (int, float)) and math.isfinite(value) for value in box) or any(size <= 0 for size in box[3:]) for box in boxes):
                raise ValueError("compound_box recipe needs finite centers and positive extents")
    if data["export"].get("physical_component_count") != EXPECTED_COMPONENTS:
        raise ValueError("export physical component count must be 52")
    if data["export"].get("validation_status") != "NOT_VALIDATED" or data["export"].get("print_ready") is not False or data["export"].get("fabricable_as_designed") is not False:
        raise ValueError("readiness declarations are immutable and must remain false")
    if not {"NOT VALIDATED", "NOT PRINT-READY"}.issubset(set(data["export"].get("warnings", ()))):
        raise ValueError("mandatory export warning literals are required")
    return data


def load_geometry(path: str | Path | None = None) -> dict[str, Any]:
    if path is None:
        raw = files("dispenser_sim.viz3d").joinpath("concept_geometry.json").read_text(encoding="utf-8")
    else:
        raw = Path(path).read_text(encoding="utf-8")
    try:
        data = json.loads(raw, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))
    except (json.JSONDecodeError, ValueError) as exc:
        raise ValueError(f"invalid canonical geometry JSON: {exc}") from exc
    return validate_geometry(data)
