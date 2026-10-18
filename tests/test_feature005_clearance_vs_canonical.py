"""Sweep the viewer decks, clips, ledges, boss and axle through 360 deg against every canonical FIXED part.

ASSUMED / NOT_VALIDATED. Closes the plan's ROT-C05 / C5 "reach" check as numbers (decks reach 34.5 on the
socket axis, about 36.5 at a corner). Canonical submeshes the viewer does not draw are excluded and listed.
"""
import collections

import pytest

from feature005_spec import (EPS, G, box_item, canonical_fixed_boxes, check_findings, drum_items, hidden_submeshes,
                             record_rot_c05, sweep)

# central-post is coaxial with hub/rod/coupler; the rod alone passes through the platform bore (bore not modelled)
COAXIAL_COMPONENTS = {"hub": {"central-post"}, "coupler": {"central-post"}, "rod": {"central-post", "station-housing"}}


@pytest.fixture(scope="module")
def result():
    g = G()
    boxes, excluded = canonical_fixed_boxes()
    fixeds = [box_item(lo, hi, f"{cid}#{i}") for cid, i, lo, hi, _ in boxes]
    drums = [d for d in drum_items(g) if not d.name.startswith("tube")]
    skip = set()
    for d in drums:
        for comp in COAXIAL_COMPONENTS.get(d.name, ()):
            skip |= {(d.name, f.name) for f in fixeds if f.name.split("#")[0] == comp}
    best = sweep(drums, fixeds, step_deg=1.0, extra_angles=(0.0,), skip=skip, near=4.0)
    return best, excluded


def _family(name):
    return name.rstrip("0123456789+-")


def test_excluded_canonical_submeshes_are_the_hidden_ones(result):
    _, excluded = result
    dropped = {s for subs in excluded.values() for s in subs}
    assert dropped <= set(hidden_submeshes()) and dropped
    for component, subs in sorted(excluded.items()):
        print(f"excluded from the canonical sweep ({component}): {subs} - hidden by the viewer")


def test_viewer_decks_clips_boss_and_axle_sweep_clear_of_canonical_fixed_parts(result):
    best, _ = result
    findings = [{"key": f"{a}~{b}", "measured": c, "threshold": EPS, "detail": f"at {deg} deg"}
                for (a, b), (c, deg) in best.items() if c < EPS]
    per_family = collections.defaultdict(lambda: (float("inf"), ""))
    for (a, b), (c, deg) in best.items():
        fam = _family(a)
        if c < per_family[fam][0]:
            per_family[fam] = (c, f"{b} at {deg} deg")
    g = G()
    reach = g["deck_r"]
    for fam in sorted(per_family):
        c, where = per_family[fam]
        ok = c >= EPS
        print(f"ROT-C05 {fam}: min clearance {c:.3f} mm ({where})")
        record_rot_c05(f"canonical-sweep:{fam}", c, EPS, "pass" if ok else "fail")
    assert reach == 35.5  # the round deck reaches 35.5 mm from the axle in every direction
    check_findings("canonical_sweep", findings)
