import math

import pytest

from dispenser_sim.viz3d.mesh import bounds, canonical_to_three
from dispenser_sim.viz3d.scene import build_concept_assembly

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

SC027_COLORS = ("red", "blue", "green", "orange")


def _sc027_required_touch_pairs():
    pairs = {
        ("drum-bearing", "central-post"),
        ("rotating-drum", "drum-bearing"),
        ("servo-output-shaft", "servo-crank"),
        ("servo-crank", "crank-pin"),
        ("crank-pin", "connecting-rod"),
        ("connecting-rod", "pin-carriage"),
        ("pin-carriage", "carriage-rail-left"),
        ("pin-carriage", "carriage-rail-right"),
        ("pin-carriage", "pull-solenoid"),
        ("pull-solenoid", "upper-solenoid-guide"),
        ("upper-solenoid-guide", "upper-solenoid-armature"),
        ("upper-solenoid-armature", "engagement-pin"),
        ("station-housing", "lower-tongue-pull-solenoid"),
        ("lower-tongue-pull-solenoid", "lower-plunger-guide"),
        ("lower-plunger-guide", "lower-plunger"),
        ("lower-plunger", "lower-tongue-moving-carriage"),
        ("lower-tongue-moving-carriage", "lower-tongue-strap"),
        ("lower-tongue-strap", "shared-lower-tongue"),
        ("shared-lower-tongue", "tongue-station-guides"),
        ("shared-lower-tongue", "tongue-closed-seat"),
        ("tongue-return-spring", "lower-tongue-moving-carriage"),
        ("tongue-return-spring", "tongue-fixed-bracket"),
        ("selected-cartridge-channel", "transient-pill"),
        ("transient-pill", "blade-chamber-path"),
        ("blade-chamber-path", "shared-lower-tongue"),
        ("shared-lower-tongue", "outlet-aperture"),
        ("outlet-aperture", "outlet-tray"),
    }
    for color in SC027_COLORS:
        pairs.update({
            (f"{color}-tower-socket", "rotating-drum"),
            (f"{color}-cap-hinge", f"{color}-cartridge"),
            (f"{color}-upper-blade-tab", f"{color}-blade-guides"),
            (f"{color}-blade-slot", "engagement-pin"),
            (f"{color}-upper-blade-return-spring", f"{color}-blade-tab-spring-seat"),
            (f"{color}-upper-blade-return-spring", f"{color}-blade-reaction-seat"),
        })
    return pairs


def _sc027_touch_graph(assembly):
    graph = assembly.source_geometry.get("assembly_schedule", {}).get("touch_topology")
    assert isinstance(graph, dict), (
        "SC-027 source is missing assembly_schedule.touch_topology; moving-group "
        "contacts must be explicit, not inferred from rendered bounds"
    )
    return graph


def test_scan_concept_assembly_is_canonical_order_and_fixed_parked_pose():
    assembly = build_concept_assembly()
    assert [part.name for part in assembly.parts[:32]] == EXPECTED
    assert len({part.part_id for part in assembly.parts}) == 52
    assert assembly.reference_pose == "parked_rest"
    assert assembly.units == "mm" and assembly.handedness == "right"
    assert assembly.validation_status == "NOT_VALIDATED"
    assert assembly.print_ready is False and assembly.fabricable_as_designed is False
    assert all(part.mesh.vertices and part.dimensions is not None for part in assembly.parts)
    assert assembly.parts[3].placement_transform[9:12] == (0.0, 0.0, 26.0)


def test_two_gate_parked_datums_and_empty_chamber_are_source_consistent():
    assembly = build_concept_assembly()
    by_id = {part.component_id: part for part in assembly.parts}
    source = assembly.source_geometry
    assert source["station"]["chamber"]["parked_occupancy"] == 0
    assert source["station"]["chamber"]["z_min_mm"] == 0
    assert source["station"]["chamber"]["z_max_mm"] == 5
    for color in ("red", "blue", "green", "orange"):
        blade = by_id[color + "-upper-blade-tab"]
        assert blade.placement_transform[11] == 5
        assert blade.recipe["kind"] == "blade_with_wedge"
        assert blade.provenance == "USER_SPECIFIED"
    tongue = by_id["shared-lower-tongue"]
    tongue_bounds = bounds(tongue.mesh, tongue.placement_transform)
    assert (tongue_bounds[0][2], tongue_bounds[1][2]) == (-1.5, 0)
    assert tongue.placement_transform[9:12] == (0.0, -6.3, -0.75)
    for color in ("red", "blue", "green", "orange"):
        blade = by_id[color + "-upper-blade-tab"]
        blade_bounds = bounds(blade.mesh, blade.placement_transform)
        assert blade_bounds[0][2] == 5
        assert blade_bounds[0][2] >= tongue_bounds[1][2]
    assert all(part.name in EXPECTED for part in assembly.parts[:32])


def test_fr034_scene_serializes_52_world_transforms_bounds_and_parent_metadata():
    assembly = build_concept_assembly()
    source = assembly.source_geometry
    definitions = source["components"]
    placements = {item["component_id"]: item for item in source["assembly_schedule"]["component_placements"]}
    assert [part.component_id for part in assembly.parts] == [item["component_id"] for item in definitions]
    assert [part.name for part in assembly.parts[:32]] == EXPECTED
    assert len(assembly.parts) == 52
    for part, definition in zip(assembly.parts, definitions):
        placement = placements[definition["component_id"]]
        assert part.parent_component_id == placement["parent_component_id"]
        assert part.group_id == placement["motion_group"]
        assert part.world_transform == part.placement_transform
        assert part.world_bounds_mm == bounds(part.mesh, part.world_transform)
        assert part.world_transform[9:12] == tuple(definition["position"])
        assert part.coordinate_frame == "canonical_right_handed_mm"
        assert part.parent_transform_applied is False
        assert part.ownership_provenance == "ASSUMED"
        assert part.rendered_fallback is (placement.get("world_position_mm") is None)
        assert part.source_position_mm == (tuple(placement["source_position_mm"])
                                           if placement.get("source_position_mm") is not None else None)
        if part.rendered_fallback:
            assert placement["source_position_mm"] is None
            assert placement["rendered_fallback_provenance"] == "ASSUMED"
            assert part.position_provenance == "ASSUMED"
    assert assembly.units == "mm" and assembly.handedness == "right"
    assert assembly.validation_status == "NOT_VALIDATED"
    assert assembly.print_ready is False and assembly.fabricable_as_designed is False


def test_fr034_scene_has_direct_station_root_and_known_a_k_world_bounds():
    assembly = build_concept_assembly()
    by_id = {part.component_id: part for part in assembly.parts}
    assert by_id["station-housing"].world_transform[9:12] == (0, 0, 0)
    assert bounds(by_id["station-housing"].mesh, by_id["station-housing"].world_transform)[0][:2] == (-60, -70)
    assert bounds(by_id["station-housing"].mesh, by_id["station-housing"].world_transform)[1][:2] == (22, 36)
    assert by_id["central-post"].world_transform[9:12] == (0, 15, 23)
    assert by_id["rotating-drum"].world_transform[9:12] == (0, 15, 25)
    assert by_id["red-cartridge"].world_transform[9:12] == (0, 0, 26)
    assert by_id["red-cartridge"].world_transform[:9] != by_id["central-post"].world_transform[:9]
    cartridge_bounds = by_id["red-cartridge"].world_bounds_mm
    assert cartridge_bounds[0][2] == pytest.approx(6)
    assert cartridge_bounds[1][2] == pytest.approx(46)
    assert by_id["carriage-rail-left"].world_bounds_mm[0] == pytest.approx((-6.8, -52, 15))
    assert by_id["carriage-rail-left"].world_bounds_mm[1] == pytest.approx((-5.2, -20, 16.6))
    assert by_id["carriage-rail-right"].world_bounds_mm[0] == pytest.approx((5.2, -52, 15))
    assert by_id["carriage-rail-right"].world_bounds_mm[1] == pytest.approx((6.8, -20, 16.6))
    assert by_id["outlet-tray"].world_bounds_mm[0] == pytest.approx((-20, -42, -14))
    assert by_id["outlet-tray"].world_bounds_mm[1] == pytest.approx((20, 8, -12.5))
    assert assembly.reference_envelope_mm is None


def test_fr034_scene_keeps_unknown_gaps_unresolved_and_converts_axes_once():
    assembly = build_concept_assembly()
    schedule = assembly.source_geometry["assembly_schedule"]
    assert schedule["missing_values"]["tray_height_mm"] is None
    assert schedule["credit_card_reference"]["physical_component"] is False
    assert schedule["credit_card_reference"]["export_included"] is False
    assert all(check["status"] != "PASS" for check in schedule["clearance_checks"])
    assert {check["status"] for check in schedule["clearance_checks"]} <= {
        "CONFLICT", "UNRESOLVED", "NOT_CHECKED", "INTENDED_CONTACT"
    }
    # The Python assembly remains in canonical right-handed XYZ; the display
    # basis is a separate, determinant-positive conversion, not baked into poses.
    assert canonical_to_three((1, 0, 0)) == (1, 0, 0)
    assert canonical_to_three((0, 1, 0)) == (0, 0, -1)
    assert canonical_to_three((0, 0, 1)) == (0, 1, 0)
    for part in assembly.parts:
        assert part.world_transform[9:12] != canonical_to_three(part.world_transform[9:12]) or part.world_transform[9:12] == (0, 0, 0)


def test_sc027_touch_topology_preserves_exact_physical_inventory():
    assembly = build_concept_assembly()
    physical_ids = {part.component_id for part in assembly.parts}
    source_ids = {
        component["component_id"]
        for component in assembly.source_geometry["components"]
        if component["export_inclusion"] == "physical_component"
    }
    assert len(physical_ids) == len(source_ids) == 52
    assert physical_ids == source_ids


def test_sc027_touch_topology_covers_each_moving_group_and_physical_member():
    assembly = build_concept_assembly()
    source = assembly.source_geometry
    graph = _sc027_touch_graph(assembly)
    groups = {group["moving_group_id"]: group for group in graph.get("moving_groups", ())}
    placements = source["assembly_schedule"]["component_placements"]
    group_components = {}
    for placement in placements:
        group_id = placement.get("motion_group")
        if group_id and group_id != "fixed-housing":
            group_components.setdefault(group_id, set()).add(placement["component_id"])

    assert set(groups) >= set(group_components), "SC-027 omits a declared moving physical group"
    nodes = {node["node_id"]: node for node in graph.get("nodes", ())}
    for group_id, component_ids in group_components.items():
        group = groups[group_id]
        assert group["provenance"] == "ASSUMED"
        assert group["verification_status"] == "NOT_VALIDATED"
        assert group.get("parent_component_id") or group.get("parent_node_id")
        members = [nodes[node_id] for node_id in group["member_node_ids"]]
        represented_ids = {node.get("owner_component_id") for node in members}
        assert component_ids <= represented_ids, f"SC-027 incomplete physical members in {group_id}"
        assert all(node["moving_group_id"] == group_id for node in members)


def test_sc027_touch_topology_contains_required_moving_contact_chains():
    assembly = build_concept_assembly()
    graph = _sc027_touch_graph(assembly)
    edge_pairs = {
        (edge["source_node_id"], edge["target_node_id"])
        for edge in graph.get("edges", ())
    }
    missing = _sc027_required_touch_pairs() - edge_pairs
    assert not missing, f"SC-027 missing required touch/contact edges: {sorted(missing)}"

    edge_by_pair = {
        (edge["source_node_id"], edge["target_node_id"]): edge
        for edge in graph["edges"]
    }
    for pair in _sc027_required_touch_pairs():
        edge = edge_by_pair[pair]
        assert edge.get("interaction_role"), f"SC-027 missing sliding/hinge/contact role for {pair}"
        assert edge.get("contact_surface"), f"SC-027 missing contact surface for {pair}"
        assert edge.get("provenance") in {"USER_SPECIFIED", "SCAN_EXPLICIT", "ASSUMED"}
        assert edge.get("verification_status") == "NOT_VALIDATED"
    for color in SC027_COLORS:
        pin_edge = edge_by_pair[(f"{color}-blade-slot", "engagement-pin")]
        assert pin_edge.get("selection_rule") == "only_selected_station"


def test_sc027_touch_nodes_resolve_parentage_and_nonphysical_pill_path():
    assembly = build_concept_assembly()
    graph = _sc027_touch_graph(assembly)
    nodes = {node["node_id"]: node for node in graph.get("nodes", ())}
    required_nodes = {
        node_id
        for pair in _sc027_required_touch_pairs()
        for node_id in pair
    }
    assert required_nodes <= set(nodes), "SC-027 contact edges reference undeclared topology nodes"
    physical_ids = {part.component_id for part in assembly.parts}
    for node_id in required_nodes:
        node = nodes[node_id]
        assert node.get("parent_node_id") or node.get("parent_component_id") or node.get("owner_component_id")
        assert node.get("moving_group_id")
        assert node.get("provenance") in {"USER_SPECIFIED", "SCAN_EXPLICIT", "ASSUMED", "DEMO_FIXTURE"}
        assert node.get("verification_status") == "NOT_VALIDATED"
        if node_id == "transient-pill":
            assert node.get("physical_component") is False
            assert node.get("owner_component_id") is None
        elif node.get("owner_component_id") is not None:
            assert node["owner_component_id"] in physical_ids


def test_sc027_unspecified_contact_points_are_assumed_and_not_validated():
    assembly = build_concept_assembly()
    graph = _sc027_touch_graph(assembly)
    for edge in graph.get("edges", ()):
        assert "contact_point_mm" in edge
        if edge["contact_point_mm"] is None:
            assert edge.get("contact_point_status") == "ASSUMED"
            assert edge.get("contact_point_provenance") == "ASSUMED"
            assert edge.get("verification_status") == "NOT_VALIDATED"
        else:
            assert edge.get("contact_point_provenance") in {"USER_SPECIFIED", "SCAN_EXPLICIT"}
            assert edge.get("source_ref")
            assert edge.get("verification_status") == "NOT_VALIDATED"


def test_sc028_declares_one_origin_station_and_four_radius_15_indexed_towers():
    assembly = build_concept_assembly()
    source = assembly.source_geometry
    schedule = source["assembly_schedule"]
    station = schedule.get("station_interface")
    assert isinstance(station, dict), "SC-028 station interface at canonical origin is missing"
    assert station["station_count"] == 1
    assert station["origin_mm"] == [0, 0, 0]
    assert station["active_cartridge_policy"] == "single_indexed_cartridge_only"
    assert station["active_index_source"] == "controller.selected"
    assert station["provenance"] == "USER_SPECIFIED"
    assert station["verification_status"] == "NOT_VALIDATED"

    datum = schedule["datum"]["drum_post_axis_xy_mm"]
    dimensions = source["dimensions"]
    radial_dimension = next(item for item in dimensions if item["id"] == "cartridge.radial_position")
    assert radial_dimension["value"] == 15
    sockets = schedule["socket_frames"]
    assert [socket["color"] for socket in sockets] == list(SC027_COLORS)
    assert len(sockets) == 4
    for socket in sockets:
        dx = socket["center_mm"][0] - datum[0]
        dy = socket["center_mm"][1] - datum[1]
        assert math.hypot(dx, dy) == pytest.approx(15)

    components = {item["component_id"]: item for item in source["components"]}
    placements = {item["component_id"]: item for item in schedule["component_placements"]}
    blades = [item for item in source["components"] if item["category"] == "blade"]
    assert len(blades) == 4
    assert {item["component_id"] for item in blades} == {
        f"{color}-upper-blade-tab" for color in SC027_COLORS
    }
    for color in SC027_COLORS:
        blade = components[f"{color}-upper-blade-tab"]
        placement = placements[blade["component_id"]]
        assert placement["motion_group"] == f"station-{color}"
        assert placement["parent_component_id"] == "rotating-drum"
    tongues = [item for item in source["components"] if item["category"] == "tongue"]
    assert [item["component_id"] for item in tongues] == ["shared-lower-tongue"]

    # Preserve the historical A–K frame and conflicts; the new station origin
    # does not silently translate direct station-frame placements or erase them.
    assert schedule["frame_conversion"]["translation_mm"] == [0, 15, 0]
    assert schedule["frame_conversion"]["applied_component_ids"] == []
    assert schedule["housing_nominal_bounds_mm"]["x"] == [-22, 22]
    assert schedule["housing_nominal_bounds_mm"]["y"] == [-38, 36]
    conflict_ids = {item["conflict_id"] for item in schedule["conflicts"]}
    assert {
        "drum-radius-discrepancy",
        "blade-axis-conflict",
        "pin-carriage-rail-endpoint",
        "servo-pivot-rod-closure",
        "tongue-spring-fr033-ak",
        "fr031-cartridge-recipe-envelope",
    } <= conflict_ids
    assert len(components) == len(assembly.parts) == 52


def test_sc028_models_the_assumed_vertical_stack_and_tongue_datum_without_false_center():
    assembly = build_concept_assembly()
    source = assembly.source_geometry
    schedule = source["assembly_schedule"]
    stack = schedule.get("station_stack")
    assert isinstance(stack, dict), "SC-028 vertical station stack is missing"
    assert stack["layer_order"] == [
        "selected_upper_blade",
        "empty_one_pill_chamber",
        "shared_lower_tongue",
        "outlet_aperture",
        "tray_receiving_plane",
    ]
    assert source["station"]["chamber"]["parked_occupancy"] == 0
    relation = stack["outlet_to_tray_receiving_plane"]
    assert relation["distance_mm"] == 12
    assert relation["direction"] == "below_outlet_plane"
    assert relation["provenance"] == "USER_SPECIFIED"
    assert relation["verification_status"] == "NOT_VALIDATED"
    assert relation["outlet_plane_datum_status"] == "ASSUMED"
    assert relation["receiving_surface_status"] == "ASSUMED"
    assert relation["outlet_plane_z_mm"] is None
    assert relation["tray_receiving_plane_z_mm"] is None

    parts = {part.component_id: part for part in assembly.parts}
    definitions = {item["component_id"]: item for item in source["components"]}
    recipes = {item["recipe_id"]: item for item in source["component_recipes"]}
    tongue = parts["shared-lower-tongue"]
    tongue_definition = definitions["shared-lower-tongue"]
    tongue_recipe = recipes[tongue_definition["recipe_id"]]
    assert tongue_recipe["parameters"]["size"] == [14, 24, 1.5]
    assert tongue_definition["position"][0] == 0
    assert tongue_definition["position"][2] == pytest.approx(-0.75)
    closed_edge_y = source["station"]["tongue"]["edge_y_closed_open_mm"][0]
    tongue_length_y = tongue_recipe["parameters"]["size"][1]
    # The plate spans local Y=0..-24 from the closed edge, so its center Y is
    # derived from e; it is intentionally not asserted to be world Y=0.
    assert tongue_definition["position"][1] == pytest.approx(closed_edge_y - tongue_length_y / 2)
    tongue_bounds = bounds(tongue.mesh, tongue.placement_transform)
    assert tongue_bounds[0][2] == pytest.approx(-1.5)
    assert tongue_bounds[1][2] == pytest.approx(0)
    assert assembly.validation_status == "NOT_VALIDATED"


def test_sc029_scene_keeps_upper_carriage_rails_and_solenoid_in_distinct_zones():
    assembly = build_concept_assembly()
    by_id = {part.component_id: part for part in assembly.parts}
    carriage_bounds = by_id["pin-carriage"].world_bounds_mm
    assert (carriage_bounds[0][2], carriage_bounds[1][2]) == pytest.approx((14, 20))
    for rail_id in ("carriage-rail-left", "carriage-rail-right"):
        rail_bounds = by_id[rail_id].world_bounds_mm
        assert rail_bounds[0][2] >= 14
        assert rail_bounds[1][2] <= 20

    upper_solenoid_bounds = by_id["pull-solenoid"].world_bounds_mm
    assert (upper_solenoid_bounds[0][2], upper_solenoid_bounds[1][2]) == pytest.approx((22.25, 32.25))
    assert upper_solenoid_bounds[0][2] != pytest.approx(20.5)
    assert by_id["pull-solenoid"].component_id != "tongue-actuator-rod"
    assert by_id["pull-solenoid"].parent_component_id == "pin-carriage"

    schedule = assembly.source_geometry["assembly_schedule"]
    drum = by_id["rotating-drum"].world_transform[9:12]
    upper_solenoid = by_id["pull-solenoid"].world_transform[9:12]
    servo = by_id["servo-unit"].world_transform[9:12]
    assert upper_solenoid[2] > 20.5
    assert math.dist(upper_solenoid[:2], drum[:2]) > 15
    assert math.dist(servo[:2], drum[:2]) > 25
    lower_zone = schedule.get("actuator_zones", {}).get("lower_tongue")
    assert lower_zone is not None, "SC-029 lower tongue actuator zone is missing"
    assert lower_zone["center_z_mm"] == pytest.approx(-0.75)
    assert lower_zone["tower_zone_relation"] == "separate_from_four_tower_bank"
    assert lower_zone["tower_zone_status"] == "ASSUMED"
    lower_solenoid = next(
        item for item in by_id["tongue-actuator-rod"].recipe["integrated_submeshes"]
        if item["submesh_id"] == "lower-tongue-pull-solenoid-body"
    )
    assert lower_solenoid["owner_component_id"] == "tongue-actuator-rod"
    assert lower_solenoid["provenance"] == "USER_SPECIFIED"
    assert lower_solenoid["verification_status"] == "NOT_VALIDATED"
    assert len(assembly.parts) == assembly.source_geometry["export"]["physical_component_count"] == 52


def test_sc029_scene_exposes_lower_actuator_and_concentric_return_spring_without_new_parts():
    assembly = build_concept_assembly()
    source = assembly.source_geometry
    schedule = source["assembly_schedule"]
    zones = schedule.get("actuator_zones")
    assert isinstance(zones, dict), "SC-029 actuator-zone schedule is missing"
    lower = zones["lower_tongue"]
    assert lower["pull_axis_canonical"] == [0, -1, 0]
    assert lower["actuator_chain"] == [
        "lower-tongue-pull-solenoid", "lower-plunger", "lower-tongue-moving-carriage",
        "lower-tongue-strap", "shared-lower-tongue",
    ]

    topology = schedule["touch_topology"]
    nodes = {node["node_id"]: node for node in topology["nodes"]}
    assert nodes["lower-tongue-pull-solenoid"]["owner_component_id"] == "tongue-actuator-rod"
    assert nodes["lower-plunger"]["owner_component_id"] == "tongue-actuator-rod"
    assert nodes["lower-tongue-moving-carriage"]["owner_component_id"] == "tongue-actuator-rod"
    assert nodes["lower-tongue-strap"]["owner_component_id"] == "tongue-actuator-rod"

    edges = {
        (edge["source_node_id"], edge["target_node_id"]): edge
        for edge in topology["edges"]
    }
    moving_spring = edges[("tongue-return-spring", "lower-tongue-moving-carriage")]
    fixed_spring = edges[("tongue-return-spring", "tongue-fixed-bracket")]
    assert moving_spring["concentric_with_node_id"] == "lower-plunger"
    assert fixed_spring["concentric_with_node_id"] == "lower-plunger"
    assert moving_spring["status"] == fixed_spring["status"] == "UNRESOLVED"

    physical_ids = {part.component_id for part in assembly.parts}
    assert len(physical_ids) == 52
    assert not physical_ids.intersection({
        "lower-tongue-pull-solenoid", "lower-plunger",
        "lower-tongue-moving-carriage", "lower-tongue-strap",
    })


def test_sc029_scene_surfaces_integrated_actuator_mesh_ownership_and_unresolved_poses():
    assembly = build_concept_assembly()
    by_id = {part.component_id: part for part in assembly.parts}
    rod = by_id["tongue-actuator-rod"]
    assert {feature["submesh_id"] for feature in rod.integrated_submeshes} >= {
        "lower-tongue-pull-solenoid-body", "lower-plunger", "lower-tongue-moving-carriage",
        "lower-tongue-strap",
    }
    for feature in rod.integrated_submeshes:
        if feature["submesh_id"] in {
            "lower-tongue-pull-solenoid-body", "lower-plunger",
            "lower-tongue-moving-carriage", "lower-tongue-strap",
        }:
            assert feature["owner_component_id"] == "tongue-actuator-rod"
            assert feature["provenance"] in {"USER_SPECIFIED", "ASSUMED"}
            assert feature["verification_status"] == "NOT_VALIDATED"
            assert feature["source_position_mm"] is None
            assert feature["position_status"] == "ASSUMED_RENDERED_FALLBACK"

    schedule = assembly.source_geometry["assembly_schedule"]
    lower = schedule["actuator_zones"]["lower_tongue"]
    spring = by_id["tongue-return-spring"]
    spring_axis = tuple(spring.world_transform[6:9])
    assert spring_axis == pytest.approx((0, 1, 0))
    assert lower["spring_center_fallback_mm"] == [0, -57.15, -0.75]
    assert lower["plunger_carriage_contact_mm"] is None
    assert lower["spring_end_seat_offsets_mm"] is None
    assert lower["interface_status"] == "UNRESOLVED"