# Research: Rotation sub-subsystem (Feature 005)

All entries are ASSUMED / NOT_VALIDATED. "UNVERIFIED" means a recalled catalog/datasheet value that must be checked against a real listing before any reliance. No `NEEDS CLARIFICATION` marker remains in the plan; the open choices are listed as questions in the plan summary report.

## Decisions

| # | Decision | Rationale | Alternatives considered |
|---|---|---|---|
| R-1 | Drum weight rides on a 0.3 mm PTFE thrust ring (ID 17 / OD 20) at the drum-underside plane z = 4.0 | The only vertical room is 3.7 → 4.0; hub (r 8) and 625ZZ (Ø16) share a footprint so a hub-only washer would sit on the bearing; hub + four decks form a full disc to r ≈ 11.3 | Washer under hub only (rubs the bearing race); load on the bearing (needs a shoulder, outer race rubs); load on the stepper (plastic output, rejected) |
| R-2 | One 625ZZ-class bearing flush in the platform; second guide optional | Smallest part that gives a defined radial location; flush top keeps the 0.3 mm datum | Bushing only (more friction, wear); 685ZZ (kept as the fallback for the 0.7 mm wall) |
| R-3 | Bought flexible 5-to-5 coupler, 25 mm long (assumed Ø19), between motor shaft and rod; motor stack lowered 16 mm to make room (2026-10-15, user choice) | Keeps misalignment and axial load off the stepper; a standard 25 mm part is easier to buy than a ≤ 10 mm one | Rigid direct coupling (rejected); ≤ 10 mm miniature coupler in an 11.5 mm gap (superseded 2026-10-15) |
| R-4 | D-flat rod + D bore (Ø5.2, flat 2.10 on a rod flat at 2.00) bonded with epoxy; set screw only as fallback | Unbonded 0.10 mm clearance would play ≈ 3.8°, so the epoxy carries zero play (risk R13); set-screw access ≈ 2 mm between tubes. Superseded: line-to-line fit, ≈ 3° play if loose | Loose D bore (rejected); cross pin; pinch hub |
| R-5 | One hall switch + one magnet for home; step counting between stops | Cheapest absolute reference; one wire set, all fixed | Four magnets/one hall (more parts); optical flag (needs a slot in the deck) |
| R-6 | Final approach always CCW with 3° overshoot for CW moves | Removes lost-motion dependence on the last direction; costs ≈ 0.13 s | Bidirectional shortest path (spread = lash); detent (optional, torque trade-off) |
| R-7 | Hardware 0.8 rad/s with 0.2 s trapezoid ramps; sim stays 1.3 rad/s | 1.3 rad/s = 423.8 steps/s is ≈ 83 % of the typical limit; a triangular profile peaks at 2.6 rad/s | Run hardware at 1.3 (no margin); slow the sim (breaks existing tests/evidence) |
| R-8 | **Amended 2026-10-15 (user-approved spec change):** rotation guard, index command, direction policy and fault handling live in a NEW standalone file `docs/visualizer/rotation-controller.js`, tested headlessly; `docs/visualizer/demo-controller.js` is NOT modified and NOT verified by this feature; wiring into the viewer is DEFERRED | `demo-controller.js` must never be edited (user constraint); a standalone module keeps the 14-case harness and Feature 003 evidence unchanged. Original text: "Rotation guard and index command live in the demo controller; existing behaviour stays the default" (superseded) | Edit the demo controller (forbidden); rewrite the FSM (out of scope) |
| R-9 | New parts are integrated submeshes under existing IDs | Keeps exactly 52 IDs and the export inventory rule | New components (violates the 52-ID inventory) |
| R-10 | Headless JS runner = the macOS system tool `jsc` (`/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc`); the browser harness page is the second runner. Probed 2026-10-15 (T003): `jsc -e 'print(1+1)'` works (exit 0). `jsc` has no `window`, so a prelude `var window=this;` must run before any file that assigns `window.X` (`rotation-spec.js`, `concept-data.js`): loading `rotation-spec.js` without it fails with `ReferenceError: Can't find variable: window` (exit 3); with the prelude, `Object.keys(window.DispenserRotationSpec)` prints `version,status,process,g,groups,dims`. `jsc` accepts files and `-e` snippets in order. pytest must SKIP with an explicit reason, never pass silently, if the binary is missing | Installs nothing; Node is not installed here; no network | Node (absent); a Python JS interpreter (would need a package install); browser-only (not automatable here) |
| R-11 | **File layout and deferral (T027, 2026-10-15, user-approved spec change):** standalone controller logic in the NEW `docs/visualizer/rotation-controller.js` (one IIFE, one export `DispenserRotationController`, no DOM, no storage, no clock, no network); headless harness in `tests/browser/feature005/` (`harness-core.js`, `cases-*.js`, `jsc-runner.js`, browser page `index.html` + `browser-tests.js`) run by `tests/test_feature005_rotation_controller.py` under `jsc`; boundary greps in `tests/test_feature005_controller_boundaries.py`. `docs/visualizer/demo-controller.js` is NOT modified and NOT verified (read-only shape check only); wiring into `app.js` / `index.html` / `demo-controller.js` is DEFERRED (register rows W01-W04, `[NEEDS-USER-APPROVAL]`). Wording check: plan D7 closure note, Project Structure and "Next-step task ordering" step 5, R-8 and the spec already say this; the one remaining sentence that implied the viewer controller's states are reused (data-model, state transitions) was corrected | The viewer must not change; a separate file keeps Feature 003 evidence and the demo-controller hash lock intact | Editing the demo controller (forbidden) |

## Unverified recalled facts (must be checked on a real listing/datasheet)

| Fact | Used for | How to verify |
|---|---|---|
| 28BYJ-48: Ø28 × 19, shaft Ø5 double-D (≈ 3 mm across flats) × 8, ears 35 apart | envelope, coupler type | supplier drawing / calipers |
| Gear ratio ≈ 63.68:1 (≈ 2037.9 steps/rev) vs nominal 64:1 (2048) | step drift (+0.447° per 512 steps) | count steps between two home edges |
| Output lash ≈ 1° (range varies) | repeatability risk | dial/camera on a rig, both directions |
| Typical max ≈ 15 rpm (≈ 512 steps/s) at 5 V; holding/pull-in torque ≈ 0.03 N·m, falling with step rate | speed/torque margin | rig stall/step-rate sweep |
| Output shaft eccentric ≈ 8 mm from body centre | body clearance | supplier drawing |
| 625ZZ 5 × 16 × 5; 685ZZ 5 × 11 × 5 | seat sizes | bearing listing |
| A3144-class sensing range and pole sensitivity vs Ø3 × 1 magnet | home placement/gap | bench test |
| PTFE film 0.25–0.3 mm availability; μ ≈ 0.2 against PLA | thrust ring and friction | supplier / rig |
| 25 mm flexible 5→5 coupler, Ø19 (assumed), bore depth ≥ 10 mm rod side and ≥ 5 mm motor side (supersedes the ≤ 10 mm coupler, C2 resolved) | coupler choice | supplier listing / calipers |

## Hand-derived values (re-check numerically in the first next-step task)

- Drum underside full-disc radius ≈ 8√2 ≈ 11.3 mm; tube-gap ≈ 2 mm at the hub diagonal; seat wall ≈ 0.7 mm. Superseded 2026-10-15: the hall/magnet placeholder radii (≈ 34.5 / ≈ 37–41) and ≈ 6° offset are replaced by radius 32.48 at 17.38° off the RED radial (viewer spec).
- Canonical measurements taken 2026-10-13: drum mesh radii {3.0, 8.0, 14.99, 26.54}, tube corner 22.45, blade tab/tongue max r 34.0, 52 unique component IDs.

## Dependency justification

None. No new package, vendored file or network use.
