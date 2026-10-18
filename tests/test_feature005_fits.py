"""Fit and clearance arithmetic taken from rotation-spec.js (ASSUMED / NOT_VALIDATED, stdlib only).

Every number is derived from `g`; thresholds are proposed. Findings go through check_findings; the M3 pilot wall
(R14) is KNOWN-OPEN.
"""
import math

from feature005_spec import G, check_findings

CLIP_ARM_T, CLIP_DEFLECTION, CLIP_ARM_L = 1.2, 0.7, 14.6  # mm; arm length is the plan hand value
CLIP_STRAIN_LIMIT = 0.01  # proposed
M3_PILOT_D = 2.6  # plan R14 hand value, self-tapping pilot
MIN_WALL = 0.8
LAYER = 0.2


def _near(a, b, tol=1e-9):
    return abs(a - b) <= tol


def test_radial_axial_and_flat_fits_match_the_plan_numbers():
    g = G()
    assert _near(g["bore_flat_x"] - g["rod_flat_x"], 0.10)  # D bore flat vs rod flat, per side
    assert _near(g["ring_r_in"] - g["bearing_r_out"], 0.5)  # ring ID vs bearing OD, radial
    assert _near(g["seat_r_out"] - g["ring_r_out"], 0.5)  # ring OD vs seat boss
    assert _near(g["column_x"] - g["column_half"] - g["coupler_r"], 8.5)  # coupler to column inner face (x only)
    assert _near(-3.0 - g["coupler_z1"], 0.5)  # coupler top 0.5 below the deck underside (z1 -3.5)  # coupler top to platform underside
    assert _near(g["coupler_z1"] - g["rod_z0"], 4.5)  # rod in coupler
    assert _near(g["motor_shaft_z1"] - g["coupler_z0"], 5.9)  # shaft in coupler
    assert _near(g["rod_z0"] - g["motor_shaft_z1"], 0.6)  # shaft-to-rod gap
    assert _near(g["hook_z0"] - g["ledge_z1"], 0.8)
    assert _near(g["magnet_z0"] - g["hall_z1"], 0.9)  # sensing gap
    assert _near(g["magnet_z0"] - g["hub_z0"], 0.6) and _near(0.6 / LAYER, 3.0)  # pocket floor = 3 layers
    assert _near(g["socket_half"] - g["spigot_half"], 0.15)  # spigot / socket per side
    assert _near(g["hub_z0"] - g["ring_z0"], 0.3)  # deck-to-platform gap carried by the ring


def test_unbonded_d_flat_play_is_about_3_8_degrees():
    g = G()
    gap = g["bore_flat_x"] - g["rod_flat_x"]
    half_chord = math.sqrt(g["rod_r"] ** 2 - g["rod_flat_x"] ** 2)  # 1.5 mm
    play = math.degrees(gap / half_chord)
    print(f"unbonded D-flat play {play:.2f} deg (zero play depends on the epoxy, R13)")
    assert 3.7 <= play <= 3.9


def test_clip_strain_stays_below_the_proposed_limit():
    strain = 3 * CLIP_ARM_T * CLIP_DEFLECTION / (2 * CLIP_ARM_L ** 2)
    print(f"clip strain {strain * 100:.2f} % against {CLIP_STRAIN_LIMIT * 100:.0f} % proposed")
    assert 0.0055 <= strain <= 0.0065 and strain <= CLIP_STRAIN_LIMIT


def test_m3_pilot_wall_and_minimum_wall_findings_are_recorded():
    g = G()
    wall = (2 * g["column_half"] - M3_PILOT_D) / 2
    print(f"M3 pilot wall {wall:.3f} mm against the proposed {MIN_WALL} mm minimum")
    findings = [{"key": "m3_pilot_wall", "measured": wall, "threshold": MIN_WALL}] if round(wall, 6) < MIN_WALL else []
    check_findings("fits", findings)
