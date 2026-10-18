"""Component-level AABB overlap audit of the Feature 003 canonical assembly.

Bounding-box bookkeeping only: not a clearance, fit, or CAD interference result.
"""
import itertools
import math

import pytest

from dispenser_sim.viz3d.mesh import transform_point
from dispenser_sim.viz3d.scene import build_concept_assembly

AXLE_XY = (0.0, 15.0)
KEEP_OUT_RADIUS_MM = 24.65


def _connected_components(mesh):
    parent = list(range(len(mesh.vertices)))

    def find(index):
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    for triangle in mesh.triangles:
        for corner in triangle[1:]:
            a, b = find(triangle[0]), find(corner)
            if a != b:
                parent[a] = b
    groups = {}
    for index in range(len(mesh.vertices)):
        groups.setdefault(find(index), []).append(index)
    return list(groups.values())


def _component_boxes(assembly):
    boxes = []
    for part in assembly.parts:
        world = [transform_point(vertex, part.world_transform) for vertex in part.mesh.vertices]
        for index, group in enumerate(_connected_components(part.mesh)):
            points = [world[i] for i in group]
            boxes.append((part.component_id, index,
                          tuple(min(p[axis] for p in points) for axis in range(3)),
                          tuple(max(p[axis] for p in points) for axis in range(3))))
    return boxes


def _gap(a, b):
    """Largest per-axis separation; negative means penetration on every axis."""
    return max(max(b[2][axis] - a[3][axis], a[2][axis] - b[3][axis]) for axis in range(3))


@pytest.fixture(scope="module")
def assembly():
    return build_concept_assembly()


@pytest.fixture(scope="module")
def boxes(assembly):
    return _component_boxes(assembly)


@pytest.fixture(scope="module")
def schedule(assembly):
    return assembly.source_geometry["assembly_schedule"]


def _overlapping_pairs(boxes, eps):
    pairs = {}
    for a, b in itertools.combinations(boxes, 2):
        if a[0] != b[0] and _gap(a, b) < -eps:
            pairs.setdefault(tuple(sorted((a[0], b[0]))), []).append((a[1], b[1]))
    return pairs


def test_only_declared_intended_contacts_overlap(boxes, schedule):
    eps = schedule["overlap_audit"]["eps_mm"]
    assert eps == 0.05
    declared = {tuple(item["component_ids"]) for item in schedule["intended_contacts"]}
    assert len(declared) == len(schedule["intended_contacts"])
    actual = set(_overlapping_pairs(boxes, eps))
    assert actual - declared == set(), "undeclared component-level overlaps"
    assert declared - actual == set(), "declared intended contacts that no longer overlap"


def test_every_intended_and_face_contact_is_assumed_and_never_pass(schedule):
    for key in ("intended_contacts", "face_contacts"):
        for item in schedule[key]:
            assert item["status"] == "ASSUMED"
            assert item["verification_status"] == "NOT_VALIDATED"
            assert item["pass_claimed"] is False
            assert "PASS" not in {item["status"], item["verification_status"]}
    assert schedule["overlap_audit"]["pass_claimed"] is False
    assert schedule["overlap_audit"]["status"] != "PASS"


def test_face_contacts_touch_without_penetrating(boxes, schedule):
    eps = schedule["overlap_audit"]["eps_mm"]
    by_part = {}
    for box in boxes:
        by_part.setdefault(box[0], []).append(box)
    for item in schedule["face_contacts"]:
        first, second = item["component_ids"]
        gaps = [_gap(a, b) for a in by_part[first] for b in by_part[second]]
        touching = [gap for gap in gaps if abs(gap) <= eps]
        assert touching, f"no touching face pair for {item['contact_id']}"
        assert min(gaps) >= -eps, f"{item['contact_id']} penetrates"


def test_tongue_actuator_display_submeshes_are_separate_and_do_not_touch_housing(assembly, boxes):
    rod_boxes = [box for box in boxes if box[0] == "tongue-actuator-rod"]
    recipe = next(part for part in assembly.parts if part.component_id == "tongue-actuator-rod").recipe
    names = ["rod-core", *(item["submesh_id"] for item in recipe["integrated_submeshes"])]
    assert len(rod_boxes) == len(names) == 5
    named = dict(zip(names, rod_boxes))
    chain = ("lower-plunger", "lower-tongue-moving-carriage", "lower-tongue-strap")
    for a, b in itertools.combinations(chain, 2):
        assert _gap(named[a], named[b]) >= -0.05, (a, b)
    for name in chain[1:]:
        assert _gap(named["lower-tongue-pull-solenoid-body"], named[name]) >= -0.05, name
    carriage = named["lower-tongue-moving-carriage"]
    assert carriage[2][1] == pytest.approx(-46.3)
    for name in chain:
        for housing in (box for box in boxes if box[0] == "station-housing"):
            assert _gap(named[name], housing) >= -0.05, (name, housing[1])


def test_lower_tongue_actuator_layout_follows_the_reference(assembly, boxes, schedule):
    parts = {part.component_id: part for part in assembly.parts}
    spring = parts["tongue-return-spring"]
    assert spring.world_transform[9:12] == pytest.approx((0, -57.15, -0.75))
    lower = schedule["actuator_zones"]["lower_tongue"]
    assert lower["spring_center_fallback_mm"] == [0, -57.15, -0.75]
    assert lower["fixed_bracket_rendered_fallback_mm"] == [0, -68, -0.75]
    assert lower["carriage_rear_face_y_closed_mm"] == -46.3
    assert lower["spring_length_closed_open_mm"] == [21.7, 10.3]
    rod = [box for box in boxes if box[0] == "tongue-actuator-rod"]
    solenoid = rod[1]
    assert (solenoid[2][1], solenoid[3][1]) == pytest.approx((-99.5, -70))
    assert (solenoid[2][0] + solenoid[3][0]) / 2 == pytest.approx(0)
    assert (solenoid[2][2] + solenoid[3][2]) / 2 == pytest.approx(-0.75)
    assert (solenoid[3][0] - solenoid[2][0], solenoid[3][1] - solenoid[2][1], solenoid[3][2] - solenoid[2][2]) == pytest.approx((20.6, 29.5, 23.9))
    bracket = [box for box in boxes if box[0] == "station-housing" and box[2][1] < -60]
    assert len(bracket) == 4
    assert min(box[2][1] for box in bracket) == pytest.approx(-70)
    assert max(box[3][1] for box in bracket) == pytest.approx(-68)
    assert max(box[3][2] for box in bracket) == pytest.approx(11.5)
    assert min(box[2][2] for box in bracket) == pytest.approx(-13)


def test_blade_return_springs_follow_the_socket_u_axis_formula(assembly, schedule):
    parts = {part.component_id: part for part in assembly.parts}
    for socket in schedule["socket_frames"]:
        color = socket["color"]
        u = socket["local_axes"]["u"]
        expected = [socket["center_mm"][0] + 9.9 * u[0], socket["center_mm"][1] + 9.9 * u[1], 7.2]
        assert parts[f"{color}-upper-blade-return-spring"].world_transform[9:12] == pytest.approx(expected)


def test_servo_rests_on_rails_and_rod_is_unstretched_between_crank_and_carriage(assembly, boxes):
    parts = {part.component_id: part for part in assembly.parts}
    servo = parts["servo-unit"].world_bounds_mm
    assert servo[0][2] == pytest.approx(16.6)
    assert (servo[1][2] - servo[0][2]) == pytest.approx(22.7)
    for rail in ("carriage-rail-left", "carriage-rail-right"):
        assert parts[rail].world_bounds_mm[1][2] == pytest.approx(16.6)
    rod = parts["connecting-rod"].world_bounds_mm
    assert rod[1][1] - rod[0][1] == pytest.approx(34)
    assert rod[1][1] == pytest.approx(parts["pin-carriage"].world_bounds_mm[0][1])
    assert 14 <= rod[0][2] and rod[1][2] <= 16.6
    assert rod[1][1] < -8, "rod must stay behind the drum/cartridges"


def test_scanner_matches_optical_schedule_and_clears_the_tower_sweep(assembly, boxes, schedule):
    optical = schedule["scanner_optical_schedule"]
    parts = {part.component_id: part for part in assembly.parts}
    housing = parts["barcode-scanner-housing"].world_bounds_mm
    assert housing[0][0] == pytest.approx(-58.4) and housing[1][0] == pytest.approx(-37)
    assert housing[0][1] == pytest.approx(-6.75) and housing[1][1] == pytest.approx(6.75)
    assert optical["optical_point_mm"] == pytest.approx([housing[1][0], 0, (housing[0][2] + housing[1][2]) / 2])
    red = parts["red-cartridge"].world_bounds_mm
    assert optical["label_plane_x_mm"] == pytest.approx(red[0][0])
    assert optical["line_of_sight_mm"] == pytest.approx(optical["label_plane_x_mm"] - optical["optical_point_mm"][0])
    assert optical["line_of_sight_mm"] == pytest.approx(29.6)
    assert optical["status"] == "ASSUMED" and optical["historical_candidates_used"] is False
    for component_id in ("barcode-scanner-housing", "scanner-head-placeholder", "scanner-mount"):
        for box in (box for box in boxes if box[0] == component_id):
            dx = max(box[2][0] - AXLE_XY[0], 0, AXLE_XY[0] - box[3][0])
            dy = max(box[2][1] - AXLE_XY[1], 0, AXLE_XY[1] - box[3][1])
            assert math.hypot(dx, dy) > KEEP_OUT_RADIUS_MM, component_id
    mount = parts["scanner-mount"].world_bounds_mm
    assert (mount[0][0], mount[1][0]) == pytest.approx((-45.5, -41.5))
    assert (mount[0][1], mount[1][1]) == pytest.approx((-3, 3))
    assert mount[0][2] == pytest.approx(-1.65)


def test_electronics_deck_stays_right_hand_and_stepper_sits_under_the_base_on_the_axle(assembly, boxes):
    parts = {part.component_id: part for part in assembly.parts}
    deck = parts["electronics-deck"]
    plate, stepper, shaft = [box for box in boxes if box[0] == "electronics-deck"]
    assert (plate[2], plate[3]) == (pytest.approx((22, -82, -3)), pytest.approx((60, 58, -1.65)))
    assert (stepper[3][0] - stepper[2][0], stepper[3][2] - stepper[2][2]) == pytest.approx((28, 19))
    assert ((stepper[2][0] + stepper[3][0]) / 2, (stepper[2][1] + stepper[3][1]) / 2) == pytest.approx(AXLE_XY)
    assert (stepper[2][2], stepper[3][2]) == pytest.approx((-35, -16))
    assert (shaft[3][0] - shaft[2][0], shaft[3][2] - shaft[2][2]) == pytest.approx((5, 8))
    assert ((shaft[2][0] + shaft[3][0]) / 2, (shaft[2][1] + shaft[3][1]) / 2) == pytest.approx(AXLE_XY)
    assert (shaft[2][2], shaft[3][2]) == pytest.approx((-16, -8))
    board = parts["controller-board-placeholder"].world_bounds_mm
    assert board[0][:2] == pytest.approx((26, -80)) and board[1][:2] == pytest.approx((53.9, -25.6))
    assert board[0][2] == pytest.approx(-1.65)
    assert deck.component_id == "electronics-deck"


def test_drive_train_stack_is_coaxial_and_chained_without_gaps(assembly, boxes, schedule):
    by_part = {}
    for box in boxes:
        by_part.setdefault(box[0], []).append(box)
    extension = by_part["rotating-drum"][-1]
    shaft = by_part["electronics-deck"][-1]
    post = by_part["central-post"][0]
    assert (extension[2][2], extension[3][2]) == pytest.approx((-9, 0))
    assert ((extension[2][0] + extension[3][0]) / 2, (extension[2][1] + extension[3][1]) / 2) == pytest.approx(AXLE_XY)
    assert (extension[3][0] - extension[2][0], extension[3][2] - extension[2][2]) == pytest.approx((5, 9))
    assert extension[3][2] == pytest.approx(post[2][2])  # touches the post bottom
    assert shaft[3][2] - extension[2][2] == pytest.approx(1)  # 1 mm coupler overlap
    plate, column_left, column_right = [
        box for box in by_part["station-housing"]
        if box[2][2] < -3.5 and abs((box[2][1] + box[3][1]) / 2 - AXLE_XY[1]) < 1e-6]
    assert (plate[2], plate[3]) == (pytest.approx((-21, 5, -16)), pytest.approx((21, 25, -14.5)))
    for column, x in ((column_left, -17.5), (column_right, 17.5)):
        assert ((column[2][0] + column[3][0]) / 2, (column[2][1] + column[3][1]) / 2) == pytest.approx((x, 15))
        assert (column[3][0] - column[2][0], column[3][1] - column[2][1], column[3][2] - column[2][2]) == pytest.approx((4, 4, 11.5))
        assert (column[2][2], column[3][2]) == pytest.approx((-14.5, -3))
    stepper = by_part["electronics-deck"][1]
    assert stepper[3][2] == pytest.approx(plate[2][2])  # stepper top meets the plate underside
    tray = by_part["outlet-tray"][0]
    assert (tray[2], tray[3]) == (pytest.approx((-20, -42, -14)), pytest.approx((20, 8, -12.5)))
    for other in (shaft, extension):
        assert other[2][1] - tray[3][1] > 0, "drive shaft must clear the shortened tray"
    drive = schedule["drive_train"]
    assert drive["status"] == "ASSUMED" and drive["verification_status"] == "NOT_VALIDATED"
    assert drive["pass_claimed"] is False
    assert drive["steps_per_quarter_turn_full_step"] == 512
    conflicts = {item["conflict_id"] for item in schedule["conflicts"]}
    assert {drive["post_role_conflict_id"], drive["tray_conflict_id"]} <= conflicts


def test_new_drive_train_submeshes_are_assumed_not_validated_and_owned(assembly):
    expected = {
        "stepper-shaft": "electronics-deck", "drive-shaft-extension": "rotating-drum",
        "stepper-mount-plate": "station-housing", "stepper-mount-column-left": "station-housing",
        "stepper-mount-column-right": "station-housing",
    }
    found = {}
    for part in assembly.parts:
        for feature in part.integrated_submeshes:
            if feature["submesh_id"] in expected:
                found[feature["submesh_id"]] = part.component_id
                assert feature["owner_component_id"] == part.component_id
                assert feature["provenance"] == "ASSUMED"
                assert feature["verification_status"] == "NOT_VALIDATED"
                assert feature["position_status"] == "ASSUMED"
                assert feature["source_ref"] == "user-request:stepper-under-base-2026-10-12"
    assert found == expected
    assert len(assembly.parts) == 52
