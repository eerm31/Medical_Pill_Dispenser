"""Wall thickness around the viewer pockets in the housing platform (ASSUMED / NOT_VALIDATED).

The canonical `station-housing` mesh is a coarse concept shell, so the walls are measured on the housing exactly
as the viewer draws it (15 boxes parsed from reference-look.js, exact box-union distance, stdlib only). Pockets
checked: 625ZZ seat, hall pocket, column sockets. Proposed minimum wall 0.8 mm (two 0.4 mm perimeters).
Findings go through check_findings; the C4 seat wall is KNOWN-OPEN.
"""
from feature005_spec import (G, check_findings, distance_box_to_void, distance_cylinder_to_void, solid_cells,
                             viewer_housing_boxes)

MIN_WALL = 0.8
SEAT_WORST_CASE_EXTRA_R = 0.05  # unreamed seat as printed, about O16.1 (plan D2)


def _inner_void_cells():
    boxes = viewer_housing_boxes()
    platform = boxes
    lo = [min(b[2 * a] for b in platform) for a in range(3)]
    hi = [max(b[2 * a + 1] for b in platform) for a in range(3)]
    cells = []
    for c, solid in solid_cells(boxes):
        mid = [(c[a][0] + c[a][1]) / 2 for a in range(3)]
        inside = all(lo[a] < mid[a] < hi[a] for a in range(3))
        in_pocket = 7.5 < mid[0] < 11.9 and -17.7 < mid[1] < -14.3  # the hall pocket and its lead slot hold the sensor
        cells.append((c, solid or not inside or in_pocket))  # exterior counts as "not void": only internal voids matter
    return cells


def test_walls_around_seat_hall_pocket_and_column_sockets_meet_the_minimum_or_are_recorded():
    g = G()
    cells = _inner_void_cells()
    ax, ay = g["axle"]
    seat = distance_cylinder_to_void(ax, ay, g["bearing_r_out"] + SEAT_WORST_CASE_EXTRA_R, g["bearing_z0"],
                                     g["bearing_z1"], cells)
    hall = distance_box_to_void((g["hall_x"][0], g["hall_x"][1], g["hall_y"][0], g["hall_y"][1],
                                 g["hall_z0"], g["hall_z1"]), cells)
    h = g["socket_half"]
    sockets = {}
    for sx in (-1, 1):
        x = sx * g["column_x"]
        sockets[sx] = distance_box_to_void((x - h, x + h, ay + g["motor_offset_y"] - h, ay + g["motor_offset_y"] + h,
                                            -3.0, g["socket_z1"]), cells)
    print(f"seat wall to the tongue pocket (O16.1 worst case): {seat:.3f} mm")
    print(f"hall pocket wall to the nearest internal void: {hall:.3f} mm")
    print(f"column socket walls: {sockets[-1]:.3f} / {sockets[1]:.3f} mm; ")
    print("collar region is flush with the platform side edge (plan N4/R18): reported, not a finding")
    findings = []
    for key, value in (("seat_wall_tongue_pocket", seat), ("hall_pocket_wall", hall),
                       ("column_socket_wall-", sockets[-1]), ("column_socket_wall+", sockets[1])):
        if round(value, 6) < MIN_WALL:
            findings.append({"key": key, "measured": value, "threshold": MIN_WALL})
    check_findings("housing_wall", findings)
