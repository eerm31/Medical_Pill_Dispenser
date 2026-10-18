# Implementation Plan: Cylindrical Product Layout

**Branch**: spec directory `007-cylindrical-product-layout` only (the actual Git branch is still the unborn `001-dispensing-mechanism-simulation`; nothing was created or switched) | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

> **Posture**: every number is **ASSUMED / NOT_VALIDATED**. Nothing was printed, measured or fitted. All artifacts of this feature state `print_ready=false` and `fabricable_as_designed=false`. No single-dose, dose, safety or hardware-readiness claim is made; Constitution I completion stays ERROR / BLOCKED and this feature is not a waiver. Features 001-006, the 52 canonical component IDs, `docs/visualizer/demo-controller.js` (sha1 `0c8396023ca6fc85cb135fbbf58ea39e903cee11`) and the canonical data (`concept_geometry.json`, `concept-data.js`) stay untouched.

> **Correction to the spec (found while planning)**: spec.md assumed the tongue rod end (98.7 mm) sets the reach. Building the canonical assembly shows the whole `tongue-actuator-rod` component, including its integrated pull-solenoid body, reaches **115.0 mm** from the drum axle (y -99.5). With both straight chains unfolded (the spec's Q1 default) no passive rearrangement can go below about 240 mm across, which is the size the user already rejected. The 205 mm target is only reachable if the solenoid is re-seated (option B, about 216 mm) or both chains are folded (option D, about 170 mm). This is Q1 and needs the user's decision; the plan recommends B and lays out D.

## Revision 3 (2026-10-17): a real product, not a shell around the lab layout

The user rejected both wrapping options ("just encircling or boxing it will not make this a good device"). Components may be rearranged; the only goals are a device that is not large and not unstable, with the compartment lids exposed. This revision designs the product as a stacked tower and replaces Revision 2 and the A / B / D options below (kept only as history). Every number is ASSUMED / NOT_VALIDATED and was checked by script against the canonical component boxes (axle-centred coordinates u = x, v = y - 15, z unchanged).

**Result: about 138 mm across x about 110 mm tall (feet included), about 530 g, tips over at about 26 degrees** (the lab layout was about 240 mm wide). The earlier 85-115 mm radial reach came from just two things: the servo chain and the solenoid chain laid out in line to the front. Everything else already fits inside a 62 mm radius.

> **Correction found at build start (2026-10-17)**: row 2 below (tongue solenoid under the tongue with a short hook) is wrong. The solenoid body is 29.5 mm long **along its pull axis** (the viewer and canonical bounds both show x +-10.3, y -99.5..-70, 23.9 tall), not 23.9 as I assumed. A pull solenoid must sit on the far side of the point it pulls, so under the tongue it still reaches v -85, and a bell crank to fold it needs slots through the platform floor and the tray plus an arm pointing outward again. The only compact way found is **T1 below**, which replaces the pull solenoid. The pin servo placement (row 1) was re-checked and moves beside the carriage (x 9..31.7, y -33..-10, z 26..38.2; the pin solenoid above the carriage reaches z 37.5, so it cannot sit on top): reach 57.5. The tray is a drawer that slides out to the right.
>
> **T1 (needs the user's approval, because it replaces a part)**: drive the tongue with a micro servo (the same type as the pin servo) and a scotch yoke instead of the pull solenoid, rod, return spring and the two position micro-switches. Servo body x -6..17, y -36.1..-23.9, z -26..-3.3, vertical shaft at (0, -30) under the platform floor; a 5.7 mm crank arm rides in a 16 mm cross slot in the tongue tail (stroke 11.4 mm, same as now); a 16 x 16 mm opening is cut in the platform floor for the arm. Reach 53.9 mm. Position feedback from the two switches is lost (an optical or hall sensor would have to replace it; not designed). Largest reach of anything is then 57.5 mm, so a 66 mm inner radius (138 mm across) holds.

> **Build status (2026-10-17)**: T1 approved and built in the viewer layer and the print files: tower 138 mm across, round base with three feet, controller shelf, nine-board bay (battery included, 2 mm spacing), pin servo beside the carriage and tongue servo under the platform floor (both scotch yokes), short drawer tray with a shell window on the right, scanner moved 6.4 mm, shell sectors at -85..35, 35..155 and 155..275 degrees. Not built or not designed: sector and wall-to-base joints, drawer rails, servo and board fixing, tongue position feedback, cable routes, lid swing over the pin servo. Canonical Feature 003 files and `demo-controller.js` are unchanged; the original lab layout exists only in the canonical data and 3MF, not in the viewer any more.

> **Update 2026-10-17 (reader outside, support audit)**: the barcode reader is no longer part of the product: it stands on the table 48 mm further left on its own foot plate and column, and the demo's package path, beam and guides move with it (app.js `SCAN_DX`). The pill tray is replaced by a 15 degree trough that runs from the outlet chute through a 12 mm window in the right wall to a cup on a base apron (the old drawer could not reach the wall). New printed parts: pin rail block (carries the carriage rails from the platform top), pill trough, pill cup; the base gains the apron, a trough post, board standoffs and the controller-shelf posts. `tests/test_feature007_support.py` checks that every part has a declared support, that each contact is geometric, and that every chain ends on the base or the table. Shape finding: with the reader gone, the mechanism alone fits a 94 mm circle; the boards set the size (63 mm radius), and the best-fit circle is within 4 % of the best rectangle, so the cylinder stays.

> **Update 2026-10-17 (closed enclosure and joints)**: a service lid now covers the drum (the caps and the lid unlocker reach z 62, so the wall rises to z 63 and the lid sits at z 63..66). The lid is a 144 mm smoked disc with a 3 mm grip overhang and a 2 mm lip inside the wall; it lifts off whenever a cap opens or a cartridge is removed. The base is a 144 mm plinth with a 3.6 x 2.5 mm ring groove that holds the wall; each wall sector has a 1 mm tongue on one edge and a matching groove on the other. The sectors, base and lid were checked for interference by script (no overlap). The lid is held by gravity only. The camera now opens at radius 330 so the whole product is in view, and the scanner lens and bezel moved with the outside reader (the lens had been floating inside the product).

> **Update 2026-10-17 (round deck, inside cup, floating audit)**: the cross-shaped drum decks are now one round deck of radius 35.5 mm (each socket owns a quarter; the disc covers the cartridge rails, clips and magnet boss; the sweep clearance tests pass unchanged). The pill cup moved inside the wall: the trough is shorter (ends at x 59, over a 22 x 16 mm cup) and the cup slides out through an 18 degree opening at the plinth level, so the apron is gone and the footprint is a plain 144 mm circle (a 150 mm bed prints the base). The nine boards were repacked (battery rotated, none overlapping posts, cup, feet or stepper). A new viewer QA hook returns every drawn mesh box; grouping touching boxes found one floating part (the solenoid terminal stub on the pin carriage), now attached, and leaves only two groups, the product and the outside reader on its table. Size finding: the product cannot shrink much with the same components. The mechanism reaches 57.5 mm (pin servo, platform) and the nine dev boards need a 62 mm radius even in two layers, so the wall stays at 66 mm inner radius.

> **Update 2026-10-17 (housing views and mounts)**: the viewer opens on an opaque assembled product. A Housing view control adds Transparent (the old glass look), Cutaway (opaque wall and lid with a wedge removed on the camera side) and Exploded (lid, wall with the pin servo, cartridges, drum, platform stack separated along the shaft axis, with group labels; the wall turns to glass so nothing hides behind it). Component labels stay hidden in the assembled view, and entering a rotation or print view switches back to the transparent look. No part was added or changed. `rotation-spec.js` now has a `mounts` table (what each part is attached to and how), checked by `tests/test_feature007_mounts.py` as a graph that must end on the table; the drum load path (cartridge, deck, rod, coupler, stepper, mount plate, base, feet) and the thrust-ring path are asserted. Still open from the inspection: size target, MPU and level sensor, tongue-home microswitch, electronics service hatch.

### Tiers (bottom to top)

| Tier | z (mm) | Contents |
|---|---|---|
| Base | -58 to -52 | 3 levelling feet (M5 bolts) on a ring of radius 58 at 270 / 30 / 150 degrees; base disc radius 69; four 4 mm posts to the stepper-mount plate |
| Electronics bay | -52 to -16 | all boards in two layers (below); stepper (r 14, z -48..-29) on the axle; tongue solenoid at the front |
| Platform tier | -16 to 4 | platform (corner reach 57.4), tongue (z -1.5..0), short pill tray, outlet chute |
| Drum tier | 4 to 46 | drum, four cartridges; pin carriage and rails on the front side |
| Top | 46 to 49 | the four lids and latches: **exposed above the shell rim at z 45** (rim can rise to 48) |

### What moves (the only departures from the canonical mechanism)

| # | Item | Lab layout | Product layout | What stays the same |
|---|---|---|---|---|
| 1 | Pin servo | in line, v -86..-63 (reach 86) | directly above the pin carriage: u +-11.35, v -44..-22, z 32.5..44.7, shaft along u (reach 45) | servo, crank radius 5.2, pin, carriage, stroke 10.4; the crank turns in the vertical plane with a 14 mm link instead of the 34 mm in-plane rod |
| 2 | Tongue solenoid | at the end of a 31.7 mm rod, v -114..-90 (reach 115) | under the tongue front: u +-14.75, v -56..-32, z -34..-13.4 (reach 58); the plunger pulls the tongue through a short vertical hook | solenoid, tongue plate, 11.4 mm stroke, pull direction, return spring |
| 3 | Carriage rails | 32 mm long | 19.5 mm long (v -42..-22.5) | rail section, carriage travel |
| 4 | Scanner housing | x -58.4..-37 | moved 6.4 mm toward the axle (reach 56.4); slot in the wall | housing size, height, read geometry |
| 5 | Pill tray | y -42..8 (50 mm) | v -32..-2 (30 mm) under the chute | floor height, walls |
| 6 | Electronics | side decks, ESP32 out to y 111 | two-layer bay (below); no side decks | the boards themselves |

Unchanged: drum, cartridges, caps, blades, springs, stepper, coupler, rod, thrust ring, bearing, mount plate and columns, platform channel, tongue plate, engagement pin and pin solenoid, controller FSM and timing.

### Electronics bay (greedy packing search, 3 mm spacing, inner radius 64 needed; 66 used for margin)

Layer 1 (on the base plate, z -51, around the stepper): ULN2003 25 x 35 at u -56..-31, v -16..19; boost A 37 x 17 at u 18..35, v -48..-11 (rotated); boost B at u 38..55, v -16..21; TP4056 26 x 17 at u -42..-16, v 24..41; MOSFET A 16 x 24 at u -36..-20, v -48..-24; MOSFET B at u 14..30, v 24..48; level sensor at u -16..-6, v -28..-15.
Layer 2 (a printed shelf at z -27, over the stepper and mount plate, on the four posts): controller board with the ESP32 plugged onto it (28 x 54.4) at u -28..26, v 24..52.
With one layer only, the same boards need inner radius 72 (150 mm across); two layers saves 12 mm of diameter.

### Stability (ASSUMED masses)

Total 530 g (base plate 63 g, shell 141 g, drum + cartridges + caps 120 g, stepper 35 g, boards 75 g, rest 96 g). Centre of mass (-1.2, -4.1, -10.6): 4 mm from the axis and low, 51 mm above the feet. Feet on a ring of radius 58 at 270 / 30 / 150 degrees: margin to the foot-triangle edge 25.9 mm level and 12.3 mm at 15 degrees tilt (spec asks >= 10 mm and inside at 15 degrees); it tips at about 26 degrees. The base can take a steel ballast washer under the electronics if more margin is wanted.

### Support chains (every part carried to the base)

Servo: a cradle from the wall at u +-11 (two 5 mm shelves and a web) carries it above the carriage. Tongue solenoid: a 3 mm cradle from the base posts. Scanner: a 6 x 3 mm wall bracket at the slot. Controller shelf: the four mount posts. Platform: the two mount columns, as built. Everything ends on the base disc.

### Checks that were run

Reach of every moved item stays under the inner radius minus 2 mm (largest: solenoid 57.9, platform 57.4, scanner 56.4, servo 45.4). No overlaps between the moved items and the canonical parts that stay, except deliberate contacts (carriage on its rails). All nine boards place in the bay. Not yet checked: servo-above-carriage link geometry through the full 10.4 mm stroke, the hook path of the solenoid through the platform channel, lid swing clearance above the servo, cable routes, heat, and every manufacturing detail.

### Open questions for the user

1. Are the two mechanism-adjacent changes acceptable (pin servo above the carriage with a short vertical-plane link; tongue solenoid under the tongue with a short hook instead of the long rod)? They are what takes 100 mm off the width.
2. Pill-tray access: the short tray sits in the middle of the tower; a drawer window or a front chute to a cup still has to be chosen.
3. Is about 138 mm across x 110 mm tall acceptable? Two-layer boards allow down to 134 mm (inner radius 64, the packing limit); one layer would need 150 mm.

## Summary

Wrap the machine in one round enclosure about the drum axle (0, 15) by moving only passive and support placements (electronics deck, controller board, supports, enclosure, feet). The mechanism keeps its poses, strokes, timing and demo behaviour. The variant is a separate, selectable viewer layer built on top of the unchanged canonical scene, so the locked files do not change.

## Technical Context

- **Language/Version**: viewer JavaScript (static, offline Three.js r128, no build step); Python 3.13 stdlib for tests; the STL generator is a dev tool (`python3`, numpy, manifold3d).
- **Storage**: files only. Layout numbers go in `docs/visualizer/rotation-spec.js` (new `cyl` block, same source of truth as Feature 005); no canonical file is edited.
- **Testing**: pytest (`.venv/bin/pytest tests/ -q`), reusing `tests/feature005_spec.py` and the clearance tests; browser check in a fresh visible page at desktop and phone viewports.
- **Constraints**: offline `file://`; `demo-controller.js` locked; 52 IDs; no new canonical component; rotating mass <= 150 g and the 006 pad corridor kept; new viewer files must not contain "feature004".
- **Scale**: one new layout variant, three printed sectors, one base, a handful of brackets.

## 1. Reach census (computed from `build_concept_assembly()`, farthest corner from the axle, mm)

| Item | Reach | Note |
|---|---|---|
| tongue-actuator-rod (incl. solenoid body, plunger, strap) | **115.0** | bounds y -99.5..-18.3, x +-10.3 |
| electronics-deck | 114.1 | x 22..60, y -82..58 |
| controller-board-placeholder | 109.2 | x 26..53.9, y -80..-25.6 |
| servo-unit | 86.4 | y -71.2..-48.2, z 16.6..39.3 |
| tongue-return bracket (in station-housing) | 85.0 | y -70..-68, x +-10.4 |
| tongue-return-spring | 83.1 | |
| servo-crank / connecting-rod / rails | 69.7 / 68.3 / 67.3 | |
| barcode scanner housing | 62.3 | x -58.4..-37 |
| outlet tray | 60.4 | |
| drum, cartridges, caps, blades | <= 40 | the rotating part is already round |

## 2. Diameter options (the decision the user must verify)

| Option | What moves | Inner radius | Enclosure (wall 3 mm) | Mechanism change |
|---|---|---|---|---|
| **A** unfolded (spec default Q1 = no) | nothing needs to move: deck corner 114.1 and controller 109.2 already fit inside the 115 mm solenoid reach | 117 | **about 240** | none |
| **B** solenoid re-seated (recommended) | pull-solenoid body moves beside the rod (below); deck and controller trimmed or shifted inside | 105 | **about 216** | solenoid placement only; stroke axis, 11.4 mm stroke and tongue pose unchanged |
| **D** both chains folded with a 90 degree bell crank each | servo and solenoid placed tangentially under or beside the platform | about 78 | **about 170** | adds two small levers; kinematics change (needs approval and its own spec) |

**Option B geometry (ASSUMED, to be verified in tasks).** The solenoid pulls towards -y, so its body must lie on the -y side of the point where it grips the rod. Grip a tab on the rod at y -54 and lay the body (29.5 wide x 23.9 long x 20.6 tall) beside the rod at x 12..41.5, y -79..-55, z -11.05..9.55. That clears the bracket (x <= 10.4), the servo (z >= 16.6), the tray front lip (y -43.5) and the strap. Its farthest corner is 102.8 mm from the axle, so inner radius 105. The canonical model draws the body at the rod end and cannot be edited, so in the variant it is hidden and redrawn (section 5).

**Passive rearrangement under B (items must stay under about 100 mm):**

| Item | Original | Proposed | Reach |
|---|---|---|---|
| Electronics deck (38 x 140) | x 22..60, y -82..58 | x 22..60, y -58..58 (front trimmed 24 mm); canonical deck is hidden and replaced; the old stepper submesh at the axle is not drawn twice | corner (60,-58): 94.5 |
| Controller board (27.9 x 54.4) | x 26..53.9, y -80..-25.6 | same x, shifted +22 mm: y -58..-3.6 | corner (53.9,-58): 90.7 |
| Scanner housing / head / mount | x -58.4..-37, y -6.8..6.8 | unchanged | 62.3 |
| Outlet tray | y -42..8 | unchanged; window in the shell at -90 degrees | 60.4 |
| Servo, crank, rod, carriage, rails | canonical | unchanged | 86.4 max |
| Return bracket | y -70..-68 | unchanged | 85.0 |

Under A the passive items already fit, so the only difference from the rejected 242 mm attempt is the diameter (240 vs 242) and the added supports.

## 3. Support chains (every part must trace to the base)

| Part | Carried by | Rework of the first attempt |
|---|---|---|
| Servo unit (9 g assumed) | two shelves (x 4.5..8 and -8..-4.5, z 14.5..16.5) from the front wall plus a 3 mm web (z 6..14.5) | lengthen shelves to the wall (y = 15 - 105 = -90 under B), widen to 5 mm, add a second web at x +-4.5; 33 mm cantilever to check (R6) |
| Tongue-return bracket (canonical, y -70..-68) | two lugs z -17..-13 from the front wall | keep; add a 2 mm bottom plate (x +-10.4, y -90..-68, z -17..-15) |
| Solenoid (B) | 3 mm cradle on a rib from the front wall at x 12..41.5 | new, ASSUMED |
| Electronics deck and controller | four 4 x 4 posts from the base (z -52..-3.0), plus a 4 mm radial ring ledge on the wall (z -4..-2) | trimmed deck needs posts at (25,-55), (57,-55), (25,55), (57,55) |
| Scanner mount (canonical, x -45.5..-41.5, z -1.7..25.4) | wall bracket at the scanner slot, 6 x 3 mm, from the left sector wall | new |
| Housing platform | two 4 mm columns to the stepper-mount plate (Feature 005) | unchanged |
| Stepper mount plate | four 4 x 4 x 23 mm posts, M3 x 10 | unchanged, as built |

## 4. Stability (ASSUMED masses, 3 feet at r 95 mm 120 degrees apart, inscribed radius 47.5 mm)

| | A (240) | B (216) |
|---|---|---|
| Total mass | 740 g | 654 g |
| Centre of mass offset from the axle | 7.9 mm | 8.7 mm |
| Centre of mass height above the base underside | 44.9 mm | 47.5 mm |
| Margin to the foot-triangle edge, level | 39.6 mm | 38.8 mm |
| Margin at 15 degrees tilt (worst direction, +3.5 mm foot height) | 26.7 mm | 25.1 mm |

The spec requires >= 10 mm margin level and still inside at 15 degrees: met with room on both. Mass inputs (g): drum + cartridges + caps 120, platform 22, stepper 35, mount 4, tray 6, servo 9, carriage + rails + rod 10, tongue + rod + spring 6, scanner 15, controller + deck 45, solenoid 25, base plate 142-193 (30 % infill), shell 214-250. The shell and base dominate; the numbers are placeholders until a real print is weighed.

## 5. Viewer integration (how the variant stays separate)

- **Layer**: after the canonical scene is built, `reference-look.js` adds a `Cylindrical layout` group (as it already adds the Feature 005 parts). When the variant is on it sets `visible=false` on the canonical `electronics-deck`, `controller-board-placeholder` and (B) the solenoid body, and draws replacements. `concept-data.js`, `concept_geometry.json` and `demo-controller.js` are not edited; `tests/test_feature005_boundaries.py` stays green.
- **Selection (Q3 default)**: a `Layout` radio pair "Original" / "Cylindrical" in Systems; the first-attempt base, shell and bolts move behind "Cylindrical" (today they always show). The camera never changes on switch.
- **Labels and print jobs**: reuse `Levelling base`, `M5 levelling bolts`, `Cylindrical shell`; the servo and solenoid cradles are pieces of the shell job (no new job IDs). Downloads follow the selected layout.
- **STL**: `scripts/export_print_files.py` builds the base and three sectors from the new `cyl` block; base diameter = 2 x outer radius (A 240+, B 216). B fits a 220 mm bed only barely; A needs about 250 mm or a split.
- **Joints (designed here, ASSUMED)**: sector-to-sector: each sector end carries an inside flange 8 mm radial x 4 mm thick x full height with three M3 clearance holes (z -40, 0, 40); neighbouring flanges butt face to face, clamped by M3 x 16 screws with a nut trap on one side. Wall-to-base: the wall stands in a 3.4 mm wide x 4 mm deep circular groove in the base and is held by six M3 x 8 self-tapping screws from below into 6 mm bosses inside the wall.
- **Stiffness**: one 4 x 4 mm horizontal ring rib inside each sector at z -4 and z 40; windows keep 6 mm of wall each side.

## 6. Mechanism-invariance verification

1. All existing tests stay green unchanged (`tests/unit/test_viz3d_*.py`, `test_feature003_*`, `test_feature005_*`), including the locked-file hashes and the 52-ID checks.
2. New `tests/test_feature007_layout.py` (stdlib only): load `build_concept_assembly()` and the variant block; assert every mechanism component (drum, cartridges, caps, blades, springs, servo, crank, rod, carriage, rails, pin, tongue, tongue spring, bracket, scanner) has the same world position and rotation as canonical within 0.01 mm / 0.01 degrees in both layouts; for B only the solenoid body differs, and its stroke axis and 11.4 mm stroke are checked.
3. Reach test: every non-mechanism item and every moving part, in every demo state, stays inside the inner radius minus 2 mm.
4. Support test: every listed part has a named support whose chain ends at the base; centre of mass inside the foot triangle (level and 15 degrees).
5. Clearance: reuse the Feature 005 sweep harness for the new items against the drum sweep; zero new overlaps.
6. Print: closed solids, bed size and overhang report in the manifest (existing tests extended).

## 7. Risk register

| ID | Risk | Plan |
|---|---|---|
| R1 | The straight tongue/solenoid chain alone sets 115 mm reach, so 205 mm is unreachable with Q1 = no | decide A / B / D; plan recommends B |
| R2 | Re-seating the solenoid (B) changes how the plunger grips the rod (tab/yoke) | keep stroke axis and stroke; flag as the only mechanism-adjacent change; verify tab strength |
| R3 | 3 mm curved wall, 97 mm tall, may wobble or split along layers | ring ribs, brim, PETG, coupon |
| R4 | Bridges at the tray window (about 52 mm) and the scanner slot (about 33 mm) | arched window tops or supports (listed in the manifest) |
| R5 | Base needs a 216-242 mm bed | B fits 220+ beds; A needs a split that is not designed |
| R6 | Servo shelf cantilever about 33 mm | second web, widened shelves, rigidity check |
| R7 | Deck/controller fixing only rests on posts | add M3 screws and bosses in tasks |
| R8 | Shell and base dominate mass (about 350-440 g) | accept; reduce infill after a first print |
| R9 | Hiding canonical items in the viewer must not leak into the 3MF/canonical export | hide-only viewer layer; export untouched; test it |
| R10 | Constitution gates | see below |

## Constitution Check

- **I. Single-Dose Integrity**: not affected; the core simulation is untouched. Completion remains ERROR / BLOCKED; no waiver claimed.
- **II. Simulation-First, Hardware-Faithful**: layout and reach numbers come from the canonical assembly; assumptions are labelled.
- **III. Testability**: section 6 defines automated checks before any viewer work; the browser check uses a fresh visible page.
- **IV. Simplicity**: variant layer only; option B changes one placement; D is deferred.
- **V. Portability**: offline static files; no network.
- **Gate result**: no failures. **Complexity tracking**: one extra layer (the viewer variant) is justified because the locked canonical data cannot be edited.

## Decisions the user must verify

See "Open questions for the user" in Revision 3: the two mechanism-adjacent moves (pin servo above the carriage, tongue solenoid under the tongue), how the user reaches the pill tray, and the 138 x 110 mm size. Q3 (selectable beside the original layout) is still assumed. The older options A / B / D and the offset cylinder are superseded.
