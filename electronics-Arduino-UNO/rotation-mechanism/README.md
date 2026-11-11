# Rotation mechanism (Arduino Uno)

Arduino Uno sketch for turning the drum: home search with the Hall sensor, then moves to a colour station.
Same logic as [`../../electronics-ESP32/rotation-mechanism/`](../../electronics-ESP32/rotation-mechanism/). Concept code, not tested on a board.

## Files

| File | Job |
| --- | --- |
| `rotation-mechanism.ino` | The test program: serial commands `home`, `index <colour>`, `status`, `recover` |
| `rotation.h/.cpp`, `colors.h/.cpp` | The rotation logic (no Arduino code, so it also runs in the laptop tests) |
| `uln2003_stepper.h` | Drives the 28BYJ-48 through the ULN2003 and reads the Hall sensor |
| `config.h` | Pins (8-11 stepper, 2 Hall) |
| `test/` | Laptop tests with a fake drum |

## Use

Open `rotation-mechanism.ino` in the Arduino IDE, board Arduino Uno, upload, serial monitor 115200. Type `home` first,
then `index blue`, `index green` and so on.

## Test on a laptop

```bash
cd electronics-Arduino-UNO/rotation-mechanism/test
make     # runs 162 checks, then syntax-checks the .ino against a fake Arduino.h
```
