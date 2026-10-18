# Contract: Verification record / log

Machine-readable output of the planned fixture runner (`python -m dispenser_sim.weighing`). One JSON document per run. This is a record format, not an API. All thresholds are assumed.

```text
{
  "feature": "006-compartment-weight-verification",
  "disclosure": "ASSUMED / NOT_VALIDATED; verifies logic and ordering only. No accuracy, dose-safety, single-dose or print-readiness claim.",
  "print_ready": false,
  "fabricable_as_designed": false,
  "parameters": { "floor_mg": 500, "tolerance_fraction": 0.20, "settle_ms": 3000, "retry_limit": 3, "quantum_mg": 100 },
  "fixtures": [ FixtureResult, ... ]
}

FixtureResult = {
  "fixture_id": "<string>",
  "seed": <int | null>,
  "records": [ VerificationRecord, ... ],
  "events": [ FollowUpRequest | Notice | Flag | LogEntry, ... ],
  "expected": { "outcomes": [...], "requests": [...], "state_changed": [...] },
  "verdict": "pass" | "fail"
}

VerificationRecord = {
  "record_id": "<fixture_id>#<attempt>",
  "compartment": "RED" | "BLUE" | "GREEN" | "ORANGE",
  "attempt": <int 1..3>,
  "declared_count": <int>,
  "expected_pill_mass_mg": <int>,
  "expected_added_mg": <int>,
  "tolerance_mg": <int>,
  "window_low_mg": <int>,
  "window_high_mg": <int>,
  "before_mg": <int | null>,
  "after_mg": <int | null>,
  "added_mg": <int | null>,
  "outcome": "VERIFIED" | "SHORT" | "EXCESS" | "UNSTABLE" | "ABSENT" | null,
  "refusal": "DRUM_ROTATING" | "LIFT_IN_PROGRESS" | "LID_OPEN" | "SEQUENCE_ACTIVE" | "NOT_AT_STATION" | "COMPARTMENT_HELD" | "DECLARED_BELOW_FLOOR" | null,
  "reason": "<human readable>",
  "follow_up": FollowUpRequest | null,
  "state_changed": <bool>,
  "verification_status": "NOT_VALIDATED"
}
```

## Rules

- Exactly one of `outcome` and `refusal` is non-null per record.
- `state_changed` is `true` only when `outcome = VERIFIED`; every other case leaves the compartment's loaded state and count unchanged (FR-005, SC-001).
- `expected_added_mg`, `tolerance_mg` and the window follow `E = declared_count × expected_pill_mass_mg`, `tol = max(round(0.20 × E), 500)`, `low = max(E − tol, 500)`, `high = E + tol`, inclusive; all integer milligrams.
- Deterministic: same inputs and seeds produce a byte-identical document; no timestamps, no wall clock; simulated clock values only in event ordering.
- Fixed ordering: fixtures by `fixture_id`, then records by `attempt`, then events in emission order.
- A failing fixture is reported as `fail` and never suppressed or relabelled.
- No field or string may claim validated accuracy, medication or dose safety, single-dose integrity, readiness or fabricability.
- Every record that classifies a declared count of 6 or more pills carries `reason` text noting that count is an inference from mass within the tolerance window.
