# Electronics

Code that runs on the dispenser's own electronics, kept apart from the simulation. One folder per system.
All of it is concept code, ASSUMED / NOT_VALIDATED, and none of it has run on hardware.

| Folder | What it is | Ported from the simulation |
| --- | --- | --- |
| [`rotation-mechanism/`](rotation-mechanism/) | Drum rotation: home search against the Hall sensor, indexing to a colour station, stepper driver | `rotation-controller.js` |
| [`scheduling-system/`](scheduling-system/) | Dose schedule and the automatic rotation that follows it (uses `rotation-mechanism/`) | `schedule-controller.js` |

```text
electronics/
  rotation-mechanism/   firmware/core (portable), firmware/hw (Arduino), firmware/main.cpp, test/
  scheduling-system/    firmware/core (portable), firmware/main.cpp, test/   -> depends on rotation-mechanism
```

The simulation (the Python package in `src/`, the browser viewer in `docs/visualizer/`) is the model these were ported from.
Each folder has its own README, host tests (`make` in its `test/` folder) and a PlatformIO project.
`tests/test_electronics_scheduling.py` runs both test suites and checks that the constants still match the simulation.
