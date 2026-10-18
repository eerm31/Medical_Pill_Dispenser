# Research: Feature 004 Local Browser Increment

**Scope**: The isolated software-only increment described in [plan.md](plan.md), not physical integration or the complete staged feature.

## Decisions

### 1. Add an independent static page, not another mode in Feature 003

- **Decision**: Place the Feature 004 experience under `docs/visualizer/feature004/`, with its own entry HTML, styles, local fixture data, pure state/controller, and DOM renderer. Link to it from Feature 004 documentation/README rather than changing `docs/visualizer/index.html`.
- **Rationale**: The existing Feature 003 app is an active deterministic concept viewer with its own controller, geometry data, tests, and explicit scope. Sharing its page or controller risks coupling the new fictional identity/lid state to the concept demo and changing behavior the request explicitly protects.
- **Alternatives considered**: Add tabs/panels to the current viewer; rejected because it alters the Feature 003 entry page/experience. Put a subview inside its controller; rejected because Feature 004 state would share an unrelated state machine. Use a Python/server-backed page; rejected because this increment is local, offline, and software-only.

### 2. Use native HTML/CSS and isolated classic scripts

- **Decision**: Use semantic HTML and separate classic JavaScript assets loaded by relative paths; do not use a framework, module import, server, npm package, or runtime Python code.
- **Rationale**: This matches the repository's static local-file browser practice and avoids module/fetch origin restrictions commonly encountered when opening pages from `file://`. The bounded view/state model does not justify adding framework or dependency complexity.
- **Alternatives considered**: ES modules with a development server; rejected because a server/network dependency is unnecessary and conflicts with the required local browser experience. Reuse Three.js; rejected for this page because this increment needs no 3D rendering and should not load Feature 003 assets.

### 3. Treat the scanner as a local fixture lookup prototype with fixture-defined targets

- **Decision**: Bundle an immutable, versioned fixture table as a local classic script. Accept fictional typed codes and optional fixture-example controls. The only target colors are RED, BLUE, GREEN, and ORANGE. Each supported-color unique fixture maps only to its same-color compartment; an unsupported-color fixture, unknown code, ambiguous result, or invalid code has no compartment target and never opens a lid. No manual target selector is provided.
- **Rationale**: This is deterministic, testable offline, and makes the prototype's fictional data provenance and compartment mapping explicit. Synthetic values such as `DEMO-RED` do not masquerade as NDC values or physical barcode scans.
- **Alternatives considered**: FDA NDC lookup, downloadable data, or remote API; all deferred because the source, fields, updates, offline policy, and display precedence remain open and the request expressly prohibits real NDC records/network. Reusing Feature 003's color-to-cap barcode fixtures; rejected because those represent a different concept workflow and must not change or acquire identity semantics.

### 4. Keep state ephemeral and enforce mapped-target availability

- **Decision**: Keep view, composition checkboxes, lookup/loading phase, occupancy, lock/lid state, and fictional association in a page-lifetime state object. Reload resets RED, BLUE, GREEN, and ORANGE compartments to empty/unassociated/closed/locked and both composition checkboxes selected. A supported-color unique scan can proceed only against its fixture-mapped compartment when available; compartment state remains unchanged until placement completes, and “Finish loading” makes that target occupied/closed/locked while retaining the association. Each associated compartment owns refill/replacement controls that reset only that target after loading finishes.
- **Rationale**: View include choices persist only during the current page session, and no fictional product record should become persistent. Fixture-derived targeting prevents cross-assignment. Explicit availability and loading transitions ensure unavailable and failed scans cannot alter compartment state.
- **Alternatives considered**: localStorage/sessionStorage or a backend; rejected because persistence is not requested and could wrongly suggest durable container identity records. A shared Feature 003 controller/model; rejected to preserve its deterministic data and behavior.

### 5. Keep simulation claims narrow

- **Decision**: After reading/resolving and a successful unique lookup for RED, BLUE, GREEN, or ORANGE, show placement in the fixture-mapped compartment; leave every compartment unchanged during the placement presentation, then bind/open/unlock only that available target when placement completes. Unsupported-color, failed, and unavailable scans show no placement and change only their result presentation. “Finish loading” closes/locks it, marks it occupied, and retains its fictional association; no later compartment opens without its own successful supported-color scan. Subsystem 1 remains a presentation-only panel with no dispense outcome.
- **Rationale**: This is the specified observable software interaction while separating fixture association, occupancy, UI lid/lock state, and physical contents/actions.
- **Alternatives considered**: Animate/actuate a physical lid, infer dispense success, display medication identity, or use a weight event; rejected as prohibited or unresolved.

## In-scope unknowns

No additional in-scope technical choice remains blocking: target is a local static browser page, fixture behavior is deterministic, session persistence is specified, and no external API/hardware is permitted. The fixture display labels and exact fictional codes can be fixed during implementation, subject to the schema/limitations in [local-browser-contract.md](contracts/local-browser-contract.md).

## Explicitly deferred decisions

The FDA NDC data release/fields/name precedence, online versus downloaded source, freshness policy, physical barcode symbologies/input rules, user confirmation policy for real associations, sensor design/interpretation, lid actuator/controller, refill/replacement physical recognition, failure recovery, and any validation/readiness evidence remain open in [spec.md](spec.md). This prototype neither resolves nor depends on those decisions.
