# Data Model: Feature 004 Local Browser Increment

This model is client-side, fictional, and in-memory. It is not a medication database, device state report, sensor record, or persisted simulator record.

## Entities

### FixtureCase

| Field | Type | Rule |
|---|---|---|
| `caseId` | string | Stable, unique fixture scenario identifier. |
| `demoCode` | string | Synthetic, conspicuously fictional code; may be blank/malformed only for invalid-input scenarios. Never presented as a real barcode/NDC. |
| `expectedOutcome` | enum | `unique`, `unsupported-color`, `ambiguous`, `no-match`, or `invalid`; deterministic test/example outcome. |
| `candidates` | array of FixtureCandidate | Empty for no-match/invalid; one for unique; two or more for ambiguous. |
| `demoLabel` | string | Human-visible demo-only scenario label. |
| `targetColor` | color identifier or null | For unique fixture records, one of `red`, `blue`, `green`, or `orange`; maps deterministically to exactly one compartment. Null for unsupported-color and other outcomes. |

### FixtureCandidate

| Field | Type | Rule |
|---|---|---|
| `candidateId` | string | Stable identifier within the fixture data. |
| `fictionalDisplayName` | string | Must be explicitly labeled fictional/demo and not represent a real product or NDC match. |

### CompartmentState

| Field | Type | Initial value / rule |
|---|---|---|
| `compartmentId` | string | Stable identifier; four demo compartments. |
| `label` | string | Neutral color/compartment label; no real medication implication. |
| `color` | color identifier | One of `red`, `blue`, `green`, or `orange`; stable and unique, used by fixtures to map a successful result to this compartment. |
| `occupancy` | `empty`, `loading`, or `occupied` | Starts `empty`; `loading` is entered only after an available mapped target is opened; “Finish loading” sets `occupied`. UI state only. |
| `boundFixture` | FixtureCandidate or null | Null initially and after demo refill/replacement. Bound only after a unique match to an available mapped compartment; records fixture origin, not actual contents. |
| `simulatedLidState` | `closed` or `open` | Starts `closed`; opens only for the available fixture-mapped target after successful lookup and placement. UI state only. |
| `simulatedLockState` | `locked` or `unlocked` | Starts `locked`; becomes `unlocked` only during loading and returns to `locked` on “Finish loading” or demo refill/replacement. UI state only. |

### Feature004SessionState

| Field | Type | Initial value / rule |
|---|---|---|
| `selectedView` | enum | `subsystem1`, `subsystem2`, or `overall`; defaults to `subsystem2` so the empty scanner compartments are immediately visible. |
| `includeSubsystem1` | boolean | Defaults to true; only controls Overall Design visibility. |
| `includeSubsystem2` | boolean | Defaults to true; only controls Overall Design visibility. |
| `lastScanOutcome` | enum/status | Explicitly reports not-yet-scanned, reading, resolving, unique, unsupported-color, unavailable, ambiguous, no-match, invalid, placing, loading, loaded, reset, blocked, or busy. It is not a device health or physical scan report. |
| `scannerDemo` | object | Volatile presentation state: `phase` is `ready`, `reading`, `resolving`, `result`, `placing`, `loading`, `unavailable`, `unsupported-color`, `ambiguous`, `no-match`, or `invalid`; includes the synthetic `demoCode`, resolved fixture record/candidate, and fixture-derived `targetColor` when unique. It does not accept or capture a user-selected compartment and is not a scanner hardware state. |
| `compartments` | map of CompartmentState | Independent association/lid record per compartment. |

## State transitions

1. **Initial session**: select the Subsystem 2 scanner view and create exactly four color-distinct compartments—RED, BLUE, GREEN, and ORANGE—each `empty`, unassociated, `closed`, and `locked`; set both Overall Design include checkboxes to true.
2. **Begin demo scan**: accept only the synthetic code input, enter `reading`, then `resolving`, without changing any compartment. No manual target selection is part of the model. A scan requested while reading/resolving/result/placing/loading is active reports busy and preserves the active scan/loading target.
3. **Unique local lookup and placement**: a unique fixture result supplies its `targetColor`, which maps to exactly one compartment. If that target is `empty`, unassociated, `closed`, and `locked` and no scan/loading operation is active, enter `placing` and animate the container toward that target. Compartment state remains unchanged during the placement phase. Only the placement-complete transition binds the fictional candidate, sets occupancy to `loading`, and sets that target's lid/lock to `open`/`unlocked`. No other compartment changes.
4. **Unavailable target**: if the uniquely mapped target is occupied, associated, loading, or otherwise unavailable, report `unique/unavailable`; show no placement and leave all compartment fields unchanged. Never choose another target.
5. **Unsupported or failed lookup**: set only the scan presentation/outcome for unsupported-color, ambiguous, no-match, invalid, or unlisted codes. Every compartment's occupancy, association, lid, and lock remain unchanged. Unsupported colors do not acquire a substitute target.
6. **Finish loading**: for the active loading target, set occupancy to `occupied`, lid to `closed`, and lock to `locked`; retain `boundFixture`. Other compartments remain unchanged. The prototype offers no separate manual open/close control for an occupied compartment.
7. **Busy scan**: refuse a scan while reading/resolving or loading is active. Present a busy result without modifying any compartment or changing the active target.
8. **Demo refill/replacement**: each associated compartment has its own reset controls; enable them only after its loading operation finishes and while no scan/loading operation is active. The chosen compartment's controls restore it to `empty`, unassociated, `closed`, and `locked`. Other compartments remain unchanged. A scan result, including a failed or later different-color scan, never changes the reset target.
9. **View/composition control**: change `selectedView` or one include checkbox only. Must not mutate compartment state, active loading, or scan outcome.
10. **Reload/new page session**: recreate the initial state. No storage or export is used.

## Invariants

- A fixture association exists only after a unique fixture result maps to an available target; candidate ambiguity and unavailable targets never bind.
- Only RED, BLUE, GREEN, and ORANGE compartments are supported. Fixture target color—not a manual selector—determines the only compartment eligible for a successful scan; all other colors produce unsupported-color and no target.
- Initial compartments are exactly four, distinct in color, empty, unassociated, closed, and locked.
- A failed or unavailable scan cannot show placement, open/unlock a lid, or overwrite/clear/change any compartment state. A successful available scan also leaves all compartment state unchanged until its placement animation completes.
- At most one scan/loading operation is active; a busy attempt cannot change the active target or any compartment.
- “Finish loading” makes only the active target occupied/closed/locked and retains its association.
- Explicit demo refill/replacement resets only the associated compartment whose own control was activated to empty/unassociated/closed/locked. A retained association is never cleared by finishing loading.
- Overall Design shows exactly the checked subsystem presentations; both unchecked means neither is shown and an empty-state message is shown.
- View and inclusion controls are presentation state, not operational evidence.
- Scanner components, beam, decoder and target-bank visuals are diagrammatic; scan phase timing serves only the UI demonstration and does not represent scanner latency, reader performance, or physical actuation.
- All values are volatile, fictional, and scoped to this page; no state is shared with Feature 003 or the Python simulator.
- There is no sensor value, pill count, dispense outcome, actual content assertion, hardware command, or physical lid state in this model.
