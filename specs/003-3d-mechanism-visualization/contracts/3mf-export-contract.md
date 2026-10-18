# Contract: Portable Rotating-Cartridge Concept 3MF Export

**Feature**: 003-3d-mechanism-visualization | **Version**: 2.1 (implemented contract, 2026-10-10; slicer interoperability pending)

**Implementation status**: `export-3mf` emits the 32-instance canonical assembly plus manifest. Structural/hash/source-mapping checks and handled failure/rollback tests pass. External slicer interoperability and all manufacturing validation remain untested/blocked.

This replaces the old slider-gate five-part export. It describes a scan-derived, fixed parked/rest concept for visual inspection and further design iteration only. It is not a full authoritative CAD definition or fabrication-ready file. See [geometry-source-contract.md](geometry-source-contract.md) for the canonical recipe/provenance source, [data-model.md](../data-model.md) for entities, and [cli-contract.md](cli-contract.md) for arguments.

## Command and source

```text
dispenser-sim export-3mf --output PATH.3mf [--force]
```

The exporter reads the installed canonical `concept_geometry.json` package resource and fixed generator revision. No `--run`, run/config lookup, runtime network, display, browser, pyglet, Three.js, npm, CAD kernel or third-party 3MF library. Export never changes source geometry, simulation configuration, records or viewer files. `.3mf` output and sibling `.3mf.manifest.json` are mandatory as a pair. Existing outputs require `--force`; parent exists/writable. Destination-safety semantics are fail-closed per the CLI contract.

## Fixed output assembly and names

3MF Core 1.4.0 OPC ZIP, `unit="millimeter"`, right-handed XYZ frame (+X right, +Y back, +Z up), deterministic parked/rest pose. Expected physical component mesh resources, in stable order (32 instances):

1. `Station Housing`
2. `Central Post`
3. `Rotating Drum`
4–7. `Red Cartridge`, `Blue Cartridge`, `Green Cartridge`, `Orange Cartridge`
8–11. `Red Cap`, `Blue Cap`, `Green Cap`, `Orange Cap`
12–15. `Red Upper Blade Tab`, `Blue Upper Blade Tab`, `Green Upper Blade Tab`, `Orange Upper Blade Tab`
16–19. `Red Upper Blade Return Spring`, `Blue Upper Blade Return Spring`, `Green Upper Blade Return Spring`, `Orange Upper Blade Return Spring`
20. `Servo Unit` (modeled casing/output shaft as one concept part)
21. `Servo Crank`
22. `Connecting Rod`
23. `Pin Carriage`
24. `Carriage Rail Left`
25. `Carriage Rail Right`
26. `Pull Solenoid`
27. `Engagement Pin`
28. `Shared Lower Tongue`
29. `Tongue Actuator Rod`
30. `Tongue Return Spring`
31. `Barcode Scanner Housing`
32. `Outlet Tray`

The 32 unique physical instances use distinct stable object IDs/names. Identical recipe-derived cartridges/caps/blades/springs are still distinct selectable components with their own placement transforms and per-instance provenance. One additional non-physical `Portable Dispenser Assembly` components object references the 32 mesh objects, and exactly one build item references that root. Thus 33 model object resources represent 32 physical parts plus one assembly container. Preserve the hierarchy and relative transforms; do not create 32 independently buildable items or flatten away identities. Instance names, ordering and count are versioned schema, not a guaranteed slicer selection UI.

The viewer-only assumed pills, package/card and barcode texture, scan beam, labels, camera, tray pill count, cutaways and any active-motion actor are not included. The manifest explicitly names exclusions and why. The scanner housing is included as a fixed concept component. Core materials/colors are not required for assembly identity; no 3MF material extension is part of this contract, so consumers are not promised preservation of the viewer palette. Names carry color identity where applicable.

## Geometry, transforms and dimensional source

- Use the shared canonical JSON recipes and source transform; Python exporter and browser cannot keep independent dimension tables. `source.geometry_json_sha256` is the exact canonical JSON digest. Each component identifies recipe/revision and source dimension/rule records.
- Apply each component transform exactly once. Meshes are local millimetre coordinates; 3MF component transforms preserve fixed assembly placement. Use right-handed transforms and an explicitly tested browser-scan-to-canonical frame conversion. The build item has no extra transform unless an explicit documented assembly placement is introduced.
- Export the common parked/rest state: servo angle 180°, pin up, carriage outer/parked, upper blades closed, tongue at +5.7 mm closed. Never serialize camera pose, selected color, scan status, pill actors, tray history, current animation frame, swept mesh or UI visibility.
- Include the complete portable concept's named mechanism components; do not retain `Hopper`, `Gate`, `Guide`, slider `Housing`/`Outlet` identities from the superseded export.
- Store source values exactly with provenance: 15 mm drum radius and cartridge radial position; 2.5×46 mm post; nominal 44×74 mm housing footprint; 5.2 mm crank radius, 34 mm rod, pivot y −54 mm and approximate z 15.2 mm; 10.4 mm carriage travel; 5 mm pin stroke; 5×4 mm slot/3 mm pin; estimated ±1 mm alignment; 24 mm tongue and ±5.7 mm edge positions/11.4 mm travel; approximate 40×58 mm tray with unknown height; 0.3 mm mentioned gap as undesigned; assumed 10×7×5 mm pills and five per compartment. These are scan/concept inputs, not checked physical dimensions. The viewer's encoded part meshes sometimes span more than the prose approximations; record discrepancy and do not silently choose an authoritative envelope.
- No overall-device envelope, height, mass, or missing internal interface is inferred from partial mesh bounds. Every modeled ratio/primitive/profile not explicit in source is linked to a named, versioned derivation/assumption rule. Every missing tolerance/interface/wall/spring/actuator/material detail is null and listed by component.
- Bounding-box/mesh/serialization checks are explicitly numeric package QA only. If `numerical_tolerance_mm=0.01` is used, label it separately from physical design tolerances. The source's ±1 mm estimate and 0.3 mm gap are not tolerances.

## Required warning and manifest

The 3MF model `Title` and `Description` must contain a preserved warning such as `CONCEPT MODEL — NOT VALIDATED / NOT PRINT-READY`, identify the full portable scan-concept scope, and name the sibling manifest. The description states `print_ready=false` and `fabricable_as_designed=false`. A consumer may strip metadata; never promise that third-party applications display or retain it after editing.

Mandatory sibling manifest is UTF-8 canonical JSON and includes:

- `schema_version`, `generator_revision`, source/concept ID and `source.geometry_json_sha256`, coordinate convention, units, reference pose and component inventory/order.
- For all 32 physical instances: stable ID/name, local recipe/revision, exact placement transform, bounds, source/provenance/value references, explicit assumptions, derived-rule IDs, unknown dimensions/interfaces/tolerances and validation status.
- Versioned derivation rules, source scan discrepancy/caveat records, included/excluded content list, package/mesh QA outcomes with `NOT_CHECKED` distinct from pass/fail, and any numerical QA threshold expressly not a physical tolerance.
- Process guidance exactly `FDM`, `PLA`, `0.4 mm nozzle`, if stated at all, with status `PROVISIONAL_GUIDANCE_ONLY`; never select geometry/supports or claim compatibility from it.
- Manufacturing evidence checklist blocked for absent approved drawings/CAD, interfaces/clearances/tolerance stack, materials, actuator/spring data, process choice, prototype/fit evidence and authorized review.
- `validation_status: "NOT_VALIDATED"`, `print_ready: false`, `fabricable_as_designed: false` at package-level and component-level where represented.
- `artifact_integrity.package_sha256`: SHA-256 over exact final `.3mf` bytes.
- `artifact_integrity.manifest_sha256`: SHA-256 of canonical UTF-8 JSON after omitting only `artifact_integrity.manifest_sha256`. This self-excluding definition avoids a recursive digest; canonicalization is sorted keys, compact separators, UTF-8, and no NaN.

A 3MF mesh that passes bounded structural checks remains a concept. No output field or CLI message infers single-dose integrity, mechanical safety, medication identity, material, tolerances, printer compatibility or fabrication readiness.

## Core package layout and emitted subset

ZIP entries (fixed order): `[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model`. Use Core namespace `http://schemas.microsoft.com/3dmanufacturing/core/2015/02`, OPC relationship/content-type namespaces, the standard 3D Model StartPart relationship and required content types. Model XML holds preserved `Title`/`Description`, resources, then build. Resources contain the 32 separately named mesh objects followed by the one named components root; the root's 32 component references match inventory order and transforms; build has one item referencing only the root. Unique IDs, valid resource references, no cycles, finite transformed vertices, explicit units and stable decimal formatting are required.

Use 3MF Core component transforms to retain placement rather than baking all parts into one object or independent build items. XML/ZIP/mesh checks validate only the documented emitted subset and are not a complete formal XSD or all-consumer certification. If component hierarchies are nested, they must remain acyclic and the one build item still references the assembly root.

## Validation layers

1. **Input/schema**: supported schema/generator version, correct stable component list/unique IDs, finite parameters/transforms, complete provenance, missing values null, canonical JSON hash match, fixed rest pose.
2. **Geometry/package**: finite vertices/valid triangle references, nondegenerate triangles and any implemented edge/winding criteria; exact instance names/order/count; Core OPC entries/relationships/content types/XML order; millimetre units; right-handed transform roundtrips; 33 object resources, 32 component refs, one build item; manifest fields and both hashes. Report checks not implemented as `NOT_CHECKED`, not passed.
3. **Dimension mapping**: configured/scan concept values map to expected model feature/bounds within a named numerical tolerance. Discrepancies between textual approximate tray dimensions and literal rendered mesh bounds remain disclosed. Passing map verifies adapter fidelity to the source recipe only.
4. **Slicer/browser interoperability**: optional smoke check in an available 3MF viewer records product/version and instance visibility/relative placement. It says nothing about physical fit or printing.
5. **Manufacturing validation**: currently blocked. Would require authoritative complete drawings and interfaces, reconciled derived inputs, design review, process-specific dimensions/tolerance stack, named material/printer settings, prototype dimensional/fit results, and authorized sign-off. This feature cannot set the gate to passed.

## Safe staged publication

1. Resolve output/manifest paths without following symlinks; reject source/run-tree descendants and known input aliases (including hardlink collisions where detectable), even with `--force`.
2. Generate package and manifest in a private temporary directory on the destination filesystem. Compute package bytes/hash, assemble manifest and self-excluding digest, write both temporary siblings.
3. Reopen the ZIP, parse emitted XML, verify assembly/mesh/source contract and both hashes before replacing destinations.
4. Retain backups for existing siblings. Replace each file atomically; on handled failure restore both prior siblings or explicitly report rollback failure and retain recovery artifacts. Clean temporary files on success/handled rollback.
5. Reopen final pair and verify. A process/OS interruption between sibling replacements is not preventable with two independent filesystem paths; missing/mismatched hashes are `INCOMPLETE_PAIR`, never success.

No overwrite/no-clobber violation may occur before full validation. Fault-injection tests cover staging, validation, each backup/replace and rollback. Symlinked parent/destination is rejected with and without force.

## Failure behavior

- Invalid canonical source/version, missing required recipe, nonfinite or inconsistent transform, geometry/export validation failure, unsafe/protected path, output collision without force, missing/unwritable parent or handled I/O failure: exit 1 with concise diagnostic, do not report successful publication, and preserve or restore prior pair where possible.
- CLI syntax/argument errors: exit 2.
- Valid concept package: exit 0 with all mandatory non-readiness warnings; not a manufacturing pass.
- Package-only, manifest-only, or mismatched pair: fail validation as `INCOMPLETE_PAIR`; do not infer safe/validated geometry.
