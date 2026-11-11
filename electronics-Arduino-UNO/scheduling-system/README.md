# Scheduling system (Arduino Uno)

Arduino Uno sketch for the dose schedule. At a scheduled time the stepper spins the single cartridge for a few seconds
per pill. Same logic as [`../../electronics-ESP32/scheduling-system/`](../../electronics-ESP32/scheduling-system/).
Concept code, not tested on a board, no medical use.

## Put the schedule in the code

Edit `my_schedule.h` (look for `PUT SCHEDULE INPUT HERE`): one line per dose with a colour, a time and a number of pills
(1 to 5). Also set `START_TIME`, because there is no real-time clock yet, and the spin settings
(`SPIN_MS_PER_PILL`, `STEP_INTERVAL_US`, `SPIN_DIRECTION`).

## Files

| File | Job |
| --- | --- |
| `scheduling-system.ino` | The program: loads the schedule, runs the clock, spins the cartridge. Serial commands `time`, `add`, `rm`, `list`, `spin`, `stop` |
| `my_schedule.h` | The schedule, start time and spin settings (edit this) |
| `schedule.h/.cpp` | Clock, up to 8 doses with pills, DUE / TAKING / TAKEN / MISSED, 30 min grace, midnight reset |
| `auto_rotate.h/.cpp`, `rotation.h/.cpp`, `colors.h/.cpp` | Drum positioning and homing for a build with a Hall sensor. Built with the sketch but not used by it yet |
| `uln2003_stepper.h`, `config.h` | Stepper driver and pins (8-11 stepper, 2 Hall) |
| `test/` | Laptop tests (they use the fake drum of `../rotation-mechanism/test`) |

## Use

Open `scheduling-system.ino` in the Arduino IDE, board Arduino Uno, upload, serial monitor 115200. Type `spin` to test
the motor and its direction first, then wait for the doses.

## Test on a laptop

```bash
cd electronics-Arduino-UNO/scheduling-system/test
make     # runs 130 checks, then syntax-checks the .ino against a fake Arduino.h
```

## Not done

- **Real-time clock:** the clock restarts at `START_TIME` on every reset.
- **Saved schedule:** nothing is stored in EEPROM, so the schedule comes from `my_schedule.h` each time.
- **Pill check:** nothing can tell that a pill came out, so every dose counts as taken.
