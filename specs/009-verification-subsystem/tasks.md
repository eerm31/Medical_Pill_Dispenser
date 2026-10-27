# Tasks: Verification Subsystem (Feature 009)

Concept-level; every item ASSUMED / NOT_VALIDATED. `[x]` = done in the viewer; `[ ]` = not done.

## Phase 1: Spec
- [x] T001 Write spec.md (3 user stories, FR-001..013, SC-001..005)
- [x] T002 Write plan.md (sensor geometry, logic, pin plan, risks)

## Phase 2: Logic
- [x] T010 `verification-controller.js`: ring levels, free pockets, mismatch debounce
- [x] T011 Dispense verdicts from beam interruptions and count change
- [x] T012 `canDispense` and `canStore` with reasons
- [x] T013 Ring magazine: `queuePocket`, `sense`, `capacity`, `addLabel`

## Phase 3: 3D and panel
- [x] T020 Eight level windows and modules under the floor (`housing-modules.js`)
- [x] T021 Exit break-beam pair and beam
- [x] T022 Systems switch `Subsystem 3: Verification sensors`
- [x] T023 Panel section with rings, beam, last verdict (`subsystem-ui.js`)
- [x] T024 Add-pill buttons use the storage check (`ring-ui.js`)

## Phase 4: Checks
- [x] T030 `tests/test_feature009_verification.py` (sources, ids, clearances, no randomness)
- [x] T031 Foreground browser run: Refill all, level badges, dispense verdict

## Not done (listed for a later feature)
- [ ] T040 Light shafts in the deck layers and the exporter / print files
- [ ] T041 Bench test of one reflective sensor through 6.7 mm of deck
- [ ] T042 Wiring window components and pins for the nine inputs
- [ ] T043 Second beam for small pills (R2)
