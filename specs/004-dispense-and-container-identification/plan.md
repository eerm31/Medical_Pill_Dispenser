# Implementation Plan: Feature 004 — Local Dispensing and Container-Identification Prototype

**Feature**: `004-dispense-and-container-identification`  
**Date**: 2026-10-11  
**Spec**: [spec.md](spec.md)  
**Observed Git branch**: `001-dispensing-mechanism-simulation` (unborn); Spec Kit resolves Feature 004 and returned an empty branch value.

## Summary

Implement only the requested software-only local-browser increment: an independent static Feature 004 experience with three selectable views—Subsystem 1 (dispensing), Subsystem 2 (barcode/container-identification), and Overall Design. Overall Design composes the two subsystem presentations using separate include checkboxes. Subsystem 2 starts with exactly four color-coded compartments—RED, BLUE, GREEN, and ORANGE—empty, unassociated, closed, and locked. A successful unique fictional fixture record deterministically maps only to its same-color compartment; there is no manual compartment target selector. The UI progresses through reading and resolving, shows container placement only after a successful lookup, and opens only the mapped compartment if it is available. Any other/unmapped container color, no-match, invalid input, or ambiguous result opens nothing and leaves every compartment unchanged. “Finish loading” marks that compartment occupied, closes and locks it, and retains its fixture association. Scans for occupied/unavailable targets and failed scans change only scan-result presentation. A demo refill/replacement restores only its associated compartment to empty, unassociated, closed, and locked. The page is separate and owns separate state; it does not modify or import Feature 003's viewer/controller/data.

## Scope and boundaries

Included: static local page, three views, presentation-only Subsystem 1, local fixture scan interaction, per-compartment association and simulated lid state, explicit refill/replacement clearing, and session-only view/composition state.

Excluded: real NDC/medication records or FDA lookup; network access; physical barcode reader, ESP32 or other hardware; real lid actuation; weight sensing or dispense feedback; actual pill motion, quantities, or dispense outcome; persistence; Feature 003 behavior or assets; simulator, persisted runs, and Feature 002 player changes. The Subsystem 1 panel is a clearly labeled concept/presentation stub and does not report a physical dispense or a successful dose. Later weight-feedback and physical-integration questions remain deferred to specification clarification; this plan does not answer them. The prototype makes no medication-identity, physical-safety, single-dose, validation, or readiness claim.

## Technical Context

**Language/Version**: Static HTML5, CSS, and browser JavaScript using local classic scripts; existing Python 3.11+ package remains unchanged.  
**Primary Dependencies**: Native browser DOM/CSS/JavaScript only; no framework, package manager, runtime library, or backend.  
**Storage**: In-memory page state only; reload starts a new demo session.  
**Testing**: Browser-native deterministic acceptance harness under `tests/browser/feature004/`; pytest static/offline boundary and existing regression tests; foreground local-file browser checks.  
**Target Platform**: Current desktop and mobile browsers on macOS, opening the page directly via `file://`.  
**Project Type**: Separate static documentation/demo page, independent of the Python simulation and Feature 003 viewer.  
**Performance Goals**: Immediate local lookup and UI updates for a fixed four-compartment demo; no network round trips, animation loop, or measurable real-time performance claim.  
**Constraints**: Relative local assets only; no CDN, server, external font/image, fetch/XHR, WebSocket, browser storage, or cross-app import. Fictional codes/names only. View and checkbox state must not mutate compartment operation state.  
**Scale/Scope**: One browser page, two subsystem panels plus their composition view, four demo compartments, and a small fixed fixture set.

## Constitution Check

| Principle / gate | Assessment for this increment | Verdict |
|---|---|---|
| I. Single-Dose Integrity | This browser prototype does not execute or validate a dispense. Existing recorded zero-/multi-dose violations remain a project-level blocker; this work is not a waiver and cannot be called single-dose evidence. | **ERROR / BLOCKED for project/feature completion**; scoped concept work does not claim the gate. |
| II. Simulation-First, Hardware-Faithful | No physical design or hardware-faithfulness claim is made; Feature 001 simulation is unchanged. The page is a software interaction mock only. | PASS for bounded software-only concept scope. |
| III. Testability & Verification | Pure local lookup/state transitions and view composition are deterministic and browser-testable. These checks do not substitute for Feature 001's seeded mechanical verification. | PASS for proposed prototype checks; not simulation evidence. |
| IV. Simplicity & Capstone Pragmatism | Dedicated vanilla static page, small state model, fixed fixtures, and native browser harness; no dependency or backend. | PASS. |
| V. Portability Constraints | No dimensions, mass, energy, battery, or physical envelope are changed or asserted. | PASS / no physical impact. |

**Post-design gate**: Principle I remains **ERROR / BLOCKED** as recorded; no part of this prototype repairs or overrides that result. Principles II–V remain limited to software concept behavior. No safety/readiness or feature-converged claim follows from this plan.

## Architecture

Use a dedicated directory, `docs/visualizer/feature004/`, with its own HTML shell, stylesheet, fictional-fixture data, pure state/controller script, and DOM renderer. The page must not include `concept-data.js`, `demo-controller.js`, `app.js`, or any Feature 003 script. Use classic relative `<script>`/`<link>` references so direct local-file loading does not depend on module fetch/CORS behavior.

Components and responsibilities:

1. **Page shell and tabs** — semantic, keyboard-operable tablist for Subsystem 1, Subsystem 2, and Overall Design; each tab exposes exactly its own view. Overall Design contains independent checked-by-default `includeSubsystem1` and `includeSubsystem2` controls and an explicit empty-composition message. View switching and checkbox toggles affect visibility only.
2. **Subsystem 1 presentation** — isolated explanatory panel with an explicit software-only limitation and no scanner-selected compartment state. It does not run a mechanism, create a pill event, modify inventory, or report a dispense result.
3. **Subsystem 2 scanner prototype** — manual fictional demo-code input (plus optional controls for selecting a fixture example), outcome status, mapped-color association, and an explicit “Finish loading” action while loading is in progress. There is no compartment target selector. The placement animation is an explicit phase during which compartment state remains unchanged; placement completion is the transition boundary for binding and opening the available mapped target. Each associated compartment owns its own refill/replacement controls, which are enabled only after loading finishes and reset only that compartment. The scan/read/resolving/result/placement/loading sequence is deterministic and all status copy identifies simulated UI state, not hardware events.
4. **Scanner station diagram** — responsive labeled SVG schematic for the demo container/barcode, positioning guide, scanner head/optics, scan beam, local decoder/status block, and four-compartment target bank with the fixture-mapped target/lid state. It is a component-level concept schematic, not validated CAD or a physical build instruction.
5. **Fixture table** — immutable, versioned, local JavaScript object loaded as a classic script. It is the only lookup source; each unique record deterministically carries a target color that maps one-to-one to a compartment. Fixtures and displayed names are conspicuously fictional.
6. **Pure state/controller** — DOM-independent functions create initial state and apply scan, loading completion, refill/replacement, view, and composition actions. Inputs are validated before lookup. A unique result resolves to its fixture-defined color, not a user-selected compartment; only an empty, unassociated, closed, locked target can enter loading. Failed or unavailable outcomes do not mutate compartment state. Scan presentation proceeds through deterministic reading, resolving, result, placement, and (when available) lid-opening/loading phases.
7. **Renderer** — updates status text and compartment/view panels from state snapshots, uses text insertion rather than fixture-controlled HTML, and keeps status changes accessible with a polite live region. A bounded CSS beam animation accompanies explicit UI timer stages; no device APIs, randomness, network, or persistence are used.

The page starts in the Subsystem 2 scanner/loading presentation, immediately displaying all four RED, BLUE, GREEN, and ORANGE compartments empty, unassociated, closed, and locked. Both Overall Design checkboxes remain initialized to checked, so selecting Overall Design initially composes both subsystems. Operational state and checkbox choices live for the page session and reset on reload. Switching views does not reset or alter compartment state or associations; checkbox state likewise survives view changes. No UI offers manual compartment targeting: the fixture record's target color determines the sole target.

## Local fixture schema and lookup rules

The fixture script exposes a frozen versioned object with `schemaVersion` and a deterministic array of `cases`. Each case has `caseId`, `demoCode`, `expectedOutcome` (`unique`, `unsupported-color`, `ambiguous`, `no-match`, or `invalid`), `candidates` (zero or more `{ candidateId, fictionalDisplayName }` objects), and a human-readable `demoLabel`. Each unique fixture record additionally has a `targetColor` of `red`, `blue`, `green`, or `orange` matching exactly one compartment. An unsupported-color fixture may identify a fictional container color, but has no supported target and opens no compartment. Ambiguous, no-match, invalid, and unsupported-color records do not authorize compartment mutation. All candidate labels begin with an unmistakable fictional/demo marker and cannot claim to represent medication or NDC records.

Include one unique case for each supported color—RED, BLUE, GREEN, and ORANGE—plus one unsupported-color case, one ambiguous case, one validly formatted no-match case, and invalid input examples. Any valid but unlisted code returns `no-match`. Validate syntax/length before lookup. A unique result is eligible for loading only if its same-color target is empty, unassociated, closed, locked, and not already involved in a scan/loading operation. Other/unmapped color, ambiguous, no-match, invalid, unknown, or unavailable-target inputs produce distinct visible statuses and leave every compartment unchanged. No alternate color target, manual target override, network fallback, or fabricated product resolution is permitted.

## State and transition semantics

State is an in-memory plain object with `selectedView`, `includeSubsystem1`, `includeSubsystem2`, `lastScanOutcome`, scan/loading phase, and a compartment map. Each compartment stores its stable ID/label/color, `occupancy` (`empty`, `loading`, or `occupied`), `boundFixture` or null, `simulatedLidState` (`closed` or `open`), and `simulatedLockState` (`locked` or `unlocked`). It stores no pill count, measured weight, actual contents, actuator position, or persisted history. The scanner does not maintain a manually selected target.

- On page load, create exactly four compartments, each `empty`, unassociated, `closed`, and `locked`; reset both Overall Design include checkboxes to checked.
- A scan can begin only when another scan/loading operation is not active. Capture the entered fictional code, then present deterministic `reading` and `resolving` phases before displaying its lookup result. These stages do not mutate any compartment.
- A unique fixture result supplies its `targetColor`, which maps to exactly one compartment. If and only if its mapped compartment is empty, unassociated, closed, locked, and otherwise available, show the container being placed there. Keep every compartment field unchanged during the placement animation; when placement completes, bind the fictional fixture, set occupancy to `loading`, and unlock/open only that compartment for the loading UI. No manual target selection or alternate-compartment fallback exists.
- “Finish loading” is valid only for the active loading target; set it to `occupied`, close and lock it, and retain the fixture association. No other compartment changes or opens automatically.
- If the unique result maps to an occupied, associated, loading, or otherwise unavailable target, report unavailable after lookup; do not show placement; preserve all compartments exactly. Do not offer another target.
- Unsupported-color, ambiguous, no-match, invalid, malformed, or unlisted input changes only scan-result presentation; it does not bind, clear, reassign, place, open, unlock, or otherwise change any compartment.
- A second scan during reading/resolving or loading is refused with an explicit busy result and cannot cross-assign or open another compartment.
- Each associated compartment owns demo refill/replacement controls, enabled only after its loading operation finishes and when no scan/loading operation is active. An action restores only that compartment to `empty`, unassociated, `closed`, and `locked`; every other compartment is unchanged. The action target is never inferred from the most recent scan result. “Finish loading” does not clear the association.
- A new page load resets all four compartments and both include checkboxes. No `localStorage`, `sessionStorage`, cookies, IndexedDB, service worker, URL encoding of operational state, or server state is used.
- These bounded UI stages do not define or imply real reader timing, NDC lookup, physical sensing, lid recovery, or hardware interlocks; those remain out of scope and unresolved.

## Test strategy

1. **Pure controller tests**: verify deterministic initialization of exactly RED/BLUE/GREEN/ORANGE compartments as empty/unassociated/closed/locked; supported-color target resolution; explicit unsupported-color, ambiguous, no-match, and invalid outcomes; and no placement or compartment mutation for unsupported colors. Also verify reading → resolving → result → placement/open/loading order; blocked occupied/unavailable targets; “Finish loading” to occupied/closed/locked with association retained; busy/loading non-mutation; and compartment-local refill/replacement reset. Compare full snapshots of all compartments before and after every failure/refusal.
2. **View-composition tests**: verify each individual tab displays only its own subsystem; Overall Design starts with both checked, independently hides/restores only the corresponding panel, shows a clear empty state with both unchecked, and preserves checked values while switching views. Assert view/composition actions leave subsystem state untouched and reload defaults are restored.
3. **Browser acceptance**: use a separate native browser harness and foreground real browser at desktop and phone-sized viewport. Inspect scanner component labels, beam state and four color-target visuals. Exercise keyboard tab navigation, status announcements, code-entry and fixture-example controls (not compartment targeting), scan/read/resolve/result/placement/open/loading stages, finish-loading, unavailable/failed scans, mapped-target refill/replacement, responsive layout, direct `file://` open, and visible limitations. Verify no console errors.
4. **Offline and isolation audit**: static scan of the Feature 004 page/assets for remote URL references, `fetch`, `XMLHttpRequest`, `WebSocket`, storage APIs, cookies, service workers, or imports of Feature 003 globals. Open the local file with networking disabled and confirm all fixtures/views still function. Check browser Network/console evidence for zero external requests.
5. **Regression boundary**: run the existing Feature 003 browser harness and existing relevant Python tests/regressions unchanged. Review the change set to confirm `docs/visualizer/index.html`, its existing CSS/JS/data/vendor files, Feature 003 controller tests, simulator outputs, and Feature 002 behavior were not edited by implementation.

Controller tests establish only deterministic UI state semantics. Browser/offline tests do not establish a working reader, medication identity, correct dose, physical lid behavior, dispensing performance, safety, or readiness.

## Project Structure

```text
specs/004-dispense-and-container-identification/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── local-browser-contract.md

docs/visualizer/                         # Feature 003 viewer remains unchanged
├── index.html                           # existing; do not modify
└── feature004/
    ├── index.html
    ├── styles.css
    ├── scanner-visual.css
    ├── fixtures.js
    ├── model.js
    └── app.js

tests/browser/feature004/
├── index.html
└── browser-tests.js
```

The implementation should add a discoverable link to the new local page from Feature 004 documentation/README without adding scripts, controls, or state to the existing Feature 003 viewer entry page. Do not add or generate `tasks.md` as part of this planning request.
The implementation should add a discoverable link to the new local page from Feature 004 documentation/README without adding scripts, controls, or state to the existing Feature 003 viewer entry page. The existing task artifact governs this revision's implementation and verification work.

**Structure decision**: one independent static subdirectory under `docs/visualizer/` most closely matches the existing offline documentation experience while enforcing strict code/state separation. The Feature 004 page uses no Feature 003 runtime assets. Python package, configs, persisted records, and simulation tests are outside the implementation footprint.

## Deferred decisions and explicit limitations

The following remain unresolved and are not plan blockers for this explicitly software-only fixture increment: FDA NDC fields/releases/name precedence and refresh/freshness; barcode symbologies and physical-input quality; reader/controller/interface selection; whether future identification requires confirmation; physical sensor design, calibration, interpretation thresholds, uncertainty handling; physical lid/recovery policy; exact physical refill/replacement recognition; hardware interlocks; and evidence required for any future safety/readiness/identity claim. Do not convert these into inferred requirements or substitute fictional fixtures for future decisions.

This plan covers UI composition and local fixture-state behavior only. A unique fictional fixture match is an example association, not proof of actual container contents. The simulated open/close state is not lid actuation. No weight, pill-count, dispense-success, safety, or readiness result is represented. Feature 003 remains the existing deterministic, offline, concept-only viewer with behavior and files unchanged.

## Complexity Tracking

No new project, runtime dependency, service, persistence layer, or framework is introduced. The separate page/controller/fixture files are the minimum boundary needed to avoid coupling Feature 004 state to Feature 003's deterministic demo. Constitution I remains blocked at the project level as documented; this is not a justification or waiver.
