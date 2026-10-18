"""Full-turn sweep: the rotating group must not enter any fixed part except declared coaxial contacts."""
import collections
import math

from dispenser_sim.viz3d.mesh import transform_point
from dispenser_sim.viz3d.scene import build_concept_assembly

AXLE_XY = (0.0, 15.0)
STEP_DEG = 5
EPS = 0.05
# Coaxial parts: a body of revolution about the axle cannot collide with another one at any angle.
COAXIAL_OK = {("rotating-drum", "central-post"), ("rotating-drum", "electronics-deck"),
              ("rotating-drum", "station-housing")}


def _components(part):
    mesh = part.mesh
    parent = list(range(len(mesh.vertices)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for tri in mesh.triangles:
        for a, b in ((tri[0], tri[1]), (tri[1], tri[2])):
            parent[find(a)] = find(b)
    groups = collections.defaultdict(list)
    for i, vertex in enumerate(mesh.vertices):
        groups[find(i)].append(transform_point(vertex, part.world_transform))
    return [(tuple(min(p[k] for p in pts) for k in range(3)),
             tuple(max(p[k] for p in pts) for k in range(3))) for pts in groups.values()]


def _samples(part):
    mesh = part.mesh
    verts = [transform_point(v, part.world_transform) for v in mesh.vertices]
    samples = list(verts)
    for tri in mesh.triangles:
        a, b, c = (verts[i] for i in tri)
        samples.append(tuple((a[k] + b[k] + c[k]) / 3 for k in range(3)))
        samples.append(tuple((a[k] + b[k]) / 2 for k in range(3)))
    return samples


def test_rotating_group_sweeps_a_full_turn_without_entering_fixed_parts():
    parts = build_concept_assembly().parts
    rotating = {p.component_id: p for p in parts
                if p.group_id == "rotating-drum" or p.group_id.startswith("station-")}
    fixed = {p.component_id: _components(p) for p in parts if p.component_id not in rotating}
    samples = {key: _samples(part) for key, part in rotating.items()}
    hits = collections.defaultdict(set)
    for deg in range(0, 360, STEP_DEG):
        c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
        for key, points in samples.items():
            for x, y, z in points:
                dx, dy = x - AXLE_XY[0], y - AXLE_XY[1]
                px, py = AXLE_XY[0] + dx * c - dy * s, AXLE_XY[1] + dx * s + dy * c
                for fixed_id, boxes in fixed.items():
                    if any(lo[0] + EPS < px < hi[0] - EPS and lo[1] + EPS < py < hi[1] - EPS
                           and lo[2] + EPS < z < hi[2] - EPS for lo, hi in boxes):
                        hits[(key, fixed_id)].add(deg)
    unexpected = {pair: sorted(angles)[:5] for pair, angles in hits.items() if pair not in COAXIAL_OK}
    assert not unexpected, f"rotating parts enter fixed parts during a full turn: {unexpected}"
