---

description: "Task list for Feature 005 - first subsystem: rotation (printable/buildable design, then controller and interlocks)"
---

# Tasks: First Subsystem — Rotation (Feature 005)

**Input**: Design documents from `/specs/005-first-subsystem-rotation-pin-gates/`

**Prerequisites**: plan.md (updated 2026-10-15), spec.md, research.md, data-model.md, contracts/rotation-check-log.md, quickstart.md, checklists/requirements.md, `.github/copilot-instructions.md`, `.specify/memory/constitution.md`

**Posture (applies to every task)**: everything is **ASSUMED / NOT_VALIDATED**. No task may state or imply physical validation, print-readiness, fabricability, single-dose integrity or medication/dose safety. `print_ready=false` and `fabricable_as_designed=false` stay. Constitution I stays ERROR / BLOCKED; no feature-converged claim. Mode (b) criteria (`ROT-R01..R06`) are never reported as passed.

**Tests**: requested. The plan (D8) requires the sweep/clearance checks, the 16-move index harness and the refusal/fault cases, and the spec requires a deterministic, diffable log (FR-003, SC-010). Test tasks come before the implementation they cover and must fail first.

**Organization**: Phase 3 and Phase 4 both serve User Story 1 (the only story this plan designs). User Stories 2 (pin) and 3 (gates/dispense) are deliberately not tasked here (see "Deferred").

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[US1]**: User Story 1, Successful Rotation (spec.md; FR-005..FR-010, SC-001..SC-003)
- Every task names its file path(s). Paths are relative to `/Users/ice/Documents/smart-medical-dispenser`.

## Hard constraints (apply to every task)

- **`[NEEDS-USER-APPROVAL]` rule**: the spec (FR-002, Out of Scope) and plan (D7, Source code touched, Readiness 9) list `docs/visualizer/demo-controller.js` as OUT of scope, so NO executable task in Phases 1-6 edits it, and no task here carries the tag. The work that WOULD touch it (and `app.js` / `index.html` wiring) is recorded only as non-executable register rows W01-W04 in the last section, Phase 7, each flagged `[NEEDS-USER-APPROVAL]`; implement everything else without touching it. Read-only use (hash lock T002/T005, the shape-check adapter case in T033) is allowed.
- `docs/visualizer/demo-controller.js` MUST NOT be edited, and is NOT verified by this feature. Mode (a) is the standalone logic in a NEW file `docs/visualizer/rotation-controller.js`, tested headlessly; wiring into the viewer is DEFERRED. This is a deliberate, user-approved spec change dated 2026-10-15 (spec FR-001/FR-002, plan D7/R-8, research R-8; T027 verifies the wording).
- New files in `docs/visualizer/` must not contain the string "feature004" in any case (`tests/test_feature003_scanner_visibility.py` globs `docs/visualizer/*.js` and forbids it).
- Do not modify Features 001-004 or 006 files, the scanner FSM, or any file under `specs/001-*`, `specs/002-*`, `specs/003-*`, `specs/004-*`, `specs/006-*`. Feature 005 spec/plan/data-model/research/quickstart/contracts/checklists may be edited.
- Do not edit `src/dispenser_sim/viz3d/concept_geometry.json`, `docs/visualizer/concept-data.js`, `tools/build_visualizer_data.py` or the 3MF export. Keep exactly 52 component IDs. (T005 enforces this.)
- No git branch changes (the actual branch is the unborn `001-dispensing-mechanism-simulation`). No network, no installs outside `.venv`, nothing read or written outside the workspace (no `/tmp` files; use workspace paths only).
- No randomness, no timestamps in any log or controller output.
- After Python source changes (none planned) install non-editable: `.venv/bin/pip install .`.

## Path Conventions

- Viewer assets: `docs/visualizer/` (ES5-style IIFE, no build step, loads from `file://`)
- Python tests: `tests/` (top level for Feature 005, like `tests/test_feature005_rotation_spec.py`); JS harness: `tests/browser/feature005/`
- Builder-facing documents: `specs/005-first-subsystem-rotation-pin-gates/build/`
- Evidence: `specs/005-first-subsystem-rotation-pin-gates/implementation-evidence.md`

---

## Phase 1: Setup (shared baseline)

**Purpose**: record the starting point so every later claim of "unchanged" is checkable.

- [X] T001 Run `.venv/bin/pytest tests/ -q`, record the pass count (expected 226) and the date, and create `specs/005-first-subsystem-rotation-pin-gates/implementation-evidence.md` with the sections: Posture/disclosure, Baseline, Protected-file hashes, Clearance results, Build-document status, Controller harness results, Browser results, Deviations, DONE vs DEFERRED ledger
- [X] T002 Record SHA-256 of the protected files in `specs/005-first-subsystem-rotation-pin-gates/implementation-evidence.md` (Protected-file hashes) and in the machine-readable manifest `specs/005-first-subsystem-rotation-pin-gates/evidence/protected-hashes.json` (sorted keys, no timestamps; this manifest is what T005 and T061 read): `docs/visualizer/demo-controller.js`, `docs/visualizer/concept-data.js`, `src/dispenser_sim/viz3d/concept_geometry.json`, `tools/build_visualizer_data.py`, every file under `src/dispenser_sim/viz3d/`, and a manifest hash per directory `specs/001-*`, `specs/002-*`, `specs/003-*`, `specs/004-*`, `specs/006-*` (SHA-256 over the sorted `relative-path:file-sha256` lines; read-only; depends on T001)
- [X] T003 [P] Probe the headless JS option: run `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc` on a trivial script and on `docs/visualizer/rotation-spec.js`; record the result as decision R-10 in `specs/005-first-subsystem-rotation-pin-gates/research.md` (jsc is a macOS system tool, installs nothing; pytest must SKIP with an explicit reason, never silently pass, if it is missing; the browser harness remains the second runner)

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: guards, shared helpers and a consistent set of numbers, before any new coverage or documents are written.

**CRITICAL**: no Phase 3 or Phase 4 task starts before this phase is green.

- [X] T004 [P] Create `tests/feature005_spec.py`: shared helper that loads `docs/visualizer/rotation-spec.js` (same parse as `tests/test_feature005_rotation_spec.py`), rotates points about the axle (0, 15), builds the deck polygon from `g` (24 mm wide, straight edge y −19.5..3.0, 45° mitres meeting at the axle, inner end on the hub circle, one per 90°), and provides box / polygon / circle overlap and minimum-distance primitives (stdlib only); also provides (1) the known-open allowlist: an `OPEN_CONFLICTS` table (conflict ID, check name, threshold, expected measured range, decision text, plan reference; seeded with the already-recorded C4 and R14) and `check_findings(check_name, findings)` which passes allowlisted findings that stay inside their recorded range (printing them as `KNOWN-OPEN <ID>`) and fails on any NEW finding or an allowlisted finding outside its range (stale entries are only reported, never failed); (2) `record_rot_c05(step, observed, threshold, verdict)` which collects ROT-C05 `CriterionResult` records and writes them in fixed order to `specs/005-first-subsystem-rotation-pin-gates/evidence/rot-c05-results.json` (no timestamps)
- [X] T005 [P] Create `tests/test_feature005_boundaries.py`: asserts the SHA-256 of `docs/visualizer/demo-controller.js`, `docs/visualizer/concept-data.js` and `src/dispenser_sim/viz3d/concept_geometry.json` equal the values read from the manifest `specs/005-first-subsystem-rotation-pin-gates/evidence/protected-hashes.json` created in T002 (comment: intentional "do not edit" lock), and that `build_concept_assembly()` has exactly 52 parts with 52 unique component IDs (depends on T002)
- [X] T006 [P] Create `tests/test_feature005_plan_consistency.py` (written first; fails until T007/T008): a deny-list of stale phrases that must not appear outside "Superseded" / "Original note" text in `specs/005-first-subsystem-rotation-pin-gates/{plan,data-model,research,quickstart}.md` (hall pocket "x 5..9" / "−20.3..−17.3", "Ø6 × 1.0 mm boss", "boss Ø / height ... 6.0", "≈ 4 × 3 × 1.6", "224 tests", "4.6 mm clear"; the "six coupons" check is NOT here because it only becomes true after T023, see T017/T023), plus presence checks for the posture strings `ASSUMED / NOT_VALIDATED`, `print_ready=false`, `fabricable_as_designed=false`
- [X] T007 Reconcile stale numbers in `specs/005-first-subsystem-rotation-pin-gates/plan.md` against `docs/visualizer/rotation-spec.js`: A0 coupon C-3 (boss Ø6 → Ø4.4), A1(b) hall pocket (x 5..9, y −20.3..−17.3, → x 7.7..11.7, y −17.5..−14.5), A2 table (boss 6.0 / 1.0 → 4.4 / 1.0, model 4.40), Future-ready (a) hall position and the "4.6 mm clear" statement (re-derive by hand: hall y −14.5 to slot y −12.7 = 1.8 mm; boss to deck slot ≈ 1.1 mm), D5 homing text pointer to the Design update, "224 tests" → 226 with date, R10/R15/R16 rows marked "resolved in the viewer spec 2026-10-15" (depends on T006)
- [X] T008 [P] Reconcile stale numbers in `specs/005-first-subsystem-rotation-pin-gates/data-model.md` (`axle-hall-sensor` box 4 × 3 × 3, flush z 0.7..3.7 at (9.7, −16.0); magnet boss Ø4.4; D bore r 2.6), `specs/005-first-subsystem-rotation-pin-gates/research.md` ("Hand-derived values": hall/magnet placeholder radii and 6° offset are superseded by radius 32.48 / 17.38°) and `specs/005-first-subsystem-rotation-pin-gates/quickstart.md` (baseline test count)

**Checkpoint**: `.venv/bin/pytest tests/test_feature005_boundaries.py tests/test_feature005_plan_consistency.py tests/test_feature005_rotation_spec.py -q` passes; full suite still green.

---

## Phase 3: User Story 1, part A — Printable and buildable (Priority: P1) 🎯 MVP

**Goal**: the rotation design values are reconciled; collisions and fits the current value-only tests miss are checked numerically; the builder-facing documents (print list, bought-parts list with measure-before-ordering, coupons, bench build order, home/index test procedure) exist; risks R13–R18 are resolved or recorded. Nothing is claimed as printed, built or validated.

**Independent Test**: `.venv/bin/pytest tests/test_feature005_*.py tests/unit/test_viz3d_rotation_sweep.py -q` passes with no unrecorded finding (allowlisted known-open findings print as `KNOWN-OPEN <ID>`; any new finding fails); every collision/fit finding is either fixed in the viewer spec or recorded in the plan conflict register and the `OPEN_CONFLICTS` allowlist; each document in `specs/005-first-subsystem-rotation-pin-gates/build/` passes the document test; the plan risk table shows R10 and R13–R18 as RESOLVED or RECORDED with a pointer.

### 3.1 Numeric clearance and fit coverage (tests first; findings are reported, never suppressed; requirement FR-033)

These tests are designed to find problems. Every finding goes through `check_findings` (T004): green means "no unrecorded finding", not "no finding". Until T015 records new findings as C9+ and adds them to `OPEN_CONFLICTS`, a test may be red; that is intended. Thresholds are the plan's "Proposed check thresholds" table (minimum wall 0.8 mm; C4 seat wall 0.7–0.8 mm and R14 pilot wall ≈ 0.7 mm are therefore KNOWN-OPEN allowlist entries).

- [X] T009 [P] [US1] Create `tests/test_feature005_clearance_drum_sweep.py`: sweep every drum-frame item from `rotation-spec.js` (four mitred decks z 4..5, eight clip arms x ±8.3..9.5 |y| ≤ 3 z 5..21, hooks, ledges, the Ø4.4 boss and magnet, hub, rod, coupler) through 360° (1° steps plus the exact home angle) against every fixed viewer item (platform slab x ±22 y −38..36 z −3..3.7, hall box, seat boss, thrust ring, bearing, columns, plate, M3 screws, motor body); assert no interpenetration, the 0.30 mm deck-to-platform/ring gap, hall top (3.7) below the deck underside (4.0), and the cartridge-footprint vs clip/boss/rail clearances (rails x 5.4..7.4, tube half-x 7.4, clip-to-wall 0.2); report findings via `check_findings`; print the minimum-clearance table (uses T004)
- [X] T010 [P] [US1] (DONE as a test; it is RED by design because of open finding C9, see plan.md; C1 coaxial entries allowlisted) Create `tests/test_feature005_clearance_vs_canonical.py`: sweep the new viewer decks (reach 34.5 on the socket axis, ≈ 36.5 at a corner), clips, ledges and boss through 360° against every canonical FIXED part's connected-component boxes from `build_concept_assembly()` (same method as `tests/unit/test_viz3d_rotation_sweep.py`, EPS 0.05); **exclusion list**: skip canonical submeshes the viewer hides, read by parsing `hideSubmeshes` in `docs/visualizer/reference-look.js` (today `stepper-body`, `stepper-shaft`, `drive-shaft-extension`, `stepper-mount-plate`, `stepper-mount-column-left`, `stepper-mount-column-right`, plus the microswitch/solenoid/plunger/tongue-carriage/strap items the viewer replaces), because the canonical stepper stack (z −35..−16) overlaps the new coupler/motor stack (z −51..−4) only on parts that are not drawn; print every excluded submesh with the reason "hidden by the viewer"; **coaxial allowance**: the new rod/hub/bearing/coupler may overlap the canonical `central-post` (coaxial at x 0, y 15) plus the pairs the existing sweep test already allows; every other overlap is a finding via `check_findings`; this closes the plan's ROT-C05 / C5 "reach" check, and the task emits its results as ROT-C05 `CriterionResult` records (`step`, observed minimum clearance, threshold, verdict) with `record_rot_c05`, so they are merged into the acceptance log by T055 (uses T004)
- [X] T011 [P] [US1] (DONE as tests; the viewer-tray test is RED by design because of open finding C9; the canonical test passes with C1 allowlisted) Create `tests/test_feature005_clearance_static_stack.py`: static overlap of the viewer-only parts below and in the platform (coupler Ø19 z −29..−4, rod z −14..46, motor body Ø28 at (0, 23) z −51..−32, mount plate, 4 × 4 columns, M3 screws and heads, bearing, ring, hall pocket) against canonical fixed parts (`electronics-deck`, `controller-board-placeholder`, `outlet-tray`, `scanner-mount`, `scanner-head-placeholder`, `servo-unit`, `station-housing` components); the 16 mm lowered motor stack is the specific risk; same **exclusion list** (the viewer `hideSubmeshes` list parsed from `docs/visualizer/reference-look.js`; canonical `stepper-body`, `stepper-shaft`, `stepper-mount-plate`, mount columns and `drive-shaft-extension` are not drawn, so overlaps with them are not findings) and the same **coaxial allowance** as T010 (the new rod is coaxial with `central-post`); every other overlap is a finding via `check_findings` (uses T004)
- [X] T012 [P] [US1] Create `tests/test_feature005_clearance_housing_walls.py`: stdlib vertical ray-cast slices of the canonical `station-housing` mesh to measure walls around the viewer pockets: 625ZZ seat (Ø16.00 at (0, 15)) to the tongue pocket (C4, plan hand value ≈ 0.7–0.8 mm), hall pocket (x 7.7..11.7, y −17.5..−14.5, z 0.7..3.7) to the tongue pocket / outlet / platform edge, column sockets (x ±17.5, y 23) to the platform side (plan value 2.85 mm; collar region flush, N4); proposed minimum wall 0.8 mm (two 0.4 mm perimeters, the plan's threshold table); the C4 seat wall is expected at 0.7–0.8 mm, so it is below the threshold and enters the allowlist as KNOWN-OPEN C4 with that range; a measurement outside 0.7–0.8 mm, or any other wall below 0.8 mm, is a NEW finding; failures reported via `check_findings`, never hidden
- [X] T013 [P] [US1] Create `tests/test_feature005_fits.py`: arithmetic from `rotation-spec.js` `g`: radial clearances (D bore vs rod flat 0.10, ring ID vs bearing OD 0.5, ring OD vs seat boss 0.5, coupler vs column inner face, coupler vs platform underside 1.0), unbonded D-flat play ≈ 3.8° (0.10 / √(2.5² − 2.0²)), insertion depths (rod 10, shaft 5, gap 10), clip strain ≈ 0.6 % (3 t δ / 2 L² with t 1.2, δ 0.7, L ≈ 14.6) against a proposed 1 % limit, hook-to-ledge 0.8, sensing gap 0.9, pocket floor 0.6 (3 layers), spigot/socket 0.15 per side, M3 pilot wall ≈ 0.7 (R14: below the proposed 0.8 mm minimum wall, so KNOWN-OPEN R14 in the allowlist with range 0.65–0.75; anything else below 0.8 mm is a NEW finding); findings via `check_findings`
- [X] T014 [P] [US1] Create `tests/test_feature005_home_sensing_window.py`: magnet path radius 32.48; angular window over which the magnet centre lies inside the hall footprint (tangential half-width ≈ 2 mm → ≈ 3.5°) against the ±0.5° tolerance and one step (0.176°); exactly one home crossing in 360°; home-to-station offset (17.38° ≈ 98.9 steps at 2048, 98.4 at 2037.9 steps/rev: 17.38 ÷ (360/2048) = 98.87, 17.38 ÷ (360/2037.9) = 98.39) and the BLUE/GREEN/ORANGE offsets; the magnet crosses no other fixed item; export the constants as named values for the controller (T041, T043)

### 3.2 Triage

- [X] T015 [US1] (DONE 2026-10-15: C9 left OPEN and red per user decision rule for collisions, C10 allowlisted, C11 documentation fix, C1 allowlisted, C4/C5 results recorded) Run T009–T014; record every finding (measured value, threshold, decision) as C9+ in the "Conflicts / open items" list of `specs/005-first-subsystem-rotation-pin-gates/plan.md`, and record C4 (seat wall) and C5 (reach) results; for each: FIXED in the viewer spec (T016), or OPEN with reason and owner; **update the `OPEN_CONFLICTS` allowlist in `tests/feature005_spec.py` (T004)** with one entry (ID, check, threshold, expected measured range, decision) for each OPEN finding and none for a FIXED one (depends on T009–T014)
- [X] T016 [US1] (N/A 2026-10-15: no viewer-spec fix selected; C9 needs a user decision on the coupler OD or the tray) Apply only the viewer-spec fixes T015 selects, in `docs/visualizer/rotation-spec.js` (and the matching value assertions in `tests/test_feature005_rotation_spec.py`; `docs/visualizer/reference-look.js` only if a key name changes); never edit the canonical JSON; if T015 selects none, record "N/A" in `specs/005-first-subsystem-rotation-pin-gates/implementation-evidence.md`; this is the only task that may change geometry values (spec Out of Scope, FR-033); **if any value changed, re-run T009–T014, the plan-consistency test (T006) and `tests/test_feature005_boundaries.py` (T005), and update the plan numbers the T006 deny-list and presence checks guard, before T017 runs** (depends on T015)

### 3.3 Builder-facing documents (`build/`; blank result cells; no result claimed)

- [X] T017 [US1] Create `tests/test_feature005_build_docs.py` (fails until T018–T023; the "six coupons" plan check only turns green at T023): the five documents exist, each carries `NOT VALIDATED`, `print_ready=false`, `fabricable_as_designed=false`; no claim phrases (print-ready, validated, fabricable, single-dose, medication-safe) outside negations, where a negation means the phrase sits in the same sentence as `not`, `no`, `never`, `NOT`, or inside `print_ready=false` / `fabricable_as_designed=false`; **negation self-check**: the test scans an in-memory copy (never written to disk) of `build/print-list.md` with the line `This design is print-ready.` appended and must report exactly one violation at that line, and a copy with `This design is NOT print-ready.` appended must report none (`test_claim_scanner_detects_unnegated_claim` fails if either expectation is wrong); after T023 the plan contains no "six coupons" and no "C-1..C-6" outside Superseded text (this check moved here from T006); every "model value" quoted in the measure-before-ordering table equals a `g` or `dims` value in `rotation-spec.js`; coupons C-1..C-7, bench steps 1..11 and `ROT-R01..R06` rows are present; measured/result cells are empty or "not validated — to be measured on a built rig" (depends on T016)
- [X] T018 [P] [US1] Create `specs/005-first-subsystem-rotation-pin-gates/build/print-list.md`: printed parts (drum with decks, clips and boss; housing platform with seat, sockets and hall pocket; stepper mount with columns and spigots; cartridges with ledges; optional standoffs), per part: material (PETG or PLA+), orientation, 0.4 mm nozzle / 0.2 mm layer settings, brim, hole compensation 0.15, model-vs-nominal-vs-tolerance table from `rotation-spec.js`; "do not print" list; open items (clip orientation R17, housing split)
- [X] T019 [P] [US1] Create `specs/005-first-subsystem-rotation-pin-gates/build/bought-parts.md`: bought list (28BYJ-48 with ULN2003, 625ZZ with 685ZZ fallback, 60 mm D-flat rod, 25 mm 5-to-5 flexible coupler, 0.30 mm PTFE ring OD 20 / ID 17, 2 × M3 × 12, 3 × 1 magnet, A3144-class hall, 10 kΩ and 0.1 µF, ESP32, supply, adhesives) with quantity and role, and the **measure-before-ordering table** (part, what to measure, why, model value, tolerance, blank Measured / Within tolerance / Action columns) including the decision rules: coupler bore depths ≥ 10 / ≥ 5, motor shaft exposure ≥ 5 mm after the boss, coupler OD ≤ 19.4 (hand derivation stated in this document: weigh-band edge y = 5.3, axle y = 15, so the maximum radius is 9.7 and OD 19.4 is the zero-clearance limit; the modelled Ø19 leaves 0.2 mm; T050 re-checks it numerically and, if it differs, updates this table), OD < 31 between columns; optional parts listed as not modelled and not on the print list (shaft collar or E-clip, spring-ball detents, second guide bushing, plan R7/D5)
- [X] T020 [P] [US1] Create `specs/005-first-subsystem-rotation-pin-gates/build/coupons.md`: coupons C-1..C-6 from the plan plus a new **C-7 D-bore epoxy bond and hand-torque coupon** (R13), each with geometry, what it tests, pass check and a blank result row; states which model values each coupon confirms (`hole_comp_mm`, pilot hole Ø, seat Ø, pocket Ø, clip orientation)
- [X] T021 [P] [US1] Create `specs/005-first-subsystem-rotation-pin-gates/build/bench-build-order.md`: steps 1–8 of the plan's bench build order with prerequisites, proposed pass checks, hold points and blank record columns (proposals only; mode (b))
- [X] T022 [P] [US1] Create `specs/005-first-subsystem-rotation-pin-gates/build/bench-home-index-test.md`: steps 9–11: 20 CCW homing runs (± 1 step), the home-and-index 90° test (four stations, 10 repeats, CCW approach and CW approach with the 3° overshoot, ± 0.5°), the 16 start-to-target moves, `steps_per_rev` calibration from two home edges, measurement method (drum-edge mark and fixed scale or camera), blank record sheets, mapping to `ROT-R01..R06` and `ROT-C01..C04` IDs; the plan's OPEN item "coil release vs holding at idle" recorded as OPEN (no decision made here); every result "not validated — to be measured on a built rig"

### 3.4 Risks R13–R18 (resolved or recorded; sequential edits to one file)

- [X] T023 [US1] In `specs/005-first-subsystem-rotation-pin-gates/plan.md`: record R13 (epoxy-dependent zero play) as RECORDED with coupon C-7 and the hand-torque check as the gate, and R17 (clip arms printed upright) as RECORDED with the decision rule: print upright for the first drum only if C-6 passes, else separate flat-printed clips; change "six coupons" / "C-1..C-6" to seven in A0, bench step 2 and readiness item 5 (this is the check T017 asserts; it was removed from T006's deny-list) (depends on T015, T020)
- [X] T024 [US1] In `specs/005-first-subsystem-rotation-pin-gates/plan.md`: record R14 (column wall ≈ 0.7 mm below two 0.4 mm perimeters; default keep 4 × 4 and let C-4/C-5 decide, widen to 5 × 5 only if they fail, effect on coupler clearance noted) and R18 (collar flush with the platform edge; hall wire exit route proposal and its limits from T012 and from the weigh-corridor numbers) as RECORDED (depends on T012, T013, T023)
- [X] T025 [US1] In `specs/005-first-subsystem-rotation-pin-gates/plan.md`: mark R10, R15, R16 and findings N1–N5 with their final status and the test that proves it (`tests/test_feature005_rotation_spec.py`, T009–T014), add a pointer from the plan's section A–E to the `build/` documents as the builder-facing copies, and list readiness items 3–8 as OPEN (builder-owned, not done by software) (depends on T024)

**Checkpoint (T026)**:

- [X] T026 [US1] Run `.venv/bin/pytest tests/ -q` and the Phase 3 tests; record counts, the minimum-clearance table, all conflicts C9+ and the build-document status in `specs/005-first-subsystem-rotation-pin-gates/implementation-evidence.md`; confirm T005 still passes and that the Phase 3 clearance/fit tests are green only because every finding is fixed or allowlisted ("no unrecorded finding", not "no finding"); list each `KNOWN-OPEN` entry in the evidence file (depends on T016–T025)

**Checkpoint**: Part A complete. A builder has a consistent, numerically cross-checked, still ASSUMED design, a print list, a bought-parts list with a measure-first table, coupons, a build order and a home/index procedure. Readiness items 3–8 stay OPEN until a person measures, prints and builds.

---

## Phase 4: User Story 1, part B — Controller and interlocks (Priority: P1)

**Goal**: close the plan D7 gaps as testable, offline, deterministic software in a NEW module, without editing `docs/visualizer/demo-controller.js`: shared rotation guard over all interlocks (pin, carriage, all four gates, caps, lifts, busy), standalone index command, home and calibration, direction policy with CCW final approach, station-confirmed readout, missed-index / bounded re-index / hard-fault handling, elapsed-time motion.

**Independent Test**: `.venv/bin/pytest tests/test_feature005_rotation_controller.py -q` runs the JS harness headless and passes (16 moves, repeatability for both policies, refusals, faults, home, timing); the harness log is byte-identical on a second run; `tests/test_feature005_boundaries.py` still passes (demo controller untouched). Logic only; no physical claim.

### 4.1 Specification of the controller (documents first)

- [X] T027 [US1] Record and verify the placement decision (spec change 2026-10-15, user-approved): confirm `specs/005-first-subsystem-rotation-pin-gates/plan.md` (D7 closure note, Project Structure, "Next-step task ordering" step 5) and `specs/005-first-subsystem-rotation-pin-gates/research.md` (R-8 amended) say that mode (a) is the standalone logic in new `docs/visualizer/rotation-controller.js` with harness `tests/browser/feature005/`, tested headlessly; that `docs/visualizer/demo-controller.js` is NOT modified and NOT verified by this feature; and that wiring into the viewer is DEFERRED; fix any remaining sentence that says the viewer controller will be changed or verified; add research R-11 recording the file layout and the deferral (depends on T026)
- [X] T028 [US1] Create `specs/005-first-subsystem-rotation-pin-gates/contracts/rotation-controller.md`: public API (`RotationController` options, `home()`, `requestIndex(color, options)`, `tick(dt)`, fault injection, `reset()`, frozen `snapshot()`); guard rule codes and precedence (`pin_not_up`, `carriage_not_parked`, `gate_open` over all four blades and the tongue, `cap_open`, `busy`, `cartridge_lift_active`, plus `not_homed`, `fault_active`, `invalid_color`; `already_at_station` is a non-motion result); input mapping from `DispenserDemoController.snapshot()` fields (`pin`, `carriage`, `cartridges[c].bladeMotion/blade/capOpen/cap/lift/liftTarget`, `tongueMotion/tongueEdge`, `phase`, `operation`) documented for the DEFERRED wiring; direction policy (`unidirectional` CCW final approach is the DEFAULT, matching plan D5 / R-6; `shortest` is an opt-in comparison case; 180° always CCW, 3° overshoot, wrap to [0, 360)); lost-motion model; home procedure (CCW rising edge) and `steps_per_rev` calibration; `home_offset_deg` from T014; motion profile (hardware 0.8 rad/s with 0.2 s ramps, simulation 1.3 rad/s); tolerance ± 0.5°; fault codes (`missed_index_short`, `missed_index_over`, `wrong_stop`, `home_not_found`, `hard_fault`); bounded re-index (proposed 2 attempts); readouts `at_station`, `drum_state` (`STILL` / `ROTATING`), `sequence_active`, `lift_in_progress`, `pin_gate_allowed`; **auxiliary-command refusal (spec US1 acceptance scenario 5)**: `requestAuxCommand(kind)` with `kind` in `dispense` / `pin` / `gate` is refused with rule code `rotation_active` while `drum_state` is `ROTATING` (and with `station_not_confirmed` when no station is confirmed), changes no state and does not disturb the rotation; `pin_gate_allowed` is false in both situations (the refusal side of scenario 5 only; "explicitly deferred" is not implemented); determinism rules; the DEFERRED integration hook points for a later `demo-controller.js` change; explicit exclusions (power loss FR-023/024, pin/gate/jam faults); all thresholds labelled proposed (depends on T014, T027)
- [X] T029 [US1] Update `specs/005-first-subsystem-rotation-pin-gates/data-model.md` to match the contract: `HomeCalibration`, `FaultRecord`, `ReIndexAttempt`, `MotionProfile`, `HARD_FAULT --explicit reset--> UNHOMED`, `already_at_station` verdict, guard result rule codes plus the auxiliary-command refusal codes `rotation_active` / `station_not_confirmed`, and `unidirectional` as the default `policy` (depends on T028)
- [X] T030 [P] [US1] Extend `specs/005-first-subsystem-rotation-pin-gates/contracts/rotation-check-log.md` with `ROT-C06` (home and calibration; unconfirmed before home), `ROT-C07` (direction policy, timing, no skipped state under a large time step; FR-022) and `ROT-C08` (readouts and pin/gate permission gating); keep `ROT-R01..R06` as "not validated"; add the same IDs to plan D8 (depends on T028)

### 4.2 Harness and cases (written first; they fail until 4.3)

- [X] T031 [US1] Create `tests/browser/feature005/harness-core.js`: no DOM; registers cases, runs them against `DispenserRotationController`, builds the acceptance log in the `rotation-check-log.md` format (fixed ordering by criterion ID then the 16 moves in COLORS order, no timestamps, disclosure, `print_ready=false`, `fabricable_as_designed=false`, assumptions block, `ROT-R01..R06` entries as not validated) (depends on T030)
- [X] T032 [P] [US1] Create `tests/browser/feature005/cases-index.js`: `ROT-C01` all 16 start→target moves end at the commanded station, same→same reports `already_at_station` with zero motion; `ROT-C02` 10 repeats per station under the lost-motion model: unidirectional spread 0°, shortest-path spread = `lash_deg`, never a neighbouring station (SC-001, SC-002)
- [X] T033 [P] [US1] Create `tests/browser/feature005/cases-refusals.js`: `ROT-C03` each rule code alone and combined, all four blades and the tongue checked (the D7 partial gap), caps, busy, cartridge lift, reason text, zero motion; **plus a refusal case for acceptance scenario 5**: while a rotation is in progress, `requestAuxCommand('dispense' | 'pin' | 'gate')` is refused with `rotation_active`, `pin_gate_allowed` is false, the rotation still completes at the commanded station and no other state changed; plus an adapter case that loads `docs/visualizer/concept-data.js` (needs the `var window = this;` shim in the jsc runner, T037) and `docs/visualizer/demo-controller.js` read-only, drives a real `DispenserDemoController` into pin-down / gate-open / cap-open / lift states and checks only that the guard accepts the real `snapshot()` field shapes (input-mapping shape check; it does NOT verify the viewer controller's behaviour, spec change 2026-10-15) (SC-003)
- [X] T034 [P] [US1] Create `tests/browser/feature005/cases-faults.js`: `ROT-C04` injected short, over and wrong-stop → fault, `at_station` null, `pin_gate_allowed` false; bounded re-index recovers or reaches `HARD_FAULT`; `HARD_FAULT` needs explicit `reset()`; no motion commands accepted while faulted (FR-009)
- [X] T035 [P] [US1] Create `tests/browser/feature005/cases-home.js`: `ROT-C06` unhomed controller refuses index and reports station unconfirmed; CCW rising-edge home confirms; `steps_per_rev` calibration at 2048 and 2037.9 gives `round(k × steps_per_rev / 4)` targets and removes the +0.447° per quarter drift; `home_not_found` after N steps (N proposed in the contract)
- [X] T036 [P] [US1] Create `tests/browser/feature005/cases-timing.js`: `ROT-C07` trapezoid profile (≈ 2.16 s per quarter, ≈ 4.13 s per 180° at 0.8 rad/s with 0.2 s ramps; 1.208 s at 1.3 rad/s cruise-only), a single huge `tick(dt)` completes exactly one move with no skipped state, 180° ties always CCW, angle wrapping; `ROT-C08` readout names and the DONE items of Future-ready (e): `at_station`, `drum_state`, `sequence_active`, `lift_in_progress`
- [X] T037 [US1] Create `tests/browser/feature005/jsc-runner.js` and `tests/test_feature005_rotation_controller.py`: pytest runs the system `jsc` with workspace files only (a prelude defining `var window = this;` first, because `jsc` has no `window` and `docs/visualizer/concept-data.js` assigns `window.DISPENSER_CONCEPT_DATA`; then `rotation-controller.js`, `harness-core.js`, the cases files, the runner; no temp files; output through `print`), parses the JSON log, asserts every ROT-C case passes, validates the log against the contract fields, runs it twice and asserts byte-identical output (SC-010), asserts the disclosure and the absence of claim words, and SKIPs with an explicit reason if `jsc` is missing (depends on T031–T036); this test is red until T046, so run only targeted tests between T037 and T046

### 4.3 Implementation (`docs/visualizer/rotation-controller.js`; sequential, one file)

- [X] T038 [US1] Create `docs/visualizer/rotation-controller.js`: ES5 IIFE exporting `DispenserRotationController` to `window` or `this` (same pattern as `demo-controller.js`), named constants (`lash_deg` 1.0, `overshoot_deg` 3.0, `steps_per_rev` 2048, `index_tolerance_deg` 0.5, hardware and sim rates, `home_offset_deg` from T014), no `Math.random`, no `Date`, no DOM; run `.venv/bin/pytest tests/test_feature003_scanner_visibility.py -q` (it globs `docs/visualizer/*.js` and forbids the string "feature004" in any case, so the string must not appear in `rotation-controller.js`, comments included) instead of the full suite, which is red at this point because T037's tests fail until T046 (depends on T037)
- [X] T039 [US1] In `docs/visualizer/rotation-controller.js` implement `canRotate(snapshot)` returning `{allowed, failed_rules, reason}` over pin, carriage, all four blades, the tongue, caps, busy (`phase` / `operation`), and cartridge lift; passes `cases-refusals.js` (depends on T038)
- [X] T040 [US1] In `docs/visualizer/rotation-controller.js` implement `planRotation(from, to, policy)`: wrapped angles, `unidirectional` policy as the DEFAULT (CCW final approach, `(Δ − o)` then `+o` for CW needs, 180° always CCW), `shortest` policy with deterministic 180° tie as an opt-in comparison case, returns the signed delta list (depends on T039)
- [X] T041 [US1] In `docs/visualizer/rotation-controller.js` implement the deterministic lost-motion model (error 0 after a CCW final move, `−lash_deg` otherwise) and step arithmetic (nominal 2048, calibrated `steps_per_rev`, quarter targets) (depends on T040)
- [X] T042 [US1] In `docs/visualizer/rotation-controller.js` implement the elapsed-time motion profile and `tick(dt)` with `STILL` / `ROTATING`, no skipped state for any `dt`, hardware and sim profiles (depends on T041)
- [X] T043 [US1] In `docs/visualizer/rotation-controller.js` implement `home()` (CCW rising edge, `HomeCalibration`, `home_not_found`) and the `UNHOMED` → `HOMED_CONFIRMED` transition (depends on T042)
- [X] T044 [US1] In `docs/visualizer/rotation-controller.js` implement `requestIndex(color, options)`: guard → plan → motion → end-position check against tolerance → confirm or fault, standalone (no dispense needed), `already_at_station` without motion (depends on T043)
- [X] T045 [US1] In `docs/visualizer/rotation-controller.js` implement fault injection (short, over, wrong stop), bounded re-index, `HARD_FAULT`, explicit `reset()`, and `pin_gate_allowed` false until a confirmed station (depends on T044)
- [X] T046 [US1] In `docs/visualizer/rotation-controller.js` implement the frozen `snapshot()`, `requestAuxCommand(kind)` (refused with `rotation_active` / `station_not_confirmed`, no state change) and the readouts `at_station` (color or null), `drum_state`, `sequence_active`, `lift_in_progress`, `pin_gate_allowed`; `.venv/bin/pytest tests/test_feature005_rotation_controller.py -q` now passes (depends on T045)

### 4.4 Browser runner and boundaries

- [X] T047 [P] [US1] Create `tests/browser/feature005/index.html` and `tests/browser/feature005/browser-tests.js`: loads `../../../docs/visualizer/rotation-controller.js` and the harness files by relative path only, renders PASS / FAIL per case like `tests/browser/feature004/`, and offers the log as a download; no network, no CDN (depends on T046)
- [X] T048 [P] [US1] Create `tests/test_feature005_controller_boundaries.py`: new JS and HTML files contain no `http:`, `https:`, `//cdn`, `fetch(`, `XMLHttpRequest`, `Math.random`, `Date`, `import(`; `docs/visualizer/rotation-controller.js` references no DOM global; relative asset paths only in `tests/browser/feature005/index.html` (depends on T046)

**Checkpoint (T049)**:

- [X] T049 [US1] Run `.venv/bin/pytest tests/ -q`; record the harness results, both log hashes (run 1 = run 2) and the unchanged `demo-controller.js` hash in `specs/005-first-subsystem-rotation-pin-gates/implementation-evidence.md` (depends on T046–T048)

**Checkpoint**: Part B complete as logic only. The viewer is not wired to the new controller (DEFERRED, needs a later, separately approved change to `demo-controller.js` / `app.js`).

---

## Phase 5: Future-ready provisions (User Story 1 constraints; DONE vs DEFERRED)

**Purpose**: keep the cheap reservations true and checkable; nothing here adds parts to the print list or hardware.

- [X] T050 [P] [US1] Create `tests/test_feature005_reserved_volumes.py`: (a) no rotation-spec item (hall, magnet boss, clips, collars, sockets, coupler, columns) intersects the weigh-station corridor (slots x 8.5..10.7 at y −12.7..−8.3 and 3.3..5.3; platform band z −12.5..−3.0, x ±20, y −12.7..5.3) and the clip-root keep-out (x 8.3..9.5, |y| ≤ 3.0); record minimum clearances (hand values: hall 1.8 mm, boss to deck slot ≈ 1.1 mm, Ø19 coupler to band ≈ 0.2 mm); (b) the drum frame carries only passive parts (no sensor, wire, board or motor in a drum-frame item; the home magnet is the only electronics-adjacent item and it is passive); hook clearance above the catch ledge stays >= 0.8 mm (`hook_z0` 18.8 vs `ledge_z1` 18.0, W-C1 / C8) so a later lift pad needs no hook change; (c) nothing above deck z 21 over a cartridge position (≈ 50 mm free height working figure); (d) a reserved fixed-side keep-out volume for the lid-release actuator at the fill position, derived from the `red-cap-latch-body` canonical bounds and marked proposed (uses T004)
- [X] T051 [P] [US1] Create `tests/test_feature005_load_check.py`: reusable `load_check(mass_g, mu)` reproducing the plan's load check (ring mean radius from `ring_r_in` / `ring_r_out`, 73 / 93 / 125 g, μ 0.06–0.20, friction 0.7–2.3 N·mm, acceleration < 0.5 N·mm, bearing 0.1, total ≤ ≈ 2.9 N·mm at 125 g) and asserting mass ≤ 150 g and total ≤ one third of the ≈ 34 N·mm rated (≈ 11 N·mm), including the 150 g edge case
- [X] T052 [US1] Update the "Future-ready provisions" table in `specs/005-first-subsystem-rotation-pin-gates/plan.md`: statuses DONE with test pointers (a reserved corridor, b actuator position and passive drum, c free height, d mass and torque check, e provided readouts now in `rotation-controller.js`, f sub-view pattern) and DEFERRED for everything listed there as deferred (pad bars, slots, lugs, load cell, lift actuator, W-C1 hook change for weighing, lid-release actuator itself, hatch and procedure, accepted extension points `loaded-state` / `lock-request` / `unlock-request` / `quarantine-flag`, the 006 sub-view); correct the plan's "no controller field" statement for (e) (depends on T050, T051, T046)
- [X] T053 [US1] Add the DONE vs DEFERRED ledger to `specs/005-first-subsystem-rotation-pin-gates/implementation-evidence.md` with the same classification and the reason for each deferral (depends on T052)

---

## Phase 6: Convergence and validation

**Purpose**: full-suite validation, evidence and a convergence check against the spec. No readiness or validation claim; the expected convergence result is "not converged" (see Deferred).

- [X] T054 Run the full suite `.venv/bin/pytest tests/ -q` (baseline 226 passing plus the new tests); record the result and any skip reasons in `specs/005-first-subsystem-rotation-pin-gates/implementation-evidence.md` (depends on T053)
- [X] T055 Run the JS harness twice via `tests/test_feature005_rotation_controller.py`, store one deterministic log as `specs/005-first-subsystem-rotation-pin-gates/evidence/rotation-check-log.json`, merge the ROT-C05 records from `specs/005-first-subsystem-rotation-pin-gates/evidence/rot-c05-results.json` (T010) into it in fixed criterion-ID order, record its SHA-256 in `specs/005-first-subsystem-rotation-pin-gates/implementation-evidence.md` (depends on T054)
- [X] T056 Open `tests/browser/index.html` (14 existing cases), `tests/browser/feature004/index.html` and `tests/browser/feature005/index.html` via `file://` in a real foreground browser at desktop and phone-sized viewports; record PASS counts, or record `PENDING (not run)` if no real browser is available, in `specs/005-first-subsystem-rotation-pin-gates/implementation-evidence.md` (do not claim FPS/WebGL evidence) (depends on T055)
- [X] T057 If T016 changed `docs/visualizer/rotation-spec.js`, open `docs/visualizer/index.html` via `file://` and check the three sub-views (Rotation mechanism, Stepper mount, Compartments & decks) and their dimension lines; otherwise record N/A in `specs/005-first-subsystem-rotation-pin-gates/implementation-evidence.md` (depends on T056)
- [X] T058 Update `specs/005-first-subsystem-rotation-pin-gates/plan.md`: Readiness checklist items 9–11 (standalone rotation-controller logic implemented and tested headlessly; the viewer controller `demo-controller.js` NOT modified and NOT verified; wiring into the viewer DEFERRED), "Next-step task ordering" status line, test counts and dates; keep items 3–8 OPEN (depends on T057)
- [X] T059 [P] Update `specs/005-first-subsystem-rotation-pin-gates/quickstart.md` with the new commands (clearance tests, `jsc` harness, browser page, document test) and the expected outcomes and limits (depends on T058)
- [X] T060 [P] Update the Feature 005 paragraph of `.github/copilot-instructions.md` (inside the SPECKIT block): point to `specs/005-first-subsystem-rotation-pin-gates/tasks.md`, the new `rotation-controller.js`, the `build/` documents, and the "demo-controller.js is locked" rule (depends on T058)
- [X] T061 Re-verify the boundaries: `tests/test_feature005_boundaries.py`, `tests/test_feature005_plan_consistency.py`, `tests/test_feature005_build_docs.py` pass; recompute the T002 manifests and confirm Features 001-004 and 006, the canonical JSON, `concept-data.js`, `demo-controller.js` and the 52 IDs are unchanged; record in `specs/005-first-subsystem-rotation-pin-gates/implementation-evidence.md` (depends on T059, T060)
- [X] T062 Finalize `specs/005-first-subsystem-rotation-pin-gates/implementation-evidence.md`: NOT VALIDATED wording on every result, the explicit statement **"FR-025 and SC-004..SC-008 not met; Feature 005 is not accepted; this phase delivers the design package and standalone controller logic only; the viewer controller is not verified"** (also FR-011..FR-021, FR-023, FR-024 not met; SC-013 not verified), deviations (controller placement as the 2026-10-15 spec change, ROT-C06..C08 added, coupon C-7 added, FR-031..FR-034 added), the DONE vs DEFERRED ledger, OPEN builder items 3–8, Constitution I ERROR / BLOCKED, `print_ready=false`, `fabricable_as_designed=false` (depends on T061)
- [X] T063 Convergence check (the `/speckit-converge` step; read-only against the spec): add a requirement-to-evidence table to `specs/005-first-subsystem-rotation-pin-gates/implementation-evidence.md` mapping every FR-001..FR-034 and SC-001..SC-014 to MET-IN-LOGIC (mode a), DOCUMENTED, NOT MET, or DEFERRED with the task or test that proves it; the verdict line MUST read "NOT CONVERGED" while any of FR-011..FR-021, FR-023..FR-025, SC-004..SC-008 remain unmet, and MUST NOT claim validation, print-readiness, fabricability or single-dose integrity (depends on T062)

---

## Phase 7: Deferred wiring register `[NEEDS-USER-APPROVAL]` — NOT TASKS, do not implement under this feature

**Why this is not a task phase**: the spec (FR-001, FR-002, Out of Scope, spec change 2026-10-15) and the plan (D7 closure note, "Source code touched", Readiness items 9-11) place `docs/visualizer/demo-controller.js` out of scope. These rows document what a later, separately approved change would touch so nothing is silently dropped. They have no checkbox and no `T` ID, so `/speckit-implement` skips them. Before any row can become a task, the user must (1) approve it explicitly, (2) amend spec FR-002 / Out of Scope and plan D7 / research R-8, and (3) accept re-baselining the protected hash (T002 / T005), the 14-case browser harness and the Feature 003 evidence.

| ID | Flag | Would touch | What and why |
|---|---|---|---|
| W01 | `[NEEDS-USER-APPROVAL]` | `docs/visualizer/demo-controller.js` | Call the `rotation-controller.js` guard from `requestDispense` so all four blades, tongue, caps and lifts are checked (closes the D7 "partial" gates gap) |
| W02 | `[NEEDS-USER-APPROVAL]` | `docs/visualizer/demo-controller.js` | Add a standalone "go to station" command, an `already_at_station` report, a station-confirmed readout and missed-index / fault state (D7 missing rows) |
| W03 | `[NEEDS-USER-APPROVAL]` | `docs/visualizer/app.js`, `docs/visualizer/index.html` | Load `rotation-controller.js` and expose its readouts and index control in the viewer |
| W04 | `[NEEDS-USER-APPROVAL]` | `tests/browser/browser-tests.js`, `tests/test_feature005_boundaries.py` | Re-baseline the 14-case harness and the demo-controller hash lock after W01-W03 |

---

## Dependencies and execution order

### Phase dependencies

- **Phase 1 (Setup)**: none. T001 → T002; T003 parallel.
- **Phase 2 (Foundational)**: after Phase 1. T004, T005 (needs T002), T006, T008 parallel; T007 after T006. Blocks Phases 3–5.
- **Phase 3 (US1 part A)**: after Phase 2. 3.1 tests parallel → T015 → T016 → T017 → docs T018–T022 parallel → T023 → T024 → T025 → T026.
- **Phase 4 (US1 part B)**: after the Phase 3 checkpoint (the user's order). It depends on Phase 3 only through T014's constants and T027's placement record; the physical build/bench (readiness items 3–8) is NOT a gate for these software tasks.
- **Phase 5 (Future-ready)**: T050 and T051 need only Phase 2 and may run alongside Phase 4; T052 needs T046; T053 closes the phase.
- **Phase 6 (Convergence and validation)**: after Phases 3–5; T063 last.
- **Phase 7 (Deferred register)**: not executable; nothing in Phases 1–6 depends on it.

### Within Phase 4

Documents (T027–T030) → harness (T031) → cases (T032–T036, parallel) → runner (T037, red) → implementation T038 → T046 (sequential, one file, green) → T047, T048 parallel → T049.

### Parallel opportunities

- Phase 1: T003 beside T001/T002.
- Phase 2: T004, T005, T006, T008 together; T007 after T006.
- Phase 3.1: T009–T014 (six separate files) together.
- Phase 3.3: T018–T022 (five separate files) together.
- Phase 4.1: T030 beside T029. Phase 4.2: T032–T036 together. Phase 4.4: T047 with T048.
- Phase 5: T050 with T051. Phase 6: T059 with T060.
- Tasks that edit `specs/005-first-subsystem-rotation-pin-gates/plan.md` or `implementation-evidence.md` or `docs/visualizer/rotation-controller.js` are never parallel with each other.

### Parallel example: Phase 3.1

```text
T009 tests/test_feature005_clearance_drum_sweep.py
T010 tests/test_feature005_clearance_vs_canonical.py
T011 tests/test_feature005_clearance_static_stack.py
T012 tests/test_feature005_clearance_housing_walls.py
T013 tests/test_feature005_fits.py
T014 tests/test_feature005_home_sensing_window.py
```

---

## Coverage map (requirement → tasks)

| Requirement | Tasks |
|---|---|
| FR-001, FR-002 mode (a) = standalone logic, viewer controller untouched | T005, T027, T037, T048, T061 (the viewer controller is not verified; spec change 2026-10-15) |
| FR-003, SC-010 deterministic log | T030, T031, T037, T055 |
| FR-005, SC-001 four stations, 16 moves | T032, T044 |
| FR-006, SC-002 repeatability | T032, T041, T014 |
| FR-007 station readout | T036, T046 |
| FR-008, SC-003 refusal rules | T033, T039 |
| US1 acceptance scenario 5 (dispense/pin/gate command during rotation refused) | T028, T033, T046 (refusal side only; it is not an FR-level requirement and FR-011..FR-021 stay unmet) |
| FR-009, SC-009 (rotation part) missed index | T034, T045 |
| FR-010 already at station | T032, T044 |
| FR-022 no skipped state (rotation) | T036, T042 |
| FR-026, FR-027, SC-012 mode (a)/(b) honesty | T031, T022, T062 |
| FR-028, SC-011 no claims | T006, T017, T037, T061 |
| FR-030, SC-013 rotation-only view | implemented in the viewer 2026-10-15 per the plan; kept passing in T054 / T057; SC-013 runtime check not verified, not claimed |
| **FR-031** home/index reference (hall + magnet, step counting, CCW final approach) | T014, T022, T028, T030 (ROT-C06), T035, T043 |
| **FR-032** builder documents (print list, bought-parts, coupons, build order, home/index test) | T017–T022, T023–T025 (risk records) |
| **FR-033** numeric clearance/fit checks and conflict register (viewer-spec values only) | T004, T009–T016, T026 |
| **FR-034** Feature 006 reservations (corridor, passive drum, free height, ≤ 150 g, torque) | T050–T053 |
| **SC-014** design package exists, no claim | T017, T026, T061 (tested, not claimed met until done) |
| Plan D8 ROT-C05 geometry | T009–T014, T015 (ROT-C05 records emitted by T010, merged by T055) |
| Plan R10, R13–R18 | T015, T023–T025 |
| Plan Future-ready (a)–(f) | T050–T053 |
| Convergence statement (all FR / SC, verdict "NOT CONVERGED") | T062, T063 |
| Setup and guards (T001–T003, T005, T006, T007, T008) | baseline, boundary locks and plan/doc consistency for FR-028 / SC-011; no own requirement |

## Deferred (not tasked here; listed so nothing is silently dropped)

- **User Story 2 (pin pinpointing) and User Story 3 (gates and dispensing)**: not designed in the plan and NOT tasked. Unmet and unaccepted: FR-011..FR-021, FR-023, FR-024, FR-025 and SC-004..SC-008 (13 of the original 30 FRs and 5 SCs have no task). **FR-025 and SC-004..SC-008 not met; Feature 005 is not accepted; this task list delivers the design package (FR-031..FR-034) and standalone controller logic only.** SC-009 is covered only for its rotation part; SC-013 is not verified. They need their own plan.
- **Power-loss injection (FR-023, FR-024, SC-007)**: plan D7 puts it outside this plan.
- **Wiring `rotation-controller.js` into the viewer** and any change to `demo-controller.js`, `app.js`, `index.html`: not allowed in this task list; hook points are written in `contracts/rotation-controller.md` (T028); the would-be work is registered, unexecutable, as W01–W04 in Phase 7 `[NEEDS-USER-APPROVAL]`.
- **Canonical JSON, 3MF export and the 6 plan "step 2/3" geometry items**: viewer-only parts stay viewer-only (default: no change).
- **Mode (b) rig results, physical measurement, printing, bench build (readiness items 3–8)**: builder-owned; documents only.
- **Feature 006 items** (pad, slots, lugs, load cell, lift actuator, W-C1 hook change, accepted extension points, "Weight verification" sub-view) and the **lid-release actuator itself**.

## Implementation strategy

- **MVP**: Phases 1–3 (T001–T026): a consistent, cross-checked, printable-and-buildable documentation package and numeric coverage. This is the user's first priority and is independently useful without any controller code.
- **Increment 2**: Phase 4 (T027–T049): controller and interlocks as headless-testable logic.
- **Increment 3**: Phase 5 (T050–T053) can start early in parallel with Phase 4; Phase 6 closes with evidence.
- Fix or record findings; never relax a test to make it pass, never suppress a failing result.

## Notes

- 63 tasks (T001–T063; T001–T003 already done, T063 and the Phase 7 register added 2026-10-15). No task carries `[NEEDS-USER-APPROVAL]`; the four approval-gated items are register rows W01–W04. All outcomes remain ASSUMED / NOT_VALIDATED. Feature 005 is not accepted (see Deferred).
- Risk: T010–T012 may expose real collisions (the widened deck reach C5, the lowered motor stack, thin housing walls); each becomes a C9+ allowlist entry or a viewer-spec fix in T016, which is the only place geometry values may change, and only in the viewer spec.
- Risk: the `jsc` runner depends on a macOS system tool; the browser harness (T047) is the fallback runner.
- Risk: a new file in `docs/visualizer/` is globbed by `tests/test_feature003_scanner_visibility.py`; T038 runs that test.
