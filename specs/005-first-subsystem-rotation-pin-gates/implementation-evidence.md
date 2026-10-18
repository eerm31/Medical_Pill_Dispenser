# Implementation Evidence: Feature 005 (first subsystem, rotation)

Evidence ledger for `tasks.md` (T001-T063). Every result below is ASSUMED / NOT_VALIDATED.

## Posture / disclosure

- NOT VALIDATED / NOT PRINT-READY. `print_ready=false`, `fabricable_as_designed=false`.
- No physical validation, print-readiness, fabricability, single-dose integrity or medication/dose safety is claimed or implied.
- Constitution I stays ERROR / BLOCKED (recorded zero-/multi-dose violations); no feature-converged claim.
- Mode (b) criteria `ROT-R01..ROT-R06` are never reported as passed; they are "not validated - to be measured on a built rig".

## Baseline

- Date: 2026-10-15
- Command: `cd /Users/ice/Documents/smart-medical-dispenser && .venv/bin/pytest tests/ -q`
- Result before any Feature 005 task: **226 passed** in about 14 s.
- Spec Kit checklist `checklists/requirements.md`: 21 / 21 items complete (PASS).
- No `.specify/extensions.yml` hooks registered (file absent).

## Protected-file hashes

Machine-readable manifest: `evidence/protected-hashes.json` (sorted keys, no timestamps). Recorded 2026-10-15 before any other change.

| File | SHA-256 |
|---|---|
| `docs/visualizer/demo-controller.js` | `24505915d85f53f39205413cd3f452e5307cf729f9d3dabd8bf5ee9c2905914d` |
| `docs/visualizer/concept-data.js` | `ea011972537d6174806dae467893db3d55e3d5a658d5ece3376a1d33a257dd7f` |
| `src/dispenser_sim/viz3d/concept_geometry.json` | `6aaf3704483cdc1fc580193d9678d4d0e2e42fb8b35e0dea80889534b75c3ff9` |
| `tools/build_visualizer_data.py` | `2b7aa5ce5423167ec723eef40193e218f38da73d17ca7da7fbfebddca2f0ee87` |

(The manifest is authoritative; see it for `.specify/feature.json`, every file under `src/dispenser_sim/viz3d/`, and the directory manifests for `specs/001-*`, `002-*`, `003-*`, `004-*`, `006-*`.)

## Clearance results

Phase 3 checkpoint (T026), 2026-10-15: `.venv/bin/pytest tests/ -q` gives **260 passed**. `tests/test_feature005_boundaries.py` (T005) passes; `docs/visualizer/demo-controller.js` hash is unchanged. The clearance and fit tests are green only because every finding is fixed or allowlisted ("no unrecorded finding", not "no finding"). Raw numbers: `evidence/rot-c05-results.json`.

Minimum clearance per family in the canonical sweep (mm; proposed threshold 0.05 overlap EPS):

| Family | Min clearance | Verdict |
|---|---|---|
| boss | 1.300 | pass |
| clip | 1.300 | pass |
| deck | 0.300 | pass |
| hook | 5.479 | pass |
| hub | 0.300 | pass |
| ledge | 5.521 | pass |
| magnet | 0.900 | pass |
| rod | 4.500 | pass |
| coupler | -2.500 | KNOWN-OPEN (C9) |

KNOWN-OPEN entries (printed by the tests; allowlist `OPEN_CONFLICTS` in `tests/feature005_spec.py`; any change in a number or any new finding fails):

| ID | Check / item | Measured | Decision |
|---|---|---|---|
| C1 | static_stack thrust-ring~central-post#0 | -4.000 | OPEN, viewer rod replaces the canonical post (ASSUMED) |
| C1 | static_stack bearing~central-post#0 | -3.700 | same |
| C4 | housing_wall seat wall to tongue pocket | 0.750 (threshold 0.8) | OPEN, 685ZZ fallback or reinforce |
| C10 | housing_wall hall pocket wall | 0.711 (threshold 0.8) | OPEN, viewer-spec owner |
| R14 | fits M3 pilot wall | 0.700 (threshold 0.8) | OPEN, coupon C-4/C-5 decide |
| C9 | static_stack_viewer coupler~viewer-tray0 (floor) | -2.500 | OPEN, **user decision before ordering the coupler** |
| C9 | static_stack_viewer coupler~viewer-tray3 (back wall) | -4.000 | same |
| C9 | static_stack_viewer coupler~viewer-pocketwall3 | -0.700 | same |
| C9 | canonical_sweep coupler~station-housing#12 | -0.700 | same |
| C9 | canonical_sweep coupler~outlet-tray#0 | -2.500 | same |

C9 options (none applied): coupler OD about 11 mm or less, or an R10 scallop in the tray back wall and floor with a thinned chute wall. C11 (home offset 3.66 deg, not 17.38) is a documentation fix. T016 was N/A (no viewer-spec change).

## Build-document status

Five documents under `build/`, all NOT VALIDATED, result cells blank: `print-list.md`, `bought-parts.md`, `coupons.md` (C-1..C-7), `bench-build-order.md` (steps 1-8), `bench-home-index-test.md` (steps 9-11, ROT-R01..R06 and ROT-C01..C04 mapping, coil release vs holding left OPEN). `tests/test_feature005_build_docs.py` passes (posture strings, no un-negated claim, model values equal `rotation-spec.js`, plan says seven coupons). Plan risks R13, R14, R17, R18 RECORDED; R10, R15, R16 RESOLVED with their proving tests. Readiness items 3-8 stay OPEN (needs physical work: measuring, ordering, printing, building, bench tests).

## Controller harness results

Phase 4 checkpoint (T049), 2026-10-15: standalone `docs/visualizer/rotation-controller.js` (logic only; ASSUMED / NOT_VALIDATED; not wired into the viewer). `.venv/bin/pytest tests/ -q` gives **272 passed** (260 + 12 new in `tests/test_feature005_rotation_controller.py` and `tests/test_feature005_controller_boundaries.py`), 0 failed. The headless `jsc` harness (`tests/browser/feature005/`) records 236 checks, 0 failing: ROT-C01 36, ROT-C02 20, ROT-C03 88, ROT-C04 26, ROT-C06 30, ROT-C07 25, ROT-C08 11; ROT-R01..R06 are listed as "not validated" and never passed.

Harness log SHA-256, run 1 = run 2 (byte-identical): `580b5e4fbe82f4b42e3d995f65691ecbeb8b3b21bfea4e4803ea74c71c723638`.

`docs/visualizer/demo-controller.js` is unchanged: SHA-256 unchanged (boundary test passes), `shasum` (sha1) `0c8396023ca6fc85cb135fbbf58ea39e903cee11`. The adapter case reads its real `snapshot()` shape only; it does not verify the viewer controller.

Not covered (by task design): power loss FR-023/FR-024, pin engagement, gate/dispense cycle, jam faults. The browser page `tests/browser/feature005/index.html` exists and was opened once from `file://` in the integrated browser: 236 checks, 0 failing (same count as `jsc`); desktop/phone viewport and download-link checks remain for Phase 6.

## Full suite (T054)

2026-10-15, `.venv/bin/pytest tests/ -q -rs`: **300 passed, 0 failed, 0 skipped** (226 baseline + 74 Feature 005 tests, including `tests/test_feature005_reserved_volumes.py`, `tests/test_feature005_load_check.py`, `tests/test_feature005_evidence_log.py`). The `jsc`-based controller tests would skip with a stated reason if the macOS `jsc` helper were missing; it is present, so none skipped. Green means "no unrecorded finding": the C9 coupler overlaps and the other KNOWN-OPEN rows above are allowlisted, not fixed.

## Rotation check log (T055)

`evidence/rotation-check-log.json`: harness log (`jsc`, run twice, byte-identical) merged with the nine ROT-C05 records from `evidence/rot-c05-results.json`, in criterion-ID order, ROT-R01..R06 as "not validated". 245 verdict records, **1 fail: ROT-C05 `canonical-sweep:coupler` (observed -2.5 mm, open conflict C9)**; the fail is reported, not relabelled. SHA-256: `e744341cd651db49bcbc3b0b6da7f2a816cdc49ad1db88c14f315cf057b5c4ae`. `tests/test_feature005_evidence_log.py` regenerates and compares it. (The pure harness log hash stays `580b5e4f...723638`, above.)

## Browser results (T056, T057)

2026-10-15, integrated browser (VS Code), `file://`, foreground, no network. Viewports were set with `setViewportSize` to 1280 x 800 and 390 x 844; the browser reported `innerWidth` 1600 and 487, so these are emulated sizes, not real devices.

| Page | Desktop | Phone-sized |
|---|---|---|
| `tests/browser/index.html` | 53 passed, 0 failed | 53 passed, 0 failed |
| `tests/browser/feature004/index.html` | 14 passed, 0 failed | 14 passed, 0 failed |
| `tests/browser/feature005/index.html` | 236 checks, 0 failing | 236 checks, 0 failing |

(The existing page now holds 53 cases, not the 14 named in the task text.) Observation: on the phone-sized viewport the Feature 005 page scrolls horizontally (scroll width 2251 against 487) because of its wide results table; cosmetic, not changed. A download link is present (`blob:` URL); the downloaded file was not compared. **No FPS, WebGL, driver or real-device evidence is claimed; that remains PENDING (needs physical work).** T057: **N/A** (T016 changed no viewer spec, so `rotation-spec.js` is unchanged and the sub-view check was not repeated).

## Boundary re-verification (T061)

`tests/test_feature005_boundaries.py`, `_controller_boundaries.py`, `_plan_consistency.py` and `_build_docs.py` pass (22 tests). The T002 manifest (`evidence/protected-hashes.json`) check inside the boundary test passes: Features 001-004 and 006 spec directories, `.specify/feature.json`, `src/dispenser_sim/viz3d/`, `concept_geometry.json`, `concept-data.js`, `demo-controller.js` are unchanged. The assembly still has 52 parts and 52 distinct component IDs. `demo-controller.js` sha1 `0c8396023ca6fc85cb135fbbf58ea39e903cee11` (unchanged). `rotation-controller.js` is not referenced by `app.js` or `index.html`.

## Deviations

- Controller placement: spec change 2026-10-15; standalone `docs/visualizer/rotation-controller.js`, not `demo-controller.js`; no viewer wiring.
- ROT-C06..C08 added to the harness; coupon C-7 added; FR-031..FR-034 added to the spec.
- C9 (coupler against the viewer tray, tray pocket wall and canonical outlet tray) left OPEN and allowlisted; needs a user decision before the coupler is ordered.
- C1, C4, C10 and R14 are allowlisted, not fixed (rows above).
- Browser viewports are emulated (see above).

## DONE vs DEFERRED ledger (T053)

| Provision | DONE now | DEFERRED, and why |
|---|---|---|
| a Weigh-station corridor and lug slots | Reserved as constraints; `tests/test_feature005_reserved_volumes.py` (hall 1.80, boss 1.10, coupler 0.20 mm clear) | Pad bars, slots, lugs, load cell, lift actuator, W-C1 hook change, W-C2 wall measurement: Feature 006 scope, nothing drawn or printed |
| b Lid hinge and latch interface | Passive drum rule; PROPOSED lid-release keep-out at the latch (test) | Actuator, its reach and any latch redesign: not designed; needs the lid-release feature |
| c Straight-up cartridge lift | Hook 0.8 mm above the ledge; nothing above deck z 21 over a cartridge (test) | Hatch, handle, procedure, clip fatigue: enclosure not designed |
| d Mass and torque | `load_check()` test (125 g worst case, 150 g edge, one third of rating) | Rig measurement (ROT-R03 and related): needs physical work |
| e Controller extension points | Readouts `at_station`, `drum_state`, `sequence_active`, `lift_in_progress` in the standalone controller (tests) | `loaded-state`, `lock-request`, `unlock-request`, `quarantine-flag`, storage, refusal reasons: Feature 006 follow-up; viewer wiring needs user approval |
| f Sub-view pattern | Three sub-views and their spec/view tests | The Feature 006 "Weight verification" sub-view: Feature 006 scope |

## Builder items still OPEN (readiness items 3-8)

Measure-first parts list, parts order, the seven print coupons, printing, bench build, bench home and home-and-index tests: all need physical work, none started, none claimed.

## Statement

**FR-025 and SC-004..SC-008 not met; Feature 005 is not accepted; this phase delivers the design package and standalone controller logic only; the viewer controller is not verified.** Also FR-011..FR-021, FR-023, FR-024 not met; SC-013 not verified. Everything above is ASSUMED / NOT_VALIDATED; `print_ready=false`, `fabricable_as_designed=false`; Constitution I stays ERROR / BLOCKED.

## Requirement-to-evidence table (T063)

Classes: MET-IN-LOGIC = mode (a) logic or geometry check passes (NOT VALIDATED); DOCUMENTED = recorded in documents and checked by document/consistency tests; NOT MET; DEFERRED.

| ID | Class | Proof |
|---|---|---|
| FR-001 | DOCUMENTED | Mode (a) harness exists for rotation only; mode (b) in `build/bench-home-index-test.md` |
| FR-002 | MET-IN-LOGIC | Offline `jsc` runs, byte-identical; `tests/test_feature005_boundaries.py`, `_controller_boundaries.py` |
| FR-003 | MET-IN-LOGIC | Log contract test in `tests/test_feature005_rotation_controller.py` |
| FR-004 | DOCUMENTED | `threshold_label: proposed` in every record |
| FR-005 | MET-IN-LOGIC | ROT-C01 (16 moves) |
| FR-006 | MET-IN-LOGIC | ROT-C02 |
| FR-007 | MET-IN-LOGIC | ROT-C01, ROT-C08 readouts |
| FR-008 | MET-IN-LOGIC | ROT-C03 |
| FR-009 | MET-IN-LOGIC | ROT-C04 |
| FR-010 | MET-IN-LOGIC | ROT-C01 (`red->red`) |
| FR-011..FR-013 | NOT MET | No pin motion or alignment logic exists |
| FR-014 | NOT MET | Only the permission readout in ROT-C08; the pin is not implemented |
| FR-015 | NOT MET | No pin or carriage sequence |
| FR-016..FR-018 | NOT MET | No gate or dispense logic |
| FR-019 | NOT MET | Rotation refusals only (ROT-C03); dispense refusals not implemented |
| FR-020, FR-021 | NOT MET | No cycle, jam, gate or pin fault logic |
| FR-022 | MET-IN-LOGIC (rotation only) | ROT-C07; gate and pin transitions do not exist, so partly evidenced |
| FR-023, FR-024 | NOT MET | No power-loss logic or injection |
| FR-025 | NOT MET | 16 moves done; pin, gate, dispense and power-loss interlocks and refusals not exercised |
| FR-026 | DOCUMENTED | Harness page and log disclosure |
| FR-027 | DOCUMENTED | ROT-R01..R06 "not validated" (`test_physical_criteria_are_never_passed`) |
| FR-028 | DOCUMENTED | Claim-word test on the log; build-doc posture test |
| FR-029 | DOCUMENTED | Scope unchanged; no scanner, lid or electronics work |
| FR-030 | DOCUMENTED | `tests/test_feature005_rotation_view.py` static wiring only; runtime not verified |
| FR-031 | DOCUMENTED | Plan, `build/bench-home-index-test.md`; ROT-C06 logic MET-IN-LOGIC |
| FR-032 | DOCUMENTED | `tests/test_feature005_build_docs.py` |
| FR-033 | DOCUMENTED | Clearance, fit and wall tests with allowlist; C9 finding still OPEN (-2.5 mm coupler) |
| FR-034 | DOCUMENTED | `tests/test_feature005_reserved_volumes.py`, `tests/test_feature005_load_check.py` |
| SC-001 | MET-IN-LOGIC | ROT-C01 |
| SC-002 | MET-IN-LOGIC | ROT-C02 |
| SC-003 | MET-IN-LOGIC | ROT-C03 |
| SC-004..SC-008 | NOT MET | Pin, gate, dispense, power-loss and cartridge-state refusals are not implemented |
| SC-009 | NOT MET (partly) | Missed index covered (ROT-C04); misalignment, pin-retract, gate-close and jam not |
| SC-010 | MET-IN-LOGIC | Two byte-identical runs; `tests/test_feature005_evidence_log.py` |
| SC-011 | DOCUMENTED | Claim-word and boundary tests; suite 300 passed |
| SC-012 | DOCUMENTED | ROT-R01..R06 never passed |
| SC-013 | NOT MET | Static wiring only; runtime toggle and visibility check not run |
| SC-014 | DOCUMENTED | Design package tests pass; C9 stays OPEN |

**Verdict: NOT CONVERGED.** Unmet or only partly evidenced: FR-011..FR-021, FR-023..FR-025, FR-022 (rotation only), SC-004..SC-008, SC-009 (partly), SC-013; open design finding C9. No validation, print-readiness, fabricability or single-dose-integrity claim is made. Physical work (readiness items 3-8, real-device and FPS/WebGL evidence) is outstanding.
