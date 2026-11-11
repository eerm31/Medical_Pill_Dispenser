# Scheduling system (Arduino Uno)

Arduino Uno sketch for the dose schedule. At a scheduled time the stepper turns the single cartridge 30 degrees for every
pill of the dose, with a short pause after each move. Same logic as [`../../electronics-ESP32/scheduling-system/`](../../electronics-ESP32/scheduling-system/).
Concept code, not tested on a board, no medical use.

## Put the schedule in

Use the UI System (`../scheduler-ui/index.html`): add the medications (name, time, pills) to the table and press **Save schedule**. The
sketch keeps the schedule and the turn settings in the Uno's memory (EEPROM) and loads them at every start, so there is
no new upload to change the times.

`my_schedule.h` holds the defaults the sketch uses when nothing is saved yet (look for `PUT SCHEDULE INPUT HERE`): one line
per dose with a colour, a time and a number of pills (1 to 5), `START_TIME`, and the turn settings (`DEGREES_PER_PILL`,
`PAUSE_MS_AFTER_MOVE`, `STEP_INTERVAL_US`, `TURN_DIRECTION`).

## Files

| File | Job |
| --- | --- |
| `scheduling-system.ino` | The program: loads the saved schedule, runs the clock, turns the cartridge. Serial commands `time`, `add`, `rm`, `clear`, `save`, `set`, `list`, `step`, `stop` (the UI System sends these) |
| `my_schedule.h` | The default schedule, start time and turn settings |
| `eeprom_store.h` | Keeps the schedule and settings in the Uno's memory |
| `cartridge_turn.h/.cpp` | Turns the cartridge 30 degrees per pill with a pause after each move |
| `schedule.h/.cpp` | Clock, up to 8 doses with pills, DUE / TAKING / TAKEN / MISSED, 30 min grace, midnight reset |
| `auto_rotate.h/.cpp`, `rotation.h/.cpp`, `colors.h/.cpp` | Drum positioning and homing for a build with a Hall sensor. Built with the sketch but not used by it yet |
| `uln2003_stepper.h`, `config.h` | Stepper driver and pins (8-11 stepper, 2 Hall) |
| `test/` | Laptop tests (they use the fake drum of `../rotation-mechanism/test`) |

## Use

Open `scheduling-system.ino` in the Arduino IDE, board Arduino Uno, upload, serial monitor 115200. Type `step` to test
the motor and its direction first (one 30 degree move), then wait for the doses.

## Test on a laptop

```bash
cd electronics-Arduino-UNO/scheduling-system/test
make     # runs 191 checks, then syntax-checks the .ino against a fake Arduino.h
```

## Not done

- **Real-time clock:** the clock restarts at `START_TIME` on every reset or power-up until the UI System sets it (it does when you press Save schedule).
- **Pill check:** nothing can tell that a pill came out, so every dose counts as taken.
