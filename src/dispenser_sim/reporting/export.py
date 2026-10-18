"""Run record writers (T020): run.json, cycles.csv, report.md.

Artifacts follow contracts/run-record-schema.md exactly. The writer enforces
the schema invariants: events length == cycles_completed == cycles_requested
(SC-001), one outcome per event, NO_PILL_AVAILABLE excluded from violations
(FR-012), and the failure-mode breakdown sums exactly to the number of
zero-dose + multi-dose violations (SC-003) — violations not attributed by a
classifier are counted as UNCLASSIFIED (FR-014).

Summary computation lives in reporting/report.py (T026) and Markdown
rendering in reporting/markdown.py (T027); the cycles.csv and report.md
writers are exposed so the `report` subcommand (T028) can regenerate
byte-identical artifacts from a persisted run.json.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from ..mechanism.validation import EnvelopeViolation
from ..simulation.engine import SimulationRun
from .markdown import render_markdown
from .report import compute_summary

SCHEMA_VERSION = "1.0"

CSV_HEADER = (
    "cycle_index,pills_dispensed,outcome,failure_mode,jam_persistent,"
    "pill_shape,pill_length_mm,pill_width_mm,pill_friction,pill_orientation_deg"
)


def _envelope_section(
    run: SimulationRun, violations: list[EnvelopeViolation] | None
) -> dict:
    section = run.envelope.to_dict()
    section["violated"] = bool(violations)
    section["violations"] = [str(v) for v in violations or []]
    return section


def write_cycles_csv(run: SimulationRun, csv_path: str | Path) -> Path:
    """Write cycles.csv: header plus one row per cycle, ordered, no gaps."""
    csv_path = Path(csv_path)
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        fh.write(CSV_HEADER + "\n")
        writer = csv.writer(fh)
        for event in run.events:
            state = event.pill_state or {}
            writer.writerow(
                [
                    event.cycle_index,
                    event.pills_dispensed,
                    event.outcome.value,
                    event.failure_mode or "",
                    str(event.jam_persistent).lower(),
                    state.get("shape", ""),
                    state.get("length_mm", ""),
                    state.get("width_mm", ""),
                    state.get("friction_coefficient", ""),
                    state.get("orientation_deg", ""),
                ]
            )
    return csv_path


def write_report_md(
    run: SimulationRun,
    summary: dict,
    violations: list[EnvelopeViolation] | list[str] | None,
    report_path: str | Path,
) -> Path:
    """Write report.md rendered from the run record (byte-stable)."""
    report_path = Path(report_path)
    report_path.write_text(
        render_markdown(run, summary, violations), encoding="utf-8"
    )
    return report_path


def write_run(
    run: SimulationRun,
    out_dir: str | Path,
    *,
    violations: list[EnvelopeViolation] | None = None,
) -> Path:
    """Write run.json, cycles.csv, and report.md; return the run directory.

    Enforces the record invariants before writing (SC-001).
    """
    if len(run.events) != run.cycles_requested:
        raise ValueError(
            f"run has {len(run.events)} events but "
            f"{run.cycles_requested} cycles were requested (SC-001)"
        )
    indices = [event.cycle_index for event in run.events]
    if indices != list(range(run.cycles_requested)):
        raise ValueError("event cycle_index sequence has gaps (SC-001)")

    summary = compute_summary(run)
    run_dir = Path(out_dir) / run.run_id
    run_dir.mkdir(parents=True, exist_ok=False)

    record = {
        "schema_version": SCHEMA_VERSION,
        **run.to_dict(),
        "envelope": _envelope_section(run, violations),
        "summary": summary,
    }
    (run_dir / "run.json").write_text(
        json.dumps(record, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    write_cycles_csv(run, run_dir / "cycles.csv")
    write_report_md(run, summary, violations, run_dir / "report.md")
    return run_dir
