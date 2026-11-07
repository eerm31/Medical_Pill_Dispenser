# Feature 011: Ring actuator, four solenoid pins (Prototype 2)

Status: concept design, ASSUMED / NOT_VALIDATED. Not print-ready. Nothing here is hardware evidence.

## Why

The first Prototype 2 actuator (one sliding pin carriage, servos S1 and S2, three cables, two sheaves, a wedge and a spring) worked on paper but had about twenty parts for two small motions. This version removes the sliding and the cables.

## Design

One arm under the deck carries **four fixed pins, one under each ring**. Each pin is the plunger of its own micro pull solenoid. The stepper (the existing drive on the central D-flat rod) swings the arm; nothing else moves except the selected pin.

| Part | Dimensions (mm) | Notes |
| --- | --- | --- |
| Arm base plate | x 7..42, lateral +-3.5, z -9.6..-9.0 | Clears the coupler (r 7). Was 13 mm wide, now 7 mm |
| Pin solenoid x 4 | body dia 5, z -9.0..-0.2, stroke 2.6 (3 assumed available) | At ring radii 11.4, 20.4, 29.4, 38.4. 4 mm gap between bodies |
| Engagement pin | 0.7 mm needle on the plunger | Tip z 2.0 retracted (under the floor, z 3.4), z 4.6 engaged |
| Sockets | printed rings, wall 0.8 | Hold each body to the plate |
| Flex cable | 5 wires (common + 4) | Board on the tray to a clamp at the arm hub; bends as the arm turns |
| Solenoid driver board | ULN2003 breakout, 20 x 14 mm, on the tray at (-6, 29.5) | Built-in flyback diodes; 4 ESP32 pins |

Selecting a ring means firing that ring's solenoid. The other three pins stay below the floor.

## Ring lock: spring-plunger detent

The lock pads that had to be lifted are gone. Each ring rim has 12 shallow dimples (one per pocket, every 30 degrees). A ball-nose spring plunger (M3, about 6-10 mm, light spring) is screwed through the lock bracket at +90 degrees and presses on the rim top. It holds the ring at every pocket and clicks over when the pin pushes. Nothing is powered or lifted. The ring is symmetric about its axis, so shock and tilt put almost no torque on it. Estimate (to be tested): the 28BYJ-48 gives about 30 mN.m, i.e. about 34 mN.m on ring 4 at the pin (38.4 mm); a detent holding 0.25-0.5 N at the rim (46 mm) resists 12-23 mN.m.

## Cautions

- **Heat:** a small coil overheats if held on. Pull in at full power, then hold with PWM (about 30%).
- **Hall sensor:** check that an energised solenoid does not disturb the A3144 home sensor.
- **Flex cable:** wire flexes every cycle; use fine flexible wire.
- **Part:** no specific solenoid confirmed. Search for a 5 V push-pull solenoid, about 5 mm diameter, 3 mm stroke, body 9 mm or shorter.

## Wiring window (not changed)

Feature 008's wiring window still shows servos S1 and S2. In Prototype 2 the viewer places their harness ends at the driver board. A later feature should replace them with the four solenoid channels. Pin plan: 4 ESP32 GPIOs to the board inputs, common to 5 V.

## Known gaps

- Solenoid force, heat and stroke are not checked against a real part.
- Detent force, dimple depth and plunger size need a test print and a push test; the torque numbers above are estimates.

## Acceptance

- Locking rod view: camera frames the arm and board, everything else ghosts to 2%, a 6-step animation (overview, swing arm to the slot, solenoid pulls the pin up in a side close-up, arm pushes the ring one pocket with a close-up of the plunger clicking, pin drops and arm swings back, reverse stroke sets the ring back). Blue is preselected because red is the home ring. The Ring support animation also flies to the plunger.
- `tests/test_feature011_linkage.py` passes: pin stroke, ring pitch, coupler and shell clearance, board clear of the stepper, no servos or cables.
- Show bearings highlights the 1 mm balls in yellow at true size.
