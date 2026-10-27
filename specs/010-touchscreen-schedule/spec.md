# Feature Specification: Touchscreen, Status LED and Dose Schedule (Subsystem 4)

**Feature Branch**: `010-touchscreen-schedule` (spec directory only; the actual Git branch is still
`001-dispensing-mechanism-simulation`, and no branch was created or switched)

**Created**: 2026-10-27

**Status**: Draft — concept-stage acceptance definition; ASSUMED / NOT_VALIDATED

**Input**: User description: "The barcode scanner should be on the housing. Subsystem 4 is for a touch screen
led where the user will input the scheduled time for the pill — this should also be on the housing. Use spec
to design these and include them on the simulation."

> **Scope and posture**: This feature puts a touchscreen and a status LED on the shell of the product, moves
> the barcode reader from a table stand onto the shell, and models a dose schedule (a simulated clock, a list of
> scheduled pills, a DUE prompt and a TAKE tap) in the offline browser viewer. It is concept-level. Every
> number is **ASSUMED / NOT_VALIDATED**. It makes no dose, medication-safety, timing-accuracy, clinical or
> hardware-readiness claim (`print_ready=false`, `fabricable_as_designed=false`). It only calls
> `requestDispense()` on the unchanged, locked demo controller after an explicit tap. Constitution Principle I
> completion remains ERROR / BLOCKED by the recorded zero-/multi-dose violations in the core simulation; this
> feature is not a waiver. Features 001–008 are unchanged, except that the reader position in Features 003 and 007
> moves (see FR-001). Feature 009 provides the verification used here.

## Background (non-normative)

- The reader stood outside the product on the table, 48 mm from the axle plane, on its own foot plate and
  column (Feature 007 support test: "the reader stands outside on the table, not on the product"). The user
  now wants it on the housing, so that decision is replaced.
- The shell is a flask: radius 51 mm outside, 3 mm wall, straight to z = 34 mm then a shoulder, in three 120°
  sectors printed separately. The sectors are 60..180, 180..300 and -60..60 degrees. The jack window is at 90°
  and the cup window at about -2°.
- The viewer's default camera looks at the front (-y). A display at about 255° faces the user and sits in the
  third sector, away from the cup and the jack.

## Clarifications

### Open questions (recorded, not asked; each has an ASSUMED default used below)

| # | Question | ASSUMED default | Where used |
|---|---|---|---|
| Q1 | Real clock or simulated? | Simulated clock in the viewer; the product would use a battery-backed RTC (not designed here). The clock moves only when the user advances it or plays it. | FR-006 |
| Q2 | Does a due dose dispense by itself? | No. The dose becomes DUE; the user taps TAKE. | FR-008 |
| Q3 | Which display? | 2.4 in ILI9341-class TFT with resistive touch, landscape, 60.3 x 42.7 mm module, 49.0 x 36.7 mm active area. | FR-002 |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enter a pill and a time on the housing (Priority: P1)

The user picks a pill colour and a HH:MM time on the touchscreen form and adds it. The entry appears in the
schedule on the screen and in the panel.

**Why this priority**: This is the request for Subsystem 4.

**Independent Test**: Add an entry, see it listed in the panel and on the 3D screen; add an invalid time and see
a clear error.

**Acceptance Scenarios**:

1. **Given** Red and 08:05, **When** Add is pressed, **Then** the entry is listed as PENDING (or DUE if the clock is
   past it by less than 30 minutes).
2. **Given** a time like `25:00` or empty, **Then** the form refuses with `Enter the time as HH:MM`.
3. **Given** the same colour and time already listed, **Then** it refuses as a duplicate.
4. **Given** 8 entries, **Then** a 9th is refused (`the schedule is full`).
5. **Given** a time earlier than the clock by more than 30 minutes, **Then** the entry counts for tomorrow.

---

### User Story 2 - Get a prompt and take the dose (Priority: P1)

When the clock reaches an entry it becomes DUE. The status LED pulses amber, the screen shows `DUE <colour> <time>`
and a TAKE button. A tap on TAKE dispenses that pill if the ring is not EMPTY; the entry becomes TAKEN when the
verification subsystem confirms it, FAILED otherwise.

**Why this priority**: It ties the schedule to the machine and to verification.

**Independent Test**: Load the Red ring, add Red 08:05, advance the clock 5 minutes, press TAKE, watch the dispense.

**Acceptance Scenarios**:

1. **Given** an entry at 08:05, **When** the clock reaches 08:05, **Then** it is DUE and the LED pulses amber.
2. **Given** a DUE entry and a loaded ring, **When** TAKE is pressed, **Then** a dispense starts and the entry is
   TAKING.
3. **Given** the dispense ends VERIFIED, **Then** the entry is TAKEN and the LED is green for about 5 s.
4. **Given** the dispense ends not verified, **Then** the entry is FAILED and the LED is red for about 8 s.
5. **Given** an EMPTY ring, **When** TAKE is pressed, **Then** it refuses with `<colour> ring is EMPTY` and the entry
   stays DUE.
6. **Given** a DUE entry left for more than 30 minutes, **Then** it becomes MISSED and the LED shows red steady.

---

### User Story 3 - The scanner and the screen are on the housing (Priority: P2)

The barcode reader is mounted on the shell by a printed arm and a saddle. The touchscreen pod and the LED bar
are on the front of the shell. Nothing stands on the table except the product's own feet.

**Why this priority**: The user asked for both on the housing.

**Independent Test**: Look at the front and side views; hide the housing and see the pod and the reader arm go
with it.

**Acceptance Scenarios**:

1. **Given** the viewer, **Then** the reader hangs from the shell on an arm whose end reaches into the wall, with no
   foot plate or column on the table.
2. **Given** the housing is hidden or exploded, **Then** the pod follows the wall and the display and LED hide with
   the housing.
3. **Given** Systems switch `Subsystem 4: Touchscreen & LED` is off, **Then** the pod, display and LED hide.

### Edge Cases

- The clock passes midnight: all entries reset to PENDING for the new day.
- The demo controller refuses the request (cap open, busy): the entry returns to DUE with the refusal reason.
- The panel and the 3D screen show the same schedule, clock and ring levels.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The barcode reader MUST be mounted on the shell: a printed arm (8 x 3 mm section) under the reader
  runs to a saddle (4 x 18 x 11 mm) against the wall; both are printed in one piece with the left shell sector.
  `scanner_dx` MUST be -29 mm so the package stage keeps clear of the wall and the reader face stays more than
  8 mm outside it. The foot plate and column MUST be removed.
- **FR-002**: A display pod MUST be printed in one piece with shell sector 3 at 255°: a D-shaped boss from the
  wall (r = 50 mm) out to a flat face at r = 55 mm, 66 mm wide, z = -17..37 mm. The 2.4 in touchscreen sits in its
  face (z = -9..33.7 mm).
- **FR-003**: A 36 x 3 mm RGB status LED bar MUST sit under the screen at z = -14.5..-11.5 mm.
- **FR-004**: The viewer MUST draw the screen contents from live state: clock, play state, next or due dose, up
  to four schedule rows and the four ring levels.
- **FR-005**: The panel MUST provide the same inputs as touch input: pill colour, HH:MM time, Add, Remove, Set clock,
  +1 min, +15 min, +1 h, Play/Pause and TAKE.
- **FR-006**: The clock MUST be simulated and deterministic: it starts at 08:00, moves only on user action or while
  playing (1 simulated minute per real second) and wraps at 24:00.
- **FR-007**: A schedule entry MUST be PENDING, DUE, TAKING, TAKEN, FAILED or MISSED. PENDING becomes DUE at its time
  and MISSED 30 minutes later.
- **FR-008**: A dispense MUST start only from a TAKE tap, never from the clock.
- **FR-009**: TAKE MUST be refused when verification says the ring is EMPTY, the mechanism is busy or the compartment
  is removed, and the entry MUST stay DUE.
- **FR-010**: The LED MUST show: red for 8 s after a dispense that is not verified; red steady while a dose is MISSED
  or FAILED and none is due; amber pulsing while a dose is DUE or TAKING; green for 5 s after a verified dispense;
  dim teal when idle.
- **FR-011**: The schedule holds at most 8 entries, unique by colour and time.
- **FR-012**: Housing hide, transparent, cutaway and exploded modes MUST treat the pod like the wall.
- **FR-013**: There MUST be no randomness, no network time and no storage beyond the page's memory.
- **FR-014**: The ASSUMED pin plan MUST be recorded in plan.md; the wiring window is not changed by this feature.

### Key Entities

- **Clock**: seconds of the simulated day, playing flag.
- **Schedule entry**: id, pill colour, time, status, optional verdict, tomorrow flag.
- **Display pod**, **touchscreen**, **status LED**: printed boss, module and LED bar on the shell.
- **Reader mount**: arm and saddle joining the reader to the shell.

## Success Criteria *(mandatory)*

- **SC-001**: From a fresh load, a user can add Red 08:05, advance 5 minutes, see DUE, press TAKE on a loaded ring and
  see TAKEN, with no console error.
- **SC-002**: The reader arm and saddle pass the support test (every part reaches the base or the table through the
  wall) and the reader face is more than 8 mm outside the wall.
- **SC-003**: With the housing hidden, no pod, display or LED remains.
- **SC-004**: A TAKE on an EMPTY ring never starts a dispense.
- **SC-005**: The schedule code has no `Math.random` and no network access; the Python tests check this.

## Assumptions

- A 2.4 in module fits the flask wall as a flat-faced boss; the 17.5 mm thickness at the pod edge is large and is
  accepted at concept level.
- The product would need a battery-backed real-time clock for real use; it is not designed here.
- Touch is simulated by the panel inputs; clicking the 3D screen does nothing.
