# Quickstart: Mechanism Animation and Run Replay

**Feature**: 002-mechanism-animation | **Date**: 2026-09-19

Runnable validation scenarios proving the replay-only animation MVP
end-to-end. Contracts: see [contracts/cli-contract.md](contracts/cli-contract.md)
and [contracts/player-interface.md](contracts/player-interface.md).
Entities: see [data-model.md](data-model.md).

## Prerequisites

- Python 3.11+ (`python3 --version`), Tk available (`python3 -c "import tkinter"`).
  On macOS with python.org/Homebrew Python this works out of the box; on
  Debian/Ubuntu install the OS package `python3-tk` (not a Python
  dependency). Headless environments can run every `--check` scenario
  without Tk.
- From the repo root: `python3 -m venv .venv && source .venv/bin/activate`
- Install: `pip install . pytest` (non-editable; on this machine editable
  installs are unreliable — see the macOS hidden-flag quirk in
  specs/001-dispensing-mechanism-simulation/plan.md Technical Context).
  pytest is the only dev dependency.
- At least one recorded run (or create one):
  `dispenser-sim run --mechanism configs/mechanisms/slider_gate_v1.json
  --pills configs/pills/standard_mix.json --cycles 10000 --seed 42`

## Scenario 1 — Replay a recorded run (US1, FR-001/002, SC-001)

```bash
dispenser-sim animate --run runs/<run_id>
```

Expected: the player opens paused at cycle 0; pressing `Space` plays every
cycle in recorded order; the annotation bar's outcome and failure mode match
`runs/<run_id>/run.json` (or cycles.csv) exactly for spot-checked cycles.
Closing the window exits 0.

## Scenario 2 — Headless fidelity check (SC-001, CI-friendly)

```bash
dispenser-sim animate --run runs/<run_id>/run.json --check
```

Expected: prints run identity, cycle count, failure-mode breakdown, jam-span
count, and `frames: OK (10000 derived)`; exit 0. Runs on machines with no
display.

## Scenario 3 — Failure modes are visually obvious (US1, FR-006/007, SC-003)

Replay a run containing JAM, STACKING, DOUBLE_DROP, MISSED_DISPENSE, and
NO_PILL_AVAILABLE cycles; use `n` to hop between failures.

Expected: each state matches the legend in contracts/player-interface.md —
stuck pill (JAM), stacked pills (STACKING), actual released count badge
(DOUBLE_DROP/multi-dose), retained pill (MISSED_DISPENSE), empty-reservoir
style for NO_PILL_AVAILABLE which is clearly not a failure (FR-009). A
viewer can name the cause of every failed or empty cycle without opening
the CSV.

## Scenario 4 — Jam span continuity (US1, FR-008)

Find a multi-cycle jam (report.md lists notable jam ranges), jump to it
(`g`), and step through with `Right`.

Expected: the timeline shows one continuous band with labeled start and end
cycles; the stuck pill persists across the span; the cycles where the jam
starts and clears are identifiable.

## Scenario 5 — Invalid input fails loudly (spec edge cases)

```bash
dispenser-sim animate --run runs/does-not-exist
dispenser-sim animate --run <dir with neither run.json nor cycles.csv>
```

Expected: a clear `error: …` on stderr, exit 1, and no window or partial
animation.

## Scenario 6 — CSV fallback (FR-003)

Copy a run's `cycles.csv` into an empty directory and
`dispenser-sim animate --run <that dir>`.

Expected: replay works with the generic mechanism layout; stdout and the
in-window banner both state `geometry approximate (cycles.csv only)`;
outcomes and failure modes still match the CSV exactly.

## Scenario 7 — 10,000-cycle navigation (US3, FR-013/014, SC-004)

Open the 10,000-cycle run; use `g` to jump to cycle 9999, then `p` to find
the previous failure, then single-step backward.

Expected: each navigation completes in under 2 seconds; no pre-rendering
delay on open; annotations are correct at every landed position.

## Scenario 8 — Review-ready in 5 minutes (SC-006)

From a finished run, open the player, jump to the next jam (`n`), and step
through the span for a live design-review walkthrough.

Expected: a team member reaches a review-ready on-screen presentation of
the span within 5 minutes. (Exporting a shareable artifact is optional per
FR-016 and not required here.)

## Test suite (Constitution III)

```bash
pytest tests/unit tests/statistical tests/integration
```

Expected: all green, including new animation tests — loader (JSON + CSV
fallback + error paths), span coalescing, frame/event fidelity for all
classified states, player navigation/seeks — and all feature 001 tests
unchanged (SC-005, FR-018). GUI tests skip automatically when no display is
available.

## Validation results (2026-09-21, macOS, Python 3.13, display available)

| Scenario | Result |
|---|---|
| 1 — Replay a recorded run | PASS. Player opens paused at cycle 0; Space toggles play/pause; annotation matches run.json for spot-checked cycles (0, 1, 500, 9999); quit destroys the window and the CLI exits 0 (verified end-to-end through `dispenser-sim animate`). |
| 2 — Headless fidelity check | PASS. `animate --run runs/00d370d37c0b/run.json --check` prints run identity, breakdown (JAM 45, STACKING 1, UNCLASSIFIED 1), `jam_spans: 20`, `frames: OK (10000 derived)`; exit 0; tkinter never imported (subprocess-verified). |
| 3 — Failure modes visually obvious | PASS for the states present in the seed-42 run (JAM stuck pill, STACKING stacked glyphs, UNCLASSIFIED hatch; NO_PILL_AVAILABLE never occurs in this run). MISSED_DISPENSE/DOUBLE_DROP glyph paths are unit-tested via frame fidelity tests. |
| 4 — Jam span continuity | PASS. 20 jam spans coalesce (e.g. cycles 4–5, 7–8, 10–11); timeline renders continuous labeled bands (`jam_band`); stuck pill persists across every span cycle (`stuck_pill`). |
| 5 — Invalid input fails loudly | PASS. Missing path → `error: runs/does-not-exist: file not found`, exit 1; empty dir → `error: …: no run record (run.json) or per-cycle export (cycles.csv) found`, exit 1; corrupt JSON → `error: …: malformed JSON: …`, exit 1. No window, no traceback. |
| 6 — CSV fallback | PASS. cycles.csv-only directory replays with `geometry approximate (cycles.csv only)` on stdout and as the in-window banner; `frames: OK (10000 derived)`; outcomes/failure modes match the CSV exactly. |
| 7 — 10,000-cycle navigation | PASS. jump to 9999 ≈ 1 ms; previous-failure seek < 1 ms; backward single-step ≈ 1 ms; no pre-rendering on open (lazy O(1) frame derivation). |
| 8 — Review-ready in 5 minutes | PASS. `n` jumps to the next jam start; Right steps through the span with the band and stuck pill visible throughout. |

Test suite: **107 passed** (`pytest tests/unit tests/statistical
tests/integration`), including 59 new animation tests; all feature 001 tests
unchanged and green (SC-005, FR-018). GUI tests ran (display available);
they auto-skip when headless.
