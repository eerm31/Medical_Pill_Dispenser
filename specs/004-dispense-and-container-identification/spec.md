- The fictional association remains shown after “Finish loading”. The current prototype does not expose a manual lid toggle for an occupied compartment; explicit demo refill/replacement clears the association. Each reset action is located with its own associated compartment and is enabled only after loading is finished; it cannot act on a failed scan's result or another compartment. Recognition and clearing of real-world refill or container/cartridge events remain unresolved future decisions.
# Feature Specification: Ordered Dispense, Container Identification, and Feedback Workflow

**Feature Branch**: `004-dispense-and-container-identification`

**Created**: 2026-10-11

**Status**: Software-only Subsystem 2 prototype implemented; real NDC, sensor, hardware, and safety decisions remain draft/open

**Input**: User requirement: build the dispensing subsystem first; then identify pill containers by barcode/NDC and associate the resolved drug name with a compartment; then use weight feedback for the user dispense interaction, including reopen-on-no-detection and explicit cancellation.

## Clarifications

### Session 2026-10-11

- Q: Should the requested Subsystem 2 increment be a software concept prototype in the existing browser viewer or physical scanner/hardware integration? → A: Isolated software-only prototype in the existing local browser viewer; no physical hardware integration, and Feature 003 behavior remains unchanged.
- Q: How should the fictional scanner/loading demo choose a compartment and progress after a scan? → A: The only supported fixture compartments are RED, BLUE, GREEN, and ORANGE; start with all four empty, unassociated, closed, and locked. Each supported color's unique fictional barcode maps only to its same-color compartment, without manual target selection. The demo visually presents that container being placed and opens only that available compartment after lookup succeeds. A container of any other or unmapped color, or a no-match, invalid, or ambiguous code, opens none and leaves all four compartments unchanged. “Finish loading” closes and locks the loaded compartment. Other lids stay locked until their own successful scans; unavailable targets do not mutate any compartment.
- Q: When is placement complete, and how are refill/replacement targets chosen? → A: Keep all compartments unchanged through lookup and the visible `placing` animation; bind the fixture and enter the loading/open-lid state only when placement completes. Put demo refill/replacement controls on each associated compartment itself, enabled only after loading is finished; they affect only that compartment.
- Q: What should be visible immediately when the local prototype loads? → A: Open directly to Subsystem 2, with RED, BLUE, GREEN, and ORANGE all visible and empty, unassociated, closed, and locked before any scan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Establish Subsystem 1: Dispensing (Priority: P1)

A user interacts with a compartment through a dispensing subsystem that is built and verified before barcode identification or weight-feedback behavior is added. The subsystem presents an unambiguous compartment and operation state, rejects incompatible or busy operations, and does not silently claim a dispense outcome it has not observed.

**Why this priority**: Dispensing is the foundation and explicit prerequisite for the later identification and sensor-feedback capabilities. It must be independently testable before those layers are introduced.

**Independent Test**: Exercise the initial dispensing workflow and its ready, busy, blocked, and interrupted states without requiring barcode lookup or sensor-feedback features. Confirm that it does not overwrite persisted simulator runs or alter the existing simulator and 2D player.

**Acceptance Scenarios**:

1. **Given** the dispensing subsystem is ready and a compartment is available, **When** the user requests its dispensing workflow, **Then** the subsystem reports the selected compartment and current operation state without depending on barcode/NDC lookup or weight-feedback results.
2. **Given** a dispensing operation is active or a required interlock is not satisfied, **When** the user requests an incompatible operation, **Then** the request is refused with an explicit reason and the active operation and compartment association remain unchanged.
3. **Given** the dispensing subsystem is interrupted by power loss or becomes unavailable, **When** it becomes available again, **Then** it does not silently report success or automatically repeat a dispense; it reports that the outcome requires review if it cannot be established.

### User Story 2 - Establish Subsystem 2: Barcode Scanner and Container Identification Prototype (Priority: P2; depends on Story 1)

The user selects Subsystem 2 in the local browser prototype and sees a component-level scan station: a labeled sample container/barcode, positioning guide, scanner head/optics and scan beam, local fixture decoder/status, and four color-coded compartments—RED, BLUE, GREEN, and ORANGE—with lids. The demo starts with all four compartments empty, unassociated, closed, and locked. The user starts a scan using a clearly fictional demo barcode; there is no manual target-compartment selection. Each supported color's unique fictional barcode maps only to its same-color compartment. A successful unique fixture lookup shows the scanned container being placed into that compartment, then opens only that matching compartment's simulated lid if it is available for loading. A container of any other or unmapped color, or a no-match, invalid, or ambiguous code, opens none and leaves all four compartments unchanged. The compartment indicates loading in progress until “Finish loading” marks it occupied, closes and locks it, and retains its fictional association. Other lids remain locked until each receives its own successful scan. An occupied/unavailable matching compartment cannot change or open any compartment. The association remains until an explicit demo refill or replacement action. No physical reader, real NDC match, medication identity, lid actuator, sensor, or hardware action is involved.

**Why this priority**: The barcode scanner/container-identification subsystem is the next subsystem deliverable after dispensing. Identification is useful only after the dispensing subsystem and compartment workflow exist, and precedes sensor-feedback interaction.

**Independent Test**: Open the local prototype offline and inspect labeled scanner-station components. Verify RED, BLUE, GREEN, and ORANGE start empty, unassociated, closed, and locked. Exercise unique supported-color, other/unmapped-color, unknown, ambiguous, and invalid fictional codes; verify each supported unique result maps only to its same-color compartment with no target selection, shows container placement before opening only that available compartment, and “Finish loading” closes/locks it. Verify all unsupported/unmapped-color and failed scans, and scans mapped to occupied/unavailable compartments, leave every compartment unchanged; other lids stay locked until their own successful scans, and explicit demo refill/replacement clears only its mapped compartment. Confirm no physical reader/network/hardware request occurs, no real medication name is shown, and Feature 003's existing viewer remains unchanged.

**Acceptance Scenarios**:

1. **Given** a newly loaded demo with exactly RED, BLUE, GREEN, and ORANGE compartments, all empty, unassociated, closed, and locked, **When** the user starts a scan with a unique fictional barcode for one of those colors, **Then** the fixture maps it only to its same-color compartment without asking the user to select a target.
2. **Given** a unique fictional barcode maps to an available same-color compartment, **When** its local lookup succeeds, **Then** the demo shows that scanned container being placed into the mapped compartment and only afterward opens that compartment's simulated lid for loading; no other compartment changes.
3. **Given** a unique fictional barcode maps to an occupied or otherwise unavailable compartment, **When** its lookup succeeds, **Then** the demo reports that loading is unavailable, does not show the container as placed, does not open the lid, and leaves all compartment states and associations unchanged.
4. **Given** the mapped compartment is open with loading in progress, **When** the user selects “Finish loading”, **Then** that compartment becomes occupied, its simulated lid closes and locks, its fictional association remains, and no other lid opens or changes.
5. **Given** loading has finished and no new container has been scanned, **When** the demo is idle, **Then** every other lid remains locked; a further compartment opens only after its own unique successful scan maps to an available same-color compartment.
6. **Given** the scan has no match, multiple plausible matches, or an unreadable/invalid barcode, **When** identification completes, **Then** the demo displays the specific unresolved outcome and leaves every compartment's empty/occupied status, association, lid, and lock state unchanged.
7. **Given** a compartment's matching fixture lookup fails, **When** the failure is displayed, **Then** only the scan outcome presentation changes; no compartment is associated, opened, unlocked, or otherwise mutated.
8. **Given** Subsystem 2 is selected, **When** the user inspects its scan station, **Then** the container/barcode, guide, scanner head/optics, beam, local fixture decoder, and four color-coded compartments/lids are visibly represented and labeled as demo components.
9. **Given** a user starts a fixture scan, **When** the demo proceeds, **Then** the view indicates scan/read, local lookup, result, mapped-color container placement, and (only for a successful lookup with an available target) simulated lid opening in that order, without implying a physical scan or actuator movement.
10. **Given** a scan has a unique result for an available target, **When** its placement animation is still in progress, **Then** all compartment associations, occupancy, lid, and lock states remain unchanged; those changes occur only after the placement-complete transition.
11. **Given** one or more compartments have finished loading, **When** the user chooses Demo Refill or Demo Replace on one associated compartment, **Then** only that compartment returns to empty/unassociated/closed/locked; these controls are unavailable for other compartments and while a scan/loading operation is active.
12. **Given** the four supported compartments are RED, BLUE, GREEN, and ORANGE, **When** the user scans a container of any other or unmapped color, or a code with no match, invalid input, or ambiguous matches, **Then** no compartment opens and all four compartments' occupancy, association, lid, and lock states remain unchanged.
13. **Given** the user opens the local prototype, **When** the page finishes loading before any scan, **Then** the scanner/loading view is selected and all four supported compartments are visibly empty, unassociated, closed, and locked.

### User Story 3 - Use Weight Feedback to Guide the Open-Lid Interaction (Priority: P3; depends on Stories 1 and 2)

After a container is identified and its compartment lid is open, the user dispenses from that compartment. Weight sensing reports a confirmed change, no detected dispense, or an uncertain result according to an explicitly approved interpretation. If the user closes the lid without a detected dispense, the lid reopens and remains available for a user-directed dispense until a dispense is detected or the user cancels. The system never automatically initiates another dispense. A weight change is not proof of drug identity, pill count, or a safe dose.

**Why this priority**: Feedback depends on both a working dispensing subsystem and a known compartment/container association. It is the last stage because sensor meaning and safety policy have unresolved design choices.

**Independent Test**: After Stories 1 and 2 are available, exercise confirmed weight change, no change, uncertain readings, closure/reopening, cancellation, and interruption. Verify explicit user-visible states, no automatic repeat dispense, and no inference of identity or safe dose from weight alone.

**Acceptance Scenarios**:

1. **Given** a uniquely identified compartment is open for user dispensing, **When** the user dispenses and the adopted feedback rules determine a confirmed weight change, **Then** the system records and displays “dispense detected” for that interaction without asserting pill identity, exact pill count, or dose safety from weight alone.
2. **Given** the compartment is open and no dispense has been detected, **When** the user closes its lid, **Then** the lid reopens and the compartment remains available for a user-directed dispense; the system does not automatically actuate or initiate another dispense.
3. **Given** feedback is absent, contradictory, or outside the approved interpretation, **When** the interaction is evaluated, **Then** the system reports “uncertain” or “not detected” rather than success, leaves the compartment in an explicit attention-required state, and does not automatically dispense again.
4. **Given** a no-detection or uncertain interaction remains open for user action, **When** the user cancels, **Then** the system enters a clearly labeled canceled/unconfirmed state, makes no claim that a pill was dispensed, and performs no automatic redispense. Any required physical lid position or recovery action must follow a separately approved safety decision.
5. **Given** a confirmed feedback event has been recorded, **When** the user closes the lid, **Then** the system does not reopen the lid solely because that same dispense interaction had previously been closed or evaluated; it retains the recorded outcome and compartment identity.
6. **Given** power, sensing, or feedback interpretation fails while an interaction is active, **When** the system resumes, **Then** it reports an interrupted or uncertain outcome, does not silently convert the event to a confirmed dispense, and does not automatically restart or repeat the dispense.
7. **Given** another compartment operation or a required interlock is active, **When** scan, lid, dispense, or feedback actions conflict, **Then** incompatible actions are blocked or refused with a visible reason and cannot silently change another compartment's association or outcome.

### User Story 4 - Select a Subsystem View or Compose the Overall Design (Priority: P2)

A user can select an individual view for Subsystem 1 (dispensing) or Subsystem 2 (barcode scanner/container identification), or select an Overall Design view. An individual subsystem view shows only that subsystem. The Overall Design view combines the subsystems selected by its per-subsystem include/show checkboxes, so a user can include or hide either subsystem independently.

**Why this priority**: Separate views make each subsystem independently inspectable while the overall view makes their composition explicit, without conflating their boundaries or delivery order.

**Independent Test**: Select each subsystem view and verify that only its subsystem is visible. In Overall Design, verify both subsystems are initially included, toggle each checkbox independently, and confirm the visible composition exactly matches the checked subsystems, including a clear empty composition when neither is checked. Include selections persist while switching views during the current session and reset to both included in a new session/reload.

**Acceptance Scenarios**:

1. **Given** the subsystem views are available, **When** the user selects Subsystem 1, **Then** only the dispensing subsystem is shown and Subsystem 2 is not shown; selecting Subsystem 2 shows only the barcode scanner/container-identification subsystem and not Subsystem 1.
2. **Given** either subsystem view is selected, **When** the user selects Overall Design, **Then** the overall composition is shown with independent include/show checkboxes for Subsystem 1 and Subsystem 2, both checked on the first entry.
3. **Given** Overall Design is shown with both checkboxes checked, **When** the user unchecks one subsystem, **Then** only that subsystem disappears from the overall composition and the checked subsystem remains visible; checking it again restores it.
4. **Given** Overall Design is shown, **When** the user unchecks both subsystems, **Then** neither subsystem is shown and the view communicates that no subsystems are included.
5. **Given** the user switches among the subsystem and overall views, **When** a view changes, **Then** the view selection and include/show controls do not themselves change a subsystem's operational state or compartment association.

### Edge Cases

- A fictional demo code is unreadable, malformed, absent, ambiguous, or has no fixture match; the demo must report the outcome and leave every compartment unchanged rather than guess a fictional label or target.
- The only supported fixture compartment colors are RED, BLUE, GREEN, and ORANGE. A container of any other or unmapped color, or a no-match, invalid, or ambiguous code, is unsuccessful: no lid opens and all four compartments' occupancy, association, lid, and lock states remain unchanged.
- For any future NDC-based work (not the current prototype), multiple products, conflicting names, inactive/uncertain records, or unclear package/product relationships remain unresolved rather than being selected by an invented tie-break rule.
- The current prototype uses only its local fictional fixture table and makes no network or NDC lookup; any future data-source or connectivity failure must not be represented as a successful match or authorize opening.
- A successful unique fixture lookup maps to an occupied or otherwise unavailable same-color compartment, or another operation is in progress; the target must not be overwritten or opened, and no alternate compartment may be selected manually.
- A second scan arrives while another scan or loading action is in progress; it must not cross-assign a container, open a second lid, or alter the active compartment.
- The demo is idle after loading one compartment and no next container is scanned; all remaining compartment lids stay locked.
- The displayed container-placement and lid-opening animation must not begin before the unique local fixture lookup succeeds; a failed or unavailable-target result must not imply placement or loading.
- Compartment state must remain unchanged while a successful scan's placement presentation is still running; the completion of that presentation is the single state-transition boundary before loading/open/unlocked begins.
- Demo refill/replacement controls are scoped to their own associated compartment and are unavailable until loading is finished; they must not use the last scan result as an implicit target or affect another compartment.
- The fictional association remains shown after “Finish loading” and routine lid close/reopen; explicit demo refill/replacement clears it. Recognition and clearing of real-world refill or container/cartridge events remain unresolved future decisions.
- No sensor change, a small change, drift, vibration, removal of a different item, or contradictory readings occur; a weight change may be ambiguous and must not alone establish identity, pill count, or safe dose.
- The user closes the lid before a confirmed detection; the lid reopens and remains available for user action, with no automatic redispense.
- The user cancels before or after an uncertain reading; the interaction ends in a visible canceled/unconfirmed state without claiming success or triggering a dispense.
- A future sensor or operation failure occurs after a lid has opened; the workflow must distinguish lid state from identification/dispense outcome and must not fabricate success. The current prototype has no sensor or hardware operation.
- Power loss happens during scanning, lid movement, dispensing, or feedback evaluation; after recovery, the result is explicit and no unobserved action is automatically repeated.
- A compartment is busy, absent, or otherwise interlocked; requests must be refused without changing another compartment or overwriting an earlier association.
- The user asks for a medical, identity, dose, or safety conclusion based only on a barcode match or weight change; the system must not imply that the available evidence supports that conclusion.
- In an individual subsystem view, content from the other subsystem is visible; the individual view must remain isolated rather than showing a partial overall composition.
- In Overall Design, one or both include/show checkboxes are off; the composition must match the checked set, including the case where neither is checked.

## Requirements *(mandatory)*

### Functional Requirements

#### Delivery order and dependencies

- **FR-001**: Subsystem 1, the dispensing subsystem, MUST be the first subsystem deliverable and MUST be independently exercised before barcode/NDC identification is introduced.
- **FR-002**: Barcode/NDC association MUST depend on the dispensing subsystem's compartment and availability states; it MUST NOT be treated as an independent substitute for the dispensing workflow.
- **FR-003**: Subsystem 2 MUST be the barcode scanner and container-identification subsystem, delivered after Subsystem 1. Weight-feedback interaction MUST depend on both subsystems and MUST follow them as a later stage: dispensing first, scanner/container identification second, feedback interaction third.
- **FR-004**: Later stages MUST preserve the behavior and data of earlier stages; an identification or feedback failure MUST NOT silently corrupt the dispensing operation or another compartment's state.

#### Container identification and compartment association

- **FR-005**: The current Subsystem 2 prototype MUST accept a user-entered local demo barcode and look it up only in a bundled local fixture table. Fixture codes and names MUST be explicitly fictional/demo data and MUST NOT be represented as real NDC records, medication, or FDA-directory lookups. A unique fixture result MUST identify its same-color compartment without manual target selection. The FDA NDC Directory remains the intended reference for a possible future data-import stage; that stage is not implemented here.
- **FR-005a**: The current increment MUST NOT integrate a physical barcode reader, ESP32, network service, NDC database, lid actuator, weight sensor, or other hardware. Physical reader, controller, electrical/protocol, data source, and sensor decisions remain future work.
- **FR-005b**: The local fixture table MUST include deterministic unique-match, ambiguous-result, no-match, and invalid-input cases so the user can exercise outcomes offline without external requests.
- **FR-006**: The system MUST associate a fictional fixture label only when lookup yields a unique, unambiguous result. It MUST NOT choose among ambiguous matches by an undocumented rule.
- **FR-007**: On a successful identification with an available target, the system MUST display the fictional fixture label on, or unambiguously alongside, the same-color compartment and MUST associate it with that compartment rather than with the device generally.
- **FR-008**: After a unique local fixture lookup succeeds, the demo MUST visually present the scanned container being placed into its mapped same-color compartment and then set only that available compartment's simulated lid state to open for loading. No simulated lid may open before successful lookup. Failed lookups and unavailable targets MUST NOT open a lid or mutate any compartment. These are UI states only; no physical lid movement is implemented or implied.
- **FR-009**: The association MUST remain bound and visible after “Finish loading” until that compartment is explicitly reset by its demo refill or replacement action. The current prototype MUST NOT offer a manual lid toggle for an occupied compartment.
- **FR-010**: In the current prototype, the explicit demo refill or replacement action MUST clear the prior fictional association and occupancy before a later scan can bind a new fictional label. Recognition and confirmation of real refill or cartridge/container replacement events remain unresolved future decisions and MUST be agreed before any physical integration.
- **FR-011**: No match, multiple/ambiguous matches, unreadable barcode, invalid code, or unavailable lookup MUST produce an explicit non-success status, MUST NOT assign a drug name, and MUST NOT open a compartment lid on the basis of that unsuccessful identification.
- **FR-012**: Lookup or barcode failure MUST NOT be represented as a successful match, and a name returned by a data source MUST be presented as a database association rather than proof of the actual container contents.

#### Weight-feedback interaction and explicit outcomes

- **FR-013**: The system MUST use per-compartment weight sensing as feedback about whether material may have left the selected compartment and MUST expose an explicit outcome state that distinguishes detected, not detected, and uncertain/interrupted results under approved interpretation rules. A per-compartment sensor is the selected concept location; its mechanical implementation, performance and interpretation remain unvalidated.
- **FR-014**: A change in measured weight MUST NOT by itself establish drug identity, exact pill count, correct medication, or a safe dose. The system MUST NOT make those claims from a weight event.
- **FR-015**: If the user closes the compartment lid before a dispense is detected, or the reading is uncertain, the system MUST reopen it and keep the compartment available for user-directed dispensing until a dispense is detected or the user cancels. Reopening MUST NOT actuate the dispensing mechanism or repeat a prior dispense command.
- **FR-016**: Reopening after no detection MUST NOT automatically trigger a second dispense, repeat a prior dispense command, or otherwise redispense. All subsequent dispensing action requires an explicit user action.
- **FR-017**: A cancel action MUST end the pending interaction in an explicit canceled/unconfirmed state, MUST NOT assert that a dispense occurred, and MUST NOT automatically dispense. The physical lid state and any recovery action on cancel remain an open safety decision.
- **FR-018**: An absent, ambiguous, contradictory, or failed sensor reading MUST NOT be treated as a confirmed dispense. It MUST produce a visible not-detected, uncertain, or interrupted state and require the user-facing recovery policy to be explicit.
- **FR-019**: Power, sensor, database, or network failure MUST NOT produce a silent success, automatic retry that dispenses, or automatic continuation of a dispense whose outcome is unknown. The system MUST report the affected operation and leave it in an explicit review state.

#### Coordination, status, and scope preservation

- **FR-020**: The system MUST identify the compartment and workflow state for scan, identification, lid, dispense, and feedback interactions sufficiently to prevent a result from being attributed to the wrong compartment.
- **FR-021**: Conflicting operations or unmet interlocks MUST be refused or blocked with an explicit status; refusal MUST leave the active operation and compartment association coherent.
- **FR-022**: The workflow MUST distinguish the lid's physical/open/closed state from the identity lookup result and the dispense feedback result; a failure in one MUST NOT be misreported as success in another.
- **FR-023**: This feature MUST NOT change the feature-003 browser's deterministic concept-demo scope. That browser remains a concept demo and MUST make no hardware, medication-identification, safety, or single-dose claim.
- **FR-024**: This feature MUST preserve the existing simulator, persisted run records, core simulation behavior, and feature-002 2D player. It MUST NOT overwrite, reinterpret, or weaken their behavior or verification.
- **FR-025**: The feature MUST NOT claim that a barcode/NDC match verifies a container's actual contents, that a weight change proves a correct dose, or that the workflow is medically safe or physically validated.
- **FR-026**: The user interface MUST provide a selectable individual view for each subsystem and a separate Overall Design view. Selecting Subsystem 1 MUST show only the dispensing subsystem; selecting Subsystem 2 MUST show only the barcode scanner/container-identification subsystem.
- **FR-027**: The Overall Design view MUST combine the subsystems selected for inclusion and MUST provide a separate include/show checkbox for each subsystem. Each checkbox MUST independently add or remove only its corresponding subsystem from the overall composition.
- **FR-028**: On the first entry to Overall Design, the include/show checkboxes for Subsystem 1 and Subsystem 2 MUST both be checked. If both are unchecked, the view MUST show neither subsystem and MUST clearly indicate that no subsystem is included.
- **FR-028a**: Include/show checkbox selections MUST be retained when switching views in the same running session and MUST reset to both subsystems included on a new session/reload. Persistent cross-session storage is out of scope unless separately specified.
- **FR-029**: Selecting views or changing include/show checkboxes MUST NOT itself change subsystem operational state, compartment state, or identity associations. Individual subsystem views and composition controls are presentation behavior, not evidence of hardware readiness, medication identity, dispensing accuracy, or safety.
- **FR-030**: The Subsystem 1, Subsystem 2, and Overall Design views specified here apply only to Feature 004 and MUST NOT expand or alter Feature 003's offline, deterministic, concept-only, non-hardware scope.
- **FR-031**: For the requested next increment, Subsystem 2 MUST be an isolated software-only concept prototype in a dedicated local browser view. It MUST NOT connect to or control a physical scanner, compartment, lid, actuator, or sensor, and MUST NOT imply that any physical scan or action occurred. Its state and interactions MUST remain separate from Feature 003's deterministic demo behavior, which MUST remain unchanged.
- **FR-032**: The Subsystem 2 prototype MUST provide explicit demo refill/replacement actions on each associated compartment. These actions MUST be available only after loading finishes and while no scan/loading operation is active; each action clears only its own compartment's fixture association and occupancy and returns it to the empty, closed, locked initial state. They MUST be clearly labeled as demo state changes and MUST NOT change Feature 003 inventory or controller state.
- **FR-033**: The Subsystem 2 view MUST visibly represent and label, at minimum, a demo container/barcode, container guide or positioning surface, scanner head/optical read point, scan beam, local fixture-decoder/status component, and the four-compartment target bank with distinct simulated lids. These are illustrative software components, not a verified physical design.
- **FR-034**: Starting a demo scan MUST show a deterministic, understandable visual sequence for container positioning/read, local fixture lookup, displayed outcome, mapped-color container placement, and (only for successful lookup with an available target) simulated lid opening. The beam and target highlight MUST be scoped to the fixture-mapped compartment, not a user-selected target. Failed/ambiguous outcomes MUST NOT change compartment state. No random behavior, network lookup, physical scan, or hardware command is permitted.
- **FR-035**: On initial load, the demo MUST show exactly four distinct color-coded compartments, each empty, unassociated, closed, and locked. A compartment is available for loading only when it is empty, unassociated, closed, and not already in an active loading operation.
- **FR-036**: A unique fictional barcode MUST map deterministically to its same-color compartment without offering or requiring manual target selection. If that compartment is occupied, associated, loading, or otherwise unavailable, the demo MUST report the outcome without choosing another compartment or changing any compartment state.
- **FR-037**: For a successful scan whose mapped compartment is available, the demo MUST visually show the scanned container being placed into that compartment and open only that compartment's simulated lid after lookup success. Compartment state MUST remain unchanged until the placement presentation completes; at that boundary, the compartment receives the fictional association and enters loading with its simulated lid open/unlocked. It MUST indicate loading in progress until the user selects “Finish loading”; that action MUST mark it occupied, close and lock it, and retain the association.
- **FR-038**: After “Finish loading”, no other compartment lid may open automatically. An additional compartment may open only after its own successful unique fictional scan maps to that available compartment.
- **FR-039**: Any unsuccessful scan, or successful lookup whose matching compartment is unavailable, MUST leave every compartment's occupancy, fictional association, lid state, and lock state unchanged.
- **FR-040**: Demo refill and replacement controls MUST be associated with the compartment whose fixture association they clear. They MUST be available only for a compartment whose loading is finished and MUST be disabled while scanning or loading is active. Each action resets only that compartment to empty, unassociated, closed, and locked; it MUST NOT use a “last scanned” target or affect any other compartment.
- **FR-041**: The only supported fictional fixture compartment colors MUST be RED, BLUE, GREEN, and ORANGE, and each supported color's unique fictional barcode MUST map only to its same-color compartment. A scanned container of any other or unmapped color, or a code with no match, invalid input, or ambiguous matches, MUST be treated as unsuccessful: it MUST open no compartment and MUST leave all four compartments' occupancy, association, lid, and lock states unchanged.
- **FR-042**: The local prototype MUST initially select Subsystem 2 so the scanner view and all four empty/unassociated/closed/locked supported compartments are visible immediately after page load, before any scan.

### Key Entities

- **Compartment**: One of four distinct color-coded pill-holding locations with its own empty/occupied/loading availability, lock and simulated lid states, current fictional container association, and dispense interaction state. Its target color is determined by the fictional barcode mapping, not manual selection.
- **Pill Container**: A refill or replaceable source container identified through its barcode; the scanned code and the actual contents are distinct facts.
- **Barcode/NDC Lookup Result**: A match, no match, ambiguous result, invalid/unreadable input, or unavailable lookup, with any returned name and its source status.
- **Compartment Identity Association**: The displayed drug name bound to one compartment, its origin as a lookup result, and its lifecycle invalidation on refill or container/cartridge replacement.
- **Lid State**: The actual or last-known state of a compartment lid, kept separate from identity and dispense outcome.
- **Dispense Interaction**: One user-initiated attempt with a selected compartment, pending/detected/not-detected/uncertain/canceled/interrupted outcome, and no automatic repeat.
- **Weight Feedback Event**: An observed weight-related signal interpreted under a future approved rule; it is not, by itself, a drug identity, pill count, or dose determination.
- **Subsystem View**: One of the selectable Subsystem 1, Subsystem 2, or Overall Design presentations; an individual subsystem view exposes only that subsystem.
- **Overall Design Composition**: The combined presentation of Subsystem 1 and/or Subsystem 2 as selected by their independent include/show checkboxes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all acceptance runs, the dispensing subsystem is exercised before identification, and identification before weight-feedback interaction; later stages cannot be represented as prerequisites satisfied when an earlier stage is unavailable.
- **SC-002**: In all unambiguous fictional-fixture test cases, the fictional label is bound only to the mapped same-color compartment when that compartment is available; in all no-match, ambiguous, invalid, unreadable, lookup-failure, and unavailable-target cases, no association is assigned or overwritten and no lid is opened because of that scan.
- **SC-003**: The compartment's fictional association remains visible after “Finish loading”; in the prototype it is cleared only by that compartment's explicit demo refill or replacement action.
- **SC-004**: In 100% of close-before-detection test cases, the compartment lid reopens and remains available for user action until detection or cancellation, without an automatic additional dispense.
- **SC-005**: Detected, not-detected, uncertain, canceled, and interrupted outcomes are distinguishable to the user; no ambiguous, absent, contradictory, or failed reading is reported as a confirmed dispense.
- **SC-006**: No workflow state or user-facing message infers drug identity, exact pill count, or a safe dose solely from a weight change, and no scan is presented as proof of actual container contents.
- **SC-007**: In 100% of cancel, power-loss, database/network failure, sensor-failure, busy, and interlock test cases, the user receives an explicit status and no automatic retry/redispense or silent success occurs.
- **SC-008**: No test or workflow change modifies persisted simulator runs, core simulation results, or feature-002 2D playback behavior.
- **SC-009**: A user can determine the selected compartment, whether a name is currently bound, whether the lid is open, and whether the dispense outcome is detected, not detected, uncertain, canceled, or interrupted from the presented state without interpreting a raw sensor reading.
- **SC-010**: In every view-selection test, Subsystem 1 shows only dispensing content, Subsystem 2 shows only barcode scanner/container-identification content, and Overall Design shows exactly the set of subsystems whose include/show checkboxes are checked.
- **SC-011**: In 100% of composition-control tests, toggling either checkbox changes only its corresponding subsystem's visibility; toggling both off leaves neither subsystem visible and displays an explicit empty-composition state, with no change to operational subsystem or compartment state.
- **SC-012**: A reviewer can identify all required Subsystem 2 demo-station components from visible labels and follow scan/read → fixture lookup → result; placement and simulated lid opening occur only for a unique result with an available target, while ambiguous and no-match examples stop without compartment changes.
- **SC-013**: In 100% of new-session tests, exactly four compartments labeled RED, BLUE, GREEN, and ORANGE begin empty, unassociated, closed, and locked.
- **SC-014**: In 100% of unique fixture tests, the demo maps the barcode to its same-color compartment without manual target selection, presents the scanned container as placed only after successful lookup, and opens only that available compartment afterward.
- **SC-015**: In 100% of “Finish loading” tests, the mapped compartment becomes occupied, closes, and locks while retaining its association; all other lids remain locked until their own successful scans. An explicit demo refill/replacement restores only its mapped compartment to empty, unassociated, closed, and locked.
- **SC-016**: In 100% of failed-scan and unavailable-target tests, all four compartments retain their prior occupancy, association, lid, and lock states, with no container-placement claim or placement animation for the unavailable target.
- **SC-017**: In 100% of successful available-target scans, all compartment state remains unchanged until placement completes; only afterward does the same-color compartment bind and enter loading/open/unlocked.
- **SC-018**: In 100% of refill/replacement tests, the action is available only on its associated finished compartment, resets only that target, and cannot be misdirected by a later failed or different-color scan.
- **SC-019**: In 100% of supported-color fixture tests, each unique fictional barcode maps only to its same-color compartment among RED, BLUE, GREEN, and ORANGE; in every other/unmapped-color, no-match, invalid, or ambiguous test, no lid opens and all four compartments' occupancy, association, lid, and lock states remain unchanged.
- **SC-020**: On every new page session, Subsystem 2 is the initially selected visible panel and shows exactly four supported compartments, all empty, unassociated, closed, and locked before any scan.

## Assumptions

- This feature specifies a staged product workflow; it does not authorize a medical-use claim, establish physical safety, or demonstrate exactly-one-pill delivery.
- “Dispensing subsystem first” means the basic compartment dispensing capability and its explicit ready/busy/interlock states are the first independently verifiable stage; barcode identity and weight feedback are later dependent stages.
- An NDC name is a database association to the scanned code, not verification that the scanned container or compartment actually contains that drug.
- The user selected the FDA NDC Directory as the reference source and said a project-maintained database is acceptable for this capstone. This does not choose live versus downloaded data, a data refresh schedule, or brand/generic/display-name precedence.
- The user selected per-compartment weight sensing as the concept location and requested reopening the lid after no or uncertain detection until a user-directed dispense is detected or canceled. Sensor accuracy and a safe physical lid/recovery behavior remain unvalidated.
- A confirmed weight change means only that an approved interpretation rule classified the observation as detected for that interaction. It does not prove pill identity, count, or dose safety.
- Until an approved classification and recovery policy exists, ambiguous or unavailable feedback is treated as not confirmed, shown as uncertain/unconfirmed, and never triggers an automatic repeat dispense.
- Ordinary lid closure and “Finish loading” do not clear the compartment's fictional association. In this prototype, explicit demo refill and replacement actions clear only their target compartment's association and occupancy; recognition and confirmation of real-world lifecycle events remain unresolved for future work.
- “Finish loading” does not clear the compartment's fictional association. The current prototype has no manual lid toggle for an occupied compartment. Explicit demo refill/replacement actions clear only their own target compartment's association and occupancy; recognition and confirmation of real-world lifecycle events remain unresolved for future work.
- The feature-003 browser remains a deterministic concept demonstration only, independent of hardware and this medication-identification workflow. The existing simulator, persisted runs, and feature-002 2D player remain preserved.
- Subsystem 1 means dispensing; Subsystem 2 means barcode scanning and container identification. The barcode scanner/container-identification subsystem is the next subsystem deliverable after dispensing, while weight-feedback interaction remains a later dependent stage.
- The first time Overall Design is entered, both subsystems are included. Include/show selections persist across view changes in the current session and reset to both included on reload; cross-session persistence is out of scope.
- The user clarified that the current requested increment is a software-only browser prototype. Physical reader/ESP32/UART and actuator integration are not in scope for this increment and MUST NOT be implemented.
- The user confirmed that a unique fictional scan automatically maps to the compartment of the same color without manual target selection. Only after successful lookup does the UI show the container being placed and open that available compartment's simulated lid. The user closes and locks it with “Finish loading”; no following compartment opens without its own successful scan.
- The four color-coded compartments begin empty, unassociated, closed, and locked. A compartment with an existing association or other unavailable state cannot be overwritten or opened by another scan. Failed scans and unavailable-target results alter only the scan result presentation, never compartment state.
- Local lookup fixtures MUST use conspicuously labeled fictional demo code/name pairs; they MUST NOT resemble real NDC records or claim FDA/medication verification.
- Overall Design include/show checkbox state is session-scoped: preserved across view changes and reset to both included on reload/new session.
- The requested next increment is a software-only Subsystem 2 prototype presented through the existing local browser viewer; physical scanner and dispenser integration are not part of that increment. The prototype is not medical or safety validation and does not make a medication, dose, or hardware-action claim.

## Open Questions

1. Which FDA NDC Directory fields and data release should the local capstone database use, how often will it be refreshed, and what is the displayed name precedence (proprietary/brand versus nonproprietary/generic, strength, dosage form, package)?
2. Must the local database work fully offline, and what stale-data/freshness warning or update process is required? Is any later online lookup in scope?
3. Which barcode symbologies and input-quality rules will apply to any future real barcode input? For this fictional prototype, manual target selection and additional confirmation are not required: a unique successful local lookup maps to its same-color available compartment and authorizes only the simulated loading-lid opening described above.
4. What sensor design and interpretation define detected, not detected, and uncertain? What thresholds, calibration, stability window, and false-positive/false-negative handling are acceptable for per-compartment weight sensing?
5. Is pill-count inference required at all? If so, what independent evidence and validation would justify it? Weight change alone is insufficient to infer exact count or identity.
6. For future physical operation, what exactly constitutes a refill versus a cartridge/container replacement, how is each event recognized or confirmed, and when must the existing name be cleared or retained? The prototype's explicit demo refill/replacement actions clear their target association; “Finish loading” closes/locks while retaining it.
7. What physical lid position and recovery action are appropriate on cancellation, power loss, or a failure after the lid has opened? The requested reopen-on-no/uncertain behavior is a concept requirement, not a verified physically safe position.
8. Which operations and interlocks must be exclusive or mutually blocked, and what user confirmation or recovery step is required after an interrupted/busy state?
9. What validated evidence, if any, will be required before making medication-identification, physical-safety, or dispensing-accuracy claims? No such claim is authorized by this specification.
10. If physical integration is authorized in a later feature, which reader/controller, interface, and lid-actuation safeguards will be selected? These questions do not block the current software-only prototype and do not authorize hardware control here.
