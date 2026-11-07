# Feature 011: Ring actuator linkage (Prototype 2)

Status: concept design, ASSUMED / NOT_VALIDATED. Not print-ready. Nothing here is hardware evidence.

## Why

Prototype 2 animated a pin that slides along an arm and rises through the pocket floor, but the linkage that
does it was not designed. This feature fixes that for the two motions the arm needs:

1. **S1: carriage travel.** The pin carriage moves 27 mm along the arm (ring 1 at r = 11.4 to ring 4 at r = 38.4).
2. **S2: pin lift.** The pin rises 2.6 mm (tip z 2.0 to 4.6) through the arc slot and returns.

## Design

Both servos stand on the tray, each with a cable spool on the horn. The cables are Bowden (push-pull) cables.
Their sheaths end at stops on the hub end of the arm, so the arm can turn without dragging the servos.

| Part | Dimensions (mm) | Notes |
| --- | --- | --- |
| Arm base plate | x 7..45.5, lateral +-6.6, z -9.6..-9.0 | Rails (lateral +-1.5..3) carry the carriage |
| Hub sleeve | r 7.1..9, z -12.5..-9.6 | Lowered from z -5.5 so the carriage clears it. Coupler (r 7) clears the carriage by 0.4 |
| Carriage | x -4.0..+5.5 around the pin, lateral +-4.5, z -8.2..+2.2 | Top plate sits 1.2 under the pocket floor (z 3.4) |
| Wedge slider | 5 mm long, ramp 3.0 mm run, 2.6 mm rise (41 deg) | Slides 3 mm inside the carriage. Ramp rises toward the hub |
| Engagement pin | 0.7 mm dia, 6.6 mm long, collar at 1.3..1.8 | Foot rests on the ramp, tip passes through the carriage top plate |
| Pin return spring | coil, free 4.0 mm | Pushes the pin down; the ramp then pushes the slider back, so S2 needs a pull-only cable |
| Cable B (S1, inward) | straight, lateral +5.0, z -8.4 | Stop at x 8.9, tab on the carriage |
| Cable A (S1, outward) | out along lateral -5.8, around a tip sheave (r 1.5 at x 43.5), back to the carriage tab | Pulling it moves the carriage outward 1:1 |
| Cable C (S2, lift) | out along lateral +5.8, around a second sheave, back to the slider tab | The tab sticks out of the open side of the carriage |
| Spools | S1 r 9.0 (27 mm = 172 deg), S2 r 9.8 (30 mm = 175 deg) | A and B wind opposite ways on the S1 spool |

### Firmware rule (not in the demo controller)

Cable C ends on the slider, which rides on the carriage. When the carriage moves by d, the cable C return leg
changes length by d. So **S2 must follow S1**: command the S2 spool to (carriage position + 3 mm x pin). The locked demo controller does
not do this; the viewer applies the rule in `applyArm()` so the animation matches the design.

## Fits the existing spec

- Arm sweep: widest part is the arm base plate (6.6 mm half-width). Gap to the platform posts stays above the 15 deg park margin (test updated).
- Servo positions and the wiring window are unchanged (S1 at -12, 29; S2 at 20, 29).
- Spool top (z -10.1) stays 0.5 mm under the arm underside (z -9.6).
- Features 001-010, `demo-controller.js` and the 52 component IDs are untouched.

## Known gaps (still open)

- **Ring lock pad lift** is still animated only: a pad lifts when its ring is selected, but no lifting mechanism is designed.
- Cable stiffness, wire diameter (0.5 mm assumed), sheave bend radius and friction were not checked.
- The wedge ramp at 41 deg relies on the return spring for back-driving; friction not measured.
- Printed sheaves and 0.4 mm rails need a tolerance test print.
- Sheath stops at the servo end are not drawn.

## Acceptance

- Locking rod and Ring magazine views show the carriage, wedge, spring, three cables, two sheaves and both spools; spools turn as the carriage moves.
- `tests/test_feature011_linkage.py` passes: lift, clearances, cable lengths, spool angles.
- The Show bearings toggle highlights the 1 mm balls in yellow at their true size.
