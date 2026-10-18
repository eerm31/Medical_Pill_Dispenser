# Feature Specification: Dispensing Mechanism Simulation

**Feature Branch**: `001-dispensing-mechanism-simulation`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "Smart medical dispenser capstone: a portable device that dispenses medication pills. The FIRST deliverable is a software SIMULATION of the dispensing mechanism. The critical product guarantee: the mechanism must dispense EXACTLY ONE pill per actuation, regardless of pill shape and size (round tablets, oblong caplets, capsules, small/large pills within a realistic range). The dispenser must be portable (compact, lightweight, battery-operated), so the simulated mechanism must be physically plausible for a small portable enclosure. The simulation should let us evaluate whether a candidate mechanism design reliably achieves single-pill dispensing across a distribution of pill shapes/sizes, including worst cases (pills jamming, stacking, double-dropping, varying friction/orientation), and produce measurable evidence (dispense counts per actuation, success rate, failure modes) that the one-pill-at-a-time invariant holds."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Simulate a Candidate Mechanism (Priority: P1)

A team member describes a candidate dispensing mechanism design (geometry, motion, and tolerances as physical parameters) together with a pill population (shape/size distribution), then runs the simulation over a large number of actuation cycles. For every actuation, the simulation records how many pills were dispensed (zero, exactly one, or multiple) and what happened during the cycle, giving the team a complete per-cycle account of mechanism behavior.

**Why this priority**: This is the core deliverable of the capstone's first milestone. Without the ability to run a physically plausible simulation of a mechanism and observe per-actuation dispense outcomes, no evaluation, verification, or design comparison is possible.

**Independent Test**: Configure one mechanism and one pill distribution, run a simulation of 1,000 actuation cycles, and verify that every cycle produces exactly one recorded, classified outcome (zero / one / multiple pills) with no missing or ambiguous cycles.

**Acceptance Scenarios**:

1. **Given** a valid mechanism configuration and pill distribution, **When** the user starts a simulation run of N actuation cycles, **Then** the run executes all N cycles and records exactly N classified dispense outcomes.
2. **Given** a mechanism configuration that violates the documented portability envelope (dimensions, mass, or actuation energy beyond a compact battery-operated device), **When** the user attempts to run it, **Then** the configuration is refused or clearly flagged with the specific portability constraint that is violated.
3. **Given** a completed run, **When** the user inspects results, **Then** every actuation cycle has a definite classified outcome and no cycle is missing or ambiguous.

---

### User Story 2 - Verify the One-Pill-At-A-Time Invariant Across Pill Variability (Priority: P2)

A team member evaluates whether a candidate mechanism upholds the product guarantee — exactly one pill per actuation — across the full realistic distribution of pill shapes and sizes (round tablets, oblong caplets, capsules; small through large), including worst-case conditions: pill jamming, stacking, double-dropping, and varying friction and orientation. The simulation flags every invariant violation and classifies each by failure mode, producing single-dispense success rates in aggregate and per pill category.

**Why this priority**: The single-dose invariant is the non-negotiable product guarantee (Constitution I). This story turns raw per-cycle outcomes into the evidence required to accept or reject a mechanism design.

**Independent Test**: Run one mechanism against the full pill distribution and worst-case scenario set, and verify the report contains an aggregate single-dispense success rate, per-category success rates, and a failure-mode breakdown that accounts for every violation.

**Acceptance Scenarios**:

1. **Given** a completed run over the full pill distribution, **When** results are reported, **Then** the single-dispense success rate is reported in aggregate and broken down per pill shape/size category.
2. **Given** worst-case conditions (jam, stacking, double-drop, extreme friction or orientation), **When** they occur during a run, **Then** each occurrence is detected and classified under a named failure mode.
3. **Given** any actuation that dispenses zero pills while pills remain available, or two or more pills, **When** results are reported, **Then** that actuation is flagged as a single-dose invariant violation and attributed to a classified failure mode (or explicitly marked unclassified with its recorded state preserved).

---

### User Story 3 - Reproduce Runs and Compare Candidate Designs (Priority: P3)

A team member reproduces a previous simulation exactly using its recorded seed and configuration, and evaluates two or more candidate mechanisms under identical seeds and pill distributions to compare their single-dose reliability side by side for a design review.

**Why this priority**: Reproducibility makes the evidence credible and auditable (Constitution III), and comparison enables defensible design selection; both build on Stories 1 and 2.

**Independent Test**: Re-run a recorded configuration with the same seed and verify identical outcomes for every cycle; then run two mechanisms under identical conditions and verify a comparative reliability summary is produced.

**Acceptance Scenarios**:

1. **Given** a recorded seed and configuration from a prior run, **When** the run is repeated, **Then** every actuation outcome is identical to the original run.
2. **Given** two candidate mechanism configurations, **When** both are evaluated under the same seed(s) and pill distribution, **Then** the results support a direct side-by-side comparison of single-dose success rates and failure modes.
3. **Given** any completed run, **When** the user exports results, **Then** the exported record includes the seed, the full configuration, and per-cycle outcomes in a durable form suitable for citation as evidence in design reviews.

### Edge Cases

- Reservoir empty at actuation: outcome recorded as "no pill available" and NOT counted as a mechanism failure; reported separately from jam / missed-dispense failures.
- Exactly one pill remaining in the reservoir at actuation.
- Pills at the extreme ends of the documented realistic size/mass range (smallest and largest per shape category).
- Pills with extreme surface friction (e.g., coated or sticky) or unfavorable orientation (e.g., a caplet standing on edge) at the point of singulation.
- Pill jam mid-cycle: the cycle is flagged as a jam failure, and the behavior of subsequent cycles is reported (whether the jam persists or clears).
- Stacking: two pills aligned so both pass the metering point together (double-drop).
- Multi-release caused by an outlet oversized relative to the smallest pills in the distribution.
- Partial or interrupted actuation (incomplete stroke) treated as a fault scenario, not a normal cycle.
- Very large runs (e.g., 100,000 cycles) remain feasible and produce complete results.
- Same seed reused with a different pill distribution: each run stays reproducible per configuration, and the configuration record makes the difference explicit.

## Requirements *(mandatory)*

### Functional Requirements

Actuation and mechanism modeling:

- **FR-001**: The simulation MUST model a complete actuation cycle of the dispensing mechanism (pill presentation → singulation/metering → release → reset) as the atomic unit of evaluation.
- **FR-002**: Every actuation cycle MUST resolve to exactly one classified outcome: zero pills dispensed, exactly one pill dispensed, or multiple pills dispensed.
- **FR-003**: The mechanism MUST be described by physical parameters (geometry, motion, tolerances) expressed in physical units (mm, g, degrees), so candidate designs are evaluated by changing configuration rather than changing simulation logic.
- **FR-004**: The simulation MUST validate mechanism configurations against a documented portability envelope (maximum dimensions, mass, and actuation energy consistent with a compact, lightweight, battery-operated device) and refuse or clearly flag configurations that violate it.
- **FR-005**: Every physical simplification in the mechanism model MUST be documentable alongside the configuration it applies to, with its physical justification.

Pill variability:

- **FR-006**: The simulation MUST support the pill shape categories: round tablets, oblong caplets, and capsules.
- **FR-007**: The simulation MUST support pill dimensions and mass varying across a documented realistic range for each shape category, from small to large.
- **FR-008**: The simulation MUST support variation of pill surface friction and pill orientation within documented realistic ranges.
- **FR-009**: The simulation MUST draw pills from a configurable distribution over shape, size, friction, and orientation, so both representative and worst-case-loaded populations can be evaluated.

Single-dose invariant:

- **FR-010**: The simulation MUST check every actuation cycle against the single-dose invariant: exactly one pill dispensed per actuation.
- **FR-011**: Every actuation that dispenses zero pills while pills are available, or two or more pills, MUST be flagged as an invariant violation.
- **FR-012**: An actuation with no pills available (empty reservoir) MUST be recorded distinctly and MUST NOT be counted as a mechanism invariant violation.

Failure-mode detection:

- **FR-013**: The simulation MUST detect and classify, at minimum, these failure modes: pill jamming, pill stacking, double-dropping (multi-release), and missed dispense (pills available but none released).
- **FR-014**: Every invariant violation MUST be attributed to a classified failure mode, or explicitly marked unclassified with the cycle's recorded state preserved for analysis.

Reproducibility:

- **FR-015**: All randomness in the simulation MUST be governed by an explicit seed that is supplied or recorded for each run.
- **FR-016**: Repeating a run with the same seed and identical configuration MUST produce identical per-cycle outcomes.
- **FR-017**: Every run MUST persist its seed and complete configuration together with its results.

Result reporting:

- **FR-018**: Each run MUST report total actuations; counts and rates of single-dose, zero-dose, and multi-dose outcomes; and the single-dispense success rate in aggregate and per pill shape/size category.
- **FR-019**: Each run MUST report a failure-mode breakdown in which every invariant violation is counted under exactly one failure mode.
- **FR-020**: Run results MUST be exportable in a durable, human-readable and machine-readable form for citation as evidence in design reviews.
- **FR-021**: The simulation MUST support runs of at least 10,000 actuation cycles without manual intervention.

### Key Entities

- **Pill**: A single medication unit characterized by shape category (round tablet, oblong caplet, capsule), dimensions, mass, and surface friction; sampled from a Pill Distribution.
- **Pill Distribution**: A configurable statistical description of a pill population — shapes, size/mass ranges, friction, and orientation variability — used to load a run.
- **Mechanism (Candidate Design)**: A parametric, physically plausible model of the dispensing mechanism (geometry, motion, tolerances) constrained by the Portability Envelope; the subject under evaluation.
- **Actuation Cycle**: One complete dispense attempt from rest to rest; the unit at which the single-dose invariant is checked.
- **Dispense Event**: The recorded outcome of one Actuation Cycle: number of pills released (0, 1, or ≥2), any detected failure mode, and relevant mechanism/pill state.
- **Failure Mode**: A named classification of a single-dose invariant violation (jam, stacking, double-drop, missed dispense, or unclassified).
- **Simulation Run**: One seeded execution of many Actuation Cycles for a given Mechanism and Pill Distribution, together with its configuration record and results.
- **Portability Envelope**: The documented size, mass, and actuation-energy limits a Mechanism must satisfy to remain plausible for a portable, battery-operated device.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A single run executes at least 10,000 actuation cycles and yields a complete per-cycle outcome record — 100% of cycles classified, with no gaps.
- **SC-002**: A mechanism's single-dispense reliability is reported as a quantitative success rate across the full pill distribution and per pill category, evaluated against a pass threshold of 99.5%: a mechanism design passes if its single-dispense success rate is ≥99.5% (≤5 violations per 1,000 actuations) across the full pill distribution. Per-category success rate reporting remains required regardless of the aggregate pass/fail result.
- **SC-003**: 100% of invariant violations in any run are accounted for in the failure-mode breakdown (no silent or unrecorded failures).
- **SC-004**: Given the same seed and configuration, repeated runs reproduce identical outcomes for 100% of actuation cycles.
- **SC-005**: A 10,000-cycle evaluation of one mechanism against the full pill distribution completes in under 10 minutes on typical student laptop hardware.
- **SC-006**: A team member can go from a new candidate mechanism description to a complete reliability report within one working session, without manual data wrangling.

## Assumptions

- "Dispensing mechanism" covers the full path a pill travels from a loaded reservoir through singulation to the exit, because jamming and stacking occur along that path; modeling only the outlet would miss required failure modes.
- Pills are oral solid dose forms only (tablets, caplets, capsules); liquids, powders, and injectables are out of scope.
- Realistic pill ranges will be documented from published pill-size data or team measurements during planning; this specification fixes the categories and variability axes, not the numeric ranges.
- The simulation is offline software with no hardware in the loop; fidelity approach (e.g., 2D vs 3D, physics approach) is a planning decision, not a specification requirement.
- The Portability Envelope's numeric limits (max dimensions, mass, actuation energy) will be documented in version-controlled design docs; this feature requires the simulation to validate/flag against the envelope, not to define its values.
- A normal actuation is a complete, user-initiated dispense command; partial or interrupted actuation is treated as a fault scenario.
- The single-dispense reliability pass threshold is 99.5% (confirmed 2026-09-19): a mechanism design passes if its single-dispense success rate is ≥99.5% (≤5 violations per 1,000 actuations) across the full pill distribution.
