# Feature Specification: First Subsystem — Rotation, Pin Pinpointing, Gates and Dispensing

**Feature Branch**: `005-first-subsystem-rotation-pin-gates` (spec directory only; the actual Git branch is still the unborn `001-dispensing-mechanism-simulation`, and no branch was created or switched)

**Created**: 2026-10-13

**Status**: Draft — concept-stage acceptance definition; NOT VALIDATED / NOT PRINT-READY

**Input**: User description: "The first subsystem will have different objectives. 1) Successful rotation. 2) Successful pin point to a specific location where the gates are. 3) Successful gates and dispensing."

> **Scope and posture**: This feature defines what "the first subsystem works" means for the portable rotating-drum dispenser concept described in Feature 003: the drum indexing, the vertical pin reaching the single gate location, and the two-gate dispensing cycle. It is the first thing to build and prove. It adds acceptance definitions and, since 2026-10-15, a documented ASSUMED rotation design package (FR-031..FR-034); it adds no canonical mechanism geometry; Feature 003 remains the source of the concept. Every threshold below is **proposed / assumed**, not a validated engineering value. Nothing here claims single-dose integrity, validation, print-readiness, fabricability, or medication/dose safety. Constitution Principle I completion remains ERROR / BLOCKED by the recorded zero-/multi-dose violations in the core simulation; this feature is not a waiver, and a pass here is not a feature-converged or single-dose claim.

## Verification Modes *(read first)*

This subsystem must be verifiable in two distinct ways. They share one set of pass criteria but have different evidence and different strength.

| Mode | When | Evidence | What a pass means |
|---|---|---|---|
| **(a) Simulation check** | Now | Automated pass/fail log produced headlessly from the standalone, deterministic rotation-controller logic (`docs/visualizer/rotation-controller.js`, a new file). The existing viewer controller (`docs/visualizer/demo-controller.js`) is NOT modified and NOT verified by this feature; wiring the new logic into the viewer is deferred. | The standalone rotation-controller logic implements the specified ordering and interlocks. It says nothing about the viewer's own controller, physical tolerance, friction, jams or pill behavior. |
| **(b) Physical rig check** | Later | Pass criteria only (defined here); no rig exists and none is validated by this feature | If and when a rig is built, these are the criteria it must meet. |

Mode (a) is the gating deliverable of this feature. Mode (b) is defined so the same criteria can be reused, but is explicitly **not validated** and not claimed.

> **Deliberate, user-approved spec change, 2026-10-15**: earlier drafts said mode (a) runs on the existing viewer controller. The user forbade editing `docs/visualizer/demo-controller.js`, so mode (a) is now the standalone `rotation-controller.js` logic tested headlessly. This is recorded in the Spec Change Log at the end of this file.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Successful Rotation (Priority: P1)

A builder commands the drum to a color (RED, BLUE, GREEN or ORANGE). The drum turns only when it is safe to turn, stops at exactly that color's station, and the system reports which color is now at the single dispensing station. Repeating the move to any of the four stations, from any other station, ends at the same place each time and never at a neighboring station. If the move is not safe or does not land correctly, it is refused or reported as a fault, never silently accepted.

**Why this priority**: Nothing else in the subsystem is reachable unless the drum reliably brings the chosen cartridge to the one station. Pin placement and dispensing both assume the right cartridge is there.

**Independent Test**: With the pin up and the carriage parked, command each of the four colors from every other starting color (and the same color again) and confirm each ends at the commanded station with the correct color reported. Then attempt rotation while unsafe (pin down, carriage not parked, a gate open, a sequence active) and confirm refusal. Delivers a drum that can be trusted to select a cartridge.

**Acceptance Scenarios**:

1. **Given** the subsystem is parked (pin up, carriage parked, both gates closed) and a color is at the station, **When** a different color is requested, **Then** the drum rotates and ends with exactly the requested color at the station, and the station color readout shows that color.
2. **Given** the subsystem is parked, **When** each of the 16 start-color → target-color combinations (including same color to same color) is commanded, **Then** every one ends at the commanded station, and same-to-same produces no rotation.
3. **Given** the same move is commanded repeatedly, **When** the end position of each repetition is compared, **Then** every repetition ends at the same station position within the proposed repeatability tolerance (SC-002).
4. **Given** the pin is down, or the carriage is not parked, or either gate is not fully closed, or a dispense sequence is active, **When** rotation is requested, **Then** rotation is refused, the drum does not move, and the refusal reason is reported.
5. **Given** a rotation is in progress, **When** a dispense, pin, or gate command arrives, **Then** it is refused or explicitly deferred until the rotation completes and the station is confirmed.
6. **Given** the drum has stopped short of, or beyond, the commanded station by more than the proposed tolerance (a missed index), **When** the move completes, **Then** a missed-index fault is reported, the station is treated as not confirmed, and no pin or gate action is permitted until the drum is re-indexed.
7. **Given** a color is at the station, **When** the readout is inspected, **Then** the color identification is unambiguous and matches the cartridge physically at the station; a position between stations reports "not at a station".

---

### User Story 2 - Successful Pin Pinpointing to the Gate Location (Priority: P2)

From its park position, the carriage carries the vertical pin to the single gate location and lowers it so that it enters the tab slot of the selected cartridge's upper blade — and only that blade's slot. This works for all four stations. The pin never lands on, or drags across, a non-selected blade, and never lowers while the drum is out of position. Pulling the pin outward and returning it to park completes the pin's job.

**Why this priority**: Opening the upper gate depends entirely on the pin landing in the correct slot. It builds on User Story 1 (the right blade must be at the station first) and is required before User Story 3.

**Independent Test**: For each of the four stations, from park with the drum indexed, move the carriage to the gate location and lower the pin, then confirm the pin tip is inside the selected blade's slot within the proposed tolerance, that no other blade's slot was entered, and that the carriage returns to park with the pin raised. Also confirm the pin is refused when the drum is not confirmed at a station. Delivers a pin that reliably finds one specific location.

**Acceptance Scenarios**:

1. **Given** the drum is confirmed at a color's station and the carriage is parked with the pin up, **When** an engage is requested, **Then** the carriage moves to the gate location, the pin lowers, and the pin tip ends inside that color's blade-tab slot within the proposed alignment tolerance (SC-004).
2. **Given** each of the four colors at the station in turn, **When** engage is performed, **Then** the pin reaches the same single gate location every time, and in every case it engages only the selected color's blade.
3. **Given** the pin has engaged the slot, **When** the carriage returns toward park with the pin raised, **Then** the pin clears the slot before any drum motion and the carriage ends parked with the pin up.
4. **Given** the drum is not confirmed at a station (mid-rotation, between stations, or missed index), **When** engage is requested, **Then** the pin does not lower and the refusal reason is reported.
5. **Given** the selected cartridge is absent or empty, **When** engage is requested for it, **Then** the request is refused before any carriage or pin motion, with a reason.
6. **Given** the alignment between pin and slot is outside the proposed tolerance, **When** engage is attempted, **Then** the pin is not lowered into the slot, a misalignment fault is reported, and neither gate moves.
7. **Given** the pin is down, **When** any drum rotation is requested, **Then** it is refused (see User Story 1).

---

### User Story 3 - Successful Gates and Dispensing (Priority: P3)

With the pin engaged, the upper blade opens, one pill drops onto the closed shared lower tongue, the blade closes and separates that pill from the stack, the pin lifts clear, the lower tongue opens so exactly one pill falls through the outlet to the tray, and the tongue closes again. The two gates are never open together, and a request produces one pill — not none, not two. Repeated requests keep doing this without jams or double drops.

**Why this priority**: This is the product's purpose and it depends on the drum (User Story 1) and the pin (User Story 2). It is last because it can only be meaningfully judged once the first two work.

**Independent Test**: Run a long series of consecutive dispense requests across all four colors and log, per request, the gate order, the interlock behavior, the number of pills reaching the tray, and any fault. Confirm the required order, the mutual interlock, and one pill per request. Delivers a gate/dispense cycle that is correct in order and count.

**Acceptance Scenarios**:

1. **Given** a successful pin engagement on a loaded cartridge with all caps closed, **When** the dispense proceeds, **Then** the required order occurs without skips: upper blade opens while the tongue is closed; one pill settles on the closed tongue; the blade returns fully closed; the pin lifts and the carriage parks; only then the tongue opens; the pill clears; the tongue closes.
2. **Given** either gate is moving or open, **When** the other gate is commanded, **Then** the command is refused until the first gate is fully closed; at no time are both gates open or moving together.
3. **Given** a completed request, **When** the pills delivered are counted, **Then** exactly one pill was delivered to the tray.
4. **Given** a series of consecutive requests, **When** they complete, **Then** every request delivered exactly one pill, with zero double drops, zero zero-drops, and zero jams recorded (SC-006).
5. **Given** the cycle completes, **When** the subsystem state is inspected, **Then** both gates are closed, the pin is up, the carriage is parked, and the subsystem is ready for the next request or rotation.
6. **Given** a cartridge is empty or absent, **When** a dispense is requested, **Then** it is refused without any mechanism motion and without changing state.
7. **Given** a dispense is active, **When** another dispense or a rotation is requested, **Then** it is refused or explicitly queued; the active cycle is never altered.
8. **Given** a long frame or timing delay, **When** the cycle resumes, **Then** no state, dwell, or interlock is skipped and no second pill is released.

---

### Edge Cases

- **Power loss mid-cycle**: When power is lost at any point, both gates end closed (each is spring-biased closed), no pill is released after the loss, and the pin ends raised. On restore the subsystem is not treated as ready until it has returned to park and re-confirmed its station; it does not resume a half-finished cycle.
- **Rotation while a gate is open**: Refused. The drum does not move while the upper blade or the lower tongue is open or moving.
- **Rotation while the pin is down or carriage not parked**: Refused with a reason.
- **Empty cartridge / absent cartridge**: Dispense and engage are refused before any motion; counts and state are unchanged.
- **Wrong station**: A request for a color while a different color sits at the station causes a rotation first (User Story 1) — it never engages or opens the blade that happens to be at the station. A pin engage while the station color does not match the selected color is refused.
- **Missed index (short or overshoot)**: Reported as a fault; station not confirmed; no pin or gate action until re-indexed. A bounded number of re-index attempts is allowed before the subsystem reports a hard fault.
- **Pin misalignment**: Pin is not lowered into a slot that is outside tolerance; a fault is reported and no gate moves.
- **Pin fails to retract**: Rotation stays blocked; a fault is reported; no gate motion is allowed.
- **Gate fails to close**: The other gate stays blocked; a fault is reported; no further dispense proceeds.
- **Double drop or no drop detected**: The request is logged as a single-dose violation (a defect, per Constitution Principle I), and the subsystem stops accepting new requests until the condition is cleared. A simulation check never suppresses or relabels such a result.
- **Jam**: A pill that does not clear is reported as a jam fault; the tongue is not re-cycled blindly; the subsystem requires explicit recovery.
- **Cap open**: Dispensing and rotation to a new color are blocked while any cap is open (inherited Feature 003 rule).
- **Simultaneous commands**: Overlapping rotation, engage, dispense, or reset commands are serialized or refused with a reason; they never corrupt an active sequence.
- **Reset while active**: Refused until the subsystem is safe and idle.
- **Unknown or unspecified dimensions** (pin/slot axis assignment, drum angular readout, gate position feedback): Remain explicitly unspecified/assumed; do not invent validated values.

## Requirements *(mandatory)*

### Functional Requirements

#### Verification framing

- **FR-001**: The subsystem acceptance defined here MUST be verifiable in two modes: (a) an automated simulation check using the standalone, deterministic rotation-controller logic (`docs/visualizer/rotation-controller.js`) tested headlessly, producing a pass/fail log (the existing viewer controller `docs/visualizer/demo-controller.js` is NOT modified and NOT verified by this feature; wiring into the viewer is deferred; spec change 2026-10-15); and (b) a later physical rig check defined by pass criteria only. The spec MUST NOT represent either mode as validation of physical hardware, single-dose integrity, or readiness.
- **FR-002**: The simulation check (mode a) MUST run offline and deterministically with no randomness, no network, and no hardware, and MUST NOT modify the Feature 001/002 core simulator, persisted run records, Feature 004's separate subsystem, or the existing viewer controller `docs/visualizer/demo-controller.js` (spec change 2026-10-15).
- **FR-003**: Every pass/fail result MUST be tied to a stated criterion ID, a request/step identifier, the observed value, the proposed threshold, and a pass or fail verdict, in a machine-readable log that a reviewer can re-run and compare.
- **FR-004**: Every threshold in this specification MUST be labeled proposed/assumed in the check output and documentation, and MUST NOT be presented as a validated engineering tolerance.

#### Successful rotation (Objective 1)

- **FR-005**: The subsystem MUST be able to bring each of the four cartridges (RED, BLUE, GREEN, ORANGE) to the one fixed dispensing station from any other station.
- **FR-006**: Each station MUST be reached repeatably: every repeated move to the same station MUST end within the proposed repeatability tolerance of the same position, and every end position MUST be the commanded station, never a neighbor.
- **FR-007**: The subsystem MUST report which color is at the station, and MUST report "not at a station" while the drum is between stations or out of tolerance.
- **FR-008**: Rotation MUST be permitted only when the pin is fully up, the carriage is parked, both gates are fully closed, all caps are closed, and no other sequence is active; otherwise rotation MUST be refused with a stated reason and the drum MUST NOT move.
- **FR-009**: A missed index (end position outside tolerance, or the wrong station) MUST be detected and reported as a fault, MUST leave the station unconfirmed, and MUST block pin and gate actions until the drum is re-indexed.
- **FR-010**: The subsystem MUST NOT accept a rotation request that would be a no-op (same color already at station) as motion; it MUST report it as already at station without moving.

#### Pin pinpointing (Objective 2)

- **FR-011**: From the park position, the vertical pin MUST be able to reach the single gate location and enter the tab slot of the selected cartridge's upper blade, for each of the four stations.
- **FR-012**: The pin MUST engage only the slot of the blade belonging to the cartridge at the station and selected for the request. It MUST NOT enter, touch, or move any non-selected blade.
- **FR-013**: Pin-to-slot alignment at engagement MUST be within the proposed tolerance (SC-004). If it is outside tolerance, the pin MUST NOT be lowered into the slot, a misalignment fault MUST be reported, and no gate MUST move.
- **FR-014**: The pin MUST NOT lower unless the drum is confirmed at a station, the station color matches the selected color, the cartridge is present and non-empty, and both gates are closed.
- **FR-015**: After engagement and the pull, the pin MUST be raised clear of the slot and the carriage returned to park before any drum motion or lower-gate motion.

#### Gates and dispensing (Objective 3)

- **FR-016**: A dispense MUST follow this order with no step skipped: (1) parked, both gates closed; (2) drum indexed to the selected color; (3) pin engaged; (4) upper blade opens while the lower tongue is closed; (5) one pill settles onto the closed tongue; (6) upper blade returns fully closed and holds a brief closed dwell; (7) pin lifts and carriage parks; (8) lower tongue opens and exactly one pill falls through the outlet; (9) clearance dwell; (10) lower tongue closes and the subsystem returns to parked.
- **FR-017**: The two gates MUST obey a strict mutual interlock: the upper blade may move only while the lower tongue is fully closed, and the lower tongue may move only while the selected blade is fully closed. Both gates MUST NEVER be open or moving at the same time.
- **FR-018**: Each dispense request MUST result in exactly one pill delivered to the tray. Zero pills and two-or-more pills are each defects and MUST be recorded as such, never suppressed.
- **FR-019**: The subsystem MUST refuse a dispense request for an empty or absent cartridge, or while any cap is open, or while another sequence is active, before any mechanism motion and without changing state.
- **FR-020**: After any completed cycle, the subsystem MUST be in a defined safe state: both gates closed, pin up, carriage parked, station confirmed.
- **FR-021**: On a jam (pill fails to clear), a gate failing to close, or a pin failing to retract, the subsystem MUST report the specific fault, stop accepting new requests, and require explicit recovery; it MUST NOT blindly re-cycle a gate.
- **FR-022**: Transitions MUST be elapsed-time based and MUST NOT skip a dwell, interlock, or named state after a large time step.

#### Safety on power loss and recovery

- **FR-023**: On loss of power at any point, both gates MUST end closed, no pill MUST be released after the loss, and the pin MUST end raised. After power returns, the subsystem MUST return to park and re-confirm its station before accepting any request.
- **FR-024**: The simulation check MUST include a simulated power-loss event injected at defined points of a cycle and MUST verify FR-023 for each injection point.

#### Evidence, scope and boundaries

- **FR-025**: The simulation check MUST exercise all four stations, all 16 start→target combinations, and every named interlock and refusal listed in this specification.
- **FR-026**: The mode-(a) evidence MUST state clearly that it verifies control logic, ordering and interlocks only, and that jams, double drops, friction, flexure, spring behavior, sensor error and pill behavior are not physically exercised.
- **FR-027**: The mode-(b) physical rig pass criteria MUST be stated in the same terms as mode (a) so a future rig can reuse them, but MUST be labeled NOT VALIDATED and MUST NOT be reported as met until a physical rig is actually built and tested by the team.
- **FR-028**: This feature MUST NOT introduce a medication, dose, single-dose-integrity, validated, print-ready, or fabricable-as-designed claim. Constitution Principle I completion remains ERROR / BLOCKED; no feature-converged claim is made.
- **FR-029**: The scanner, cap/lid unlock, barcode identification, electronics beyond what rotation/pin/gates need, power supply, enclosure, and medication/dose safety MUST remain out of scope (see Out of Scope).

#### Rotation-parts inspection view *(implemented in the viewer 2026-10-15 per the plan; verification evidence not yet recorded)*

- **FR-030**: The visualization MUST offer a "rotation parts only" view option that isolates the rotation subsystem — the drum with its hub and socket decks, the axle/shaft, the bearing, the thrust ring, the coupler, the stepper motor, the stepper mount, the home magnet and hall sensor, the stepper driver board and the controller board — and shows every other part ghosted or hidden. Each isolated part MUST carry a label giving its name and whether it is printed or bought. Switching the option on or off MUST NOT change any controller state, sequence progress or log content. The labels describe sourcing only and MUST NOT be read as a print-readiness, validation or fabricability claim.

#### Design package: home/index reference, builder documents, numeric checks *(added 2026-10-15; documentation and viewer-spec values only)*

- **FR-031**: The rotation design MUST document a home/index reference as an ASSUMED design value: one hall sensor plus one magnet on deck 0, home = the rising edge approached CCW, step counting from home with a calibrated steps-per-revolution, final approach always CCW with an overshoot for CW-needed moves, and a missed-home fault when no home edge arrives within a bounded step count. This documents assumed hardware only; it does not select, procure, validate or build it.
- **FR-032**: The builder-facing documents MUST exist under `specs/005-first-subsystem-rotation-pin-gates/build/`: a print list, a bought-parts list with a measure-before-ordering table, print coupons, a bench build order, and a home/index test procedure. Their result cells MUST be blank or read "not validated — to be measured on a built rig", and they MUST NOT claim print-readiness, validation or fabricability.
- **FR-033**: The assumed rotation geometry in `docs/visualizer/rotation-spec.js` MUST be cross-checked numerically (sweep clearance, static stack overlap, housing wall thickness, fits, home-sensing window). Each finding MUST be recorded as a conflict ID with its measured value, threshold and decision; findings MUST NOT be suppressed, and only values in `docs/visualizer/rotation-spec.js` may be changed to resolve one. Canonical geometry, the 3MF export and the 52 component IDs MUST NOT change.
- **FR-034**: The rotation design MUST keep the Feature 006 provisions checkable as ASSUMED constraints: the reserved weigh-station corridor, a passive (electronics-free) drum, free height above the deck, a rotating mass of at most 150 g, and a motor load of at most one third of the rated torque. These are constraints on the design, not weighing functionality.

### Key Entities

- **Station**: One of four fixed drum positions (RED, BLUE, GREEN, ORANGE) at which a cartridge is presented to the single dispensing location; has an identified color and a confirmed / not-confirmed status.
- **Drum Index Result**: The outcome of one rotation: target color, achieved position, error against the commanded station, and verdict (indexed / missed-index fault / refused).
- **Pin Engagement Result**: The outcome of one engage: selected color, pin-to-slot offset on each axis, tolerance applied, and verdict (engaged / misaligned fault / refused).
- **Gate State**: The state of the upper blade (selected cartridge) and the shared lower tongue — closed / opening / open / closing — together with the interlock status between them.
- **Dispense Cycle Record**: One request, with the ordered step log, pills delivered to the tray, faults, and an overall verdict.
- **Acceptance Log**: The machine-readable collection of criterion results for one check run: criterion ID, step, observed value, proposed threshold, verdict, and the fixed non-readiness disclosure.
- **Proposed Threshold**: A labeled assumed value (tolerance, count, or duration) used for pass/fail, never a validated engineering value.

## Success Criteria *(mandatory)*

All thresholds below are **proposed / assumed** defaults derived from the existing concept documents. They are review defaults, not validated engineering values.

### Measurable Outcomes

- **SC-001**: Each of the four stops (RED, BLUE, GREEN, ORANGE) is reached and correctly identified in 100% of 16 start→target combinations, with zero wrong-station endings.
- **SC-002**: For each station, 10 consecutive repeat moves end within a proposed ±0.5° of the same position (≈0.3 mm at the slot's roughly 35 mm radius from the drum axis; derived, assumed), with zero endings at a neighboring station.
- **SC-003**: 100% of rotation requests issued in an unsafe state (pin down, carriage not parked, a gate open or moving, a cap open, or a sequence active) are refused with a reason and cause zero drum motion.
- **SC-004**: At engagement for every station, the pin-to-slot offset is within the proposed forgiveness of the 5 × 4 mm tab slot for a 3 mm pin (about ±1.0 mm along the 5 mm dimension and about ±0.5 mm along the 4 mm dimension, about 1 mm of slack; which axis is the pull direction is an unresolved source ambiguity), and 100% of out-of-tolerance attempts are refused or faulted with no gate motion.
- **SC-005**: In 100% of dispense cycles the ordered steps of FR-016 occur without skips, and the log never shows both gates open or moving at the same time.
- **SC-006**: Over 100 consecutive dispense cycles distributed across all four colors, the log records 0 double drops, 0 zero drops, and 0 jams; each cycle delivers exactly one pill. (This is a proposed pass check; in mode (a) it verifies control logic only, and in mode (b) it is a criterion only, not a result.)
- **SC-007**: 100% of power-loss injections (at every defined cycle point) end with both gates closed, the pin raised, no pill released after the loss, and the subsystem refusing requests until it has returned to park and re-confirmed its station.
- **SC-008**: 100% of requests against an empty or absent cartridge, with a cap open, or during an active sequence, are refused with a reason and cause zero mechanism motion and zero state change.
- **SC-009**: 100% of missed-index, misalignment, pin-retract, gate-close and jam conditions injected in the simulation produce the specific fault and block further motion until recovery.
- **SC-010**: The mode-(a) acceptance run is repeatable: running it twice with identical inputs produces identical logs, and the log carries the fixed NOT VALIDATED / NOT PRINT-READY disclosure with `print_ready=false` and `fabricable_as_designed=false`.
- **SC-011**: The mode-(a) log and documentation contain zero statements claiming validation, single-dose integrity, readiness, or medication/dose safety, and Features 001–004 and their tests remain unchanged and passing.
- **SC-012**: The mode-(b) physical criteria are written in the same criterion IDs as mode (a), each marked "not validated — to be measured on a built rig", and no mode-(b) criterion is reported as passed anywhere in this feature.
- **SC-013**: When the "rotation parts only" view (FR-030) is on, 100% of the listed rotation parts are visible and labelled with name and printed/bought, and 100% of all other parts are ghosted or hidden; toggling the view on and off, including during an active sequence, leaves the controller state, sequence progress and log output identical to a run in which it was never toggled. (The view is implemented in the viewer per the plan 2026-10-15; `tests/test_feature005_rotation_view.py` statically checks the wiring, the absence of controller changes and the printed/bought labels. The runtime toggle-during-a-sequence check and the 100 % visibility claim are not verified; SC-013 is not claimed as met.)
- **SC-014**: The design package of FR-031..FR-034 exists: the home/index reference and every fit/clearance/home-window finding are recorded with value, threshold and decision, the five builder documents exist with blank result cells, and no document or log claims validation, print-readiness or fabricability. (Tested by the Feature 005 consistency, clearance and document tests; not claimed as met until those tasks are done.)

## Assumptions

- The mechanism concept, names, geometry and fictional demo behavior are those of Feature 003 (four-cartridge rotating drum on a central post, one fixed dispensing station, one upper blade per cartridge, one shared lower tongue, servo-crank-rod-carriage on rails, vertical pin solenoid, direct-drive 28BYJ-48 stepper below the base). This feature does not redefine them.
- "Stage 1" (the first subsystem) means the simulation check in mode (a) is the gating deliverable now; the physical rig (mode b) is later, and only its pass criteria are defined here. No clarification was needed because this reading follows directly from the request and the existing offline-viewer constraint.
- The 5 × 4 mm tab slot for a 3 mm pin and the roughly 1 mm of forgiveness come from Feature 003 and are concept values; the ±0.5° index repeatability and the ±1.0 / ±0.5 mm engagement split are proposed defaults chosen to sit inside that forgiveness and are not validated tolerances.
- The 100 consecutive-cycle, 0-double-drop, 0-jam threshold is a proposed pass check and is not a statistical demonstration of reliability.
- The demo pill is the fictional 10 × 7 × 5 mm assumed pill; it is not a medication specification.
- A power-loss behavior in which both gates close is assumed from the spring-biased-closed gate concept; the de-energized pin position (raised) is also an assumption, not a validated design.
- Simulated fault injection (missed index, misalignment, jam, power loss) is a software test input; real faults and sensor behavior are not modeled by the deterministic rotation-controller logic and remain unvalidated.
- A pass in mode (a) establishes logic, ordering and interlock correctness only. It does not establish that a physical pill will singulate, that a physical gate will close, or that a physical drum will index.
- Existing project posture is preserved: offline, deterministic, no randomness, NOT VALIDATED / NOT PRINT-READY, `print_ready=false`, `fabricable_as_designed=false`, Constitution I blocked, no feature-converged claim.

## Out of Scope

- The barcode scanner and any container identification or placement.
- Cap/lid unlock logic and cap hardware (other than the inherited rule that an open cap blocks rotation and dispensing).
- Selecting, procuring, validating or building real hardware (stepper, driver, sensors, wiring, position-feedback hardware, bearing, coupler). The plan and the builder documents MAY document assumed hardware (for example the hall sensor and magnet of FR-031) as ASSUMED / NOT_VALIDATED, and values in `docs/visualizer/rotation-spec.js` MAY be adjusted (FR-033); no other geometry changes.
- Power supply, battery and charging; enclosure and housing detail beyond the platform pockets documented in the plan; 3MF export and canonical geometry changes.
- Any medication identification, dose, patient-safety, regulatory, or single-dose-integrity claim; resolution of the Constitution I blocker.
- Building, measuring, or validating a physical rig; mode (b) is pass criteria only.
- Changes to Features 001–004, the core simulator, the 2D player, the Feature 003 scanner FSM, Feature 004's separate subsystem lab, or `docs/visualizer/demo-controller.js`.

## Acceptance Status and Spec Change Log

**Acceptance status (2026-10-15)**: Feature 005 is NOT accepted. The current task list delivers only the rotation design package and the standalone rotation-controller logic (User Story 1 parts). FR-011..FR-021, FR-023, FR-024, FR-025 and SC-004..SC-008 are not met and have no task; they are deferred (see tasks.md "Deferred"). SC-009 is covered only for its rotation part. SC-013 is not claimed as met.

**Spec change log**

- **2026-10-15 (deliberate, user-approved)**: mode (a) changed from "the existing viewer controller" to the standalone `docs/visualizer/rotation-controller.js` logic tested headlessly, because `docs/visualizer/demo-controller.js` must never be edited (FR-001, FR-002, Verification Modes, Out of Scope). The viewer controller is not verified by this feature; wiring is deferred.
- **2026-10-15**: FR-031..FR-034 and SC-014 added so the home/index reference, builder documents, numeric checks and Feature 006 reservations (tasks T009–T025, T050–T053 and the homing/calibration work) have a requirement; Out of Scope reworded to allow documenting assumed hardware and adjusting viewer-spec values.
- **2026-10-15**: FR-030 / SC-013 status wording reconciled with the plan (implemented in the viewer, not verified).
