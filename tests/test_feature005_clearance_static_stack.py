"""Static overlap of the viewer-only parts below and in the platform against fixed parts.

Coupler (O19, z -29..-4), rod, 28BYJ-48 body, mount plate, columns, M3 screws, bearing, ring and hall pocket.
Part A uses the canonical fixed parts (hidden submeshes excluded, listed); part B uses the pill tray and
tongue-pocket walls as the viewer draws them (parsed from reference-look.js), because the viewer hides the
canonical meshes. ASSUMED / NOT_VALIDATED; findings are reported through check_findings.
"""
from feature005_spec import (EPS, G, Item, box_item, canonical_fixed_boxes, check_findings, clearance, drum_items,
                             fixed_items, hidden_submeshes, rect, viewer_housing_boxes, viewer_tray_boxes)

# Deliberate contacts or embeddings: bearing/hall/ring sit in or on the platform, columns end on its underside,
# the motor shaft is coaxial with the post, the motor sits on the plate.
EMBEDDED = {
    ("bearing", "station-housing"), ("thrust-ring", "station-housing"), ("hall", "station-housing"),
    ("platform", "station-housing"), ("motor-shaft", "central-post"), ("motor-shaft", "station-housing"),
    ("column+", "station-housing"), ("column-", "station-housing"),
}


def _axle_items(g):
    return [d for d in drum_items(g) if d.name in {"rod", "coupler"}]


def test_viewer_parts_do_not_overlap_canonical_fixed_parts():
    g = G()
    boxes, excluded = canonical_fixed_boxes()
    for component, subs in sorted(excluded.items()):
        print(f"excluded from the static stack check ({component}): {subs} - hidden by the viewer")
    assert set(s for subs in excluded.values() for s in subs) <= set(hidden_submeshes())
    parts = [i for i in fixed_items(g) if i.name not in {"platform"}]
    findings, table = [], []
    for part in parts:
        for cid, index, lo, hi, _ in boxes:
            if (part.name, cid) in EMBEDDED:
                continue
            c = clearance(part, box_item(lo, hi, cid))
            table.append((c, part.name, f"{cid}#{index}"))
            if c < EPS:
                findings.append({"key": f"{part.name}~{cid}#{index}", "measured": c, "threshold": EPS})
    for c, a, b in sorted(table)[:8]:
        print(f"static min clearance {a} vs {b}: {c:.3f} mm")
    check_findings("static_stack", findings)


def test_axle_and_mount_parts_clear_the_viewer_drawn_tray_and_pocket_walls():
    g = G()
    tray = [Item(f"tray{i}", rect(b[0], b[1], b[2], b[3]), b[4], b[5]) for i, b in enumerate(viewer_tray_boxes())]
    walls = []  # the round deck has no hanging pocket walls any more
    parts = _axle_items(g) + [i for i in fixed_items(g) if i.name in {"plate", "motor-body", "motor-shaft"}
                              or i.name.startswith(("column", "m3"))]
    findings = []
    for part in parts:
        for other in tray + walls:
            c = clearance(part, other)
            if c < EPS:
                findings.append({"key": f"{part.name}~viewer-{other.name}", "measured": c, "threshold": EPS})
    check_findings("static_stack_viewer", findings)
