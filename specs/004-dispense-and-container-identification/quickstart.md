# Quickstart: Validate the Feature 004 Local Browser Prototype

This guide validates only the software-only fictional-fixture prototype. It does not validate real barcode reading, medication identity, a physical lid, dispensing, weight feedback, safety, or readiness.

## Prerequisites

- A desktop or mobile-capable browser on the local machine.
- Repository checkout available locally. No Python package install, server, network, or runtime package is needed for the static browser app.
- Implemented page at `docs/visualizer/feature004/index.html` and browser harness at `tests/browser/feature004/index.html`.

## Run

1. Open `docs/visualizer/feature004/index.html` directly as a local file (`file://`). Do not start a web server.
2. Confirm the page opens on Subsystem 2 with all four supported compartments visible and empty, unassociated, closed, and locked. Confirm three tabs are shown; switch to Subsystem 1 and back and verify each view shows only its own content. Inspect the labeled fictional container/barcode, positioning guide, scanner head/optics, scan beam, local decoder, and compartment bank.
3. Enter Overall Design. Confirm both include checkboxes start checked. Uncheck each in turn and verify only the corresponding panel is hidden; uncheck both and verify the empty-composition message. Switch views and return to verify checkbox choices persist. Reload and verify both are checked again.
4. In Subsystem 2, confirm the four compartments are RED, BLUE, GREEN, and ORANGE, and start empty, unassociated, closed, and locked, with no manual target selector. Enter each supported fixture code (`DEMO-RED`, `DEMO-BLUE`, `DEMO-GREEN`, `DEMO-ORANGE`), plus `DEMO-VIOLET` (unsupported color), ambiguous, no-match, invalid, and unlisted codes. Observe reading → resolving → result. For a unique supported color, verify placement begins only after the result and every compartment remains unchanged until placement completes; then only the same-color target enters loading with its simulated lid open/unlocked. For unsupported color, no-match, ambiguous, and invalid results, verify no placement is shown and all four compartments remain unchanged and closed/locked.
5. Select `Finish loading`; verify only the mapped compartment becomes occupied, closes and locks, and retains its fictional association. Confirm no other compartment opens automatically. Scan for an occupied/unavailable mapped target and verify there is no new placement and no compartment state changes. Verify failed scans likewise preserve every compartment.
6. Use Demo Refill or Demo Replace on the row for one associated, finished compartment; verify only that compartment returns to empty, unassociated, closed, and locked. These controls are not available during loading, and a later scan result must not change their target. Confirm other compartments remain unchanged.
7. With browser network access disabled, reload and repeat the fixture and view checks. Inspect console/network status for external requests or JavaScript errors. Resize to desktop and phone-sized viewport and check usable controls, readable statuses, and no horizontal overflow.
8. Open `tests/browser/feature004/index.html` directly to run deterministic browser contract assertions for initialization, fixture-color targeting, scan phases, placement completion, loading completion, failed/unavailable/busy non-mutation, refill/replacement reset, view composition, and offline boundaries. Expected result: every applicable case passes and the failure count is zero.
9. Run the existing Feature 003 browser harness at `tests/browser/index.html` and the existing regression test suite. Expected result: Feature 003 remains deterministic and its existing local viewer behavior is unchanged.

## Expected state outcomes

- Initial page session: Subsystem 2 scanner view is selected immediately; RED, BLUE, GREEN, and ORANGE compartments are visible, empty, unassociated, closed, and locked. Overall Design defaults to both subsystems included.
- Successful unique fictional fixture: its record maps to exactly one same-color compartment. After reading/resolving/result, show placement, then bind/unlock/open only that available target and mark it loading.
- `Finish loading`: mapped compartment becomes occupied, closed, and locked while retaining its fictional association. No other compartment opens automatically.
- Unsupported-color, ambiguous, no-match, invalid, unlisted, busy, or unavailable-target input: explicit outcome; no placement, no compartment opens, and no compartment state changes.
- Demo refill or replacement: the associated compartment whose own reset control is selected returns to empty, unassociated, closed, and locked; other compartments are unaffected.
- New page load: all operational demo state and composition choices reset; nothing is persisted.

For entity semantics see [data-model.md](data-model.md); for exact UI and local-runtime behavior see [local-browser-contract.md](contracts/local-browser-contract.md). Browser results are software-only evidence and do not resolve deferred product questions in [spec.md](spec.md).

## Historical verification before revised color-loading flow (2026-10-11)

The results below were recorded against the prototype before the updated fixture-color targeting and loading lifecycle in this plan. They remain historical evidence for the prior browser increment and local/offline boundaries; they do **not** establish the updated mapping, availability, placement, “Finish loading”, or reset transitions. Re-run the harness and browser checks after those transitions are implemented.

- Feature 004 browser contract harness: **12 passed, 0 failed**.
- Static local/offline/component-boundary tests: **5 passed**.
- Full repository suite: **143 passed**.
- Existing Feature 003 browser harness: **30 passed, 0 failed**.
- Foreground browser checks exercised the three views, independent Overall Design composition, keyboard tab navigation, unique/ambiguous fixtures, compartment isolation, simulated lid close/reopen, demo refill/replacement, reload reset, labeled scanner components, the animated beam, and read/resolve/match stages. The local page had no observed JavaScript/console errors or non-local asset requests. CSS widths 1440px and 390px were reported with no horizontal overflow.
- These results validate only deterministic browser UI behavior. They do not validate physical barcode reading, real NDC lookups, actual contents, lid actuation, sensing, dispensing, dose, or safety. See [implementation-evidence.md](implementation-evidence.md).

## Final palette/startup verification (2026-10-11)

- The new test-first palette and startup checks failed against the prior palette/default view. After implementation, Feature 004 browser contract harness: **14 passed, 0 failed**; static boundary/component tests: **6 passed**.
- Fresh local-file page load selected Subsystem 2 immediately. RED, BLUE, GREEN, and ORANGE were all visible and empty/unassociated/closed/locked before any scan.
- `DEMO-VIOLET` returned `unsupported-color`, showed no placement animation, and left all four compartments unchanged. `DEMO-ORANGE` showed placement; after its animation, only Orange entered loading/open/unlocked, and the other lids remained closed/locked. Model tests cover all four supported mappings.
- Full Python suite: **148 passed**. Feature 003 browser harness: **30 passed, 0 failed**.
- Browser checks found no console/page errors or non-local resource entries. The viewport bridge reached 1025px desktop and 390×844 phone-sized CSS dimensions, with no horizontal overflow.

These are software UI checks only. They do not validate physical scanning, actual container contents, lid actuation, medicine, dispensing, dose, safety, or readiness.
