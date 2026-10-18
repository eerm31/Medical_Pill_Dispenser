# Implementation Plan: Dispensing Mechanism Simulation

**Branch**: `001-dispensing-mechanism-simulation` | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-dispensing-mechanism-simulation/spec.md`

## Summary

Build an offline software simulation of the smart medical dispenser's dispensing mechanism. For a parametric candidate mechanism and a configurable pill population (round tablets, oblong caplets, capsules; varying size, mass, friction, orientation), the simulation executes seeded actuation cycles, classifies each cycle as zero / exactly-one / multiple pills dispensed, detects and classifies failure modes (jam, stacking, double-drop, missed dispense), and reports single-dispense success rates in aggregate and per pill category against the 99.5% pass threshold, with exportable, reproducible run records. Technical approach (per research.md): a pure-Python, standard-library-first, seeded 2D kinematic/pseudo-physics model of the pill path (reservoir → singulation/metering → release → reset), delivered as a CLI + importable library, validated with pytest unit and seeded statistical invariant tests.

## Technical Context

**Language/Version**: Python 3.11+ (development machine has 3.13; code must run on 3.11+)

**Primary Dependencies**: Python standard library only for the product code (`random`, `math`, `json`, `csv`, `dataclasses`, `argparse`, `statistics`, `pathlib`). Dev-only dependency: `pytest`. Any further dependency requires justification per Constitution IV (see research.md — the pymunk physics engine was evaluated and rejected).

**Storage**: Local files. Run records: JSON (canonical, machine-readable: config + seed + per-cycle events), CSV (per-cycle export), Markdown (human-readable design-review report). Configs: JSON mechanism and pill-distribution files.

**Testing**: pytest — unit tests per model plus seeded property-based/statistical invariant checks (outcome exhaustiveness, failure-mode accounting, empty-reservoir exclusion, same-seed reproducibility identity).

**Target Platform**: Cross-platform desktop CLI (macOS / Linux / Windows) on a typical student laptop; no hardware in the loop.

**Project Type**: Single project — CLI application with an importable Python library core.

**Performance Goals**: ≥10,000 actuation cycles in <10 minutes on a typical student laptop (SC-005); design target is seconds-to-minutes via per-cycle analytic sampling (no timestepped physics); 100,000-cycle runs must remain feasible.

**Constraints**: All randomness seeded and recorded (FR-015/016/017); mechanism configs carry physical units (mm, g, degrees, J) and are validated against a configurable Portability Envelope (FR-004); every simplification documented with physical justification (FR-005); single-dispense pass threshold 99.5% (SC-002).

**Scale/Scope**: Single-mechanism and side-by-side mechanism comparison runs; 3 pill shape categories with documented realistic ranges; runs of 10^3–10^5 cycles.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Gate (Constitution v1.0.0) | Plan Alignment | Verdict |
|---|---|---|
| I. Single-Dose Integrity (NON-NEGOTIABLE) | The plan's entire purpose is per-actuation checking of the exactly-one-pill invariant (FR-010/011/012), with every violation attributed to a classified failure mode (FR-013/014) and a 99.5% pass gate (SC-002). No code path can mark the feature complete with a known unresolved violation. | PASS |
| II. Simulation-First, Hardware-Faithful | Mechanisms are parametric physical models in physical units (mm, g, degrees, J) (FR-003); research.md mandates documenting every simplification with physical justification (FR-005); pill ranges documented from published data / measurement plan. | PASS |
| III. Testability & Verification | pytest unit + seeded statistical invariant checks across pill distributions; all runs reproducible via recorded seeds; seeds + configs persisted with results (FR-015–017). | PASS |
| IV. Simplicity & Capstone Pragmatism | Standard-library-first; the only dependency is dev-only pytest; research.md explicitly evaluates and rejects heavier options (pymunk, hypothesis) with justification. | PASS |
| V. Portability Constraints | Configs are validated/flagged against a documented, configurable Portability Envelope (dimensions, mass, actuation energy) before runs (FR-004); envelope values live in version-controlled config/docs. | PASS |

**Post-Design Re-Check (after Phase 1)**: The data model, contracts, and quickstart introduce no new dependencies, no weakening of the invariant checks, and no portability assumption outside the envelope. All five gates remain PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-dispensing-mechanism-simulation/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── cli-contract.md
│   ├── config-schema.md
│   └── run-record-schema.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/dispenser_sim/
├── __init__.py
├── models/              # Pill, PillDistribution, MechanismConfig, PortabilityEnvelope,
│                        # ActuationCycle, DispenseEvent, FailureMode, SimulationRun
├── mechanism/           # Parametric 2D kinematic/pseudo-physics singulation model
├── simulation/          # Seeded run engine: cycle loop, outcome classification,
│                        # failure-mode detection, reproducibility
├── reporting/           # Aggregate + per-category success rates, failure-mode
│                        # breakdown, 99.5% verdict, JSON/CSV/Markdown export
└── cli.py               # argparse entry point: validate / run / report / compare

configs/                 # Example mechanism configs, pill distributions, portability envelope

tests/
├── unit/                # Per-model and per-classifier unit tests
├── statistical/         # Seeded property/statistical invariant checks
└── integration/         # End-to-end CLI run + export + reproduce tests
```

**Structure Decision**: Option 1 (single project). A single importable package `dispenser_sim` under `src/` keeps the simulation core independent of the CLI (so tests and future notebooks/UIs can drive it directly) while staying dependency-light per Constitution IV.

## Complexity Tracking

> No constitution violations to justify. All gates pass; no complexity beyond the five principles is introduced.
