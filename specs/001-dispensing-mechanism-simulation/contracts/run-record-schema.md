# Contract: Run Record and Export Schemas

**Feature**: 001-dispensing-mechanism-simulation | **Version**: 1.0 (draft)

Every `run` produces a run directory containing exactly three artifacts (FR-017/020).

## `run.json` — canonical record

```json
{
  "schema_version": "1.0",
  "run_id": "9f2c1e…",
  "created_utc": "2026-09-19T10:30:00Z",
  "seed": 42,
  "mechanism_config": { "...": "full mechanism config as validated" },
  "pill_distribution": { "...": "full pill distribution as validated" },
  "envelope": { "...": "envelope used, plus any violations flagged" },
  "cycles_requested": 10000,
  "cycles_completed": 10000,
  "events": [
    {
      "cycle_index": 0,
      "pills_dispensed": 1,
      "outcome": "SINGLE",
      "failure_mode": null,
      "jam_persistent": false,
      "pill_state": { "shape": "capsule", "length_mm": 18.2, "width_mm": 6.1,
                      "friction_coefficient": 0.41, "orientation_deg": 73.0 }
    }
  ],
  "summary": {
    "single_dose": { "count": 9950, "rate": 0.995 },
    "zero_dose": { "count": 30, "rate": 0.003 },
    "multi_dose": { "count": 15, "rate": 0.0015 },
    "no_pill_available": { "count": 5, "rate": 0.0005 },
    "single_dispense_success_rate": 0.9955,
    "pass_threshold": 0.995,
    "pass": true,
    "per_category": {
      "round_tablet": { "cycles": 5012, "success_rate": 0.997 },
      "oblong_caplet": { "cycles": 2988, "success_rate": 0.994 },
      "capsule": { "cycles": 2000, "success_rate": 0.993 }
    },
    "failure_mode_breakdown": { "JAM": 20, "STACKING": 8, "DOUBLE_DROP": 12,
                                "MISSED_DISPENSE": 5, "UNCLASSIFIED": 0 }
  }
}
```

Invariants enforced by the writer and checked by tests:
- `events` length == `cycles_completed` == `cycles_requested` (SC-001).
- Every event has exactly one `outcome`; `NO_PILL_AVAILABLE` never carries a failure mode and is excluded from violation counts (FR-012).
- `failure_mode_breakdown` sums exactly to `zero_dose + multi_dose` violations (SC-003).
- Re-running with identical `seed` + embedded configs reproduces `events` byte-for-byte semantically (SC-004).

## `cycles.csv` — per-cycle export

Header: `cycle_index,pills_dispensed,outcome,failure_mode,jam_persistent,pill_shape,pill_length_mm,pill_width_mm,pill_friction,pill_orientation_deg`

One row per actuation, ordered by `cycle_index`, no gaps.

## `report.md` — human-readable summary

Sections, in order: run identity (run_id, seed, date); mechanism + distribution digest; envelope validation result; aggregate success rate with **PASS/FAIL vs 99.5%** verdict; per-category success-rate table; failure-mode breakdown table; notable cycle ranges (jam persistence spans). Suitable for direct citation in design reviews (SC-006).
