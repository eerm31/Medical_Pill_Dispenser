# Data Model: Mechanism Animation and Run Replay

**Feature**: 002-mechanism-animation | **Date**: 2026-09-19

Entities for the replay-only animation MVP. All types are stdlib-only
(`dataclasses`, `enum`) and reuse feature 001's models (`DispenseEvent`,
`Outcome`, `MechanismConfig`, `SimulationRun`, `simulation.replay.load_run_record`).
Nothing here re-simulates cycles; every field is derived from the persisted
run record or is presentation-layer state.

## Entities

### Run Source

Where a cycle sequence comes from (FR-001/002/003).

| Field | Type | Notes |
|---|---|---|
| `events` | `list[DispenseEvent]` | Ordered, gap-free by `cycle_index` (validated on load) |
| `mechanism` | `MechanismConfig` | From embedded config; `None` in CSV-fallback mode |
| `run_id` | `str` | From record, or `"<csv>"`-derived label in fallback |
| `seed` | `int \| None` | `None` in CSV-fallback mode |
| `geometry_approximate` | `bool` | True when loaded from cycles.csv only (FR-003 banner) |

Validation: `events` must be non-empty, ordered, and contiguous
(`cycle_index == position`); any gap, reorder, or schema mismatch is a load
error (exit 1 per contracts/cli-contract.md). Implementations:
`JsonRunSource` (wraps `load_run_record`) and `CsvRunSource` (reconstructs
events from cycles.csv rows; `mechanism=None`).

### Cycle Frame

Visual state of the mechanism and pills for one cycle (FR-004/006/007).

| Field | Type | Notes |
|---|---|---|
| `cycle_index` | `int` | Matches the source event |
| `outcome` | `Outcome` | Verbatim from record |
| `failure_mode` | `str \| None` | Verbatim from record |
| `pills_dispensed` | `int` | Actual released count (multi-dose shows the real number) |
| `jam_persistent` | `bool` | Verbatim from record |
| `pill` | `dict \| None` | Recorded pill snapshot (shape, length/width mm, friction, orientation) |
| `phases` | `tuple[CycleStage, ...]` | Happy-path stages, or truncated-at-FAULT per outcome |
| `in_span` | `FailureSpan \| None` | Set when the cycle belongs to a jam span |

Validation: a frame never contradicts its event (e.g. `MULTI_DOSE` requires
`pills_dispensed >= 2`); frames are derived lazily, never stored for the
whole run (FR-014).

### Failure Span

Contiguous range of cycles sharing a persistent condition (FR-008).

| Field | Type | Notes |
|---|---|---|
| `failure_mode` | `str` | MVP: only `JAM` spans are coalesced |
| `start_cycle` | `int` | Inclusive |
| `end_cycle` | `int` | Inclusive |
| `length` | `int` | `end_cycle - start_cycle + 1` |

Derivation: single O(n) pass over events; a span opens on
`failure_mode == "JAM"` and closes on the first non-JAM cycle. Single-cycle
jams are spans of length 1.

### Playback Session

Viewer state over a run's cycle sequence (FR-012/013).

| Field | Type | Notes |
|---|---|---|
| `position` | `int` | Current cycle index, `0..len(events)-1` |
| `state` | `PlaybackState` | `PLAYING`, `PAUSED`, `STOPPED` |
| `speed` | `float` | Cycles per second, clamped to `[0.25, 120]` |
| `span_index` | `SpanIndex` | Sorted violation indices + spans (built once at load) |

Transitions: `STOPPED → PLAYING` (play), `PLAYING ⇄ PAUSED` (space),
`* → PAUSED` on any step/seek; `position` clamps at both ends (playing off
the end lands on the last cycle, `PAUSED`). `seek(n)`, `step(±1)`,
`next_failure()`, `previous_failure()` all complete without rendering
intermediate cycles (SC-004). Changing speed never re-derives frames and
never alters annotations (FR-012 acceptance).

### Mechanism View

Rendered depiction driven by config (FR-004/005).

| Field | Type | Notes |
|---|---|---|
| `layout` | `Layout` | Primitives from `geometry.py` (reservoir, path, metering zone, release, reset) |
| `frame` | `CycleFrame` | Currently rendered cycle |
| `banner` | `str \| None` | e.g. geometry-approximate warning |

Rendering rules: reservoir shows truthful counts — visible pills up to a
cap, then an aggregate "+N" indicator (spec edge case: never misrepresent
depletion); the exact depletion cycle is visually marked (empty reservoir
silhouette from that cycle on). `NO_PILL_AVAILABLE` uses a distinct neutral
style, never the failure palette (FR-009). `UNCLASSIFIED` failures get
their own style with the recorded cycle state inspectable (spec edge case).

### Annotation

Per-cycle labeling beside the Mechanism View (FR-006/007).

| Field | Type | Notes |
|---|---|---|
| `label` | `str` | e.g. `cycle 418 · MULTI_DOSE ×3 · DOUBLE_DROP` |
| `style` | `str` | One of the legend styles in contracts/player-interface.md |

Every rendered cycle carries an annotation; failure styles are
distinguishable within the mechanism view itself (stuck pill, stacked
pills, released-count badge, retained pill, empty reservoir).

## Module Mapping

```text
src/dispenser_sim/animation/
├── __init__.py
├── loader.py     # RunSource, JsonRunSource, CsvRunSource
├── frames.py     # CycleFrame derivation (pure)
├── spans.py      # FailureSpan + SpanIndex (pure)
├── player.py     # PlaybackSession state machine (pure)
├── geometry.py   # MechanismConfig -> Layout templates (pure)
└── tkview.py     # Tkinter canvas app (thin; only module importing tkinter)
```

CLI: new `animate` subcommand in `src/dispenser_sim/cli.py` (see
contracts/cli-contract.md).
