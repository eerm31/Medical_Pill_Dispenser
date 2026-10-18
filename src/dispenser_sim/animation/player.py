"""PlaybackSession state machine (T010, FR-012; data-model.md).

Pure, display-free playback state over a run's cycle sequence: position,
PLAYING/PAUSED/STOPPED, speed clamped to [0.25, 120] cycles/s,
play/pause/step(±1)/seek(n) clamped at both ends, and SpanIndex-based
next/previous failure navigation. Any step/seek forces PAUSED; playing off
the end lands on the last cycle PAUSED. Changing speed never re-derives
frames and never alters annotations (FR-012 acceptance). Seeks and
failure jumps complete without rendering intermediate cycles (SC-004).
"""

from __future__ import annotations

from enum import Enum

from .spans import SpanIndex

MIN_SPEED = 0.25  # cycles per second
MAX_SPEED = 120.0


class PlaybackState(str, Enum):
    PLAYING = "PLAYING"
    PAUSED = "PAUSED"
    STOPPED = "STOPPED"


def _clamp_speed(speed: float) -> float:
    return min(MAX_SPEED, max(MIN_SPEED, float(speed)))


class PlaybackSession:
    """Viewer state over a run's cycle sequence (FR-012/013)."""

    def __init__(
        self,
        cycle_count: int,
        span_index: SpanIndex,
        *,
        speed: float = 4.0,
        start_cycle: int = 0,
    ) -> None:
        if cycle_count < 1:
            raise ValueError(f"cycle_count must be >= 1, got {cycle_count}")
        self._cycle_count = cycle_count
        self.span_index = span_index
        self._speed = _clamp_speed(speed)
        self._state = PlaybackState.STOPPED
        self._position = 0
        self.seek(start_cycle)  # clamps and lands PAUSED at the start cycle

    @property
    def cycle_count(self) -> int:
        return self._cycle_count

    @property
    def position(self) -> int:
        return self._position

    @property
    def state(self) -> PlaybackState:
        return self._state

    @property
    def speed(self) -> float:
        return self._speed

    @property
    def is_playing(self) -> bool:
        return self._state is PlaybackState.PLAYING

    def _clamp_position(self, index: int) -> int:
        return min(self._cycle_count - 1, max(0, int(index)))

    # -- transport -----------------------------------------------------

    def play(self) -> None:
        self._state = PlaybackState.PLAYING

    def pause(self) -> None:
        self._state = PlaybackState.PAUSED

    def toggle(self) -> None:
        """Space: PLAYING ⇄ PAUSED (STOPPED starts playback)."""
        self._state = (
            PlaybackState.PAUSED if self.is_playing else PlaybackState.PLAYING
        )

    def step(self, delta: int) -> int:
        """Single-step; pauses and clamps at both ends. Returns position."""
        self._state = PlaybackState.PAUSED
        self._position = self._clamp_position(self._position + delta)
        return self._position

    def seek(self, index: int) -> int:
        """Jump to cycle; pauses and clamps. Returns the landed position."""
        self._state = PlaybackState.PAUSED
        self._position = self._clamp_position(index)
        return self._position

    def advance(self) -> int:
        """Advance one cycle while PLAYING (timer tick from the view).

        Playing off the end lands on the last cycle PAUSED (data-model).
        Returns the current position.
        """
        if not self.is_playing:
            return self._position
        if self._position >= self._cycle_count - 1:
            self._state = PlaybackState.PAUSED
            return self._position
        self._position += 1
        return self._position

    # -- speed ---------------------------------------------------------

    def set_speed(self, speed: float) -> float:
        """Set cycles/second clamped to [0.25, 120]; returns the actual."""
        self._speed = _clamp_speed(speed)
        return self._speed

    def faster(self) -> float:
        """'+' doubles speed, clamped. Never re-derives frames."""
        return self.set_speed(self._speed * 2)

    def slower(self) -> float:
        """'-' halves speed, clamped. Never re-derives frames."""
        return self.set_speed(self._speed / 2)

    # -- failure navigation (FR-013) -----------------------------------

    def next_failure(self) -> int | None:
        """Seek to the next violation cycle (jam span counts once)."""
        target = self.span_index.next_failure(self._position)
        if target is None:
            return None
        return self.seek(target)

    def previous_failure(self) -> int | None:
        """Seek to the previous violation cycle (jam span counts once)."""
        target = self.span_index.previous_failure(self._position)
        if target is None:
            return None
        return self.seek(target)
