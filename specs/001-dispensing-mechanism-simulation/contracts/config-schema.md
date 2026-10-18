# Contract: Configuration Schemas

**Feature**: 001-dispensing-mechanism-simulation | **Version**: 1.0 (draft)

Mechanism configs, pill distributions, and the portability envelope are JSON files validated before any run. Unknown fields are rejected; all physical values carry the units named below (Constitution II).

## Mechanism config (`*.json` for `--mechanism`)

```json
{
  "name": "slider-gate-v1",
  "reservoir_capacity": 60,
  "passage_clearance_mm": 9.0,
  "metering_geometry": {
    "stroke_length_mm": 24.0,
    "gate_width_mm": 8.5,
    "singulation_angle_deg": 32.0
  },
  "actuation_energy_j": 0.8,
  "stroke_time_s": 0.6,
  "tolerances_mm": { "passage_clearance": 0.15, "gate_width": 0.1 },
  "overall_dimensions_mm": { "length": 120.0, "width": 60.0, "height": 45.0 },
  "mass_g": 280.0,
  "simplifications": [
    "2D cross-section model: pill height projected onto the singulation plane; justified because singulation is governed by transverse width vs passage clearance."
  ]
}
```

Validation rules (FR-003/004/005): every numeric field > 0 (tolerances ≥ 0); `overall_dimensions_mm` and `mass_g` checked against the envelope; `simplifications` is required and each entry must state a physical justification.

## Pill distribution (`*.json` for `--pills`)

```json
{
  "reservoir_size": 60,
  "category_weights": { "round_tablet": 0.5, "oblong_caplet": 0.3, "capsule": 0.2 },
  "categories": {
    "round_tablet": {
      "length_mm": [3.0, 13.0], "width_mm": [3.0, 13.0], "thickness_mm": [2.0, 6.0],
      "mass_g": [0.05, 0.8]
    },
    "oblong_caplet": {
      "length_mm": [6.0, 19.0], "width_mm": [3.0, 8.0], "thickness_mm": [2.5, 7.0],
      "mass_g": [0.15, 1.2]
    },
    "capsule": {
      "length_mm": [11.0, 26.0], "width_mm": [3.0, 10.0], "thickness_mm": [3.0, 10.0],
      "mass_g": [0.05, 1.5]
    }
  },
  "friction_coefficient": [0.2, 0.6],
  "orientation_deg": { "mode": "uniform", "min": 0.0, "max": 180.0 }
}
```

Validation rules (FR-006–009): only the three supported shape keys; `category_weights` sums to 1.0 (±1e-9); every range is `[min, max]` with `0 < min ≤ max`; ranges outside the documented realistic envelope (research.md R2) are accepted but flagged in the run record so worst-case-loaded populations remain possible (FR-009).

## Portability envelope (`configs/portability_envelope.json`)

```json
{
  "max_dimensions_mm": { "length": 200.0, "width": 100.0, "height": 80.0 },
  "max_mass_g": 1000.0,
  "max_actuation_energy_j": 2.0
}
```

Version-controlled; numeric limits are product decisions, not code constants (Constitution V).
