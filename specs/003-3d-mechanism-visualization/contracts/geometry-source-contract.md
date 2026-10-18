# Contract: Shared Concept Geometry Source

**Feature**: 003-3d-mechanism-visualization | **Version**: 1.2 (tongue-return spring source contract, 2026-10-11)

The browser scene and Python 3MF exporter consume one versioned source. This contract prevents the viewer/export meshes, values, placements and provenance from diverging. The canonical source is package data at `src/dispenser_sim/viz3d/concept_geometry.json`; `docs/visualizer/concept-data.js` is a generated classic-script representation for direct `file://` loading. Do not hand-edit the generated bundle.

## Source and generation

- Canonical JSON uses UTF-8, stable IDs/order, sorted-key canonical hashing, compact separators and no NaN/Infinity. Package `schema_version` and `generator_revision` are independently versioned.
- Python loads the file through package-resource APIs so a non-editable installed CLI can export without the repository checkout. `pyproject.toml` explicitly includes the JSON package resource.
- `tools/build_visualizer_data.py` reads and validates the same resource, then writes a deterministic classic script that installs exactly one frozen/read-only global `DISPENSER_CONCEPT_DATA`. The generated file includes schema/revision/source hash metadata; it performs no file reads, imports, fetches, network calls or randomization.
- Browser entrypoint loads local classic scripts in dependency order: vendored Three r128, generated concept data, DOM-independent demo controller, then viewer application. No JavaScript modules, import maps, worker/network loader or JSON `fetch` are used.
- A pytest check runs the generator in memory and byte-compares output with the checked-in browser bundle; another loads the package JSON and validates all schema/geometry/provenance values. A bundle with a stale hash/schema or manual edit is rejected by development checks.

## Root schema

The document includes:

| Required key | Type/contract |
|---|---|
| `schema_version` | Positive integer; incompatible versions fail closed. |
| `concept_id` | Stable string, fixed to this four-cartridge scanned concept. |
| `generator_revision` | Version identifier for geometry recipes and any derived-rule formulas. |
| `source` | Prototype identifier/version/date if known; source statement and authority disclaimer. It identifies the supplied scan as visual input, not CAD. |
| `units` | `mm` for length, `s` for duration, `rad` or `deg` explicitly for angles. |
| `frames` | Named source/view/export bases and explicit right-handed source-to-canonical transform; no implicit axis swaps. |
| `palette` | Four stable color IDs/labels/CSS/Three material colors, flagged as display-only. |
| `dimensions` | Stable dimension records with numeric/null values, units, source provenance, frames, caveats, and missing-evidence notes. |
| `derived_rules` | Stable rule IDs/revisions/formulas/inputs/rationale for every inferred/derived profile or placement. |
| `component_recipes` | Reusable local shape recipes and typed parameters; only approved bounded primitive kinds. |
| `components` | Ordered physical instances: unique IDs/names, recipe references, parameters, rest transform, role, linked provenance/missing interfaces and export inclusion. |
| `demo` | Empty initial inventory and caps, exact supported RED/BLUE/GREEN/ORANGE fixtures, schedule order/mode behavior, timings/rates and cap timeout. Any later five-pill assumed demo inventory is loaded only by explicit Fill after a supported container scan. Every item is marked demo/assumption. |
| `missing_inputs` | Explicit null unknowns by component/feature plus evidence needed. |
| `export` | Fixed parked rest pose, 32-instance inventory reference, inclusion/exclusion list, right-handed mm convention and mandatory status strings. |

Unknown dimension value is JSON `null`; no placeholder numeric zero. Each dimension includes `provenance` from `SCAN_EXPLICIT`, `SCAN_INFERRED`, `ASSUMED`, `DERIVED`, `DEMO_FIXTURE`, `MISSING`, plus independent `verification_status:"NOT_VALIDATED"`. A dimension's source reference points to scan text/code snippet identifier or a versioned rule. Explicit does not mean authoritative. Estimates/uncertainties are not manufacturing tolerances; only separately approved design tolerance fields could ever populate `tolerance`, and none are available in this scan. Unavailable tolerance is null and listed in `missing_inputs`.

## Component and recipe interfaces

`component_recipes` are immutable geometry descriptions used by both adapters. Each has `recipe_id`, `recipe_revision`, `kind`, finite scalar/array parameters with units, local axis/frame, and interpretation note. Supported initial kinds are bounded `box`, `cylinder`, `cone`/`frustum`, polygonal `extrusion`/`lathe_profile`, and deterministic `helix` for illustrative springs. Unrecognized recipe kinds or missing dimensions cause validation failure; never substitute arbitrary geometry silently. No general CSG is promised.

Each `components[]` record has:

- `component_id`: unique stable ID; four cartridge/cap/blade/spring records are distinct physical instances.
- `name`: unique stable human-readable component/3MF resource identity.
- `category`, `functional_role`, `recipe_id`, instance parameters and local origin.
- `rest_transform`: explicit rigid local-to-assembly matrix/translation in the declared canonical frame.
- `dimension_refs[]`, `rule_refs[]`, `provenance`, `verification_status=NOT_VALIDATED`, `caveats`, and per-feature `missing_inputs[]`.
- `export_inclusion`: `physical_component` or `demo_only`; no undocumented content may enter the 3MF.

Recipe reuse is allowed only for repeated nominal geometry; it never merges distinct component identities. The expected physical set/count and exact order are specified by [the 3MF contract](3mf-export-contract.md). The following actors are demo-only and excluded from exported geometry: 20 assumed pill actors, barcode carton/card/artwork, scan beam, label sprites, status UI, camera and motion overlays.

The shared tongue's one existing `Tongue Return Spring` instance uses a separate `tongue-return-spring` helix recipe aligned to canonical Y. In the closed pose, one spring end meets the tongue's positive-Y edge and the other meets an integral reaction pad in the `station-housing` recipe. As the tongue opens toward negative Y, the rendered helix extends and depicts a positive-Y return bias. This mount/type/extension is an `ASSUMED` presentation geometry rule only; the removable compartments are not reaction members. Spring type, material, rate, preload, interfaces, extension limits, and physical force remain missing/unvalidated; component count and 3MF inventory remain 32.

## Coordinate transformation

The scan-authored mechanism coordinates are millimetres with X horizontal/right, Y depth-positive/back and Z up. Canonical/3MF coordinates use the same physical basis (+X right, +Y back, +Z up); record the source-to-canonical transform explicitly (identity for the declared basis). The scan's Three.js adapter maps authored `(x, y, z)` to Three world `(x, z, -y)` (Three Y is vertical). The source-to-Three rotation must be represented by a tested matrix, not ad hoc axis renaming. Apply each conversion exactly once to geometry and component placement, never both. Browser/JSON and 3MF/Python tests use signed basis vectors, post location, radial cartridge locations and nonidentity rotations/translations to prove handedness and inverse/round-trip behavior.

All source-value provenance retains the original frame. For example, station footprint bounds and servo pivot y values are not reused as canonical y values without transformation metadata. The browser and exporter must agree on all named canonical rest transforms after conversion.

## Demo constants in shared document

- Four supported color IDs and order `red, blue, green, orange`; initial inserted=true, occupancy empty, count zero, caps locked, and no pill actors. Five assumed pills and 10×7×5 mm oval size may appear only after a successful matching fixture container placement and are demo contents, not actual container contents.
- Barcode mappings `5012345678900`→red, `5012345678917`→blue, `5012345678924`→green, and `5012345678931`→orange; `5012345678948` represents an unsupported color and `9999999999999` is unknown. Unsupported/unmapped codes have null targets. Mark all values illustrative fixture data.
- Schedule order RED, BLUE, GREEN, ORANGE, BLUE, RED; once/repeat. An empty target blocks a dispense/schedule request; repeat stops at first absent/empty scheduled target and never refills automatically.
- Speed min/max 0.3/3; scanner phase durations include package-in, beam/read, result, placement, and package-out; cap visual easing 0.25 s (`ASSUMED_UI_TIMING`); cartridge lift 75 mm at 60 mm/s (1.25 s, presentation only); mechanical concept rates/dwells per [scene-interface.md](scene-interface.md) and [research.md](../research.md).
- Source concept values: drum outer radius/cartridge radius 15 mm; post radius 2.5 mm/height 46 mm; nominal station footprint 44×74 mm; crank radius 5.2 mm, rod 34 mm, pivot y −54 mm and approximate z 15.2 mm; 10.4 mm carriage travel; pin travel 5 mm; 5×4 mm slot/3 mm pin; estimated ±1 mm alignment only; upper blade tip x ±5.2 mm; tongue 24 mm with edges ±5.7 mm; approximate 40×58 mm tray with unknown height; 0.3 mm mentioned gap flagged undesigned. Preserve all these as concept-source values/status, not toleranced physical data.

The explicitly listed constants may be represented in JSON as source dimensions and referenced by recipe records; derived shape dimensions require rule IDs. Do not create missing walls, mass, material, actuator model/rating, spring forces, interfaces, clearance fits, overall vertical envelope, tolerances, fasteners, electronics or wiring as if known. Record them in `missing_inputs`.

## Failure behavior and invariants

- Canonical JSON parse/schema/unique-ID/version/unit/finite-transform/provenance failure: fail closed; no output bundle/export with defaults.
- Generator output contains only local static data and deterministic serialization; reproducible for identical canonical inputs/tool version.
- Package JSON hash in generated JS equals canonical source digest; exporter manifest records the same exact hash.
- No generated art or 3MF is allowed to self-assign `VALIDATED`, `PRINT_READY`, or `FABRICABLE_AS_DESIGNED` based on structural tests.
- No random functions, unseeded data, external URLs, environment-dependent paths, local-file fetches or persisted simulator record fields are valid inputs.
- Browser generated data may be a faithful representation of JSON but is not itself a geometry authority; edits must be made in canonical JSON then regenerated.
