"""Command-line interface (T021, extended by T028/T034 for US2/US3):
validate / run / report / compare subcommands.

Per contracts/cli-contract.md: exit 0 on success, exit 1 with a
human-readable stderr message on validation or runtime failure, exit 2 for
usage errors (argparse). `validate` prints each violated envelope constraint
or VALID; `run` refuses envelope-violating configs unless
--allow-envelope-violation is passed and prints the run directory path as
the last stdout line; `report` regenerates byte-identical report.md and
cycles.csv from an existing run.json; `compare` runs >= 2 mechanisms under
an identical seed and writes one run directory per mechanism plus
comparison.md.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .mechanism.validation import validate_envelope
from .models.distribution import PillDistribution
from .models.envelope import PortabilityEnvelope
from .models.mechanism import MechanismConfig
from .reporting.comparison import write_comparison
from .reporting.export import write_cycles_csv, write_report_md, write_run
from .reporting.report import compute_summary
from .simulation.engine import run_simulation
from .simulation.replay import load_run_record
from .simulation.rng import generate_seed

_DEFAULT_ENVELOPE = "configs/portability_envelope.json"


def _positive_int(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError(
            f"invalid int value: {value!r}"
        ) from None
    if parsed < 1:
        raise argparse.ArgumentTypeError("--cycles must be >= 1")
    return parsed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="dispenser-sim",
        description=(
            "Offline simulation of the smart medical dispenser's "
            "dispensing mechanism."
        ),
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    def add_common(sub: argparse.ArgumentParser) -> None:
        sub.add_argument(
            "--mechanism", required=True, help="path to mechanism config JSON"
        )
        sub.add_argument(
            "--pills", required=True, help="path to pill distribution JSON"
        )
        sub.add_argument(
            "--envelope",
            default=_DEFAULT_ENVELOPE,
            help="path to portability envelope JSON "
            f"(default: {_DEFAULT_ENVELOPE})",
        )

    validate_parser = subparsers.add_parser(
        "validate", help="check a mechanism config without running cycles"
    )
    add_common(validate_parser)

    run_parser = subparsers.add_parser(
        "run", help="execute a seeded simulation run"
    )
    add_common(run_parser)
    run_parser.add_argument(
        "--cycles", required=True, type=_positive_int,
        help="number of actuation cycles (>= 1)",
    )
    run_parser.add_argument(
        "--seed", type=int, default=None,
        help="run seed; generated and recorded when omitted (FR-015)",
    )
    run_parser.add_argument(
        "--out", default="runs/", help="output parent directory (default: runs/)"
    )
    run_parser.add_argument(
        "--allow-envelope-violation",
        action="store_true",
        help="run despite portability envelope violations (flagged in run.json)",
    )

    report_parser = subparsers.add_parser(
        "report",
        help="regenerate report.md/cycles.csv from an existing run.json",
    )
    report_parser.add_argument(
        "--run", required=True, help="path to an existing run.json record"
    )
    report_parser.add_argument(
        "--out",
        default=None,
        help="output directory (default: the run record's directory)",
    )

    compare_parser = subparsers.add_parser(
        "compare",
        help="side-by-side reliability comparison of >= 2 mechanisms",
    )
    compare_parser.add_argument(
        "--mechanism",
        required=True,
        action="append",
        help="path to a mechanism config JSON (repeat for >= 2 mechanisms)",
    )
    compare_parser.add_argument(
        "--pills", required=True, help="path to pill distribution JSON"
    )
    compare_parser.add_argument(
        "--envelope",
        default=_DEFAULT_ENVELOPE,
        help="path to portability envelope JSON "
        f"(default: {_DEFAULT_ENVELOPE})",
    )
    compare_parser.add_argument(
        "--cycles", required=True, type=_positive_int,
        help="number of actuation cycles per mechanism (>= 1)",
    )
    compare_parser.add_argument(
        "--seed", type=int, default=None,
        help="identical seed for every mechanism; generated and recorded "
        "when omitted (FR-015)",
    )
    compare_parser.add_argument(
        "--out",
        default="compare/",
        help="output directory for run dirs and comparison.md "
        "(default: compare/)",
    )
    compare_parser.add_argument(
        "--allow-envelope-violation",
        action="store_true",
        help="run despite portability envelope violations (flagged in each "
        "run record)",
    )

    animate_parser = subparsers.add_parser(
        "animate", help="replay a recorded run as a mechanism animation"
    )
    animate_parser.add_argument(
        "--run",
        required=True,
        help="path to a run directory or directly to a run.json (cycles.csv "
        "fallback: geometry-approximate mode, FR-003)",
    )
    animate_parser.add_argument(
        "--check",
        action="store_true",
        help="headless: derive every frame, verify fidelity, print summary, "
        "exit (no window, tkinter never imported)",
    )
    animate_parser.add_argument(
        "--speed",
        type=float,
        default=None,
        help="initial playback speed in cycles/second (default 4, clamped "
        "to [0.25, 120])",
    )
    animate_parser.add_argument(
        "--start-cycle",
        type=int,
        default=0,
        help="initial cycle index (default 0, clamped to the run length)",
    )
    export_parser = subparsers.add_parser(
        "export-3mf", help="export the offline rotating-dispenser concept assembly"
    )
    export_parser.add_argument(
        "--output", required=True, help="destination .3mf file (outside this project)"
    )
    export_parser.add_argument(
        "--force", action="store_true", help="replace an existing output pair outside protected trees"
    )
    return parser


def _load_configs(
    args: argparse.Namespace,
) -> tuple[MechanismConfig, PillDistribution, PortabilityEnvelope]:
    try:
        mechanism = MechanismConfig.from_json(args.mechanism)
        distribution = PillDistribution.from_json(args.pills)
        envelope = PortabilityEnvelope.from_json(args.envelope)
    except FileNotFoundError as exc:
        raise ValueError(f"config file not found: {exc.filename}") from exc
    return mechanism, distribution, envelope


def _print_run_identity(source, event_count: int) -> None:
    mode = (
        "cycles.csv (geometry approximate)"
        if source.geometry_approximate
        else "run.json"
    )
    print(f"run_id: {source.run_id}")
    print(f"cycles: {event_count} (source: {mode})")
    if source.geometry_approximate:
        print("geometry approximate (cycles.csv only)")


def _cmd_animate(args: argparse.Namespace) -> int:
    """Replay a recorded run as an animation (T012/T013, feature 002).

    --check is fully headless: the pure core (loader/frames/spans) derives
    every frame and prints a machine-verifiable summary; tkinter is never
    imported. GUI mode imports tkview lazily so all other subcommands work
    with no Tk installed (SC-005). Never writes to the run directory and
    never re-simulates (FR-002/FR-018).
    """
    from .animation.frames import derive_frame
    from .animation.loader import load_run_source
    from .animation.player import PlaybackSession
    from .animation.spans import SpanIndex

    try:
        source = load_run_source(args.run)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    events = source.events()
    span_index = SpanIndex(events)

    if args.check:
        derived = 0
        for event in events:
            derive_frame(event, span_index.span_containing(event.cycle_index))
            derived += 1
        breakdown: dict[str, int] = {}
        for event in events:
            if event.failure_mode is not None:
                breakdown[event.failure_mode] = (
                    breakdown.get(event.failure_mode, 0) + 1
                )
        _print_run_identity(source, len(events))
        if source.seed is not None:
            print(f"seed: {source.seed}")
        for mode in sorted(breakdown):
            print(f"failure_mode {mode}: {breakdown[mode]}")
        print(f"jam_spans: {len(span_index.spans)}")
        print(f"frames: OK ({derived} derived)")
        return 0

    try:
        from .animation import tkview
    except ImportError:
        print(
            "error: animation requires a display (tkinter); use --check "
            "for headless validation",
            file=sys.stderr,
        )
        return 1
    session = PlaybackSession(
        len(events),
        span_index,
        speed=args.speed if args.speed is not None else 4.0,
        start_cycle=args.start_cycle,
    )
    _print_run_identity(source, len(events))
    try:
        return tkview.run_player(source, session)
    except tkview.DisplayUnavailableError:
        print(
            "error: animation requires a display (tkinter); use --check "
            "for headless validation",
            file=sys.stderr,
        )
        return 1


def _cmd_report(args: argparse.Namespace) -> int:
    """Regenerate report.md and cycles.csv from a run.json record (T028)."""
    try:
        loaded = load_run_record(args.run)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    run = loaded.run
    summary = compute_summary(run)
    out_dir = Path(args.out) if args.out else Path(args.run).parent
    out_dir.mkdir(parents=True, exist_ok=True)
    write_cycles_csv(run, out_dir / "cycles.csv")
    write_report_md(run, summary, loaded.violations, out_dir / "report.md")
    print(f"run_id: {run.run_id}")
    print(f"cycles: {run.cycles_completed} (seed {run.seed})")
    print(out_dir)
    return 0


def _cmd_compare(args: argparse.Namespace) -> int:
    """Run >= 2 mechanisms under an identical seed and compare (T034)."""
    if len(args.mechanism) < 2:
        print(
            "error: compare requires at least 2 --mechanism configs",
            file=sys.stderr,
        )
        return 2
    try:
        distribution = PillDistribution.from_json(args.pills)
        envelope = PortabilityEnvelope.from_json(args.envelope)
        mechanisms = [
            MechanismConfig.from_json(path) for path in args.mechanism
        ]
    except FileNotFoundError as exc:
        print(f"error: config file not found: {exc.filename}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    seed = generate_seed() if args.seed is None else int(args.seed)
    runs = []
    all_violations = []
    for mechanism in mechanisms:
        violations = validate_envelope(mechanism, envelope)
        if violations and not args.allow_envelope_violation:
            for violation in violations:
                print(
                    f"error: envelope violation ({mechanism.name}): "
                    f"{violation}",
                    file=sys.stderr,
                )
            print(
                "error: refusing to run; pass --allow-envelope-violation to "
                "override (violations will be flagged in the run record)",
                file=sys.stderr,
            )
            return 1
        run = run_simulation(
            mechanism, distribution, envelope, args.cycles, seed=seed
        )
        run_dir = write_run(run, args.out, violations=violations)
        print(f"{mechanism.name}: run_id {run.run_id} -> {run_dir}")
        runs.append(run)
        all_violations.append(violations)
    try:
        comparison_path = write_comparison(
            runs, args.out, violations=all_violations
        )
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(comparison_path)
    return 0


def _cmd_export_3mf(args: argparse.Namespace) -> int:
    """Export the shared scan-derived parked concept assembly (feature 003)."""
    from .viz3d.concept_export import export_concept

    try:
        manifest = export_concept(args.output, force=args.force)
    except (OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(f"components: {len(manifest['components'])} (concept assembly)")
    print(f"manifest: {args.output}.manifest.json")
    print("WARNING: NOT VALIDATED / NOT PRINT-READY")
    print("print_ready=false")
    print("fabricable_as_designed=false")
    print("FDM/PLA/0.4 mm nozzle: provisional guidance only")
    print(f"package_sha256: {manifest['artifact_integrity']['package_sha256']}")
    print(f"manifest_sha256: {manifest['artifact_integrity']['manifest_sha256']}")
    print(args.output)
    return 0


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    if args.command == "animate":
        return _cmd_animate(args)
    if args.command == "report":
        return _cmd_report(args)
    if args.command == "compare":
        return _cmd_compare(args)
    if args.command == "export-3mf":
        return _cmd_export_3mf(args)

    try:
        mechanism, distribution, envelope = _load_configs(args)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    violations = validate_envelope(mechanism, envelope)

    if args.command == "validate":
        if violations:
            for violation in violations:
                print(f"VIOLATION: {violation}")
            return 1
        print("VALID")
        return 0

    if args.command == "run":
        if violations and not args.allow_envelope_violation:
            for violation in violations:
                print(f"error: envelope violation: {violation}", file=sys.stderr)
            print(
                "error: refusing to run; pass --allow-envelope-violation to "
                "override (violations will be flagged in the run record)",
                file=sys.stderr,
            )
            return 1
        run = run_simulation(
            mechanism, distribution, envelope, args.cycles, seed=args.seed
        )
        run_dir = write_run(run, args.out, violations=violations)
        print(f"run_id: {run.run_id}")
        print(f"cycles: {run.cycles_completed} (seed {run.seed})")
        print(run_dir)
        return 0

    # argparse's required subparsers make this unreachable.
    return 2  # pragma: no cover


if __name__ == "__main__":
    sys.exit(main())
