# Quickstart: Validate the rotation design work (Feature 005)

Validation guide only; no implementation code. All outcomes are logic/geometry checks — NOT VALIDATED hardware, no readiness or single-dose claim.

## Prerequisites
- Workspace `/Users/ice/Documents/smart-medical-dispenser`, `.venv` present.
- Baseline before any Feature 005 task: 226 tests passing (2026-10-15).
- After Python source changes install non-editable: `.venv/bin/pip install .` (macOS hidden-flag quirk; pytest uses `pythonpath=["src"]`).
- A real foreground browser for the browser checks (no Node here).

## 1. Existing evidence (runs today)
```bash
.venv/bin/pytest tests/unit/test_viz3d_rotation_sweep.py -q
```
Expected: passes — full 360° sweep (5° steps), only coaxial contacts. Covers canonical-JSON meshes only.

## 2. Component inventory unchanged (runs today)
```bash
.venv/bin/python -c "from dispenser_sim.viz3d.scene import build_concept_assembly as b; p=b().parts; print(len(p), len({x.component_id for x in p}))"
```
Expected: `52 52`, before and after the next step.

## 3. Feature 005 checks (run today, 2026-10-15)
1. Whole suite: `.venv/bin/pytest tests/ -q` — 300 passed (226 baseline + Feature 005 tests). Clearance and fit tests are green only because every finding is fixed or allowlisted (`OPEN_CONFLICTS` in `tests/feature005_spec.py`, C9 coupler conflict still OPEN); they print the numbers with `-s`.
2. Clearance and fits: `tests/test_feature005_clearance_*.py`, `tests/test_feature005_fits.py`, `tests/test_feature005_home_sensing_window.py`.
3. Reserved volumes and load check: `tests/test_feature005_reserved_volumes.py`, `tests/test_feature005_load_check.py` (125 g worst case, about 2.9 N·mm against about 11 N·mm).
4. Build documents: `tests/test_feature005_build_docs.py` (documents under `specs/005-first-subsystem-rotation-pin-gates/build/`).
5. Controller harness headless: `tests/test_feature005_rotation_controller.py` runs `tests/browser/feature005/` under the macOS `jsc` (`/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc`, skipped if missing); two runs are byte-identical. `tests/test_feature005_evidence_log.py` compares them with `evidence/rotation-check-log.json` (regenerate: `.venv/bin/python tests/test_feature005_evidence_log.py`).
6. Browser pages via `file://`: `tests/browser/index.html` (53 checks), `tests/browser/feature004/index.html` (14) and `tests/browser/feature005/index.html` (236 checks, "Download log" link).
7. Boundaries: `tests/test_feature005_boundaries.py`, `tests/test_feature005_controller_boundaries.py`, `tests/test_feature005_plan_consistency.py`; `docs/visualizer/demo-controller.js` must keep sha1 `0c8396023ca6fc85cb135fbbf58ea39e903cee11`.

## Expected outcomes and limits
- Pass in mode (a) proves ordering/interlock logic and geometry arithmetic only; `rotation-controller.js` is standalone and NOT wired into the viewer (deferred, needs user approval).
- The rod/coupler/hub rotating together in `docs/visualizer/index.html` is viewer geometry from the existing demo controller, not the new controller.
- Mode (b) criteria `ROT-R01..R06` stay "not validated — to be measured on a built rig".
- Physical work (measure, print, build, bench tests, real-device viewport/FPS evidence) is not done.
- Constitution I remains ERROR / BLOCKED; no feature-converged claim (see the verdict in `implementation-evidence.md`).
