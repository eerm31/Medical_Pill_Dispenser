# Local Browser Contract: Feature 004 Prototype

## Entry point and loading

- Implementation entry point: `docs/visualizer/feature004/index.html`.
- Open directly from a local file URL. All scripts/styles/fixtures use relative local references.
- No server, internet, remote fonts/images, CDN, network API, module fetch, or external runtime dependency is required or permitted.
- The page must not import Feature 003 JavaScript or data. The existing `docs/visualizer/index.html` and its behavior remain unchanged.

## User-visible views

- Three accessible tabs: **Subsystem 1 — Dispensing**, **Subsystem 2 — Barcode / Container Identification**, and **Overall Design**.
- On a new page load, select Subsystem 2 so the four empty, locked RED/BLUE/GREEN/ORANGE compartments are immediately visible before any scan.
- An individual subsystem tab exposes only its subsystem presentation.
- Overall Design exposes separate, independently operable include checkboxes for Subsystem 1 and Subsystem 2. Both are selected by default. If both are clear, neither subsystem panel is rendered and a clear empty-composition status is shown.
- Checkbox choices persist while switching views in the current page session, and reset to selected after reload. View switching and checkbox changes do not alter lookup, association, or lid state.

## Local demo lookup

- The input is labeled as a fictional demo code, not a physical barcode read.
- Lookup consults only the versioned fixture table loaded from a local script.
- The supported colors are exactly RED, BLUE, GREEN, and ORANGE. Every supported unique fixture deterministically identifies its same-color compartment; the fixture-mapped color is the sole target. The UI must not provide a manual compartment target/selector or alternate-target fallback.
- The table contains deterministic unique cases for those four colors, an explicit unsupported-color case with no target, plus ambiguous, no-match, and invalid examples. Valid but unlisted input produces no-match.
- The only target colors are RED, BLUE, GREEN, and ORANGE. Include a separate fictional unsupported-color example without a target; it produces no placement and leaves all four compartments unchanged.
- A unique lookup is only eligible to load its mapped target if it is empty, unassociated, closed, locked, and not already in an active scan/loading operation. A unique lookup for an occupied or otherwise unavailable target reports unavailable without placement or compartment mutation.
- Ambiguous, no-match, invalid, and unknown input do not bind, place, open/unlock, or otherwise change any compartment.
- A recognized fictional container of any color other than RED, BLUE, GREEN, or ORANGE reports unsupported color; it does not show placement, open a lid, or change any compartment state.
- Status wording must say demo/fictional fixture association. It must not mention FDA, NDC verification, actual medication contents, or physical scan completion.

## Subsystem 2 scanner-station presentation

- Subsystem 2 includes a labeled component schematic: fictional container with barcode label, positioning guide, scanner head and optical read point, animated scan beam, local fixture decoder/status display, and four-compartment target bank with simulated lids.
- Starting a demo scan shows deterministic `ready → reading → resolving → result` stages. The beam is visible only during the reading stage. The result phase identifies the fixture-mapped color, or reports failure/unavailability, before any container placement.
- For a unique result whose mapped compartment is available, the UI enters a visible placement animation. Every compartment remains unchanged while this animation runs. Only when placement completes does the mapped compartment receive its association, open/unlock, and enter `loading`; all other compartments remain unchanged and locked.
- For failed lookup or an unavailable mapped target, stop after the result phase: show no container placement and do not mutate any compartment.
- A scan attempted while a scan or loading operation is active is refused as busy; it cannot interrupt/reassign the active target or open another compartment.
- View switching or Overall Design include-checkbox changes do not change the fixture-mapped target or compartment states.
- The schematic and animation are illustrative UI only. They do not define optical geometry, scanner electronics, actual code capture, electrical interfaces, a physical compartment bank, or lid actuation.

## Compartment UI state

- Exactly four distinct color-coded demo compartments—RED, BLUE, GREEN, and ORANGE—are shown. Each starts empty, unassociated, closed, and locked. There is no manual compartment target selector.
- A successful unique fixture lookup maps to its same-color compartment. If available, only that compartment receives the fixture association, enters loading, and has its simulated lid opened/unlocked after the placement presentation.
- The active loading view provides an explicit `Finish loading` action. It marks only that target occupied, closes and locks it, and retains its fixture association.
- A later compartment opens only after its own successful unique scan maps to an available target. No compartment opens automatically after `Finish loading`.
- An occupied/associated/loading/unavailable target cannot be overwritten or opened by another scan. Failed scans and unavailable-target outcomes preserve every compartment's occupancy, association, lid, and lock state.
- A scanned container with any color other than RED, BLUE, GREEN, or ORANGE has no target compartment; it opens no lid, shows no placement, and preserves all four compartment states.
- Each associated compartment has its own explicitly labeled demo refill/replacement actions, shown/enabled only after loading is finished and while no scan/loading operation is active. An action resets only that compartment to empty, unassociated, closed, and locked; it does not use the last scan result as a target or affect another compartment.
- No physical lid actuation, sensor, dispense/quantity update, or automatic action is triggered.

## Accessibility and status

- Tabs support keyboard navigation and communicate selected/controlled panel using standard ARIA tab semantics.
- Inputs and checkboxes have visible labels; action controls are keyboard operable and have visible focus indication.
- Lookup and action results are conveyed as text in a polite live region, not by color alone.
- Fixture-supplied strings are inserted as text, not trusted HTML.

## State and limitations

All state is in page memory and resets on reload. The local fixture match is only an association with fictional test data; it is not evidence of real container contents. Lid state is only a UI variable. Subsystem 1 is a concept presentation and does not assert that dispensing occurred. No medical, identity, dose, physical-safety, single-dose, validation, manufacturing, or readiness claim is made.
