# Contract: Rotation acceptance log (mode a)

Machine-readable output of the planned index-move harness (spec FR-003, SC-010). One JSON document per run. This is a record format, not an API. All thresholds are proposed/assumed.

```text
{
  "feature": "005-first-subsystem-rotation-pin-gates",
  "scope": "rotation",
  "mode": "a",
  "disclosure": "NOT VALIDATED / NOT PRINT-READY; verifies control logic, ordering and interlocks only",
  "print_ready": false,
  "fabricable_as_designed": false,
  "assumptions": { ...RotationDesignAssumption... },
  "results": [ CriterionResult, ... ]
}

CriterionResult = {
  "criterion_id": "ROT-C01" | "ROT-C02" | "ROT-C03" | "ROT-C04" | "ROT-C05" | "ROT-C06" | "ROT-C07" | "ROT-C08",
  "step": "<request/step identifier, e.g. red->blue#1>",
  "observed": <number | string>,
  "threshold": <number | string>,
  "threshold_label": "proposed",
  "verdict": "pass" | "fail"
}
```

## Rules
- Criteria: `ROT-C01` 16 moves and same-station (no motion); `ROT-C02` repeatability per policy; `ROT-C03` refusals (guard rule codes, auxiliary commands during rotation, shape check against the real viewer snapshot, read-only); `ROT-C04` injected missed index, bounded re-index, hard fault; `ROT-C05` geometry (pytest only, `evidence/rot-c05-results.json`); `ROT-C06` home and calibration (unconfirmed before home, CCW rising edge, `steps_per_rev`, `home_not_found`); `ROT-C07` direction policy, timing, no skipped state under a large time step (FR-022); `ROT-C08` readouts and pin/gate permission gating. The JS harness log carries `ROT-C01..C04` and `ROT-C06..C08`; its extra top-level `summary` object is `{checks, fail}`.
- Deterministic: same inputs → byte-identical output; no timestamps, no randomness.
- Fixed ordering: criterion ID, then the 16 moves in `COLORS` order.
- A failing result is reported as `fail`; it is never suppressed or relabelled.
- Mode (b) criteria `ROT-R01..ROT-R06` appear only as `{"criterion_id": "ROT-R0x", "status": "not validated — to be measured on a built rig"}`; they are never `pass`.
- No field or string may claim validation, single-dose integrity, readiness or medication/dose safety.
