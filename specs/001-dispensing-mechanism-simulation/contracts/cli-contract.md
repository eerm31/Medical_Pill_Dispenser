# Contract: Command-Line Interface

**Feature**: 001-dispensing-mechanism-simulation | **Version**: 1.0 (draft)

Entry point: `dispenser-sim` (installed) or `python -m dispenser_sim` (from source). All commands are offline, stdlib-only, and deterministic for a given seed + config.

## Global behavior

- Exit code `0`: success. Exit code `1`: validation or runtime failure with a human-readable message on stderr. Exit code `2`: CLI usage error (argparse default).
- Every command that produces a run prints the run directory path on stdout as the last line.
- No command mutates an existing run record; re-runs create new run directories.

## `validate`

Checks a mechanism config against its pill distribution and the portability envelope without running cycles.

```bash
dispenser-sim validate --mechanism mech.json --pills pills.json \
  [--envelope configs/portability_envelope.json]
```

- Prints each violated envelope constraint (dimensions, mass, actuation energy) or `VALID`.
- Exit code `1` if any constraint is violated (FR-004 "refuse or clearly flag").

## `run`

Executes a seeded simulation run (US1, US2).

```bash
dispenser-sim run --mechanism mech.json --pills pills.json \
  [--envelope configs/portability_envelope.json] \
  --cycles 10000 [--seed 42] [--out runs/]
```

- Refuses to run (exit 1) on envelope violation unless `--allow-envelope-violation` is passed, in which case the violation is flagged in the run record.
- If `--seed` is omitted, a seed is generated and recorded (FR-015/017).
- Writes into the run directory: `run.json` (canonical record), `cycles.csv`, `report.md` (see run-record-schema.md).

## `report`

Regenerates summary artifacts from an existing run record.

```bash
dispenser-sim report --run runs/<run_id>/run.json [--out runs/<run_id>/]
```

- Output is byte-identical to the report produced by the original `run` for the same record.

## `compare`

Side-by-side reliability comparison of ≥2 mechanisms under identical seeds and pill distribution (US3).

```bash
dispenser-sim compare --mechanism a.json --mechanism b.json \
  --pills pills.json --cycles 10000 --seed 42 [--out compare/]
```

- Writes one run per mechanism plus `comparison.md`: per-mechanism aggregate and per-category success rates, failure-mode breakdowns, and pass/fail vs the 99.5% threshold.

## Errors

| Condition | Exit | Message includes |
|---|---|---|
| Config JSON malformed / unknown fields | 1 | offending field path |
| Envelope violated (without override flag) | 1 | each violated constraint and its limit |
| `--cycles` < 1 | 2 | usage error |
| Run record unreadable (`report`) | 1 | file path and parse error |
