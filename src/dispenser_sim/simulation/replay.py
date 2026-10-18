"""Run record loading and replay (T031, US3, SC-004, FR-016/017).

Loads a persisted run.json, reconstructs the engine inputs from the embedded
mechanism config, pill distribution, envelope, and seed, re-executes, and
verifies per-cycle outcomes match the recorded events exactly. This is the
library mechanism behind quickstart Scenario 4 and the `report` subcommand's
record loading (T028).

Loading notes:
- The persisted ``pill_distribution.flags`` array is recomputed by
  PillDistribution.from_dict (flags are deterministic from the ranges), so
  it is dropped before re-validation.
- The persisted ``envelope`` section carries ``violated``/``violations``
  annotations added by the writer; those are returned separately and dropped
  before re-validation.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from ..models.distribution import PillDistribution
from ..models.envelope import PortabilityEnvelope
from ..models.events import DispenseEvent, Outcome
from ..models.mechanism import MechanismConfig
from .engine import SimulationRun, run_simulation

_SCHEMA_VERSION = "1.0"


@dataclass(frozen=True)
class LoadedRun:
    """A run.json record reconstructed into engine inputs plus events."""

    run: SimulationRun
    violations: list[str]  # envelope violation strings from the record


def load_run_record(path: str | Path) -> LoadedRun:
    """Load a run.json record and reconstruct its SimulationRun.

    Raises ValueError naming the path and the parse/validation problem when
    the record is unreadable (contracts/cli-contract.md errors table).
    """
    path = Path(path)
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise ValueError(f"{path}: file not found") from exc
    try:
        record = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{path}: malformed JSON: {exc}") from exc
    if not isinstance(record, dict):
        raise ValueError(f"{path}: run record must be a JSON object")
    if record.get("schema_version") != _SCHEMA_VERSION:
        raise ValueError(
            f"{path}: unsupported schema_version "
            f"{record.get('schema_version')!r} (expected {_SCHEMA_VERSION!r})"
        )
    try:
        mechanism = MechanismConfig.from_dict(
            record["mechanism_config"], source=f"{path}: mechanism_config"
        )
        dist_data = dict(record["pill_distribution"])
        dist_data.pop("flags", None)  # recomputed deterministically on load
        distribution = PillDistribution.from_dict(
            dist_data, source=f"{path}: pill_distribution"
        )
        envelope_section = record["envelope"]
        envelope_data = {
            key: value
            for key, value in envelope_section.items()
            if key not in ("violated", "violations")
        }
        envelope = PortabilityEnvelope.from_dict(
            envelope_data, source=f"{path}: envelope"
        )
        events = [
            DispenseEvent(
                cycle_index=int(entry["cycle_index"]),
                pills_dispensed=int(entry["pills_dispensed"]),
                outcome=Outcome(entry["outcome"]),
                failure_mode=entry["failure_mode"],
                jam_persistent=bool(entry["jam_persistent"]),
                pill_state=entry["pill_state"],
            )
            for entry in record["events"]
        ]
        run = SimulationRun(
            run_id=str(record["run_id"]),
            created_utc=str(record["created_utc"]),
            seed=int(record["seed"]),
            mechanism_config=mechanism,
            pill_distribution=distribution,
            envelope=envelope,
            cycles_requested=int(record["cycles_requested"]),
            events=events,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"{path}: invalid run record: {exc}") from exc
    violations = [str(v) for v in envelope_section.get("violations", [])]
    return LoadedRun(run=run, violations=violations)


def replay_run(loaded: LoadedRun) -> SimulationRun:
    """Re-execute the recorded seed + config and return the fresh run."""
    recorded = loaded.run
    return run_simulation(
        recorded.mechanism_config,
        recorded.pill_distribution,
        recorded.envelope,
        recorded.cycles_requested,
        seed=recorded.seed,
    )


def verify_replay(loaded: LoadedRun) -> list[int]:
    """Return the cycle indices whose replayed outcome differs from the record.

    An empty list means identical per-cycle outcomes (SC-004).
    """
    replayed = replay_run(loaded)
    recorded_events = [event.to_dict() for event in loaded.run.events]
    replayed_events = [event.to_dict() for event in replayed.events]
    mismatches: list[int] = []
    for index, (expected, actual) in enumerate(
        zip(recorded_events, replayed_events)
    ):
        if expected != actual:
            mismatches.append(index)
    if len(replayed_events) != len(recorded_events):
        mismatches.append(-1)  # length mismatch sentinel
    return mismatches
