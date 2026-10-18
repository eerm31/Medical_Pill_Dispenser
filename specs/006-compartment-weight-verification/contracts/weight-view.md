# Contract: Weight verification viewer sub-view

UI and data contract for the fourth subsystem sub-view in `docs/visualizer/` (spec FR-021, FR-022, A-013). Offline, `file://`, no network. All values ASSUMED / NOT_VALIDATED. Presentation only: it replays generated fixtures and never changes Feature 003/004/005 controller state.

## DOM (added to `index.html`)

| Element | ID | Notes |
|---|---|---|
| Radio, after "Compartments & decks" | `weightOnlyToggle` | `name="subsystemView"`, `autocomplete="off"`, label text "Weight verification" |
| Panel | `weightPanel` | `hidden` unless the radio is the active sub-view; modelled on `rotationPanel` |
| Fixture select | `weightFixture` | ~12 curated fixtures |
| Buttons | `weightRun`, `weightReset` | run replays the timeline; reset returns to idle |
| Readouts | `wvDeclared`, `wvExpected`, `wvBefore`, `wvAfter`, `wvAdded`, `wvOutcome`, `wvFollowUp` | every value shows an `ASSUMED` suffix |
| Budget table | `wvBudget` | three loading levels for the recommended arrangement: mass, mass limit, torque, torque limit, pass/fail |
| Banner | `wvBanner` | "ASSUMED / NOT_VALIDATED — concept only. No accuracy, dose-safety, single-dose or print-readiness claim." |

Existing radios, panels and IDs are unchanged. Selecting, switching and leaving the sub-view behave exactly as for the existing three (`enterRotationSubview` / `leaveRotationSubview` pattern).

## Data scripts (classic scripts, load before `reference-look.js`)

```text
window.DispenserWeightSpec = {          // docs/visualizer/weight-spec.js, hand-maintained
  "version": "1", "status": "ASSUMED / NOT_VALIDATED ...",
  "g": { pad/lug/slot/cell/stroke numbers },
  "groups": [ { "id": "wv-station", "label": "...", "focus": [...], "radius": n, "view": "weight" }, ... ],
  "dims": [ same entry shape as rotation-spec.js dims, "view": "weight" ]
}

window.DispenserWeightData = {          // docs/visualizer/weight-data.js, GENERATED
  "generated_from": "src/dispenser_sim/weighing", "hash": "<sha256 of fixtures+budget JSON>",
  "disclosure": "...",
  "fixtures": [ { "id", "label", "compartment", "timeline": [ {"t_ms", "pad": "UP|DOWN", "lid": "...", "reading_mg", "note"} ], "records": [...], "events": [...] } ],
  "budget": { BudgetCheckDocument for arrangement A }
}
```

`weight-data.js` is produced only by `tools/build_weight_data.py`; a test regenerates it and compares the bytes (freshness). The viewer does not classify weights itself.

## 3D content

- Viewer-only submeshes tagged for the sub-view, each with a printed/bought callout: **Weigh pad + bars**, **Load cell + lift carriage**, **Cartridge weigh lugs**, plus line-loop outlines of the deck slots drawn only in this view.
- Labels are added to `VIEW_LABELS.weight` and to `OWN_VIEW` so the rotation sub-view still excludes them; no canonical component is added (52 IDs unchanged); the deck mesh is not modified.
- During a fixture replay the pad rises about 2.1 mm and the compartment at the station lifts 0.5 mm, then both return; this is a presentation transform.

## Behaviour and honesty rules

- Works from a local file with no network, no CDN and no server.
- Every number, outcome and claim is labelled ASSUMED / NOT_VALIDATED; nothing states or implies validated accuracy, dose safety, single-dose integrity, print-readiness or fabricability.
- Fixtures use fictional values; no seeded variation is generated at view time (all generated in Python).
- Refusal fixtures show the refusal reason, not an outcome; held compartments show `QUARANTINED` / `RETRY_EXHAUSTED`.
- Counts of 6 or more declared pills display the note "count inferred from mass within ±20 %".
- The other three sub-views, the dispense demo, the scanner demo and the 14-case controller harness behave exactly as before.
- A reviewer can open the viewer, select the sub-view, run a fixture and read before, after, outcome and budget in under 2 minutes (SC-006) without help.
