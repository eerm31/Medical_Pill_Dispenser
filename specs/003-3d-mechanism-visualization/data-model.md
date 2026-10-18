# Data Model: Rotating-Cartridge Concept Viewer and Export

**Feature**: 003-3d-mechanism-visualization | **Updated**: 2026-10-10 | **Status**: Canonical geometry/export/controller implemented; WebGL foreground and manufacturing validation pending

The static browser demo and Python exporter are independent of simulation runs and feature-002 replay. The versioned package resource `src/dispenser_sim/viz3d/concept_geometry.json` is the one authored geometry/provenance source; `docs/visualizer/concept-data.js` is a deterministic generated classic-script bundle. Lengths are millimetres, time seconds, angles radians internally/degrees in visible status where indicated. Every scan value is a concept input, not approved physical authority.

## Provenance and validation vocabulary

`provenance` is one of `USER_SPECIFIED`, `SCAN_EXPLICIT`, `SCAN_INFERRED`, `ASSUMED`, `DERIVED`, `DEMO_FIXTURE`, `MISSING`.

- `USER_SPECIFIED`: stated in the controlling two-gate user requirement. Preserve its source reference; it remains a concept input, not measured physical validation.
- `SCAN_EXPLICIT`: directly stated in prototype source/text. Preserve source reference/phrase. Does not mean measured, approved, or authoritative for construction.
- `SCAN_INFERRED`: estimated by interpreting primitive coordinates, rendered shape, relative placement or approximate prose.
- `ASSUMED`: concept-only geometry/pill/stack/display parameter introduced for the demo.
- `DERIVED`: deterministic value calculated by a named, versioned rule from other values.
- `DEMO_FIXTURE`: UI-only barcode/name/palette/schedule value, not medication truth.
- `MISSING`: null value with reason and the evidence required to supply it. Never replace unknown with 0.

All geometry/design `DimensionRecord`s also carry `verification_status=NOT_VALIDATED`. This is separate from provenance. `artifact_qa=PASS` means only that specified files, data structure, transforms or bounded mesh checks passed. It cannot promote design/manufacturing readiness. Export constants remain `validation_status=NOT_VALIDATED`, `print_ready=false`, `fabricable_as_designed=false`.

## Canonical concept definition

### ConceptGeometryDocument

Versioned JSON root fields:

| Field | Meaning |
|---|---|
| `schema_version` | Version of canonical JSON shape, independent of mesh generator revision. |
| `concept_id`, `display_name` | Stable concept identifier and UI title. |
| `generator_revision` | Versioned Python/browser interpretation and derived-rule set. |
| `source` | Supplied scan identifier, source description, source date/revision where known; the external source path is not treated as portable repo content. |
| `units`, `source_axes`, `assembly_axes` | Millimetres and explicit source-to-export transform. Scan scene maps `(x,y,z)` to `(x,z,-y)`; canonical/3MF uses right-handed +X right, +Y back, +Z up. |
| `dimensions` | Named explicit, inferred, assumed, derived and missing concept values with value/unit/source/uncertainty/status. |
| `derived_rules` | Stable `rule_id`, revision, source dimensions, formula/parameters, output features and rationale for every derived shape/placement. |
| `materials/palette` | UI color IDs and values, flagged as display colors rather than real material specifications. |
| `components` | Stable named physical component-instance records, recipe, local frame, rest transform, functional role and linked dimensions/provenance. |
| `demo` | Initial cartridges/inventory, color schedule, barcodes, action/timing constants and UI labels; distinct from mechanical design. |
| `known_missing_inputs` | Required unknowns by component/feature plus evidence needed; includes material, spring, actuator, fit, interfaces, envelope, dimensions and tolerances. |
| `export_policy` | Fixed rest pose, inclusion/exclusion list, units, handedness, status literals and manifest schema. |

Unknown values have `value:null`, `unit:"unknown"` or no numeric unit as appropriate, source/status, `reason`, and `evidence_needed`. A numeric value must be finite and state its unit and coordinate frame where relevant. Derived dimensions refer to an existing rule; a handwritten derived result without an executable/rationalized rule is invalid.

### GeometryRule and DimensionRecord

`GeometryRule`: `rule_id`, `revision`, `output_feature`, `input_dimension_ids[]`, `formula`/recipe, fixed parameters, rationale, and `verification_status=NOT_VALIDATED`.

`DimensionRecord`: `dimension_id`, `component_id` or assembly scope, `name`, `value:number|null`, `unit`, `provenance`, `source_ref`, optional coordinate/frame, optional `uncertainty_or_estimate`, optional `tolerance:{value,unit,source}|null`, `verification_status`, `caveat`, and `evidence_needed`. An estimated ±1 mm alignment allowance and the mentioned 0.3 mm gaps are estimates only; they MUST NOT populate approved manufacturing tolerance fields. A 0.01 mm numerical geometry comparison threshold, if adopted, is held in QA configuration and never appears as a design tolerance.

### Scan-derived value register

| ID / feature | Value | Provenance | Mandatory note |
|---|---:|---|---|
| `drum.outer_radius` | 15 mm | SCAN_EXPLICIT | Source `RR`; no authoritative drum envelope/structure. |
| `cartridge.radial_position` | 15 mm | SCAN_EXPLICIT | Source placement; 4 equal angular stations inferred/explicit from arrays. |
| `central_post.radius`, `height` | 2.5 mm, 46 mm | SCAN_EXPLICIT | Source cylinder only. |
| `station.footprint_x`, `.footprint_y` | −22..+22, −38..+36 mm (44×74 mm) | SCAN_EXPLICIT/SCAN_INFERRED | Primitive bounds; not an overall device envelope. |
| `servo.crank_radius`, `connecting_rod.length` | 5.2 mm, 34 mm | SCAN_EXPLICIT | No torque/rating/feedback. |
| `servo.pivot_y`, `.pivot_z` | −54 mm, approximately 15.2 mm | SCAN_EXPLICIT | Z expressly approximate; frame conversion required. |
| `carriage.horizontal_stroke` | −5.2..+5.2 mm (10.4 mm) | SCAN_EXPLICIT | Prototype coordinate travel. |
| `pin.vertical_stroke` | 5 mm | SCAN_EXPLICIT | No force/return/sensor specification. |
| `blade.slot` and `pin.diameter` | 5×4 mm slot; 3 mm pin | SCAN_EXPLICIT | Scan also estimates ±1 mm alignment allowance; not a tolerance. |
| `upper_blade.tip_x` | −5.2..+5.2 mm | SCAN_EXPLICIT | Per-cartridge concept travel. |
| `tongue.length`, `.edge_position`, `.travel` | 24 mm; +5.7/−5.7 mm; 11.4 mm | SCAN_EXPLICIT | Actuator/spring geometry and force are inferred/missing. |
| `tray.approximate_size` | approximately 40×58 mm | SCAN_INFERRED | Source bounds are about 43×61 mm including margins; height missing; do not claim resolved geometry. |
| `pill.assumed_size`, `demo.pill_count` | 10×7×5 mm; 5/cartridge | ASSUMED | Oval visual placeholder; not medication design or evidence. |
| `clearance.mentioned_gap` | 0.3 mm | SCAN_EXPLICIT | Source says gaps are not designed; not a manufacturing tolerance. |

All listed values are concept-only and `NOT_VALIDATED`; each geometry recipe carries its own source/rule and any missing interface inputs. Do not backfill the four mechanism configuration files with this concept or infer the missing height, mass, power, material, wall sizes, actual interfaces or clearances.

## Physical component and assembly entities

### ConceptAssembly

- `concept_id`, `schema_version`, `generator_revision`, `source_geometry_sha256`.
- `units=mm`, `handedness=right`, `reference_pose=parked_rest`.
- `components[]`: full physical instance list and rest transforms; this is the component inventory in the contract below.
- `bounds_mm`: measured bounds of generated concept meshes only, explicitly not an authoritative full-device envelope.
- `swept_bounds_mm`: optional display of component travel, never substituted for rest pose export.
- `verification_status=NOT_VALIDATED`; no printed/fabricable status.

### PhysicalComponentInstance

Each component has stable `component_id`, unique `display_name`/3MF object name, `physical_category`, `recipe_id` and parameters, `local_frame`, `rest_transform`, linked dimensions/rules, `provenance_summary`, missing interfaces/tolerances, `include_in_export`, and `verification_status`. Instance names are distinct for all four cartridge, cap, upper blade/tab and spring instances. Geometry recipes may share values, but every instance receives a unique ID/name/transform. Moving parts are positioned at parked rest, not at active animation phase.

Exported intended instances (freeze stable IDs and exact count in `geometry-source-contract.md` prior to implementation): station/housing; central post; rotating drum; four cartridges; four caps; four upper blade/tab parts; four upper-blade return springs; servo unit (housing/output shaft treated as one modeled unit); crank; connecting rod; pin carriage; two rails; solenoid body; pin/plunger; shared tongue; tongue actuator rod; tongue return spring; barcode scanner housing; outlet tray. Current inventory is **32 physical instances** with servo housing/shaft combined; no separate servo electronics/fasteners are implied. Excluded from the 3MF: assumed pill actors, package/card, barcode textures, scan beam, labels, UI, camera and transient animation state. Every exclusion is written into the manifest. Exact named inventory and order are fixed by the source contract.

The single `tongue-return-spring` instance is an `ASSUMED` visual layout aligned with canonical Y. It spans from the shared tongue's positive-Y edge to an integral fixed reaction pad in the station-housing recipe; opening translates the tongue negative Y, extending the rendered spring so its depicted return bias points toward the closed positive-Y stop. It is not anchored to a removable cartridge/compartment. The assumed mount and animated extension do not determine real spring type, material, rate, preload, interfaces, extension limits, or force; those remain missing. This reuses the existing named physical instance and does not change the 32-part export count.

### MeshRecipe and MeshQA

`MeshRecipe` is a bounded primitive descriptor (box, cylinder, cone/frustum, extrusion/lathe profile, or helix) with finite dimensions, local transform and stable recipe revision. Python creates deterministic local millimetre mesh vertices/triangles; browser interprets the same recipe with Three.js geometries. Coordinate adapters are tested against known points and transforms. Deterministic ordering and numeric serialization are required.

`MeshQA` records each check and scope: finite coordinates/indices, nonzero triangles, recipe bounds, assembly references, transform validity, and any tested closed-edge/orientation criteria. Unsupported self-intersection, contact, printability, fit, or design checks remain `NOT_CHECKED`/`UNKNOWN`; `PASS` on bounded structural tests is not 3MF standards certification or engineering validation. Do not describe overlapping primitive shells as a validated solid.

## Demo state entities

### DemoState

In-memory, deterministic, not persisted, and not an 001/002 `RunRecord`. Contains `phase`, selected cartridge, controller time, pending elapsed time, transition index, `demo_speed`, `servo_angle_deg`, `pin_state` (`up|moving|engaged`), `carriage_position_mm`, `blade_tip_x_mm[4]`, `tongue_edge_mm`, `tray_pill_count`, four `CartridgeState`s, `scanner_state`, active operation/schedule, user-visible blocker/rejection reason, and immutable initial fixture. Initial state: parked, crank at 180°, pin up, carriage out/parked, tongue edge +5.7 mm/closed; all four RED/BLUE/GREEN/ORANGE cartridges present and empty at count 0, all caps locked/closed, no pill actors, tray count 0.

### FSM state sequence and timing

| Order | State | Exit/guard | Moving indicator |
|---:|---|---|---|
| 1 | `PARKED` | Accepted color request; all caps closed; matching compartment present, loaded, and count-positive; no scan or active request | Crank 180°, pin up, carriage parked, tongue closed |
| 2 | `DRUM_ROTATE` (if required) | Target station aligned; only start if pin up and carriage parked | Drum turns to deterministic nearest target angle at 1.3 rad/s × speed |
| 3 | `CARRIAGE_APPROACH` | Servo/carriage reaches inner tab position | Crank/rod move at 3.1 rad/s × speed over 5.2 mm derived stroke; blade remains closed |
| 4 | `PIN_ENGAGE` | Alignment and slot guard satisfied | Pin moves down 5 mm at 8 mm/s × speed |
| 5 | `BLADE_PULL_RELEASE` | Selected blade reaches open position; stack remains retained above single visual transfer | Servo moves at 3.1 rad/s × speed; deterministic selected pill transfers to tongue and cartridge count decrements exactly once |
| 6 | `STACK_SETTLE` | 0.5 s × speed | The already-counted assumed pill settles on shared tongue; no further inventory change |
| 7 | `BLADE_ISOLATE_CLOSE` | Return completes | Blade closes against its own concept spring under servo motion |
| 8 | `PIN_LIFT` | Pin fully up | 5 mm at 8 mm/s × speed |
| 9 | `CARRIAGE_PARK` | Carriage fully parked | Servo/rod at 3.1 rad/s × speed |
| 10 | `ISOLATED_DWELL` | 0.3 s × speed | Pin up, carriage parked, upper gate closed; rotation now safe |
| 11 | `TONGUE_RELEASE` | Tongue reaches −5.7 mm edge | Shared actuator changes independently at 14 mm/s × speed; exactly one visual actor enters tray |
| 12 | `PILL_CLEAR` | 0.5 s × speed | Tray count increments once at the deterministic release boundary |
| 13 | `TONGUE_RETURN` | Edge returns +5.7 mm | Shared spring-return motion at 14 mm/s × speed; returns to `PARKED` |

For angular motion, durations equal required angle divided by the named angular rate; for linear motion, travel divided by named linear rate; dwell times are explicit. Interpolation and rates are presentation-only and non-authoritative. The controller permits a new operation only after a transition has completed and the system is safe.

Cap opening/closing uses a fixed 0.25 s easing transition (`ASSUMED_UI_TIMING`, not scan-measured motion); cap-open dispense blocking applies from the start of opening through completed closure. Cartridge removal/insertion animates the source's 75 mm lift at 60 mm/s (1.25 s, scan-derived display rate, not a physical extraction force); it is a serialized busy transition, while the stored presence flag changes only at its defined endpoint and inventory remains untouched. These presentation transitions cannot overlap scan, dispensing, refill or reset.

### CartridgeState, CapState, ScannerState

`CartridgeState`: `color_id` in `red|blue|green|orange`, `present:bool`, `occupancy:empty|loaded`, `container_code:string|null`, `remaining_assumed_count:0..5`, `pill_actor_positions[]` deterministic/no jitter, `cap_state`, `cap_unlock_remaining_wall_s`. Initial/reset count is zero, occupancy empty, container association null, no visible pill actors, cap locked/closed. A successful supported scan commits its exact same-color fictional container association after placement completion but leaves count zero. Explicit Fill while that cap is open creates up to five assumed demo pills/actors. Removing/inserting while idle and cap closed preserves occupancy, association, and count. A removed or empty cartridge is rejected for dispensing.

`CapState`: `locked|open` for visible stable states, with a deterministic opening/closing presentation operation. A unique supported fictional barcode fixture can target only its same-color empty/available compartment; after local recognition, the container placement animation commits association with count still zero, then package-out completes before that one cap opens. Any unsuccessful or loaded/unavailable target scan places nothing, opens no cap, and preserves every compartment state. Open state blocks dispensing and scanning. User close returns the cap to locked/closed. Explicit Fill while open creates up to five assumed visual pills. These are deterministic UI states, not physical access control or lid actuation.

`ScannerState`: `idle|package_in|beam|result|package_place|package_out`, followed by the matching `CAP_OPEN` visual transition only when a supported unique fixture targets an empty available compartment. Demo timings are fixed local UI phases from the canonical source; scan cannot overlap mechanical actions, cap changes, refill, exchange or reset. Exact mappings are RED/BLUE/GREEN/ORANGE only; unsupported, unmapped, unknown, ambiguous, invalid and loaded/unavailable targets leave compartment state unchanged. The main-scene `Show scanner subsystem` toggle controls only scanner renderer objects/labels and never mutates scanner or compartment state.

### DemoSchedule

Fixed request order `RED → BLUE → GREEN → ORANGE → BLUE → RED`. Modes `once|repeat`; loop repeats only while every requested compartment has assumed demo inventory, is inserted, and is otherwise available. Empty startup therefore blocks dispensing/schedule until successful container scans and explicit Fill actions provide assumed demo contents. The schedule stops at the first blocked request; there is no implicit refill or inventory reset. Safe reset restores all four empty compartments, zero counts, no pill actors, closed/locked caps, and parked mechanics.

### Time/state update invariants

RAF time is presentation-only. A monotonic accumulator processes at most one state transition per rendered frame and carries overshoot; the entered state is observable for one frame before additional pending elapsed time is consumed. All operations and counts are deterministic for the same ordered input/time sequence. Camera, labels, cap visibility and render cadence do not mutate counts. No `Math.random`, nondeterministic physics, hidden auto-retry, dropped state, or core simulation event is permitted.

## Barcode / palette data

| ID | Color label | Code | Role |
|---|---|---|---|
| `red` | Red | `5012345678900` | Known illustrative barcode fixture |
| `blue` | Blue | `5012345678917` | Known illustrative barcode fixture |
| `green` | GREEN | `5012345678924` | Known illustrative barcode fixture |
| `orange` | ORANGE | `5012345678931` | Known illustrative barcode fixture |
| `unsupported` | Unsupported color | `5012345678948` | No target; no placement/open/mutation |
| `unmapped` | Unmapped | `5012345678999` | No target; no placement/open/mutation |
| `unknown` | Unknown | `9999999999999` | No target; no placement/open/mutation |

All IDs/labels/codes are demo data. A successful barcode animation does not authenticate contents or identify pills in a cartridge.

## Manifest and artifact transaction model

`ExportManifest` contains `schema_version`, generator/source geometry revisions/hash, coordinate convention, units, reference pose, ordered component instances with resource IDs/names/transforms/recipe hashes, per-component provenance/dimensions/rules/unknowns/tolerances, inclusion/exclusion list, mesh/package QA with untested fields explicit, process guidance, blocked manufacturing evidence checklist, exact package SHA-256, self-excluding canonical `manifest_sha256`, `validation_status`, `print_ready`, and `fabricable_as_designed`. The self-excluding manifest digest is SHA-256 over canonical UTF-8 JSON after omitting only `artifact_integrity.manifest_sha256`; package digest is SHA-256 over exact `.3mf` bytes. This avoids recursive hashes.

Transaction states: `SOURCE_VALIDATED → STAGED_PAIR → STRUCTURE_AND_HASH_QA → PUBLISHING → COMMITTED` or handled-error rollback. Both staged files are verified before publication. Each file is atomically replaced independently; package and manifest are not crash-atomic as a pair. A missing pair/hash mismatch is `INCOMPLETE_PAIR`; never report success. Reject run/source/symlink/hardlink/alias destinations even with `--force`.

## Explicit missing inputs and validation boundary

Missing or unresolved: authoritative part drawings/CAD; all wall thicknesses and exact internal/external profiles; cartridge/drum clearances and retention/interfaces; cap hinge/latch/seal; upper blade dimensions, spring shape/rate/force and return limits; tray height/interface; station full height/device envelope; mass/material; actuator manufacturer/model, servo torque/angular feedback, solenoid force/pull/energy, guide/rail fit, wiring, sensors and electronics; tongue geometry/spring/actuator rating; approved datum/tolerance stack; manufacturing process settings and prototype results. The JSON must keep these as explicit nulls by component.

Readiness values are immutable for this feature. Provisional FDM/PLA/0.4 mm guidance is explicitly non-binding and not applied as a geometry correction. No dimensions or concept mesh checks validate a single-dose outcome, dose accuracy, pharmaceutical identity, hardware safety, electrical behavior, portability budget, or printability.
