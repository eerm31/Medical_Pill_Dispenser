"""GUI smoke + navigation tests for the Tkinter player (T015/T020).

Auto-skipped on headless machines via the requires_display marker /
tk_display fixture (T002). Covers quickstart scenarios 1, 4, 7: the player
opens paused at cycle 0, Space plays, annotations match the record for
spot-checked cycles; jump to cycle 9999, previous-failure navigation, and
backward single-stepping through a jam span with the continuous band and
stuck-pill persistence; quitting exits 0.
"""

import pytest

from dispenser_sim.animation.loader import load_run_source
from dispenser_sim.animation.player import PlaybackSession, PlaybackState
from dispenser_sim.animation.spans import SpanIndex
from dispenser_sim.models.events import Outcome

from conftest import requires_display

pytestmark = requires_display

import contextlib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RUN_DIR = REPO_ROOT / "runs" / "00d370d37c0b"  # 10,000 cycles, seed 42


@contextlib.contextmanager
def make_app(run_dir=RUN_DIR):
    from dispenser_sim.animation import tkview

    source = load_run_source(run_dir)
    events = source.events()
    session = PlaybackSession(len(events), SpanIndex(events))
    layout = tkview.build_layout(
        source.mechanism, geometry_approximate=source.geometry_approximate
    )
    app = tkview.PlayerApp(source, session, events, layout)
    try:
        yield app, events
    finally:
        app.destroy()


class TestPlayerSmoke:
    def test_opens_paused_at_cycle_0_space_plays(self):
        with make_app() as (app, events):
            assert app.session.state is PlaybackState.PAUSED
            assert app.session.position == 0
            app.on_key("space")
            assert app.session.state is PlaybackState.PLAYING
            app.on_key("space")
            assert app.session.state is PlaybackState.PAUSED

    def test_annotation_matches_record_for_spot_checked_cycles(self):
        with make_app() as (app, events):
            for index in (0, 1, 500, 9999):
                app.jump_to(index)
                event = events[index]
                text = app.annotation_text()
                assert f"cycle {index} / 10000" in text
                assert event.outcome.value in text
                if event.failure_mode is not None:
                    assert event.failure_mode in text
                if event.pills_dispensed >= 2:
                    assert f"×{event.pills_dispensed} released" in text

    def test_quit_destroys_window(self):
        import tkinter

        with make_app() as (app, _):
            app.on_key("q")
            # Reaching here without TclError means quit succeeded; the
            # CLI returns 0 after the window closes (run_player).
            with pytest.raises(tkinter.TclError):
                app.canvas.winfo_exists()


class TestLongRunNavigation:
    def test_jump_previous_failure_step_back_through_jam_span(self):
        with make_app() as (app, events):
            assert app.jump_to(9999) == 9999
            assert app.session.state is PlaybackState.PAUSED
            landed = app.session.previous_failure()
            assert landed is not None
            app.render()
            event = events[landed]
            assert event.failure_mode is not None
            assert event.failure_mode in app.annotation_text()
            # Step backward through the record; annotations stay correct.
            for _ in range(3):
                app.on_key("Left")
                current = events[app.session.position]
                assert current.outcome.value in app.annotation_text()

    def test_jam_span_band_and_stuck_pill_persist(self):
        with make_app() as (app, events):
            span = app.session.span_index.spans[0] if app.session.span_index.spans else None
            assert span is not None, "seed-42 run should contain a jam span"
            app.canvas.update_idletasks()
            # One continuous band per span on the timeline.
            bands = app.canvas.find_withtag("jam_band")
            assert bands, "jam spans must render as timeline bands"
            for cycle in range(span.start_cycle, span.end_cycle + 1):
                app.jump_to(cycle)
                assert "JAM" in app.annotation_text()
                app.canvas.update_idletasks()
                assert app.canvas.find_withtag("stuck_pill"), (
                    f"stuck pill must persist across the span (cycle {cycle})"
                )

    def test_depletion_marked_and_never_misrepresented(self):
        with make_app() as (app, events):
            depleted = next(
                (e.cycle_index for e in events
                 if e.outcome is Outcome.NO_PILL_AVAILABLE),
                None,
            )
            if depleted is None:
                pytest.skip("seed-42 run never depletes its reservoir")
            app.jump_to(depleted)
            app.canvas.update_idletasks()
            assert app.canvas.find_withtag("reservoir_empty")
            assert "NO_PILL_AVAILABLE" in app.annotation_text()
