"""Shared helpers for the Feature 005 rotation checks (ASSUMED / NOT_VALIDATED, stdlib only).

Loads docs/visualizer/rotation-spec.js, rebuilds the viewer-only rotation geometry as simple
prisms, and provides overlap / clearance primitives, a known-open findings allowlist and the
ROT-C05 record writer. Nothing here validates a design; it reports numbers.
"""
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
VIEWER = REPO / "docs" / "visualizer"
SPEC_JS = VIEWER / "rotation-spec.js"
EVIDENCE = REPO / "specs" / "005-first-subsystem-rotation-pin-gates" / "evidence"
AXLE = (0.0, 15.0)
EPS = 0.05  # proposed overlap tolerance, mm


def load_spec():
    text = SPEC_JS.read_text(encoding="utf-8")
    body = re.sub(r"^window\.DispenserRotationSpec\s*=\s*", "", text.strip()).rstrip(";")
    return json.loads(body)


def G():
    return load_spec()["g"]


# ---------------------------------------------------------------- 2D shapes
# ("poly", [(x, y), ...]) is convex; ("circle", cx, cy, r)

def rect(x0, x1, y0, y1):
    return ("poly", [(x0, y0), (x1, y0), (x1, y1), (x0, y1)])


def poly(points):
    return ("poly", [tuple(p) for p in points])


def circle(cx, cy, r):
    return ("circle", cx, cy, r)


def rotate_point(p, deg, about=AXLE):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    dx, dy = p[0] - about[0], p[1] - about[1]
    return (about[0] + dx * c - dy * s, about[1] + dx * s + dy * c)


def rotate_shape(shape, deg, about=AXLE):
    if shape[0] == "circle":
        cx, cy = rotate_point((shape[1], shape[2]), deg, about)
        return ("circle", cx, cy, shape[3])
    return ("poly", [rotate_point(p, deg, about) for p in shape[1]])


def _seg_dist(p, a, b):
    ax, ay, bx, by = a[0], a[1], b[0], b[1]
    dx, dy = bx - ax, by - ay
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy))


def _edges(pts):
    return [(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]


def _inside_convex(p, pts):
    signs = []
    for a, b in _edges(pts):
        cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        if abs(cross) > 1e-12:
            signs.append(cross > 0)
    return all(signs) or not any(signs)


def _signed_dist_point_poly(p, pts):
    d = min(_seg_dist(p, a, b) for a, b in _edges(pts))
    return -d if _inside_convex(p, pts) else d


def separation2d(a, b):
    """Positive: gap between the shapes; negative: approximate penetration depth."""
    if a[0] == "circle" and b[0] == "circle":
        return math.hypot(a[1] - b[1], a[2] - b[2]) - a[3] - b[3]
    if a[0] == "circle":
        return _signed_dist_point_poly((a[1], a[2]), b[1]) - a[3]
    if b[0] == "circle":
        return _signed_dist_point_poly((b[1], b[2]), a[1]) - b[3]
    best = -math.inf
    for pts in (a[1], b[1]):
        for p, q in _edges(pts):
            nx, ny = q[1] - p[1], -(q[0] - p[0])
            n = math.hypot(nx, ny)
            nx, ny = nx / n, ny / n
            pa = [nx * v[0] + ny * v[1] for v in a[1]]
            pb = [nx * v[0] + ny * v[1] for v in b[1]]
            best = max(best, max(min(pb) - max(pa), min(pa) - max(pb)))
    if best < 0:
        return best
    return min([_seg_dist(v, *e) for v in a[1] for e in _edges(b[1])] +
               [_seg_dist(v, *e) for v in b[1] for e in _edges(a[1])])


@dataclass(frozen=True)
class Item:
    name: str
    shape: tuple
    z0: float
    z1: float
    symmetric: bool = False  # body of revolution about the axle: one angle is enough


def clearance(a, b):
    """Signed 3D clearance in mm: negative = interpenetration depth, positive = gap."""
    dz = max(a.z0 - b.z1, b.z0 - a.z1)
    dxy = separation2d(a.shape, b.shape)
    if dz < 0 and dxy < 0:
        return -min(-dz, -dxy)
    return math.hypot(max(dz, 0.0), max(dxy, 0.0))


def socket_point(k, x, y):
    """Socket-frame (x, y) of deck k to canonical, deck 0 at (0, 0), decks every 90 deg CCW."""
    return rotate_point((x, y), 90.0 * k)


def deck_shape(g):
    ay, n = g["axle"][1], 24
    arc = lambda r, a0, a1: [(r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), ay + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
    hu = g["hub_r"] / math.sqrt(2)  # the hub chord replaces the hub arc, as before (the hub covers it)
    return [(-hu, ay - hu), (hu, ay - hu)] + arc(g["deck_r"], -45, -135)  # one quarter of the round deck


def drum_items(g=None, include_cartridge=True):
    """Rotating (drum-frame) items at the home angle 0. Hub chord region replaces the hub arc (hub covers it)."""
    g = g or G()
    ax, ay = g["axle"]
    items = [
        Item("hub", circle(ax, ay, g["hub_r"]), g["hub_z0"], g["hub_z1"], True),
        Item("rod", circle(ax, ay, g["rod_r"]), g["rod_z0"], g["rod_z1"], True),
        Item("coupler", circle(ax, ay, g["coupler_r"]), g["coupler_z0"], g["coupler_z1"], True),
    ]
    z_deck = (g["hub_z0"], g["hub_z0"] + g["deck_t"])
    for k in range(4):
        items.append(Item(f"deck{k}", poly([rotate_point(p, 90.0 * k) for p in deck_shape(g)]), *z_deck))
        for sx in (-1, 1):
            def box(xa, xb, ya, yb, za, zb, name):
                lo, hi = sorted((sx * xa, sx * xb))
                pts = [socket_point(k, x, y) for x, y in ((lo, ya), (hi, ya), (hi, yb), (lo, yb))]
                items.append(Item(f"{name}{k}{'+' if sx > 0 else '-'}", poly(pts), za, zb))
            box(g["clip_x0"], g["clip_x1"], -g["clip_half_y"], g["clip_half_y"], z_deck[1], g["clip_z1"], "clip")
            box(g["hook_x0"], g["clip_x0"], -g["clip_half_y"], g["clip_half_y"], g["hook_z0"], g["hook_z1"], "hook")
            if include_cartridge:
                box(g["tube_half_x"], g["ledge_x1"], -g["clip_half_y"], g["clip_half_y"], g["ledge_z0"], g["ledge_z1"], "ledge")
        if include_cartridge:
            pts = [socket_point(k, x, y) for x, y in ((-7.4, -6.2), (7.4, -6.2), (7.4, 6.2), (-7.4, 6.2))]
            items.append(Item(f"tube{k}", poly(pts), 6.0, 46.0))
    mx, my = g["magnet_xy"]
    items.append(Item("boss", circle(mx, my, g["boss_r"]), z_deck[1], g["boss_z1"]))
    items.append(Item("magnet", circle(mx, my, g["magnet_r"]), g["magnet_z0"], g["magnet_z1"]))
    return items


def fixed_items(g=None):
    """Fixed viewer-only items that can meet the rotating drum (platform, hall, mount, motor)."""
    g = g or G()
    ax, ay = g["axle"]
    my = ay + g["motor_offset_y"]
    items = [
        Item("platform", circle(ax, ay, g["platform_r"]), -3.0, g["platform_top"]),
        Item("hall", rect(g["hall_x"][0], g["hall_x"][1], g["hall_y"][0], g["hall_y"][1]), g["hall_z0"], g["hall_z1"]),
        Item("thrust-ring", circle(ax, ay, g["ring_r_out"]), g["ring_z0"], g["ring_z1"]),
        Item("bearing", circle(ax, ay, g["bearing_r_out"]), g["bearing_z0"], g["bearing_z1"]),
        Item("plate", rect(-g["plate_x"], g["plate_x"], g["plate_y0"], g["plate_y1"]), g["plate_z0"], g["plate_z1"]),
        Item("motor-body", circle(0.0, my, g["motor_body_r"]), g["motor_body_z0"], g["motor_body_z1"]),
        Item("motor-shaft", circle(ax, ay, g["motor_shaft_r"]), g["motor_shaft_z0"], g["motor_shaft_z1"]),
    ]
    for sx in (-1, 1):
        x = sx * g["column_x"]
        h = g["column_half"]
        items.append(Item(f"column{'+' if sx > 0 else '-'}", rect(x - h, x + h, my - h, my + h), g["column_z0"], g["column_z1"]))
        items.append(Item(f"m3-head{'+' if sx > 0 else '-'}", circle(x, my, g["m3_head_r"]), g["m3_head_z0"], g["m3_z0"]))
        items.append(Item(f"m3-shank{'+' if sx > 0 else '-'}", circle(x, my, g["m3_r"]), g["m3_z0"], g["m3_z1"]))
    return items


# Intended coaxial or deliberate contacts between a drum item and a fixed item (never reported as findings).
COAXIAL = {("rod", "bearing"), ("rod", "thrust-ring"), ("rod", "platform"), ("rod", "motor-shaft"),
           ("coupler", "motor-shaft"), ("hub", "thrust-ring"), ("hub", "bearing")}


def sweep(drums, fixeds, step_deg=1.0, extra_angles=(), skip=COAXIAL, near=6.0):
    """Minimum signed clearance per (drum item, fixed item) pair over a full turn."""
    angles = sorted({round(i * step_deg, 6) for i in range(int(round(360 / step_deg)))} | set(extra_angles))
    best = {}
    for deg in angles:
        for d in drums:
            if d.symmetric and deg != 0:
                continue
            moved = d if d.symmetric else Item(d.name, rotate_shape(d.shape, deg), d.z0, d.z1)
            for f in fixeds:
                if (d.name, f.name) in skip or max(moved.z0 - f.z1, f.z0 - moved.z1) > near:
                    continue
                c = clearance(moved, f)
                key = (d.name, f.name)
                if key not in best or c < best[key][0]:
                    best[key] = (c, deg)
    return best


# ---------------------------------------------------------------- known-open allowlist
# One entry per recorded, still-open conflict; "items" maps a finding key to the measured range it may stay in.
OPEN_CONFLICTS = {
    "C4": {"check": "housing_wall", "threshold": 0.8, "items": {"seat_wall_tongue_pocket": (0.7, 0.8)},
           "decision": "OPEN: 625ZZ seat wall to the tongue pocket; 685ZZ fallback or reinforce (plan D2, R2)",
           "plan": "plan.md C4"},
    "C1": {"check": "static_stack", "threshold": EPS,
           "items": {"thrust-ring~central-post#0": (-4.05, -3.95), "bearing~central-post#0": (-3.75, -3.65)},
           "decision": "KNOWN-OPEN: viewer replaces the canonical fixed central-post (r 2.5) with the rotating D-flat rod; "
                       "ring and bearing are modelled as solid discs about it (plan C1, proposed resolution, ASSUMED)",
           "plan": "plan.md C1"},
    "C10": {"check": "housing_wall", "threshold": 0.8, "items": {"hall_pocket_wall": (0.70, 0.72)},
            "decision": "OPEN: hall pocket corner (x 7.7, z 0.7) is 0.71 mm from the tongue-pocket void corner (x 7.25, z 0.15); "
                        "options: hall x start +0.2, hall z0 +0.2, or widen the tongue-pocket wall (owner: viewer spec)",
            "plan": "plan.md C10"},
    "C9": {"check": "canonical_sweep", "threshold": EPS,
           "items": {"coupler~outlet-tray#0": (-0.001, 0.001)},
           "decision": "KNOWN-OPEN: canonical tray unchanged; viewer tray notched. The O14 x 22 coupler (axis x 0, y 15, z -26..-4) "
                       "touches the unchanged canonical outlet tray (y max 8.0) at 0.0 mm; the viewer tray and chute wall are clear "
                       "(back wall and floor notched at |x| <= 5.2, resolved 2026-10-15); the canonical tray is not edited here",
           "plan": "plan.md C9"},
    "R14": {"check": "fits", "threshold": 0.8, "items": {"m3_pilot_wall": (0.65, 0.75)},
            "decision": "OPEN: 4 x 4 column with a 2.6 mm M3 pilot leaves about 0.7 mm; coupon C-4/C-5 decides",
            "plan": "plan.md R14"},
}


def _checks(entry):
    return (entry["check"],) if isinstance(entry["check"], str) else tuple(entry["check"])


def _applies(entry, check_name, key):
    # "scope" pins an item to one check when the entry spans several checks.
    return check_name in _checks(entry) and key in entry["items"] and entry.get("scope", {}).get(key, check_name) == check_name


def check_findings(check_name, findings):
    """findings: list of dicts {key, measured, threshold, detail}. Fails on any new or out-of-range finding."""
    problems = []
    hit = set()
    for f in findings:
        entry = next((cid for cid, e in OPEN_CONFLICTS.items() if _applies(e, check_name, f["key"])), None)
        if entry is None:
            problems.append(f"NEW finding {check_name}/{f['key']}: {f['measured']:.3f} vs {f['threshold']} ({f.get('detail', '')})")
            continue
        lo, hi = OPEN_CONFLICTS[entry]["items"][f["key"]]
        if lo - 1e-9 <= f["measured"] <= hi + 1e-9:
            hit.add((entry, f["key"]))
            print(f"KNOWN-OPEN {entry} {check_name}/{f['key']}: {f['measured']:.3f} vs {f['threshold']}")
        else:
            problems.append(f"KNOWN-OPEN {entry} {f['key']} moved outside {lo}..{hi}: {f['measured']:.3f}")
    for cid, e in OPEN_CONFLICTS.items():
        for key in e["items"]:
            if _applies(e, check_name, key) and (cid, key) not in hit:
                print(f"STALE allowlist entry {cid} ({check_name}/{key}): not measured as a finding this run")
    assert not problems, "; ".join(problems)


# ---------------------------------------------------------------- ROT-C05 records
_ROT_C05 = {}
ROT_C05_FILE = EVIDENCE / "rot-c05-results.json"


def record_rot_c05(step, observed, threshold, verdict):
    _ROT_C05[step] = {"criterion_id": "ROT-C05", "step": step, "observed": round(float(observed), 4),
                      "threshold": threshold, "threshold_label": "proposed", "verdict": verdict}
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    rows = [_ROT_C05[k] for k in sorted(_ROT_C05)]
    ROT_C05_FILE.write_text(json.dumps({"criterion_id": "ROT-C05", "mode": "a", "print_ready": False,
                                        "fabricable_as_designed": False,
                                        "disclosure": "NOT VALIDATED / NOT PRINT-READY; geometry arithmetic only",
                                        "results": rows}, indent=2, sort_keys=True) + "\n", encoding="utf-8")


# ---------------------------------------------------------------- viewer-drawn housing and hidden list
def viewer_housing_boxes():
    """Housing deck as drawn in the viewer: each layer's disc bounding square tiled around its rectangular holes
    (x0, x1, y0, y1, z0, z1); the layers live in rotation-spec.js."""
    g = G()
    r = g["platform_r"]
    boxes = []
    for layer in g["deck_layers"]:
        holes = layer["holes"]
        xs = sorted({-r, r} | {v for h in holes for v in h[:2]})
        ys = sorted({-r, r} | {v for h in holes for v in h[2:]})
        for i in range(len(xs) - 1):
            for j in range(len(ys) - 1):
                mx, my = (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2
                if any(h[0] < mx < h[1] and h[2] < my < h[3] for h in holes):
                    continue
                boxes.append((xs[i], xs[i + 1], ys[j], ys[j + 1], layer["z0"], layer["z1"]))
    return boxes


def hidden_submeshes():
    text = (VIEWER / "reference-look.js").read_text(encoding="utf-8")
    m = re.search(r"var hideSubmeshes = \[(.*?)\];", text, re.S)
    return re.findall(r"'([^']+)'", m.group(1))


def solid_cells(boxes):
    """Coordinate-compressed cells of a union of axis-aligned boxes: (cell box, is_solid)."""
    axes = []
    for axis in range(3):
        cuts = {b[2 * axis] for b in boxes} | {b[2 * axis + 1] for b in boxes}
        cuts |= {min(cuts) - 200.0, max(cuts) + 200.0}
        axes.append(sorted(cuts))
    cells = []
    for i in range(len(axes[0]) - 1):
        for j in range(len(axes[1]) - 1):
            for k in range(len(axes[2]) - 1):
                c = ((axes[0][i], axes[0][i + 1]), (axes[1][j], axes[1][j + 1]), (axes[2][k], axes[2][k + 1]))
                mid = [(c[a][0] + c[a][1]) / 2 for a in range(3)]
                solid = any(b[0] < mid[0] < b[1] and b[2] < mid[1] < b[3] and b[4] < mid[2] < b[5] for b in boxes)
                cells.append((c, solid))
    return cells


def _interval_gap(lo, hi, c0, c1):
    return max(c0 - hi, lo - c1, 0.0)


def distance_box_to_void(box, cells):
    """Exact Euclidean distance from an axis-aligned box (x0,x1,y0,y1,z0,z1) to the nearest void cell."""
    best = math.inf
    for c, solid in cells:
        if solid:
            continue
        d = math.sqrt(sum(_interval_gap(box[2 * a], box[2 * a + 1], c[a][0], c[a][1]) ** 2 for a in range(3)))
        best = min(best, d)
    return best


def distance_cylinder_to_void(cx, cy, r, z0, z1, cells):
    """Exact distance from the side wall of a vertical cylinder to the nearest void cell."""
    best = math.inf
    for c, solid in cells:
        if solid:
            continue
        gz = _interval_gap(z0, z1, c[2][0], c[2][1])
        px = min(max(cx, c[0][0]), c[0][1])
        py = min(max(cy, c[1][0]), c[1][1])
        gxy = max(math.hypot(px - cx, py - cy) - r, 0.0)
        best = min(best, math.hypot(gz, gxy))
    return best


# ---------------------------------------------------------------- canonical fixed parts (read-only)
def _components(mesh):
    parent = list(range(len(mesh.vertices)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for tri in mesh.triangles:
        for corner in tri[1:]:
            parent[find(tri[0])] = find(corner)
    groups = {}
    for i in range(len(mesh.vertices)):
        groups.setdefault(find(i), []).append(i)
    return list(groups.values())


def canonical_fixed_boxes():
    """(component_id, index, lo, hi, group) for every canonical FIXED part, hidden submeshes removed.

    Returns (boxes, excluded) where excluded maps component_id to the hidden submesh ids dropped,
    because the viewer does not draw them (reference-look.js hideSubmeshes).
    """
    from dispenser_sim.viz3d.mesh import mesh_from_recipe, transform_point
    from dispenser_sim.viz3d.scene import build_concept_assembly

    hidden = set(hidden_submeshes())
    boxes, excluded = [], {}
    for part in build_concept_assembly().parts:
        if part.group_id == "rotating-drum" or part.group_id.startswith("station-"):
            continue
        recipe = part.recipe
        feats = recipe.get("integrated_submeshes", ())
        mesh = part.mesh
        if feats:
            kept = [f for f in feats if f["submesh_id"] not in hidden]
            dropped = [f["submesh_id"] for f in feats if f["submesh_id"] in hidden]
            if dropped:
                excluded[part.component_id] = dropped
                mesh = mesh_from_recipe(dict(recipe, integrated_submeshes=kept))
        world = [transform_point(v, part.world_transform) for v in mesh.vertices]
        for index, comp in enumerate(_components(mesh)):
            pts = [world[i] for i in comp]
            lo = tuple(min(p[k] for p in pts) for k in range(3))
            hi = tuple(max(p[k] for p in pts) for k in range(3))
            boxes.append((part.component_id, index, lo, hi, part.group_id))
    return boxes, excluded


def box_item(lo, hi, name):
    return Item(name, rect(lo[0], hi[0], lo[1], hi[1]), lo[2], hi[2])


def viewer_tray_boxes():
    """Chute walls under the deck hole as drawn in the viewer: (x0, x1, y0, y1, z0, z1); they live in rotation-spec.js."""
    c = G()["chute"]
    t = c["t"]
    return [(c["x"][0] - t, c["x"][1] + t, c["y"][0] - t, c["y"][1] + t, c["z0"], c["z1"])]
