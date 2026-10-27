# Tasks: Touchscreen, Status LED and Dose Schedule (Feature 010)

Concept-level; every item ASSUMED / NOT_VALIDATED. `[x]` = done in the viewer; `[ ]` = not done.

## Phase 1: Spec
- [x] T001 Write spec.md (3 user stories, FR-001..014, SC-001..005)
- [x] T002 Write plan.md (housing layout, schedule logic, LED rules, pin plan, risks)

## Phase 2: Housing
- [x] T010 Reader mounted on the shell: arm and saddle, `scanner_dx` -29, `SCAN_DX` -29, foot plate and column removed
- [x] T011 Update the Feature 007 support test and the Feature 005 reader-distance test
- [x] T012 Display pod printed in shell sector 3 (wall part, hides and explodes with the wall)
- [x] T013 2.4 in module, glass, canvas screen, RGB LED bar
- [x] T014 Systems switch `Subsystem 4: Touchscreen & LED`

## Phase 3: Logic and panel
- [x] T020 `schedule-controller.js`: clock, entries, statuses, tomorrow rule, midnight reset
- [x] T021 Panel section with clock controls, add form, schedule list, TAKE (`subsystem-ui.js`)
- [x] T022 TAKE goes through the verification check and `requestDispense()`; verdict closes the entry
- [x] T023 LED rules (`housing-modules.js`)

## Phase 4: Checks
- [x] T030 `tests/test_feature010_schedule.py`
- [x] T031 Foreground browser run: add entry, advance, DUE, TAKE on a loaded and an empty ring

## Not done (listed for a later feature)
- [ ] T040 Real-time clock and its pins (R5)
- [ ] T041 Wiring window components and pins for the display, touch and LED
- [ ] T042 Print files and shell sector 3 split for the pod (R2)
- [ ] T043 Click-to-touch on the 3D screen
