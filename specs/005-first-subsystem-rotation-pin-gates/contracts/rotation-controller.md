# Contract: `DispenserRotationController` (standalone rotation logic, Feature 005)

File: `docs/visualizer/rotation-controller.js` (one IIFE, one export `DispenserRotationController` on the global object; loads from `file://`; no DOM, no storage, no clock, no network). ASSUMED / NOT_VALIDATED. Every threshold is **proposed**. It models control logic only: it says nothing about the viewer controller (`docs/visualizer/demo-controller.js`, not modified and not verified), friction, gear lash on real hardware, sensors or pill behaviour. Wiring into the viewer is DEFERRED (hook points below).

Conventions: angles in degrees, CCW = positive (`+drumAngle`), RED station = 0°, then BLUE 90°, GREEN 180°, ORANGE 270° (the viewer's `COLORS` order). Time moves only through `tick(dt)` (seconds). No `Math.random`, no wall clock.

## Construction

`new DispenserRotationController(options)`; every option is optional.

| Option | Default (proposed) | Meaning |
|---|---|---|
| `policy` | `'unidirectional'` | direction policy (plan D5 / R-6); `'shortest'` is an opt-in comparison case |
| `profile` | `'hardware'` | `'hardware'` = 0.8 rad/s, 0.2 s trapezoid ramps; `'sim'` = 1.3 rad/s, cruise only |
| `steps_per_rev` | 2048 | controller step count per revolution (integer; replaced by the measured count after a calibrated home) |
| `actual_steps_per_rev` | = `steps_per_rev` | simulated plant truth (for example 2037.9) used to show drift and calibration |
| `lash_deg` | 1.0 | lost-motion input (UNVERIFIED) |
| `overshoot_deg` | 3.0 | CW-needed overshoot (rounded to whole steps) |
| `index_tolerance_deg` | 0.5 | end-position tolerance (±) |
| `home_offset_deg` | 3.66 | CCW travel from the hall rising edge to the RED station (plan C11; not 17.38) |
| `home_search_limit_steps` | 2560 | 1.25 revolutions; no edge within this bound = `home_not_found` |
| `max_reindex_attempts` | 2 | bounded re-index |
| `initial_deg` | 0 | simulated true drum angle before homing |

Static members: `CONSTANTS` (frozen), `RULE_PRECEDENCE`, `canRotate(snapshot)`, `planRotation(from_deg, to_deg, policy)`, `stationSteps(color, steps_per_rev)`, `lostMotionError(last_direction, lash_deg)`, `motionProfile(distance_rad, rate, ramp)`, `parkedSnapshot()`.

## Methods

| Method | Result |
|---|---|
| `home({calibrate, snapshot})` | starts the CCW search for the hall rising edge, then the `home_offset` move to RED; `calibrate: true` first runs one extra CCW revolution to the next edge and counts `steps_per_rev` (`HomeCalibration`) |
| `requestIndex(color, {policy, snapshot})` | guard, plan, motion, end check; returns `{accepted, verdict, failed_rules, reason, move}` with `verdict` = `started` / `refused` / `already_at_station` |
| `reindex({policy, snapshot})` | only after `MISSED_INDEX_FAULT`; re-homes, then repeats the move to the faulted target; at most `max_reindex_attempts` (2) |
| `tick(dt)` | advances elapsed time (finite, >= 0, else `RangeError`); never skips a segment or state; returns the snapshot |
| `injectFault(kind, {count, deg})` | arms deterministic faults: `short`, `over` (default 2.0° off), `wrong_stop` (one station CCW), applied to the next `count` index moves; `home_not_found` applies to the next home search; `hard_fault` acts immediately |
| `requestAuxCommand(kind)` | `kind` in `dispense` / `pin` / `gate`; returns `{kind, permitted, rule_code, reason}`; permission query only, changes no state, never disturbs a rotation |
| `observe(snapshot)` | records the latest external snapshot's lift flag (feeds `lift_in_progress`); returns the guard result |
| `reset()` | explicit reset to `UNHOMED` (clears faults, attempts, armed injections, calibration); refused with `busy` while the drum is moving; the simulated drum does not move |
| `snapshot()` | deep-frozen state copy (fields below) |

## Guard rule codes and precedence

`RULE_PRECEDENCE` = `invalid_color`, `fault_active`, `not_homed`, `invalid_snapshot`, `pin_not_up`, `carriage_not_parked`, `gate_open`, `cap_open`, `busy`, `cartridge_lift_active`. `failed_rules` lists every failed rule in that order (combined failures are all reported); a refusal moves nothing and changes no state. `invalid_color` short-circuits. `already_at_station` is a non-motion result, not a refusal, and is evaluated only after the guard passes.

Aux/other refusal codes: `rotation_active`, `station_not_confirmed`, `invalid_kind` (aux), `not_faulted` (`reindex`).

## Input mapping (for the DEFERRED wiring; the guard reads a `DispenserDemoController.snapshot()`-shaped object)

| Rule | Snapshot fields |
|---|---|
| `pin_not_up` | `pin !== 'up'` |
| `carriage_not_parked` | `Math.abs(carriage) > 1e-9` |
| `gate_open` | any of the four `cartridges[c].bladeMotion !== 'closed'` or `blade !== 0`; `tongueMotion !== 'closed'` or `tongueEdge !== 5.7` |
| `cap_open` | any `cartridges[c].capOpen === true` or `cap === 'open'` |
| `busy` | `phase !== 'PARKED'` or `operation !== null` (also set while the controller's own drum is moving) |
| `cartridge_lift_active` | any `cartridges[c].lift !== liftTarget`, or `operation === 'cartridge'` |

A missing snapshot in `requestIndex` / `home` / `reindex` defaults to `parkedSnapshot()` (standalone use, no dispense needed).

## Direction policy, lost motion, steps

- `unidirectional` (DEFAULT): CCW final approach. CCW-needed: one segment. CW-needed Δ: segments `[Δ − o, +o]` (o = 3°, 17 steps at 2048). 180° ties are always CCW. Angles wrap to [0, 360).
- `shortest`: one segment of the shorter way, tie CCW.
- Lost-motion model: error 0 after a CCW final segment, `−lash_deg` after a CW one (reversal shifts the output by ±`lash_deg`). Deterministic.
- Station targets: `round(k × steps_per_rev / 4)` steps from the RED station, k = 0..3 (nominal 512 per quarter).
- Calibration: with a true ratio of 2037.9, nominal 512 steps = 90.447° (+0.447° per quarter); a calibrated home sets `steps_per_rev` to the counted steps between two rising edges and removes that drift.

## States, readouts, faults

States: `UNHOMED`, `HOMING`, `HOMED_CONFIRMED`, `MOVING`, `MISSED_INDEX_FAULT`, `HARD_FAULT`. Snapshot fields: `state`, `drum_state` (`STILL` / `ROTATING`), `at_station` (color or null), `station_confirmed`, `pin_gate_allowed` (true only when `HOMED_CONFIRMED`, still, at a station), `sequence_active`, `lift_in_progress`, `steps_per_rev`, `step_position`, `believed_deg`, `drum_angle_deg`, `policy`, `profile`, `home` (`HomeCalibration`), `fault` (`FaultRecord`), `reindex_attempts`, `last_move` (`IndexMoveResult`), `elapsed_s`, `trace`.

Fault codes: `missed_index_short`, `missed_index_over` (end error beyond ± tolerance), `wrong_stop` (nearest station is not the target), `home_not_found` (no edge within the search limit; goes straight to `HARD_FAULT`, needs `reset()`), `hard_fault` (re-index attempts exhausted, or injected; `cause` records the underlying code). While faulted: station unconfirmed, `pin_gate_allowed` false, `requestIndex` / `home` refused with `fault_active`, only `reindex()` (from `MISSED_INDEX_FAULT`) or `reset()` can proceed. Detection of the end error uses the simulated true angle as a stand-in for a step-count / re-home cross-check; no sensor is modelled.

Motion profile: hardware 0.8 rad/s with 0.2 s ramps (about 2.16 s per quarter, 4.13 s per 180°); simulation 1.3 rad/s (1.208 s per quarter). A single huge `dt` completes exactly the queued segments in order, one state entry per transition (`trace`).

## Auxiliary-command refusal (spec US1 acceptance scenario 5)

`requestAuxCommand` is refused with `rotation_active` while `drum_state` is `ROTATING` (homing or index), and with `station_not_confirmed` when no station is confirmed. `pin_gate_allowed` is false in both situations. Only the refusal side is implemented; "explicitly deferred / queued" is not.

## Determinism

Same inputs give identical snapshots and logs; no timestamps; the harness log is byte-identical on a second run (SC-010).

## DEFERRED integration hook points (not implemented, `[NEEDS-USER-APPROVAL]`, register W01-W04)

1. `requestDispense` would call `canRotate(this.snapshot())` before step 1 (all four blades, tongue, caps, lifts).
2. A standalone "go to station" command would call `requestIndex` and surface `already_at_station`.
3. The viewer frame loop would call `tick(dt)` and `observe(snapshot)`, and read `at_station` / `drum_state` / `pin_gate_allowed`.
4. Pin and gate commands would call `requestAuxCommand(kind)` first.

## Explicit exclusions

Power loss (FR-023 / FR-024), pin engagement, gate/dispense cycle, jam and pin/gate faults are not implemented here. Nothing in this contract is a validation, readiness or safety claim.
