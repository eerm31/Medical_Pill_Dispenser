"""Numeric sweep: every drum-frame viewer item through 360 deg against the fixed viewer items.

ASSUMED / NOT_VALIDATED geometry arithmetic. Findings go through check_findings (known-open allowlist);
the minimum-clearance table is printed (run with -s) and is part of the evidence.
"""
import math

import pytest

from feature005_spec import (EPS, G, _signed_dist_point_poly, check_findings, clearance, drum_items,
                             fixed_items, rect, sweep, Item, COAXIAL)

# Deck underside rests on the PTFE ring by design (contact, zero gap); asserted separately below.
CONTACT = COAXIAL | {(f"deck{k}", "thrust-ring") for k in range(4)}


@pytest.fixture(scope="module")
def swept():
    g = G()
    return sweep(drum_items(g), fixed_items(g), step_deg=1.0, extra_angles=(0.0,), skip=CONTACT)


def test_full_turn_sweep_has_no_unrecorded_interpenetration_or_clearance_below_eps(swept):
    findings = [{"key": f"{a}~{b}", "measured": c, "threshold": EPS, "detail": f"at {deg} deg"}
                for (a, b), (c, deg) in swept.items() if c < EPS]
    for (a, b), (c, deg) in sorted(swept.items(), key=lambda kv: kv[1][0])[:12]:
        print(f"min clearance {a} vs {b}: {c:.3f} mm at {deg} deg")
    check_findings("drum_sweep", findings)


def test_deck_to_platform_and_hall_gaps_and_ring_contact(swept):
    g = G()
    for k in range(4):
        assert abs(swept[(f"deck{k}", "platform")][0] - 0.30) <= 0.03, k
        assert abs(swept[(f"deck{k}", "hall")][0] - 0.30) <= 0.03, k
    assert g["hall_z1"] < g["hub_z0"]  # hall top 3.7 below the deck underside 4.0
    assert g["ring_z1"] == g["hub_z0"] and g["ring_z0"] == g["platform_top"]
    # the decks plus hub cover the whole thrust annulus (ring r 8.5..10) so the drum rides on the ring
    items = {i.name: i for i in drum_items(g)}
    ax, ay = g["axle"]
    for r in (g["ring_r_in"] + 0.01, (g["ring_r_in"] + g["ring_r_out"]) / 2, g["ring_r_out"] - 0.01):
        for deg in range(0, 360, 5):
            p = (ax + r * math.cos(math.radians(deg)), ay + r * math.sin(math.radians(deg)))
            covered = any(_signed_dist_point_poly(p, items[f"deck{k}"].shape[1]) <= 1e-6 for k in range(4))
            assert covered, (r, deg)


def test_boss_clips_hooks_and_rails_keep_their_clearances():
    g = G()
    items = {i.name: i for i in drum_items(g)}
    ax, ay = g["axle"]
    rails = [Item(f"rail{k}{s}", rect(*sorted((s * 5.4, s * 7.4)), -18.0, 6.2), 5.0, 6.0) for k in (0,) for s in (-1, 1)]
    boss = items["boss"]
    for rail in rails:
        assert clearance(boss, rail) >= EPS, ("boss vs rail", clearance(boss, rail))
    for name in ("clip0+", "clip0-", "hook0+", "hook0-"):
        assert clearance(boss, items[name]) >= EPS, name
    assert abs(clearance(items["tube0"], items["hook0+"]) - 0.2) <= 0.03  # clip-to-wall 0.2
    # boss stays on the deck: circle inside the deck polygon with at least EPS to the edge
    mx, my = g["magnet_xy"]
    assert -_signed_dist_point_poly((mx, my), items["deck0"].shape[1]) - g["boss_r"] >= EPS
    for sx in (-1, 1):
        for name in (f"clip0{'+' if sx > 0 else '-'}",):
            for x, y in items[name].shape[1]:
                assert _signed_dist_point_poly((x, y), items["deck0"].shape[1]) <= 0, (name, x, y)
    print("boss to rail", round(min(clearance(boss, r) for r in rails), 3),
          "boss to deck edge", round(-_signed_dist_point_poly((mx, my), items["deck0"].shape[1]) - g["boss_r"], 3))
