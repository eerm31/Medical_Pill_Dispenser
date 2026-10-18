import math
import pytest

from dispenser_sim.viz3d.geometry_schema import load_geometry
from dispenser_sim.viz3d.mesh import bounds, canonical_to_three, mesh_from_recipe, three_to_canonical, transform_point, validate_mesh


def test_all_canonical_component_meshes_are_finite_and_closed():
    data = load_geometry()
    recipes = {item["recipe_id"]: item for item in data["component_recipes"]}
    for component in data["components"]:
        mesh = mesh_from_recipe(recipes[component["recipe_id"]])
        result = validate_mesh(mesh)
        assert result["status"] == "PASS"
        assert all(math.isfinite(value) for point in mesh.vertices for value in point)


def test_right_handed_nonidentity_rotation_and_translation_roundtrip():
    p = (1.25, -2.0, 3.5)
    transform = (0., 1., 0., -1., 0., 0., 0., 0., 1., 4., 5., 6.)
    q = transform_point(p, transform)
    assert q == (6.0, 6.25, 9.5)
    inverse = (0., -1., 0., 1., 0., 0., 0., 0., 1., -5., 4., -6.)
    assert transform_point(q, inverse) == p


def test_recipe_mesh_bounds_are_concept_dimensions():
    recipes = {item["recipe_id"]: item for item in load_geometry()["component_recipes"]}
    lo, hi = bounds(mesh_from_recipe(dict(recipes["housing"], integrated_submeshes=[])))
    # Nominal station block plus the integrated reference features (bracket y -70..-68, scanner base plate x -60..-22).
    assert (hi[0]-lo[0], hi[1]-lo[1], hi[2]-lo[2]) == (82, 106, 24.5)
    assert (lo[0], hi[0], lo[1], hi[1]) == (-60, 22, -70, 36)
    block = [box for box in recipes["housing"]["parameters"]["boxes"]]
    assert (min(b[0]-b[3]/2 for b in block), max(b[0]+b[3]/2 for b in block)) == (-22, 22)
    assert (min(b[1]-b[4]/2 for b in block), max(b[1]+b[4]/2 for b in block)) == (-38, 36)
    tray_lo, tray_hi = bounds(mesh_from_recipe(recipes["tray"]))
    assert (tray_lo, tray_hi) == ((-20, -25, -0.75), (20, 25, 0.75))


def test_top_only_blade_wedge_flat_underside_and_local_y_stroke():
    data = load_geometry()
    recipes = {item["recipe_id"]: item for item in data["component_recipes"]}
    blade = mesh_from_recipe(recipes["blade"])
    assert validate_mesh(blade)["scope"].startswith("bounded artifact")
    lo, hi = bounds(blade)
    assert (hi[0] - lo[0], hi[1] - lo[1]) == (10.5, 24)
    assert lo[2] == 0 and hi[2] == 1
    assert recipes["blade"]["kind"] == "blade_with_wedge"
    assert recipes["blade"]["parameters"]["wedge"] == {"length": 2.6, "leading_thickness": 0.3, "body_thickness": 1.0, "side": "top", "leading_edge_local_y": 0}
    assert recipes["blade"]["parameters"]["stroke_axis"] == "local_y"
    assert recipes["blade"]["parameters"]["slot_center_y"] == 20
    assert recipes["blade"]["parameters"]["tab_start_y"] == 16
    assert recipes["blade"]["parameters"]["tab_end_y"] == 24


def test_tongue_mesh_is_separate_flat_lower_floor_and_y_travel():
    data = load_geometry()
    recipes = {item["recipe_id"]: item for item in data["component_recipes"]}
    tongue = mesh_from_recipe(recipes["tongue"])
    lo, hi = bounds(tongue)
    assert (hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) == (14, 24, 1.5)
    assert recipes["tongue"]["kind"] == "box"
    assert recipes["tongue"]["parameters"]["travel_axis"] == "canonical_y"


def test_canonical_to_three_basis_is_right_handed_and_round_trips():
    assert canonical_to_three((1, 0, 0)) == (1, 0, 0)
    assert canonical_to_three((0, 1, 0)) == (0, 0, -1)
    assert canonical_to_three((0, 0, 1)) == (0, 1, 0)
    axes = [canonical_to_three(axis) for axis in ((1, 0, 0), (0, 1, 0), (0, 0, 1))]
    determinant = sum(axes[0][i] * (axes[1][(i + 1) % 3] * axes[2][(i + 2) % 3] - axes[1][(i + 2) % 3] * axes[2][(i + 1) % 3]) for i in range(3))
    assert determinant == 1
    point = (1.25, -2.0, 3.5)
    assert three_to_canonical(canonical_to_three(point)) == point


def test_fr034_all_52_physical_recipe_references_are_bounded_and_deterministic():
    data = load_geometry()
    recipes = {item["recipe_id"]: item for item in data["component_recipes"]}
    components = data["components"]
    assert len(components) == data["export"]["physical_component_count"] == 52
    assert all(component["recipe_id"] in recipes for component in components)
    allowed = {"box", "compound_box", "cylinder", "cone", "rod", "ring", "helix", "extrusion", "profile", "blade_with_wedge"}
    assert {recipe["kind"] for recipe in recipes.values()} <= allowed

    for component in components:
        recipe = recipes[component["recipe_id"]]
        mesh = mesh_from_recipe(recipe)
        repeated = mesh_from_recipe(recipe)
        assert mesh.vertices == repeated.vertices
        assert mesh.triangles == repeated.triangles
        assert validate_mesh(mesh)["status"] == "PASS"
        assert all(math.isfinite(value) for vertex in mesh.vertices for value in vertex)
        assert all(len(face) == 3 and len(set(face)) == 3 for face in mesh.triangles)
        assert all(0 <= index < len(mesh.vertices) for face in mesh.triangles for index in face)
        assert bounds(mesh) == bounds(repeated)


def test_fr034_drum_mesh_contains_four_integrated_socket_decks_in_local_frames():
    data = load_geometry()
    recipes = {item["recipe_id"]: item for item in data["component_recipes"]}
    drum = recipes["drum"]
    decks = drum["parameters"]["socket_decks"]
    assert len(decks) == 4
    assert [item["center_mm"] for item in decks] == [
        [0, -15, -20.5], [15, 0, -20.5], [0, 15, -20.5], [-15, 0, -20.5]
    ]
    assert all(item["size_mm"] == [16, 26.5, 1] for item in decks)
    mesh = mesh_from_recipe(drum)
    lo, hi = bounds(mesh)
    # Local z -34 is the drive-shaft extension tip (world z -9); the ring itself spans -21..21.
    assert lo[2] == pytest.approx(-34)
    assert hi[2] == pytest.approx(21)
    assert validate_mesh(mesh)["status"] == "PASS"


def test_fr034_cartridge_mesh_uses_tangential_v_then_radial_u_and_preserves_fr031_recipe():
    data = load_geometry()
    recipes = {item["recipe_id"]: item for item in data["component_recipes"]}
    cartridge = recipes["cartridge"]
    lo, hi = bounds(mesh_from_recipe(cartridge))
    assert (hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) == (12.4, 14.8, 40)
    assert cartridge["parameters"]["size_axes"] == "local X=radial u, local Y=tangential v"
    assert cartridge["parameters"]["channel_size_mm"] == [8.4, 10.8]
    assert recipes["cartridge-recipe-fr031"]["parameters"]["size"] == [12.8, 10.4, 40]


def test_fr034_added_placeholder_extents_are_assumed_bounded_meshes():
    data = load_geometry()
    recipes = {item["recipe_id"]: item for item in data["component_recipes"]}
    components = {item["component_id"]: item for item in data["components"]}
    ids = [
        *(f"{color}-cap-label-plate" for color in ("red", "blue", "green", "orange")),
        *(f"{color}-passive-tag-carrier" for color in ("red", "blue", "green", "orange")),
        *(f"{color}-cap-hinge-assembly" for color in ("red", "blue", "green", "orange")),
        *(f"{color}-cap-latch-body" for color in ("red", "blue", "green", "orange")),
        "electronics-deck", "controller-board-placeholder", "scanner-head-placeholder", "scanner-mount",
    ]
    assert len(ids) == 20
    for component_id in ids:
        component = components[component_id]
        recipe = recipes[component["recipe_id"]]
        extent = component["assumed_extent_mm"]
        assert len(extent) == 3 and all(math.isfinite(value) and value > 0 for value in extent)
        assert component["placement_provenance"] == "ASSUMED"
        assert component["verification_status"] == "NOT_VALIDATED"
        assert component["extent_provenance"] == "ASSUMED"
        assert recipe["provenance"] == "ASSUMED"
        assert recipe["verification_status"] == "NOT_VALIDATED"
        assert recipe["kind"] in {"box", "cylinder", "rod", "extrusion", "profile"}
        base_recipe = dict(recipe, integrated_submeshes=[])
        base_bounds = bounds(mesh_from_recipe(base_recipe))
        assert base_bounds[0] == pytest.approx(tuple(-value / 2 for value in extent))
        assert base_bounds[1] == pytest.approx(tuple(value / 2 for value in extent))
        owner_bounds = bounds(mesh_from_recipe(recipe))
        for submesh in recipe.get("integrated_submeshes", ()):
            size = submesh["parameters"]["size_mm"]
            position = submesh["position_mm"]
            if submesh["kind"] == "cylinder" and submesh.get("rotation_rad", [0, 0, 0])[1]:
                expected_half_extents = (size[1] / 2, size[0] / 2, size[0] / 2)
            elif submesh["kind"] == "cylinder":
                expected_half_extents = (size[0] / 2, size[0] / 2, size[1] / 2)
            else:
                expected_half_extents = tuple(value / 2 for value in size)
            expected_min = tuple(position[axis] - expected_half_extents[axis] for axis in range(3))
            expected_max = tuple(position[axis] + expected_half_extents[axis] for axis in range(3))
            assert all(owner_bounds[0][axis] <= expected_min[axis] for axis in range(3))
            assert all(owner_bounds[1][axis] >= expected_max[axis] for axis in range(3))


def test_sc029_carriage_mesh_respects_z_band_and_integrated_microswitch_orientation():
    data = load_geometry()
    recipes = {item["recipe_id"]: item for item in data["component_recipes"]}
    carriage_recipe = recipes["carriage"]
    carriage = mesh_from_recipe(carriage_recipe)
    lo, hi = bounds(carriage, (1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -14.8, 17))
    assert (lo[2], hi[2]) == pytest.approx((14, 20))
    microswitch = next(item for item in carriage_recipe["integrated_submeshes"]
                       if item["submesh_id"] == "microswitch-body")
    assert microswitch["parameters"]["size_mm"] == [12.8, 5.8, 6.5]
    assert microswitch["position_status"] == "ASSUMED_RENDERED_FALLBACK"
    assert microswitch["source_position_mm"] is None
    assert microswitch["rotation_rad"] != [0, 0, 0]


def test_sc029_lower_chain_is_bounded_as_integrated_meshes_not_export_parts():
    data = load_geometry()
    recipes = {item["recipe_id"]: item for item in data["component_recipes"]}
    recipe = recipes["tongue-rod"]
    required = {"lower-tongue-pull-solenoid-body", "lower-plunger",
                "lower-tongue-moving-carriage", "lower-tongue-strap"}
    integrated = {item["submesh_id"]: item for item in recipe["integrated_submeshes"]}
    assert required <= integrated.keys()
    assert integrated["lower-tongue-pull-solenoid-body"]["parameters"]["size_mm"] == [29.5, 20.6, 23.9]
    mesh = mesh_from_recipe(recipe)
    assert validate_mesh(mesh)["status"] == "PASS"
    assert all(math.isfinite(value) for vertex in mesh.vertices for value in vertex)
    assert len(data["components"]) == data["export"]["physical_component_count"] == 52