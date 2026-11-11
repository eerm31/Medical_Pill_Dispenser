# Scheduling system

ESP32-S3 firmware for the dose schedule and the automatic rotation that follows it.
Concept code, ASSUMED / NOT_VALIDATED: it has not run on hardware, and it makes no clinical or dosing claim.
Port of `docs/visualizer/schedule-controller.js` and the take flow of the viewer. It drives the drum through
[`../rotation-mechanism/`](../rotation-mechanism/), which is a separate system.

## What it does

| File (`firmware/core/`) | Job |
| --- | --- |
| `schedule.h/.cpp` | Clock, up to 8 entries (colour + HH:MM + 1 to 5 pills), PENDING / DUE / TAKING / TAKEN / MISSED / FAILED, 30 min grace, midnight reset, save/load bytes |
| `auto_rotate.h/.cpp` | Turns the drum to the due colour by itself; the tap on TAKE starts the dispense; parks the drum afterwards |

## How a dose works

`main.cpp` currently runs the simple version for one cartridge with no pin and no Hall sensor: when a dose is due, the stepper
turns the cartridge `DEGREES_PER_PILL` (30 degrees) for every pill, pauses `PAUSE_MS_AFTER_MOVE` after each move so the pill can
fall, then stops and the dose counts as taken (settings in `my_schedule.h`, logic in `core/cartridge_turn.cpp`). The
full flow below (`auto_rotate`, homing, TAKE tap) is tested but not used by `main.cpp` yet.

1. The clock reaches an entry's time: it becomes **DUE** (after 30 minutes unclaimed it is **MISSED**).
2. The drum turns to that colour on its own (pre-positioning, switchable in `AutoConfig`).
3. The user taps **TAKE**. Only the tap starts the dispense; the clock alone never does.
4. The dispenser reports a verdict. Only **VERIFIED** counts as taken; anything else is **FAILED**.
5. The drum returns to the RED park station.

The dispenser (Subsystem 1) and the verification (Subsystem 3) are not in this repository's electronics yet. They plug in through
the `Dispenser` interface in `auto_rotate.h`; `main.cpp` uses a stub that reports VERIFIED after 1 s per pill.

## Layout

```text
firmware/
  core/    portable C++11, no Arduino: schedule, auto_rotate
  my_schedule.h  the dose schedule and start time (edit this)
  main.cpp one cartridge, no sensors: turns the stepper 30 degrees per pill. Console: time, add, rm, list, step, stop
test/      host tests (they use the fake drum of ../rotation-mechanism/test)
platformio.ini   uses ../rotation-mechanism as a library
```

## Test on a laptop

```bash
cd electronics-ESP32/scheduling-system/test
make     # runs 191 checks, then syntax-checks main.cpp against an Arduino stub
```

## Build for the board

```bash
pio run && pio run -t upload && pio device monitor   # 115200 baud, type "help"
```

## Not done

- **Real-time clock:** the clock is set from the serial console and counted with `millis()`. A battery-backed RTC needs pins that are not assigned (GPIO 8, 9 and 10 are planned for Feature 006).
- **Touchscreen and LED:** the display (Feature 010) is not here.
- **Dose storage:** the schedule and the turn settings are kept in the board's EEPROM memory (`hw/eeprom_store.h`) when the UI System sends `save`, and loaded at every start. This part has not run on a real board.
- **`pio run`** has not been run (PlatformIO is not installed here), including the `symlink://` library link.
