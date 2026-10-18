"""Feature 005 load check (ASSUMED hand calculation, NOT_VALIDATED; mirrors plan.md "Load check")."""
import pytest

from feature005_spec import G

GRAVITY = 9.80665  # m/s^2
MASS_BUDGET_G = 150.0
RATED_N_MM = 34.0  # UNVERIFIED motor rating from the plan
LIMIT_N_MM = RATED_N_MM / 3.0
ACCEL_BOUND_N_MM_AT_125G = 0.5  # plan bound for 90 deg in 0.5 s, scaled linearly by mass
BEARING_N_MM = 0.1  # assumed


def load_check(mass_g, mu):
    """Torque demand in N*mm for a rotating mass (g) and thrust-ring friction coefficient."""
    g = G()
    mean_radius_mm = (g["ring_r_in"] + g["ring_r_out"]) / 2.0
    weight_n = mass_g / 1000.0 * GRAVITY
    friction = mu * weight_n * mean_radius_mm
    accel = ACCEL_BOUND_N_MM_AT_125G * mass_g / 125.0
    total = friction + accel + BEARING_N_MM
    return {"mean_radius_mm": mean_radius_mm, "friction": friction, "accel": accel,
            "bearing": BEARING_N_MM, "total": total, "mass_ok": mass_g <= MASS_BUDGET_G,
            "torque_ok": total <= LIMIT_N_MM}


def test_ring_mean_radius_is_9_25():
    assert load_check(73, 0.06)["mean_radius_mm"] == pytest.approx(9.25)


@pytest.mark.parametrize("mass_g", [73, 93, 125])
def test_friction_range_matches_plan(mass_g):
    lo, hi = load_check(mass_g, 0.06)["friction"], load_check(mass_g, 0.20)["friction"]
    if mass_g == 125:
        assert 0.65 <= lo <= 0.75 and 2.2 <= hi <= 2.35  # plan: 0.7-2.3 N*mm
    assert lo < hi


def test_worst_case_125g_total_matches_plan():
    r = load_check(125, 0.20)
    assert r["accel"] <= 0.5 and r["bearing"] == 0.1
    assert r["total"] <= 2.9 + 1e-9
    assert r["mass_ok"] and r["torque_ok"]
    assert r["total"] <= LIMIT_N_MM


@pytest.mark.parametrize("mass_g", [73, 93, 125, 150])
@pytest.mark.parametrize("mu", [0.06, 0.10, 0.20])
def test_within_mass_budget_and_one_third_rating(mass_g, mu):
    r = load_check(mass_g, mu)
    assert mass_g <= MASS_BUDGET_G and r["mass_ok"]
    assert r["total"] <= LIMIT_N_MM
    assert LIMIT_N_MM == pytest.approx(34.0 / 3.0)


def test_150g_edge_case_still_inside_limit():
    r = load_check(150, 0.20)
    assert r["mass_ok"] and r["torque_ok"]
    assert r["total"] < 4.0


def test_over_budget_is_flagged():
    assert load_check(151, 0.2)["mass_ok"] is False
