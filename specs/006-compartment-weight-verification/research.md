# Research: Compartment Weight Verification (Feature 006)

All entries are ASSUMED / NOT_VALIDATED. "UNVERIFIED" means a recalled catalog/datasheet value or an unmeasured repo geometry that must be checked before any reliance. No `NEEDS CLARIFICATION` marker remains; open choices are listed at the end and in the plan report.

## Decisions

| # | Decision | Rationale | Alternatives considered |
|---|---|---|---|
| WV-1 | Weighing arrangement **A**: retractable lift pad at the fill position, fixed load cell below the platform, passive weigh lugs on each cartridge | Meets FR-003 and FR-015..FR-019: fixed, one compartment, no rotating electronics, pad retracted while the drum turns, nothing above the deck. Lifting the rails 0.5 mm off the deck makes the cell see only cartridge + pad + pills. The cell sits on the actuator's moving fixed-end carriage, so the actuator is not in the measured path | **B** cartridge moved onto a cell by the lift motion (needs a new actuator anyway, ≥ 3 mm stroke through the clip hooks, parts in the lift corridor); **C** whole drum (rejected by spec Q1; see WV-2) |
| WV-2 | Arrangement **C** is documented and encoded only to fail `WB-L5` | Whole-drum weighing puts the rotating drum on the load path during rotation, adds coupler stiffness and motor reaction to the measurement, and 0.5 g is ≈ 0.4 % of ≥ 125 g plus platform/motor tare | none further |
| WV-3 | Pad corridor is **outboard** (x ≈ ±9.6) via weigh lugs, not through the rail rim | The tongue (x ±7, y −18.3..5.7, z −1.5..0) and its pocket sit directly under the rail rim at x 5.4..7.4; a post there would cut the pocket. Outboard of x ≈ 8.8 only solid platform is expected (UNVERIFIED, task 1) | pad under the rails (blocked); pad through the cartridge bore/outlet (blocked by the tongue and the pill path); pad inboard at y ≥ 4.2 (bearing seat boss r 10.5 and the 0.7 mm seat wall) |
| WV-4 | Four lugs per cartridge: two outboard (y ≈ −10.5), two inboard (y ≈ +4.3) | Bracket the centre of mass so the lifted cartridge cannot tip back onto the rails (a two-point outboard support would tip and shunt load) | two outboard only (tips); three-point (COM outside the triangle for symmetric x); continuous lug (collides with the clip root, \|y\| ≤ 3.0) |
| WV-5 | Pad is UP only for the reading window; retracted before a lid opens or the drum turns | Gives "no load / no torque while rotating" (FR-019), avoids cell overload by hand pressure, and lets the rails carry the cartridge between readings | pad held up through the fill (overload and impact risk; lid hinge presses on the lifted cartridge) |
| WV-6 | Stroke ≈ 2.1 mm: pad top 3.7 (flush) → 5.0 contact → 5.5 lifted, plus 0.3 contact margin | Clears the deck underside (z 4.0) when DOWN and lifts the rails 0.5 mm off the deck (top z 5.0) | 3 mm stroke (unnecessary); lift of only 0.2 mm (below printing/seat tolerance) |
| WV-7 | Conflict **W-C1**: raise `hook_z0` from 18.0 to ≈ 18.8 (vertical hook–ledge clearance ≥ 0.8 mm) in the later task phase | Present geometry has `hook_z0 = ledge_z1 = 18.0` (0.0 clearance), so a 0.5 mm lift is blocked. Straight-up removal stays possible by flexing the clip ≈ 0.7 mm | lifting 0.5 mm by flexing every reading (wear, force noise); shorter lift (not reliable) |
| WV-8 | All masses are **integer milligrams**; all window comparisons are inclusive integer comparisons | Removes floating-point boundary flakiness at `tol` and floor edges (SC-001, SC-002); matches Constitution III determinism | floats with epsilon; `decimal` (heavier, no benefit) |
| WV-9 | Reading quantization 100 mg (the 0.1 g goal), floor 500 mg (A-004), window `tol = max(20 % × E, 500 mg)`, **lower bound clamped to the floor** | Without the clamp, `E = 500 mg` gives `[0, 1000]`, so "nothing added" would verify. With the clamp the verified window never includes values below the floor | spec formula unclamped (accepts zero for small E) |
| WV-10 | Declared total `E < 500 mg` is **refused** (not an outcome) with reason `DECLARED_BELOW_FLOOR` | A total below the floor cannot be told apart from nothing added, and FR-006 only requires resolving ≥ 0.5 g. Light pills are verified by total mass (5 × 0.1 g = 0.5 g qualifies) as FR-006/SC-010 require. Flagged as open question Q2 because FR-001 lists only five outcomes | add a sixth outcome (spec change); accept and verify at zero (unsafe) |
| WV-11 | Settling criterion: 10 consecutive samples at 10 Hz (1.0 s window) spanning ≤ 200 mg, accepted value = window mean rounded to 100 mg, deadline 3000 ms after the last disturbance (pad raise, lid close, seating); otherwise `UNSTABLE` | Turns A-005 into a testable rule; 200 mg ≈ 0.4 × floor | single-sample read (no stability evidence) |
| WV-12 | Retry keeps the original before-weight and declared count; 3 consecutive `SHORT` → `LOCK(RETRY_EXHAUSTED, log)` | Keeps added mass cumulative against one declaration; matches A-006 literally | new baseline per retry (loses the drift/tare cancellation and invites hiding a short fill) |
| WV-13 | `UNSTABLE` and `ABSENT` neither increment nor reset the short streak; `consecutive_failures` (any `SHORT`/`EXCESS`/`UNSTABLE`) drives the FR-013 repeated-failure report at 3 | Spec text ties the lock limit to "consecutive less-than-declared" results; measurement faults are not verdicts. Flagged Q4 | unstable counts toward the lock (would lock for a noisy sensor) |
| WV-14 | Quarantine is a **compartment hold flag**, not a request; the one request on `EXCESS` is `LOCK(EXCESS_QUARANTINE)` | FR-010 says "a lock request and a quarantine flag" and "exactly one follow-up request" | a separate `QUARANTINE` request event (would be two requests for one outcome) |
| WV-15 | Absent compartment: `ABSENT` outcome, no request (a `NOTICE` only), session voided | FR-001 lists absent as an outcome with no weight outcome; removal mid-weigh voids the baseline because re-seating shifts the reading | emit `REREAD` (would loop on a missing compartment) |
| WV-16 | One logic implementation in Python; viewer replays generated fixtures from `weight-data.js` | Constitution IV and "no drift" between two implementations of one state machine; matches the replay-first pattern of Features 002/003 | duplicate the FSM in JS (needs a Node-less harness and golden cross-check); interactive free-form masses (could be added later) |
| WV-17 | Viewer-only submeshes; canonical JSON untouched; slots drawn as outlines only in the new view | Keeps exactly 52 IDs, 3MF hashes and the other three sub-views unchanged | new canonical components (breaks the 52-ID invariant) |
| WV-18 | `python -m dispenser_sim.weighing` instead of a new `cli.py` subcommand; no `pyproject.toml` change | New subpackage is picked up by `packages.find`; avoids editing Feature 001 files and package-data | `dispenser-sim weigh ...` (edits `cli.py`) |
| WV-19 | Cartridge tare assumed ≈ 8 g (cartridge + cap + blade + spring), pad tare ≈ 3 g, maximum load ≈ 31 g | Only used to size the load-cell class and the fixture tare; derived from the 73 g empty figure, not measured | none |

## Rotation-budget derivation

- Base masses (spec A-001): 73 g, 93 g, 125 g; added rotating mass for A: 16 lugs × 0.021 g (≈ 41.8 mm³ per cartridge × 1.27 g/cm³ PETG-class, ≈ 0.21 g total) rounded up to a **0.3 g allowance**; slot material removal ignored (conservative).
- Friction: `μ m g r_mean`, `r_mean = 9.25 mm`; `μ = 0.20` gives 2.27 N·mm at 125 g (matches the spec's 2.3 upper figure), `μ = 0.06` gives 0.68 N·mm at 125 g (matches the spec's 0.7 lower figure).
- Acceleration: the spec's bound of 0.5 N·mm for a 90° index in 0.5 s at the heaviest level, scaled by mass (0.29 / 0.37 / 0.50 N·mm). Hardware recommendation from Feature 005 (0.8 rad/s with ramps) would give far less; the stricter spec bound is kept.
- Limit: 34 N·mm / 3 ≈ 11.33 N·mm; arrangement A totals 1.72 / 2.16 / 2.88 N·mm, margins 6.6× / 5.2× / 3.9×.
- Negative fixture `X1` (a cell and carrier on each deck, slip ring): 125 + 4 × 7 + 25 = 178 g, drag 9 N·mm ⇒ ≈ 13.0 N·mm, rotating electronics ⇒ fails `WB-L1`, `WB-L2`, `WB-L3`.

## Resolution and tolerance consequences

| Declared N × m | E (g) | tol (g) | Verified window (g) | Meaning |
|---|---|---|---|---|
| 5 × 0.1 g | 0.5 | 0.5 | 0.5..1.0 | at the floor; verified by total mass |
| 1 × 1.0 g | 1.0 | 0.5 | 0.5..1.5 | zero pills short, two pills excess |
| 5 × 1.0 g | 5.0 | 1.0 | 4.0..6.0 | ±1 pill passes |
| 13 × 1.0 g | 13.0 | 2.6 | 10.4..15.6 | ±2 pills pass |
| 20 × 1.0 g | 20.0 | 4.0 | 16.0..24.0 | ±4 pills pass |

Consequence: the check confirms "mass consistent with the declared count within 20 %", not an exact pill count. The count is an inference from mass (A-008). This is not a single-dose guarantee. Difference noise is `√2 σ`; with an assumed `σ ≈ 0.1 g`, `3 √2 σ ≈ 0.42 g < 0.5 g`, which is the assumed reason the floor is 0.5 g and a single 0.1 g pill is only a goal.

## Unverified facts (must be checked)

| Fact | Used for | How to verify |
|---|---|---|
| Wall between the tongue pocket and the outboard pad corridor (vertex rows at x = 7.4 and 10.4 in `station-housing`) | pad bar position, slot size | print canonical housing bounds near x 7..12, y −14..6 (task 1) |
| Deck outer radius: viewer deck ≈ 34.5 mm at x = 0 vs canonical mesh max r 26.54 (Feature 005 conflict C5) | lug sweep clearance | extend the rotation sweep approach to the lug submeshes |
| 100 g-class cell with a 24-bit ADC reaches ≈ 0.1–0.2 g noise in ≈ 1 s | floor justification | bench measurement on a rig (never reported as met here) |
| Micro actuator with ≈ 2.1 mm stroke fits the 9.5 mm free band with cell and carriage | station height | part drawing / mock-up |
| PETG-class density 1.27 g/cm³ | lug mass allowance | scale on printed lugs |
| Pill mass 0.1–1.5 g (A-007), 1 g for budgets | window, loading | user-declared per compartment |

## Open choices (also in the plan report)

- **Q1** Keep the spec's ±20 % tolerance even though it cannot discriminate ±1 pill at N ≥ 6?
- **Q2** Is refusing a declared total below the 0.5 g floor acceptable under FR-001, or should a sixth outcome be added?
- **Q3** Approve the Feature 005 concept changes the weighing station implies (hook clearance 18.0 → 18.8, cartridge lugs, deck slots) as recorded conflicts applied only in the task phase.
- **Q4** Should `UNSTABLE` results count toward the lock limit, or only repeated-failure reporting (as planned)?
- **Q5** After `RETRY_EXHAUSTED`, is a supervised reset also required (planned) or may the later lid feature release it?
- **Q6** Viewer scope: replay of curated fixtures only (planned) vs also a free-form declared count/mass entry.
