"""Replay-only animation of recorded simulation runs (feature 002).

Pure, display-free core: loader (run.json / cycles.csv), frames (per-cycle
visual state derived from the record), spans (jam-span coalescing and
violation navigation), player (playback state machine), geometry
(config-driven layout templates). The Tkinter view lives in
``animation.tkview``, the only module that imports tkinter; it is imported
lazily by the ``animate`` CLI subcommand so every other entry point works
with no display and no Tk installed.
"""
