# Mechanism Model (T037)

The singulation model behind `src/dispenser_sim/mechanism/singulation.py`:
a parametric 2D kinematic/pseudo-physics evaluation of each actuation cycle
(research.md R1/R2). All quantities are physical and configurable
(Constitution II); every simplification is stated with its justification
(FR-005).

## Per-cycle evaluation

For each actuation cycle the engine presents the next reservoir pill (plus an
optional follower) and the model resolves the cycle at the metering point:

### 1. Clearance check (jam)

The pill's maximum transverse width at its sampled orientation is compared
against the effective passage clearance:

- Round tablet (circular profile): `w = length` (diameter).
- Stadium profile (oblong caplet, capsule):
  `w(θ) = width + (length − width) · |sin θ|`, with θ the long-axis angle to
  the direction of travel.
- Effective clearance per cycle: `c_eff = passage_clearance_mm ± jitter`,
  jitter drawn uniformly from `tolerances_mm.passage_clearance` on the seeded
  cycles sub-stream.

If `w > c_eff` the pill wedges: the cycle faults as a **JAM**. A jammed pill
is consumed from the reservoir (stuck in the mechanism); a jam may persist
across subsequent cycles until cleared (probability
`JAM_PERSIST_PROBABILITY`, 1–3 blocked cycles), recorded via
`jam_persistent` per event.

### 2. Force balance (missed dispense)

Mean actuation force over the stroke, from `E = F · d`:

`F_avail = actuation_energy_j / (stroke_length_mm / 1000)`

Coulomb friction resistance at the gate:

`F_resist = μ · m · g · (1 + max(0, fit − 0.5) · FIT_CONTACT_FACTOR)`

with `fit = w / passage_clearance_mm`, `g = 9.81 m/s²`, mass in kg, and
`FIT_CONTACT_FACTOR = 4.0` (tight fits multiply the contact force). If
`F_avail < F_resist` the pill is not released: **MISSED_DISPENSE**; the pill
falls back and is not consumed. Mechanisms without `stroke_length_mm` in
`metering_geometry` skip this check (any positive actuation energy suffices).

### 3. Multi-release (double-drop / stacking)

A follower pill is presented with probability proportional to the lead
pill's gate headroom: `P(follower) = max(0, 1 − w/gate_width_mm) · 0.4`.
Effective gate width per cycle: `g_eff = gate_width_mm ± jitter` from
`tolerances_mm.gate_width`.

- **DOUBLE_DROP**: `w_lead + w_follower ≤ g_eff` — both pills pass the
  oversized outlet side by side in one stroke.
- **STACKING**: side-by-side does not fit, but the follower clears the
  passage individually and is dragged through aligned behind the lead with
  probability `0.3 · max(0, 1 − w_lead / c_eff)`.

### 4. Interrupted stroke (fault scenario)

With probability `0.005` per cycle the actuation is interrupted mid-stroke
(partial actuation, spec edge case): the cycle faults, the pill is not
consumed, and the zero-dose violation is classified **UNCLASSIFIED** with
the pill state preserved (FR-014).

## Classification

Every zero-dose (pills available) or multi-dose cycle is a single-dose
invariant violation (FR-011) and is classified by
`src/dispenser_sim/simulation/failure_modes.py` into JAM / MISSED_DISPENSE /
DOUBLE_DROP / STACKING / UNCLASSIFIED (FR-013/014). Empty-reservoir cycles
are `NO_PILL_AVAILABLE` outcomes, never violations (FR-012). The run report
aggregates the failure-mode breakdown to exactly 100% of violations
(SC-003).

## Simplifications and physical justifications

- **2D cross-section at the singulation plane**; pill thickness enters only
  via mass. Singulation is governed by transverse width vs passage
  clearance, so the 2D profile captures the jam/stacking/double-drop
  geometry at a fraction of 3D DEM cost (research.md R1).
- **Pills present at their sampled orientation without flow alignment** — a
  conservative worst case for tumbling reservoirs; predicted jam rates are
  upper bounds for agitated hoppers.
- **Coulomb friction with a single per-pill coefficient**; wall contact
  during one stroke is brief and coated/uncoated tablets are bracketed by
  the documented μ range below.
- **Mean-force energy conversion** (`E = F · d`); impact dynamics within the
  0.1–1 s stroke are neglected.
- **Lumped stacking probability** scaled by clearance headroom; end-to-end
  pill trains through metering points are observed in rotary/slider feeders
  but their tribology exceeds a 2D quasi-static model.

## Confirmed numeric pill ranges (research.md R2 open item)

Configured in `configs/pills/standard_mix.json`; values outside these ranges
are accepted but flagged in the run record (FR-009):

| Category | Length (mm) | Width (mm) | Thickness (mm) | Mass (g) |
|---|---|---|---|---|
| round_tablet | 3.0–13.0 (Ø) | = length | 2.0–6.0 | 0.05–0.8 |
| oblong_caplet | 6.0–19.0 | 3.0–8.0 | 2.5–7.0 | 0.15–1.2 |
| capsule | 11.0–26.0 | 3.0–10.0 | 3.0–10.0 | 0.05–1.5 |

- Friction coefficient μ: 0.2 (smooth coated) – 0.6 (sticky/uncoated).
- Orientation: uniform over 0–180° at the singulation point.

**Measurement plan**: confirm against published pill-size data or caliper /
scale measurements of the team's actual medication set before hardware
decisions; update the version-controlled config and this document together
(Constitution II/V).

## Separate rotating-cartridge concept viewer

The scan-derived browser demonstration at
[docs/visualizer/index.html](visualizer/index.html) is independent of this
2D slider/rotary simulation model and its persisted run records. It recreates
the four-cartridge drum, pin/servo/blade/tongue sequence, barcode/container
workflow, and deterministic visual inventory from the supplied concept scan. Its
`concept_geometry.json` records explicit scan values, inferred placements,
assumptions, and missing engineering inputs separately. It does not execute
the failure-probability model above, control hardware, identify medication, or
establish successful single-dose performance.

The scanner is part of that same main scene, not only a separate scanner page.
The `Show barcode scanner subsystem` checkbox independently shows/hides its
reader housing/optics, guide, fictional barcode package, local fixture-decoder
visual, and scan beam without changing controller state. The exact supported
fictional fixtures are RED `5012345678900`, BLUE `5012345678917`, GREEN
`5012345678924`, and ORANGE `5012345678931`. Fresh load and safe reset show
those four compartments empty, count zero, caps closed/locked, and no pill
actors. A unique supported scan animates package-in/read/result, placement of
an empty container only into its matching available compartment, package-out,
and then opening only its simulated cap. Placement does not create pill
inventory: the explicit Fill control is available only with the matching cap
open and adds up to five assumed demo pills. Unsupported, unmapped, unknown,
ambiguous, invalid, and loaded/unavailable-target scans report a refusal and
leave every compartment unchanged. Feature 003 uses its own local fixtures and
state; it does not import or share Feature 004 state. These are display-state
transitions, not a physical scan or lid command; fixture codes do not access
NDC data or verify container contents.

The visual dispense sequence begins parked with zero chamber occupancy and
the bottom pill supported in the selected cartridge. The upper blade opens
along the user's selected local-Y slide while the lower tongue stays closed;
the bottom pill then falls to the tongue, the blade closes with its top wedge,
and a 0.3-second closed dwell precedes pin lift. Only after the upper blade is
closed and the pin/carriage clear does the shared tongue slide on canonical Y.
The same pill actor falls vertically through the outlet to tray-floor height
before moving laterally to a tray slot. The selected Blade Y direction retains
the supplied source's contradictory perpendicular-axis wording as an explicit
unresolved caveat; axis choice, fit, clearances and motion are not physically
validated.

The shared tongue's return spring is shown inline with canonical Y, between the
tongue's compartment-facing edge and a reaction pad integrated into the fixed
station housing. It extends as the tongue moves toward negative Y and depicts a
return bias toward the positive-Y closed stop; it is not anchored to a removable
compartment. This mount, spring type, extension, preload and force remain
assumed or unknown, not validated hardware design.

The sibling `dispenser-sim export-3mf --output ...` exports a parked concept
assembly from that same source. It is permanently **NOT VALIDATED / NOT
PRINT-READY**; FDM/PLA/0.4 mm is provisional guidance only. The missing
authoritative drawings, fits, force specifications, materials, tolerance stack,
and measured prototype evidence must be resolved before any physical-design
claim. This concept has no effect on the feature-001/002 engine or 2D player.
