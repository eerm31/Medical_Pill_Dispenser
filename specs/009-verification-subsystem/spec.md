# Feature Specification: Verification Subsystem (Subsystem 3)

**Feature Branch**: `009-verification-subsystem` (spec directory only; the actual Git
branch is still `001-dispensing-mechanism-simulation`, and no branch was created or switched)

**Created**: 2026-10-27

**Status**: Draft — concept-stage acceptance definition; ASSUMED / NOT_VALIDATED

**Input**: User description: "Subsystem 3 should be verification system that a pill is successfully
dispensed, a compartment is full, or empty, or if the ring has available pockets to store the SAME
current pill. Use spec to design these and include them on the simulation."

> **Scope and posture**: This feature defines three checks and the sensors that would make them, then
> models them in the offline browser viewer (Prototype 2, the ring magazine) with a small controller and a
> panel. It is concept-level. Every number is **ASSUMED / NOT_VALIDATED**; no part was built, measured or
> tested. It makes no dose, medication-safety, hardware-readiness or print-readiness claim
> (`print_ready=false`, `fabricable_as_designed=false`). It only reads the demo controller (the locked
> `demo-controller.js` is not edited) and does not change the dispensing mechanism. Constitution
> Principle I completion remains ERROR / BLOCKED by the recorded zero-/multi-dose violations in the core
> simulation; this feature detects and reports, it is not a waiver. Features 001–008 are unchanged. Feature 006
> (weight verification) stays parked and is a different, complementary principle.

## Background (non-normative)

- The roadmap listed verification as future reference only. The user asked for it on 2026-10-27, so it is
  now designed at concept level. Feature 006's weight pads are not used here.
- Prototype 2 has four rings, one per pill colour. Each ring has 12 pockets and a queue of up to 5 pills in
  the five pockets before the exit slot (queue pocket 1 is next to the exit). The queue pockets are fixed in
  space; the ring only ever rests with a pocket centred on them, so a sensor looking at a queue pocket sees the
  same place whenever the ring is idle.
- Pills leave through one exit slot into one funnel that ends in the cup window. A falling pill passes the
  funnel in a known place.
- The demo controller already counts pills per cartridge and increments a tray count when a pill reaches
  the tray; it has no sensors.

## Clarifications

### Open questions (recorded, not asked; each has an ASSUMED default used below)

| # | Question | ASSUMED default | Where used |
|---|---|---|---|
| Q1 | Which sensing principle: reflective IR, ToF, weight or camera? | Reflective IR for level, IR break-beam for the exit. Cheap, offline, no firmware vision. | FR-001, FR-002 |
| Q2 | Where do the level sensors sit? | Under the pocket floor looking up through an IR-clear window at queue pockets 1 and 5 of each ring. | FR-001 |
| Q3 | Does the verification stop a dispense? | It refuses a dispense request on an EMPTY ring and refuses a refill that would exceed the ring. It never edits the dispense controller. | FR-006, FR-007 |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Know a pill really came out (Priority: P1)

After a dispense the user sees VERIFIED when exactly one pill crossed the exit beam and the ring count
dropped by one. A dispense where nothing, or more than one pill, crossed is reported as NO PILL or MULTIPLE.

**Why this priority**: Single-dose integrity (Principle I) is the product's core promise; a check that
reports what happened is the first useful step.

**Independent Test**: Load a ring, request a dispense, and read the verdict in the panel and on the
touchscreen LED.

**Acceptance Scenarios**:

1. **Given** a loaded ring, **When** one dispense completes, **Then** the verdict is VERIFIED with 1 pill
   seen and the count shown as `n → n-1`.
2. **Given** a dispense in which the tray count does not rise, **When** it ends, **Then** the verdict is NO PILL.
3. **Given** a dispense in which the tray count rises twice, **When** it ends, **Then** the verdict is MULTIPLE.
4. **Given** the beam is broken, **When** the panel is open, **Then** it shows BEAM BROKEN for about 0.7 s and the
   beam in the 3D view turns white.

---

### User Story 2 - See whether a compartment is full or empty (Priority: P1)

Each ring shows EMPTY, PARTIAL or FULL from two sensors: READY (a pill sits at queue pocket 1) and FULL
(a pill sits at queue pocket 5).

**Why this priority**: The user must know when to refill, and the dispenser must not try to dispense from an
empty ring.

**Independent Test**: Empty and fill rings with the existing refill controls and watch the badges and the
sensor lights in the 3D view.

**Acceptance Scenarios**:

1. **Given** an empty ring, **Then** READY and FULL are both off and the level is EMPTY.
2. **Given** a ring with 1 to 4 pills, **Then** READY is on, FULL is off and the level is PARTIAL.
3. **Given** a ring with 5 pills, **Then** both are on and the level is FULL.
4. **Given** the sensors and the pill count disagree for 400 ms while the mechanism is still, **Then** the ring is
   flagged with a warning and refuses new pills.

---

### User Story 3 - Know the ring can store the SAME pill (Priority: P2)

Before a refill the system checks that the ring of that colour has a free pocket. A FULL ring refuses another
pill of its colour; the check never lets a pill of one colour go into another colour's ring because each
colour has its own ring.

**Why this priority**: It prevents overfilling and protects the one-pill-per-pocket queue.

**Independent Test**: Fill a ring to 5 and try to add another pill of that colour.

**Acceptance Scenarios**:

1. **Given** a ring with k free pockets, **Then** the panel shows `k free · can store <colour>`.
2. **Given** a FULL ring, **When** the user presses that colour's add-one-pill button, **Then** it is disabled with
   the reason `no free pocket (ring is FULL)`.
3. **Given** a compartment removed or sensors disagreeing, **Then** storing is refused with that reason.

### Edge Cases

- A pill is being poured: the sensors see it before the demo controller's count is updated; disagreement is
  not judged while a refill task runs (FR-008).
- Prototype 1 has no ring sensors: levels come from the pill count only and the panel says so by showing the
  same badges without sensor lights.
- A dispense request on an EMPTY ring is refused by the verification check with a reason (FR-006).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each ring MUST have two reflective IR level sensors under an IR-clear floor window: READY at
  queue pocket 1 and FULL at queue pocket 5. (ASSUMED sensor: an 8 x 5 mm reflective module; the 6.7 mm deck
  is a long optical path, so a 4 mm light shaft per sensor is required in the deck; the print files do not have
  it yet.)
- **FR-002**: One IR break-beam pair MUST cross the exit funnel, 6 mm above its floor at x = 44 mm, between the
  two funnel walls.
- **FR-003**: The viewer MUST show the eight windows and sensors, their state (lit green when a pill is over the
  window) and the break-beam (white while broken).
- **FR-004**: A verification controller MUST read the demo controller's snapshot and the sensors, and MUST NOT
  change the demo controller.
- **FR-005**: The level of a ring MUST be EMPTY when READY is off, FULL when FULL is on, otherwise PARTIAL. Free
  pockets MUST be `max - count` (max = 5).
- **FR-006**: A dispense MUST be refused by the verification check, with a reason, when the ring is EMPTY, the
  compartment is removed or the mechanism is busy.
- **FR-007**: A refill of one pill MUST be refused for a ring that is FULL, removed, or flagged.
- **FR-008**: Sensor/count disagreement MUST be judged only while the mechanism and refill tasks are idle and only
  after 400 ms.
- **FR-009**: A dispense verdict MUST be one of VERIFIED, NO_PILL, MULTIPLE or COUNT_MISMATCH, produced when the
  operation ends, from the number of beam interruptions during it and the count change.
- **FR-010**: The panel MUST show the four rings, the beam state, the last verdict and, per ring, free pockets and
  whether the SAME pill can be stored.
- **FR-011**: There MUST be no randomness; the logic MUST be deterministic given the snapshot sequence and the
  clock passed in.
- **FR-012**: A Systems switch MUST show or hide the sensors; the verification MUST work with them hidden.
- **FR-013**: The ASSUMED pin plan MUST be recorded in plan.md; the wiring window is not changed by this feature.

### Key Entities

- **Level sensor**: READY or FULL, one per ring and position, reading present / absent.
- **Ring reading**: colour, count, READY, FULL, level, free pockets, mismatch flag, can-store flag and reason.
- **Dispense run**: colour, count before, interruptions seen; ends with a verdict.
- **Verdict**: VERIFIED / NO_PILL / MULTIPLE / COUNT_MISMATCH, with beams seen and counts before and after.

## Success Criteria *(mandatory)*

- **SC-001**: In a Refill-all then dispense run, every ring shows EMPTY, then PARTIAL, then FULL at the right
  counts and the last dispense reads VERIFIED with 1 pill seen.
- **SC-002**: A FULL ring refuses another pill of its colour with a visible reason, and an EMPTY ring refuses a
  dispense with a visible reason.
- **SC-003**: No sensor/count disagreement warning appears during normal refill or dispense.
- **SC-004**: The viewer shows eight level windows and one break-beam in Prototype 2 and none in Prototype 1.
- **SC-005**: The controller has no `Math.random` and no network access; the Python tests check this.

## Assumptions

- All numbers are ASSUMED. Reflective IR through a 6.7 mm deck, and detecting a standing pill through a floor
  window, are not validated; a real design would need a bench test (see tasks).
- Colour is not sensed: each colour has its own ring, so "the same pill" means the ring of that colour.
- The panel is a design aid, not a medical device display.
