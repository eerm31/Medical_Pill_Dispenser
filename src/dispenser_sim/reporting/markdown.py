"""Markdown report generation (T027, FR-020, SC-006).

Renders report.md with sections in the order required by
contracts/run-record-schema.md: run identity; mechanism + distribution
digest; envelope validation; aggregate success rate with PASS/FAIL vs the
99.5% threshold; per-category success-rate table; failure-mode breakdown
table; notable cycle ranges (jam-persistence spans). Rendering is a pure
function of the run record, so the `report` subcommand regenerates a
byte-identical report.md from run.json.
"""

from __future__ import annotations

from ..mechanism.validation import EnvelopeViolation
from ..simulation.engine import SimulationRun


def render_markdown(
    run: SimulationRun,
    summary: dict,
    violations: list[EnvelopeViolation] | list[str] | None,
) -> str:
    """Render the human-readable design-review report (report.md).

    ``violations`` may be EnvelopeViolation objects (fresh run) or the
    strings persisted in run.json's envelope section (regenerated report);
    both render identically.
    """
    lines: list[str] = []
    lines.append(f"# Simulation Run {run.run_id}")
    lines.append("")
    lines.append("## Run identity")
    lines.append("")
    lines.append(f"- run_id: `{run.run_id}`")
    lines.append(f"- seed: `{run.seed}`")
    lines.append(f"- created_utc: {run.created_utc}")
    lines.append(f"- cycles: {run.cycles_completed} of {run.cycles_requested}")
    lines.append("")
    lines.append("## Mechanism and distribution digest")
    lines.append("")
    mech = run.mechanism_config
    lines.append(f"- mechanism: `{mech.name}`")
    lines.append(f"- passage_clearance_mm: {mech.passage_clearance_mm}")
    lines.append(f"- actuation_energy_j: {mech.actuation_energy_j}")
    lines.append(f"- reservoir_capacity: {mech.reservoir_capacity}")
    dist = run.pill_distribution
    weights = ", ".join(
        f"{shape.value}={dist.category_weights[shape]}"
        for shape in sorted(dist.category_weights, key=lambda s: s.value)
    )
    lines.append(f"- pill distribution: reservoir_size={dist.reservoir_size}, {weights}")
    if dist.flags:
        lines.append("- distribution flags (FR-009):")
        for flag in dist.flags:
            lines.append(f"  - {flag}")
    lines.append("")
    lines.append("## Envelope validation")
    lines.append("")
    if violations:
        lines.append("**VIOLATED** (run executed with --allow-envelope-violation):")
        for violation in violations:
            lines.append(f"- {violation}")
    else:
        lines.append("VALID: no portability constraints violated.")
    lines.append("")
    lines.append("## Single-dispense reliability")
    lines.append("")
    verdict = "PASS" if summary["pass"] else "FAIL"
    lines.append(
        f"Aggregate single-dispense success rate: "
        f"**{summary['single_dispense_success_rate']:.4f}** — "
        f"**{verdict}** vs {summary['pass_threshold']:.3f} threshold (SC-002)."
    )
    lines.append("")
    lines.append("| Outcome | Count | Rate |")
    lines.append("|---|---|---|")
    for key in ("single_dose", "zero_dose", "multi_dose", "no_pill_available"):
        entry = summary[key]
        lines.append(f"| {key} | {entry['count']} | {entry['rate']:.4f} |")
    lines.append("")
    lines.append("## Per-category success rates")
    lines.append("")
    lines.append("| Shape category | Cycles | Success rate |")
    lines.append("|---|---|---|")
    for shape, entry in summary["per_category"].items():
        lines.append(f"| {shape} | {entry['cycles']} | {entry['success_rate']:.4f} |")
    lines.append("")
    lines.append("## Failure-mode breakdown")
    lines.append("")
    breakdown = summary["failure_mode_breakdown"]
    if breakdown:
        lines.append("| Failure mode | Violations |")
        lines.append("|---|---|")
        for mode, count in sorted(breakdown.items()):
            lines.append(f"| {mode} | {count} |")
    else:
        lines.append("No invariant violations recorded.")
    lines.append("")
    lines.append("## Notable cycle ranges")
    lines.append("")
    spans = summary["jam_persistence_spans"]
    if spans:
        lines.append("Jam-persistence spans (cycles where a jam carried over):")
        for span in spans:
            lines.append(
                f"- cycles {span['start_cycle']}..{span['end_cycle']}"
            )
    else:
        lines.append("No jam persistence observed.")
    lines.append("")
    return "\n".join(lines)
