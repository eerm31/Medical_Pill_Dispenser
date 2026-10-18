# Contract: Feature-003 CLI

**Feature**: 003-3d-mechanism-visualization | **Version**: 3.1 (implemented command contract, 2026-10-10)

This contract replaces the old `animate --3d` run-driven renderer and `export-3mf --run` slider-gate command. The new browser viewer is a static local-file app and is not launched from a simulation run. Feature-002's 2D `animate` and all feature-001/002 commands remain unchanged.

## Browser viewer

Open `docs/visualizer/index.html` directly in a current desktop/mobile browser. No CLI viewer command, Python `[viz]` extra, local server, npm or network is required. All scripts/styles/data are local relative files, so `file://` works. Viewer controls/status, WebGL failure behavior, deterministic demo states and no-hardware boundary are specified in [scene-interface.md](scene-interface.md). The browser viewer neither reads nor writes a run record.

## Retired interface

- `dispenser-sim animate --run PATH --3d` is retired; remove the obsolete Python pyglet viewer path and `--3d` parser option rather than opening an external browser or pretending the old run replay matches the new independent concept demo.
- `animate --3d --check` is retired with its slider/run scene check. Remove its feature-003-only tests and update feature-003 imports. Do not remove feature-002 `animate --run PATH` or its existing `--check` behavior, tkinter 2D UI, run loader, persisted event schema, or simulation verification.
- The old `export-3mf --run PATH` source selector is removed; the scan is an independent static concept and does not depend on run configs, run files or current mechanism config.

This is a deliberate feature-003 interface replacement, not an alias or behavior change to feature 001/002 commands.

## Concept 3MF export

```text
dispenser-sim export-3mf --output PATH.3mf [--force]
```

| Argument | Contract |
|---|---|
| `--output PATH.3mf` | Required destination for the complete fixed parked/rest rotating-cartridge assembly. Suffix `.3mf` (case-insensitive); parent must already exist and be writable. Source is the installed/repository canonical geometry JSON package resource. |
| `--force` | Permit replacing both existing package and sibling manifest only after complete staging and validation. It does not permit source/run-tree writes, symlinks, hardlink aliases, directories or unsafe destinations. |

Successful output is headless, deterministic, offline and stdlib-only. It reads canonical package data, never imports pyglet/browser/Three.js, never requires a run/config override, never mutates simulation artifacts and never changes mandatory readiness status. It creates:

- `PATH.3mf`: 3MF Core OPC archive in right-handed millimetres, one root assembly/build item, separately named physical component meshes and transforms.
- `PATH.3mf.manifest.json`: required source/provenance/unknowns/component inventory/QA/status/hashes record.

Every successful invocation still prints `NOT VALIDATED / NOT PRINT-READY`; success means only the bounded package/export checks passed. Exact package resources, IDs, digest definition, part inventory and transaction safety are defined in [3mf-export-contract.md](3mf-export-contract.md).

## Path and publication safety

- Reject destinations inside the source/package asset tree or any known run tree; reject a path that aliases source inputs or run artifacts.
- Reject output, manifest, and any symlinked parent/destination even with `--force`; do not follow symlinks. Reject hardlink aliases to protected source/run files where detectable.
- Require an existing writable parent. Do not silently create a path outside the explicit user destination.
- Stage package+manifest on the destination filesystem, validate both and hashes, then replace each sibling atomically. For handled errors roll back pre-existing outputs; if rollback fails, report exact recovery location/error and do not claim success.
- Sibling publication is not crash-atomic; a process/power failure between replacements may leave a mismatched pair. Hash/missing-file validation must identify that as `INCOMPLETE_PAIR` before use.

## Errors, stdout and exit codes

- Exit 0: export completed, with explicit concept/non-readiness status in output.
- Exit 1: source package invalid/missing, geometry/manifest QA failure, unsafe destination, permission/replace failure, or validation failure; concise actionable stderr and no handled-error partial replacement.
- Exit 2: argparse usage errors (missing/invalid arguments).
- Do not claim browser render, fps, slicer compatibility, mechanical simulation, single-dose success, or manufacturing validation from CLI exit 0.

## Offline/dependency guarantees

No standard-library core command requires Three.js, a browser, a network service, pyglet, npm or a CAD/3MF package. The browser app uses a vendored local Three.js file only; Python export consumes canonical JSON and remains usable without a display. Preserve the existing core dependency-free install/test path and feature-002 2D player.
