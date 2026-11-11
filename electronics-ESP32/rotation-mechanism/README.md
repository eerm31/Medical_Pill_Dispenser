# Rotation mechanism

ESP32-S3 firmware that turns the drum: a home search against the Hall sensor, then indexing to the four colour stations.
Concept code, ASSUMED / NOT_VALIDATED: it has not run on hardware, and it makes no clinical or dosing claim.
Port of `docs/visualizer/rotation-controller.js`.

## What it does

- **Home:** turns counter-clockwise until the A3144 Hall sensor sees the magnet (a rising edge), then moves 3.66 degrees on. That is the RED station, step 0. If the sensor is already on the magnet it first leaves it. If no edge shows up within 125 % of a turn it stops with a fault.
- **Index:** moves to RED, BLUE, GREEN or ORANGE (a quarter turn apart). The shortest way round, but the last move is always counter-clockwise: a clockwise move goes 3 degrees past and comes back, so gear lash never changes where it stops.
- **Interlock:** a callback can forbid turning (the scheduling system uses it while a dose is being dispensed).
- **Motion:** step based and non-blocking. `update(micros())` issues at most one half-step per call, with a speed ramp (4 ms down to 1.5 ms per step). Coils are released when idle.

## Layout

```text
firmware/
  core/    portable C++11, no Arduino: colors.h/.cpp, rotation.h/.cpp
  hw/      Arduino only: uln2003_stepper.h (stepper + Hall sensor)
  config.h pin plan and constants (matches docs/visualizer/wiring-spec.js)
  main.cpp serial console: home, index <colour>, status, recover
test/      host tests, a fake drum (fake_drive.h) and an Arduino stub for the syntax check
library.json, platformio.ini
```

## Test on a laptop

```bash
cd electronics-ESP32/rotation-mechanism/test
make     # runs 162 checks, then syntax-checks main.cpp against an Arduino stub
```

## Build for the board

```bash
pio run && pio run -t upload && pio device monitor   # 115200 baud, type "help"
```

`library.json` also lets `scheduling-system/` use this folder as a library.

## Pins (ASSUMED, check against your module)

| Signal | GPIO | Note |
| --- | --- | --- |
| STEP_IN1..4 (ULN2003 IN1..IN4) | 4, 5, 6, 7 | from `wiring-spec.js` |
| HALL_HOME (A3144, LOW at the magnet) | 1 | external 10 k pull-up to 3V3 |

## Not done

- Stepper speed, ramp, home offset (3.66 degrees) and overshoot (3 degrees) are values carried over from the simulation, not measured.
- A missed index (the drum stops off-station) is not detected: the simulation injects it, the hardware has only the one Hall sensor at home.
- `pio run` has not been run (PlatformIO is not installed here).
