# Contract: Static Viewer, Demo Controller and Scene

**Feature**: 003-3d-mechanism-visualization | **Version**: 3.1 (viewer contract; controller harness implemented, foreground browser acceptance pending)

**Implementation status**: Offline viewer and controller are implemented in `docs/visualizer/`. Current checks for the scanner-loading amendment: Feature 003 browser harness 37/37; focused scanner/source/scene checks 20 passed; full Python suite 153 passed. Foreground scanner checks confirmed empty startup, supported placement/open, unsupported no-op and explicit refill/dispense/reset. These are software/rendered-world checks only. Shape-aware assessment of top-wedge contact, complete two-gate foreground acceptance, 60-second idle/orbit performance, 3MF interoperability and physical validation remain pending.

This replaces the old Python `animate --3d` run-replay/pyglet renderer contract. The viewer is opened directly from `docs/visualizer/index.html`; it is not a view of persisted simulation cycles, a hardware control system or a medication database. See [data-model.md](../data-model.md) for data/state entities and [geometry-source-contract.md](geometry-source-contract.md) for the shared input contract.

## Runtime and renderer

- Use Three.js r128 local UMD/classic script and browser WebGL. All scripts/styles/data/license files use relative local paths. No CDN, network, service, server, fetch/XHR, external font/image, JavaScript module import or npm install. `file://` is a supported normal entry path.
- Keep the browser rendering loop running continuously using `requestAnimationFrame`, including while idle. Idle renders do not change mechanism coordinates, inventory, timeouts except real elapsed cap expiry, or state. A motion event starts only from explicit user action or the schedule controller.
- Build one retained scene from canonical component recipes and update transforms/visibility/status only. Reuse geometries/materials; no per-frame rebuild or randomized orientation. Use the scan's perspective camera, lighting and conceptual axis mapping; accessible labels/UI are not rendered only as canvas pixels.
- Responsive layout must provide a useful full assembly and usable controls at desktop (reference 1440px wide) and phone (390px wide). Canvas fits its container on resize/orientation change; cap device-pixel ratio to a documented quality/performance bound. Touch/pointer actions do not select controls accidentally while orbiting.
- Camera: primary-button/pointer drag or touch drag orbits; wheel or pinch zooms within finite useful bounds. Camera interaction cannot change any mechanism, cap, count or schedule state. Honor reduced-motion preference for optional UI transitions without suppressing the required mechanical demo when explicitly requested.
- If WebGL/WebGLRenderer initialization fails, show a text explanation and browser capability guidance in the scene panel. Do not throw an unhandled error or disable unrelated UI silently.

## Control surface and status fields

Semantic buttons/inputs have accessible labels, visible focus, keyboard operation and status announcements. Expected controls:

| Control | Action/guard |
|---|---|
| Red / Blue / Green / Orange dispense | Request one deterministic visual cycle for that color; reject with reason if not idle, scanning, any cap open, target absent/empty or pin/carriage unsafe. |
| Remove/Insert each cartridge | Idle and cap closed only; toggle presence without changing its remaining count. |
| Scanner fixture buttons | Simulate package-in/beam/result/placement/package-out; only a supported unique code for an empty available same-color compartment places a fictional container and opens that cap. Unsupported/unmapped/unknown/ambiguous/invalid/loaded-target scans change no compartment. |
| Open/Close each cap | A supported unique scan places its container into an empty same-color compartment and opens only that simulated cap after package-out; user close returns it to closed/locked. Empty compartments cannot be manually opened. |
| Fill open compartment | Only the open matching container-placed compartment; creates up to five assumed demo pill actors. No reset of another compartment. |
| Demo schedule | Six requests: RED → BLUE → GREEN → ORANGE → BLUE → RED; selectable `once` or `repeat`. Repeat restarts schedule only while all requested inventory allows; stop visibly at first blocked request, never auto-refill. |
| Reset demo | Safe idle only; no scan, open cap or active request; restores parked state, all four inserted and empty with zero counts/no pill actors, tray count zero, all caps closed/locked. Otherwise reject. |
| Speed | Range 0.3× to 3× inclusive (UI step 0.1×); applies to scan/mechanical transition time, not cap timeout. Changing speed affects remaining/future phase duration monotonically without reordering/skipping states. |
| Caps on | Changes cap mesh visibility only. Does not unlock/close/relock. |
| Show scanner subsystem | Hides/shows scanner reader/head, optical point, guide, local decoder visual, demo package/barcode and scan beam in the main assembly. Does not cancel a scan or change cap/controller state. Checked by default. |
| Labels | Changes part-label visibility only. Permanent safety/NOT-VALIDATED disclosure remains visible. |
| Orbit/Zoom | Camera only, no mechanism mutation. |

Visible status MUST report: current named motion step; servo crank angle (degrees); pin `up|moving|engaged`; selected blade-tip signed local-Y position in mm; shared tongue edge position in mm; pills in tray; per-color presence, empty/container-placed occupancy, zero-to-five assumed pill count and cap state; scanner state/result; schedule mode/progress; speed; and last rejected-action reason. Clearly state that compartments initially contain zero pills and any five-pill inventory appears only after explicit Fill as assumed demo content. Clearly mark the 10×7×5 mm pill as an assumed visual fixture. Display persistent `CONCEPT ONLY — NOT VALIDATED / NOT PRINT-READY` and note the demo is not single-dose or hardware evidence.


## Deterministic demo FSM

Renderer time and mechanical/demo state are separate. Use monotonic elapsed time and explicit state durations/rates; no `Math.random`, stochastic pill yaw, live physics, time-dependent drift at rest, or simulation engine call. Given identical initial state, accepted/rejected inputs and elapsed-time sequence, produce identical ordered state snapshots, counts, actor positions and result text.

Scanner presentation (states are observable as part of the main simulation):

1. `PACKAGE_IN`: move the labeled fictional container into the scanner guide; show reader optics and all four empty target compartments.
2. `BEAM`: animate the beam over the synthetic barcode; this is not physical recognition.
3. `SCAN_RESULT`: use only fixed local fixtures. Supported unique RED/BLUE/GREEN/ORANGE fixture resolves to its exact matching target only if inserted, empty and idle. Unsupported/unmapped/unknown/ambiguous/invalid input or a loaded/unavailable same-color target records a refusal and changes no compartment.
4. `PACKAGE_PLACE`: for a supported unique available target, animate the container into only that same-color compartment. Commit its fictional container association only when this phase completes; no pill actors/count are created by placement.
5. `PACKAGE_OUT`: move the package away. After this phase completes, open only the successfully placed matching simulated cap. Failed and unavailable scans also end with package-out but no placement or lid change. The cap stays open until user close; visibility toggling never affects scan state.

Dispense sequence (states are observable in this order):

1. `PARKED`: crank 180°, pin up, carriage at outer park, upper blades closed, tongue at +5.7 mm closed, chamber occupancy zero and no staged pill actor.
2. `DRUM_ROTATE` only if target station differs; rotation guard requires pin up and carriage parked.
3. `CARRIAGE_APPROACH`: servo/crank moves the carriage to the selected closed blade-tab slot.
4. `PIN_ENGAGE`: the pin lowers 5 mm into the selected 5×4 mm concept slot.
5. `BLADE_PULL_RELEASE`: servo/rod pulls the selected outer tab along its local-Y outward slide axis by 10.4 mm while the blade return spring is extended. The user explicitly selected Blade Y; the supplied perpendicular-axis sentence and X-labeled tip coordinate conflict with that selection and remain disclosed as unresolved source ambiguity. Keep the stack supported while the blade retracts.
6. `STACK_SETTLE`: 0.5 s × speed; move the bottom pill and stack approximately 6 mm down. When pill 1 lands on the still-closed tongue, decrement cartridge count once, set chamber occupancy to one and preserve the pill's stable identity as staged.
7. `BLADE_ISOLATE_CLOSE`: the upper blade spring-closes into the seam above pill 1 and lifts pills 2+ approximately 1 mm. The lower tongue remains closed.
8. `BLADE_CLOSED_DWELL`: hold the fully closed separator for 0.3 s × speed before pin lift.
9. `PIN_LIFT`: raise the pin 5 mm and return the carriage to park.
10. `TONGUE_RELEASE`: after blade closure and pin/carriage clearance, the shared lower actuator moves the tongue edge toward −5.7 mm. The same staged pill falls vertically through the outlet to tray-floor height.
11. `PILL_CLEAR`: keep the tongue open for a visible-clear dwell of 0.5 s × speed; after the vertical drop reaches the tray floor, translate the pill laterally into its assigned tray slot and increment tray count once at completion.
12. `TONGUE_RETURN`: the tongue spring returns the edge to +5.7 mm; the visual spring extends/contracts along canonical Y between the tongue and an integral fixed station-housing reaction seat, without using a removable compartment as an anchor; then return to `PARKED`. Spring type, rate, preload, force and interfaces remain unknown.

Motion-time source/derived rates: drum 1.3 rad/s, servo 3.1 rad/s, pin 8 mm/s, tongue 14 mm/s, all presentation rates scaled by speed. Linear/angular duration is travel/rate; scan sequence is 0.8 s package-in, 0.9 s beam, 0.9 s result, 0.9 s placement, and 0.8 s package-out. These are deterministic demo timings, not measured actuator rates. Each required state appears in the UI and is never skipped by applying a single large RAF delta. A newly entered state is displayed for at least one render before accumulated overshoot proceeds. Parked positions and counts are invariant across arbitrary idle frame count/camera movement.

Only controller-owned schedule requests may advance their internal six-step queue. Every external operation while busy is rejected with a specific reason and leaves current transition/inventory coherent. A failed/blocked request does not rotate, move a pin, stage a pill, decrement count or increment tray. No arbitrary request queue and no overlapping scan/motion are allowed.

## Interlocks and scanner/cap rules

- Any open cap blocks all dispensing and drum rotation. The selected compartment must be inserted, loaded and have at least one assumed pill; compartments start empty.
- Drum rotation occurs only when pin is fully up and carriage fully parked. Carriage approach/rotation cannot overlap; failed alignment blocks rather than forcing engagement.
- Scanner can run only when controller is mechanically idle and no cap is open. Scan and mechanical actuation cannot overlap. Scanner visual visibility is an independent presentation toggle and cannot cancel/reassign an active scan.
- Successful code mapping is exact: 5012345678900 RED, 5012345678917 BLUE, 5012345678924 GREEN, 5012345678931 ORANGE. 5012345678948 represents an unsupported color; 5012345678999 is unmapped; 9999999999999 is unknown; 5012345678955 is the deterministic ambiguous case; `###` is invalid text. No-target fixtures change no compartment. All barcodes are illustrative; never infer pill identity.
- Startup/reset is empty: all supported compartments have zero count, no container association and no visible pill actors. Supported scan places only a fictional empty container; it does not silently add inventory. Explicit Fill while the matching cap is open creates up to five assumed demo pills.
- A supported scan to a loaded/unavailable target cannot overwrite its container or open the cap. Unsupported/unmapped/unknown/ambiguous/invalid results place nothing and preserve every compartment's association, occupancy, count, cap and presence.
- A unique supported-color scan resolves only its exact matching empty target. Placement commits the fictional container association with count zero; after package-out only that matching simulated cap opens. The open lid stays open until user close and blocks dispensing. Unsupported/failed/unavailable scans leave all compartment state unchanged. There is no timed authorization unlock in this scan-to-place flow. Explicit Fill while the matching lid is open adds at most five assumed demo pills; an empty locked compartment cannot be manually opened.
- Cartridge remove/insert needs mechanical idle and that cap closed; it preserves count. Removed and empty cartridges cannot dispense. Refill requires that compartment's open cap and adds only to assumed capacity 5.
- Reset cannot truncate an active transition or silently undo an open cap/scan. It returns a visible rejection until the safe idle guard is met.

## Motion interpolation and timing robustness

Each phase has a versioned duration derived from scan travel/rates or fixed dwell; the controller owns clamped progress in `[0,1]`. Speed changes preserve progress and change remaining phase duration; no transition reorder or duration becomes zero. An animation frame with a large elapsed delta processes no more than one state boundary, retains remaining time, and makes every new interlock state visible for a frame before continuing. Background tab suspension cannot cause skipped engagement/isolation/park states, duplicate a tray count or consume extra pills. RAF continues to render at rest; rendering never changes state.

Cap opening/closing has a deterministic 0.25 s easing transition recorded as an `ASSUMED_UI_TIMING`; it represents only a readable UI action and is not an inferred hinge or latch speed. Dispensing is blocked for the entire cap-opening/open/closing interval. Cartridge removal/insertion uses the source's 75 mm visual lift at 60 mm/s (1.25 s, scan-derived presentation rate, not extraction-force data); presence changes at the defined completed-transition endpoint and count remains unchanged. Cap/cartridge visual transitions count as busy operations and cannot overlap scan, dispensing, refill or reset. Store these durations/rates in the versioned shared data document so both controls and browser tests use the same values.

## Validation contract

The browser-native harness must assert phase order and timing, identical replay snapshots under repeated input/time streams, idle invariance, one-count consumption, exact barcode mapping, timeout at wall clock, unknown behavior, all blockers, inventory preservation, schedule once/repeat/depletion, reset safety, camera/display-toggle isolation and large-delta behavior. The real-browser quickstart also checks responsive layout, actual WebGL, pointer/touch operation, offline `file://` loading and no console errors. These checks establish UI/software behavior only, not mechanical truth, safe medication use, dose accuracy or fabrication readiness.
