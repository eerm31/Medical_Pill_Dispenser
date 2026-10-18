"""Run loading for the animation player (T003, FR-001/002/003).

A ``RunSource`` provides the ordered ``DispenseEvent`` sequence plus
mechanism context to the replay player — the Phase-2 live-animation seam
(research.md Decision 9): a future engine-driven source implements the
same protocol with no changes to frames/spans/player/tkview.

``JsonRunSource`` wraps ``simulation.replay.load_run_record`` (run.json is
canonical, per specs/001 contracts/run-record-schema.md). ``CsvRunSource``
reconstructs events from cycles.csv rows when run.json is absent
(FR-003 geometry-approximate mode: ``mechanism=None``,
``geometry_approximate=True``).

Load-time validation (contracts/cli-contract.md errors table): events must
be non-empty, ordered, and contiguous by ``cycle_index``; missing paths,
malformed JSON, bad schema_version, gapped/reordered cycles, and
directories with neither run.json nor cycles.csv are all load errors
(``ValueError`` carrying ``<path>: <reason>``).
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Protocol, runtime_checkable

from ..models.events import DispenseEvent, Outcome
from ..models.mechanism import MechanismConfig
from ..simulation.replay import load_run_record

#: cycles.csv columns (contracts/run-record-schema.md, reporting/export.py).
_PILL_COLUMNS = {
    "pill_shape": "shape",
    "pill_length_mm": "length_mm",
    "pill_width_mm": "width_mm",
    "pill_friction": "friction_coefficient",
    "pill_orientation_deg": "orientation_deg",
}


@runtime_checkable
class RunSource(Protocol):
    """Ordered event sequence plus mechanism context (Decision 9 seam)."""

    @property
    def run_id(self) -> str: ...

    @property
    def seed(self) -> int | None: ...

    @property
    def mechanism(self) -> MechanismConfig | None: ...

    @property
    def geometry_approximate(self) -> bool: ...

    def events(self) -> list[DispenseEvent]:
        """The run's events, ordered and contiguous by cycle_index."""
        ...


def _validate_events(path: Path, events: list[DispenseEvent]) -> None:
    """Events must be non-empty, ordered, and contiguous (SC-001)."""
    if not events:
        raise ValueError(f"{path}: run record contains no events")
    indices = [event.cycle_index for event in events]
    if indices != list(range(len(events))):
        raise ValueError(
            f"{path}: event cycle_index sequence has gaps or is reordered "
            f"(expected contiguous 0..{len(events) - 1})"
        )


class JsonRunSource:
    """Run source backed by the canonical run.json record."""

    geometry_approximate = False

    def __init__(self, path: str | Path) -> None:
        self._path = Path(path)
        loaded = load_run_record(self._path)
        _validate_events(self._path, loaded.run.events)
        self._run = loaded.run

    @property
    def run_id(self) -> str:
        return self._run.run_id

    @property
    def seed(self) -> int | None:
        return self._run.seed

    @property
    def mechanism(self) -> MechanismConfig | None:
        return self._run.mechanism_config

    def events(self) -> list[DispenseEvent]:
        return self._run.events


class CsvRunSource:
    """Run source reconstructed from cycles.csv (FR-003 fallback).

    Geometry is approximate (no embedded mechanism config); the pill
    snapshot is rebuilt from the CSV's pill_* columns and is ``None`` for
    cycles that recorded no pill.
    """

    mechanism = None
    seed = None
    geometry_approximate = True

    def __init__(self, path: str | Path) -> None:
        self._path = Path(path)
        self._events = self._load_events(self._path)
        _validate_events(self._path, self._events)

    @property
    def run_id(self) -> str:
        return f"{self._path.resolve().parent.name}-csv"

    def events(self) -> list[DispenseEvent]:
        return self._events

    @staticmethod
    def _load_events(path: Path) -> list[DispenseEvent]:
        try:
            text = path.read_text(encoding="utf-8")
        except FileNotFoundError as exc:
            raise ValueError(f"{path}: file not found") from exc
        try:
            rows = list(csv.DictReader(text.splitlines()))
        except csv.Error as exc:
            raise ValueError(f"{path}: invalid cycles.csv: {exc}") from exc
        events: list[DispenseEvent] = []
        for line, row in enumerate(rows, start=2):  # header is line 1
            try:
                pill_state = None
                if row.get("pill_shape"):
                    pill_state = {
                        "shape": row["pill_shape"],
                        "length_mm": float(row["pill_length_mm"]),
                        "width_mm": float(row["pill_width_mm"]),
                        "friction_coefficient": float(row["pill_friction"]),
                        "orientation_deg": float(row["pill_orientation_deg"]),
                    }
                events.append(
                    DispenseEvent(
                        cycle_index=int(row["cycle_index"]),
                        pills_dispensed=int(row["pills_dispensed"]),
                        outcome=Outcome(row["outcome"]),
                        failure_mode=row["failure_mode"] or None,
                        jam_persistent=row["jam_persistent"].strip().lower()
                        == "true",
                        pill_state=pill_state,
                    )
                )
            except (KeyError, TypeError, ValueError) as exc:
                raise ValueError(
                    f"{path}: invalid cycles.csv row {line}: {exc}"
                ) from exc
        return events


def load_run_source(path: str | Path) -> RunSource:
    """Load a run directory (or a run.json directly) as a RunSource.

    Prefers run.json when both artifacts exist. Raises ValueError with the
    contract's messages for missing paths, unreadable records, and
    directories holding neither run.json nor cycles.csv.
    """
    path = Path(path)
    if not path.exists():
        raise ValueError(f"{path}: file not found")
    if path.is_file():
        return JsonRunSource(path)
    run_json = path / "run.json"
    if run_json.is_file():
        return JsonRunSource(run_json)
    cycles_csv = path / "cycles.csv"
    if cycles_csv.is_file():
        return CsvRunSource(cycles_csv)
    raise ValueError(
        f"{path}: no run record (run.json) or per-cycle export "
        "(cycles.csv) found"
    )
