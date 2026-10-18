"""Tkinter canvas player (T011/T019) — the ONLY module that imports tkinter.

Thin view over the pure core: renders the Layout (geometry.py) and the
current CycleFrame (frames.py) on a Canvas with an always-visible
annotation bar, the full visual legend of contracts/player-interface.md
(stuck pill for JAM persisting across the span, stacked pills for
STACKING, truthful ×k released badge for multi-dose, retained pill for
MISSED_DISPENSE, distinct non-failure style for NO_PILL_AVAILABLE per
FR-009, purple hatch for UNCLASSIFIED, mid-stroke fault marker for
interrupted cycles), a bottom timeline strip with violation ticks and jam
spans as continuous labeled bands, and the full keyboard contract (Space,
Right/Left, +/-, g, n/p, Home/End, q/Esc). Reservoir counts are truthful:
a visible sample plus a "+N" aggregate, with depletion marked at the
exact cycle. The CSV-fallback banner is shown in-window (FR-003).
"""

from __future__ import annotations

import tkinter as tk

from ..models.events import Outcome
from .frames import (
    CycleFrame,
    consumption_prefix,
    depletion_cycle,
    derive_frame,
)
from .geometry import Layout, build_layout
from .loader import RunSource
from .player import PlaybackSession

CANVAS_W = 960
CANVAS_H = 560
ANNOTATION_H = 30
TIMELINE_H = 70
STATUS_H = 24
#: Reservoir draws at most this many pill glyphs, then a "+N" aggregate.
DRAW_SAMPLE_CAP = 12
#: Schematic pixels per millimetre for pill glyphs.
MM_TO_PX = 3.5

# Legend palette (contracts/player-interface.md).
_GREEN = "#2e7d32"  # SINGLE
_AMBER = "#f9a825"  # MISSED_DISPENSE (retained pill)
_RED = "#c62828"  # JAM / STACKING / DOUBLE_DROP (violations)
_NEUTRAL = "#546e7a"  # NO_PILL_AVAILABLE (not a failure, FR-009)
_PURPLE = "#6a1b9a"  # UNCLASSIFIED
_INK = "#263238"


class DisplayUnavailableError(RuntimeError):
    """Raised when Tk cannot open a window (no display / Tk missing)."""


class PlayerApp:
    """The replay player window. Drivable without mainloop for tests."""

    def __init__(
        self,
        source: RunSource,
        session: PlaybackSession,
        events: list,
        layout: Layout,
        master: tk.Misc | None = None,
    ) -> None:
        self._source = source
        self._session = session
        self._events = events
        self._layout = layout
        self._consumption = consumption_prefix(events)
        self._depletion = depletion_cycle(events)
        if self._depletion is not None:
            # The reservoir is exactly empty at the depletion cycle, so the
            # initial load is the consumption up to that cycle (truthful).
            initial = self._consumption[self._depletion]
        else:
            initial = layout.reservoir_capacity
        self._levels = (
            None
            if initial is None
            else [max(0, initial - used) for used in self._consumption]
        )
        self._tick_job: str | None = None
        try:
            self._root = tk.Tk() if master is None else master
        except tk.TclError as exc:
            raise DisplayUnavailableError(str(exc)) from exc
        self._owns_root = master is None
        self._root.title(f"dispenser-sim animate — {source.run_id}")
        self._canvas = tk.Canvas(
            self._root, width=CANVAS_W, height=CANVAS_H, bg="white",
            highlightthickness=0,
        )
        self._canvas.pack()
        self._bind_keys()
        self._draw_static()
        self.render()

    # -- public surface (also used by GUI tests) -------------------------

    @property
    def canvas(self) -> tk.Canvas:
        return self._canvas

    @property
    def session(self) -> PlaybackSession:
        return self._session

    def current_frame(self) -> CycleFrame:
        event = self._events[self._session.position]
        return derive_frame(
            event, self._session.span_index.span_containing(event.cycle_index)
        )

    def annotation_text(self) -> str:
        """The always-visible annotation bar text (FR-006/007)."""
        frame = self.current_frame()
        parts = [
            f"cycle {frame.cycle_index} / {len(self._events)}",
            frame.outcome.value,
        ]
        if frame.failure_mode is not None:
            parts.append(frame.failure_mode)
        if frame.pills_dispensed >= 2:
            parts.append(f"×{frame.pills_dispensed} released")
        text = " · ".join(parts)
        if frame.pill is not None:
            text += (
                f" · {frame.pill.get('shape', '?')} "
                f"{frame.pill.get('length_mm', '?')}×"
                f"{frame.pill.get('width_mm', '?')} mm"
            )
        return text

    def status_text(self) -> str:
        """Status line: playback state, speed, CSV-fallback banner."""
        text = f"{self._session.state.value} · {self._session.speed:g} cycles/s"
        if self._layout.geometry_approximate:
            text += " · geometry approximate (cycles.csv only)"
        return text

    def jump_to(self, cycle_index: int) -> int:
        """Seek directly to a cycle (no intermediate rendering, SC-004)."""
        landed = self._session.seek(cycle_index)
        self.render()
        return landed

    def on_key(self, keysym: str) -> None:
        """Keyboard contract (contracts/player-interface.md)."""
        if keysym == "space":
            self._session.toggle()
        elif keysym == "Right":
            self._session.step(1)
        elif keysym == "Left":
            self._session.step(-1)
        elif keysym in ("plus", "equal", "KP_Add"):
            self._session.faster()
        elif keysym in ("minus", "KP_Subtract"):
            self._session.slower()
        elif keysym == "g":
            self._prompt_jump()
            return  # prompt renders on accept
        elif keysym == "n":
            self._session.next_failure()
        elif keysym == "p":
            self._session.previous_failure()
        elif keysym == "Home":
            self._session.seek(0)
        elif keysym == "End":
            self._session.seek(len(self._events) - 1)
        elif keysym in ("q", "Escape"):
            self.destroy()
            return
        else:
            return
        self.render()

    def run(self) -> None:
        """Enter the event loop; playback ticks via root.after."""
        self._schedule_tick()
        self._root.mainloop()

    def destroy(self) -> None:
        if self._tick_job is not None:
            try:
                self._root.after_cancel(self._tick_job)
            except tk.TclError:
                pass
            self._tick_job = None
        try:
            self._root.destroy()
        except tk.TclError:
            pass

    # -- internals ------------------------------------------------------

    def _bind_keys(self) -> None:
        for keysym in (
            "<space>", "<Right>", "<Left>", "<Home>", "<End>", "<Escape>",
        ):
            self._root.bind(keysym, self._key_event)
        for char in ("+", "=", "-", "g", "n", "p", "q"):
            self._root.bind(char, self._key_event)

    def _key_event(self, event: tk.Event) -> str:
        self.on_key(event.keysym)
        return "break"

    def _prompt_jump(self) -> None:
        from tkinter import simpledialog

        answer = simpledialog.askinteger(
            "Jump to cycle",
            f"Cycle index (0..{len(self._events) - 1}):",
            minvalue=0,
            maxvalue=len(self._events) - 1,
            parent=self._root,
        )
        if answer is not None:
            self._session.seek(answer)
        self.render()

    def _schedule_tick(self) -> None:
        if self._session.is_playing:
            delay = max(1, int(1000 / self._session.speed))
            self._tick_job = self._root.after(delay, self._tick)

    def _tick(self) -> None:
        self._tick_job = None
        if self._session.is_playing:
            self._session.advance()
            self.render()
        self._schedule_tick()

    def _view_h(self) -> float:
        return CANVAS_H - ANNOTATION_H - TIMELINE_H - STATUS_H

    def _xy(self, point: tuple[float, float]) -> tuple[float, float]:
        return point[0] * CANVAS_W, ANNOTATION_H + point[1] * self._view_h()

    def _rect(self, rect: tuple[float, float, float, float]):
        x, y = self._xy((rect[0], rect[1]))
        return x, y, x + rect[2] * CANVAS_W, y + rect[3] * self._view_h()

    # -- static layer: layout + timeline ---------------------------------

    def _draw_static(self) -> None:
        c = self._canvas
        layout = self._layout
        c.create_text(
            CANVAS_W / 2, ANNOTATION_H / 2, text="", tags=("annotation",),
            font=("TkDefaultFont", 12, "bold"), fill=_INK,
        )
        # Reservoir
        c.create_rectangle(
            *self._rect(layout.reservoir), outline=_INK, width=2,
            tags=("static",),
        )
        c.create_text(
            self._rect(layout.reservoir)[0],
            self._rect(layout.reservoir)[1] - 8,
            anchor="sw",
            text=f"reservoir ({layout.mechanism_name})",
            tags=("static",), fill=_INK,
        )
        # Pill path
        path_points = [coord for point in layout.path for coord in self._xy(point)]
        c.create_line(
            *path_points, fill="#90a4ae", width=3, arrow="last",
            tags=("static",),
        )
        # Metering / singulation zone
        c.create_rectangle(
            *self._rect(layout.metering_zone), outline=_INK, width=2,
            dash=(4, 2), tags=("static",),
        )
        c.create_text(
            self._rect(layout.metering_zone)[0],
            self._rect(layout.metering_zone)[3] + 6,
            anchor="nw",
            text=f"singulation/metering · {layout.clearance_label}",
            tags=("static",), fill=_INK,
        )
        # Rotary disk template adds the pocket disk.
        if layout.disk is not None:
            cx, cy = self._xy((layout.disk[0], layout.disk[1]))
            r = layout.disk[2] * self._view_h()
            c.create_oval(
                cx - r, cy - r, cx + r, cy + r, outline=_INK, width=2,
                tags=("static",),
            )
        # Release point / reset position
        rx, ry = self._xy(layout.release_point)
        c.create_oval(
            rx - 5, ry - 5, rx + 5, ry + 5, outline=_GREEN, width=2,
            tags=("static",),
        )
        c.create_text(rx, ry + 14, text="release", tags=("static",), fill=_INK)
        sx, sy = self._xy(layout.reset_position)
        c.create_text(sx, sy, text="reset", tags=("static",), fill="#90a4ae")
        self._draw_timeline_static()
        c.create_text(
            8, CANVAS_H - STATUS_H / 2, anchor="w", text="",
            tags=("status",), fill=_INK,
        )

    def _timeline_x(self, cycle_index: int) -> float:
        n = max(1, len(self._events) - 1)
        return 40 + (cycle_index / n) * (CANVAS_W - 80)

    def _timeline_y(self) -> float:
        return CANVAS_H - STATUS_H - TIMELINE_H / 2

    def _draw_timeline_static(self) -> None:
        """Violation ticks + jam-span bands with start/end labels (FR-008)."""
        c = self._canvas
        y = self._timeline_y()
        c.create_line(
            self._timeline_x(0), y, self._timeline_x(len(self._events) - 1), y,
            fill="#b0bec5", width=2, tags=("static",),
        )
        for span in self._session.span_index.spans:
            x0, x1 = self._timeline_x(span.start_cycle), self._timeline_x(span.end_cycle)
            c.create_rectangle(
                x0, y - 8, max(x1, x0 + 2), y + 8, fill=_RED, stipple="gray50",
                outline=_RED, tags=("static", "jam_band"),
            )
            c.create_text(
                x0, y + 20, anchor="w", tags=("static", "jam_band"),
                text=f"jam {span.start_cycle}–{span.end_cycle}",
                fill=_RED, font=("TkDefaultFont", 8),
            )
        for cycle in self._session.span_index.violations:
            x = self._timeline_x(cycle)
            c.create_line(
                x, y - 10, x, y + 10, fill=_RED, width=1, tags=("static",),
            )

    # -- dynamic layer: current frame ------------------------------------

    def render(self) -> None:
        """Redraw the dynamic layer for the current cycle."""
        c = self._canvas
        c.delete("dynamic")
        frame = self.current_frame()
        self._draw_reservoir(frame)
        self._draw_cycle(frame)
        # Annotation bar, timeline position marker, status line.
        c.itemconfigure("annotation", text=self.annotation_text())
        y = self._timeline_y()
        x = self._timeline_x(self._session.position)
        c.create_line(
            x, y - 14, x, y + 14, fill=_INK, width=3,
            tags=("dynamic", "position_marker"),
        )
        c.itemconfigure("status", text=self.status_text())

    def _pill_size(self, pill: dict | None) -> tuple[float, float]:
        if pill is None:
            return 14.0, 14.0
        length = float(pill.get("length_mm", 5.0)) * MM_TO_PX
        width = float(pill.get("width_mm", 5.0)) * MM_TO_PX
        if pill.get("shape") == "round_tablet":
            return length, length
        return length, width  # stadium glyph for oblong/capsule

    def _draw_pill(
        self, cx: float, cy: float, pill: dict | None, fill: str,
        outline: str = "", width: int = 1, tags: tuple = ("dynamic",),
    ) -> None:
        w, h = self._pill_size(pill)
        self._canvas.create_oval(
            cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2,
            fill=fill, outline=outline, width=width, tags=tags,
        )

    def _draw_reservoir(self, frame: CycleFrame) -> None:
        c = self._canvas
        x0, y0, x1, y1 = self._rect(self._layout.reservoir)
        depleted = (
            self._depletion is not None and frame.cycle_index >= self._depletion
        )
        if depleted or (self._levels is not None and self._levels[frame.cycle_index] == 0):
            # Empty-reservoir silhouette, marked from the exact depletion
            # cycle (spec edge case; FR-009 for NO_PILL_AVAILABLE).
            c.create_rectangle(
                x0 + 3, y0 + 3, x1 - 3, y1 - 3, outline=_NEUTRAL,
                dash=(3, 3), tags=("dynamic", "reservoir_empty"),
            )
            c.create_text(
                (x0 + x1) / 2, (y0 + y1) / 2, text="EMPTY", fill=_NEUTRAL,
                tags=("dynamic", "reservoir_empty"),
            )
            return
        if self._levels is None:
            c.create_text(
                (x0 + x1) / 2, y1 - 10, text="level unknown",
                fill=_NEUTRAL, tags=("dynamic",),
            )
            return
        remaining = self._levels[frame.cycle_index]
        visible = min(remaining, DRAW_SAMPLE_CAP)
        for i in range(visible):
            px = x0 + 14 + (i % 3) * 16
            py = y1 - 14 - (i // 3) * 16
            self._draw_pill(px, py, None, "#78909c")
        if remaining > visible:
            c.create_text(
                x0 + 8, y0 + 12, anchor="w",
                text=f"+{remaining - visible} more",
                fill=_INK, tags=("dynamic",),
            )

    def _draw_cycle(self, frame: CycleFrame) -> None:
        """The per-state mechanism glyphs (player-interface.md legend)."""
        c = self._canvas
        zone = self._rect(self._layout.metering_zone)
        zcx, zcy = (zone[0] + zone[2]) / 2, (zone[1] + zone[3]) / 2
        rx, ry = self._xy(self._layout.release_point)
        mode = frame.failure_mode

        if frame.outcome is Outcome.NO_PILL_AVAILABLE:
            # Distinct neutral, clearly not a failure (FR-009).
            c.create_text(
                zcx, zcy - 30, text="no pill available", fill=_NEUTRAL,
                font=("TkDefaultFont", 10, "italic"), tags=("dynamic",),
            )
            return
        if mode == "JAM" or frame.in_span is not None:
            # Stuck pill wedged at the passage; persists across the span.
            self._draw_pill(
                zcx, zcy, frame.pill, _RED, outline="#7f0000", width=2,
                tags=("dynamic", "stuck_pill"),
            )
            c.create_text(
                zcx, zcy - 30, text="JAM", fill=_RED,
                font=("TkDefaultFont", 10, "bold"), tags=("dynamic", "stuck_pill"),
            )
            return
        if mode == "STACKING":
            # Two or more pills visibly stacked in the metering zone.
            self._draw_pill(zcx, zcy - 10, frame.pill, _RED, tags=("dynamic",))
            self._draw_pill(zcx, zcy + 10, frame.pill, _RED, tags=("dynamic",))
            c.create_text(
                zcx, zcy - 32, text="STACKING", fill=_RED,
                font=("TkDefaultFont", 10, "bold"), tags=("dynamic",),
            )
            return
        if mode == "MISSED_DISPENSE":
            # Pill visible in the metering zone but retained at reset.
            self._draw_pill(
                zcx, zcy, frame.pill, "", outline=_AMBER, width=3,
                tags=("dynamic",),
            )
            c.create_text(
                zcx, zcy - 30, text="retained", fill=_AMBER,
                font=("TkDefaultFont", 10, "bold"), tags=("dynamic",),
            )
            return
        if frame.outcome is Outcome.MULTI_DOSE:
            # Truthful released count: that many pills plus a ×k badge.
            for k in range(frame.pills_dispensed):
                self._draw_pill(
                    rx, ry + 18 + k * 12, frame.pill, _RED,
                    tags=("dynamic",),
                )
            c.create_text(
                rx + 24, ry + 18, text=f"×{frame.pills_dispensed} released",
                fill=_RED, font=("TkDefaultFont", 11, "bold"),
                tags=("dynamic", "dose_badge"),
            )
            return
        if mode == "UNCLASSIFIED":
            # Distinct hatch; recorded state inspectable via annotation bar.
            c.create_rectangle(
                zone[0] + 4, zone[1] + 4, zone[2] - 4, zone[3] - 4,
                outline=_PURPLE, width=2, stipple="gray25",
                tags=("dynamic",),
            )
            c.create_text(
                zcx, zcy - 30, text="UNCLASSIFIED", fill=_PURPLE,
                font=("TkDefaultFont", 10, "bold"), tags=("dynamic",),
            )
            if frame.truncated:
                # Interrupted/partial actuation: mid-stroke fault marker.
                mx, my = self._xy(self._layout.path[1])
                c.create_text(
                    mx, my - 24, text="✕ FAULT", fill=_PURPLE,
                    font=("TkDefaultFont", 11, "bold"),
                    tags=("dynamic", "fault_marker"),
                )
            return
        # SINGLE: one pill travels the path and drops at release.
        self._draw_pill(rx, ry + 18, frame.pill, _GREEN, tags=("dynamic",))


def run_player(source: RunSource, session: PlaybackSession) -> int:
    """Open the player window for a run source; exit 0 when closed."""
    events = source.events()
    layout = build_layout(
        source.mechanism, geometry_approximate=source.geometry_approximate
    )
    app = PlayerApp(source, session, events, layout)
    try:
        app.run()
    finally:
        app.destroy()
    return 0
