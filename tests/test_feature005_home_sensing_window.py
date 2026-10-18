"""Home sensing window for the hall + magnet pair (ASSUMED / NOT_VALIDATED, stdlib only).

The magnet (9.7, -16.0) rides on a circle of radius 32.48 about the axle (0, 15); the hall sensor is fixed at the
same plan position. Numbers here are exported as named values for the controller (docs/visualizer/rotation-controller.js
repeats them; tests/test_feature005_rotation_controller.py checks they agree).
"""
import math

from feature005_spec import EPS, G, drum_items, fixed_items, rotate_point, sweep

STEP_DEG_NOMINAL = 360.0 / 2048
STEP_DEG_CALIBRATED = 360.0 / 2037.9
TOLERANCE_DEG = 0.5


def _inside_centre(g, deg):
    mx, my = g["magnet_xy"]
    px, py = rotate_point((mx, my), deg)
    return g["hall_x"][0] <= px <= g["hall_x"][1] and g["hall_y"][0] <= py <= g["hall_y"][1]


def window_deg(g=None, resolution=0.01):
    """(entry, exit, width) of the drum angle band where the magnet centre is over the hall footprint (CCW positive)."""
    g = g or G()
    angles = [i * resolution for i in range(int(-180 / resolution), int(180 / resolution) + 1)]
    inside = [a for a in angles if _inside_centre(g, a)]
    return min(inside), max(inside), max(inside) - min(inside)


def test_magnet_radius_and_offset_from_the_red_radial():
    g = G()
    mx, my = g["magnet_xy"]
    radius = math.hypot(mx - g["axle"][0], my - g["axle"][1])
    magnet_angle = math.degrees(math.atan2(my - g["axle"][1], mx - g["axle"][0]))
    red_radial = -90.0
    assert abs(radius - 32.48) < 0.006
    assert abs((magnet_angle - red_radial) - 17.38) < 0.01
    print(f"magnet radius {radius:.3f} mm, {magnet_angle - red_radial:.2f} deg CCW of the RED radial (drum frame)")


def test_home_window_is_centred_on_the_red_station_and_narrower_than_a_quarter_turn():
    g = G()
    entry, exit_, width = window_deg(g)
    print(f"home window (magnet centre over the hall footprint): {entry:.2f}..{exit_:.2f} deg, width {width:.2f} deg")
    # hall and magnet share the plan position, so the home window is centred on the RED-at-station angle (0 deg)
    assert abs(entry + exit_) < 0.15 and 7.2 <= width <= 7.6  # slightly asymmetric: the path is an arc, the footprint a box
    assert width > 2 * TOLERANCE_DEG + STEP_DEG_NOMINAL  # wider than the +-0.5 deg tolerance plus one step
    # CCW approach: the rising edge is HOME_EDGE_TO_RED_DEG before the station
    home_edge_to_red = -entry
    print(f"CCW rising edge to RED station: {home_edge_to_red:.2f} deg = "
          f"{home_edge_to_red / STEP_DEG_NOMINAL:.1f} steps at 2048, {home_edge_to_red / STEP_DEG_CALIBRATED:.1f} at 2037.9")
    assert 3.6 <= home_edge_to_red <= 3.8
    for k, name in enumerate(("RED", "BLUE", "GREEN", "ORANGE")):
        print(f"edge-to-{name}: {home_edge_to_red + 90 * k:.2f} deg")


def test_exactly_one_home_crossing_per_turn_and_magnet_clears_every_other_fixed_item():
    g = G()
    rising, prev = 0, _inside_centre(g, 0.0)
    for i in range(1, 36001):
        cur = _inside_centre(g, i * 0.01)
        rising += cur and not prev
        prev = cur
    assert rising == 1
    magnet = [d for d in drum_items(g) if d.name in {"boss", "magnet"}]
    best = sweep(magnet, [f for f in fixed_items(g) if f.name != "hall"], step_deg=1.0, extra_angles=(0.0,))
    assert all(c >= EPS for c, _ in best.values()), best


def test_unbonded_station_step_targets_use_the_calibrated_ratio():
    # quarter turn at nominal 2048 steps/rev is 512 steps; at 2037.9 it is 90.447 deg, 0.447 deg too far
    assert abs(512 * STEP_DEG_CALIBRATED - 90.0 - 0.447) <= 0.001
    assert round(2037.9 / 4) == 509
