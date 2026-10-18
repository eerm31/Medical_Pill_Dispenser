<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0 (MINOR — materially expanded guidance: scoped
  amendment to Principle IV allowing an optional third-party visualization extra)
- Modified principles: IV. Simplicity & Capstone Pragmatism (amendment added:
  optional viz extra may use justified third-party 3D/CAD libraries; core stays
  stdlib-only)
- Added sections: none (amendment embedded in Principle IV; Additional
  Constraints dependency bullet updated to reference it)
- Removed sections: none
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no change needed — "Constitution
    Check" gates are derived from this file at plan time
  - .specify/templates/spec-template.md ✅ no change needed — no
    principle-specific mandatory sections
  - .specify/templates/tasks-template.md ✅ no change needed — task categories
    stay generic
  - .github/agents/*.agent.md ✅ no change needed — agents read this
    constitution dynamically
- Follow-up TODOs: none
-->

# Smart Medical Dispenser Constitution

## Core Principles

### I. Single-Dose Integrity (NON-NEGOTIABLE)

Every design decision and every line of code MUST preserve the guarantee that
exactly one pill is dispensed per actuation, independent of pill shape and size.
Any mechanism state, code path, or parameter combination that could release zero
pills or two or more pills is a defect and MUST be treated as a blocking issue.
No feature may be marked complete while a known single-dose violation remains
unresolved.

Rationale: the device's core promise is exact dosing; an under- or over-dose is a
correctness failure, not a cosmetic bug.

### II. Simulation-First, Hardware-Faithful

The physical dispensing mechanism MUST be modeled honestly in software before any
hardware decision is finalized. Simulation parameters MUST map to measurable
physical quantities (geometry, motion, tolerances, pill shape/size variability).
Every simplification MUST be documented with its physical justification, and
hardware-facing conclusions MUST cite simulation evidence.

Rationale: a student team cannot iterate on physical hardware quickly; a faithful
simulation is the cheapest truthful test bed.

### III. Testability & Verification

Every invariant — especially single-dose integrity — MUST have an automated,
repeatable check. Verification MUST include randomized or property-based
simulation runs across pill shape/size distributions, not only hand-picked cases.
All runs MUST be reproducible via seeded randomness; seeds and configurations
MUST be recorded alongside results.

Rationale: the claim "exactly one pill regardless of geometry" is only credible
with reproducible evidence across the full pill distribution.

### IV. Simplicity & Capstone Pragmatism

Prefer simple, well-documented, dependency-light solutions that a student team
can build, explain, and defend. Over-engineering is a defect: abstractions,
frameworks, and dependencies MUST justify their cost. Every non-trivial decision
MUST be explainable in a design review.

Rationale: the project succeeds as a defensible capstone, not as a production
system; clarity beats generality.

**Amendment (v1.1.0) — Optional visualization extra**: The core simulation
engine (src/dispenser_sim/: models, mechanism, simulation, reporting, cli,
animation) remains Python 3.11+ standard-library only — this is unchanged.
An OPTIONAL packaging extra (e.g. `pip install .[viz]`) MAY use individually
justified third-party libraries for 3D/CAD rendering, subject to ALL of:

- The extra MUST be truly optional: `pip install .` and the full test suite
  MUST work with zero non-stdlib dependencies; the extra is required only for
  the 3D/CAD features.
- Every non-stdlib dependency in the extra MUST be individually justified
  (why stdlib/tkinter cannot do it) in the feature's research.md.
- Determinism and offline requirements still apply to the core; viz features
  MUST NOT require network access at runtime.

Rationale: tkinter cannot produce hardware-faithful 3D/CAD renderings; a
strictly optional extra keeps the core dependency-free and reproducible while
allowing justified visualization capability.

### V. Portability Constraints

Design decisions MUST respect the size, weight, and power budgets of a portable,
battery-friendly device. Assumptions about physical dimensions, mass, and
actuation energy MUST be documented explicitly and revisited whenever simulation
results change them.

Rationale: portability is a core product constraint, not an afterthought;
undocumented physical assumptions silently invalidate designs.

## Additional Constraints

- Domain: student capstone; the software simulation of the dispensing mechanism
  is the first deliverable. No real-patient use and no regulatory compliance
  claims are in scope.
- Simulation parameters MUST be expressed in physical units (mm, g, degrees, J)
  with documented sources or measurement plans.
- Randomness anywhere in the codebase MUST be seedable; unseeded randomness in
  verification code is a defect.
- Dependencies MUST be minimal and each MUST be justified in the implementation
  plan (see the Principle IV v1.1.0 amendment for the optional visualization
  extra, the sole permitted exception to stdlib-only).

## Development Workflow

- Every feature plan MUST pass a Constitution Check with explicit gates for:
  single-dose integrity, simulation fidelity, automated verification,
  simplicity, and portability impact.
- Reviews MUST verify that no change weakens the single-dose invariant or
  removes a verification check.
- A failing or flaky verification check blocks completion until fixed, or until
  explicitly justified and documented.
- Physical-design assumptions (dimensions, actuation energy, pill
  distributions) MUST live in version-controlled docs and be updated when they
  change.

## Governance

This constitution supersedes all other project practices. Amendments require
(1) a documented rationale, (2) an update to this file with a version bump per
semantic versioning — MAJOR for principle removal or redefinition, MINOR for new
principles or materially expanded guidance, PATCH for clarifications — and
(3) propagation of changes to dependent templates and guidance docs. All plans
and reviews MUST verify compliance with these principles; complexity beyond them
MUST be justified in the plan's Complexity Tracking section.

**Version**: 1.1.0 | **Ratified**: 2026-09-19 | **Last Amended**: 2026-09-21
