"""Unit tests for PlaybackSession navigation (T017, US3).

Seek clamps at both ends; step(±1) pauses; next/previous failure via
SpanIndex with jam spans counting once at their start; speed
doubles/halves and clamps at [0.25, 120]; changing speed never re-derives
frames or alters annotations (position untouched).
"""

from dispenser_sim.animation.player import (
    MAX_SPEED,
    MIN_SPEED,
    PlaybackSession,
    PlaybackState,
)
from dispenser_sim.animation.spans import SpanIndex
from dispenser_sim.models.events import DispenseEvent, Outcome


def _events(modes: list[str | None]) -> list[DispenseEvent]:
    events = []
    for index, mode in enumerate(modes):
        if mode is None:
            events.append(
                DispenseEvent(
                    cycle_index=index, pills_dispensed=1,
                    outcome=Outcome.SINGLE,
                )
            )
        else:
            events.append(
                DispenseEvent(
                    cycle_index=index, pills_dispensed=0,
                    outcome=Outcome.ZERO_DOSE, failure_mode=mode,
                )
            )
    return events


# violations at 2 (jam span 2-4), 6 (missed dispense)
MODES = [None, None, "JAM", "JAM", "JAM", None, "MISSED_DISPENSE", None]


def _session() -> PlaybackSession:
    events = _events(MODES)
    return PlaybackSession(len(events), SpanIndex(events))


class TestSeekAndStep:
    def test_initial_state_paused_at_start_cycle(self):
        events = _events(MODES)
        session = PlaybackSession(len(events), SpanIndex(events), start_cycle=3)
        assert session.position == 3
        assert session.state is PlaybackState.PAUSED

    def test_seek_clamps_at_both_ends(self):
        session = _session()
        assert session.seek(-5) == 0
        assert session.seek(10**6) == len(MODES) - 1
        assert session.state is PlaybackState.PAUSED

    def test_step_pauses_and_clamps(self):
        session = _session()
        session.play()
        session.step(1)
        assert session.state is PlaybackState.PAUSED
        assert session.position == 1
        session.seek(0)
        assert session.step(-1) == 0  # clamped at the start
        session.seek(len(MODES) - 1)
        assert session.step(1) == len(MODES) - 1  # clamped at the end

    def test_playing_off_the_end_lands_paused_on_last_cycle(self):
        session = _session()
        session.seek(len(MODES) - 1)
        session.play()
        session.advance()
        assert session.position == len(MODES) - 1
        assert session.state is PlaybackState.PAUSED

    def test_advance_while_paused_is_a_noop(self):
        session = _session()
        assert session.advance() == 0


class TestFailureNavigation:
    def test_next_failure_jam_span_counts_once(self):
        session = _session()
        assert session.next_failure() == 2
        assert session.next_failure() == 6  # span 2-4 counted once, at 2
        assert session.next_failure() is None
        assert session.position == 6

    def test_previous_failure(self):
        session = _session()
        session.seek(7)
        assert session.previous_failure() == 6
        assert session.previous_failure() == 2
        assert session.previous_failure() is None

    def test_navigation_pauses(self):
        session = _session()
        session.play()
        session.next_failure()
        assert session.state is PlaybackState.PAUSED


class TestSpeed:
    def test_speed_doubles_halves_and_clamps(self):
        session = _session()
        assert session.speed == 4.0
        assert session.faster() == 8.0
        session.set_speed(MAX_SPEED)
        assert session.faster() == MAX_SPEED
        session.set_speed(MIN_SPEED)
        assert session.slower() == MIN_SPEED

    def test_set_speed_clamps(self):
        session = _session()
        assert session.set_speed(10**6) == MAX_SPEED
        assert session.set_speed(0) == MIN_SPEED

    def test_speed_change_never_touches_position_or_annotations(self):
        session = _session()
        session.seek(2)
        before = session.position
        session.faster()
        session.slower()
        assert session.position == before  # frames/annotations untouched
