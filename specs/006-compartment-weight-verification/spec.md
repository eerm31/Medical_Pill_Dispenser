# Feature Specification: Compartment Weight Verification

**Feature Branch**: `006-compartment-weight-verification` (spec directory only; the actual Git branch is still the unborn `001-dispensing-mechanism-simulation`, and no branch was created or switched)

**Created**: 2026-10-15

**Status**: Draft — concept-stage acceptance definition; ASSUMED / NOT_VALIDATED

**Input**: User description: "Compartment weight verification for the smart medical dispenser. A planned sub-view of Subsystem 1: confirm that a pill was actually put into a compartment (after a fill) by weighing. All weights involved must be feasibly and easily supported by the rotation."

> **Scope and posture**: This feature defines what "the dispenser can tell, by weight, that a pill was really added to a compartment" means, and the limits any weighing approach must respect so it does not burden the rotating drum. It is software plus concept-level mechanical/electrical requirements only. Every number below is **ASSUMED / NOT_VALIDATED**; no measurement, rig, or physical test backs it. Nothing here claims single-dose integrity, medication or dose safety, accuracy of any real scale, print-readiness, or fabricability. Constitution Principle I completion remains ERROR / BLOCKED by the recorded zero-/multi-dose violations in the core simulation; this feature is not a waiver. Features 001–005 are unchanged and remain the source of the mechanism, drum, scanner and cap concepts.

## Background (non-normative)

- Each compartment is a removable cartridge that sits on a rotating deck plate and is lifted straight up for later cleaning (a separate, later sanitation feature). The drum is driven from below by a small stepper motor through a flexible coupler.
- Per-compartment lids (a later feature) open only after the scanner picks the next available compartment, or for a same-pill refill, and are otherwise locked. Weight verification is the check that closes that loop: after the lid closes, did the compartment really get the pill(s) the user said they added?
- When a compartment becomes empty the system will prompt the user to clean it (a separate, later feature). Weight verification only needs to supply "this compartment is verified loaded / empty-looking"; it does not own that prompt.

## Clarifications

### Session 2026-10-15

| # | Question | Answer (user-accepted recommendation) | Where used |
|---|---|---|---|
| Q1 | Weigh one compartment at a fixed station, or the whole drum at rest? | One compartment at a fixed station decoupled from the drum, using before-fill and after-fill readings on the same compartment so tare and drift cancel. Whole-drum weighing is not used. | FR-003 |
| Q2 | Minimum detectable pill mass? | About 0.5 g reliably for the first version; detecting a single 0.1 g pill is a goal, not a requirement. Lighter pills are verified by total added mass against declared count times expected mass. | FR-006, A-004 |
| Q3 | Behavior on a failed verification? | Too little added mass: bounded retry with a prompt, then lock and log. Too much or wrong mass: lock immediately, flag the compartment, and require cleaning and a supervised reset before reuse. | FR-010, FR-025 |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Confirm a Pill Was Really Added After a Fill (Priority: P1)

A user fills a compartment with one or more pills and closes its lid. The system compares the compartment's weight after the lid closes with its weight before the fill and reports one clear outcome: the added mass is consistent with the number of pills the user declared (verified), or it is not (not verified). The user sees the outcome and the compartment's recorded loaded state is updated only when verified.

**Why this priority**: This is the entire point of the feature. Without it, a compartment can be recorded as loaded when nothing (or the wrong amount) was put in, and the later dispense logic would act on a false count.

**Independent Test**: Using a simulated weight source with fictional fixture masses, run a before-weight, a fill of N declared pills, a lid-close event, and an after-weight for each of the four compartments. Confirm the outcome is "verified" when the added mass matches N pills within tolerance and "not verified" otherwise, and that the stored loaded state changes only on "verified". Delivers a trustworthy loaded-state signal.

**Acceptance Scenarios**:

1. **Given** a compartment with a recorded before-weight and a lid that has just closed, **When** the after-weight shows an added mass within tolerance of the declared pill count times the expected pill mass, **Then** the system reports "verified" and records the new loaded state and count.
2. **Given** the same setup, **When** the added mass is below the verified range (for example no pill, or fewer pills than declared), **Then** the system reports "not verified — less than declared" and does not record the new loaded state.
3. **Given** the same setup, **When** the added mass is above the verified range (for example more pills than declared, or a foreign object), **Then** the system reports "not verified — more than declared" and does not record the new loaded state.
4. **Given** a compartment whose lid has not closed, **When** a verification is requested, **Then** the request is refused with a reason, and no weighing result is accepted as a verification.
5. **Given** a compartment is verified, **When** the user inspects the status, **Then** the recorded pill count, the before and after weights, the added mass, and the outcome are visible.

---

### User Story 2 - Weighing Never Overloads or Complicates the Rotation (Priority: P1)

A builder reviews the weighing approach and the rest of the drum design against the rotation limits. Whatever weighing arrangement is used, the rotating mass stays within its budget, the torque the motor must supply stays within its margin, no electronics or wiring ride on the rotating drum, and a compartment can still be removed by lifting straight up. Adding weighing does not make the first subsystem (rotation, pin, gates) harder to build or less likely to work.

**Why this priority**: The user's explicit requirement is that all weights be feasibly and easily supported by the rotation. A weighing method that adds load, wiring or removal obstacles defeats the portable design, so this is a gate on the approach, not an afterthought.

**Independent Test**: Run the rotation-budget check (mass, torque margin, rotating electronics, removability) against the weighing arrangement. Confirm all four limits pass at each loading level: empty, 20 pills, and four compartments of 13 pills. Delivers a pass/fail verdict on whether the weighing method is acceptable to the drum.

**Acceptance Scenarios**:

1. **Given** the drum at its heaviest assumed loading (four compartments of 13 pills), **When** the total rotating mass is computed with the weighing arrangement included, **Then** it is at or below the design mass budget (A-001).
2. **Given** each loading level (empty, 20 pills, four compartments of 13 pills), **When** the torque required to hold and index the drum is computed with the weighing arrangement included, **Then** it is at or below the allowed fraction of the motor's rated torque (A-002).
3. **Given** the weighing arrangement, **When** its parts are listed by whether they rotate with the drum, **Then** no sensor, electronics, or wiring is on the rotating drum.
4. **Given** the weighing arrangement, **When** a compartment removal is attempted by lifting straight up, **Then** nothing added for weighing blocks or binds the lift.
5. **Given** the weighing arrangement adds any new load path between the compartment and the frame, **When** the drum is rotating, **Then** that path carries no load during rotation and does not add torque beyond the budget (it is decoupled from the drum while the drum turns).
6. **Given** any check above fails, **When** the result is reported, **Then** the weighing arrangement is reported as "not acceptable to the rotation" with the failing limit named.

---

### User Story 3 - Handle a Failed or Doubtful Verification (Priority: P2)

When the weight result does not match what the user declared — wrong amount, noisy reading, disturbed compartment — the system does not quietly accept it. It tells the user what happened, keeps the compartment's recorded state safe, and gives the user a defined way forward.

**Why this priority**: A verification that only works when everything goes right is not a safeguard. The failure path decides whether a bad fill can enter the dispensing flow, but it builds on the P1 happy path, so it comes after.

**Independent Test**: Feed the simulated weight source each failure case (too little, too much, unstable reading, drum moving, compartment removed mid-weigh) and confirm each gives a distinct reported outcome, no recorded loaded state change, and the defined follow-up behavior. Delivers a safe, explainable failure path.

**Acceptance Scenarios**:

1. **Given** a verification fails (too little or too much added mass), **When** the result is reported, **Then** the compartment's recorded loaded state is unchanged, and the system follows the failure behavior in FR-010: a bounded retry request for too little mass, and a lock-and-flag request for too much or wrong mass.
2. **Given** the weight reading is unstable (does not settle within the allowed settling time), **When** verification is attempted, **Then** the result is "not verified — reading unstable" and is not treated as too little or too much.
3. **Given** the drum is rotating, or a compartment is being lifted out, or the unit is knocked or moved, **When** a weight reading is taken, **Then** the reading is discarded and verification is deferred until the condition clears.
4. **Given** the compartment is missing when a verification is requested, **When** the system checks, **Then** it reports "compartment absent" and does not produce a weight outcome.
5. **Given** several consecutive failed verifications on one compartment, **When** the count reaches a stated limit, **Then** the system reports a repeated-failure condition rather than silently retrying forever.

---

### User Story 4 - See Weight Verification in the Viewer (Priority: P3)

A builder opening the existing offline viewer picks a new "Weight verification" sub-view of the first subsystem next to Rotation mechanism, Stepper mount, and Compartments & decks. It shows where weighing happens, the before/after weights and outcome for a simulated fill, and the rotation-budget numbers (mass, torque margin) so the user can see why the weighing arrangement is acceptable.

**Why this priority**: The roadmap places weight verification as a viewer sub-view, but the verification logic and the budget check stand on their own; the view only presents them.

**Independent Test**: Open the viewer, choose the sub-view, and run a simulated fill. Confirm the weighing location, weights, outcome, and budget figures appear, labeled ASSUMED / NOT_VALIDATED, and that the other sub-views behave as before.

**Acceptance Scenarios**:

1. **Given** the viewer is open, **When** the Weight verification sub-view is selected, **Then** it appears alongside the existing sub-views and the other sub-views are unchanged.
2. **Given** the sub-view is open, **When** a simulated fill is run, **Then** the before-weight, after-weight, added mass, declared count, and outcome are shown.
3. **Given** the sub-view is open, **When** the rotation-budget panel is read, **Then** it shows total rotating mass and torque margin at each loading level with their budget limits, and every number is labeled ASSUMED / NOT_VALIDATED.
4. **Given** the sub-view is open, **When** the user inspects any claim, **Then** nothing states or implies validated accuracy, dose safety, or print-readiness.

---

### Edge Cases

- A pill is added but sticks to the lid or the rim and never reaches the weighed mass; the reading looks like "none added".
- Two lightweight pills versus one heavier pill within the assumed 0.1–1.5 g range can have the same total mass; the count the system reports is an inference from mass, not an observation.
- A compartment is lifted out for cleaning and put back, shifting its seating or weight reading slightly.
- Moisture, powder, tablet debris or a dropped coating changes mass slightly without any pill being added.
- A different compartment is verified than the one the user filled (wrong compartment index).
- The user closes the lid with no fill at all, or removes pills after a verified fill (the weight goes down with no dispense).
- The reading drifts with temperature or time between before and after weights.
- The unit is on an uneven or unstable surface, or is carried, during weighing.
- A verification request arrives while a rotation, pin, or gate sequence from Feature 005 is active.
- Power is lost between the before-weight and the after-weight; the pending verification must not be mistaken for a completed one.

## Requirements *(mandatory)*

### Functional Requirements

**Weighing and verification**

- **FR-001**: The system MUST determine, for each of the four compartments, the weight-based outcome of a fill: verified, not verified (less than declared), not verified (more than declared), not verified (reading unstable), or compartment absent.
- **FR-002**: The system MUST compare a before-fill weight with an after-fill weight taken once the compartment's lid has closed, and derive the added mass from the two.
- **FR-003**: The system MUST weigh one compartment at a time at a single fixed weighing station that is decoupled from the drum (for example a lift pad or load cell the compartment is moved onto), taking the before-fill and after-fill readings on the same compartment at the same station so tare and drift cancel. Whole-drum weighing MUST NOT be used for verification. The station is reserved at the fill position; its mechanical arrangement is left to planning.
- **FR-004**: The system MUST compare the added mass with the declared pill count multiplied by the expected pill mass and accept it only within a stated tolerance (A-004).
- **FR-005**: The system MUST record a compartment as loaded (and update its pill count) only on a "verified" outcome, and MUST leave the recorded state unchanged on every other outcome.
- **FR-006**: The system MUST reliably resolve a change in compartment mass of at least the resolution floor of 0.5 g (A-004). Detecting a single 0.1 g pill is a goal, not a requirement. For pills lighter than the floor, the system MUST verify by the total added mass against the declared count times the expected pill mass instead of per pill.
- **FR-007**: The system MUST refuse to accept a weight reading as a verification while the drum is rotating, a compartment is being lifted out, a lid is open, or a Feature 005 pin/gate sequence is active, and MUST discard any reading taken during those conditions.
- **FR-008**: The system MUST require a weight reading to settle within a stated settling time (A-005) before using it, and MUST report "reading unstable" rather than guess if it does not settle.
- **FR-009**: The system MUST report the compartment, declared count, before-weight, after-weight, added mass, outcome, and reason for every verification, in a form a person can read.
- **FR-010**: On a "not verified" outcome the system MUST emit exactly one follow-up request: for "less than declared", a bounded retry request with a user prompt (up to the retry limit A-006, then a lock-and-log request); for "more than declared" or a foreign mass, a lock request and a quarantine flag (FR-025); for "reading unstable", a re-read request with no state change. This feature emits the requests only; acting on them belongs to the later lid-control feature (FR-014).
- **FR-011**: The system MUST NOT mark a compartment verified from a weight reading alone when the lid was not confirmed closed after the fill.
- **FR-012**: The system MUST treat a loss of power or a restart between the before-weight and after-weight as an incomplete verification, never as a completed one.
- **FR-013**: The system MUST report a repeated-failure condition after a stated number of consecutive failed verifications on one compartment (A-006).
- **FR-014**: The system MUST keep weight verification independent of the dispense workflow of Features 004/005: it MUST NOT open, close, lock, or unlock any lid or gate by itself in this feature, and MUST NOT alter the dispensing sequence.

**Rotation-load limits (gate on the weighing approach)**

- **FR-015**: The weighing arrangement MUST NOT add mass or load paths such that the total rotating mass exceeds the rotating-mass budget (A-001) at any loading level.
- **FR-016**: The weighing arrangement MUST NOT cause the torque the motor must supply, to hold or index the drum, to exceed the allowed fraction of the motor's rated torque (A-002) at any loading level.
- **FR-017**: The weighing arrangement MUST NOT place any electronics, sensors, or wiring on the rotating drum.
- **FR-018**: The weighing arrangement MUST leave removal of every compartment by lifting it straight up possible, with no added part blocking or binding the lift.
- **FR-019**: Any load path added for weighing MUST carry no load, and MUST add no friction or torque, while the drum rotates.
- **FR-020**: The system MUST evaluate FR-015 through FR-019 at three loading levels — empty, one compartment with 20 pills, and four compartments of 13 pills each — and report pass/fail with the failing limit named.

**Presentation and honesty**

- **FR-021**: The viewer MUST present Weight verification as a sub-view of the first subsystem alongside the existing sub-views, without changing the existing sub-views, and MUST work offline from a local file.
- **FR-022**: Every numeric value, outcome and claim shown MUST be labeled ASSUMED / NOT_VALIDATED, and the feature MUST NOT state or imply validated accuracy, dose safety, single-dose integrity, print-readiness, or fabricability.
- **FR-023**: Simulated weight data MUST be deterministic and reproducible (explicit fixtures and seeded variation only), and MUST use fictional fixture values.
- **FR-024**: The feature MUST NOT modify Features 001–005, and MUST NOT change the 52 component IDs of Feature 005 as a side effect.
- **FR-025**: After a "more than declared" or foreign-mass outcome the system MUST mark the compartment quarantined, MUST keep it from being treated as loaded or dispensable, and MUST require it to be emptied and cleaned and then reset by a supervised action before it can be verified or used again.

### Key Entities *(include if feature involves data)*

- **Compartment**: One of four removable cartridges (RED, BLUE, GREEN, ORANGE). Has a recorded loaded state, pill count, and last verified weight.
- **Weight Reading**: A single mass measurement with the compartment it applies to, a settled/unstable status, and the conditions under which it was taken (drum still, lid state).
- **Verification Record**: Before-weight, after-weight, added mass, declared pill count, expected added mass, outcome, reason, and time. Created per fill; changes the compartment's loaded state only when verified.
- **Weighing Arrangement**: The concept-level choice of how mass is measured (see FR-003), with its added mass, whether it rotates, and what load path it adds.
- **Rotation Budget**: The limits (rotating mass, torque margin, no rotating electronics, straight-up removability) and the computed values at each loading level, each with pass/fail.
- **Loading Level**: One of empty, one compartment with 20 pills, four compartments of 13 pills.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across a fixture set of at least 40 simulated fills (including all four compartments, 1–13 declared pills, and matching, short, and excess cases), 100% produce the outcome the fixture expects, and 0 change a compartment's loaded state on a "not verified" outcome.
- **SC-002**: For every simulated fill that is a clean match, the reported added mass is within the stated tolerance (A-004) of the expected mass in 100% of cases, and the three failure classes (short, excess, unstable) are never confused with each other.
- **SC-003**: Zero readings taken while the drum is rotating, a lid is open, a compartment is being lifted, or a pin/gate sequence is active are accepted as a verification in the fixture set.
- **SC-004**: At each of the three loading levels, the rotation-budget check reports total rotating mass at or below the budget and torque at or below the allowed fraction of motor rated torque, for the chosen weighing arrangement, with the numbers visible to a reader.
- **SC-005**: The rotation-budget check reports "no electronics or wiring on the rotating drum" and "straight-up compartment removal unobstructed" as pass for the chosen weighing arrangement, and reports fail (with the named limit) for a deliberately non-compliant test arrangement.
- **SC-006**: A reviewer can open the viewer, select the sub-view, run a simulated fill, and read the before-weight, after-weight, outcome, and budget figures in under 2 minutes without help.
- **SC-007**: 100% of numeric values and claims in the sub-view and in this feature's artifacts carry an ASSUMED / NOT_VALIDATED label, and no artifact states validated accuracy, dose safety, or print-readiness.
- **SC-008**: Existing tests and artifacts for Features 001–005 are unchanged and still pass, with the 52 component IDs of Feature 005 unchanged.
- **SC-009**: In the fixture set, every "more than declared" outcome produces a lock request and a quarantine flag and never a retry or unlock request; every "less than declared" outcome produces at most the allowed number of retry requests (A-006) and then a lock-and-log request.
- **SC-010**: Every fixture pill whose mass is below the 0.5 g floor is verified by total added mass, and none is reported as verified per pill.

## Assumptions

All values below are **ASSUMED / NOT_VALIDATED**; they come from a concept-level feasibility analysis, not from measurement. They belong in the plan and later research as budgets to re-check, not as facts.

**Rotation budget (constraints on the weighing approach)**

- **A-001**: Rotating mass budget: total rotating mass MUST stay at or below **150 g** (design mass). Assumed figures: about 73 g empty, about 93 g with 20 pills at 1 g, about 125 g with four compartments of 13 pills at 1 g. The weighing arrangement counts against the remaining margin (about 25 g at the heaviest loading); a method that adds rotating mass beyond that margin is not acceptable.
- **A-002**: Torque margin: the torque required to hold and index the drum MUST stay at or below **one third of the motor's rated torque**. For the assumed 28BYJ-48 class stepper, rated torque is about **34 N·mm**, so the limit is about **11 N·mm**. Assumed demand: thrust-ring friction torque 0.7–2.3 N·mm and acceleration torque under 0.5 N·mm for a 90° index in 0.5 s, which is roughly a 15× margin to rated torque before any weighing hardware is added.
- **A-003**: Supporting stresses (assumed): thrust-ring pressure about 0.01 MPa; deck cantilever stress about 0.5 MPa at about 0.2 N per deck. A weighing arrangement MUST NOT materially increase either.

**Weighing performance (proposed, subject to clarification)**

- **A-004**: Resolution floor **0.5 g** for the first version (Q2). Verified tolerance: added mass within **±20% of the expected mass, or the 0.5 g floor, whichever is larger**. Detecting a single 0.1 g pill is a goal for later, not a requirement.
- **A-005**: Settling time: a reading must settle within **3 s** of the last disturbance (lid close, compartment seating) before it is usable.
- **A-006**: Retry limit: **3** consecutive "less than declared" verifications on one compartment, after which the system requests a lock and logs the failure.
- **A-007**: Pill mass range: **0.1–1.5 g** per pill; 1 g is used for loading-level figures. A single fixed expected pill mass per compartment is declared by the user or fixture.

**Scope and structure**

- **A-008**: Pills fill compartments by the user dropping them in at the fill position; the mass check is the only confirmation this feature provides. The system infers count from mass and does not observe the pill itself.
- **A-009**: Lid locking, scanner-driven lid release, and empty-compartment cleaning prompts are separate, later features. This feature only reads their states (lid closed, compartment present) through simulated inputs and neither commands them nor depends on their implementation.
- **A-010**: The weighing arrangement is a concept-level choice (Q1) that must satisfy the rotation limits; no physical scale, load cell, amplifier, or calibration is selected or validated here.
- **A-011**: Four compartments, color labels, and the drum/deck/hub concept (625ZZ bearing, PTFE thrust ring, flexible coupler, 5 mm rod, stepper below the base) are inherited from Features 003 and 005 and treated as given.
- **A-012**: Verification runs while the drum is at rest at a station (Feature 005 confirmed station), not during rotation.
- **A-013**: The viewer uses the existing offline, file-based, no-network approach of Feature 003; the sub-view reads fictional fixtures and shares no state with Feature 003's scanner demo or Feature 004's subsystem lab.
- **A-014**: Out of scope: real load cell selection, calibration, temperature compensation, regulatory or clinical claims, dose-safety claims, and any physical build or test.
