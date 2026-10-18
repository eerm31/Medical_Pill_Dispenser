"""Shared pytest fixtures (T002): display/Tk-availability auto-skip.

GUI tests use the ``requires_display`` marker or the ``tk_display``
fixture; both skip cleanly on headless machines (no $DISPLAY, Tk not
installed, or Tk() failing to connect to a window server) so the suite is
green in CI per research.md Decision 7.
"""

import pytest


def _tk_available() -> bool:
    try:
        import tkinter
    except ImportError:
        return False
    try:
        root = tkinter.Tk()
    except tkinter.TclError:
        return False  # no display / window server
    root.destroy()
    return True


#: Evaluated once at collection so the skipif marker works.
TK_AVAILABLE = _tk_available()

#: Auto-skip marker for GUI tests: pytest.mark.requires_display.
requires_display = pytest.mark.skipif(
    not TK_AVAILABLE, reason="no display/Tk available (headless)"
)


@pytest.fixture
def tk_display():
    """Fixture variant of the auto-skip for GUI tests."""
    if not TK_AVAILABLE:
        pytest.skip("no display/Tk available (headless)")
