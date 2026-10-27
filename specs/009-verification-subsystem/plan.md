# Implementation Plan: Verification Subsystem (Subsystem 3)

**Branch**: `009-verification-subsystem` (spec directory only) | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

## Summary

Three checks (a dispense saw exactly one pill, a ring is EMPTY / PARTIAL / FULL, a ring can store the SAME pill) from
reflective IR level sensors and an exit break-beam. A pure JavaScript state machine reads the demo controller's
snapshot; the viewer draws the sensors and a panel shows the result. ASSUMED / NOT_VALIDATED.

## Technical Context

- **Language/Runtime**: plain browser JavaScript (ES5 style, like the rest of `docs/visualizer/`), Three.js r128
  vendored, opens from `file://`, no CDN, no npm.
- **New files**: `docs/visualizer/verification-controller.js` (logic), `docs/visualizer/housing-modules.js` (3D parts, shared
  with Feature 010), `docs/visualizer/subsystem-ui.js` (panel, shared with Feature 010).
- **Edited files**: `ring-magazine.js` (adds `queuePocket`, `sense`, `capacity`, `addLabel`), `reference-look.js` (builds the
  modules), `ring-ui.js` (storage check on the add-pill buttons), `index.html`, `ui-polish.css`.
- **Not edited**: `demo-controller.js` (locked, sha1 0c8396023ca6fc85cb135fbbf58ea39e903cee11), `concept-data.js`.
- **Testing**: Python tests read the sources and the spec (no Node here); the behaviour is checked in a foreground
  browser. Unit tests alone do not prove WebGL behaviour.
- **Constraints**: deterministic, no `Math.random`, no network, no new Python dependency.

## Constitution Check

| Gate | Result |
|---|---|
| I. Single-dose integrity | Reports one-pill outcomes; changes nothing; completion stays ERROR / BLOCKED, not waived. |
| II. Simulation-first, hardware-faithful | Sensor positions come from the ring geometry; the optical path through the 6.7 mm deck is flagged as unvalidated (R1). |
| III. Testability | Source tests (no randomness, ids, order) plus a documented browser check; seeds not needed (no randomness). |
| IV. Simplicity | One small controller, no library. |
| V. Portability | 9 small sensors, no battery change assumed; ASSUMED < 1 mA each, not measured. |

## Design

### Sensors (ring-local mm: x radial, lateral = depth from the axle, z up; floor top z = 3.7)

- **Level sensors**: ring k, queue pocket u in {1, 5}: radius `rc[k]` = 15.1, 24.1, 33.1, 42.1 mm, angle
  `thL[k] - (u - 0.5) * 30°` where `thL[k] = asin(-8 / rc[k])` (front edge of the exit slot). The window is a 3 mm disc on the
  floor; the module (5 x 3.5 x 6 mm) hangs under the deck at z = -6.5..-3. Eight in total.
- **Break-beam**: emitter and receiver, 3 x 3 x 2.5 mm, on the outside of the two funnel walls at x = 44 mm,
  z = funnel floor + 6 mm (about -11.4 mm); the beam is 0.6 mm across and about 14 mm long.
- **Clearances (computed from the spec, checked by a test)**: the sensors lie at 193..334 degrees, at least 48 degrees from
  the arm park and sweep (61..145 degrees); their centres are at least 26 mm from the platform posts; the nearest module edge is 0.72 mm
  from the servo cable hole in the deck (x -38..-26, y -9.4..-1.4), the ring 1 FULL sensor (R4).

### Logic (`verification-controller.js`)

- `observe(snapshot, now)`: per colour, count, READY, FULL (sensor callback, or count for Prototype 1), level, free = 5 - count.
- Disagreement flag: only when the mechanism and refill tasks are idle, after 400 ms.
- Dispense run: starts when `operation === 'dispense'`; counts increments of `trayCount` (the break-beam); ends when the
  operation ends; verdict VERIFIED / NO_PILL / MULTIPLE / COUNT_MISMATCH.
- `canDispense(colour)` refuses EMPTY, removed, busy. `canStore(colour)` refuses FULL, removed, flagged.
- No randomness; `now` is passed in.

### Panel and 3D

- Section `Subsystem 3 · Verification`: four ring rows (level badge, READY/FULL dots, count, free pockets, can-store reason),
  beam badge, last verdict.
- Systems switch `Subsystem 3: Verification sensors`; labels `IR level sensor` and `Exit break-beam` in the Ring magazine view.

### ASSUMED pin plan (ESP32-S3 mini; not wired in the viewer's wiring window)

| Signal | GPIO | Note |
|---|---|---|
| BEAM_RX | 11 | receiver output, pull-up; emitter on 3V3 through 100 Ω |
| READY_R / B / G / O | 12, 13, 14, 21 | digital out of each reflective module |
| FULL_R / B / G / O | 38, 39, 40, 41 | same |

GPIO 8-10 stay reserved for Feature 006. The pins must be checked against the chosen module's reserved pins before any build.

## Risks

- **R1**: reflective IR may not read a standing pill through a 6.7 mm deck and a 0.3 mm window. Mitigation: bench test one
  sensor; fall back to a 3 mm light shaft with a lens or to a through-beam across the pocket.
- **R2**: the exit beam may miss a small pill that slides along a wall. Mitigation: a second beam 3 mm higher (not designed).
- **R3**: the deck print files do not contain the sensor shafts; they are listed for the exporter (not done).
- **R4**: the ring 1 FULL sensor module is only 0.72 mm from the servo cable hole; a real build would move it or the hole.

## Project Structure

```text
specs/009-verification-subsystem/  spec.md  plan.md  tasks.md
docs/visualizer/  verification-controller.js  housing-modules.js  subsystem-ui.js
tests/test_feature009_verification.py
```
