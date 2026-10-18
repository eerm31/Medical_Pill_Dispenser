# Tasks: Feature 004 — Local Dispensing and Container-Identification Prototype

**Input**: Design documents from specs/004-dispense-and-container-identification/ (spec.md, plan.md, research.md, data-model.md, quickstart.md, contracts/local-browser-contract.md)

**Scope**: Implement only the isolated, static, software-only page under docs/visualizer/feature004/. Subsystem 1 is a presentation stub; Subsystem 2 demonstrates fictional local fixture lookup and compartment-bound simulated lid/refill/replacement state; Overall Design composes the two panels with independent checkboxes. Feature 003 files and behavior are out of scope and must remain unchanged.

**Explicit exclusions**: No physical reader, NDC/live database, network, lid hardware, weight sensor/feedback, pill or dispense outcome, persistence, medication/identity/safety claim, or hardware action. Feature 003, the simulator, persisted runs, and Feature 002 are not to be modified. Feature 003 source files must not be edited.

**Tests**: Test-first is required for this increment. Write browser-native acceptance assertions and static offline-boundary checks before implementing the behaviors they cover; confirm the assertions fail for the missing behavior, then implement and rerun them.

## Phase 1: Setup

**Purpose**: Establish the isolated Feature 004 browser and test locations without touching Feature 003.

- [x] T001 Create the isolated page and browser-harness directories rooted at docs/visualizer/feature004/ and tests/browser/feature004/; keep all new runtime assets inside the Feature 004 directory.

## Phase 2: Foundational Test Infrastructure

**Purpose**: Build test-first verification infrastructure shared by the in-scope stories. These tests are expected to fail until the corresponding page and behavior are implemented.

- [x] T002 [P] Create a directly openable browser-native harness shell in tests/browser/feature004/index.html and deterministic assertion runner in tests/browser/feature004/browser-tests.js; report pass/fail counts without a server or external library.
- [x] T003 [P] Write pytest static offline-boundary checks in tests/test_feature004_offline_boundary.py for local relative assets only, no remote URLs/CDN, no fetch/XHR/WebSocket, no browser storage/cookies/service workers, and no Feature 003 runtime imports in docs/visualizer/feature004/.

**Checkpoint**: Both verification entry points exist; browser behavior tests can run by opening the harness as a local file, and static boundary tests can run under the repository's pytest configuration.

## Phase 3: User Story 1 — Subsystem 1 Dispensing Presentation Stub (Priority: P1; MVP)

**Goal**: Present Subsystem 1 as an isolated, informative software concept stub with a selected neutral compartment context and explicit limitations. It must not run a mechanism, change inventory, or report a dispense outcome.

**Independent Test**: Open the Feature 004 page locally and inspect Subsystem 1. Confirm its content is limited to the dispensing presentation stub and selected compartment context; no dispense success, pill count, actual device state, or medical/safety claim is asserted. Confirm no Feature 003 or simulator state is required.

### Tests for User Story 1 — write and observe failure before implementation

- [x] T004 [US1] Add browser-native acceptance assertions in tests/browser/feature004/browser-tests.js that Subsystem 1 presents the concept-only stub and compartment context, exposes the limitations, and never displays a dispense result or modifies compartment identity/lid state.

### Implementation for User Story 1

- [x] T005 [US1] Add the isolated Feature 004 page shell and Subsystem 1 presentation markup in docs/visualizer/feature004/index.html without editing docs/visualizer/index.html.
- [x] T006 [US1] Render the Subsystem 1 stub and neutral selected-compartment context from Feature 004 page state in docs/visualizer/feature004/app.js; do not create dispense, pill-count, or hardware state.
- [x] T007 [US1] Add readable, responsive presentation-stub styling and visible focus treatment in docs/visualizer/feature004/styles.css.

**Checkpoint**: The Subsystem 1 stub is independently viewable and its browser assertions pass without implementing scan, sensor, mechanism, or dispense behavior.

## Phase 4: User Story 2 — Fictional Fixture Scanner and Compartment Lifecycle (Priority: P2; depends on US1)

**Historical implementation note**: This completed phase records the original selected-compartment behavior. Its target-selection and immediate-open assumptions are superseded by Phase 10; use Phase 10 as the source of truth for current scanner behavior.

**Goal**: Demonstrate deterministic local-only fictional code lookup and bind a unique fixture label only to the selected compartment. Simulated lid close/reopen retains that association; explicit demo refill or replacement clears it and returns the selected simulated lid to closed.

**Independent Test**: Use the local browser harness for unique, ambiguous, no-match, invalid, and unlisted input. Verify only a unique fixture changes the selected compartment association and simulated lid to open; failed outcomes do not bind/open or disturb prior state. Verify close/reopen retention and selected-only refill/replacement clearing, with other compartments unchanged.

### Tests for User Story 2 — write and observe failure before implementation

- [x] T008 [US2] Add browser-native acceptance cases in tests/browser/feature004/browser-tests.js for unique, ambiguous, no-match, invalid, and valid-unlisted fixture inputs; assert explicit outcomes, unique-only binding/opening, and no failed-scan mutation.
- [x] T009 [US2] Add browser-native compartment-isolation and lifecycle cases in tests/browser/feature004/browser-tests.js for close/reopen retention, Demo Refill clearing to closed, Demo Replace Container clearing to closed, and unchanged non-selected compartments.

### Implementation for User Story 2

- [x] T010 [US2] Define the immutable versioned local fixture table in docs/visualizer/feature004/fixtures.js with conspicuously fictional unique, ambiguous, no-match, and invalid examples and fictional candidate labels only.
- [x] T011 [US2] Implement deterministic initial compartment state, input validation, fixture-only lookup, unique-only association/open transition, failed-lookup non-mutation, lid close/reopen, and selected-compartment refill/replacement transitions in docs/visualizer/feature004/model.js.
- [x] T012 [US2] Add labeled demo-code input/fixture controls, compartment selection, outcome text, simulated lid actions, and clearly labeled Demo Refill and Demo Replace Container controls in docs/visualizer/feature004/index.html and docs/visualizer/feature004/app.js; render fixture strings as text and keep all actions in page memory.

**Checkpoint**: All fixture and compartment lifecycle assertions pass using only the local page and fictional fixture table; no physical reader, real medication data, or external service is present.

## Phase 5: User Story 4 — Individual Views and Overall Design Composition (Priority: P2; composes US1 and US2)

**Goal**: Provide isolated Subsystem 1 and Subsystem 2 views plus Overall Design. Overall Design shows exactly the independently checked subsystem panels, defaults both checked, and communicates an empty composition when both are unchecked. View/checkbox changes do not mutate subsystem state.

**Independent Test**: In the browser-native harness, switch among all three views, toggle each composition checkbox independently and both together, then switch away and back. Confirm individual views show only their own panel, Overall Design reflects exactly the checked set, selections last through view changes but reset on reload, and operational/compartment state is unchanged by presentation controls.

### Tests for User Story 4 — write and observe failure before implementation

- [x] T013 [US4] Add browser-native acceptance cases in tests/browser/feature004/browser-tests.js for the three views, individual-view isolation, both-checked defaults, independent checkbox toggles, empty composition, in-session selection retention, reload defaults, and operational-state immutability.

### Implementation for User Story 4

- [x] T014 [US4] Add selected-view and includeSubsystem1/includeSubsystem2 session state plus view/composition-only transitions in docs/visualizer/feature004/model.js; initialize both includes to true and reset all state on page reload.
- [x] T015 [US4] Add semantic keyboard-operable tabs and independently labeled Overall Design include checkboxes in docs/visualizer/feature004/index.html, with correct tab/panel relationships and both subsystems selected by default.
- [x] T016 [US4] Wire view selection and composition rendering in docs/visualizer/feature004/app.js so each individual tab shows only its subsystem, Overall Design shows exactly the checked panels, and both unchecked produce an explicit empty-state message without changing compartment state.
- [x] T017 [US4] Complete responsive view/composition layout, visible keyboard focus, and non-color-only selected/empty states in docs/visualizer/feature004/styles.css.

**Checkpoint**: The browser-native harness confirms all views and composition behavior, including presentation-state isolation from fixture association and simulated lid state.

## Phase 6: User Story 3 — Weight Feedback (Priority: P3; deferred, no implementation tasks)

The plan explicitly excludes weight sensing, dispense feedback, automatic reopen/recovery behavior, and dispense outcomes from this software-only page increment. Do not add tests or implementation for sensors, weight interpretation, redispense, pill counts, or feedback states here. These decisions remain deferred; this phase has no checklist tasks.

## Phase 7: Polish and Cross-Cutting Verification

**Purpose**: Make the local entry point discoverable and record evidence for the bounded prototype without asserting hardware, medical, safety, identity, or single-dose validation.

- [x] T018 [P] Add a discoverable link to docs/visualizer/feature004/index.html from README.md; do not add a link, control, or script to docs/visualizer/index.html.
- [x] T019 Verify direct file:// opening and the browser-native suite at tests/browser/feature004/index.html in desktop and phone-sized viewports; inspect console/network activity for no errors or external requests and record the scope-limited results in specs/004-dispense-and-container-identification/implementation-evidence.md.
- [x] T020 Run tests/test_feature004_offline_boundary.py and the existing Feature 003 browser harness and relevant existing regression tests; review the change set and record that Feature 003, simulator, persisted runs, and Feature 002 files/behavior remain unchanged in specs/004-dispense-and-container-identification/implementation-evidence.md.

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: T001 establishes isolated locations.
- **Foundational tests (Phase 2)**: T002 and T003 depend on T001; they can proceed in parallel because they create separate test files.
- **US1 (Phase 3)**: Depends on Phase 2. It is the MVP and precedes the Subsystem 2 workflow.
- **US2 (Phase 4)**: Depends on US1 per spec. Write T008–T009 before T010–T012; implement fixture data before the controller and controller before its UI wiring.
- **US4 (Phase 5)**: Depends on US1 and US2 because Overall Design composes both presentations. Write T013 before view/composition implementation T014–T017.
- **US3 (Phase 6)**: Deferred by the current plan; no implementation dependency is introduced.
- **Polish (Phase 7)**: Depends on all in-scope stories. T019–T020 require the finished page and tests.
- **Revised Subsystem 2 lifecycle (Phase 10)**: Depends on the existing isolated page and harness. Add the new browser and static assertions first, run them and confirm the new cases fail against the current implementation, then update only the Feature 004 fixture/model/page assets. Re-run the browser/static checks before refreshing Feature 004 documentation and evidence.

### User story dependency graph

```text
Setup → Foundational test infrastructure → US1 → US2 → US4 → Polish → Revised US2 color-mapped loading lifecycle
                                         └───────────────┘
US3 (weight feedback) = deferred; no current-scope tasks
```

### Parallel opportunities

- T002 and T003 can run in parallel after T001 because they create independent harness and static-test files.
- T018 can run alongside post-implementation browser evidence work when the page is complete; it modifies README.md while browser verification records a separate evidence file.
- Keep tasks editing the same browser-tests.js, index.html, app.js, model.js, or implementation-evidence.md sequential to avoid conflicting edits and preserve test-first order.
- In Phase 10, T026 and T027 can run in parallel because browser assertions and Python static assertions are in separate files. After implementation, T035 and T036 can run in parallel. Once both pass, T037 and T038 can run in parallel because they update separate Feature 004 documents; T039 follows them.

## Parallel Example: Foundational Test Infrastructure

```text
Task T002: Create tests/browser/feature004/index.html and tests/browser/feature004/browser-tests.js
Task T003: Create tests/test_feature004_offline_boundary.py
```

## Parallel Example: Revised User Story 2

```text
Before implementation:
Task T026: Add the browser acceptance assertions in tests/browser/feature004/browser-tests.js
Task T027: Add the static boundary assertions in tests/test_feature004_offline_boundary.py

After the implementation is complete:
Task T035: Run the direct-file browser acceptance suite
Task T036: Run the Feature 004 static offline-boundary suite

After both verification tasks pass:
Task T037: Update specs/004-dispense-and-container-identification/quickstart.md
Task T038: Update specs/004-dispense-and-container-identification/implementation-evidence.md
```

## Implementation Strategy

### MVP first

1. Complete T001–T003 to establish isolated paths and test infrastructure.
2. Complete US1 (T004–T007), then stop and validate the presentation-only Subsystem 1 increment.
3. Continue to US2 (T008–T012) only after Subsystem 1 is independently verified; validate all deterministic fictional lookup and compartment lifecycle cases.
4. Complete US4 (T013–T017) to compose the implemented subsystem presentations.
5. Run the offline boundary checks, direct-file browser checks, and regression boundary review.

### Revised Subsystem 2 lifecycle increment

1. Complete T026–T027, then T028 and record that the new browser/static cases fail before any runtime edits.
2. Complete T029–T034 in dependency order, implementing only the fixture-color mapping, mapped-target availability, ordered placement/loading lifecycle, finish-loading, and reset behavior.
3. Complete T035–T036; do not update evidence to claim success until both suites pass.
4. Complete T037–T039 and record only Feature 004 browser behavior and isolation evidence. This increment does not add or alter Feature 003 behavior, tests, or specifications.

### Test-first execution rule

For each story, add its browser-native acceptance tests first and confirm they fail because the behavior is not yet implemented. Implement only the matching story behavior, then rerun the harness until its cases pass. The static checker must reject prohibited runtime/network/persistence references and Feature 003 imports. Do not expand tasks into the deferred physical/data/sensor questions.

### Evidence and claim limits

Browser and static checks establish only deterministic local UI behavior and offline/source boundaries. They do not establish physical reading, medication identity, actual container contents, lid movement, weight feedback, correct dose, single-dose integrity, medical or physical safety, validation, manufacturing readiness, or feature convergence. Preserve the project-level Single-Dose Integrity blocker; this prototype is not a waiver.

## Phase 8: Convergence

- [x] T021 Verify docs/visualizer/feature004/styles.css contains no CSS import directive and extend tests/test_feature004_offline_boundary.py to reject CSS @import regressions, preserving the local-only asset boundary.

## Phase 9: Subsystem 2 Component-Level Scan Simulation

**Purpose**: Expand the implemented Subsystem 2 form into a visible, labeled scanner-station schematic and a deterministic read → lookup → result presentation, without adding hardware or real medication data.

**Historical behavior note**: T022–T025 document the initial prototype, including its then-current captured-compartment target. That target-selection assumption is superseded by Phase 10; current behavior is fixture-color mapping with no manual target selector.

- [x] T022 [US2] Add test-first browser/model assertions in tests/browser/feature004/browser-tests.js for the scan presentation state sequence (`ready` → `reading` → `resolving` → matched/ambiguous/no-match/invalid), captured compartment targeting, no compartment mutation before lookup completion, and no-association/no-lid-change for unsuccessful results. Add static checks for labels/elements representing container barcode, guide, scanner head/optics, scan beam, decoder/status, and four-compartment target bank.
- [x] T023 [US2] Extend docs/visualizer/feature004/model.js with deterministic begin/advance/complete demo-scan transitions that capture the selected compartment at scan start, apply the local fixture result only on completion, and leave operational compartment state unchanged during reading/resolving.
- [x] T024 [US2] Add a responsive, accessible labeled SVG scanner-station schematic to the Subsystem 2 template in docs/visualizer/feature004/index.html and wire scan-stage, decoded-code, result, selected-target, and simulated-lid visuals in docs/visualizer/feature004/app.js; animate only the fictional scan beam/container presentation with fixed CSS/timer stages.
- [x] T025 [US2] Add responsive component, beam-stage, decoder, target-compartment, and simulated-lid styling in docs/visualizer/feature004/scanner-visual.css. Verify the scanner components remain visible in Subsystem 2 and when included in Overall Design, and disappear only when Subsystem 2's overall checkbox is unchecked.

**Explicit boundary**: T022–T025 are local UI simulation only. They do not integrate a barcode reader, connect to NDC data, control a lid, validate scanner geometry, or establish medication identity, dose, or safety.

## Phase 10: Revised Subsystem 2 Color-Mapped Loading Lifecycle (US2)

**Purpose**: Bring the already-implemented Feature 004 page and harness into alignment with the revised spec, plan, data model, and local-browser contract. This phase supersedes the earlier completed US2 assumptions that a user manually selects a compartment and that a successful scan immediately opens it. Preserve prior tasks as historical implementation records; this phase defines the corrected behavior going forward.

**Scope boundary**: Planned changes are limited to `docs/visualizer/feature004/`, `tests/browser/feature004/`, `tests/test_feature004_offline_boundary.py`, and Feature 004 documentation/evidence under `specs/004-dispense-and-container-identification/`. Do not edit Feature 003 runtime, specification, or tests; the shared viewer, simulator, persisted runs, and Feature 002 are out of scope. Do not add physical reader, network/NDC, weight, sensor, actuator, hardware, persistence, medication-identity, dose, or safety integration.

**Independent Test**: In the direct-file browser harness, verify four distinct color targets initialize empty, unassociated, closed, and locked; each unique fictional fixture targets only its same-color compartment without a manual target control; successful lookup presents result then same-color placement then opens/unlocks only an available target; Finish loading marks it occupied/closed/locked while retaining the association; occupied-target and failed scans preserve all compartment snapshots; and refill/replacement restores only the mapped target to its initial state. Run static boundary assertions and confirm Feature 003 remains isolated.

### Tests for revised User Story 2 — write and observe failure before implementation

- [x] T026 [P] [US2] Add browser-native assertions in `tests/browser/feature004/browser-tests.js` for exactly four distinct color compartments initially empty, unassociated, closed, and locked; one unique fixture per color mapping only to that color; absence of manual target selection; ordered result → same-color placement → opening/loading; compartment snapshot unchanged throughout placement and before its completion; no placement UI/claim on failed or unavailable outcomes; Finish loading to occupied/closed/locked with association retained; occupied-target and failed-scan full-state non-mutation; and compartment-anchored refill/replacement reset unaffected by later scan results.
- [x] T027 [P] [US2] Extend static assertions in `tests/test_feature004_offline_boundary.py` to reject manual compartment-target controls and verify the Feature 004 page remains isolated/offline while its local fixture and UI expose four color-specific mapped targets and a Finish loading action.
- [x] T028 [US2] Run the new cases in `tests/browser/feature004/index.html` and `tests/test_feature004_offline_boundary.py`; record/confirm that the added assertions fail against the current implementation before editing any runtime asset in `docs/visualizer/feature004/`.

### Implementation for revised User Story 2

- [x] T029 [US2] Update `docs/visualizer/feature004/fixtures.js` with conspicuously fictional unique fixture cases that each map deterministically to exactly one of the four distinct compartment color identifiers, retaining ambiguous, no-match, and invalid cases without target colors.
- [x] T030 [US2] Update `docs/visualizer/feature004/model.js` so a new session creates exactly four distinct-color compartments empty, unassociated, closed, and locked; remove user-selected target state; derive the sole target from the unique fixture's color; and preserve every compartment field when lookup fails or the mapped target is unavailable.
- [x] T031 [US2] Implement deterministic staged scan, placement, and loading transitions in `docs/visualizer/feature004/model.js`: successful available lookup must reach result before placement, and placement must complete before only the mapped target becomes loading/open/unlocked; reject occupied/associated/loading/unavailable targets without any compartment mutation; implement Finish loading as occupied/closed/locked with the association retained; and reset only the associated target selected through its own compartment control to empty/unassociated/closed/locked for demo refill or replacement.
- [x] T032 [US2] Update `docs/visualizer/feature004/index.html` to remove all manual compartment-target selection UI, provide the explicit Finish loading action, and add clearly labeled per-compartment demo refill/replacement actions that are enabled only for associated targets after loading finishes, without adding hardware or identity claims.
- [x] T033 [US2] Update `docs/visualizer/feature004/app.js` to run the ordered fixture-result → same-color container-placement presentation → placement-complete state transition → available-target opening/loading sequence, render the four mapped compartment states, wire Finish loading and each compartment's own refill/replacement controls, and prevent failed/unavailable scans from presenting placement or changing compartment state.
- [x] T034 [US2] Update `docs/visualizer/feature004/scanner-visual.css` to animate the fictional container placement at the fixture-mapped color target before displaying its simulated lid as open/loading, while keeping other compartment lids visibly unchanged/locked and retaining responsive accessible status presentation.

### Verification and Feature 004 evidence

- [x] T035 [P] [US2] Open `tests/browser/feature004/index.html` directly and run the full native browser suite against `docs/visualizer/feature004/index.html`; verify all color mapping, ordering, Finish loading, unavailable/failed non-mutation, and reset cases pass at desktop and phone-sized viewports with no console errors or external requests.
- [x] T036 [P] [US2] Run `tests/test_feature004_offline_boundary.py` and verify the revised page/assets remain local-only, storage-free, hardware-free, and independent of Feature 003 runtime assets.
- [x] T037 [P] [US2] Update `specs/004-dispense-and-container-identification/quickstart.md` with the revised color-mapped no-selector scan steps, placement-before-opening order, occupied-target/failed-scan checks, Finish loading state, and refill/replacement reset expectations.
- [x] T038 [P] [US2] Update `specs/004-dispense-and-container-identification/implementation-evidence.md` with actual red-before-implementation and passing browser/static results, viewport/offline observations, and explicit software-only claim limitations; do not report unrun checks as passing.
- [x] T039 [US2] Review the final change set and record in `specs/004-dispense-and-container-identification/implementation-evidence.md` that edits are confined to the approved Feature 004 page, harness, static boundary test, and Feature 004 docs/evidence paths, with no Feature 003 runtime/spec/tests or hardware/network/NDC/weight integration changes.

**Phase 10 test-first gate**: T028 must confirm the added browser and static assertions fail before T029–T034 begin. T035–T036 must pass before T037–T039 record completion. These checks establish only local fictional UI behavior and source boundaries, not physical scanning, actual contents, dispensing, dose, safety, or readiness.

## Phase 11: Correct Supported Color Set (US2)

**Purpose**: Correct the local Feature 004 demo palette to exactly RED, BLUE, GREEN, and ORANGE, and open directly to the scanner view. On startup all four compartments are visibly empty/unassociated/closed/locked. A unique fictional fixture for a supported color targets only that same-color compartment; a recognized container of any other/unmapped color gets an explicit unsupported-color result and opens no compartment.

**Scope boundary**: Limit changes to `docs/visualizer/feature004/`, `tests/browser/feature004/`, `tests/test_feature004_offline_boundary.py`, and Feature 004 specification/plan/data-model/contract/quickstart/research/checklist/evidence files. Feature 003 stays unchanged. No real barcode, medication, NDC, network, hardware, actuator, sensor, or dispense integration.

- [x] T040 [US2] Update Feature 004 browser-native tests to require the initial scanner view plus exactly RED/BLUE/GREEN/ORANGE fixtures/compartments and assert an unsupported-color fixture opens no compartment, makes no placement claim, and preserves all four compartment snapshots.
- [x] T041 [US2] Extend static boundary tests for the initial scanner view, exact four supported labels, and a local `unsupported-color` result path that remains targetless and isolated/offline.
- [x] T042 [US2] Run the revised browser and static checks before implementation and confirm they fail against the prior four-color palette and default view.
- [x] T043 [US2] Update local fixtures, scanner-first initial view, state-model palette and unsupported-color lookup outcome, SVG compartment labels, renderer status, and styling to use only RED/BLUE/GREEN/ORANGE as loadable compartments.
- [x] T044 [US2] Update Feature 004 spec, plan, data-model, local browser contract, research, quickstart, checklist, and implementation evidence to match the corrected palette, scanner-first startup, and unsupported-color no-open behavior.
- [x] T045 [US2] Run the Feature 004 browser/static checks, full Python regression suite, and unchanged Feature 003 browser harness; verify the active Feature 004 UI/docs use RED/BLUE/GREEN/ORANGE and inspect the local page for visible empty startup compartments and unsupported-color non-mutation.
