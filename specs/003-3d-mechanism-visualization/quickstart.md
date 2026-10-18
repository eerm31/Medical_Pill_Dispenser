# Quickstart: Rotating-Cartridge Viewer and Concept 3MF

**Feature**: 003-3d-mechanism-visualization | **Updated**: 2026-10-11

**Implementation status (2026-10-10)**: The offline browser viewer, canonical geometry bundle, deterministic demo controller, and run-independent concept 3MF CLI are implemented. The instructions below record verified and pending checks; they do not assert physical validation. The viewer/export remain concept-only, NOT VALIDATED and NOT PRINT-READY; neither establishes a safe or accurate medication dose. See [implementation-evidence.md](implementation-evidence.md) for current results and limitations.

References: [CLI contract](contracts/cli-contract.md), [viewer/FSM contract](contracts/scene-interface.md), [geometry source contract](contracts/geometry-source-contract.md), [3MF export contract](contracts/3mf-export-contract.md), [data model](data-model.md).

## Prerequisites

- Python 3.11+ environment and project test dependencies; this environment uses `.venv/bin/pytest` and package installs must be non-editable due the macOS hidden `.pth` issue.
- Current browser with WebGL enabled for the interactive viewer. The app and pinned Three.js r128/license assets are local; no network, server, Node/npm, external CDN or Python visualization extra.
- A writable destination directory outside repository source/input and all run trees for the 3MF package and manifest.
- Optional: a 3MF-aware viewer/slicer for assembly-interoperability smoke test; its result is not manufacturing validation.

## 1. Open the static viewer offline

Open `docs/visualizer/index.html` in the default browser directly from the workspace, or use VS Code's local-file browser action. Do not start a web server. In browser developer tools, enable offline/network blocking and reload. Expected: no remote network requests, no missing script/CSS/data, a rendered four-position radial drum around the central post, four removable color-coded cartridges, individual upper blades/tabs/springs, pin carriage/servo/rod/solenoid, shared lower tongue and outlet tray. A persistent `CONCEPT ONLY — NOT VALIDATED / NOT PRINT-READY` notice is visible.

Check 1440px desktop and 390px phone-width portrait layouts (then rotate to landscape). The viewer area resizes without clipping the controls; status and controls remain usable with pointer/touch/keyboard and visible focus. Drag/pinch/wheel camera changes leave counts/phase unchanged. Fresh load must show exactly RED, BLUE, GREEN, and ORANGE compartments, all empty with count zero and closed/locked caps; no pill actors are visible. The checked-by-default **Show dispensing mechanism** control hides/restores the mechanical assembly and its dimension overlay while leaving the independently controlled scanner visuals available. Disable Caps, Labels, and Show barcode scanner subsystem; each visibility control changes only its own visuals. Confirm the overall scene scanner reader/housing, optical point, guide, fictional barcode package, decoder presentation, beam, and target cap are shown by default. If WebGL is unavailable, an actionable fallback replaces the canvas rather than an uncaught stack trace.

## 2. Exercise deterministic dispensing and interlocks

With the fresh state parked, verify the four compartments have zero assumed pills, all caps locked, crank 180°, pin up, carriage parked, tongue +5.7 mm/closed, chamber occupancy zero/no staged pill, and tray count zero. First scan and explicitly Fill an available compartment, then close its cap before requesting a dispense. Request RED, BLUE, GREEN, and ORANGE separately. For every successful request, observe: parked; optional safe drum rotate; carriage approach; 5 mm pin engage; selected upper blade pull/open along its local-Y slide while the tongue stays closed; the bottom pill drops about 6 mm and lands on the closed tongue, where inventory decrements once; upper blade closes with its top wedge and lifts pills 2+ about 1 mm; fully closed blade dwell about 0.3 s; pin lifts and carriage parks; lower tongue opens; the same pill falls vertically through the outlet to tray-floor height, then shifts laterally to its tray slot; visible-clear dwell; tongue returns closed and the mechanism parks. The tongue's concept return spring is now shown along the Y stroke, anchored to a fixed pad integrated with the station housing and pulling the tongue toward its positive-Y closed stop; it is not anchored to a removable compartment. Spring type, force, preload and interfaces remain assumed/unknown. The user explicitly selected Blade Y even though the supplied description also contains a perpendicular-axis sentence and X-labeled tip; that contradiction remains a caveat, not a silently substituted axis.

Repeat an identical color/time sequence and compare browser-harness state snapshots. Motion and pill positions are repeatable; no pill yaw/color jitter. Speed changes across 0.3×, 1× and 3× preserve ordering and do not make the real-time cap timer accelerate. Stop at each phase and attempt another dispense, scan, cap/fill, cartridge exchange and reset; each incompatible action is refused with an explicit reason and leaves inventory/active state coherent. Verify drum rotation is blocked while pin is down or carriage is away from park; any open cap, scan, absent/empty cartridge also blocks. Large frame stalls do not skip named states or duplicate a tray pill count.

## 3. Exercise barcode, caps, refill and removable cartridges

Run the exact supported barcode fixtures one by one: 5012345678900→RED, 5012345678917→BLUE, 5012345678924→GREEN, and 5012345678931→ORANGE. A zero-count compartment with no container follows package-in → beam/read → result → matching-only PACKAGE_PLACE → package-out, then opens only its matching cap. After that container has been filled and dispensed down to zero, rescan the same matching code: the viewer identifies/reuses the existing container, skips PACKAGE_PLACE, preserves its container code/count, completes package-out, and opens only that cap again for explicit Fill (up to five assumed demo pills). A positive-count target or absent/mismatched/unavailable target remains a no-mutation refusal. Pill actors appear only after the user explicitly activates Fill while the matching cap is open. Close/relock the cap before dispensing. Try the visible invalid-container example; it leaves every compartment unchanged, places nothing, and opens no cap. A locked cap refuses manual open; any open cap blocks dispensing and scan. Remove/insert a cartridge only while idle with its cap closed; contents are preserved. Safe reset restores all four inserted/empty/zero-count compartments, locked caps, no pill actors, parked mechanics and zero tray count. The scanner checkbox hides/reveals scanner-specific scene visuals only; it does not cancel scans or change cap state. All codes remain fictional illustrative fixtures, not medication/NDC verification; Feature 003 does not import or share Feature 004 fixtures/state.

After explicitly scanning and filling the required compartments, test the six-request schedule RED → BLUE → GREEN → ORANGE → BLUE → RED in once and repeat modes. Once completes one schedule. Repeat begins another only while the next scheduled items remain available; it stops visibly at depletion/first blocked item without automatic refill. Renderer continues idle regardless of schedule setting.

## 4. Run the browser-native contract harness

Open `tests/browser/index.html` directly in the browser. The harness loads the same local controller/data scripts and displays named deterministic assertions without Node/npm or an external test framework. Run the full suite: phase order/durations, speed scaling, large delta/state visibility, idle invariance, exact scanner fixtures, ordered placement/package-out/cap opening, explicit refill-only inventory, every refusal category and loaded-target non-mutation, insertion/refill/presence preservation, schedule/depletion/reset, camera/visibility isolation and repeated deterministic traces. Expected: all assertions pass and browser console has no unhandled errors. This harness checks the demo software model, not WebGL physical accuracy or engineering fit; do the separate real-scene checks above.

## 4a. Inspect concept dimensions

Enable **Show dimensions** in the main viewer, then select one group at a time from the Dimension group selector. Each numeric value appears as a compact label by its measurement segment, with one separate straight vertical guide-line segment directly above its measured feature. Labels for a group stack vertically over their own anchors rather than using diagonal leaders. Measurement and guide strokes use thin white/grey single-pixel linework, without angled arrowheads or cross-ticks. The adjacent list gives provenance, `NOT VALIDATED` status, and applicable caveats. Choose a color-specific cartridge or blade group to inspect one station without stacking all four stations' callouts. The control starts off and has no effect on parts, camera, part labels, scanner, controller, inventory, caps, or scans. Missing values (including tray height) are explicitly shown as unspecified; recipe-defined envelopes, approximate values, and unresolved axis assignments retain those labels. These are concept annotations, not manufacturing dimensions or tolerances.

## 5. Export the parked/rest concept assembly

Use an existing writable directory outside source/package assets and run trees. Example on macOS:

```sh
.venv/bin/dispenser-sim export-3mf --output /tmp/portable-dispenser-concept.3mf
```

Expected outputs: `.3mf` plus `.3mf.manifest.json`; the CLI identifies concept scope, component count, caveats, and `NOT VALIDATED / NOT PRINT-READY`, `print_ready=false`, `fabricable_as_designed=false`. The assembly has 32 separately named physical component meshes plus one components-root object, one build item, right-handed millimetre units and fixed parked/rest placement. Names and source-derived values match [the 3MF contract](contracts/3mf-export-contract.md). Demo pills, carton/card, beam, labels and camera are excluded and disclosed. Verify both file hashes including the manifest self-excluding hash; no check sets a readiness flag true. FDM/PLA/0.4 mm nozzle, if present, is provisional guidance only.

Open the package in an available 3MF-aware viewer and record application/version, whether all component names/relative placements appear and any metadata stripping. This is an interoperability smoke test, not printability evidence. Numerical geometry QA (e.g. 0.01 mm) is not a design tolerance. Do not print/use the model as a device part.

## 6. Verify export rejection and transactional handling

Try wrong suffix, missing/unwritable parent, existing output without `--force`, source/package asset destination, repository source subtree, run-tree descendant, symlinked parent/output/manifest, and detected hardlink/source alias with/without force. Inject failures at package staging, manifest staging, validation, backup and each final replacement. Expected: no successful status; handled failure cleans staged outputs and restores any previous pair; rollback failure is explicit and retains recovery backup. Sudden termination can still split sibling replacement, so a subsequent validation detects missing/mismatched hashes as `INCOMPLETE_PAIR`. Never direct output into `runs/`, `src/`, `configs/`, specs or the viewer asset tree.

## 7. Python regression and core preservation

After implementation, run the existing full standard test suite:

```sh
.venv/bin/pytest tests/ -q
```

Expected: canonical JSON/JS consistency, full part inventory/provenance, mesh/3MF/manifest/hash/rollback/path tests pass; no Node/npm requirement and no new Python runtime dependency. Existing 001/002 core simulation, saved runs, reports and 2D `animate` behavior remain unchanged. Feature-003-specific run-based `--3d`/pyglet tests are replaced, not allowed to alter feature-002 2D tests or single-dose checks. Constitution-I completion remains blocked by the already-recorded zero-/multi-dose violations unless separately resolved through the proper project workflow.

## 8. Capture real-browser performance evidence

On the documented reference macOS device/browser, measure 60 seconds of idle and ordinary camera motion after warm-up at recorded viewport/DPR; report median/p95 frame intervals and missed-frame proportion, browser/version, OS/GPU/driver, device-pixel ratio, WebGL renderer, and whether throttling/power-save is active. Confirm idle state and inventory remain unchanged throughout, camera actions do not drift, and retained geometry is not reconstructed per frame. The target is at least 30 FPS per SC-009. Only measurements from the actual browser scene can claim this target; Python tests or source inspection alone cannot. A failed target is an honest performance blocker, not a reason to change the expected threshold without a reviewed spec update.

## Validation boundary

This viewer is a deterministic visualization of one scan-derived concept, not a simulation result, hardware motion, barcode-verified medication, safe single-dose dispenser or CAD authority. The scan lacks complete part geometry, interfaces, spring/actuator parameters, materials, tolerances and prototype evidence. Exports remain not validated/not print-ready and cannot be claimed fabricable as designed.

## Executed checks (2026-10-10; local-Y/path correction)

- Browser-native harness: **30 passed, 0 failed** at `tests/browser/index.html`.
- Focused geometry/schema/mesh/scene suite: **17 passed**; full `.venv/bin/pytest tests/ -q`: **138 passed**.
- Refreshed export: `/Users/ice/Downloads/rotating-cartridge-concept-blade-y.3mf` plus its `.manifest.json` sibling; 32 named instances, mandatory warnings and false readiness declarations. Package SHA-256 `bd94f3d549cc0392de95395ddd7b84960a51695cfd78290638d9b97b350229be`; manifest self-excluding SHA-256 `bc2e6de14ca7a3cf5889b84b11e68426bf7dce6e0b0504dcee017d509d0c1228`.
- Foreground WebGL checks observed that each indexed cartridge pill lands at the shared outlet center, the tongue's Three-world Z increases during canonical −Y opening, and the sampled pill path descends vertically to tray-floor height before translating laterally. The final cycle returns parked with one count decrement and one tray increment for each of the four colors. This is renderer/controller evidence only, not physical clearance evidence.
- A 60-second FPS capture, exact 1440px/390px foreground acceptance run, 3MF viewer/slicer interoperability, and all mechanical/manufacturing validation remain pending. Earlier 14/14 and 128-test figures above were historical and are superseded by the current results.
- 3MF package structural/hash/path tests pass. Slicer interoperability is not tested. FPS, foreground camera interaction, desktop/mobile end-to-end controls, and manufacturing validation remain pending.
- **Main-scene scanner correction (2026-10-11)**: the integrated `Show barcode scanner subsystem` checkbox is checked by default and hides/restores reader/optics, guide/decoder, demo package/barcode, and beam without changing controller state. Main-scene fixture flow is package-in → beam/read → result → package-out → automatic opening of only the mapped simulated cap; unknown input opens none. Browser controller harness: **30 passed, 0 failed**; scanner boundary tests: **4 passed**; full repository suite: **147 passed**. Foreground checks at 1440×900 and 390×844 CSS viewports reported no horizontal overflow and no non-local resource requests. This does not constitute physical scanner, NDC, medication, lid-actuator, dose, or safety validation.
