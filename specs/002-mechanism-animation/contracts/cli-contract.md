# Contract: `animate` Subcommand

**Feature**: 002-mechanism-animation | **Version**: 1.0 (draft)

Extends the feature 001 CLI (`validate` / `run` / `report` / `compare`) with
a replay-only animation command. Exit-code conventions are unchanged: 0 on
success, 1 with a human-readable stderr message on validation/runtime
failure, 2 for usage errors (argparse).

## Usage

```text
dispenser-sim animate --run PATH [--check] [--speed N] [--start-cycle N]
```

| Argument | Required | Meaning |
|---|---|---|
| `--run PATH` | yes | Path to a run directory or directly to a `run.json`. If no `run.json` exists but `cycles.csv` does, replay proceeds in geometry-approximate mode (FR-003). |
| `--check` | no | Headless: load the run, build the span index, derive every frame, print a summary, exit. No window is opened and tkinter is never imported. |
| `--speed N` | no | Initial playback speed in cycles/second (default 4, clamped to [0.25, 120]). |
| `--start-cycle N` | no | Initial cycle index (default 0, clamped to the run length). |

## Behavior

- Success (GUI mode): opens the player window paused at `--start-cycle`;
  prints the run identity (`run_id`, cycles, source mode) to stdout; exit 0
  when the window is closed.
- Success (`--check`): prints `run_id`, cycle count, failure-mode breakdown,
  jam-span count, and `frames: OK (<n> derived)`; exit 0.
- Missing path: `error: <path>: file not found`, exit 1.
- Corrupt/invalid record (malformed JSON, bad `schema_version`, non-contiguous
  or reordered cycles, event invariant violation): `error: <path>: <reason>`,
  exit 1 — no partial or misleading animation is ever shown (spec edge case).
- Both `run.json` and `cycles.csv` missing: `error: <path>: no run record
  (run.json) or per-cycle export (cycles.csv) found`, exit 1.
- CSV-fallback mode: stdout notes `geometry approximate (cycles.csv only)`
  and the same text appears as an in-window banner.
- tkinter unavailable (e.g. no display, Tk not installed): `error:
  animation requires a display (tkinter); use --check for headless
  validation`, exit 1. Never a traceback.

## Invariants

- The command never writes to the run directory and never re-simulates
  cycles (FR-002/FR-018).
- All feature 001 subcommands and tests behave identically with or without
  the animation package present (SC-005).
- In `--check` mode, derived frames equal the recorded event count exactly
  (SC-001 fidelity, machine-checkable).
