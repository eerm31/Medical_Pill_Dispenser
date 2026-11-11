# Electronics - Arduino UNO

The same two systems as [`../electronics-ESP32/`](../electronics-ESP32/), written for an Arduino Uno (ATmega328P) and
opened with the Arduino IDE. Concept code that has not run on a board yet.

| Folder | What it is |
| --- | --- |
| [`rotation-mechanism/`](rotation-mechanism/) | Drum rotation: home search against the Hall sensor, indexing to a colour station, stepper driver |
| [`scheduling-system/`](scheduling-system/) | Dose schedule (with pills per dose) and the cartridge spin at the scheduled time. Also holds the rotation code and the auto-rotate state machine |

## How to upload

1. Install the Arduino IDE.
2. Open `rotation-mechanism/rotation-mechanism.ino` or `scheduling-system/scheduling-system.ino`. The other files in that
   folder open as tabs and are built together with it.
3. Tools > Board > Arduino Uno, pick the USB port, press Upload.
4. Tools > Serial Monitor, 115200 baud, line ending "Newline", type `help`.

Keep every file of a folder together. An Arduino sketch must have the same name as its folder.

## Wiring (change `config.h` if yours is different)

| Uno pin | Goes to |
| --- | --- |
| 8, 9, 10, 11 | ULN2003 IN1, IN2, IN3, IN4 |
| 2 | A3144 Hall sensor output (the Uno's own pull-up is used) |
| 5 V, GND | ULN2003 power, Hall sensor power |

Pins 0 and 1 are the USB serial port and are not used.

## What is different from the ESP32 code

- **Same core:** `colors`, `rotation`, `schedule` and `auto_rotate` are identical to the ESP32 files except that the
  include lines have no `core/` folder (an Arduino sketch folder is flat). `tests/test_electronics_scheduling.py` checks this.
- **Pins and Hall sensor:** Uno pins in `config.h`, and the Hall input uses `INPUT_PULLUP`.
- **Printing:** the Uno's `Serial` has no `printf`, so the sketches use `Serial.print` and `F("text")` to keep the 2 KB of RAM free.
- **Number sizes:** an `int` on the Uno is 16 bit, so the sums that can pass 32767 use `long` or `uint32_t`.

## Test on a laptop

```bash
cd electronics-Arduino-UNO/rotation-mechanism/test && make    # 162 checks, then syntax-checks the .ino
cd electronics-Arduino-UNO/scheduling-system/test && make     # 130 checks, then syntax-checks the .ino
```

The syntax check uses a tiny fake `Arduino.h`, so it does not prove the sketch compiles with the real AVR compiler.
Upload it once in the Arduino IDE and report any error.

## Not done

- **Real-time clock:** the clock starts at `START_TIME` in `my_schedule.h` on every reset and is counted with `millis()`.
- **Saved schedule:** `Scheduler::save/load` give the bytes; writing them to EEPROM is not wired.
- **Dispenser and verification:** there is no pin or sensor, so a dose counts as taken after the cartridge has spun.
