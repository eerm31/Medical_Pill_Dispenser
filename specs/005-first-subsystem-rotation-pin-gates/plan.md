# Implementation Plan: First Subsystem — Rotation (P1 design focus)

**Branch**: spec directory `005-first-subsystem-rotation-pin-gates` only (actual Git branch is still the unborn `001-dispensing-mechanism-simulation`; nothing created or switched) | **Date**: 2026-10-13 (design update 2026-10-15) | **Spec**: [spec.md](spec.md)

**Input**: [spec.md](spec.md). This plan covers the **ROTATION** sub-subsystem (User Story 1 / FR-005..FR-010 / SC-001..SC-003) as a concrete mechanical design. Pin pinpointing (US2) and gates/dispensing (US3) are planned later and are not designed here.

> **Posture**: every dimension, part, load and rate below is **ASSUMED / NOT_VALIDATED**. This plan makes no validation, readiness, single-dose, medication-safety, print-ready or fabricable-as-designed claim (`print_ready=false`, `fabricable_as_designed=false`). Constitution I stays ERROR / BLOCKED. The rotation design is drawn in the offline viewer as concept geometry (see "Design update 2026-10-15"); no hardware, canonical-geometry, controller or harness change exists yet.

> **Controller placement (deliberate, user-approved spec change, 2026-10-15)**: mode (a) is the standalone rotation-controller logic in a NEW file `docs/visualizer/rotation-controller.js`, tested headlessly. The viewer controller `docs/visualizer/demo-controller.js` is NOT modified and NOT verified by this feature; wiring the new logic into the viewer is DEFERRED. See spec FR-001/FR-002, D7, research R-8 and tasks T027.

## Summary

Make the axle actually rotate: a 28BYJ-48 5 V geared stepper under the base turns one rigid 5 mm D-flat rod (post + drive extension) through a bought 22 mm flexible 5-to-5 coupler (OD 14; the motor stack sits 13 mm lower than first planned to make room; see "Design update 2026-10-15" and "Coupler decision update 2026-10-15"). The rod is keyed to the drum hub. The drum's weight rides on a thin PTFE thrust ring on the platform, not on the stepper. One 625ZZ-class bearing seated flush in the platform locates the rod radially. A hall sensor and one magnet in the socket-0 deck give home. Indexing always makes its final approach in the same direction to defeat gear backlash. Hardware rates are held below the sim rate. Verification is the existing full-turn sweep test, a new deterministic 16-move index harness, and proposal-only rig criteria.

## Design update 2026-10-15

> **Source of truth**: `docs/visualizer/rotation-spec.js` (`g` block and `dims`), checked by `tests/test_feature005_rotation_spec.py`. Every value below was re-read from that file. All values stay **ASSUMED / NOT_VALIDATED** (`print_ready=false`, `fabricable_as_designed=false`). The new parts live in the viewer only: the canonical JSON, the 3MF export and the **52 component IDs are unchanged**. Older sections are kept for history; where one of their values is superseded the line is marked "Superseded 2026-10-15" and this section governs.

### What changed

| # | Area | Now (canonical z, mm) | Supersedes (2026-10-13 text) |
|---|---|---|---|
| 1 | Coupler | Bought flexible 5-to-5 mm, **22 mm** long, **OD 14**, two 4 mm threaded screw holes with grub screws of about 4 mm (M4 assumed, 2 mm hex key; **chosen by the user 2026-10-15**, confirm on the part); z −26..−4, top 1 mm below the platform underside (z = −3) | ≤ 10 mm, Ø ≈ 10, z −13.5..−3.8 in an 11.5 mm gap (D3, C2, R3, R-3); the first-pass assumption of a 25 mm, Ø19, z −29..−4 coupler |
| 2 | Rod | Bought 5 mm D-flat bearing-steel rod, **60 mm, used uncut**, z −14..46; **10 mm in the coupler**, motor shaft **5 mm in the coupler**, **7 mm gap** between rod end (−14) and motor-shaft end (−21); flat at 2.00 from the axis (4.50 across) | Rod z −7..46 (53 mm) with a 1 mm end gap (C3); "≈ 53–55 mm"; the 10 mm gap with a 25 mm coupler |
| 3 | Motor stack (lowered 13 mm) | Mount plate z −29.0..−27.4 (42 × 23, y 10..33); motor body Ø28 × 19 at z −48..−29 (centre y = 23, shaft on the axle y = 15); shaft z −29..−21 (**8 mm exposed**, to be measured on the real 28BYJ-48, double-D); columns **4 × 4 mm, 24.4 mm tall** (z −27.4..−3.0) at x ±17.5, y = 23 | Body −35..−16, shaft −16..−8, plate −16..−14.5, columns −14.5..−3; the first-pass 16 mm-lowered stack (body −51..−32, plate −32..−30.4, columns 27.4 mm tall) |
| 4 | Stepper mount connection | Two **M3 × 12** screws: head under the motor ear (z −31.8..−30.0), through the ear and plate holes (Ø3.4, model 3.55), **9.4 mm into a pilot hole** in each column (shank z −30.0..−18.0). Each column ends in a **3 × 3 × 2 mm spigot** that enters a **3.3 mm square socket, 2.2 mm deep** in a printed **9 × 9 mm collar region** (z −3.0..−0.8) of the housing platform underside, **epoxied**. Platform thickness **6.7 mm** (z −3.0..3.7, 44 × 74) | Ear holes Ø4, nut and screw of unspecified length (F3), columns "integral up to the floor" with no joint detail |
| 5 | Drum | Hub Ø16, z 4..46; **D bore** r 2.6 (Ø5.2 nominal, model 5.35), flat at 2.10 from the axis; four socket decks printed in one piece with the hub, **24 mm wide at the outer part**, **22.5 mm** straight side edge (y −19.5..3.0), 1.0 mm thick, **mitred on the 45° diagonals** to the neighbouring decks, inner end following the hub circle; printed **upright with the deck underside (z = 4.0) on the bed**. Deck-to-platform gap **0.30 mm** via the **0.3 mm PTFE ring (OD 20, ID 17)**; bearing **625ZZ (5 × 16 × 5)** in a **16 mm reamed seat** (model 15.85, ream to 16.00, 5.0 deep, boss r 10.5) | 5.0 mm line-to-line D bore (D4, C6); 16 mm decks; deck outer ≈ 26.5 (C5); seat Ø ≈ 16.1 |
| 6 | Cartridge retention | Catch ledge on each cartridge side (0.8 mm out from the wall, 1.2 mm tall, z 16.8..18.0) and two flexure clips per deck (arm 1.2 × 6 × 16 mm, z 5..21; hook 0.7 mm at z 18.0..19.6; 0.2 mm to the cartridge wall). Cartridges **lift out straight up, tool-free**; the arm bends ≈ 0.7 mm outward (hand calc: tip strain ≈ 0.6 %, ASSUMED). Printing-orientation risk: arms print upright, so layer lines run across the bend (R17). Options: horizontal cantilever arms, or separate clips printed flat and fitted | No retention in the 2026-10-13 plan |
| 7 | Home sensing | 3 × 1 mm magnet (z 4.6..5.6) in a Ø3.1 pocket (model 3.25) cut 1.4 mm from the top of a Ø4.4 × 1 mm boss on deck 0 at (9.7, −16.0), clear of the cartridge rails and 0.1 mm inside the deck side edge: **radius 32.48 from the axle**, 17.38° off the RED radial; pocket floor 0.6 mm (moved 2026-10-15; the earlier Ø6 boss at (7.0, −18.8) hung off the deck edge and crossed the rails). A3144-class hall (4.0 × 3.0 × 3.0 modelled, z 0.7..3.7) **flush in the platform top**; magnet-to-sensor gap **0.9 mm** (0.6 floor + 0.3 gap) | Placeholder outside the deck, clip holder with a 2–4 mm gap (F1), "magnet flush in the deck underside, gap 0.3–0.5" (D5), 1.2 mm pocket in a 1.0 mm deck (F2) |
| 8 | Viewer sub-views | **Rotation mechanism**, **Stepper mount**, **Compartments & decks** (radios `rotationOnlyToggle`, `mountOnlyToggle`, `compartmentOnlyToggle`, one `name="subsystemView"` group) with dimension lines, tolerances and printed/bought labels driven by `rotation-spec.js`. Tests: `tests/test_feature005_rotation_spec.py`, `tests/test_feature005_rotation_view.py`; 226 tests passing (re-run 2026-10-15 before any Feature 005 task) | Task 8 "not started" (FR-030 / SC-013) |
| 9 | Load check | See "Load check" below | ≈ 120 g, 1.18 N, 0.03 N·m rating (D1, D6) |

### Load check (ASSUMED hand calculation; figures from the viewer design and specs/006 plan D2)

| Quantity | Value | Basis |
|---|---|---|
| Rotating mass | **≈ 73 g empty; 93 g with 20 pills at 1 g; 125 g with four compartments × 13 pills at 1 g** | Budget **150 g** (25 g headroom at the worst case) |
| Thrust-ring friction torque | **0.7–2.3 N·mm** | μ 0.06–0.20 at 125 g, mean radius 9.25 mm |
| Acceleration torque | **< 0.5 N·mm** | Bound for 90° in 0.5 s, scaled by mass; the recommended hardware profile (≈ 2.16 s per quarter, D6) is gentler |
| Bearing friction | ≈ 0.1 N·mm | assumed |
| Total demand | **≤ ≈ 2.9 N·mm** at 125 g | sum of the three lines above |
| Motor torque | **≈ 34 N·mm rated** (UNVERIFIED); limit one third ≈ **11 N·mm** | margin to the limit ≈ 3.9× at 125 g |
| Thrust-ring pressure | **≈ 0.008–0.014 MPa** | ring area ≈ 87 mm² |
| Deck stress | **≈ 0.5 MPa** | cantilever estimate, assumed |

### Resolved conflicts (register kept accurate; see "Conflicts / open items")

| ID | Status | Resolution |
|---|---|---|
| C2 `drive-coupler-length-vs-gap` | **RESOLVED 2026-10-15** | User chose a bought flexible coupler instead of a ≤ 10 mm one; first a 25 mm, Ø19 part with the motor stack lowered 16 mm, then (decided 2026-10-15) a 22 mm, OD 14 part with the stack lowered 13 mm; clear height is now 24.4 mm. Question 2 closed. R3 retired except for the measure-first items. |
| C3 `motor-shaft-extension-overlap` | **RESOLVED 2026-10-15** | Rod bottom at z −14, motor-shaft end at −21: 7 mm gap, no overlap. |
| C6 `hub-bore-vs-keyed-rod` | **UPDATED** | D bore Ø5.2 (flat 2.10) epoxied on the rod flat 2.00; the canonical bore r 3.0 is not changed. |
| F1, F2, F3, F5 (print-guide flags) | **RESOLVED** | Hall flush at 0.9 mm gap; boss pocket instead of a deep deck pocket; screw heads under the ear, screws go up into the columns; rod bought at 60 mm and used uncut. |
| C5 `deck-outer-radius-discrepancy` | **WIDENED** | Viewer deck reaches 34.5 on the socket axis (≈ 36.5 at a corner) against 26.54 (mesh) and 28.25/29.4 (spec 003). The sweep against fixed parts for this reach is still open (ROT-C05). |

### New findings from reconciling the plan with `rotation-spec.js` and `reference-look.js`

Hand calculations from the two files; not run as a numerical check; the viewer is not changed by this edit.

- **N1 Magnet boss and pocket overhang the deck edge.** The deck outer edge is y = −19.5. The boss (r 3.0 at y −18.8) reaches y = −21.8 (2.3 mm past the edge), the pocket (r 1.55) reaches −20.35 (0.85 mm past) and the magnet −20.3 (0.8 mm past). Recorded as C7. **RESOLVED 2026-10-15**: the boss is now Ø4.4 at (9.7, −16.0), so it stays on the deck (outer end 1.4 mm clear, y −18.2..−13.8).
- **N2 The boss crosses the cartridge rails on deck 0.** Cartridge rails are 2 × 1 mm at x ±(5.4..7.4), y −18.0..6.2, z 5.0..6.0; the boss footprint (x 4..10, y −21.8..−15.8, z 5.0..6.0) overlaps them over y −18.0..−15.8. The `dims` note "the cartridge base starts at z = 6.00, away from the boss" does not cover the rails. Neither test saw this. Recorded as C7. **RESOLVED 2026-10-15**: boss x 7.5..11.9 is clear of the rails (x 5.4..7.4) and the clips (|y| ≤ 3); two new tests check this.
- **N3 Hook sits on the ledge with 0.0 mm clearance** (`hook_z0 = ledge_z1 = 18.0`; the test asserts `>=`). This is W-C1 from specs/006 and is relevant to tool-free lift and to any later lift-pad. Recorded as C8. **RESOLVED 2026-10-15**: `hook_z0` is now 18.8 and `hook_z1` 20.4 (0.8 mm clearance above the ledge, below the clip top at 21.0); a new test checks it.
- **N4 Collar flush with the platform edge.** A 9 × 9 mm collar centred at x ±17.5 spans x 13.0..22.0, which is the platform side edge (±22.0): zero wall outside the collar region; the 3.3 mm socket itself keeps 2.85 mm to the edge. **RECORDED as R18 (accepted flush; wire-exit proposal there).**
- **N5 The 8 mm shaft exposure** is measured from the motor top face (z −29); the real shaft stands on a boss (≈ 1.5 mm, UNVERIFIED) that passes through the Ø9.5 plate hole, so usable length above the plate is shorter than it looks. At least 5 mm must remain in the coupler. **RECORDED 2026-10-15** as a measure-before-ordering row in `build/bought-parts.md` (shaft exposure ≥ 5 mm after the boss); needs physical measurement. Final status N1, N2, N3: RESOLVED (`tests/test_feature005_rotation_spec.py`, `tests/test_feature005_clearance_drum_sweep.py`); N4, N5: RECORDED.

## Technical Context

**Language/Version**: Python 3.11+ stdlib only for core, geometry export and tests; JavaScript (ES5-style IIFE, no build step) for the browser viewer/controller.

**Primary Dependencies**: none new. Vendored Three.js r128 (MIT, already in `docs/visualizer/vendor/`) is unchanged. No npm, no CDN, no runtime Python viz dependency.

**Storage**: version-controlled JSON — `src/dispenser_sim/viz3d/concept_geometry.json` (canonical) → `tools/build_visualizer_data.py` → `docs/visualizer/concept-data.js`.

**Testing**: pytest (`.venv/bin/pytest`, `pythonpath=["src"]`) for geometry/sweep; headless runs of the standalone controller through the macOS system `jsc` (probe T003), with the browser-harness pattern of `tests/browser/` as the second runner (Node is not installed here).

**Target Platform**: offline static page opened via `file://` in a real foreground browser, desktop and phone-sized viewports.

**Project Type**: single repo; offline browser viewer + Python geometry/export library.

**Performance Goals**: none new. The added submeshes are tiny; Feature 003 FPS evidence remains pending and is not claimed.

**Constraints**: exactly 52 component IDs (new parts are integrated submeshes under existing IDs); offline and deterministic, no randomness; Features 001–004 and their tests untouched; Feature 003 scanner FSM untouched.

**Scale/Scope**: ~7 integrated submeshes, one shared controller guard plus a rotation-only command, one harness page. No new components, no new runtime dependencies.

## Facts verified against the repo (2026-10-13)

| Brief fact | Result | Source |
|---|---|---|
| Axle at (0,15); 52 IDs | ✅ | `concept_geometry.json` (52 unique IDs measured) |
| Hub radius 8, z 4..46; socket decks z 4..5 | ✅ | spec 003 FR-034 row C; mesh z 4.0..46.0 |
| Platform top z 3.7; solid z −3..3.7 at the axle | ✅ | `reference-look.js` L61–66 box layers; housing mesh z levels −3, −1.65, 0.15, 3.7 |
| Tube corner sweep ≈ 22.5 | ✅ measured 22.45 | `red-cartridge` vertices |
| Deck outer 28–29.4 | ⚠ spec 003 row C (16 × 26.5 decks) gives ≈ 29.4 at a corner, but the **canonical drum mesh measures max r = 26.54** (decks reach 23 mm along an axis). **Superseded 2026-10-15 for the viewer**: decks are 24 mm wide and reach 34.5 along the socket axis (≈ 36.5 at a corner); canonical JSON unchanged (C5 widened) | `rotating-drum` vertices; `rotation-spec.js` |
| Blade tab / tongue reach | blade tab r 11.1–34.0, tongue r 11.6–34.0 (different z planes) | measured |
| Stepper body z −35..−16, shaft z −16..−8, ext z −9..0, plate z −16..−14.5, columns x ±17.5 z −14.5..−3 | ✅ on 2026-10-13 in the canonical JSON. **Superseded 2026-10-15 in the viewer**: body −48..−29, shaft −29..−21, plate −29..−27.4, columns −27.4..−3 (canonical JSON not changed; the first-pass 16 mm-lowered stack, body −51..−32, is superseded by the coupler decision) | `assembly_schedule.drive_train.members`; `rotation-spec.js` |
| Tray 50 mm, y −42..8 | ✅ | `tray-length-reduced-for-drive-shaft` conflict |
| `drum_rad_s` = 1.3 | ✅ | `demo.rates` |
| Quarter turn at 1.3 rad/s | ✅ 1.208 s (12.41 rpm, 423.8 full steps/s) | arithmetic in D6 |
| Post-wording conflict | ✅ already recorded as `fixed-post-vs-rotating-shaft` (status CONFLICT); `central-post` is still a fixed 46 mm cylinder in group `fixed-housing` | conflicts[15] |
| Hub bore | canonical mesh bore **r = 3.0** vs post r 2.5 (0.5 mm radial gap); viewer (2026-10-15): D bore r 2.6, flat 2.10 | `rotating-drum` vertex radii {3.0, 8.0, 14.99, 26.54} |
| Hall sensor + magnet "already drawn" | ✅ **in the viewer only**: `reference-look.js` L121 hall box x 10–14, y −23.5…−20.5, z 3.7–5.2; L225 magnet Ø3 × 1 at deck-local (7, 4.5, 18.8). Neither exists in the canonical JSON, so the Python sweep test cannot see them. **Superseded 2026-10-15**: hall now flush in the platform top at (7, −18.8), magnet in a deck-0 boss pocket; still viewer-only | grep; `rotation-spec.js` |
| Viewer already draws a coupler | ✅ r 4 × 6 at z −11.5..−5.5 and the extension in the rotating `drumRoot`; the motor shaft (r 2.5, z −16..−8) is drawn in the **fixed** electronics group, and the post is a fixed mesh. **Superseded 2026-10-15**: coupler r 7.0 × 22 at z −26..−4, rod z −14..46, motor shaft z −29..−21 | `reference-look.js` L149–151, L197–198, L68–71; `rotation-spec.js` |

## Constitution Check

*GATE: before Phase 0 and re-checked after Phase 1.*

| Principle | Status | Note |
|---|---|---|
| I Single-dose integrity | **BLOCKED / ERROR (project level, unchanged)** | Recorded zero-/multi-dose violations in the core simulation remain. Rotation does not dispense; this plan neither fixes nor waives them. No feature-converged claim. |
| II Simulation-first, hardware-faithful | PASS (with disclosures) | Every number maps to a measurable quantity and is labelled ASSUMED. Friction, backlash and torque are hand calculations, not simulated physics. |
| III Testability | PASS | Existing sweep test (passes now) + deterministic 16-move/repeatability harness planned; no randomness (lost motion is a fixed parameter, not noise). |
| IV Simplicity | PASS | No new dependency, component or ID. Detent and second guide stay optional. |
| V Portability | PASS (to be revisited) | Adds ≈ 35 g motor and ≈ 1.2 W while coils are energised (both assumed); de-energise at rest. Re-state mass/power when rig data exists. |

**Gate result**: no new violation introduced, so planning may proceed. **Post-design re-check**: unchanged — no principle weakened, no verification removed, blocker I preserved, no validation/readiness claim made.

## Design (all ASSUMED / NOT_VALIDATED)

### Vertical stack (canonical z, mm; updated 2026-10-15, the 2026-10-13 stack with a ≤ 10 mm coupler is superseded)

```text
 46        rod top / hub top
  4.0      drum underside (hub + 4 decks, one plane) ──── intended contact ───┐
  3.7–4.0  PTFE thrust ring, ID 17 / OD 20 × 0.3, on platform top  ◄──────────┘
  3.7      platform top; 625ZZ top flush
 -1.3      bearing bottom (seat ledge z −3..−1.3, through hole ≈ Ø12)
 -3.0      platform underside
 -4.0      coupler top (1 mm below the platform underside)
 -14       rod bottom (60 mm rod, z -14..46): 10 mm inside the coupler
 -21       motor shaft top: 5 mm inside the coupler, 7 mm below the rod end (C3 resolved)
 -26       coupler bottom (bought, L 22, OD 14, decided 2026-10-15; C2 resolved)
 -27.4     mount-plate top (columns run -27.4 .. -3.0, 24.4 tall)
 -29       mount-plate bottom = motor top face; motor shaft stands 8 mm proud (-29..-21)
 -48       motor body bottom (Ø28 × 19)
```

### D1 — Load path: thrust ring, not the stepper
- Rotating mass **73 g empty, 93 g with 20 pills, 125 g with four compartments of 13 pills at 1 g each** (assumed; budget 150 g; supersedes the 2026-10-13 figure of ≈ 120 g) → W = 0.125 × 9.81 ≈ **1.23 N** at the worst case.
- The hub (r 8) and the 625ZZ (Ø16) have the same footprint, so a washer under the hub alone would sit on the bearing. Instead the **drum underside plane (z = 4.0)** carries the load: hub plus the four decks (16 mm wide in the 2026-10-13 text, now 24 mm and mitred to each other) form a full disc out to r ≈ 8√2 ≈ 11.3 mm (to be checked numerically, ROT-C05). A **PTFE ring ID 17 / OD 20 × 0.3 mm** (mean r 9.25 mm, ≈ 87 mm²) sits on the platform top (z 3.7–4.0) and the drum rests on it. Contact pressure ≈ 0.008–0.014 MPa (73–125 g; 0.014 MPa was the 2026-10-13 figure at 120 g).
- The 3.7 → 4.0 gap is the only vertical room, so ring thickness is fixed at ≈ 0.3 mm by the concept datums (PTFE film/washer, availability UNVERIFIED). A physical 0.1–0.2 mm running clearance is a tolerance item and not modelled.
- The stepper shaft carries **no axial load**: the coupler is flexible and gravity holds the drum down. Optional retainer: shaft collar/E-clip under the bearing inner race. Without it the drum tips off the ring at ≈ atan(9.25 / 21) ≈ **24°** of tilt (hand calc, assumed COM 21 mm above the ring) — acceptable on a flat bench, not for handling.
- COM-offset check: one loaded tower alone (15 g at 15 mm) gives 2.2 × 10⁻³ N·m, i.e. a 1.9 mm COM offset, inside the ring's inner radius (8.5 mm), so the ring stays loaded.

### D2 — Radial location: one 625ZZ, optional second guide
- **625ZZ-class deep-groove bearing, 5 × 16 × 5 mm** (class assumed; verify against the listing), outer race pressed into a platform seat with **top flush at z 3.7** (z −1.3..3.7). Seat ledge z −3..−1.3 with a ≈ Ø12 through hole (≈ 2 mm lip), rod passes through. The rod is round (Ø5) through the inner race; the D-flat lies above it in the hub.
- **Seat wall (R2)**: seat Ø ≈ 16.1 puts the front edge at y = 15 − 8.05 ≈ 6.95, the tongue-pocket wall is at y = 6.2 for z −1.65..0.15 → **≈ 0.7 mm wall over 1.45 mm height**. Pre-decided fallback: **685ZZ-class (5 × 11 × 5)** → wall ≈ 3.2 mm, same flush z range, ring ID ≈ 12–13. The plan keeps 625ZZ as the briefed baseline (Question 1).
- Second guide (optional): printed bushing/685ZZ at the hub top (z ≈ 41–46) to resist tilt; not needed on a bench rig.

### D3 — Flexible coupler: motor and rod decoupled
- **Resolved 2026-10-15 (C2); coupler decided 2026-10-15**: the user chose a **bought flexible 5-to-5 mm coupler, OD 14, 22 mm long, with 4 mm threaded screw holes (grub screws of about 4 mm; M4 and a 2 mm hex key are assumed: confirm on the part)** and lowered the motor stack by 13 mm instead of shortening the coupler to ≤ 10 mm. The clear height between the mount-plate top (−27.4) and the platform underside (−3.0) is now 24.4 mm; the coupler sits at z −26..−4, its top 1 mm below the underside so it never rubs. *Superseded 2026-10-13 text:* a ≤ 10 mm coupler (beam/bellows or printed TPU sleeve, Ø ≈ 10, z ≈ −13.5..−3.8) in an 11.5 mm gap. *Superseded first pass:* a 25 mm, assumed Ø19 coupler (z −29..−4, stack lowered 16 mm), which overlapped the tray (C9).
- The real 28BYJ-48 shaft is a **double-D** (two flats ≈ 3 mm across — UNVERIFIED): the 4 mm grub screws of the coupler bear on the flats or a double-D socket.
- **Engagement (2026-10-15)**: rod 10 mm in the coupler (rod z −14..−4), motor shaft 5 mm in the coupler (shaft top −21, coupler bottom −26). Question 2 is closed by the user's choice (plate and columns lowered by 13 mm; the 2026-10-13 text proposed 8–10 mm). The 5 mm shaft engagement depends on the real shaft's exposed length (8 mm assumed; measure it, B1).
- **Resolved 2026-10-15 (C3)**: the rod is the bought 60 mm rod used uncut, z −14..46; its bottom end is 7 mm above the motor-shaft tip (−21), so the shafts never touch and the drum weight cannot reach the motor shaft. *Superseded:* rod bottom z = −7 (53 mm) with a 1 mm end gap; the 10 mm gap with the 25 mm coupler.
- The real 28BYJ-48 shaft is eccentric (8 mm off the body centre). The viewer now models it: shaft on the axle (y = 15), body centre at y = 23 (direction +y ASSUMED), body Ø28 spanning y 9..37, ears and columns at x ±17.5, y = 23 (R5; measure the motor).

### D4 — Key: D-flat rod, D bore bonded with epoxy (the line-to-line fit is superseded 2026-10-15)
- Post and drive extension become **one 5 mm rod with a D-flat** (flat at 2.00 from the axis = 4.50 mm across; the length of the flat along the bought rod is to be measured, B1). The ID `central-post` stays; `drive-shaft-extension` stays a drum-owned submesh. Spec 003's "fixed post" is superseded by this proposal — **recorded as C1** (existing `fixed-post-vs-rotating-shaft` becomes "proposed resolution, ASSUMED"; spec 003 text is not edited).
- **Hub bore (C6, updated 2026-10-15)**: the viewer D bore is **r 2.6 (Ø5.2 nominal, model Ø5.35 with the 0.15 mm hole compensation), flat at 2.10 from the axis** against the rod flat at 2.00, i.e. **0.10 mm per side, closed by epoxy**. *Superseded 2026-10-13 text:* 5.0 mm D bore, line-to-line, reamed and bonded. The canonical drum bore stays r 3.0 (viewer-only change).
- **Why not a loose D bore**: 0.15–0.2 mm printed clearance on a ≈ 3 mm flat chord gives ≈ 3° of rotational play (0.15/3 rad, hand calc) — larger than the motor lash and fatal to ±0.5°. A zero-play fit is required.
- **Bond dependence (2026-10-15)**: with 0.10 mm clearance on a flat whose half-chord is ≈ 1.5 mm (√(2.5² − 2.0²)), an unbonded D bore would play ≈ 3.8° (0.10 / 1.5 rad, hand calc). The zero-play requirement above therefore rests entirely on the epoxy filling the flat gap and curing (risk R13).
- Set screw is only a fallback: the gap between adjacent tubes at the hub diagonal is ≈ 2 mm (hand calc from the 7.4/6.2 tube half-sizes), too tight for a 2.5 mm hex key, so any screw must enter axially.

### D5 — Homing and index repeatability: hall home + step counting + unidirectional final approach
- **Home (placement superseded 2026-10-15; see "Design update", item 7)**: one digital hall switch (A3144-class, unipolar; UNVERIFIED) + one Ø3 × 1 magnet, embedded flush in the **socket-0 deck underside** and flush in the platform top at the same radius (gap ≈ 0.3–0.5 mm). The viewer placeholder (magnet ≈ r 34.5 from the axle, hall ≈ r 37–41 beside it, ≈ 6° off the park position — hand-derived, **verify numerically**) lies outside the canonical deck and overhangs the deck edge by ≈ 0.5–0.8 mm; the first task re-derives a placement inside the deck strip beyond the tube bore (r ≈ 19.6–22.6, centre ≈ 21). **Resolved in the viewer spec 2026-10-15** (see "Design update", item 7): radius 32.48 at (9.7, −16.0), hall flush in the platform top, 0.9 mm gap.
- Home is the **rising edge approached CCW (+drumAngle)**. `home_to_station_steps` is a calibration constant (unknown today).
- **Step arithmetic**: nominal 2048 full steps/rev → 0.176°/step; quarter = 512 steps; ±0.5° = ±2.8 full steps (resolution is not the limiter). **The real ratio is reported ≈ 63.68:1 (≈ 2037.9 steps/rev, UNVERIFIED)**: 512 steps would be 90.447° → +0.447° per quarter, +1.8° over a full turn open-loop. Mitigation: calibrate `steps_per_rev` between two home edges, target `round(k × steps_per_rev / 4)`, re-home each revolution or after every 180° move.
- **Backlash**: gear lash ≈ 1° at the output (UNVERIFIED; reports vary) leaves ±0.5° at risk. Decision: **final approach always CCW (+drumAngle)**. A CW-needed move is commanded as (Δ − o) then (+o), overshoot `o = 3°` (≥ 2× assumed lash); 180° moves always go CCW (this also removes the floating-point tie in the controller's `atan2` shortest-path rule). Cost ≈ 2o/ω ≈ 0.13 s at 0.8 rad/s.
- **Optional spring-ball detent** at the 4 stops (assumed, not modelled): its peak torque would have to beat the friction deadband (≈ 2.2 × 10⁻³ N·m) yet stay ≪ 0.03 N·m × derating, and it can hide a lost step by snapping to the wrong stop. Decision: do not model; evaluate only if rig repeatability fails.

### D6 — Speed/torque budget

| Item | Arithmetic | Result |
|---|---|---|
| Sim rate | 1.3 rad/s × 60 / 2π | **12.41 rpm** |
| Quarter turn at sim rate | (π/2) / 1.3 | **1.208 s**; 180° = 2.417 s |
| Step rate at sim rate | 512 / 1.208 = 1.3/2π × 2048 | **≈ 423.8 steps/s** ≈ 83 % of the ~512 steps/s (≈ 15 rpm) typical limit (UNVERIFIED) → too close |
| Hardware rate (recommended) | 0.8 rad/s → 7.64 rpm; 0.8/2π × 2048 | **≈ 260.8 steps/s**; quarter ≈ 1.96 s cruise-only |
| Trapezoid, 0.2 s ramps | ramp distance 0.8 × 0.2 = 0.16 rad; cruise (π/2 − 0.16)/0.8 = 1.76 s | **≈ 2.16 s per quarter**, ≈ 4.13 s per 180°; α = 0.8/0.2 = 4 rad/s² |
| Triangular profile (brief) | α = 4θ/T², θ = π/2, T = 1.208 s → **4.3 rad/s²**. The brief's "1.46 s" gives 2.95 rad/s²; 1.208 s matches 4.3. | peak speed 2θ/T = **2.6 rad/s (25 rpm), above the motor limit** → use the trapezoid, not a triangle |
| Inertia | 4 × 15 g × (15 mm)² = 1.35 × 10⁻⁵, + towers' own ≈ 0.19 × 10⁻⁵, + hub/decks/rod | **I ≈ 2 × 10⁻⁵ kg·m²** (assumed) |
| Inertial torque | I α = 2 × 10⁻⁵ × (4 … 4.3) | **≈ 8 × 10⁻⁵ – 9 × 10⁻⁵ N·m** (negligible) |
| Thrust-ring friction | μ W r = 0.2 × 1.18 N × 9.25 mm (brief's 8 mm → 1.9 × 10⁻³) | **≈ 2.2 × 10⁻³ N·m** |
| Bearing friction | assumed ≈ 1 × 10⁻⁴ N·m | negligible |
| Total demand | 2.2 + 0.09 + 0.1 (× 10⁻³) | **≈ 2.4 × 10⁻³ N·m** |
| Margin vs 0.03 N·m | 0.03 / 2.4 × 10⁻³ | **≈ 12×**; with an assumed 3× running-torque derating at speed ≈ **4×** |

> Superseded inputs (2026-10-15): the table above uses ≈ 120 g and a 0.03 N·m rating; the current load check ("Design update") uses 73–125 g and ≈ 34 N·mm rated with a one-third limit (≈ 11 N·mm), giving ≈ 2.9 N·mm total at 125 g. The speed conclusions are unchanged.

Recommendation: **0.8 rad/s with 0.2 s ramps on real hardware; keep 1.3 rad/s in the simulation** (the viewer speed slider reaches 3×). Release the coils at rest to save ≈ 1.2 W (assumed) if the gearbox self-holds (UNVERIFIED).

### D7 — Interlocks: present vs missing in `docs/visualizer/demo-controller.js`

| Rule (FR-008/009/010) | Present? | Where / gap |
|---|---|---|
| Pin up and carriage parked before rotation | ✅ | `requestDispense`, "Rotation interlock…" |
| Both gates closed | ⚠ partial | checks only the **selected** cartridge's blade + the tongue; the other three blades are not checked |
| No cap open | ✅ | `requestDispense` "Close every open cap before dispensing." |
| No sequence active / busy | ✅ | `idle()` (phase PARKED and operation null); also blocks during scan, cap and cartridge operations |
| No cartridge mid-lift | ⚠ implicit | `operation === 'cartridge'` makes `idle()` false; no explicit "all lifts settled" check |
| Refusal reason reported | ✅ text only | `state.rejection`; no machine-readable code/criterion ID |
| Other commands refused during rotation | ✅ | `idle()` guards cap/scan/fill/exchange/reset; blade/tongue commands are controller-owned |
| Standalone "go to station" command | ❌ | rotation only happens as step 1 of a dispense, and only for a loaded cartridge |
| Same-station request reported "already at station" | ⚠ | no rotation (|Δ| < 0.001) but the dispense continues; nothing reported |
| Station confirmed / "not at a station" readout | ❌ | only continuous `drumAngle` and `selected` |
| Missed-index fault, bounded re-index, hard fault | ❌ | no fault injection of any kind |
| Home / hall state | ❌ | angle is always known; no homing concept |
| Power-loss injection | ❌ | FR-023/024; outside this plan |
| Direction policy | ⚠ | shortest path via `atan2`; 180° ties depend on floating point; `drumAngle` is not wrapped |

**Closure of these gaps (spec change 2026-10-15)**: the gaps are closed only in a new standalone module, `docs/visualizer/rotation-controller.js`, tested headlessly; `docs/visualizer/demo-controller.js` is NOT modified and NOT verified by this feature, and the table above stays as the description of the present viewer controller. Wiring the new logic into the viewer is DEFERRED (hook points are documented in `contracts/rotation-controller.md`, T028). The standalone default direction policy is the unidirectional CCW final approach (D5, R-6); `shortest` remains as a comparison case.

### D8 — Verification plan

**Mode (a), existing evidence**: `tests/unit/test_viz3d_rotation_sweep.py` sweeps a full 360° in 5° steps for every rotating part (group `rotating-drum` or `station-*`) against every fixed part; only coaxial pairs (drum ↔ post, electronics-deck, housing) are allowed. It passes now (`.venv/bin/pytest tests/unit/test_viz3d_rotation_sweep.py -q`). It sees **canonical-JSON meshes only** — not the viewer-only hall/magnet/coupler — and will need the post (once rotating) added as a coaxial pair. Since 2026-10-15 `tests/test_feature005_rotation_spec.py` also checks the numbers in `rotation-spec.js` (stack consistency, home sensing, spigot/socket, M3, clips); it checks values, not collisions (see findings N1/N2).

**Mode (a), planned** (run on the standalone rotation-controller logic, headless; not on the viewer controller; criterion IDs for the FR-003 log; format in [contracts/rotation-check-log.md](contracts/rotation-check-log.md)):
- `ROT-C01` all 16 start→target moves end at the commanded station; same-to-same does not move (SC-001, FR-010).
- `ROT-C02` repeatability: 10 repeats per station under a deterministic **lost-motion model** (fixed `lash_deg`, last-direction rule); shows the unidirectional policy yields 0° spread while naive shortest-path yields a spread equal to `lash_deg`. Logic only, not physical (SC-002).
- `ROT-C03` unsafe-state refusals (pin down, carriage off park, any gate open, cap open, busy): zero motion, reason reported (SC-003).
- `ROT-C04` missed-index injection (short, over, wrong stop) → fault, station unconfirmed, pin/gate blocked until re-index (FR-009).
- `ROT-C05` geometry checks in pytest: rod coaxial (XY = (0,15), axis ‖ Z), bearing z −1.3..3.7, drum underside covers the thrust annulus, seat wall ≥ proposed threshold, hall/magnet inside the swept deck strip, 52 unique IDs.
- `ROT-C06` home and calibration: unhomed refuses index and reports station unconfirmed; CCW rising-edge home confirms; `steps_per_rev` calibration (2048 and 2037.9) gives `round(k × steps_per_rev / 4)` targets and removes the +0.447° per quarter drift; `home_not_found` after the bounded search (FR-031).
- `ROT-C07` direction policy, timing and no skipped state: 180° ties always CCW, wrap to [0, 360), trapezoid durations (≈ 2.16 s per quarter, ≈ 4.13 s per 180° hardware; 1.208 s sim), one huge `tick(dt)` completes exactly one move in order (FR-022).
- `ROT-C08` readouts and permission gating: `at_station`, `drum_state`, `sequence_active`, `lift_in_progress`, `pin_gate_allowed`; auxiliary commands refused with `rotation_active` / `station_not_confirmed` (spec US1 scenario 5, refusal side only).
- Every log carries the NOT VALIDATED / NOT PRINT-READY disclosure, `print_ready=false`, `fabricable_as_designed=false`; two runs diff identical (SC-010).

**Mode (b), proposals only — NOT VALIDATED, never reported as met**: `ROT-R01` home-edge repeatability over 20 CCW approaches ≤ 0.3°; `ROT-R02` ±0.5° at each station, 10 repeats, both approach directions measured; `ROT-R03` stall load ≥ 5× the friction estimate; `ROT-R04` 100 consecutive moves without a missed index (steps vs home); `ROT-R05` coil temperature at hold/idle; `ROT-R06` tilt/handling with and without the axial retainer.

## Parts and bought items (examples only — sizes and availability UNVERIFIED)

| Item | Example size / class | Notes |
|---|---|---|
| Stepper | 28BYJ-48, 5 V, Ø28 × 19, shaft Ø5 double-D × 8, ears 35 apart, ≈ 64:1, ≈ 2048 steps/rev | ULN2003-class driver already drawn on the electronics deck |
| Flexible coupler | bought 5→5 mm, **L 22, OD 14**, two 4 mm screw holes (about 4 mm grub screws; M4 and a 2 mm hex key assumed) | user choice 2026-10-15 (C2 resolved); measure OD, screw size and bore depths (B1) |
| Bearing | 625ZZ 5 × 16 × 5, double shielded (fallback 685ZZ 5 × 11 × 5) | seat flush z −1.3..3.7 |
| Shaft rod | bought Ø5 D-flat bearing-steel rod, 60 mm, used uncut (z −14..46), flat at 2.00 from the axis | one piece post + extension; measure flat depth and length (B1) |
| Thrust washer | PTFE sheet 0.30 mm, die-cut OD 20 / ID 17 | or printed ring with oil |
| Magnet | 3 × 1 mm neodymium disc (N35-class assumed) | in a boss pocket on the deck-0 top, 0.6 mm floor |
| Hall sensor | A3144-class unipolar digital | flush in platform top, 0.9 mm below the magnet; pole orientation to check |
| Fasteners, adhesive | 2 × M3 × 12 screws (motor ears into the column pilot holes); epoxy (spigots, D bore); CA glue (magnet) | see section B |
| Optional | shaft collar/E-clip; 4 spring-ball detents; second guide bushing | not modelled |

## Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Gear backlash ≈ 1° (UNVERIFIED) vs ±0.5° | unidirectional approach, 3° overshoot; measure on rig; detent only if needed |
| R2 | 625ZZ seat wall ≈ 0.7 mm to the tongue pocket | fallback 685ZZ (≈ 3.2 mm) or reinforce (Question 1) |
| R3 | ~~Coupler does not fit the 11.5 mm gap~~ **Resolved 2026-10-15**: 22 mm coupler in a 24.4 mm clear height. Residual: real shaft exposure (≥ 5 mm needed) and coupler bore depths (rod side ≥ 10 mm) | measure before ordering (B1) |
| R4 | Step drift if the true ratio ≈ 63.68:1 | calibrate steps/rev from two home edges; re-home regularly |
| R5 | Real 28BYJ-48 shaft off-centre; double-D shaft | check body vs ears/columns/tray; coupler must fit double-D |
| R6 | Printed bearing/hub fit tolerance 0.1–0.2 mm; ≈ 3° D-bore play if loose | line-to-line D bore + bond; fit coupon on the rig |
| R7 | Unretained drum lifts at ≈ 24° tilt | optional collar/E-clip; second guide |
| R8 | Thrust ring only 0.3 mm (±0.03); running clearance unmodelled; a warped or elephant-footed deck underside (24 mm decks) can close the gap and make the drum drag | tolerance item for the rig; lightly face the deck underside on a flat plate; check the gap with a feeler gauge |
| R9 | Running torque falls with step rate | 0.8 rad/s with ramps; ≈ 4× margin with 3× derating (assumed) |
| R10 | Hall, magnet and boss are viewer-only (not in the canonical JSON), so the canonical sweep test cannot see them; see R15/R16. **RESOLVED 2026-10-15** for placement; proven by `tests/test_feature005_clearance_drum_sweep.py` and `tests/test_feature005_home_sensing_window.py` (the viewer-only parts are swept by the Feature 005 clearance tests T009–T011) | sweep check for the 34.5/36.5 reach (ROT-C05) |
| R11 | Drum weight | thrust ring carries it; stepper sees none |
| R12 | Wire routing to a rotating part | **none needed**: motor, hall and wires are fixed; only passive parts rotate |
| R13 | **RECORDED.** D bore Ø5.2 on a rod flat at 2.00 leaves 0.10 mm per side (≈ 3.8° play if unbonded); zero play depends on the epoxy (steel to printed PETG/PLA+ is a weak adhesion pair) | roughen the rod flat and bore; **gate: coupon C-7 bond test and the hand-torque check (no slip, no visible play) before the real drum is epoxied** |
| R14 | **RECORDED** (KNOWN-OPEN wall, allowlisted). Mount columns are 4 × 4 × 24.4 mm with an M3 pilot hole (≈ 0.7 mm wall left if the pilot is ≈ 2.6 mm, hand calc, below two 0.4 mm perimeters = 0.8 mm); screws load the layers in tension; spigot joint is 3 × 3 × 2 mm of epoxy | **default: keep 4 × 4**; coupon C-4/C-5 decide; widen to 5 × 5 only if they fail (the gap between the column inner faces falls from 31.0 to 30.0 mm and the 7.0 mm coupler radius still clears by ≈ 6.0 mm in x, hand value); add a brace only if a 5 × 5 column still splits |
| R15 | Magnet pocket and boss overhang the deck outer edge (N1). **RESOLVED 2026-10-15** in the viewer spec (Ø4.4 boss at (9.7, −16.0)); proven by `tests/test_feature005_rotation_spec.py::test_magnet_boss_stays_on_the_deck_clear_of_rails_and_clips` | keep the Ø3.1 magnet pocket supported by ≥ 0.6 mm floor all round |
| R16 | Boss crosses the cartridge rails on deck 0 (N2). **RESOLVED 2026-10-15** in the viewer spec (boss x 7.5..11.9, rails x 5.4..7.4); proven by `tests/test_feature005_clearance_drum_sweep.py::test_boss_clips_hooks_and_rails_keep_their_clearances` (boss 1.30 mm clear) | confirmed numerically by T009 |
| R17 | **RECORDED.** Clip arms (1.2 × 6 × 16) printed upright have layer lines across the bend; hook is now 0.8 mm above the ledge (N3 / W-C1 / C8, resolved) | coupon C-6; **decision rule: print the clips upright for the first drum only if C-6 passes, otherwise use separate flat-printed clips** (horizontal cantilever arms are the other fallback) |
| R18 | **RECORDED.** Collar region is flush with the platform side edge (N4); wire exit for the flush hall sensor is not designed in the viewer | accept the flush collar (the socket keeps 2.85 mm to the edge); **proposal, not drawn and not modelled**: a Ø1.4 vertical wire hole from the hall pocket floor (z 0.7) to the underside at about (9.7, −19.0), then a 1.6 × 1.6 mm channel in the platform underside (z −3.0..−1.4) running to the front edge (y −38.0). Limits (hand values): the hole leaves ≈ 0.8 mm to the pocket wall (C10 is already 0.71 mm; do not move the hall toward it), stays ≥ 1.75 mm from the tongue pocket (x ±7.25) and keeps the channel at y ≤ −18.0, ≥ 5.3 mm clear of the Feature 006 outboard slot edge (y −12.7) and outside the weigh band z −12.5..−3.0; re-check numerically before any viewer change. **Sensor leads (user report 2026-10-16): about 12 mm long (not yet measured by the plan).** Three leads at the usual 1.27 mm pitch span about 2.54 mm, so the Ø1.4 hole cannot pass the bare leads. Proposed, not modelled: bend the leads down once just below the body (flat face up), trim them to about 4 mm, solder three 26-28 AWG wires, insulate each joint, and route only the wires through the Ø1.4 hole (three 28 AWG wires with insulation fit). Do not widen the hole toward the pocket wall (C10) |

## Conflicts / open items (record in the geometry conflict register next step; not applied now)

- **C1** `fixed-post-vs-rotating-shaft`: post becomes a rotating keyed rod (proposed resolution, ASSUMED).
- **C2** `drive-coupler-length-vs-gap`: **RESOLVED 2026-10-15** (bought coupler, finally 22 mm long with OD 14, motor stack lowered 13 mm, clear height 24.4 mm; the first pass was 25 mm / Ø19 / 16 mm / 27.4 mm). Earlier text: coupler ≤ 10 mm in an 11.5 mm gap.
- **C3** `motor-shaft-extension-overlap`: **RESOLVED 2026-10-15** (rod z −14..46, 7 mm gap to the motor shaft at z −21; 10 mm in the first pass). Earlier text: 1 mm overlap of motor shaft and extension.
- **C4** `bearing-seat-wall-vs-tongue-pocket`: ≈ 0.7–0.8 mm wall with 625ZZ (hand values: ≈ 0.7 mm at seat Ø16.1, D2; ≈ 0.8 mm at the reamed Ø16.00, F6). Both are at or below the proposed 0.8 mm minimum-wall threshold below, so this is a KNOWN-OPEN finding, not a pass.
- **C5** `deck-outer-radius-discrepancy`: 26.54 (mesh) vs 28.25/29.4 (spec 003 row C / brief); **widened 2026-10-15**: viewer decks reach 34.5 on the socket axis (≈ 36.5 at a corner).
- **C6** `hub-bore-vs-keyed-rod`: mesh bore r 3.0 vs viewer D bore r 2.6 with flat 2.10 on a rod flat 2.00 (epoxied); earlier text: 5 mm D bore line-to-line.
- **C7** `home-boss-vs-deck-edge-and-rail` (new 2026-10-15, RESOLVED in the viewer spec 2026-10-15): magnet boss/pocket overhang the deck edge and the boss crosses the cartridge rails on deck 0 (N1, N2).
- **C8** `hook-ledge-zero-clearance` (new 2026-10-15, RESOLVED in the viewer spec 2026-10-15; same finding as W-C1 in specs/006): was `hook_z0 = ledge_z1 = 18.0`, now 0.8 mm clearance.
- **C9** `coupler-vs-tray-and-pocket-walls` (new 2026-10-15; **RESOLVED 2026-10-15 in the viewer** by the user's choice of a bought OD 14 × 22 mm coupler (axle (0, 15), r 7.0, z −26..−4, y ≥ 8.0) plus a notch in the viewer-drawn pill-tray back wall and floor; **residual canonical-tray item KNOWN-OPEN**). Now: the viewer tray, the viewer pocket/chute wall and the canonical `station-housing#12` are clear. The back wall (y 8..9.5, z −12.5..−8) is two boxes outside |x| ≤ `tray_notch_half` = 5.2 (10.4 mm wide notch) and the floor (z −14..−12.5) is three boxes whose middle strip |x| ≤ 5.2 ends at y = 7.0 instead of 8.0, so the coupler clears the back wall by about 0.57 mm and the floor edge by 1.0 mm (`tests/test_feature005_tray_notch.py`; the notch is part of the tray print). The only remaining finding is coupler against the unchanged canonical `outlet-tray#0` (y −42..8): 0.0 mm (touching), allowlisted in `OPEN_CONFLICTS` as "canonical tray unchanged; viewer tray notched" with the range −0.001..0.001 mm (`tests/feature005_spec.py`, check `canonical_sweep`); any change or any new finding fails. The canonical JSON, the canonical tray and the 3MF export are not edited. **Earlier text, kept for the numbers (superseded):** the assumed Ø19 × 25 mm coupler (axle (0, 15), r 9.5, z −29..−4, from the user's C2 choice) reaches y = 5.5 on the tongue side. It interpenetrates (a) the pill-tray floor (viewer: y −42..8, z −14..−12.5; canonical `outlet-tray`: y −42..16) by 2.5 mm, (b) the viewer pill-tray rear wall (y 8..9.5, z −12.5..−8) by 4.0 mm and (c) the tongue-pocket side wall (viewer and canonical `station-housing#12`: y 4.7..6.2, z −12..−3) by 0.7 mm. Measured by `test_feature005_clearance_static_stack.py::test_axle_and_mount_parts_clear_the_viewer_drawn_tray_and_pocket_walls` and `test_feature005_clearance_vs_canonical.py::test_viewer_decks_clips_boss_and_axle_sweep_clear_of_canonical_fixed_parts`. Not fixed here: clearing the 0.7 mm pocket wall alone needs coupler OD ≤ 17.6 mm minus clearance, and clearing the tray floor needs r ≤ 7 (OD ≤ 14) or a shorter/relocated tray (viewer `reference-look.js`), both of which change the user-chosen C2 coupler or the drawn tray. **Decision (2026-10-15, now taken):** the user chose the smaller OD 14 coupler and approved a tray notch ("if this works with the current design, sure"); the bench step 4/7 hold point now only asks to confirm the notch is in the tray print and that the real part is OD 14. The hand derivation in `build/bought-parts.md` (zero-clearance OD 19.4 against the weigh band at y = 5.3) did not consider the tray or pocket wall and is superseded by this finding.
- **C10** `hall-pocket-wall-vs-tongue-pocket` (new 2026-10-15, **OPEN, allowlisted KNOWN-OPEN**): the hall pocket (x 7.7..11.7, z 0.7..3.7) sits 0.711 mm (diagonal, corner to corner) from the tongue-pocket void (x ±7.25, z up to 0.15), below the proposed 0.8 mm minimum wall. Measured by `tests/test_feature005_clearance_housing_walls.py`; allowlist range 0.70–0.72. Options (not applied): move the hall +0.2 mm in x or z, or thicken the pocket wall; owner: viewer spec, decide before printing the platform.
- **C11** `home-offset-misstated` (new 2026-10-15, RESOLVED by measurement, documentation only): the hall sensor and the magnet share the plan position (9.7, −16.0), so the home window is centred on the RED-at-station angle; the 17.38° is the magnet's angle from the RED radial in the drum frame, not a home-to-station travel. Measured by `tests/test_feature005_home_sensing_window.py`: the magnet centre is over the hall footprint from −3.66° to +3.73° (width 7.39°, not "≈ 3.5°", which is roughly the half width), so a CCW rising edge comes **3.66° (≈ 20.8 steps at 2048, 20.7 at 2037.9) before the RED station**; BLUE, GREEN and ORANGE follow at +90°. The controller constant `home_offset_deg` is 3.66, not 17.38.
- **C4 / C5 results (2026-10-15)**: C4 seat wall measured 0.750 mm at the unreamed Ø16.1 worst case (0.800 at Ø16.00): KNOWN-OPEN, in range. C5 reach: decks clear every canonical fixed part (minimum clearance 0.300 mm to `station-housing`), boss and clips 1.300 mm, hook 5.479 mm, ledge 5.521 mm, magnet 0.900 mm; see `evidence/rot-c05-results.json`.

### Proposed check thresholds and the known-open allowlist (tasks T004, T009–T015)

All thresholds are proposed / ASSUMED. The Phase 3 clearance and fit tests use the thresholds below; a finding that is already recorded here (or later as C9+) is listed in the `OPEN_CONFLICTS` table of the shared test helper (`tests/feature005_spec.py`, T004) with its expected measured range. A test passes for an allowlisted finding that stays inside its recorded range and fails for any NEW finding or an allowlisted finding that moves outside its range.

| Check | Proposed threshold | Expected today (hand value) | Status |
|---|---|---|---|
| Minimum printed wall (two 0.4 mm perimeters) | ≥ 0.8 mm | C4 seat wall 0.7–0.8 mm; R14 M3 pilot wall ≈ 0.7 mm | both below the threshold: KNOWN-OPEN, allowlisted (C4, R14) |
| Sweep / static overlap | no overlap, EPS 0.05 mm | measured 2026-10-15: C5 reach clear (decks 0.30 mm, boss 1.30 mm); C1 ring/bearing vs `central-post` allowlisted; coupler vs the canonical tray `outlet-tray#0` = C9 residual (KNOWN-OPEN, 0.0 mm, canonical tray unchanged; viewer tray notched) | new findings become C9+ |
| Deck-to-platform / ring gap | 0.30 mm ± 0.03 | 0.30 mm | must pass |
| Clip arm strain | ≤ 1 % | ≈ 0.6 % | must pass |
| Hook above ledge | ≥ 0.8 mm | 0.8 mm | must pass |
| Home sensing window | magnet inside the hall footprint, one crossing per 360° | measured 7.39° wide (−3.66°..+3.73°; see C11); CCW rising edge 3.66° before RED | must pass |

## Project Structure

### Documentation (this feature)

```text
specs/005-first-subsystem-rotation-pin-gates/
├── plan.md              # this file
├── research.md          # decisions, alternatives, unverified facts
├── data-model.md        # rotation entities and submesh ownership
├── quickstart.md        # runnable validation guide
├── contracts/
│   └── rotation-check-log.md   # acceptance-log record format (ROT-Cxx / ROT-Rxx)
└── tasks.md             # NOT produced by /speckit.plan
```

### Source code touched by the NEXT step (nothing edited now)

```text
src/dispenser_sim/viz3d/concept_geometry.json   # integrated submeshes + conflicts (52 IDs unchanged)
src/dispenser_sim/viz3d/geometry_schema.py      # accept the new submesh ids
tools/build_visualizer_data.py                  # regenerate docs/visualizer/concept-data.js
docs/visualizer/reference-look.js               # axle/coupler/shaft visibly rotate; replace placeholder hall/magnet
docs/visualizer/rotation-controller.js          # NEW standalone controller logic (guard, requestIndex, policy, fault injection); mode (a) target
docs/visualizer/demo-controller.js              # NOT modified and NOT verified by this feature (spec change 2026-10-15); wiring DEFERRED
tests/unit/test_viz3d_rotation_sweep.py         # post as rotating/coaxial; ROT-C05 geometry checks
tests/browser/feature005/                       # new index-move harness page + script (mirrors tests/browser/feature004)
```

Note (2026-10-15): under the current task list the canonical JSON, `geometry_schema.py` and `tools/build_visualizer_data.py` entries above are NOT touched (the new parts stay viewer-only; tasks.md hard constraints), and `reference-look.js` only changes if a key name changes (T016).

**Structure Decision**: extend the existing single-repo layout; no new project, package or dependency. Feature 004's separate lab and the Feature 003 scanner FSM are not touched.

## Next-step task ordering (for a future `/speckit-tasks`; tasks.md is not edited here)

**Status 2026-10-15**: steps 4 and 8 (viewer) are done in `docs/visualizer/` as viewer-only geometry; step 2's canonical-JSON geometry is intentionally not done (viewer-only parts keep the 52 IDs); step 3 is covered by the clearance tests (C9 resolved in the viewer, canonical-tray residual KNOWN-OPEN); steps 5–7 are done as standalone logic, harness and evidence (300 tests passing; NOT VALIDATED; wiring into the viewer DEFERRED); step 1 (measure and print) needs physical work.

1. Measure and print canonical bounds (deck strip, tube bore, wall around the axle, housing pocket) to settle C4/C5 and the bearing size before modelling.
2. Geometry: add integrated assumed submeshes under existing IDs — bearing and thrust ring (`station-housing`), hall (`station-housing`), coupler and magnet (`rotating-drum`), D-flat parameters on the rod (`central-post`); fix C3 by mirroring the viewer values (rod z −14..46, motor stack lowered 13 mm, 22 mm coupler); add intended contacts (thrust ring ↔ drum underside, rod ↔ bearing, shaft ↔ coupler); record C1–C8. Keep exactly 52 IDs.
3. Sweep test: put `central-post` in the rotating set, extend the coaxial allowance, add ROT-C05; keep every existing assertion.
4. Viewer: rod, coupler and motor-shaft stub in the rotating group with a visible D-flat/marker so the axle visibly turns; replace the placeholder hall/magnet; keep the hide-list behaviour.
5. Controller (standalone, spec change 2026-10-15): in the NEW `docs/visualizer/rotation-controller.js` (not in `demo-controller.js`, which is NOT modified and NOT verified by this feature), implement `canRotate()` (all four blades closed, all lifts settled, pin up, carriage parked, caps closed, idle), rotation-only `requestIndex(color)`, `planRotation(from, to, policy)` with default = the unidirectional CCW-final-approach policy (D5/R-6) and `shortest` kept as a comparison case, station-confirmed state and injectable missed index. Wiring into the viewer is DEFERRED.
6. Index harness: 16 start→target moves, repeatability under the lost-motion model, refusals, missed-index faults, JSON log per the contract; run headless twice and diff.
7. Evidence: record results in a Feature 005 evidence file with NOT VALIDATED wording; run the full pytest suite and the browser harnesses in a foreground browser.
8. **IMPLEMENTED in the viewer 2026-10-15 (FR-030 / SC-013; no evidence file recorded yet):** "rotation parts only" view option in the viewer (`docs/visualizer/index.html`, `app.js`, `reference-look.js`). Isolates the rotation parts listed in the section "Rotation sub-subsystem: 3D-printing guide and electronics list", ghosts or hides everything else, labels each part with its name and printed/bought, and is view-only (no controller state change). Do after step 4 (the rod/coupler/motor-shaft must be in the rotating group first) and keep the 52 component IDs. Originally planned as "not started"; superseded: the sub-views (Rotation mechanism, Stepper mount, Compartments & decks) exist with dimension and label rules and are covered by `tests/test_feature005_rotation_spec.py` and `tests/test_feature005_rotation_view.py`. `tasks.md` is not edited here.

## Complexity Tracking

No Constitution violations introduced; nothing to justify. The Constitution I blocker is project-level and is not justified or waived here.

## Rotation sub-subsystem: 3D-printing guide and electronics list

> **Posture**: documentation only; nothing here is implemented or built. **Every size, part, current and rate is ASSUMED / UNVERIFIED** (recalled typical values, to be checked against real listings and a printed coupon). NOT VALIDATED / NOT PRINT-READY, `print_ready=false`, `fabricable_as_designed=false`. The pass checks are **proposed**, not standards, and no result is claimed. The numbers follow the **Design update 2026-10-15** (stepper stack lowered 13 mm, mount plate z −29..−27.4, columns x ±17.5, 625ZZ in the platform, 0.3 mm PTFE ring, bought 25 mm flexible coupler, 60 mm D-flat rod, boss-pocket magnet with a flush hall sensor); the 2026-10-13 values in this guide were updated in place and the replaced ones are listed under "Flags" below.

### A. Parts to print

**A0. Print coupons FIRST** (small test prints, a few minutes each; do them before any real print). Every dimension below is a starting guess until its coupon passes.

| Coupon | Feature tested | Proposed pass check |
|---|---|---|
| C-1 bearing seat | Rings modelled Ø15.80 / 15.85 / 15.90 / 16.00, 5.0 mm deep, wall as thin as the real seat (≈ 0.8 mm side); ream the 15.85 ring to Ø16.00 (H8) | 625ZZ seats by hand pressure and does not spin in the seat; wall does not crack |
| C-2 rod-fit pin test | A block with a round bore and a D bore (modelled Ø5.35 with the flat at 2.10, i.e. nominal + the **0.15 mm hole compensation**) and five printed pins modelled **4.85 / 4.90 / 4.95 / 5.00 / 5.05 mm** (0.05 mm steps) | record which pin matches the feel of the real 5.00 rod; the real rod slides in the D bore, flat engaged, without shake; confirm or correct `hole_comp_mm` = 0.15; dry fit only, no epoxy |
| C-3 magnet pocket | 1.0 mm plate with a Ø4.4 × 1.0 mm boss; pockets modelled Ø3.15 / 3.25 / 3.35 cut 1.4 mm from the boss top (0.6 mm floor, 3 layers) | 3 × 1 magnet sits on the floor, cannot rotate or fall out once glued; floor prints solid |
| C-4 stepper-mount joint | 1.6 mm plate with a Ø9.65 boss hole and two Ø3.55 holes 35.00 mm apart, plus two 4 × 4 mm column stubs (≥ 12 mm) with a 3 × 3 × 2 mm spigot and an M3 pilot hole (pilot Ø chosen by this coupon, ≈ 2.5–2.7 mm) | motor boss fits without wobble; M3 × 12 screws pass the ear and plate holes and bite 9.4 mm into the pilot hole without splitting the column |
| C-5 column socket | Block with two 3.30 mm square sockets, 2.2 mm deep, tried with the C-4 spigots | spigot enters by hand with ≈ 0.15 mm per side to spare and 0.2 mm of room above it for epoxy |
| C-6 clip bend | Three clip arms 1.2 × 6 × 16 mm with a 0.7 mm hook: printed upright, printed on their side, and as a separate flat-printed clip | flexed 0.7 mm outward 20 times without cracking; record which survives (the upright arm is expected to be weakest, R17) |
| C-7 D-bore epoxy bond and hand-torque (R13) | A hub stub with the D bore (Ø5.35, flat at 2.10) bonded with epoxy on a length of the real rod flat, rod flat and bore roughened, cured to the epoxy data sheet | hand torque in both directions shows no slip and no visible play against a fixed mark; record the cure schedule |

Builder-facing copies of A0, B1, D (steps 1–8 and 9–11), the print list and the bought list are in `specs/005-first-subsystem-rotation-pin-gates/build/` (`coupons.md`, `bought-parts.md`, `bench-build-order.md`, `bench-home-index-test.md`, `print-list.md`); they are checked against `rotation-spec.js` by `tests/test_feature005_build_docs.py`. This plan stays the source; the `build/` files add blank record columns only.

**A1. Parts**

| Part | Orientation and settings | Fits and notes |
|---|---|---|
| (a) Drum: hub, four socket decks, deck-0 magnet boss, eight retention clips | Upright, **deck undersides (z = 4.0) on the bed**, hub pointing up. PETG or PLA+, 0.4 mm nozzle, 0.2 mm layers, 4 walls, 5 top/bottom layers (the deck is exactly 5 layers), ≈ 30 % gyroid, **5 mm brim**, no supports; hole compensation +0.15 mm | Hub Ø16 × 42 (210 layers); four decks 24 wide × 22.5 long × 1.0 thick, mitred on the 45° diagonals. The large thin decks warp, hence the brim; trim the brim and face the deck underside lightly on a flat plate so the thrust-ring plane stays flat (R8). **D bore** modelled Ø5.35 with the flat at 2.10 (nominal Ø5.2); check with C-2, ream/file only if needed, then epoxy on the 5.00 rod (0.10 mm per side; unbonded play ≈ 3.8°, R13). **Magnet boss and pocket** on deck 0 (model Ø3.25 × 1.4 deep, 0.6 mm floor), polarity checked before the glue sets; resolve N1/N2 (C7) before printing. **Clips print upright**, layer lines across the bend (R17); hook height decision (C8) before printing |
| (b) Housing platform with bearing seat, sockets and hall pocket | Housing printed in sections (split choice open). Orientation proposal: **top face on the bed** so the thrust-ring face is the smooth first layer (the seat step becomes a 2 mm bridge); coupon C-1 and a test print decide | Platform 44 × 74 × 6.7 mm (z −3.0..3.7). Seat modelled Ø15.85, **reamed to Ø16.00 (H8)**, 5.0 deep, for the **625ZZ** flush at z 3.70, seat boss r 10.5. Two **3.30 mm square sockets, 2.2 mm deep** at x ±17.5, y 23 (9 × 9 mm collar region; collar edge is flush with the platform side, N4). **Hall pocket** for a 4.0 × 3.0 × 3.0 body (z 0.7..3.7) at x 7.7..11.7, y −17.5..−14.5, wire channel not yet designed (R18). Outlet openings 10.8 × 8.4 (top) / 11.8 × 9.4 (floor). **685ZZ** remains the fallback if the seat wall is too thin (D2/R2/C4) |
| (c) Stepper mount: plate with two integral columns and spigots | Plate **flat on the bed**; columns and spigots printed integral, standing up. PETG or PLA+, 4 walls (the 4 mm columns print nearly solid), ≈ 30–40 % infill | Plate 42 × 23 × 1.6 mm, z −29.0..−27.4; boss hole modelled ×9.65 (nominal 9.5); two screw holes modelled Ø3.55 (nominal 3.4) at x ±17.5, y 23; columns **4 × 4 × 24.4 mm** (z −27.4..−3.0), **M3 pilot hole 9.4 mm deep** in each, **3 × 3 × 2 mm spigot** epoxied into the platform socket. Flat plate on the bed = best flatness for the motor face. Tall slender columns: check rigidity and splitting (R14) |
| (d) Hall-sensor holder | — | **Removed 2026-10-15**: the hall sensor sits in a pocket in the platform top, see (b) |
| (e) Cartridges (4) with catch ledges | Upright, base (z = 6.0) on the bed (proposal); settings as (a) | Cartridge tube and cap are Feature 003 concept parts; this feature adds the catch ledges (0.8 mm out, 6 mm wide, 1.2 mm tall, z 16.8..18.0, each side). The ledge underside is an unsupported 0.8 mm overhang; chamfer it if it sags (OPEN) |
| (f) Optional: ULN2003 and controller board standoff plates | Flat on the bed | Optional; may be bought standoffs instead |
| **Do NOT print** | — | Rod, bearing, flexible coupler, PTFE ring, magnet, hall sensor, screws, motor |

**Notes**
- **Material**: PETG or PLA+ (stiffness and creep margin for the thin decks and bracket). **Avoid ABS here** (warping on the large decks; enclosure/fumes). FDM/PLA remains the provisional baseline elsewhere in the project; this is a rotation-part refinement, ASSUMED.
- **Tolerance and compensation**: hole compensation **+0.15 mm** (model hole = nominal + 0.15; `hole_comp_mm` in `rotation-spec.js`, confirm with coupon C-2); outside dimensions print slightly large (ASSUMED). Z sizes are whole 0.20 mm layers (hub 42.00 = 210 layers, deck 1.00 = 5, plate 1.60 = 8, seat depth 5.00 = 25). Ream only where a `dims` entry says so (seat Ø16.00).
- **Orientation reasons**: decks on the bed gives one flat plane for the thrust ring and the best first-layer accuracy; plate on the bed keeps the motor face flat; the columns are integral to the plate and join the platform by an epoxied spigot, so there is no bolted joint (the two M3 screws only clamp the motor to the plate).
- **All dimensions need a coupon** (A0) before the real print.

**A2. Expected tolerances for the printed parts** (nominal and tolerance from `dims` in `rotation-spec.js`; ASSUMED, not measured)

| Feature | Nominal (mm) | Tolerance | Print model |
|---|---|---|---|
| Hub Ø / height | 16.0 / 42.0 | ±0.15 / ±0.10 | 16.00 / 42.00 |
| D bore Ø / flat from axis | 5.2 / 2.10 | +0.10 −0.00 / +0.05 −0.00 | 5.35 / 2.10 |
| Socket radius (sockets every 90°) | 15.0 | ±0.10 (±0.10°) | 15.00 |
| Deck width / length / thickness | 24.0 / 22.5 / 1.0 | ±0.15 / ±0.15 / ±0.10 | 24.00 / 22.50 / 1.00 |
| Cartridge channel (X / Y) | 10.8 / 8.4 | ±0.15 | 10.95 / 8.55 |
| Bearing seat Ø / depth | 16.0 / 5.0 | +0.02 −0.00 / ±0.10 | 15.85, ream to 16.00 / 5.00 |
| Mount plate length / width / thickness | 42.0 / 23.0 / 1.6 | ±0.15 / ±0.15 / ±0.10 | 42.00 / 23.00 / 1.60 |
| Boss hole Ø / screw hole Ø / pitch | 9.5 / 3.4 / 35.0 | ±0.15 / ±0.10 / ±0.10 | 9.65 / 3.55 / 35.00 |
| Column section / height | 4.0 × 4.0 / 24.4 | ±0.15 | 4.00 / 24.40 |
| Spigot section / height | 3.0 / 2.0 | ±0.10 | 3.00 / 2.00 |
| Housing socket width / depth | 3.3 / 2.2 | +0.10 −0.00 / ±0.10 | 3.30 / 2.20 |
| Platform thickness / width / length | 6.7 / 44.0 / 74.0 | ±0.20 / ±0.30 / ±0.30 | 6.70 / 44.00 / 74.00 |
| Magnet pocket Ø / depth; boss Ø / height | 3.1 / 1.4; 4.4 / 1.0 | ±0.10; ±0.15 / ±0.10 | 3.25 / 1.40; 4.40 / 1.00 |
| Clip arm thickness / height / width | 1.2 / 16.0 / 6.0 | ±0.10 | 1.20 / 16.00 / 6.00 |
| Hook depth / hook-to-cartridge gap | 0.7 / 0.2 | ±0.10 | 0.70 / 0.20 |
| Ledge height / projection | 1.2 / 0.8 | ±0.10 | 1.20 / 0.80 |

### B. Bought mechanical parts (examples; sizes and availability UNVERIFIED)

| Part | Example size / class | Notes |
|---|---|---|
| Stepper | 28BYJ-48, 5 V geared, with ULN2003 driver board; ≈ Ø28 × 19; shaft ≈ Ø5 double-D (flatted), 8 mm exposed assumed; ears 35 mm apart | shaft is eccentric (8 mm) on the real part (R5) |
| Bearing | **625ZZ, 5 × 16 × 5 mm, double shielded** | **685ZZ is 5 × 11 × 5**, cited only as the plan's seat-wall fallback (D2), not as a first choice |
| Rod | **5 mm D-flat bearing-steel rod, 60 mm**, used uncut (z −14..46) | flat at 2.00 from the axis (4.50 across); deburr both ends; replaces the 53–55 mm plan length (F5) |
| Flexible coupler | **22 mm, OD 14, 5-to-5 mm, flexible**, two 4 mm screw holes (grub screws about 4 mm; M4 and a 2 mm hex key assumed) | rod-side bore ≥ 10 mm deep, motor side ≥ 5 mm; clamp or grub-screw access; C2 resolved |
| Thrust ring | **PTFE sheet 0.30 mm, die-cut OD 20 / ID 17** | sets the 0.30 mm hub-to-platform gap |
| Fasteners | **2 × M3 × 12** pan-head screws | head under the motor ear, 9.4 mm into the column pilot holes; no nuts (F3 resolved) |
| Magnet | **3 × 1 mm neodymium disc** (N35-class assumed) | pole facing the hall sensor |
| Hall sensor | **A3144-class** unipolar digital | see C |
| Adhesive | **epoxy** (column spigots, D bore) and **CA glue** (magnet) | |
| Controller and driver | **ESP32** controller; ULN2003 board with the 28BYJ-48 | see C |

### B1. Measure before ordering or printing

Measure the real part with calipers and write the value next to the model value; change the model (not the part) if it is outside the tolerance in A2 or in `dims`.

| Part | Measure | Why | Model value |
|---|---|---|---|
| 28BYJ-48 | Exposed shaft length (from the body face and from the boss top); double-D flat width and across-flats; boss Ø and height; ear pitch and hole Ø; shaft offset and its direction; body Ø | ≥ 5 mm of shaft must go into the coupler; the flats set how the coupler grips; plate and ear holes | 8.0 exposed; plain Ø5 shaft; boss hole 9.5; pitch 35.0, holes 3.4; offset 8.0 (+y); Ø28.0 |
| Coupler | OD; overall length; bore depth at each end; bore Ø; fastening type and its access | Must stay 1 mm below the platform underside and clear the columns (31 mm between their inner faces); rod needs ≥ 10 mm, shaft ≥ 5 mm | Ø14, 22, 5 / 5 |
| Rod | Diameter; flat depth; flat length; overall length | Flat must engage the D bore over its full glued length; length fixes the 10 mm coupler insertion | Ø5.00 h6; flat at 2.00 (0.5 deep); length not specified in the viewer; 60 |
| Bearing 625ZZ | OD, ID, width | seat Ø16.00 and flush top at z 3.70 | 16 / 5 / 5 |
| PTFE sheet | Thickness; OD and ID of the die-cut ring | sets the 0.30 mm gap | 0.30 ±0.03; 20 / 17 |
| Magnet and hall | Magnet Ø and thickness; hall body size and lead pitch | pocket Ø3.1; hall pocket 4.0 × 3.0 × 3.0 | 3.0 × 1.0; 4.0 × 3.0 × 3.0 |
| M3 × 12 screw | Head Ø and height; thread length | head sits under the ear | head r 2.8, 1.8 high |

### C. Electronics needed for rotation (typical values, all UNVERIFIED)

| Item | Assumed spec | Notes |
|---|---|---|
| Stepper | 28BYJ-48 unipolar, 5-wire, 5 V; red = common to +5 V | ≈ 100 mA per energized coil, ≈ 200–240 mA with two coils energized |
| Driver | ULN2003 driver board, 4 inputs IN1–IN4 | 3.3 V logic normally works but **must be verified**; flyback diodes are on the chip |
| Controller | ESP32-DevKitC (same board as the reference model) | 4 GPIO outputs (IN1–IN4) + 1 GPIO input (hall) |
| Home sensor | digital Hall-effect switch, A3144-class (unipolar, 4.5–24 V supply, open-collector output) | powered at 5 V (its minimum supply exceeds 3.3 V); **10 kΩ pull-up to 3.3 V** so the ESP32 pin stays within its limit; **0.1 µF** bypass at the sensor |
| Home magnet | 3 × 1 mm disc in a boss pocket on the socket-0 deck | air gap to the flush hall sensor **0.9 mm** (0.6 mm floor + 0.3 mm gap); sensing at that gap is UNVERIFIED (Flag F1 resolved) |
| Supply | 5 V; bench: USB ≈ 1 A; product: boost from the LiPo as in the reference (**unsized**) | ≈ 100–220 µF bulk capacitor near the driver board; common ground between supply, driver and ESP32 |
| Wiring | motor's 5-pin JST-XH-style plug into the driver board; 26–28 AWG, 3 wires for the hall (5 V, GND, signal — the pull-up reference is 3.3 V at the controller end) | strain relief on the motor lead; **no wires to any rotating part** (the drum carries only a passive magnet, so no slip ring; R12) |

**Behaviours the firmware must provide (not code; ASSUMED)**
- **Homing**: find the hall edge and zero the step count (home = rising edge approached CCW, D5).
- **Step counting** between stops, with calibration of steps per revolution from two home edges (R4).
- **One-direction final approach with overshoot** (CCW final approach; 3° overshoot for CW moves, D5).
- **Missed-home fault**: if no home pulse arrives within N steps (N not chosen here), report a fault, leave the station unconfirmed, and block pin/gate action until re-indexed (FR-009).
- **Coil release vs holding at idle — OPEN**: coils off saves ≈ 1.2 W and heat but loses holding torque, so the drum may drift; the plan assumes a detent or holding current. Not decided here.

### D. Bench build order for rotation (proposed, not standards; no result claimed)

| Step | Build | Proposed pass check |
|---|---|---|
| 1 | Measure the real parts (B1) and write the values next to the model values | every value inside the tolerance in A2 / `dims`, otherwise change the model before printing |
| 2 | Print and measure the seven coupons C-1..C-7 (A0) | each coupon's pass check met; hole compensation and pilot-hole Ø recorded |
| 3 | Print the stepper mount; fit the motor with two M3 × 12 screws (heads under the ears) | motor sits flat on the plate, boss clears the hole, screws bite 9.4 mm without splitting a column, shaft stands ≈ 8 mm proud |
| 4 | Print the housing platform; ream the seat to Ø16.00; press in the 625ZZ flush (z 3.70); lay the PTFE ring; fit the hall sensor in its pocket and route its wires | bearing flush with the platform top and turns freely by finger; ring lies flat; hall wires clear of the corridor in "Future-ready provisions" |
| 5 | Print the drum; dry-fit the D bore on the 60 mm rod (rod top flush with the hub top); glue the magnet in its pocket (polarity checked) | rod slides in with the flat engaged and no shake; magnet flush or below the boss top and cannot rotate |
| 6 | Assemble the axle: rod down through hub and bearing with the drum resting on the PTFE ring; epoxy the hub to the rod with the rod top flush with the hub top (rod bottom then at z −14); cure | drum rests on the ring without wobble and turns freely; rod end stands 11 mm below the platform underside |
| 7 | From below, slide the coupler onto the rod (10 mm in), then raise the motor-and-mount assembly so the shaft enters the coupler (5 mm in) and the spigots enter the sockets with epoxy; tighten the coupler | depth gauge shows 10 mm / 5 mm insertion and the 10 mm end gap; coupler top clears the platform underside by 1 mm |
| 8 | Spin test: step the motor slowly with a bare test sketch (no controller logic) | no rub, no wobble visible, coupler tolerates the offset; no creep of the epoxy joints |
| 9 | Add the hall wiring and run the homing test | **20 homing runs (CCW approach) repeat within ± 1 step** (≈ ± 0.18°; stricter than ROT-R01's 0.3°) |
| 10 | **Home and index 90° bench test**: from home, command a quarter turn (512 steps nominal, or the calibrated steps per revolution / 4, R4) four times in the CCW direction, then repeat with a CW move using the 3° overshoot; 10 repeats; mark the drum edge and read the angle against a fixed scale | each end position within ± 0.5° (≈ ± 2.8 steps) of the same mark, never at a neighbouring stop (mode (b), proposal only; ties to SC-002 / ROT-R02) |
| 11 | Run the **16 start-to-target index moves** from the spec | every move ends at the commanded station (ties to SC-001; mode (b), proposal only) |

### E. Parts table

| Part | Printed / bought | Qty | Example size (unverified) | What it does |
|---|---|---|---|---|
| Drum (hub + 4 mitred socket decks + 8 clips + deck-0 boss) | printed | 1 | hub Ø16 × 42, z 4..46; decks 24 × 22.5 × 1.0 | carries the cartridges; rides on the thrust ring |
| Housing platform with bearing seat, sockets, hall pocket | printed (housing section) | 1 | 44 × 74 × 6.7; seat Ø16.00 | locates the bearing, takes the mount spigots and the hall sensor |
| Stepper mount (plate + 2 columns with spigots) | printed | 1 | plate 42 × 23 × 1.6 at z −29..−27.4; columns 4 × 4 × 24.4 at x ±17.5 | holds the motor under the base |
| Cartridges with catch ledges | printed | 4 | tube 14.8 × 12.4 × 40; ledges 0.8 × 6 × 1.2 | hold the pills; lift out straight up |
| Board standoff plates | printed (optional) | 0–2 | — | hold driver/controller boards |
| 28BYJ-48 stepper | bought | 1 | Ø28 × 19, 5 V | turns the drum |
| Bearing 625ZZ, double shielded | bought | 1 | 5 × 16 × 5 | radial location of the rod |
| D-flat bearing-steel rod | bought | 1 | Ø5, 60 mm, used uncut | axle; epoxied to the drum |
| Flexible coupler | bought | 1 | 5→5, L 22, OD 14, two 4 mm screw holes | joins motor shaft to rod |
| PTFE thrust ring | bought | 1 | 0.30 mm, die-cut OD 20 / ID 17 | carries the drum weight |
| M3 × 12 screws | bought | 2 | — | clamp the motor ears to the plate and into the columns |
| Magnet | bought | 1 | 3 × 1 mm neodymium | home marker |
| Hall sensor | bought | 1 | A3144-class | detects home |
| 10 kΩ resistor, 0.1 µF capacitor | bought | 1 + 1 | — | pull-up, bypass |
| ULN2003 driver board | bought | 1 | typical module | drives the coils |
| ESP32 controller (DevKitC) | bought | 1 | — | controller |
| 5 V supply, 100–220 µF capacitor | bought | 1 + 1 | USB ≈ 1 A (bench) | power; bulk decoupling |
| Wire 26–28 AWG, epoxy, CA glue | bought | — | — | hall wiring; bonding |

### Flags and corrections

- **Correction to an earlier chat remark**: a quarter turn at the simulation rate of 1.3 rad/s takes **≈ 1.2 s (1.208 s)**, not 0.5 s. This matches the existing D6 table; no plan number changes. On real hardware the plan recommends 0.8 rad/s with 0.2 s ramps, ≈ 2.16 s per quarter.
- **F1 Hall placement and gap — RESOLVED 2026-10-15 (flush in the platform top, 0.9 mm gap; the clip-holder variant is dropped). Original note:** this section's "air gap 2–4 mm, holder clip beside the drum edge" differs from D5, which puts the hall flush in the platform top under a flush deck magnet at ≈ 0.3–0.5 mm. The clip variant resembles the viewer's placeholder (R10). Both are open; the gap, the placement and the A3144/Ø3 × 1 magnet sensing range at 2–4 mm are UNVERIFIED and the homing test (D step 4) decides. D5 is not overridden.
- **F2 Magnet pocket depth — RESOLVED 2026-10-15 (1.0 mm boss on the deck, pocket cut 1.4 mm from the boss top, 0.6 mm floor; see N1/N2 for the placement problems). Original note:** a 1.2 mm deep pocket exceeds the 1.0 mm deck thickness used in the facts table (decks z 4..5). A local boss or a through pocket with the magnet bonded flush is needed; re-check against canonical geometry before use.
- **F3 Motor ear screws — RESOLVED 2026-10-15 (screw heads sit under the ears and the screws go up into pilot holes in the columns, so no nut access is needed). Original note:** the ears (35 mm apart) and the columns (x ±17.5) share the same x positions, so nut/screw-head access at the plate needs checking (nut trap or offset). UNVERIFIED.
- **F4 "Columns reach the floor"**: in this plan the columns end at the platform underside (z −3), which is what "floor" means here; the plate z −16..−14.5 value is **superseded 2026-10-15** (plate now z −29..−27.4).
- **F5 Rod length — RESOLVED 2026-10-15 (the 60 mm rod is bought and used uncut, z −14..46, so C3 is closed and nothing is trimmed). Original note:** plan 53–55 mm vs a 55–60 mm stock suggestion; buy long and trim to the final length once the rod bottom is settled (C3, z −7 proposed).
- **F6 Seat wall**: the printed Ø15.8–15.9 then reamed Ø16.0 seat gives a wall of ≈ 0.8 mm to the tongue-pocket wall (hand calc: (15 − 8.0) − 6.2), versus ≈ 0.7 mm in D2 at Ø16.1. Still thin, so the 685ZZ fallback stays; no plan number is changed.
- Values changed by the 2026-10-15 update are listed in "Design update 2026-10-15"; every other plan number is unchanged. Flags F1–F5 above keep their original text after the resolution marker.

## Future-ready provisions

> Purpose: keep the cheap things reserved now so later features need no rework. Nothing in this section adds geometry, parts or code. **DONE** means decided and recorded here or already present in the viewer; **DEFERRED** means not designed, not drawn and not on the print list. All positions are ASSUMED / NOT_VALIDATED; the weighing numbers are Feature 006 nominals, which that plan calls parameters, not facts.

| # | Provision | Reserved now | Deferred | Status |
|---|---|---|---|---|
| a | Weigh-station corridor and lug slots (specs/006 plan D1, W-C1, W-C2) | Keep free, in both the platform and the deck, the outboard corridor under the fill position: lug slots at x ≈ ±9.6 (slot x 8.5..10.7), outboard y ≈ −10.5 (slot y −12.7..−8.3) and inboard y ≈ +4.3 (slot y 3.3..5.3), and the band under the platform z −12.5..−3.0 at x ±20, y −12.7..5.3. No Feature 005 hole, screw, wire channel or thin feature goes there; the hall (x 7.7..11.7, y −17.5..−14.5) is 1.8 mm clear of the outboard slot (hall edge y −14.5 to slot edge y −12.7; hand value, re-checked by T050) and the Ø4.4 boss is ≈ 1.1 mm from the deck slot. Respect the clip-root keep-out (x 8.3..9.5, \|y\| ≤ 3.0) and the tongue pocket (x ±7, y −18.3..5.7), which is why the corridor is outboard of x 8.5. Keep the platform plain there so slots can be cut later | Pad bars, platform and deck slots, cartridge lugs, load cell, lift actuator; the W-C1 change (`hook_z0` 18.0 to ≈ 18.8, tongue-pocket wall measurement W-C2); no slot is in the print list. Open check: with the mitred 24 mm deck the inner edge at x = 10.7 is y ≈ 4.3, so a slot reaching y = 5.3 would clip the mitre, to be re-derived in the 006 geometry task. Cost of waiting: the hook height and deck slots are in the drum print, so weighing means one drum reprint unless W-C1 is decided before the first drum is printed (user decision); the housing is not reprinted | Reserved: DONE (as constraints; checked by `tests/test_feature005_reserved_volumes.py`: hall 1.80 mm, boss 1.10 mm, OD 14 coupler 2.70 mm clear). DEFERRED: pad bars, platform and deck slots, cartridge lugs, load cell, lift actuator, W-C1 hook change for weighing, hatch |
| b | Lid hinge and latch interface on the cartridge cap | Cap, hinge (pivot at the inner tower edge) and latch (outer face, near the top, z ≈ 45) stay as drawn in the viewer and are untouched by the rotation parts. Reserve **one fixed lid-release actuator position at the fill position**, on the fixed housing side facing the latch; the drum carries **no electronics, wiring, sensors or springs-with-sensors** (only the passive home magnet) | The actuator, its keep-out volume and reach, any latch redesign. Obligation from specs/006: the actuator is parked and non-contacting during a weight reading | Rule: DONE (passive drum and a PROPOSED lid-release keep-out at the latch, `x ±4, y −14.0..−6.75, z 46.35..49.85`, derived from `red-cap-latch-body`; `tests/test_feature005_reserved_volumes.py`). Lid-release actuator itself: DEFERRED |
| c | Removable cartridges lift straight up (sanitation feature) | Cartridges and clips already support tool-free straight lift (ledge, flexure clip); the rotation parts add nothing above the deck except the clip arms (z ≤ 21) and the deck-0 boss (z ≤ 6.0). Working figure: about **50 mm of free height above the deck** over each cartridge position | Enclosure hatch height and shape (to be decided); full extraction needs the cartridge's ≈ 46 mm height again above its seat (tube 40 mm plus cap and knob), and a lift of ≈ 15 mm frees the hooks; handle, procedure and clip fatigue life | Design: DONE (hook 0.8 mm above the ledge and nothing above deck z 21 over a cartridge position; `tests/test_feature005_reserved_volumes.py`). Hatch, procedure, handle: DEFERRED |
| d | Rotating mass ≤ 150 g, torque ≤ one third of rated | Load check recorded above: 125 g at the worst case (25 g headroom); ≈ 2.9 N·mm against an ≈ 11 N·mm limit (≈ 8 N·mm headroom). Rule for every later feature: any rotating mass or drag is added to this check before it is accepted | Rig measurement (ROT-R03 and related) | Check: DONE (hand calc, `load_check()` in `tests/test_feature005_load_check.py`). Measurement: DEFERRED (needs physical work) |
| e | Controller extension points (interfaces only) | Names are fixed so later work does not rename them, and they match the specs/006 follow-up contract. **Provided by the rotation controller later:** `at_station` (confirmed station), `drum_state` (`STILL` or `ROTATING`), `sequence_active`, `lift_in_progress`. **Accepted later:** `loaded-state(compartment, count)`, `lock-request(compartment, reason)`, `unlock-request(compartment, reason)` (reserved name; Feature 006 never emits it), `quarantine-flag(compartment, set \| clear)`. A locked or quarantined compartment is refused for engage and dispense with a stated reason, like the refusals in FR-019. The four provided readouts (`at_station`, `drum_state`, `sequence_active`, `lift_in_progress`) are IMPLEMENTED in the standalone `docs/visualizer/rotation-controller.js` snapshot and covered by `tests/test_feature005_rotation_controller.py` and `tests/browser/feature005/`; the accepted-later names are only reserved, with no code, field or test | Accepted extension points `loaded-state`, `lock-request`, `unlock-request`, `quarantine-flag`, their storage and the refusal reasons; wiring into the viewer | Provided readouts: DONE (standalone logic, not wired, NOT VALIDATED). Accepted extension points: DEFERRED |
| f | Viewer sub-view pattern | To add a sub-view: add a group with a `view` field in the spec file; add a radio in the `subsystemView` group and its panel in `index.html`; add the label to `VIEW_LABELS` and the part labels to `OWN_VIEW` in `reference-look.js`; map the radio in the click handler of `app.js`; add a spec test (each dimension line measures its nominal) and a wiring test in the style of `tests/test_feature005_rotation_spec.py` / `_view.py`. The three existing sub-views must keep passing unchanged | The Feature 006 "Weight verification" sub-view | Pattern: DONE (existing sub-views and `tests/test_feature005_rotation_spec.py` / `_view.py`). Feature 006 "Weight verification" sub-view: DEFERRED |

## Readiness checklist (dispensing)

Work tracker for the first subsystem, not a readiness claim: `print_ready=false` and `fabricable_as_designed=false` stay until a real build says otherwise. Items 1–8 make the rotation **printable and buildable**; items 9–11 are the standalone controller logic (the viewer controller is not modified or verified) and are implemented and tested headlessly as of 2026-10-15, NOT VALIDATED.

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | Design values reconciled between this plan and `rotation-spec.js` | Plan author | **DONE 2026-10-15** (this update) |
| 2 | Viewer findings N1/N2 (magnet boss vs deck edge and rails, C7) and the hook-height decision (C8) resolved in the viewer spec | Viewer task | DONE 2026-10-15 (spec values, tests and viewer updated; the canonical JSON is unchanged) |
| 3 | Measure-first parts list (B1) filled in with real values, model changed where outside tolerance | Builder | OPEN |
| 4 | Parts ordered with the exact designations in section B | Builder | OPEN (after 3) |
| 5 | The seven print coupons C-1..C-7 printed and their pass checks recorded; `hole_comp_mm` confirmed or corrected | Builder | OPEN (needs physical work) |
| 6 | Real parts printed (drum, housing platform, stepper mount, cartridges) | Builder | OPEN (after 2 and 5) |
| 7 | Bench build completed in the section D order (steps 1–8) | Builder | OPEN |
| 8 | Bench home test (20 CCW approaches within ± 1 step) and **home-and-index 90° bench test** (± 0.5°, 10 repeats) recorded as mode (b), NOT VALIDATED | Builder | OPEN |
| 9 | Interlock gaps from D7 closed in the standalone `rotation-controller.js` logic: shared `canRotate()`, `requestIndex(color)`, station-confirmed state, missed-index and hard-fault handling, unidirectional CCW direction policy; `demo-controller.js` NOT modified, NOT verified; wiring into the viewer DEFERRED | Controller task | **DONE 2026-10-15 as standalone logic**: implemented and tested headlessly (`tests/test_feature005_rotation_controller.py`, `tests/browser/feature005/`); `demo-controller.js` NOT modified and NOT verified (sha1 `0c83960…`); wiring into the viewer DEFERRED (W03, needs user approval) |
| 10 | Index harness ROT-C01..C04, C06..C08 run headless on the standalone logic twice with identical logs; ROT-C05 geometry checks emitted into the same log | Controller task | **DONE 2026-10-15**: 245 checks (236 JS harness + 9 ROT-C05), 1 fail (ROT-C05 coupler, open C9); two harness runs byte-identical; log in `evidence/rotation-check-log.json` |
| 11 | Evidence file with NOT VALIDATED wording stating that FR-025 and SC-004..SC-008 are not met and Feature 005 is not accepted; full pytest suite and browser harness pages run in a foreground browser | Controller task | **DONE 2026-10-15**: `implementation-evidence.md` states FR-025 and SC-004..SC-008 not met and Feature 005 not accepted; suite 300 passed, 0 failed; the three browser harness pages opened from `file://` (53, 14 and 236 checks, 0 failing) in the integrated browser, NOT a real-device or FPS/WebGL check |
