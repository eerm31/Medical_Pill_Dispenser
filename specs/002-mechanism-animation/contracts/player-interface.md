# Contract: Player Interface (Keyboard, Navigation, Visual Legend)

**Feature**: 002-mechanism-animation | **Version**: 1.0 (draft)

Interaction and visual contract for the Tkinter replay player. Binding for
FR-006/007/008/009/012/013 and SC-003/004.

## Keyboard Controls

| Key | Action | Playback effect |
|---|---|---|
| `Space` | play / pause | toggles PLAYING ⇄ PAUSED |
| `Right` / `Left` | single-step forward / back | pauses, moves one cycle |
| `+` / `-` | faster / slower | doubles / halves speed, clamped [0.25, 120] cycles/s |
| `g` | jump to cycle | prompts for an index, seeks directly (no intermediate rendering) |
| `n` / `p` | next / previous failure | seeks to the next/previous violation cycle (jam span counts once, at its start) |
| `Home` / `End` | first / last cycle | seeks |
| `q` or `Esc` | quit | closes the window, CLI exits 0 |

All controls act on the current position only; annotations remain accurate
at every speed and position (FR-012). No control re-rolls randomness or
re-derives outcomes (FR-002).

## On-Screen Layout

- **Mechanism view** (canvas, main area): schematic of the configured
  mechanism — reservoir, pill path, singulation/metering zone, release
  point — with pills positioned for the current cycle's phases.
- **Annotation bar** (always visible): `cycle <i> / <n> · <OUTCOME>
  [· <FAILURE_MODE>] [· ×<k> released]` plus pill shape/dimensions when a
  pill is involved.
- **Timeline strip** (bottom): full-run overview with violation ticks and
  jam spans drawn as continuous bands with start/end labels (FR-008); a
  position marker shows the current cycle.
- **Status line**: playback state, speed, and — in CSV-fallback mode — the
  `geometry approximate` banner (FR-003).

## Visual Legend (SC-003: identifiable from the animation alone)

| Recorded state | Mechanism view | Style |
|---|---|---|
| `SINGLE` | one pill travels the path and drops at release | neutral/green |
| `ZERO_DOSE` + `MISSED_DISPENSE` | pill visible in the metering zone but retained at reset | amber outline, retained pill |
| `ZERO_DOSE` + `JAM` | pill wedged at the passage; persists across the span | red, stuck-pill glyph; span band on the timeline |
| `ZERO_DOSE` + `STACKING` | two or more pills visibly stacked in the metering zone | red, stacked glyphs |
| `MULTI_DOSE` + `DOUBLE_DROP` | actual released count shown as that many pills at release with a `×k` badge | red badge, truthful count (never a generic error) |
| `NO_PILL_AVAILABLE` | empty reservoir silhouette; mechanism cycles normally | grey/blue, clearly **not** a failure (FR-009) |
| `UNCLASSIFIED` | distinct hatch style; recorded cycle state inspectable in the annotation bar | purple, distinct from all above |
| interrupted/partial actuation (FAULT cycle from feature 001) | mechanism mid-stroke with fault marker | distinct from both normal and failure styles |

Reservoir truthfulness: when the population exceeds the drawable area, the
reservoir shows a representative sample plus a `+N` aggregate count; counts
never misrepresent depletion, and the depletion transition is visibly
marked at the exact cycle it occurs (spec edge cases).
