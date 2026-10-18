# Feature Specification: Cylindrical Product Layout

**Feature Branch**: `007-cylindrical-product-layout` (spec directory only; the
actual Git branch is still the unborn `001-dispensing-mechanism-simulation`, and
no branch was created or switched)

**Created**: 2026-10-17

**Status**: Draft — concept-stage acceptance definition; ASSUMED / NOT_VALIDATED

**Input**: User description: "Do you think we can make the entire shape
cylindrical without changing much of the mechanism?" Then, after a first attempt
that only wrapped a 242 mm cylinder around the unchanged layout: "that's not
what I meant. You can rearrange the placements but don't change the mechanism so
much. The product can be cylindrical?" Also: the machine looks unstable and the
servo unit is unsupported (floating).

> **Scope and posture**: This feature defines a compact, round product layout
> for the existing concept. It rearranges only passive and support placements and
> leaves the mechanism as it is. It is concept-level, offline and viewer/export
> only. Every number below is **ASSUMED / NOT_VALIDATED**; no print, measurement
> or physical test backs it. The layout is `print_ready=false` and
> `fabricable_as_designed=false`, and every artifact it produces MUST say so.
> Nothing here claims single-dose integrity, dose or medication safety, or
> hardware readiness. Constitution Principle I completion remains ERROR /
> BLOCKED by the recorded zero-/multi-dose violations in the core simulation;
> this feature is not a waiver. Features 001–006 are unchanged.

## Background (non-normative)

- The drum carries four cartridges at 90° steps, so the rotating part is already
  round. The drum axis is at x=0, y=15 (axes: x right, y depth/back, z up, mm).
- Everything that makes the machine wide sits outside the drum, on one radial
  line pointing to the front (-y): the pin carriage on its rails, the connecting
  rod, the servo crank and servo unit, the shared tongue with its actuator rod,
  pull solenoid, return spring and fixed bracket. The servo unit (body about
  y -71.2 to -48.2, z 16.5 to 39.2) has nothing under it in the canonical model.
- Passive items sit to the side: the scanner housing (x -47.7, z 25–35), the
  electronics deck (38 × 140, x 22..60, y -82..58) and the controller board
  (27.9 × 54.4). The deck corner is 114 mm from the axle, the farthest item.
- Farthest reach from the axle with nothing moved: tongue rod end 98.7 mm,
  servo 86 mm, return bracket 85 mm, deck corner 114 mm. A shell around the
  unchanged layout needs about 242 mm across. The user rejected that as too big
  and as missing the point: the layout itself must be rearranged.
- Feature 005 already has viewer-only parts from that first wrap-around attempt
  (levelling base with three feet, 3 mm shell in three 120° sectors, servo
  shelves, web, bracket lugs). They are ASSUMED and are a starting reference,
  not a constraint.

## Clarifications

### Open questions (recorded, not asked; each has an ASSUMED default used below)

| # | Question | ASSUMED default used in this spec | Where used |
|---|---|---|---|
| Q1 | May the two straight chains (servo–crank–rod–carriage and tongue–actuator rod–solenoid) be folded or shortened if that would shrink the enclosure below the unfolded limit? | No. Folding or shortening changes the mechanism, which the user wants to avoid. | FR-004, FR-005, A-003 |
| Q2 | Must the enclosure be concentric with the drum axle, or may it be offset toward the front so the drum sits to the rear of centre? | Concentric. The drum stays at the centre and the target is about 205 mm. | FR-006, SC-001 |
| Q3 | Must the cylindrical layout be selectable alongside the original layout in the viewer, or may it replace it? | Selectable alongside; the original layout and its outputs stay available and unchanged. | FR-012, SC-006 |

[NEEDS CLARIFICATION: Q1 — is folding/shortening either straight chain acceptable if it allows a smaller enclosure?]

[NEEDS CLARIFICATION: Q2 — concentric enclosure (about 205 mm) or an offset enclosure that could be about 130–140 mm but puts the drum off-centre?]

[NEEDS CLARIFICATION: Q3 — selectable alongside the original layout, or replace it?]

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the Whole Machine as One Compact Round Product (Priority: P1)

A user opens the cylindrical layout and sees one round enclosure around the
drum. Every part (mechanism, electronics, scanner, tray, supports) is inside it.
Nothing hangs out to the side or front. The mechanism looks and moves the same as
in the original layout.

**Why this priority**: This is the request. A cylindrical product that only
wraps the old layout was already rejected; the value is in the compact
rearrangement.

**Independent Test**: Load the cylindrical layout, compute the bounding extent of
every component about the drum axle, and play the existing demo. Confirm that
every component lies inside the stated enclosure diameter and that the demo shows
the same steps.

**Acceptance Scenarios**:

1. **Given** the cylindrical layout is selected, **When** the extent of every
   component is measured about the enclosure axis, **Then** no component, in any
   demo state, extends past the enclosure's inside wall.
2. **Given** the cylindrical layout is selected, **When** the user views it from
   the top, **Then** the outline is a single circle with only the scanner slot
   and tray window as openings.
3. **Given** the cylindrical layout, **When** the demo runs through scan, cap
   open, fill, index, dispense, **Then** every step matches the original layout's
   step order and timing.
4. **Given** the overall outside diameter, **When** it is compared with the
   rejected 242 mm wrap, **Then** it is smaller by at least the target in SC-001.

---

### User Story 2 - Mechanism Stays the Same (Priority: P1)

A reviewer compares the cylindrical layout with the original. The drum,
cartridges, blades, caps, pin carriage with servo crank-slider, shared tongue
with solenoid and return spring, stepper indexing and demo state machine are the
same in geometry, stroke, timing and behaviour. Only where the passive and
support parts sit has changed.

**Why this priority**: The user's second message set this as the main
constraint. Without it the feature is a redesign, not a re-layout.

**Independent Test**: Compare each mechanism component's pose relative to the
drum axle and to its neighbours, and each stroke and timing value, between the two
layouts. Confirm they match within the tolerance in SC-002.

**Acceptance Scenarios**:

1. **Given** both layouts, **When** the relative pose of every mechanism
   component is compared, **Then** differences are zero within tolerance, apart
   from a rigid rotation or move of the whole mechanism as one unit.
2. **Given** both layouts, **When** the pin stroke, tongue travel, indexing step
   angle and every demo timing value are compared, **Then** they are identical.
3. **Given** the cylindrical layout, **When** a part would have to change its
   own geometry or position relative to its mechanism neighbours to fit,
   **Then** the layout is rejected for that part, and the part is recorded as a
   blocker rather than modified.

---

### User Story 3 - Nothing Floats and the Machine Stands Stable (Priority: P1)

A reviewer checks the support story. The servo unit, the pull solenoid and the
tongue-return bracket each rest on or hang from a named support that is part of
the structure and traces back to the base. The machine rests on three feet 120°
apart and its centre of mass, with all moving parts at any position, stays inside
the triangle the feet make with a margin.

**Why this priority**: Both the "unstable" and the "floating servo" remarks were
explicit complaints about the existing model.

**Independent Test**: Run a support-connectivity check over all static parts and
a centre-of-mass check over the ASSUMED mass table with the drum, carriage and
tongue at their extreme positions.

**Acceptance Scenarios**:

1. **Given** the cylindrical layout, **When** the connectivity check runs,
   **Then** every static component has a continuous chain of contacting support
   parts to the base, and the servo unit, solenoid and return bracket each name
   their support.
2. **Given** the three feet at 120°, **When** the centre of mass is computed for
   every extreme combination of drum position, carriage and tongue, **Then** its
   ground projection stays inside the foot triangle by at least the margin in
   SC-004.
3. **Given** the machine, **When** a tilt of the stated angle is applied in the
   worst direction, **Then** the centre-of-mass projection is still inside the
   foot triangle.
4. **Given** a component that cannot be supported without moving a mechanism
   part, **When** the check runs, **Then** it is reported as a blocker and not
   hidden.

---

### User Story 4 - Original Layout and Outputs Stay Untouched (Priority: P2)

A user who prefers the existing look, or a script that depends on the existing
exports, sees no change. The cylindrical layout is a separate variant that does
not alter the original canonical data or its exports.

**Why this priority**: Features 001–006 and the 52 canonical component IDs must
not be disturbed; a variant keeps them safe.

**Independent Test**: With the cylindrical layout not selected, regenerate the
existing viewer data and 3MF export and confirm they are identical to before.

**Acceptance Scenarios**:

1. **Given** the cylindrical layout is not selected, **When** the existing
   viewer and export are produced, **Then** they are byte-identical to the
   pre-feature output.
2. **Given** the cylindrical layout is selected, **When** the component list is
   read, **Then** exactly the 52 canonical Feature 003 component IDs are present,
   none renamed, none dropped.
3. **Given** the viewer, **When** the user switches between layouts, **Then** the
   demo state resets cleanly and no state leaks between layouts.

---

### User Story 5 - Honest Status Disclosure (Priority: P3)

Anyone viewing or exporting the cylindrical layout can see that it is a concept:
NOT VALIDATED, NOT PRINT-READY, not fabricable as designed.

**Why this priority**: Project rule; must hold for every new artifact.

**Independent Test**: Open the viewer layout and any export of it and look for
the disclosure and the two flags.

**Acceptance Scenarios**:

1. **Given** the cylindrical layout is shown or exported, **When** its status is
   read, **Then** it states `print_ready=false`, `fabricable_as_designed=false`
   and that every value is ASSUMED / NOT_VALIDATED.

---

### Edge Cases

- A passive part (for example the 38 × 140 deck) cannot fit inside the circle in
  one piece: it may be re-outlined or split into sectors only if its usable area
  and the controller-board footprint are preserved; otherwise it is a blocker.
- The straight tongue chain sets the radial limit, so the deck and board must
  go in the area the chain leaves free, not past its end.
- The scanner can no longer sit outside the housing: it must still see the
  barcode path and the package-in/out motion, with a slot in the shell.
- A rigid move of the mechanism as one unit (for example turning the front line
  so it points between two feet) must not make the pin, tongue or tray lose
  alignment with the drum.
- Feet at 120° leave one foot-free sector; the heavy solenoid and servo must not
  all sit in it so the centre of mass drifts to an edge.
- The 006 weight-verification corridor and slots and the 150 g rotating-mass
  ceiling must stay available.
- The tray notch and the tray window must still line up with the dispense
  station.
- A component is exactly on the enclosure wall: it counts as outside unless it
  clears by the stated wall margin.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a cylindrical product layout as a variant
  of the existing concept, in which one round enclosure contains every component
  of the machine. The only openings are the scanner slot, the tray window and
  the cartridge/cap access the original layout already has.
- **FR-002**: The system MUST classify each of the 52 canonical component IDs
  as MECHANISM, PASSIVE or SUPPORT, and record the classification as part of
  this feature.
- **FR-003**: The layout MUST rearrange only PASSIVE and SUPPORT components
  (electronics deck, controller board, scanner placement, supports and brackets,
  enclosure, feet). MECHANISM components MUST keep their geometry and their pose
  relative to each other and to the drum axle.
- **FR-004**: The pin carriage, rails, connecting rod, servo crank and servo unit
  MUST remain a straight chain with the same stroke and timing.
- **FR-005**: The shared tongue, actuator rod, pull solenoid and return spring
  MUST remain a straight chain with the same travel and timing.
- **FR-006**: The enclosure outside diameter MUST be no larger than the target in
  SC-001, which is derived from the unavoidable straight-chain reach (see
  A-003), with the drum axle at the centre of the enclosure unless Q2 is
  answered otherwise.
- **FR-007**: The layout MAY rigidly turn or move the whole mechanism as one unit
  (for example, aim the front line between two feet) but MUST NOT move parts of
  it relative to each other.
- **FR-008**: The servo unit, the pull solenoid and the tongue-return bracket
  MUST each be supported by a named support component that is part of the static
  structure and connects, through contacting parts, to the base. No component may
  float.
- **FR-009**: The machine MUST rest on three feet 120° apart that allow
  levelling, and its centre of mass, for all drum, carriage and tongue positions,
  MUST project inside the foot triangle with the margin and tilt in SC-004.
- **FR-010**: The electronics deck and controller board MUST be placed inside the
  enclosure without changing their electronics or adding any. Re-outlining or
  splitting the deck is allowed only if the usable area and the board footprint
  are preserved.
- **FR-011**: The scanner MUST be placed inside the enclosure with a slot in the
  shell and MUST keep its read path to the scan position.
- **FR-012**: The cylindrical layout MUST be a separate selectable variant;
  the original layout and every existing output MUST remain available and
  unchanged. (Default for Q3; see Clarifications.)
- **FR-013**: The 52 canonical component IDs of Feature 003 MUST all be present in
  the variant and none renamed or removed. New support or enclosure parts MUST be
  recorded as variant-only additions, not as new canonical IDs.
- **FR-014**: The demo state machine, its steps, interlocks and elapsed-time
  behaviour MUST be identical in both layouts. The variant MUST NOT modify
  `docs/visualizer/demo-controller.js`.
- **FR-015**: The existing clearance, overlap and sweep checks MUST run on the
  variant and report no new overlap or clearance failure compared with the
  original layout.
- **FR-016**: The variant MUST keep the reserved pad corridor and slots for
  Feature 006 weight verification, no electronics on the rotating drum, and a
  rotating mass at or below 150 g.
- **FR-017**: Any component that cannot meet FR-003 to FR-011 without changing the
  mechanism MUST be reported as a recorded blocker, not silently altered.
- **FR-018**: Every artifact of the variant (viewer view, data, export, report)
  MUST disclose NOT VALIDATED / NOT PRINT-READY, `print_ready=false`,
  `fabricable_as_designed=false`, and that all values are ASSUMED.
- **FR-019**: The variant MUST work offline from `file://` like the existing
  viewer, with no network, server or new runtime dependency.
- **FR-020**: The variant MUST supersede the Feature 005 viewer-only wrap-around
  parts (base, shell sectors, shelves, web, lugs) only inside the variant; the
  Feature 005 specification and its artifacts MUST NOT be edited.

### Key Entities

- **Layout variant**: a named arrangement (`original`, `cylindrical`) of the same
  52 component IDs; carries its own placements and a status disclosure.
- **Component class**: MECHANISM, PASSIVE or SUPPORT for each canonical ID.
- **Enclosure**: the round shell, its inside and outside diameters, wall
  thickness, openings (scanner slot, tray window).
- **Support link**: a record naming which static component carries which other
  component, ending at the base; used for the no-floating check.
- **Foot set**: three feet 120° apart with levelling, and the triangle they make.
- **Mass table**: ASSUMED masses per component used only for the centre-of-mass
  and tilt checks.
- **Blocker**: a recorded component or requirement that cannot be met without
  changing the mechanism.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The enclosure outside diameter is at most 205 mm (ASSUMED target =
  2 × (98.7 mm farthest straight-chain reach + 3 mm wall) rounded up), which is
  at least 15% narrower and about 28% smaller in footprint than the rejected
  242 mm wrap. If Q2 allows an offset enclosure the target is revisited.
- **SC-002**: Every mechanism component has the same pose relative to the drum
  axle and to its neighbours in both layouts, within 0.01 mm and 0.01°, apart
  from one rigid move of the whole mechanism; every stroke, travel and demo
  timing value is identical.
- **SC-003**: 100% of the 52 canonical components lie inside the enclosure's
  inside wall in all demo states; 0 components extend past it.
- **SC-004**: 0 unsupported components in the connectivity check, with the
  servo, solenoid and return bracket each naming a support; the centre-of-mass
  ground projection is at least 10 mm inside every edge of the foot triangle for
  all extreme positions, and still inside it at a 15° worst-direction tilt
  (ASSUMED values).
- **SC-005**: 0 new overlaps and 0 new clearance failures in the existing
  clearance and sweep checks compared with the original layout.
- **SC-006**: With the variant not selected, the existing viewer data and 3MF
  export are byte-identical to the pre-feature output; with it selected, exactly
  52 canonical IDs are present.
- **SC-007**: Rotating mass is at most 150 g and the 006 pad corridor and slots
  are still reserved in the variant.
- **SC-008**: 100% of the variant's artifacts show the NOT VALIDATED, NOT
  PRINT-READY disclosure with `print_ready=false` and
  `fabricable_as_designed=false`.
- **SC-009**: A reviewer can open the variant and confirm, in under 2 minutes,
  that it is one round product with the same working mechanism.

## Assumptions

- **A-001**: Everything here is ASSUMED / NOT_VALIDATED. Masses, margins, wall
  thickness (3 mm), tilt angle (15°) and the foot margin (10 mm) are concept
  defaults.
- **A-002**: This is a viewer and export concept only. No printed part, rig or
  physical test is part of this feature; physical validation is out of scope.
- **A-003**: The unavoidable radial reach comes from the straight
  servo–rod–carriage chain and the straight tongue–solenoid chain. Shortening
  the rails or folding either chain are mechanism changes the user wants to
  avoid (Q1 default: not done). Their reach (tongue rod end 98.7 mm, servo 86 mm,
  return bracket 85 mm) sets the lower bound on a concentric enclosure.
- **A-004**: The farthest items today are passive (deck corner 114 mm), so
  moving passive items inward is what makes the target reachable.
- **A-005**: Canonical Feature 003 data (`concept-data.js`,
  `concept_geometry.json`) and `demo-controller.js` are read-only inputs. The
  variant's placements are kept in separate variant data.
- **A-006**: The stepper under the platform, the pill tray under the platform at
  the front, and the scanner demo flow of Feature 003 are kept; only their
  surrounding supports and placements may be adapted.
- **A-007**: The existing offline, no-CDN, no-server rules and the
  FDM/PLA/0.4 mm provisional guidance apply unchanged.

## Out of Scope

- Changing any mechanism kinematics, geometry, stroke, timing or the demo state
  machine.
- Folding or shortening the straight chains, or shortening the rails (pending
  Q1).
- Physical printing or any physical validation of the layout.
- New electronics, new sensors or new actuators.
- Editing Features 001–006, `demo-controller.js`, `concept-data.js`, canonical
  geometry or `.github/copilot-instructions.md`.
- Any single-dose integrity, medication-safety or hardware-readiness claim.
