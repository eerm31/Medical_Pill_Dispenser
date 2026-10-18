---

description: "Task list for 001-dispensing-mechanism-simulation"
---

# Tasks: Dispensing Mechanism Simulation

**Input**: Design documents from `/specs/001-dispensing-mechanism-simulation/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — the plan (research.md R5) mandates a pytest suite (unit + statistical invariant + integration) and Constitution III requires automated, repeatable verification of the single-dose invariant. Write story tests FIRST and confirm they FAIL before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes exact file paths

## Path Conventions

Single project (per plan.md): `src/dispenser_sim/`, `configs/`, `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, packaging, and version-controlled example configs

- [X] T001 Create project structure per plan.md: src/dispenser_sim/ with __init__.py and subpackages models/, mechanism/, simulation/, reporting/ (each with __init__.py), plus tests/unit/, tests/statistical/, tests/integration/, and configs/
- [X] T002 Create pyproject.toml at repo root: setuptools build, requires-python >=3.11, zero runtime dependencies, optional dev dependency pytest, console script `dispenser-sim = dispenser_sim.cli:main`; verify with `pip install -e .[dev]`
- [X] T003 [P] Create configs/portability_envelope.json with max_dimensions_mm (200×100×80), max_mass_g 1000.0, max_actuation_energy_j 2.0 per contracts/config-schema.md
- [X] T004 [P] Create configs/mechanisms/slider_gate_v1.json: a valid slider-gate mechanism config with all required fields and a documented simplification, per contracts/config-schema.md
- [X] T005 [P] Create configs/pills/standard_mix.json: pill distribution over round_tablet/oblong_caplet/capsule with realistic ranges from research.md R2, per contracts/config-schema.md
- [X] T006 [P] Create configs/mechanisms/oversized_demo.json: a mechanism config that violates the portability envelope (dimensions, mass, and/or actuation energy) for quickstart Scenario 2

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core models, config loading/validation, and seeded RNG infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 [P] Implement Pill model in src/dispenser_sim/models/pill.py: ShapeCategory enum (ROUND_TABLET, OBLONG_CAPLET, CAPSULE), fields per data-model.md (length/width/thickness mm, mass g, friction_coefficient, orientation degrees) with validation, and 2D profile derivation (circle for round tablets, stadium for caplets/capsules) including maximum transverse width at a given orientation (research.md R2)
- [X] T008 [P] Implement PortabilityEnvelope model in src/dispenser_sim/models/envelope.py: dataclass with max_dimensions_mm, max_mass_g, max_actuation_energy_j plus a JSON loader that rejects unknown fields
- [X] T009 Implement MechanismConfig model in src/dispenser_sim/models/mechanism.py: dataclass per data-model.md (name, reservoir_capacity, passage_clearance_mm, metering_geometry, actuation_energy_j, stroke_time_s, tolerances_mm, overall_dimensions_mm, mass_g, simplifications) with JSON loading that rejects unknown fields, enforces positive numerics (tolerances ≥ 0), and requires each simplification to state a physical justification (FR-003/005)
- [X] T010 Implement PillDistribution model in src/dispenser_sim/models/distribution.py: dataclass per data-model.md (reservoir_size, category_weights, per-category size/mass ranges, friction range, orientation distribution) with JSON loading and validation — weights sum to 1.0 ±1e-9, only supported shape keys, every range 0 < min ≤ max; out-of-realistic-range values accepted but flagged (FR-006–009)
- [X] T011 Implement envelope validation in src/dispenser_sim/mechanism/validation.py: check a MechanismConfig against a PortabilityEnvelope and return the list of violated constraints with their limits (dimensions, mass, actuation energy) per FR-004 and the cli-contract `validate` behavior (depends on T008, T009)
- [X] T012 Implement seeded RNG management in src/dispenser_sim/simulation/rng.py: one random.Random per run, deterministic sub-streams for population sampling vs per-cycle process noise derived from the run seed (e.g. namespacing per research.md R3); never touch global random state (FR-015/016)
- [X] T013 Implement pill population sampler in src/dispenser_sim/simulation/population.py: draw a reservoir of Pill instances from a PillDistribution using the seeded population sub-stream, sampling shape by category_weights and size/mass/friction/orientation within configured ranges (depends on T007, T010, T012)

**Checkpoint**: Foundation ready — all configs load and validate; user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Simulate a Candidate Mechanism (Priority: P1) 🎯 MVP

**Goal**: Run a seeded simulation of a candidate mechanism over N actuation cycles; every cycle produces exactly one recorded, classified outcome (zero / one / multiple pills); artifacts run.json + cycles.csv written per run

**Independent Test**: Configure one mechanism and one pill distribution, run 1,000 cycles via the CLI, and verify run.json contains exactly 1,000 classified events with no gaps and no ambiguous cycles (spec US1, SC-001); envelope-violating configs are refused with named constraints (quickstart Scenarios 1–2)

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T014 [P] [US1] Write unit tests in tests/unit/test_cycle.py: every actuation cycle resolves to exactly one classified outcome from {SINGLE, ZERO_DOSE, MULTI_DOSE, NO_PILL_AVAILABLE}; cycle state machine transitions LOADED → PRESENTED → SINGULATED → RELEASED → RESET and FAULT paths still yield a classified outcome (FR-001/002)
- [X] T015 [P] [US1] Write integration test in tests/integration/test_run_cli.py: `run` with slider_gate_v1 + standard_mix at 1,000 cycles exits 0, writes run.json/cycles.csv/report.md, and run.json has exactly 1,000 events with contiguous cycle_index 0..999; `validate` on oversized_demo exits 1 naming each violated constraint; `run` refuses it unless --allow-envelope-violation is passed (quickstart Scenarios 1–2)

### Implementation for User Story 1

- [X] T016 [P] [US1] Implement ActuationCycle state machine in src/dispenser_sim/models/cycle.py: stages LOADED → PRESENTED → SINGULATED → RELEASED → RESET with FAULT transitions, per data-model.md (FR-001)
- [X] T017 [P] [US1] Implement DispenseEvent and outcome enums in src/dispenser_sim/models/events.py: cycle_index, pills_dispensed, outcome (SINGLE/ZERO_DOSE/MULTI_DOSE/NO_PILL_AVAILABLE), failure_mode (nullable), jam_persistent, pill_state snapshot; validation that every event has exactly one outcome (FR-002, FR-012)
- [X] T018 [US1] Implement the parametric 2D kinematic/pseudo-physics singulation model in src/dispenser_sim/mechanism/singulation.py: clearance vs maximum transverse width at orientation, Coulomb friction force balance, stroke/actuation-energy checks, and per-cycle process noise from the seeded cycles sub-stream; document simplifications with physical justification (research.md R1/R2, FR-003/005)
- [X] T019 [US1] Implement the seeded run engine in src/dispenser_sim/simulation/engine.py: execute N actuation cycles over the sampled reservoir, record one DispenseEvent per cycle (zero/one/multiple classification), track reservoir depletion so empty-reservoir cycles record NO_PILL_AVAILABLE (FR-002/012); auto-generate and record a seed when none is supplied (FR-015) (depends on T013, T016, T017, T018)
- [X] T020 [US1] Implement run record writers in src/dispenser_sim/reporting/export.py: write run.json (canonical record with embedded config, seed, envelope, events per contracts/run-record-schema.md) and cycles.csv (header and one row per cycle, ordered, no gaps) (FR-017/020)
- [X] T021 [US1] Implement the argparse CLI with validate and run subcommands in src/dispenser_sim/cli.py: argument parsing and exit codes per contracts/cli-contract.md (validate prints violations or VALID; run refuses envelope violations without --allow-envelope-violation, prints run directory path last on stdout); wire in T011, T019, T020

**Checkpoint**: User Story 1 fully functional — quickstart Scenarios 1 and 2 pass; 1,000-cycle run yields 1,000 classified outcomes

---

## Phase 4: User Story 2 - Verify the One-Pill-At-A-Time Invariant (Priority: P2)

**Goal**: Detect and classify every single-dose invariant violation by failure mode (jam, stacking, double-drop, missed dispense, unclassified); report aggregate and per-category single-dispense success rates with PASS/FAIL vs the 99.5% threshold; failure-mode breakdown accounts for 100% of violations

**Independent Test**: Run one mechanism against the full pill distribution, regenerate the report from the run record, and verify aggregate + per-category success rates, a 99.5% pass/fail verdict, and a failure-mode breakdown summing to exactly 100% of violations, with NO_PILL_AVAILABLE cycles excluded from violations (spec US2, SC-002/003, FR-011/012/019; quickstart Scenario 3)

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T022 [P] [US2] Write statistical invariant tests in tests/statistical/test_invariants.py: 100% of cycles classified (SC-001); empty-reservoir cycles are NO_PILL_AVAILABLE and never counted as violations (FR-012); failure-mode breakdown sums to exactly zero_dose + multi_dose violations (SC-003); sampled pill properties stay within configured ranges (FR-009)
- [X] T023 [P] [US2] Write unit tests in tests/unit/test_failure_modes.py: each failure-mode classifier (jam, stacking, double-drop, missed dispense) fires on its constructed scenario state; violations not matching any classifier are marked UNCLASSIFIED with cycle state preserved (FR-013/014); jam persistence is reported on subsequent cycles

### Implementation for User Story 2

- [X] T024 [P] [US2] Implement FailureMode enum and classifiers in src/dispenser_sim/simulation/failure_modes.py: detect JAM (pill transverse width exceeds effective clearance / force balance fails), STACKING (two pills aligned through the metering point), DOUBLE_DROP (multi-release through oversized outlet), MISSED_DISPENSE (pills available but none released), else UNCLASSIFIED with recorded state preserved (FR-013/014)
- [X] T025 [US2] Extend the run engine in src/dispenser_sim/simulation/engine.py: integrate failure-mode detection into each cycle, model jam persistence across subsequent cycles until cleared (record jam_persistent per event), and treat partial/interrupted actuation as a fault scenario resolving to a classified outcome (spec edge cases)
- [X] T026 [US2] Implement RunReport computation in src/dispenser_sim/reporting/report.py: totals for single/zero/multi/no-pill outcomes, aggregate single-dispense success rate, pass/fail vs the 99.5% threshold (SC-002), per shape-category success rates, and failure-mode breakdown summing to 100% of violations (FR-018/019, SC-003)
- [X] T027 [US2] Implement Markdown report generation in src/dispenser_sim/reporting/markdown.py: sections in the order required by contracts/run-record-schema.md (run identity, config digest, envelope validation, PASS/FAIL verdict, per-category table, failure-mode table, notable jam-persistence spans); written as report.md on run (FR-020, SC-006)
- [X] T028 [US2] Add the report subcommand to src/dispenser_sim/cli.py: load an existing run.json and regenerate report.md/cycles-derived summaries byte-identical to the original run output; exit 1 with path and parse error on unreadable records (contracts/cli-contract.md)

**Checkpoint**: User Stories 1 AND 2 both work independently — quickstart Scenario 3 passes; every violation is classified and counted

---

## Phase 5: User Story 3 - Reproduce Runs and Compare Candidate Designs (Priority: P3)

**Goal**: Reproduce any run exactly from its recorded seed + config; compare ≥2 mechanisms under identical seeds and pill distribution with a side-by-side reliability summary

**Independent Test**: Re-run a recorded configuration with the same seed and verify identical outcomes for every cycle (SC-004); run two mechanisms under identical conditions and verify comparison.md gives side-by-side success rates and failure-mode breakdowns (spec US3; quickstart Scenarios 4–5)

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T029 [P] [US3] Write reproducibility test in tests/statistical/test_reproducibility.py: two runs with identical seed + config produce semantically identical events lists (SC-004); a run without an explicit seed records the generated seed and replays identically from it (FR-015/016/017)
- [X] T030 [P] [US3] Write integration test in tests/integration/test_compare_cli.py: `compare` with slider_gate_v1 and rotary_disk_v1 at 1,000 cycles writes one run directory per mechanism plus comparison.md containing per-mechanism aggregate and per-category success rates, failure-mode breakdowns, and pass/fail verdicts under the identical seed (quickstart Scenario 5)

### Implementation for User Story 3

- [X] T031 [US3] Implement run loading and replay in src/dispenser_sim/simulation/replay.py: load run.json, reconstruct the engine from the embedded mechanism config, pill distribution, envelope, and seed, re-execute, and verify per-cycle outcomes match the recorded events exactly (SC-004)
- [X] T032 [P] [US3] Create configs/mechanisms/rotary_disk_v1.json: a second valid candidate mechanism config (rotary disk) with documented simplifications, enabling side-by-side comparison
- [X] T033 [US3] Implement comparison report generation in src/dispenser_sim/reporting/comparison.py: side-by-side aggregate + per-category success rates, failure-mode breakdowns, and PASS/FAIL vs 99.5% for each mechanism, written as comparison.md (contracts/cli-contract.md `compare`)
- [X] T034 [US3] Add the compare subcommand to src/dispenser_sim/cli.py: accept ≥2 --mechanism flags, run each under the identical seed and pill distribution via the engine, and write comparison.md (depends on T031, T033)

**Checkpoint**: All user stories independently functional — quickstart Scenarios 4 and 5 pass

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Performance validation, documentation, and full-feature verification

- [X] T035 [P] Write README.md at repo root: install (pip install -e .[dev]), quickstart commands for validate/run/report/compare, and the design-review evidence workflow (run.json/cycles.csv/report.md citation)
- [X] T036 [P] Validate performance in tests/statistical/test_performance.py or a scripted check: a 10,000-cycle run completes in under 10 minutes on a typical laptop and 100,000 cycles remain feasible (SC-005); profile and optimize the singulation hot loop in src/dispenser_sim/mechanism/singulation.py if exceeded
- [X] T037 [P] Document the mechanism model in docs/mechanism_model.md: singulation clearance/friction equations with citations or measurement plans, all simplifications with physical justification, and the confirmed numeric pill ranges (research.md open items, Constitution II)
- [X] T038 Run full quickstart.md validation end-to-end: all five scenarios behave as specified and `pytest tests/unit tests/statistical tests/integration` is green
- [X] T039 Final constitution compliance review: single-dose invariant checks intact (I), simplifications documented (II), seeded reproducibility verified (III), no unjustified dependencies (IV), envelope limits in version-controlled config (V)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001–T002); BLOCKS all user stories
- **User Stories (Phases 3–5)**: All depend on Foundational completion
  - US1 (P1) first — it builds the engine, exporters, and CLI that US2/US3 extend
  - US2 (P2) extends engine.py and reporting; can start once US1's engine exists (or in parallel on failure_modes.py/report.py files with agreed interfaces)
  - US3 (P3) extends cli.py and reporting; replay depends on US1's engine + run.json schema
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories — the MVP
- **US2 (P2)**: Builds on US1's run engine and exporters but is independently testable via the report subcommand and statistical invariants
- **US3 (P3)**: Builds on US1's engine/run record and US2's report computation but is independently testable via reproduce + compare

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models before mechanism/engine logic
- Engine before exporters/reporters
- Core implementation before CLI wiring
- Story checkpoint passes before moving to the next priority

### Parallel Opportunities

- Setup: T003, T004, T005, T006 all parallel after T001–T002
- Foundational: T007, T008 parallel; T009, T010 parallel after T001; T013 after T007+T010+T012
- US1: tests T014 ∥ T015; implementation T016 ∥ T017; then T018 → T019 → T020 → T021
- US2: tests T022 ∥ T023; T024 parallel with T026/T027; T025 then T028
- US3: tests T029 ∥ T030; T032 parallel with T031/T033; T034 last
- Polish: T035, T036, T037 parallel; T038, T039 sequential last

---

## Parallel Example: User Story 1

```bash
# Launch US1 tests together (write first, confirm they FAIL):
Task: "Write unit tests in tests/unit/test_cycle.py"
Task: "Write integration test in tests/integration/test_run_cli.py"

# Launch US1 models together:
Task: "Implement ActuationCycle state machine in src/dispenser_sim/models/cycle.py"
Task: "Implement DispenseEvent and outcome enums in src/dispenser_sim/models/events.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: quickstart Scenarios 1–2 pass independently
5. Demo: a seeded 10,000-cycle run of slider_gate_v1 producing run.json + cycles.csv

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → validate Scenarios 1–2 → Demo (MVP!)
3. Add User Story 2 → validate Scenario 3 → reliability report with 99.5% verdict
4. Add User Story 3 → validate Scenarios 4–5 → reproducible, comparable design-review evidence
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (engine + CLI)
   - Developer B: prepares US2 failure-mode classifiers and report schema against agreed interfaces
   - Developer C: prepares US3 comparison config and replay harness
3. Stories complete and integrate independently in priority order

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Verify tests fail before implementing each story
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- All randomness seeded and recorded (FR-015–017); unseeded randomness is a defect (Constitution III)
- Stdlib-only product code; pytest is the only dev dependency (Constitution IV)
