"""Boundary lock for Feature 005: protected files are intentionally read-only (hash lock) and the
component inventory stays at exactly 52 unique IDs. ASSUMED / NOT_VALIDATED; no design claim.
"""
import hashlib
import json

from feature005_spec import EVIDENCE, REPO

MANIFEST = EVIDENCE / "protected-hashes.json"
LOCKED = ("docs/visualizer/demo-controller.js", "docs/visualizer/concept-data.js",
          "src/dispenser_sim/viz3d/concept_geometry.json")


def _sha(rel):
    return hashlib.sha256((REPO / rel).read_bytes()).hexdigest()


def test_protected_files_match_the_recorded_hashes():
    # Intentional "do not edit" lock; re-baselining needs a separately approved change (Phase 7 W04).
    recorded = json.loads(MANIFEST.read_text(encoding="utf-8"))["files"]
    for rel in LOCKED:
        assert _sha(rel) == recorded[rel], f"{rel} changed; Feature 005 must not edit it"


def test_component_inventory_is_exactly_52_unique_ids():
    from dispenser_sim.viz3d.scene import build_concept_assembly
    parts = build_concept_assembly().parts
    ids = [p.component_id for p in parts]
    assert len(parts) == 52 and len(set(ids)) == 52
