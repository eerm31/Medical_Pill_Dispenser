# Electronics - Arduino UNO

The same two systems as [`../electronics-ESP32/`](../electronics-ESP32/), written for an Arduino Uno (ATmega328P) and
opened with the Arduino IDE. Concept code that has not run on a board yet.

| Folder | What it is |
| --- | --- |
| [`rotation-mechanism/`](rotation-mechanism/) | Drum rotation: home search against the Hall sensor, indexing to a colour station, stepper driver |
| [`scheduling-system/`](scheduling-system/) | Dose schedule (with pills per dose) and the cartridge turn at the scheduled time. Also holds the rotation code and the auto-rotate state machine |

## Quick start (this is all you need)

Download the `electronics-Arduino-UNO` folder, then:

1. **Wire the stepper** (see Wiring below) and plug the Uno into the computer.
2. **Upload once:** open `scheduling-system/scheduling-system.ino` in the Arduino IDE, Tools > Board > Arduino Uno, pick the
   USB port, press Upload. Then close the Arduino Serial Monitor.
3. **Set the schedule:** open `scheduler-ui/index.html` (the UI System) in Chrome or Edge. It looks for the Arduino by itself
   and shows a green check mark when it is connected (otherwise press **Connect Arduino** at the bottom). Add the
   medications (name, time, pills) to the table and press **Save schedule**.

The Uno now turns the cartridge by itself at those times (30 degrees per pill) and keeps the schedule in its memory, so you
do not upload again to change the times. The UI System sets the board's clock from the computer every time you save.
It works offline. Keep every file of the `scheduling-system` folder together: an Arduino sketch needs the same name as its folder.

Only `scheduling-system/` and `scheduler-ui/` are needed. `rotation-mechanism/` is a separate test sketch for homing with
a Hall sensor, and the `test/` folders are for the laptop tests.

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
cd electronics-Arduino-UNO/scheduling-system/test && make     # 191 checks, then syntax-checks the .ino
```

The syntax check uses a tiny fake `Arduino.h`, so it does not prove the sketch compiles with the real AVR compiler.
Upload it once in the Arduino IDE and report any error.

## Not done

- **Real-time clock:** the Uno has no clock chip. It counts time with `millis()` and starts at `START_TIME` in `my_schedule.h`
  after every reset or power-up until the UI System sets it again (it does that when you press Save schedule).
- **Dispenser and verification:** there is no pin or sensor, so a dose counts as taken after the cartridge has spun.
