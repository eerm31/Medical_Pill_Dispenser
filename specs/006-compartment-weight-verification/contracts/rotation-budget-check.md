# Contract: Rotation-budget check result

Machine-readable output of `check_arrangement()` (spec FR-015..FR-020, SC-004, SC-005). Pure function; no side effects. All numbers ASSUMED / NOT_VALIDATED.

```text
BudgetCheckDocument = {
  "feature": "006-compartment-weight-verification",
  "disclosure": "ASSUMED / NOT_VALIDATED; hand-calculation budgets, not measurements",
  "print_ready": false,
  "fabricable_as_designed": false,
  "budget": { "mass_g": 150, "motor_rated_n_mm": 34, "torque_fraction": "1/3", "torque_limit_n_mm": 11.33 },
  "results": [ BudgetResult, ... ]
}

BudgetResult = {
  "arrangement": "A" | "B" | "C" | "X1",
  "level": "EMPTY" | "ONE_20" | "FOUR_13",
  "rotating_mass_g": <number>,
  "torque_n_mm": { "friction": <n>, "acceleration": <n>, "bearing": <n>, "added": <n>, "total": <n> },
  "limits": {
    "WB-L1": "pass" | "fail",
    "WB-L2": "pass" | "fail",
    "WB-L3": "pass" | "fail",
    "WB-L4": "pass" | "fail",
    "WB-L5": "pass" | "fail"
  },
  "acceptable": <bool>,
  "failing_limit": "WB-Lx" | null,
  "verdict_text": "acceptable to the rotation" | "not acceptable to the rotation: <limit name>",
  "verification_status": "NOT_VALIDATED"
}
```

## Limit IDs

| ID | Name | Rule | Spec |
|---|---|---|---|
| `WB-L1` | rotating mass | base + added ≤ 150 g | FR-015, A-001 |
| `WB-L2` | torque | total ≤ 34/3 N·mm | FR-016, A-002 |
| `WB-L3` | no rotating electronics | no electronics/sensor/wiring part rotates | FR-017 |
| `WB-L4` | straight-up removal | no added part blocks the lift | FR-018 |
| `WB-L5` | no load path while rotating | no added path loads or adds friction during rotation | FR-019 |

## Expected results (for the implementation to reproduce)

| Arrangement | Expected |
|---|---|
| `A` | all limits pass at all three levels; totals 1.72 / 2.16 / 2.88 N·mm; mass 73.3 / 93.3 / 125.3 g |
| `B` | `WB-L4` fail (cradle in the lift corridor) in the encoded concept; documented as fallback |
| `C` | `WB-L5` fail |
| `X1` | `WB-L1`, `WB-L2`, `WB-L3` fail (178 g, ≈ 13.0 N·mm, rotating electronics) |

## Rules

- Deterministic and ordered: arrangement id, then level in the order `EMPTY`, `ONE_20`, `FOUR_13`.
- `failing_limit` is the first failing limit in ID order; all failing limits are still listed under `limits`.
- A fail is never suppressed; `X1` must report not acceptable (SC-005).
- Output states the limit and numbers a reader needs (SC-004) and makes no validation or readiness claim.
