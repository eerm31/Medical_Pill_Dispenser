# Phase 0 Research: Dispensing Mechanism Simulation

**Feature**: 001-dispensing-mechanism-simulation | **Date**: 2026-09-19

All NEEDS CLARIFICATION items from the Technical Context are resolved below.

## R1. Simulation fidelity approach (2D model vs physics engine)

**Decision**: Pure-Python, parametric 2D kinematic/pseudo-physics model of the pill path (reservoir → presentation → singulation/metering → release → reset), evaluated as an event-driven process per actuation cycle.

**Rationale**:
- Performance (SC-005): per-cycle analytic sampling is orders of magnitude faster than timestepped physics; 10,000 cycles in <10 minutes is trivially met (expected: seconds), and 100,000-cycle runs stay feasible.
- Reproducibility (FR-015/016): a single seeded RNG stream gives bit-exact repeatability; physics engines add determinism risks (solver iteration order, floating-point sensitivity).
- Constitution II (Hardware-Faithful): model parameters map directly to measurable physical quantities (passage clearances, stroke length, actuation energy, friction coefficients, pill dimensions/mass), so candidate designs are evaluated by configuration, not code.
- Constitution IV (Simplicity): zero runtime dependencies; the model is explainable end-to-end at a design review.
- The required failure modes (jam, stacking, double-drop, missed dispense) are geometric/friction phenomena at the singulation point that a 2D clearance-and-force-balance model captures adequately for comparative design evaluation.

**Alternatives considered**:
- **pymunk (Chipmunk2D rigid-body physics)**: Rejected for v1. Native dependency chain (pip wheels, build variance across student laptops), harder determinism guarantees, and fidelity beyond what singulation metrics require. Kept as a documented future validation option if the team wants higher-fidelity spot checks of surprising results.
- **Full 3D DEM (discrete element method)**: Rejected. Massively exceeds capstone scope and the 10-minute performance budget; spec explicitly leaves 2D vs 3D to planning.
- **Pure statistical Monte Carlo (no geometry)**: Rejected. Would violate Constitution II — results could not be traced to geometric/physical parameters of a candidate design.

## R2. Pill geometry and variability model

**Decision**: Model each pill as a 2D profile plus mass and Coulomb friction coefficient:
- Round tablet → circle (diameter, thickness for mass).
- Oblong caplet → stadium (length × width with semicircular ends).
- Capsule → stadium (length × width), typically lighter per volume.
- Orientation sampled as an angle at the singulation point; friction sampled per pill within documented ranges.

**Rationale**: 2D profiles capture the singulation-relevant dimension (maximum transverse width vs passage clearance) that drives jams, stacking, and double-drops. Stadium profiles handle caplets and capsules uniformly.

**Alternatives considered**: full 3D ellipsoids/tablet shapes (rejected — see R1); bounding-box-only model (rejected — cannot distinguish orientation effects such as a caplet standing on edge, an explicit edge case).

**Realistic ranges (to be confirmed against published pill-size data / team measurements during implementation, per spec Assumptions)**:
- Round tablets: Ø ~3–13 mm, thickness ~2–6 mm, mass ~50–800 mg.
- Oblong caplets: length ~6–19 mm, width ~3–8 mm.
- Capsules: sizes 5→000, length ~11–26 mm, width ~3–10 mm.
- Friction coefficient μ: ~0.2 (smooth coated) to ~0.6+ (sticky/uncoated).

## R3. Randomness and reproducibility

**Decision**: One `random.Random(seed)` instance per SimulationRun; no use of the global `random` module state. If the user omits a seed, one is generated and recorded. Sub-streams (pill population sampling vs per-cycle process noise) are derived deterministically from the run seed (e.g., `seed` namespacing via `Random((run_seed, "population"))` / `Random((run_seed, "cycles"))`) so population changes stay explicit in the config record.

**Rationale**: FR-015/016/017 require identical outcomes for identical seed+config; instance RNGs avoid hidden coupling and make the reproducibility property testable (SC-004: 100% identical cycles on re-run).

**Alternatives considered**: `numpy.random` (rejected — adds a dependency for no needed capability); global `random.seed()` (rejected — fragile under test parallelism).

## R4. Reporting and export formats

**Decision**: Three stdlib-backed artifacts per run:
- JSON run record (canonical): full config, seed, envelope, per-cycle DispenseEvents, aggregates. Machine-readable evidence for design reviews (FR-020).
- CSV per-cycle export: one row per actuation (cycle index, pills dispensed, failure mode, key state fields).
- Markdown summary report: aggregate + per-category success rates vs the 99.5% threshold (pass/fail verdict per SC-002), failure-mode breakdown, config digest.

**Rationale**: json/csv/string templates are all stdlib (Constitution IV); the trio covers machine-readable, spreadsheet-friendly, and human-reviewable citation needs without any export dependency.

**Alternatives considered**: pandas/pyarrow export (rejected — dependency cost unjustified); PDF report (rejected — out of scope for capstone v1).

## R5. Test strategy (Constitution III)

**Decision**: pytest (dev-only dependency) with three layers:
1. **Unit tests** (`tests/unit/`): model validation, envelope validation, outcome classification, failure-mode attribution, export schema shape.
2. **Statistical/property invariant checks** (`tests/statistical/`): seeded runs asserting invariants rather than exact values — 100% of cycles classified (SC-001); empty-reservoir cycles never counted as violations (FR-012); failure-mode breakdown accounts for 100% of violations (SC-003); same seed + config ⇒ identical outcomes (SC-004); distribution sanity (sampled pill properties within configured ranges).
3. **Integration tests** (`tests/integration/`): CLI run → export → re-run reproduce → compare two mechanisms.

**Rationale**: Matches the spec's "property-based/statistical invariant checks" intent with a single, familiar, justified dependency.

**Alternatives considered**: hypothesis for property-based testing (rejected for v1 — seeded randomized invariant checks suffice per Constitution IV; adopt later if the team wants shrinking on failures); unittest (rejected — pytest is the requested, more expressive default).

## R6. CLI and interface shape

**Decision**: `argparse`-based CLI (`dispenser-sim` or `python -m dispenser_sim`) with subcommands: `validate` (config + envelope check), `run` (execute a seeded run, write artifacts), `report` (regenerate summaries from a run record), `compare` (side-by-side reliability for ≥2 mechanisms under identical seeds/distribution). Library core is importable without the CLI.

**Rationale**: stdlib-only (Constitution IV); subcommands map 1:1 to the spec's user stories (US1 run, US2 report/verify, US3 reproduce/compare).

**Alternatives considered**: click/typer (rejected — unjustified dependency); JSON-over-stdin API (rejected — no consumer in scope).

## Open items for implementation phase

- Confirm numeric pill ranges and envelope limits with the team; store them in version-controlled configs (`configs/`).
- Define the exact singulation clearance/friction equations in the mechanism model with citations or measurement plans (Constitution II).
