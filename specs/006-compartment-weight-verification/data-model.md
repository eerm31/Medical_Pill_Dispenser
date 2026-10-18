# Data Model: Compartment Weight Verification (Feature 006)

All values ASSUMED / NOT_VALIDATED. Every record carries `verification_status: NOT_VALIDATED`; logs carry `print_ready=false`, `fabricable_as_designed=false`. Masses are integer milligrams (`*_mg`), lengths mm, torque N·mm, times ms. Nothing here is stored by a real device; these are in-memory records and a JSON log format.

## Compartment

One of four removable cartridges.

| Field | Type | Rule |
|---|---|---|
| `id` | enum `RED` `BLUE` `GREEN` `ORANGE` | fixed set, order as Feature 003 |
| `present` | bool | simulated input; `false` ⇒ outcome `ABSENT` |
| `loaded_state` | enum `EMPTY` `LOADED` | changes **only** on `VERIFIED` (FR-005) |
| `pill_count` | int ≥ 0 | on `VERIFIED`: `pill_count += declared_count` (refill of a non-empty compartment keeps the old count) |
| `last_verified_weight_mg` | int or null | the after-weight of the last `VERIFIED`; informational, **never reused as a baseline** |
| `hold` | enum `NONE` `RETRY_EXHAUSTED` `QUARANTINED` | `QUARANTINED` only from `EXCESS`; cleared only by supervised reset (FR-025) |
| `consecutive_short` | int 0..3 | resets on `VERIFIED` or supervised reset |
| `consecutive_failures` | int ≥ 0 | any `SHORT` / `EXCESS` / `UNSTABLE`; resets on `VERIFIED`; at ≥ 3 a `REPEATED_FAILURE` log entry is reported (FR-013) |
| `expected_pill_mass_mg` | int 100..1500 | declared per compartment or fixture (A-007) |

Invariant: a held compartment is never treated as loaded or dispensable and cannot start a verification.

## WeightReading

| Field | Type | Rule |
|---|---|---|
| `compartment` | Compartment id | the one at the station |
| `value_mg` | int | window mean rounded to 100 mg |
| `status` | enum `SETTLED` `UNSTABLE` `DISCARDED` | `UNSTABLE` if no settle within 3000 ms of the last disturbance (A-005) |
| `samples` | int | 10 at 10 Hz in the 1.0 s settle window (assumed) |
| `spread_mg` | int | max − min in the window; settled iff ≤ 200 |
| `conditions` | `StationConditions` | snapshot at capture; any disturbing value ⇒ `DISCARDED` |
| `taken_at_ms` | int | simulated clock only; no wall clock |

## StationConditions (simulated inputs, A-009 / A-012)

| Field | Disturbing value |
|---|---|
| `at_station` | `false` (compartment not at the fill position) |
| `drum_state` | `ROTATING` |
| `lift_in_progress` | `true` |
| `lid_closed` | `false` |
| `sequence_active` | `true` (Feature 005 pin/gate sequence) |
| `compartment_present` | `false` |
| `lid_actuator_parked` | `false` (later feature; contact would shunt load) |

## VerificationRecord

One per attempt; created per fill. Changes the compartment's loaded state only when `outcome = VERIFIED`.

| Field | Type | Rule |
|---|---|---|
| `record_id` | string | deterministic: `<fixture_id>#<attempt>` |
| `compartment` | id | |
| `attempt` | int 1..3 | retry number within one session |
| `declared_count` | int ≥ 1 | |
| `expected_pill_mass_mg` | int | |
| `expected_added_mg` (`E`) | int | `declared_count × expected_pill_mass_mg` |
| `tolerance_mg` (`tol`) | int | `max(round(0.20 × E), 500)` |
| `window_low_mg` / `window_high_mg` | int | `max(E − tol, 500)` / `E + tol` |
| `before_mg` | int or null | the retained session baseline |
| `after_mg` | int or null | |
| `added_mg` | int or null | `after_mg − before_mg` |
| `outcome` | enum `VERIFIED` `SHORT` `EXCESS` `UNSTABLE` `ABSENT` | |
| `refusal` | enum or null | `DRUM_ROTATING` `LIFT_IN_PROGRESS` `LID_OPEN` `SEQUENCE_ACTIVE` `NOT_AT_STATION` `COMPARTMENT_HELD` `DECLARED_BELOW_FLOOR`; a refusal produces **no** outcome |
| `reason` | string | human-readable, no validation/safety claim |
| `follow_up` | FollowUpRequest or null | at most one per record (FR-010) |
| `state_changed` | bool | `true` only on `VERIFIED` |
| `seed` | int or null | only for fixtures with seeded noise |
| `verification_status` | `NOT_VALIDATED` | constant |

## Session (state machine instance)

| Field | Type | Rule |
|---|---|---|
| `state` | enum `READY` `BASELINING` `BASELINED` `AWAITING_FILL` `WEIGHING` `INCOMPLETE` | plus the outcome states in the diagram of the plan |
| `baseline_mg` | int or null | persists across retries; cleared on `VERIFIED`, `ABSENT`, supervised reset, restart |
| `declared_count` | int | fixed for the session |
| `attempt` | int | increments on each `SHORT` retry |

Transitions, guards and events are in [plan.md](plan.md) D3 / D4. A `restart()` between baseline and after-weight sets `state = INCOMPLETE` and clears the baseline: it can never become `VERIFIED` (FR-012).

## FollowUpRequest

| Field | Type | Rule |
|---|---|---|
| `kind` | enum `RETRY` `LOCK` `REREAD` | no `UNLOCK`, no lid-open (FR-014) |
| `compartment` | id | |
| `reason` | enum | `SHORT_RETRY` `RETRY_EXHAUSTED` `EXCESS_QUARANTINE` `UNSTABLE_READING` |
| `attempt` | int | for `RETRY` / `LOCK(RETRY_EXHAUSTED)` |
| `prompt` | string | user text for `RETRY` |
| `log` | bool | `true` for `LOCK(RETRY_EXHAUSTED)` |

Auxiliary notifications (not requests): `NOTICE(COMPARTMENT_ABSENT)`, `FLAG(QUARANTINED)`, `LOG(REPEATED_FAILURE)`. Full schema: [contracts/follow-up-events.md](contracts/follow-up-events.md).

## WeighingArrangement

| Field | Type | Note |
|---|---|---|
| `id` | `A` `B` `C` `X1` | `X1` is the deliberately non-compliant test arrangement |
| `title` | string | |
| `parts` | list of `ArrangementPart` | |
| `rotating_mass_added_g` | number | derived: Σ rotating parts |
| `added_torque_n_mm` | number | slip-ring drag etc. |
| `actuator_required` | bool | A: yes (fixed); B: yes; C: no |
| `notes` | string | |

`ArrangementPart`: `name`, `mass_g`, `rotates` (bool), `is_electronics_or_wiring` (bool), `blocks_straight_up_lift` (bool), `carries_load_during_rotation` (bool), `friction_torque_n_mm`.

Arrangement A parts: 16 weigh lugs (rotates, 0.3 g allowance total, passive), deck slots (rotates, 0 g, passive), pad bars/plate (fixed), load cell + amplifier (fixed, electronics), lift actuator (fixed, electronics), hard stop (fixed).

## LoadingLevel

| `id` | Compartments loaded | Pills each | Pill mass | Base rotating mass (g) |
|---|---|---|---|---|
| `EMPTY` | 0 | 0 | — | 73 |
| `ONE_20` | 1 | 20 | 1000 mg | 93 |
| `FOUR_13` | 4 | 13 | 1000 mg | 125 |

## RotationBudget

| Field | Type | Rule |
|---|---|---|
| `mass_budget_g` | 150 | A-001 |
| `motor_rated_n_mm` | 34 | A-002 |
| `torque_fraction` | 1/3 | limit ≈ 11.33 N·mm |
| `results` | list of `BudgetResult` | one per (arrangement, level) |

`BudgetResult`: `arrangement`, `level`, `rotating_mass_g`, `mass_limit_g`, `torque_n_mm` (friction, acceleration, bearing, added), `torque_limit_n_mm`, `limits: {WB-L1..WB-L5: pass|fail}`, `acceptable` (bool), `failing_limit` (first failing ID or null), `verification_status: NOT_VALIDATED`. Format: [contracts/rotation-budget-check.md](contracts/rotation-budget-check.md).

## Relationships and rules

- A `Compartment` has many `VerificationRecord`s; at most one open `Session`.
- A `Session` uses one retained baseline and produces one record per attempt.
- A `VerificationRecord` yields at most one `FollowUpRequest`.
- A `WeighingArrangement` is evaluated against each `LoadingLevel` to produce `BudgetResult`s; the viewer shows the results for the recommended arrangement.
- Feature 005 data (`rotation-spec.js`, the 52 component IDs, controller state) is read-only input; this feature stores nothing in it.
