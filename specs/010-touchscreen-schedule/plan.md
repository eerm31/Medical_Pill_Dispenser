# Implementation Plan: Touchscreen, Status LED and Dose Schedule (Subsystem 4)

**Branch**: `010-touchscreen-schedule` (spec directory only) | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

## Summary

Move the barcode reader onto the shell, add a 2.4 in touchscreen pod and an RGB status LED bar on the shell front,
and model a dose schedule (simulated clock, entries, DUE, TAKE) in the offline viewer. A small pure JavaScript schedule
controller holds the state; the 3D screen is a canvas texture redrawn from it; the panel provides the touch inputs.
ASSUMED / NOT_VALIDATED.

## Technical Context

- **Language/Runtime**: browser JavaScript (ES5 style), Three.js r128 vendored, `file://`, no CDN.
- **New files**: `docs/visualizer/schedule-controller.js`; `housing-modules.js` and `subsystem-ui.js` are shared with Feature 009.
- **Edited files**: `reference-look.js` (reader arm and saddle, pod hooks, housing flags), `rotation-spec.js`
  (`scanner_dx` -48 → -29), `app.js` (`SCAN_DX` -29, the demo's package path moves with it), `index.html`, `ui-polish.css`.
- **Not edited**: `demo-controller.js` (locked, sha1 0c8396023ca6fc85cb135fbbf58ea39e903cee11).
- **Tests**: `tests/test_feature010_schedule.py` and the updated Feature 007 support test. Behaviour is checked in a foreground
  browser; unit tests alone do not prove WebGL behaviour.

## Constitution Check

| Gate | Result |
|---|---|
| I. Single-dose integrity | A dose starts only from a tap and only through the existing `requestDispense()`; completion stays ERROR / BLOCKED, not waived. |
| II. Simulation-first | The pod, arm and saddle numbers come from the shell spec; the display module size is the real module size. |
| III. Testability | No randomness; the clock is explicit. Source tests plus a browser check. |
| IV. Simplicity | One controller, no library, no storage. |
| V. Portability | Adds about 17 mm to the front radius at the pod edge and a 2.4 in display; draw is ASSUMED (backlight ~60 mA, not measured). |

## Design

### Reader on the housing

- Local scanner coordinates (the group is shifted by `scanner_dx` = -29 mm): arm x -58.4..-18.5, y ±4, z 21..24 under the reader
  box (z 24..35.8); saddle x -21..-17, y ±9, z 17..28. Absolute arm end x = -47.5 mm, inside the wall (inner radius 48 mm).
- The old foot plate and column are removed; the back stop shrinks to z 24..28. The package stage and the demo's package path
  keep their relative geometry and shift with `SCAN_DX`.
- Both parts count as printed in one piece with the left shell sector (the reader sits at about 198 degrees, inside sector 180..300).

### Display pod (axes: the pod frame has x radial at 255 degrees, z up)

- Boss section: back arc r = 50 mm, flat face at r = 55 mm, 66 mm wide; height z = -17..37 mm. Printed in sector 3 (180..300 degrees,
  the pod spans about 214..296 degrees, 4 degrees clear of the 300 degree joint and 7 degrees clear of the reader arm and saddle at 187..207 degrees).
- Module: PCB 60.3 x 42.7 mm at r = 54.2..56.0, glass r = 56.0..56.4, active area 49.0 x 36.7 mm; z = -9..33.7 mm.
- LED bar 36 x 3 x 1.7 mm at z = -14.5..-11.5 mm.
- Housing modes: the pod is registered as a wall part (glass / solid / exploded with the wall); the module and LED carry `onHousing` and hide
  with the housing.

### Screen content (320 x 240 canvas)

Clock, play state, status dot, next or due dose with a TAKE button, up to four schedule rows with status, four ring-level chips.

### Schedule logic (`schedule-controller.js`)

- Clock seconds of the day; `advance(min)`, `tick(dt)` (1 simulated minute per real second while playing), `setClock`.
- Entries: add (colour, HH:MM), validate, unique, max 8, remove; statuses PENDING → DUE → (TAKING → TAKEN / FAILED) or MISSED after 30 min;
  midnight resets; entries past by more than 30 min count for tomorrow.
- `beginTake` / `abortTake` / `finishTake(id, verdict)`; only VERIFIED gives TAKEN.

### LED rules

Red 8 s after an unverified dispense; red steady while a dose is MISSED or FAILED and none is due; amber pulsing while DUE or TAKING;
green 5 s after a verified dispense; dim teal when idle.

### ASSUMED pin plan (ESP32-S3 mini; not wired in the viewer's wiring window)

| Signal | GPIO | Note |
|---|---|---|
| TFT_SCK / MOSI / MISO | 36 / 35 / 37 | SPI bus shared with the touch controller |
| TFT_CS / DC / RST | 47 / 48 / 42 | display |
| TOUCH_CS / IRQ | 33 / 34 | XPT2046 |
| TFT_BL | 2 | backlight through a transistor |
| STATUS_LED | 43 | one addressable RGB LED, 5 V data level shifted |

A battery-backed RTC (I2C) is needed for real use; its pins are not assigned here (R5). These pins MUST be checked against the module's
reserved pins before any build.

## Risks

- **R1**: the pod is thick at its edges (17.5 mm); a flatter pod would need a smaller module or a flat panel.
- **R2**: the sector 3 print gets a large boss and a long overhang above z = 34 mm (the shoulder); support or a split is not designed.
- **R3**: with the reader at 198 degrees on sector 3, the sector carries both the pod and the arm; a joint rework may be needed.
- **R4**: the demo's package path moved 19 mm closer to the wall with `scanner_dx`; its clearance to the wall was not measured in the viewer.
- **R5**: no RTC pins are assigned; the free pins must be reviewed together with Feature 006's reserved pins.

## Project Structure

```text
specs/010-touchscreen-schedule/  spec.md  plan.md  tasks.md
docs/visualizer/  schedule-controller.js  housing-modules.js  subsystem-ui.js
tests/test_feature010_schedule.py
```
