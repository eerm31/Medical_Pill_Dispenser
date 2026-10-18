"""Side-by-side mechanism comparison report (T033, US3).

Renders comparison.md for >= 2 mechanisms evaluated under an identical seed
and pill distribution: aggregate single-dispense success rates with
PASS/FAIL verdicts vs the 99.5% threshold, per-category success rates, and
failure-mode breakdowns, side by side (contracts/cli-contract.md `compare`).
"""

from __future__ import annotations

from pathlib import Path

from ..mechanism.validation import EnvelopeViolation
from ..simulation.engine import SimulationRun
from .report import compute_summary


def render_comparison(
    runs: list[SimulationRun],
    violations: list[list[EnvelopeViolation] | None] | None = None,
) -> str:
    """Render the side-by-side comparison Markdown for ``runs``.

    All runs must share the same seed and pill distribution (the compare
    subcommand guarantees this). Deterministic given the runs.
    """
    if len(runs) < 2:
        raise ValueError(f"comparison requires >= 2 runs, got {len(runs)}")
    names = [run.mechanism_config.name for run in runs]
    if len(set(names)) != len(names):
        raise ValueError(f"mechanism names must be unique, got {names}")
    summaries = [compute_summary(run) for run in runs]
    seed = runs[0].seed

    lines: list[str] = []
    lines.append("# Mechanism Comparison")
    lines.append("")
    lines.append(f"- seed: `{seed}` (identical for every mechanism)")
    lines.append(f"- cycles: {runs[0].cycles_completed} per mechanism")
    dist = runs[0].pill_distribution
    weights = ", ".join(
        f"{shape.value}={dist.category_weights[shape]}"
        for shape in sorted(dist.category_weights, key=lambda s: s.value)
    )
    lines.append(f"- pill distribution: reservoir_size={dist.reservoir_size}, {weights}")
    lines.append("")

    lines.append("## Aggregate single-dispense success rate")
    lines.append("")
    header = "| Mechanism | Success rate | Verdict vs 0.995 |"
    lines.append(header)
    lines.append("|---|---|---|")
    for name, summary in zip(names, summaries):
        verdict = "PASS" if summary["pass"] else "FAIL"
        lines.append(
            f"| {name} | {summary['single_dispense_success_rate']:.4f} | {verdict} |"
        )
    lines.append("")

    lines.append("## Per-category success rates")
    lines.append("")
    lines.append("| Shape category | " + " | ".join(names) + " |")
    lines.append("|" + "---|" * (len(names) + 1))
    categories = sorted(
        {shape for summary in summaries for shape in summary["per_category"]}
    )
    for category in categories:
        cells = []
        for summary in summaries:
            entry = summary["per_category"].get(category)
            cells.append(
                f"{entry['success_rate']:.4f} ({entry['cycles']} cycles)"
                if entry
                else "-"
            )
        lines.append(f"| {category} | " + " | ".join(cells) + " |")
    lines.append("")

    lines.append("## Failure-mode breakdown")
    lines.append("")
    lines.append("| Failure mode | " + " | ".join(names) + " |")
    lines.append("|" + "---|" * (len(names) + 1))
    modes = sorted(
        {
            mode
            for summary in summaries
            for mode in summary["failure_mode_breakdown"]
        }
    )
    if modes:
        for mode in modes:
            counts = [
                str(summary["failure_mode_breakdown"].get(mode, 0))
                for summary in summaries
            ]
            lines.append(f"| {mode} | " + " | ".join(counts) + " |")
    else:
        lines.append(
            "| (none) | " + " | ".join("0" for _ in names) + " |"
        )
    lines.append("")

    lines.append("## Outcome totals")
    lines.append("")
    lines.append(
        "| Outcome | " + " | ".join(names) + " |"
    )
    lines.append("|" + "---|" * (len(names) + 1))
    for key in ("single_dose", "zero_dose", "multi_dose", "no_pill_available"):
        counts = [str(summary[key]["count"]) for summary in summaries]
        lines.append(f"| {key} | " + " | ".join(counts) + " |")
    lines.append("")

    lines.append("## Run records")
    lines.append("")
    for index, run in enumerate(runs):
        flagged = violations and violations[index]
        note = (
            " — envelope VIOLATED (ran with --allow-envelope-violation)"
            if flagged
            else ""
        )
        lines.append(f"- {run.mechanism_config.name}: run_id `{run.run_id}`{note}")
    lines.append("")
    return "\n".join(lines)


def write_comparison(
    runs: list[SimulationRun],
    out_dir: str | Path,
    *,
    violations: list[list[EnvelopeViolation] | None] | None = None,
) -> Path:
    """Write comparison.md into ``out_dir`` and return its path."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    comparison_path = out_dir / "comparison.md"
    comparison_path.write_text(
        render_comparison(runs, violations), encoding="utf-8"
    )
    return comparison_path
