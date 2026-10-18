# Research: Mechanism Animation and Run Replay

**Feature**: 002-mechanism-animation | **Date**: 2026-09-19

All Technical Context unknowns resolved. The binding constraint is the
constitution's stdlib-only rule for product code (FR-017, Constitution IV);
every decision below is made under that constraint.

## Decision 1: Visualization approach — Tkinter (stdlib) Canvas player

**Decision**: Build the player on `tkinter` (Python standard library) using a
single `tkinter.Canvas`-based 2D schematic view, plus a headless `--check`
mode that validates a run without opening a window.

**Rationale**:
- Tkinter is stdlib: zero new Python dependencies, so FR-017 is satisfied
  with no constitution deviation. The core simulation remains fully runnable
  without the visualization (`animation/` is only imported by the `animate`
  subcommand; `import tkinter` happens lazily inside the view layer).
- Cross-platform (macOS / Linux / Windows) with the same codebase; matches
  feature 001's target platform. Caveat: on some Linux distros the OS-level
  `python3-tk` package is required; this is an environment prerequisite
  (documented in quickstart), not a Python dependency.
- A Canvas shows *why* a cycle failed (SC-003) far better than text: a pill
  visibly wedged at the passage, two pills stacked in the metering zone, N
  pills below the release point, an empty reservoir silhouette.
- Schematic 2D (not physical rendering) is explicitly sanctioned by the
  spec's Assumptions.

**Alternatives considered**:
- curses / ASCII terminal player: rejected — stdlib `curses` is Unix-only
  (Windows needs the non-stdlib `windows-curses`), and ASCII art is a weaker
  vehicle for the "viewer can identify why without reading a table" gate.
- pygame / matplotlib animation / PyQt: rejected — non-stdlib; would require
  an explicit constitution deviation for no functional gain at MVP scope.
- Web-based (local HTTP server + browser): rejected — adds server/browser
  coupling, hurts the fully-offline simplicity story, and is the heaviest
  option to test.

## Decision 2: Frame model — lazily derived CycleFrame, never pre-rendered

**Decision**: The unit of playback is the **Cycle Frame**: one per recorded
cycle, derived on demand (O(1)) from the persisted `DispenseEvent` plus the
mechanism config. Frames are pure presentation data (pill positions, phase,
outcome, failure mode). Sub-cycle phase motion (presentation → singulation →
release → reset) is deterministic interpolation computed at render time from
the frame, not stored.

**Rationale**: FR-014 (10,000+ cycles without pre-rendering) and SC-004
(jump/seek < 2 s). The events list from `simulation/replay.load_run_record`
(~10k small dataclasses) is already proven cheap in feature 001; deriving a
frame is arithmetic on one event plus the layout. Replay never re-simulates
(FR-002): outcomes, failure modes, jam flags, and pill attributes come from
the record verbatim; only pill *positions* are interpolated, and that is
documented as presentation-layer derivation.

**Alternatives considered**:
- Pre-render every frame to images/sprites: rejected — violates FR-014,
  slow open times, large memory for 10^5-cycle runs.
- Re-run the engine to get positions: rejected — FR-002 forbids
  re-simulation; the record is the single source of truth.

## Decision 3: Mechanism geometry from config — layout templates + generic fallback

**Decision**: A pure `geometry.py` maps a `MechanismConfig` to a **Layout**:
a normalized list of primitives (reservoir box with capacity, pill path
polyline, singulation/metering zone sized from `passage_clearance_mm` and
`metering_geometry`, release point, reset position). Two layout templates
ship with the MVP — linear-stroke (slider gate family) and rotary (rotary
disk family) — selected from `metering_geometry` keys; any other config gets
a generic linear layout (FR-005). Pill rendering scales from
`pill_state.length_mm/width_mm`; shape (round/oblong/capsule) selects the
glyph.

**Rationale**: FR-004/FR-005 demand config-driven visuals that work for
future designs without touching simulation logic. Normalizing to a 0–1
schematic coordinate space keeps the view independent of physical scale
while physical dimensions stay visible as labels (Constitution II: honest
physical units).

**Alternatives considered**:
- Hard-coded drawing per mechanism name: rejected — fails FR-005 for future
  configs.
- Full kinematic re-derivation of pill trajectories from
  `mechanism/singulation.py`: rejected — duplicates engine logic in the view
  and tempts divergence; replay must be record-driven.

## Decision 4: Long-run navigation — eager event list, O(n) span index, bisect seek

**Decision**: Load the full event list once (feature 001 already does this
for 10k cycles). Build a **failure/span index** in one O(n) pass at load:
the sorted list of violation cycle indices (for next/previous failure,
FR-013) and the coalesced `FailureSpan` list (for jam spans, FR-008).
Jump-to-cycle is direct indexing; next/previous failure is `bisect` on the
sorted index. No cycle is rendered before it is shown.

**Rationale**: SC-004 (< 2 s per navigation on student hardware) is trivially
met: the heaviest operation is the initial JSON parse, already demonstrated
in feature 001 integration tests.

**Alternatives considered**: chunked/lazy CSV streaming — rejected for MVP
complexity (Constitution IV); revisit only if 10^5-cycle runs prove slow to
open.

## Decision 5: Jam persistence rendering — FailureSpan as a first-class visual

**Decision**: Consecutive cycles with `failure_mode == "JAM"` (and
`jam_persistent` true) coalesce into one `FailureSpan(start, end)`. The view
renders the span as a continuous highlighted band on the cycle
timeline/scrollbar with start and end cycle labels, and the mechanism view
keeps the stuck pill drawn for the whole span.

**Rationale**: FR-008 requires identifiable start/end and a continuous
span, not per-cycle flashes.

## Decision 6: cycles.csv fallback — reconstructed events, approximated geometry

**Decision**: If `run.json` is absent but `cycles.csv` exists, reconstruct
`DispenseEvent`s from the CSV columns (they map 1:1 per
contracts/run-record-schema.md) and render with the generic layout plus a
persistent "geometry approximate — run.json unavailable" banner (FR-003).
Missing/corrupt records fail loudly with a clear error and no partial
animation (spec edge case; cli-contract errors table).

## Decision 7: Testability without a display — pure core, thin view, `--check`

**Decision**: All animation logic lives in pure, display-free modules
(`loader.py`, `frames.py`, `spans.py`, `player.py`, `geometry.py`); the
Tkinter code is a thin shell. A headless `animate --check` mode loads the
run, builds the span index, derives every frame, and prints a summary —
fully exercisable in pytest on headless CI. GUI tests are marked and skipped
automatically when no display/Tk is available.

**Rationale**: Constitution III (automated, repeatable verification) must
not depend on a windowing system.

## Decision 8: Optional export (FR-016) — deferred; zero-dependency path noted

**Decision**: Not in the MVP. When revisited, `Canvas.postscript()` offers a
stdlib-only still-frame export, and a text storyboard (per-cycle ASCII
summary of a range) is another dependency-free option. Any video/GIF export
would be an optional dev-only extra, never an MVP dependency (FR-017).

## Decision 9: Live animation seam (FR-010/011, Phase 2) — RunSource protocol

**Decision**: The player consumes an ordered sequence of `DispenseEvent`s
plus a `MechanismConfig` through a single `RunSource` interface
(`events()`, `mechanism`, `span_index`). The MVP ships the recorded-run
implementation; Phase 2 adds an engine-driven source with no changes to
player, frames, spans, or view — which is exactly what makes FR-011
(live ≡ replay) verifiable.

**Alternatives considered**: building live-first — rejected per the
2026-09-19 clarification (replay-only MVP).
