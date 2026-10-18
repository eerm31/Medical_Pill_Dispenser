# Feature 003 browser evidence

**Date:** 2026-10-10  
**Entry:** `file:///Users/ice/Documents/smart-medical-dispenser/docs/visualizer/index.html`  
**Browser:** VS Code integrated browser, Electron 42.8.1 / Chrome 148.0.7778.280  
**Platform reported by browser:** macOS 10.15.7 user agent; WebGL renderer `ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)`  
**Viewport reported by browser bridge:** actual CSS viewports 1440×900 and 390×844 were both reached by applying a scale correction to the bridge's device-pixel viewport request. DPR reported 0.8 on those resized runs. The initial reference-size sample was 1025×870 CSS px, DPR 1.6. Both exact CSS layout widths had zero horizontal document overflow and a live WebGL canvas; desktop screenshot capture still returned a phone-sized snapshot from the bridge, so only DOM/layout metrics, not a desktop image, are retained.

## Observed results

- Workspace-local HTML opened directly from `file://`. Local Three.js reported revision 128. A WebGL2 context and canvas were available; the fallback remained hidden. The page had no observed console/page errors.
- Inspected the rendered scene and saw the four-station radial drum, central post, translucent cartridge shells and pill stacks, servo/connecting mechanism, shared tongue, tray, scanner housing, and concept warning.
- On the visible foreground page, requested Red dispense and observed `Blade pull / visual transfer` with the pin engaged and Red count reduced to 4/5; the sequence returned to Parked with pin UP and tray count 1. No page errors were reported.
- Scanned fixture `5012345678900`; the page completed scanner motion, reported `Recognized demo fixture: red`, and showed Red unlocked with a countdown near 19 seconds. Browser harness separately verifies all four fixture mappings, unknown code, timeout, refill, cartridge exchange, once/repeat schedule and reset.
- Dragged the 3D scene and visually confirmed the camera orbit changes the perspective. Toggling labels left the controller parked and inventory unchanged.
- Requested a Red dispense on the foreground browser and observed mid-cycle pin engagement and blade transfer; it returned to Parked/pin UP with one pill removed and `1 visual pills` in tray. No console/page errors were observed. Reset returned all demo inventory/tray state to its initial state. Barcode fixture `5012345678900` produced the red-unlock workflow and visible approximately-20-second countdown.
- Confirmed app source/assets have no runtime CDN/fetch/XHR references (the vendored third-party Three.js source is excluded from this app-source search). Browser-native controller harness: 14 passed, 0 failed.

## Frame cadence sample (preliminary; not SC-009 acceptance)

A browser `requestAnimationFrame` interval sample was collected on the idle visible 1025×870 CSS scene after 120 warm-up frames, then 361 consecutive animation-frame intervals. Median interval: **16.70 ms** (about **59.9 callbacks/s**); p95: **17.60 ms**. The app submits its render once per RAF callback. This is a short RAF cadence sample, not a 60-second GPU timer-query/render-time measurement; it does not establish steady-state performance during ordinary camera interaction or mobile compatibility. A proper 60-second idle + camera-movement measurement remains pending, and the target is not claimed met.

## Remaining validation

- Desktop screenshot evidence at exactly 1440×900; integrated browser DOM metrics verified that CSS viewport and overflow but its screenshot bridge returned a phone-sized capture.
- 60-second idle and ordinary orbit frame measurement with GPU time/missed-frame method, plus mobile device/driver testing.
- Foreground operation of every visible barcode/cap/refill/cartridge interaction and schedule repeat/depletion; controller harness covers state logic but not the full UI sequence.
- 3MF-capable application interoperability; not tested.
- All engineering/manufacturing validation remains blocked. The assembly and viewer are concept-only and must not be treated as print-ready or fabricable.

## Latest local-Y correction run

The following replaces earlier viewport/controller status for the current
`rotating-drum-concept-12-blade-y-path` browser bundle. The run used the
workspace-local `file://` page in a foreground VS Code integrated browser;
the browser bridge required viewport request scaling to reach the listed CSS
dimensions.

| Check | Observed result |
|---|---|
| Browser | Electron 42.8.1 / Chrome 148.0.7778.280; macOS user-agent 10.15.7 |
| WebGL renderer | `ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)`; canvas/context available; fallback hidden |
| Desktop | CSS viewport 1440×900, DPR 0.8 reported by bridge, canvas 639×489; document width 1440 px (no horizontal overflow) |
| Phone width | CSS viewport 390×844, DPR 0.8 reported by bridge, canvas 271×364; document width 390 px (no horizontal overflow) |
| Offline/errors | No non-`file:` resource entries; zero `pageerror`, console-error, startup-error or unhandled-rejection messages observed |
| Rest visibility | Debug bounds reported all five pill actors visible in each of Red, Blue, Purple and Yellow; initial chamber empty and no staged actor |
| Four-color cycle | Each color completed to `PARKED`; each selected count changed 5→4 once, chamber occupancy ended 0, tray count advanced once per color |
| Blade/pin | All four indexed blade strokes measured 10.4 mm. Pin lower bound at engagement was Three Y=5 mm; after pin lift it was Y=10 mm, above the blade's Y=5..6 mm layer |
| Tongue | During opening, Three Z increased by approximately 11.4 mm while Three Y stayed −0.75 mm, consistent with canonical −Y translation and an unchanged lower Z layer |
| Pill path | For each color, the selected actor reached the shared outlet center, descended from Three Y=2.5 to tray-floor center Y=−11.75 at constant X/Z, and only then translated laterally to its tray slot |
| Controller harness | 30 passed, 0 failed; separate from the real-scene checks above |

World-space AABB sampling during blade closure reports intersections with pill 2
as the top wedge enters the seam and the upper stack is lifted. Since AABBs do
not represent the wedge's sloped solid, this is not enough to determine whether
the animation shows intended contact or actual mesh penetration. A shape-aware
check remains pending; no claim of zero gate/pill intersection is made.

This was a short interaction/debug run, not the SC-009 performance measurement.
The 60-second idle-plus-orbit frame-time/FPS test and alternate mobile hardware
testing remain pending. The software/rendered-world checks do not test actual
gate–pill contact, physical clearance, dose integrity, manufacturability, or
3MF viewer/slicer interoperability. The cartridge transparency was reduced to
make rear compartments and pill actors easier to distinguish; no actor is
hidden by controller state.

## Main-scene scanner/loading amendment (2026-10-11)

The current Feature 003 main viewer now uses the RED/BLUE/GREEN/ORANGE demo palette and starts with empty zero-count compartments, caps closed/locked, and no visible pill actors. This supersedes older filled-startup/color evidence above. Direct-file browser check at 1440×900 CSS viewport confirmed all four empty supported targets visible; at 390×844 the document width matched the viewport with no horizontal overflow. Local resource listing had no non-`file:` entries; no page/console errors were observed.

- Supported scan in the foreground UI: controller stages `PACKAGE_IN → BEAM → SCAN_RESULT → PACKAGE_PLACE → PACKAGE_OUT → CAP_OPEN`; Blue target state remained empty through lookup/placement until the committed placement result, then only Blue became container-placed and open. Inventory stayed zero and no pill actors appeared. A later unsupported-color fixture reported no placement/no compartment change. Browser controller harness separately exercises all four mappings and every refusal class.
- Explicit Fill on an open placed compartment produced the five assumed visual actors; manual close/relock then allowed the existing two-gate dispense path. Red completed one visual dispense (5→4 assumed count, tray 0→1, chamber returned empty). Safe reset restored all four empty/zero/locked compartments and no staged pill.
- Scanner visibility hide/show was also checked via the main-scene control; scanner actors were hidden/restored while controller snapshot remained unchanged. Feature 004's separate browser harness is unchanged.
- Regression results for this amendment: Feature 003 browser harness **37 passed, 0 failed**; Feature 004 browser harness **14 passed, 0 failed**; focused source/scene/scanner pytest **20 passed**; full repository pytest **153 passed**.

This short interaction run is not the SC-009 60-second idle/orbit FPS measurement. That capture, shape-aware blade-wedge/pill contact review, complete all-controls browser acceptance, optional 3MF interoperability, and all physical/manufacturing validation remain pending. No scanner hardware, current NDC lookup, real medication contents, dose or safety claim is made.
