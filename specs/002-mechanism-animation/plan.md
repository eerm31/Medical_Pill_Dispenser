# Implementation Plan: Mechanism Animation and Run Replay

**Branch**: `002-mechanism-animation` | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-mechanism-animation/spec.md`

## Summary

Build a replay-only animated player for recorded simulation runs. The MVP loads any `runs/<run_id>/` directory (canonical `run.json`, with `cycles.csv` fallback), and plays the run cycle by cycle as a schematic 2D animation of the configured mechanism — pills moving through presentation, singulation/metering, release, and reset — with every cycle annotated by its recorded outcome and failure mode. Failure modes are visually distinguishable in the mechanism view itself (stuck pill for JAM incl. multi-cycle persistence spans, stacked pills for STACKING, truthful released-count badge for multi-dose, retained pill for MISSED_DISPENSE, a distinct non-failure style for NO_PILL_AVAILABLE). Playback supports play/pause/step/speed, jump-to-cycle, and next/previous failure, and handles 10,000+ cycle runs without pre-rendering. Technical approach (per research.md): a Tkinter (stdlib) Canvas player over a pure, display-free core (loader, frames, spans, player, geometry); frames are derived lazily and deterministically from the persisted `DispenseEvent` record — never re-simulated (FR-002). Live engine-driven animation (FR-010/011) and shareable-artifact export (FR-016) are Phase 2 / optional and are only designed for, not built.

## Technical Context

**Language/Version**: Python 3.11+ (development machine has 3.13; code must run on 3.11+)

**Primary Dependencies**: Python standard library only for product code — reusing feature 001 modules (`json`, `csv`, `dataclasses`, `enum`, `bisect`, `pathlib`) plus `tkinter` for the MVP player. Dev-only dependency: `pytest`. No new dependency is introduced (FR-017); see research.md Decision 1 for the rejected non-stdlib alternatives (pygame, matplotlib, PyQt, web server) and the curses rejection.

**Storage**: Read-only consumption of existing run artifacts: `runs/<run_id>/run.json` (canonical) and `cycles.csv` (fallback per FR-003). The animation feature writes nothing to run directories.

**Testing**: pytest — unit tests for the pure animation core (loader, frames, spans, player navigation, geometry mapping); integration tests for the `animate` CLI in headless `--check` mode; GUI tests marked and auto-skipped when no display/Tk is available. All feature 001 tests must pass unchanged (FR-018, SC-005).

**Target Platform**: Cross-platform desktop (macOS / Linux / Windows) on a typical student laptop, fully offline (FR-015). Linux note: the OS package `python3-tk` may be required; it is an environment prerequisite, not a Python dependency.

**Project Type**: Single project — CLI application extension (`animate` subcommand) with an importable library core (`src/dispenser_sim/animation/`).

**Performance Goals**: Open and navigate runs of ≥10,000 cycles with each navigation action (jump to index, next/previous failure) completing in < 2 s on typical student laptop hardware (SC-004); no pre-rendering of cycles (FR-014); playback up to 120 cycles/second.

**Constraints**: Stdlib-only product code (Constitution IV, FR-017); replay is data-faithful — 100% of cycles in recorded order, no re-simulation, no re-rolled randomness (FR-002, SC-001); replay works even when the mechanism config no longer exists in `configs/` because the run record embeds it (spec edge case); pill counts remain truthful with aggregate indicators allowed (spec edge case); environment quirk on this machine: macOS UF_HIDDEN breaks editable installs, so install non-editable (`.venv/bin/pip install .`) after src edits — pytest is unaffected via `pythonpath = ["src"]` in pyproject.toml.

**Scale/Scope**: Two mechanism layout templates at MVP (slider gate, rotary disk) plus a generic config-driven fallback (FR-005); runs of 10^3–10^5 cycles; single-user local viewing; no side-by-side comparison animations (out of scope per spec Assumptions).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Gate (Constitution v1.0.0) | Plan Alignment | Verdict |
|---|---|---|
| I. Single-Dose Integrity (NON-NEGOTIABLE) | The feature is a read-only visualization of feature 001's classification; it never alters outcomes, never re-simulates, and renders every violation (JAM, STACKING, DOUBLE_DROP, MISSED_DISPENSE, UNCLASSIFIED) as a visually distinct, labeled state (FR-006/007). NO_PILL_AVAILABLE is styled as a non-violation, consistent with FR-012 of feature 001. No code path can hide or soften a single-dose violation. | PASS |
| II. Simulation-First, Hardware-Faithful | Mechanism visuals are schematic but driven by the physical config (`passage_clearance_mm`, `metering_geometry`, dimensions in mm) with physical units shown as labels; the CSV-fallback mode explicitly banners its geometry as approximate rather than fabricating fidelity (FR-003/004/005). The animation adds no physical assumptions. | PASS |
| III. Testability & Verification | Pure, display-free core (loader/frames/spans/player/geometry) is fully unit-testable; headless `animate --check` makes frame fidelity machine-verifiable in CI (SC-001); GUI tests skip gracefully without a display. Reproducibility is inherited: replay consumes the seeded record and adds no randomness. | PASS |
| IV. Simplicity & Capstone Pragmatism | Stdlib-only (tkinter is part of CPython); no new dependencies; research.md documents why heavier options were rejected. The view layer is a thin shell over small pure modules a student team can explain in a design review. | PASS |
| V. Portability Constraints | No change to any physical assumption; the feature reads existing configs and records. Player resource use (memory, CPU) is bounded by the events list plus O(1) frame derivation, documented in research.md Decision 4. | PASS |

**Post-Design Re-Check (after Phase 1)**: The data model, contracts, and quickstart introduce no dependency, no write path into run artifacts, no weakening of feature 001's invariant checks, and no new portability assumption. The `RunSource` seam (research.md Decision 9) prepares Phase 2 live animation without building it. All five gates remain PASS. No deviations required.

## Project Structure

### Documentation (this feature)

```text
specs/002-mechanism-animation/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── cli-contract.md          # new `animate` subcommand
│   └── player-interface.md      # keyboard, navigation, visual legend
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/dispenser_sim/
├── __init__.py
├── models/              # (feature 001, reused) Pill, PillDistribution,
│                        # MechanismConfig, PortabilityEnvelope, ActuationCycle,
│                        # DispenseEvent, Outcome, SimulationRun
├── mechanism/           # (feature 001, reused) singulation, envelope validation
├── simulation/          # (feature 001, reused) engine, rng, failure_modes,
│                        # replay.load_run_record (the JSON run source)
├── reporting/           # (feature 001, reused) export/markdown/comparison
├── animation/           # NEW — feature 002 (see data-model.md Module Mapping)
│   ├── __init__.py
│   ├── loader.py        # RunSource, JsonRunSource (run.json), CsvRunSource (fallback)
│   ├── frames.py        # CycleFrame derivation from DispenseEvent (pure)
│   ├── spans.py         # FailureSpan coalescing + SpanIndex navigation (pure)
│   ├── player.py        # PlaybackSession state machine: play/pause/step/speed/seek (pure)
│   ├── geometry.py      # MechanismConfig -> Layout templates (slider/rotary/generic) (pure)
│   └── tkview.py        # Tkinter canvas player (thin; the only tkinter importer)
└── cli.py               # EXTENDED — new `animate` subcommand (contracts/cli-contract.md)

tests/
├── unit/                # EXTENDED — loader, frames, spans, player, geometry tests
├── statistical/         # (feature 001, unchanged)
└── integration/         # EXTENDED — animate --check on recorded runs, CSV
                         # fallback, error paths; GUI smoke tests skip headless
```

**Structure Decision**: Option 1 (single project), matching feature 001. The animation feature is a new sub-package `animation/` whose pure modules are importable and testable without a display; `tkview.py` is the only module that imports tkinter, and it is imported lazily by the `animate` subcommand so the rest of the CLI works with no Tk present (SC-005).

## Complexity Tracking

> No constitution violations to justify. All gates pass; no complexity beyond the five principles is introduced. No new dependencies (FR-017 satisfied with stdlib tkinter).
