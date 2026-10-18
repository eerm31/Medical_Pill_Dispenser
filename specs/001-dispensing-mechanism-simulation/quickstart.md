# Quickstart: Dispensing Mechanism Simulation

**Feature**: 001-dispensing-mechanism-simulation | **Date**: 2026-09-19

Runnable validation scenarios proving the feature end-to-end. Contracts: see [contracts/cli-contract.md](contracts/cli-contract.md), [contracts/config-schema.md](contracts/config-schema.md), [contracts/run-record-schema.md](contracts/run-record-schema.md). Entities: see [data-model.md](data-model.md).

## Prerequisites

- Python 3.11+ (`python3 --version`).
- From the repo root: `python3 -m venv .venv && source .venv/bin/activate`
- Install for development: `pip install -e . pytest` (only dev dependency is pytest).

## Scenario 1 — Run a candidate mechanism (US1, SC-001)

```bash
dispenser-sim run --mechanism configs/mechanisms/slider_gate_v1.json \
  --pills configs/pills/standard_mix.json --cycles 10000 --seed 42 --out runs/
```

Expected: completes well under 10 minutes (SC-005); run directory contains `run.json`, `cycles.csv`, `report.md`; `run.json` has exactly 10,000 classified events with no gaps (SC-001).

## Scenario 2 — Envelope validation (US1, FR-004)

```bash
dispenser-sim validate --mechanism configs/mechanisms/oversized_demo.json \
  --pills configs/pills/standard_mix.json
```

Expected: exit 1, message naming each violated portability constraint (dimensions, mass, or actuation energy). `run` refuses the same config unless `--allow-envelope-violation` is passed, in which case the violation is flagged in `run.json`.

## Scenario 3 — Verify the single-dose invariant report (US2, SC-002/003)

```bash
dispenser-sim report --run runs/<run_id>/run.json
```

Expected: report shows aggregate single-dispense success rate with PASS/FAIL vs the 99.5% threshold, per-category success rates, and a failure-mode breakdown summing to exactly 100% of violations (SC-003). Empty-reservoir cycles appear as `NO_PILL_AVAILABLE` and are excluded from violations (FR-012).

## Scenario 4 — Reproduce a run exactly (US3, SC-004)

```bash
dispenser-sim run --mechanism configs/mechanisms/slider_gate_v1.json \
  --pills configs/pills/standard_mix.json --cycles 10000 --seed 42 --out runs_repro/
diff <(python3 -c "import json;print(json.dumps(json.load(open('runs/<run_id>/run.json'))['events'],sort_keys=True))") \
     <(python3 -c "import json;print(json.dumps(json.load(open('runs_repro/<run_id2>/run.json'))['events'],sort_keys=True))")
```

Expected: no diff — identical per-cycle outcomes for identical seed + config.

## Scenario 5 — Compare two mechanisms (US3)

```bash
dispenser-sim compare --mechanism configs/mechanisms/slider_gate_v1.json \
  --mechanism configs/mechanisms/rotary_disk_v1.json \
  --pills configs/pills/standard_mix.json --cycles 10000 --seed 42
```

Expected: `comparison.md` with side-by-side aggregate + per-category success rates and failure-mode breakdowns under identical seeds.

## Test suite (Constitution III)

```bash
pytest tests/unit tests/statistical tests/integration
```

Expected: all green. Statistical tests assert invariants (exhaustive classification, failure-mode accounting, reproducibility identity, distribution sanity) rather than exact values.
