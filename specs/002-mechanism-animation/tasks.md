# Tasks: Mechanism Animation and Run Replay

**Input**: Design documents from `/specs/002-mechanism-animation/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: INCLUDED — required by Constitution III (Testability & Verification), the plan's Testing section, and the feature request (pytest; tests/unit + tests/integration; GUI tests auto-skip without a display; headless `animate --check` for CI).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single project (per plan.md): product code in `src/dispenser_sim/`, tests in `tests/`. New subpackage: `src/dispenser_sim/animation/` (`loader.py`, `frames.py`, `spans.py`, `player.py`, `geometry.py`, `tkview.py`). `tkview.py` is the ONLY module that imports tkinter; `cli.py` imports it lazily inside the `animate` subcommand. Environment: after src edits, reinstall non-editable with `.venv/bin/pip install .` (editable installs broken by the macOS UF_HIDDEN quirk); pytest works via `pythonpath = ["src"]` in pyproject.toml.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the animation subpackage skeleton and test infrastructure that every later phase builds on.

- [X] T001 Create the animation subpackage skeleton: src/dispenser_sim/animation/__init__.py (docstring only — must NOT import tkinter or any animation submodule, so `import dispenser_sim.animation` works headless) per the plan's Project Structure
- [X] T002 [P] Create tests/conftest.py with a display/Tk-availability check (attempt `tkinter.Tk()` and destroy, or detect missing `$DISPLAY`/Tk import failure) exposing an auto-skip marker/fixture so GUI tests skip cleanly on headless machines (research.md Decision 7)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure, display-free replay core (loader → frames → spans). MUST be complete before ANY user story work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Implement src/dispenser_sim/animation/loader.py: a `RunSource` protocol (ordered `events()`, `mechanism`, `run_id`, `seed`, `geometry_approximate` — this is the Phase-2 live-animation seam, research.md Decision 9), `JsonRunSource` wrapping simulation/replay.load_run_record for run.json (canonical), and `CsvRunSource` reconstructing DispenseEvents from cycles.csv rows (mechanism=None, geometry_approximate=True per FR-003). Validate on load: events non-empty, ordered and contiguous by cycle_index; raise clear load errors for missing path, malformed JSON, bad schema_version, non-contiguous/reordered cycles, and missing both run.json and cycles.csv (contracts/cli-contract.md errors table)
- [X] T004 [P] Implement src/dispenser_sim/animation/frames.py: pure, lazy O(1) `CycleFrame` derivation from one DispenseEvent (cycle_index, outcome, failure_mode, pills_dispensed, jam_persistent, pill snapshot, happy-path-or-truncated phase tuple per data-model.md). Frames never contradict their event (e.g. MULTI_DOSE requires pills_dispensed >= 2); no re-simulation, no randomness (FR-002); frames are never stored for the whole run (FR-014)
- [X] T005 [P] Implement src/dispenser_sim/animation/spans.py: `FailureSpan` (failure_mode, start_cycle, end_cycle, length) coalescing consecutive JAM cycles in one O(n) pass (single-cycle jams are length-1 spans), and `SpanIndex` holding the sorted violation-cycle list plus spans, built once at load, supporting bisect-based next/previous failure lookup where a jam span counts once at its start (FR-008, FR-013; research.md Decisions 4–5)

**Checkpoint**: Any run directory loads headlessly; frames and spans derive from the record with no display and no tkinter import.

---

## Phase 3: User Story 1 - Replay a Recorded Run as an Animation (Priority: P1) 🎯 MVP

**Goal**: Replay any existing runs/<run_id>/ as a cycle-by-cycle Tkinter Canvas animation with every cycle annotated by outcome/failure mode and each failure state visually distinguishable in the mechanism view (FR-001..FR-009, FR-015, FR-017, FR-018).

**Independent Test**: Replay an existing recorded run end to end; verify 100% of cycles appear in recorded order with outcomes/failure modes matching run.json exactly (spot-checked against the record), and each state (SINGLE, MISSED_DISPENSE, JAM, STACKING, DOUBLE_DROP/multi-dose, NO_PILL_AVAILABLE, UNCLASSIFIED, FAULT) is visually identifiable per the contracts/player-interface.md legend without reading any log or CSV.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T006 [P] [US1] Unit tests for the loader in tests/unit/test_animation_loader.py: JsonRunSource loads an existing runs/<run_id>/run.json (events ordered, mechanism embedded, seed preserved); CsvRunSource reconstructs the same outcome sequence from cycles.csv with geometry_approximate=True; error paths (missing path, corrupt JSON, non-contiguous cycles, directory with neither record) raise the contract's load errors
- [X] T007 [P] [US1] Unit tests for frame derivation in tests/unit/test_animation_frames.py: for every classified state (SINGLE, ZERO_DOSE+MISSED_DISPENSE, ZERO_DOSE+JAM, ZERO_DOSE+STACKING, MULTI_DOSE+DOUBLE_DROP with actual count, NO_PILL_AVAILABLE, UNCLASSIFIED, interrupted/FAULT) the derived frame carries the event's outcome, failure mode, pills_dispensed, jam_persistent, and pill attributes verbatim
- [X] T008 [P] [US1] Unit tests for span coalescing in tests/unit/test_animation_spans.py: multi-cycle jams coalesce into one span with correct start/end/length; single-cycle jams are length-1 spans; span boundaries identifiable; violation index sorted for bisect navigation

### Implementation for User Story 1

- [X] T009 [P] [US1] Implement src/dispenser_sim/animation/geometry.py: pure mapping of MechanismConfig to a normalized Layout (reservoir box with capacity, pill path polyline, singulation/metering zone sized from passage_clearance_mm and metering_geometry, release point, reset position) with slider-gate (linear-stroke) and rotary-disk templates selected from metering_geometry keys plus a generic config-driven fallback (FR-004/FR-005; research.md Decision 3)
- [X] T010 [US1] Implement src/dispenser_sim/animation/player.py: pure `PlaybackSession` state machine (position, PLAYING/PAUSED/STOPPED, speed clamped to [0.25, 120] cycles/s) with play/pause/step(±1)/seek(n) clamped at both ends, attaching the SpanIndex from T005; any step/seek forces PAUSED; playing off the end lands on the last cycle PAUSED (FR-012; data-model.md Playback Session transitions)
- [X] T011 [US1] Implement src/dispenser_sim/animation/tkview.py — the ONLY tkinter-importing module: Canvas mechanism view rendering Layout (T009) + CycleFrame (T004); always-visible annotation bar (`cycle <i> / <n> · <OUTCOME> [· <FAILURE_MODE>] [· ×<k> released]` plus pill shape/dimensions); the full visual legend from contracts/player-interface.md (stuck pill for JAM persisting across the span, stacked pills for STACKING, truthful ×k released badge for DOUBLE_DROP/multi-dose, retained pill for MISSED_DISPENSE, distinct non-failure style for NO_PILL_AVAILABLE per FR-009, distinct hatch for UNCLASSIFIED with recorded state inspectable, mid-stroke fault marker for FAULT cycles); truthful reservoir counts (visible sample + `+N` aggregate, depletion marked at the exact cycle); `geometry approximate (cycles.csv only)` in-window banner in CSV-fallback mode (FR-003/004/006/007/008/009)
- [X] T012 [US1] Wire the `animate` subcommand into src/dispenser_sim/cli.py: argparse options `--run PATH` (run directory or run.json directly), `--check`, `--speed N` (default 4, clamped), `--start-cycle N` (default 0, clamped); lazy-import tkview ONLY in GUI mode; print run identity (run_id, cycles, source mode) on stdout; exit codes per contract (0 success, 1 with human-readable stderr on failure, 2 usage); exact error messages from contracts/cli-contract.md including `error: animation requires a display (tkinter); use --check for headless validation` with no traceback; never write to the run directory and never re-simulate (FR-002/FR-018)
- [X] T013 [US1] Implement headless `--check` mode in src/dispenser_sim/cli.py over the pure core: load the run via loader.py, build the SpanIndex, derive every frame via frames.py, print run_id, cycle count, failure-mode breakdown, jam-span count, and `frames: OK (<n> derived)`; tkinter is never imported in this mode; exit 0 (contracts/cli-contract.md; SC-001 machine-verifiable)
- [X] T014 [P] [US1] Integration tests in tests/integration/test_animate_cli.py: `animate --check` against an existing runs/<run_id> exits 0 and prints the machine-verifiable summary with `frames: OK (<n> derived)` where n equals the record's cycle count; CSV-fallback directory replays with the `geometry approximate (cycles.csv only)` stdout note; missing path and empty directory exit 1 with the contract's stderr messages (quickstart scenarios 2, 5, 6)
- [X] T015 [P] [US1] GUI smoke test in tests/integration/test_animate_gui.py (auto-skips headless via T002): player opens paused at cycle 0, Space plays, annotation matches the record for spot-checked cycles, quitting exits 0 (quickstart scenario 1)

**Checkpoint**: User Story 1 is fully functional and testable independently — `animate --check` passes in CI with no display, and the GUI player faithfully replays any recorded run.

---

## Phase 4: User Story 2 - Animate Live from the Engine (Priority: P2) — Phase 2, design seam only

**Goal**: NOT in MVP scope (2026-09-19 clarification; FR-010/FR-011 deferred). This phase only proves the RunSource seam is engine-ready so a future engine-driven source needs no changes to frames/spans/player/tkview.

**Independent Test**: A test double implementing the RunSource protocol drives the pure player/frames/spans pipeline identically to a recorded-run source, demonstrating the seam required for FR-011 (live ≡ replay) when live lands.

- [X] T016 [P] [US2] Add tests/unit/test_animation_runsource.py: a minimal in-memory RunSource implementation (ordered synthetic DispenseEvents + a MechanismConfig) feeding frames.py (T004), spans.py (T005), and player.py (T010); assert the derived frames/spans/navigation match the recorded-run path for equivalent events, proving no replay-only coupling exists (research.md Decision 9)

**Checkpoint**: The live-animation seam is verified by test; no live engine animation is built in this iteration.

---

## Phase 5: User Story 3 - Navigate Long Runs (Priority: P3)

**Goal**: Open and navigate 10,000+ cycle runs responsively: jump to cycle, next/previous failure, single-step through jam spans, adjustable speed — without pre-rendering (FR-012/013/014, SC-004). Optional export (FR-016) is NOT in this iteration.

**Independent Test**: Open a 10,000-cycle run (create one with `dispenser-sim run --mechanism configs/mechanisms/slider_gate_v1.json --pills configs/pills/standard_mix.json --cycles 10000 --seed 42` if needed); jump to cycle 9999, jump to the previous failure, single-step backward — each navigation completes in under 2 seconds with correct annotations at every landed position (quickstart scenario 7).

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T017 [P] [US3] Unit tests for player navigation in tests/unit/test_animation_player.py: seek clamps at both ends; step(±1) pauses; next_failure/previous_failure via SpanIndex with jam spans counting once at their start; speed doubles/halves and clamps at [0.25, 120]; changing speed never re-derives frames or alters annotations
- [X] T018 [P] [US3] Performance test in tests/unit/test_animation_performance.py: over a synthetic 10,000-event run, SpanIndex construction plus jump-to-index and next/previous-failure seeks each complete well under 2 seconds, and no frames are derived until requested (lazy derivation, FR-014/SC-004)

### Implementation for User Story 3

- [X] T019 [US3] Extend src/dispenser_sim/animation/tkview.py with the full navigation contract: keyboard controls per contracts/player-interface.md (Space play/pause, Right/Left step, +/- speed, g jump-to-cycle prompt, n/p next/previous failure, Home/End, q or Esc quit exiting 0); bottom timeline strip with violation ticks, jam spans drawn as continuous bands with labeled start/end cycles, and a current-position marker; status line showing playback state, speed, and the CSV-fallback banner when active (FR-008/012/013)
- [X] T020 [US3] Extend tests/integration/test_animate_gui.py (auto-skips headless) with the long-run navigation scenario: open the 10,000-cycle run, `g` to cycle 9999, `p` to the previous failure, step backward through a jam span verifying the continuous band and stuck-pill persistence; assert annotations correct at each landed position (quickstart scenarios 4 and 7)

**Checkpoint**: All user stories are independently functional; long runs are navigable within SC-004 budgets.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, regression safety, and end-to-end validation.

- [X] T021 [P] Update README.md with the `animate` subcommand (usage, keyboard controls summary, `--check` headless mode) and the Tk prerequisite note (python3-tk OS package on Debian/Ubuntu; environment prerequisite, not a Python dependency)
- [X] T022 Reinstall and run full verification from the repo root: `.venv/bin/pip install .` then `.venv/bin/pytest tests/unit tests/statistical tests/integration` — all new animation tests pass and ALL feature 001 tests pass unchanged (FR-018, SC-005)
- [X] T023 Execute every quickstart.md scenario (1–8) and record the results in specs/002-mechanism-animation/quickstart.md or the PR description: GUI scenarios (1, 3, 4, 7, 8) where a display is available; `--check` and error-path scenarios (2, 5, 6) must pass everywhere including headless

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories. Respects the required order: geometry → player → tkview → CLI wiring → tests.
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - seam-verification only; no dependency on US1's view layer.
- **User Story 3 (P3)**: Depends on US1's player (T010) and view (T011) since it extends tkview.py with navigation; its pure-core tests (T017/T018) can start after Foundational.

### Within Each User Story

- Tests (included) MUST be written and FAIL before implementation
- Pure core modules before the tkview view layer
- View layer before CLI wiring
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- Phase 1: T001 and T002 can run in parallel
- Phase 2: T004 and T005 can run in parallel once T003 defines the loader contract (all three are different files; T003 is the natural lead)
- Phase 3 tests: T006, T007, T008 in parallel; T014, T015 in parallel
- Phase 3 implementation: T009 (geometry.py) in parallel with T010 (player.py, needs T005) once Foundational completes
- Phase 5 tests: T017 and T018 in parallel
- US2 (T016) can run in parallel with any US1/US3 work

---

## Parallel Example: User Story 1

```bash
# Launch all foundational-adjacent tests for User Story 1 together:
Task: "Unit tests for the loader in tests/unit/test_animation_loader.py"
Task: "Unit tests for frame derivation in tests/unit/test_animation_frames.py"
Task: "Unit tests for span coalescing in tests/unit/test_animation_spans.py"

# Launch parallel implementation tracks once Foundational completes:
Task: "Implement src/dispenser_sim/animation/geometry.py layout templates"
Task: "Implement src/dispenser_sim/animation/player.py PlaybackSession"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: `animate --check` green in CI; GUI replay faithful on an existing run (quickstart scenarios 1–3, 5, 6)
5. Demo-ready replay MVP (SC-001, SC-003, SC-006)

### Incremental Delivery

1. Setup + Foundational → pure replay core ready (headless, testable)
2. Add User Story 1 → validate independently → MVP (replay + controls + `--check`)
3. Add User Story 2 seam test → Phase-2 readiness proven without building live mode
4. Add User Story 3 → long-run navigation → full MVP+ scope
5. Polish: README, full regression (FR-018), quickstart validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- tkinter must stay confined to tkview.py; cli.py imports it lazily so all other subcommands work with no Tk installed (SC-005)
- Replay never re-simulates and never writes to run directories (FR-002/FR-018)
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
