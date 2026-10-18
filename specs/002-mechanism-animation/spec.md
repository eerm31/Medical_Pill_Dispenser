# Feature Specification: Mechanism Animation and Run Replay

**Feature Branch**: `002-mechanism-animation`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "Animated visualization of the pill dispensing mechanism simulation. Users want to SEE a simulation run unfold — pills moving through the dispensing mechanism (e.g. slider gate or rotary disk), cycle by cycle, including failure modes such as jams (JAM), stacking (STACKING), multi-dose and zero-dose events, and reservoir depletion (NO_PILL_AVAILABLE). The visualization must be able to replay any existing seeded run (from a runs/<run_id>/run.json record or cycles.csv) exactly, and/or animate live from the simulation engine using the same seed + config. Intended audience: engineering design review and capstone demonstration, so the animation must make it obvious WHY a cycle succeeded or failed. Project constraints from the constitution and feature 001: Python 3.11+, product code is stdlib-only, deterministic seeded behavior, offline — any new dependencies for visualization must be explicitly justified in the spec as deviations or kept as optional/dev-only extras."

## Clarifications

### Session 2026-09-19

- Q: Is live engine-driven animation (FR-010) a hard requirement for this feature's first iteration, or is replay-only (FR-001 through FR-009) acceptable as the first deliverable with live animation as a fast follow-up? → A: Replay first, live as follow-up. The first iteration (MVP) is replay-only: animate any recorded run directory (runs/<run_id>/, run.json canonical with cycles.csv fallback) with 100% data fidelity. FR-010 remains in the spec as a Phase 2 follow-up requirement; FR-011 (live ≡ replay consistency) stays but is verified when live lands.
- Q: Is a recorded/exported shareable artifact (FR-016) a hard requirement, or is live on-screen playback sufficient for the demonstration? → A: Live on-screen playback is sufficient for the first iteration. Export of a shareable artifact is downgraded to an OPTIONAL / nice-to-have requirement; it must not block the MVP and must not force a new dependency into the MVP (FR-017's optional/dev-only dependency stance stands).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Replay a Recorded Run as an Animation (Priority: P1)

A team member or design reviewer selects any existing simulation run and watches it unfold cycle by cycle: pills moving through the dispensing mechanism, each actuation annotated with its classified outcome (single-dose, zero-dose, multi-dose, no-pill-available) and, when a failure occurred, its failure mode. Failures are obvious in the mechanism view itself — a jammed pill is visibly stuck, stacked pills are visibly stacked, a multi-dose shows the actual number of pills released, and an empty reservoir is visibly empty.

**Why this priority**: This is the core value of the feature — SEEING a run — and it works entirely from the persisted run records that feature 001 already produces, without coupling to the engine. Every other story builds on this one.

**Independent Test**: Replay any recorded run (e.g., an existing runs/<run_id>/ directory) end to end and verify that 100% of cycles are shown in recorded order with outcomes and failure modes matching the persisted record exactly, and that each failure mode is visually identifiable without reading any external log or table.

**Acceptance Scenarios**:

1. **Given** a valid run directory containing a run record, **When** the user starts a replay, **Then** the animation plays every cycle in recorded order and each cycle's displayed outcome and failure mode matches the persisted record exactly.
2. **Given** a run containing JAM, STACKING, multi-dose, zero-dose, and NO_PILL_AVAILABLE cycles, **When** those cycles are displayed, **Then** each state is visually distinguishable and labeled with its classification, and the mechanism view shows the physical reason (pill stuck, pills stacked, multiple pills released, pill available but retained, reservoir empty).
3. **Given** a jam that persists across several consecutive cycles, **When** the run is replayed, **Then** the jam is rendered as one continuous span with identifiable start and end, not as disconnected per-cycle flashes.
4. **Given** a run directory whose record is missing or invalid, **When** the user attempts replay, **Then** the problem is clearly reported and no partial or misleading animation is shown.

---

### User Story 2 - Animate Live from the Engine with Identical Results (Priority: P2) — Phase 2 (follow-up; not in MVP scope)

**Phase note (Clarifications, 2026-09-19):** This story is delivered after the replay-only MVP. Its acceptance scenarios and independent test apply when live animation lands.

A team member starts an animation directly from the simulation engine using a chosen seed and configuration, watching the mechanism behave as the run is computed. The visible cycle sequence is identical to replaying the persisted record of a run with the same seed and configuration, so live demonstration and recorded evidence never disagree.

**Why this priority**: Live animation is what makes the capstone demonstration compelling and proves the visualization is faithful to the engine, but replay (P1) already delivers design-review value on its own.

**Independent Test**: Animate a live run with a fixed seed and configuration while it is recorded; then replay the resulting persisted run and verify the visible cycle sequence is identical for 100% of cycles.

**Acceptance Scenarios**:

1. **Given** a mechanism configuration and seed, **When** a live animation runs, **Then** each cycle appears with the same outcome and failure-mode annotation that the persisted run record contains.
2. **Given** the same seed and configuration, **When** comparing the live animation to a replay of the recorded run, **Then** 100% of cycles match in order, outcome, failure mode, and pill attributes.
3. **Given** a live animation in progress, **When** the user pauses, resumes, or seeks, **Then** the displayed sequence remains the deterministic one for that seed — no randomness is re-rolled by playback actions.

---

### User Story 3 - Navigate Long Runs and Prepare Review Excerpts (Priority: P3)

A design reviewer opens a long run (e.g., 10,000 cycles), jumps directly to the failures that matter, steps through a jam span cycle by cycle at a comfortable speed, and — when the optional export capability (FR-016) is available — captures a shareable excerpt of an interesting sequence to cite in a design review or the capstone demonstration.

**Why this priority**: This makes the feature practical for real reviews of long runs, but it depends on P1/P2 for the animation itself.

**Independent Test**: Open a 10,000-cycle run, jump straight to the next jam without playing prior cycles, and single-step through the span. If the optional export capability (FR-016) is implemented, also produce a shareable excerpt of that span; export is not required for this test to pass in the first iteration.

**Acceptance Scenarios**:

1. **Given** a run of 10,000 or more cycles, **When** the user jumps to a specific cycle index or to the next/previous failure, **Then** the target cycle is displayed without playing all intermediate cycles.
2. **Given** any run, **When** the user changes playback speed, pauses, or single-steps, **Then** per-cycle annotations remain accurate at every speed and position.
3. **Given** an interesting span of cycles (e.g., a jam or a multi-dose event), **When** the user captures it using the optional export capability (FR-016 — nice-to-have, not required for the MVP), **Then** a self-contained shareable artifact is produced that is suitable for citation in a design review.

### Edge Cases

- Empty reservoir from the first actuation: every cycle is NO_PILL_AVAILABLE; the animation must show an empty reservoir and must not present these cycles as mechanism failures.
- Reservoir depletes mid-run: the exact cycle at which depletion occurs must be visually obvious, with a clear before/after transition.
- Jam persistence spans: multi-cycle jams render as continuous spans; the cycles where a jam starts and clears must be identifiable.
- Very long runs (10,000+ cycles): opening, seeking, and jumping must remain responsive; the animation must not require pre-rendering every cycle or manual intervention.
- Replay vs live consistency (applies when Phase 2 live animation lands): identical seed + configuration must yield identical visible sequences; any divergence between live animation and replay is a defect.
- Incomplete run artifacts (run record missing/corrupt, or only the per-cycle export present): the problem is clearly reported; never a silently wrong animation.
- Reservoir population larger than the visible view: pill counts must remain truthful (aggregate indicators are acceptable; misrepresenting counts or depletion is not).
- Multi-dose events releasing two or more pills: the actual released count must be visible, not just a generic error indication.
- Unclassified failures carried over from feature 001: shown as their own distinct state with the cycle's recorded state available for inspection.
- Partial or interrupted actuation fault cycles (modeled in feature 001): visually distinct from both normal outcomes and mechanism failure modes.
- Replaying a run whose mechanism configuration no longer exists in configs/: replay must still work, because the run record embeds the full configuration.

## Requirements *(mandatory)*

### Functional Requirements

Replay and data fidelity:

- **FR-001**: Users MUST be able to select any existing run directory (runs/<run_id>/) and watch an animated, cycle-by-cycle replay of that run.
- **FR-002**: Replay MUST be data-faithful: 100% of cycles are shown in recorded order with outcome, failure mode, jam persistence, and pill attributes exactly as persisted; replay MUST NOT re-simulate cycles or re-sample randomness.
- **FR-003**: Replay MUST work from the canonical run record (run.json); when only the per-cycle export (cycles.csv) is available, replay MUST still reconstruct the outcome sequence and MUST clearly indicate that mechanism geometry is approximated or unavailable.

Animation content:

- **FR-004**: The animation MUST depict pills moving through the dispensing mechanism across the phases of an actuation cycle (presentation, singulation/metering, release, reset), consistent with the mechanism's configured geometry.
- **FR-005**: Mechanism visuals MUST be driven by the mechanism configuration so that any validated candidate design — existing or future — can be visualized without changes to simulation logic.
- **FR-006**: Every cycle MUST be annotated with its classified outcome (single-dose, zero-dose, multi-dose, no-pill-available) and, when present, its failure mode (JAM, STACKING, DOUBLE_DROP, MISSED_DISPENSE, or UNCLASSIFIED).
- **FR-007**: Failure states MUST be visually distinguishable within the mechanism view itself — jam (pill visibly stuck), stacking, multi-dose (actual released count visible), missed dispense (pill available but retained), empty reservoir — so a viewer can tell WHY a cycle failed without reading external logs or tables.
- **FR-008**: Multi-cycle persistent conditions (e.g., jam persistence) MUST render as continuous spans with identifiable start and end cycles.
- **FR-009**: NO_PILL_AVAILABLE cycles MUST be visually distinct from mechanism failures, consistent with feature 001's classification of them as non-violations.

Live animation:

- **FR-010** *(Phase 2 — follow-up; NOT in the first-iteration MVP scope)*: Users MUST be able to animate directly from the simulation engine given a seed and configuration. Per the 2026-09-19 clarification, the first iteration of this feature is replay-only (FR-001 through FR-009); live engine-driven animation is retained as a requirement but is explicitly deferred to a fast-follow-up phase.
- **FR-011** *(Phase 2 — verified when live animation lands)*: Given an identical seed and configuration, the live-animated cycle sequence MUST be identical to the replay of the persisted run — 100% of cycles, in order, with identical annotations. This requirement stays in force from the start so the Phase 2 live mode cannot diverge from replay; it becomes verifiable when FR-010 is implemented.

Navigation and playback:

- **FR-012**: Playback MUST support play, pause, single-step forward and backward, and adjustable speed.
- **FR-013**: Users MUST be able to jump to a specific cycle index and to the next/previous invariant violation or failure-mode occurrence without playing intermediate cycles.
- **FR-014**: Runs of at least 10,000 cycles MUST be openable and navigable without pre-rendering every cycle and without manual intervention.

Demonstration and project constraints:

- **FR-015**: The visualization MUST run fully offline on the project's supported environment (Python 3.11+), consistent with the project's offline, hardware-free scope.
- **FR-016** *(OPTIONAL — nice-to-have; MUST NOT block the MVP)*: Users SHOULD be able to produce a shareable artifact of a selected cycle range for design reviews and the capstone demonstration. Per the 2026-09-19 clarification, live on-screen playback is sufficient for the first iteration's demonstrations; artifact export is optional and, if implemented, MUST NOT force a new dependency into the MVP (consistent with FR-017's optional/dev-only dependency stance).
- **FR-017**: Any dependency introduced for visualization beyond the Python standard library MUST be either kept optional/dev-only or explicitly justified in the implementation plan as a deviation from the constitution's dependency-minimalism principle; the core simulation MUST remain stdlib-only and fully runnable with no visualization dependencies installed.
- **FR-018**: The visualization MUST NOT alter feature 001 behavior: seeded determinism, per-cycle classification, and the persisted run records remain the single source of truth, and all existing automated verification continues to pass unchanged.

### Key Entities

- **Run Source**: Where a cycle sequence comes from — a persisted run record (run.json and/or cycles.csv under runs/<run_id>/) or the live simulation engine; supplies ordered, classified Dispense Events.
- **Cycle Frame**: The visual state of the mechanism and pills for one actuation cycle, derived from one Dispense Event: pill positions, mechanism phase, classified outcome, and failure mode.
- **Failure Span**: A contiguous range of cycles sharing a persistent condition (e.g., a jam), with start and end cycle indexes.
- **Playback Session**: The viewer's current position, speed, and play/pause/step state over a run's cycle sequence.
- **Mechanism View**: The rendered depiction of a candidate mechanism's geometry and pill flow, driven by the mechanism configuration.
- **Annotation**: The per-cycle outcome and failure-mode labeling shown alongside the Mechanism View.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Given any recorded run, replay shows 100% of cycles in recorded order with outcomes and failure modes matching the persisted record exactly — no missing, altered, or re-simulated cycles.
- **SC-002** *(Phase 2 — measurable once live animation lands)*: Given the same seed and configuration, live animation and replay of the recorded run produce identical visible sequences for 100% of cycles. This criterion is not measurable against the replay-only MVP and becomes a hard gate when FR-010 is delivered.
- **SC-003**: In a design-review walkthrough, a viewer can correctly identify the cause of every failed or empty cycle from the animation alone (without reading CSV or log output) across all classified states: JAM, STACKING, DOUBLE_DROP, MISSED_DISPENSE, NO_PILL_AVAILABLE, and UNCLASSIFIED.
- **SC-004**: A 10,000-cycle run opens and supports navigation (jump to cycle index, next/previous failure) with each navigation action completing in under 2 seconds on typical student laptop hardware.
- **SC-005**: The core simulation remains fully usable without the visualization: all existing automated verification passes unchanged, and a complete simulation run can be executed with no visualization dependencies installed.
- **SC-006**: A team member can go from a finished run to a review-ready on-screen presentation of an interesting span (e.g., a jam) within 5 minutes. Producing an exported shareable artifact of the span is optional (FR-016) and is not required to meet this criterion in the first iteration.

## Assumptions

- The animation is a faithful schematic of mechanism geometry and pill flow (hardware-faithful per the constitution), not a physically rendered 3D scene; rendering fidelity choices are planning decisions.
- The persisted run record from feature 001 (run.json, with cycles.csv as export) is the authoritative replay source; replay never re-runs the simulation.
- Viewing happens locally on a team member's machine; no network services, accounts, or multi-user collaboration are in scope.
- The two existing mechanism configurations (slider gate, rotary disk) are the first visualizable designs; FR-005 keeps future designs config-driven.
- Pill counts must remain truthful even when the full reservoir cannot be drawn; aggregate indicators are acceptable, misrepresenting counts is not.
- Scope is phased per the 2026-09-19 clarification: the first iteration (MVP) is replay-only; live engine-driven animation (FR-010/FR-011) is Phase 2 and is not required for MVP acceptance; shareable-artifact export (FR-016) is optional and is not required for MVP acceptance.
- Artifact export is optional for the first iteration; if it is implemented later, the specific format (video, animated image, self-contained page) is a planning decision that must respect FR-017's optional/dev-only dependency stance.
- Side-by-side comparison animations of two runs are out of scope; feature 001's comparative reports already cover design comparison.
- No audio, narration, or hardware-in-the-loop display is in scope.
