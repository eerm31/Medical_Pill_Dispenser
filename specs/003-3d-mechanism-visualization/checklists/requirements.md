# Specification Quality Checklist: Portable Rotating-Cartridge Dispenser Visualization

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-10; revalidated 2026-10-12
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded, including explicit supersession of the slider-gate brief
- [x] Dependencies and assumptions identified
- [x] Dimension annotation scope lists source values, provenance/status caveats, and explicitly unspecified values without inventing measurements
- [x] The A–K placement history preserves prior approximate/assumed/NOT_VALIDATED coordinates and source conflicts; the 2026-10-12 amendment explicitly identifies which earlier blade, actuator, spring, tray and recipe candidates are superseded by the current station topology, without silently deleting them
- [x] The expanded physical export inventory remains exactly 32 existing plus 20 added = 52 separately named instances; battery, stepper and multi-piece features are integrated into named parts without added IDs, and the credit-card reference is visual-only and excluded
- [x] FR-034 and the amendment preserve the rail/closed-carriage mismatch and historical servo, blade, spring, tray and scanner placement conflicts; user-specified current actuator chains and component sizes are distinguished from assumed locations and contacts
- [x] The former FR-031 recipe envelope 12.8 × 10.4 × 40 mm is retained as historical provenance and an explicit conflict, while the new user-specified 14.8 × 12.4 × 40 mm cartridge size is current and governs the scale audit
- [x] Must-not-overlap and gap checks distinguish intended contact, detected conflict, and unresolved clearance without treating estimates or mesh QA as tolerances
- [x] The canonical millimetre size audit lists all eight requested envelopes and four-decimal ratios against 14.8 mm, mandates correction of any per-axis mismatch greater than 25%, and prohibits readability-driven enlargement
- [x] A moving-part touch table covers the drum/towers, caps, all four blades and springs, upper servo linkage/carriage/pin, lower tongue pull-solenoid/plunger/carriage/strap/tongue/spring, and transient pill path; unspecified contact surfaces are assumed/NOT_VALIDATED and floating parts are disallowed
- [x] The single origin station, one active indexed cartridge, four co-rotating towers, one blade per cartridge, selected-blade-only actuation, and one globally shared tongue are explicit; the empty chamber/outlet/tray stack and 12 mm outlet-to-tray relation are testable
- [x] Upper and lower solenoids are distinguished; actuator chains, z=14–20 mm upper carriage/rail region, lower actuator region around z=−0.75 mm, canonical −Y pull direction, and prohibition on placing the servo/lower solenoid beside the drum are explicit
- [x] The four radius-15 mm tower envelopes require pairwise AABB and shape-based checks and a clear cartridge top/lift path; scanner placement is fixed beside the station with an explicitly assumed 25–250 mm point-to-point line of sight to the indexed label, without changing scanner FSM or Feature 004 boundary
- [x] Review packet order is explicit: touch table, scale-ratio table, overlap/contact/unresolved list, top orthographic dimensioned view, then side orthographic dimensioned view; both views disclose assumed placements and NOT_VALIDATED status

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover the primary assembly, scan/refill, and export flows
- [x] User scenario covers independent review of parked placement, parenting, clearances, export inventory and scale-reference exclusion
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification; 3MF and manifest are required user deliverables
- [x] Dimension visibility is independently testable and limited to presentation; defaults, state isolation, offline behavior, export inventory, Feature 004 boundary, and non-readiness disclosures are specified

## Notes

- The supplied two-gate specification controls dispensing-station geometry and cycle behavior; the reference scan defines the rotating assembly and remaining visual concept, not validated hardware or core-simulation event data.
- All checklist items passed review. No [NEEDS CLARIFICATION] markers remain. The chosen channel/pill X/Y alignment is explicitly labeled an adjustable concept assumption with unverified fit, not a validated design input.
- Rechecked 2026-10-11 after the scanner workflow amendment: an existing same-color container with zero pills is refill-eligible by rescan without placement or inventory mutation; a positive pill count remains unavailable. Requirements, acceptance scenarios, edge cases, assumptions, and measurable outcomes specify the two paths separately; existing unsupported/invalid and other unavailable-target scans remain state-neutral. No implementation, test, plan, or task artifact was changed.
- Rechecked 2026-10-11 after the dimension-annotation amendment: the new independent dimension visibility control is presentation-only and defaults off; labelable values are constrained to canonical source dimensions or documented recipe/derivation values, with provenance/status and caveats. Missing dimensions remain unspecified; mechanism/scanner state, Feature 004 isolation, 32 physical export parts, offline behavior, and non-readiness declarations remain unchanged. No plan, task, code, or test artifact was changed.
- Rechecked 2026-10-11 after the A–K placement amendment: the new placement schedule defines an assumed origin and socket formula, preserves approximate/assumed/NOT_VALIDATED coordinate status, names the parent/moving groups and unresolved overlaps, records the drum-radius, tongue-datum, spring-envelope, and crank-linkage conflicts, expands the named physical inventory from 32 to 52, and excludes the credit-card reference from export. The existing controller/FSM, fictional scanner fixtures/transaction, Feature 001/002 boundaries, and non-readiness declarations remain unchanged. Implementation, plan/task, and evidence artifacts were not updated by this specification-only amendment.
- Rechecked 2026-10-12 after the FR-034 A–K placement correction: the fixed housing remains x=[−22,22], y=[−38,36]; direct station-frame coordinates override former axle-frame conversion, and +15 mm canonical Y applies only to placements explicitly identified as axle-centered. Socket positions and distinct consistent cartridge/blade rotations are specified. Cartridge, cap, blade/tab/spring, pin/carriage/rail, servo/linkage, lower-tongue-group, scanner/electronics and tray placements are updated; the rail endpoint conflict, housing/actuator overhangs, servo angle/linkage ambiguity, FR-033/SC-024 spring conflict and missing support/scanner subfeature details remain unresolved. The physical inventory remains exactly 52 IDs, with battery/stepper and multi-piece features integrated into existing named parts. No plan, task, code, or test artifact was changed.
- Rechecked 2026-10-12 after the ordered model-review amendment: the spec now specifies exact requested component sizes and ratios, explicit upper/lower touch chains, one origin station with one indexed active cartridge and four retained co-rotating blades, the single shared tongue, actuator zones and −Y pull axis, tower AABB/shape and lift-path checks, assumed scanner line of sight, and the required first review packet. Conflicting earlier FR-034/FR-031 values remain recorded with explicit precedence; requested sizes are not described as validation. The exact 52 export identities and scanner FSM/Feature 001/002/004/readiness boundaries are preserved. Checklist completion validates specification coverage only; no model geometry, overlaps, browser behavior, or implementation was audited or changed.
- Planning may proceed. It must retain the NOT VALIDATED / NOT PRINT-READY declarations and revisit the listed engineering unknowns without inventing authoritative values.
