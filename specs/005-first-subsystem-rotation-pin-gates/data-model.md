# Data Model: Rotation sub-subsystem (Feature 005)

All values ASSUMED / NOT_VALIDATED. Every record carries `verification_status: NOT_VALIDATED`; the log carries `print_ready=false`, `fabricable_as_designed=false`.

## RotationDesignAssumption
Named, versioned constants; one place for every assumed number.

| Field | Value (assumed) | Note |
|---|---|---|
| `axle_xy_mm` | [0, 15] | verified |
| `rotating_mass_g` | 73 empty / 93 with 20 pills / 125 with 4 × 13 pills at 1 g (budget 150) | plan "Design update 2026-10-15"; was 120 |
| `thrust_ring` | ID 17, OD 20, thickness 0.3, z 3.7–4.0, μ 0.2 | |
| `bearing` | 625ZZ-class 5 × 16 × 5, z −1.3..3.7 (fallback 685ZZ) | |
| `coupler` | bought flexible 5-to-5, L 25, assumed Ø19, z −29..−4 | conflict C2 resolved 2026-10-15 (was L ≈ 10, Ø ≈ 10, z ≈ −13.5..−3.8) |
| `rod` | Ø5 D-flat (flat at 2.00 from the axis), 60 mm, z −14..46 | conflict C1; C3 resolved (was z −7..46) |
| `lash_deg` | 1.0 (lost-motion model input) | UNVERIFIED |
| `overshoot_deg` | 3.0 | |
| `steps_per_rev` | 2048 nominal (≈ 2037.9 reported) | calibration constant |
| `hardware_rad_s` / `sim_rad_s` | 0.8 / 1.3 | |
| `index_tolerance_deg` | ±0.5 (spec proposed) | at risk |

## AxleStackMember (integrated submesh, existing owner IDs; no new component IDs)

| submesh id (proposed) | owner component ID | kind | z range / note |
|---|---|---|---|
| `axle-bearing-625zz` | `station-housing` | cylinder Ø16 × 5 | −1.3..3.7, fixed outer race; housing bore not modelled (same convention as `stepper-shaft-through-mount-plate`) |
| `axle-thrust-ring` | `station-housing` | ring ID 17 / OD 20 | 3.7–4.0, fixed |
| `axle-hall-sensor` | `station-housing` | box 4 × 3 × 3 (A3144-class, modelled) | flush in the platform top, z 0.7..3.7, centred at (9.7, −16.0), radius 32.48 from the axle |
| `axle-coupler` | `rotating-drum` | cylinder Ø19 × 25 (viewer value 2026-10-15; was Ø10 × 10) | rotates with the rod |
| `axle-home-magnet` | `rotating-drum` | cylinder Ø3 × 1 | z 4.6..5.6 in a Ø3.1 pocket (model 3.25) cut 1.4 mm from the top of a Ø4.4 × 1.0 mm boss on deck 0 at (9.7, −16.0); magnet boss Ø4.4 |
| rod D-flat parameters | `central-post` (group changes to rotating) | parameters on the existing cylinder | flat ≈ 4.5 across through hub z 4..~30; hub D bore r 2.6 with the flat at 2.10 from the axis (rod flat 2.00) |
| existing: `drive-shaft-extension`, `stepper-shaft`, `stepper-body`, `stepper-mount-plate`, columns | unchanged owners | unchanged | extension bottom −9 → −14 (C3 resolved in the viewer 2026-10-15; canonical JSON not changed); motor stack z values as in the plan "Design update 2026-10-15" |

Since 2026-10-15 these parts exist as viewer-only geometry in `docs/visualizer/rotation-spec.js` / `reference-look.js`; adding them to the canonical JSON as submeshes remains the plan's step 2.

Component count must remain exactly 52 (unique IDs).

## LostMotionModel (simulation input, deterministic)
`lash_deg`, `last_direction` (+1 CCW / −1 CW). Output error is 0 when the last motion was CCW and `−lash_deg` otherwise. No randomness.

## IndexMoveResult (extends spec "Drum Index Result")
`start_color`, `target_color`, `planned_path` (list of signed deltas, deg), `policy` (`unidirectional` default | `shortest` comparison), `achieved_deg`, `error_deg`, `station_confirmed`, `verdict` (`indexed` | `missed_index_fault` | `refused` | `already_at_station`), `refusal_reason`. In the controller the request returns `verdict` = `started` / `refused` / `already_at_station` at once and the completed record (`indexed` / `missed_index_fault`, with `fault_code`) appears in `snapshot().last_move`. `already_at_station` is a non-motion result.

## RotationGuardResult
`allowed`, `failed_rules` (subset of, in precedence order: `invalid_color`, `fault_active`, `not_homed`, `invalid_snapshot`, `pin_not_up`, `carriage_not_parked`, `gate_open` (all four blades and the tongue), `cap_open`, `busy`, `cartridge_lift_active`), `reason` text. Auxiliary-command refusal codes (spec US1 scenario 5): `rotation_active`, `station_not_confirmed` (plus `invalid_kind`); `not_faulted` for `reindex`.

## HomeCalibration
`calibrated`, `steps_per_rev` (counted between two CCW rising edges when calibrated, else nominal), `nominal_steps_per_rev` (2048), `measured_steps_between_edges` (or null), `home_offset_deg` (3.66, from plan C11), `home_offset_steps`, `edge` (`ccw_rising`). Station targets: `round(k * steps_per_rev / 4)`.

## FaultRecord
`code` (`missed_index_short` | `missed_index_over` | `wrong_stop` | `home_not_found` | `hard_fault`), `target_color`, `error_deg`, `attempt`; `hard_fault` adds `cause` (the underlying code or `injected`); `home_not_found` adds `limit_steps`.

## ReIndexAttempt
`reindex_attempts` (count so far, reset to 0 on success), `max_reindex_attempts` (proposed 2). Each attempt = a fresh home search, then the move to the faulted target, then the same end check.

## MotionProfile
`profile` = `hardware` (0.8 rad/s, 0.2 s ramps; trapezoid, triangular below 0.16 rad) or `sim` (1.3 rad/s, cruise only); duration per segment from the distance; one segment at a time, in order.

## State transitions (rotation only)

```text
UNHOMED --home--> HOMING --CCW rising edge, offset move--> HOMED_CONFIRMED
HOMING --no edge within the search limit--> HARD_FAULT (home_not_found)
HOMED_CONFIRMED --requestIndex(ok guard)--> MOVING --end within tolerance--> HOMED_CONFIRMED
MOVING --end outside tolerance / wrong stop--> MISSED_INDEX_FAULT --reindex (bounded, 2)--> HOMED_CONFIRMED | HARD_FAULT
HARD_FAULT --explicit reset--> UNHOMED
MISSED_INDEX_FAULT --explicit reset--> UNHOMED
any --guard failed--> (no motion, refusal reported)
```

The viewer controller's states (`PARKED`, `DRUM_ROTATE`, ...) are not changed or reused here; the states above (`UNHOMED`, `HOMING`, `HOMED_CONFIRMED`, `MOVING`, `MISSED_INDEX_FAULT`, `HARD_FAULT`) belong only to the standalone `rotation-controller.js` and are not wired to Feature 003 evidence.
