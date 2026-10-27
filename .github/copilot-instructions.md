<!-- SPECKIT START -->
Subsystems 3 and 4 (user request 2026-10-27) are concept-level features 009
(`verification-subsystem`: break-beam dispense check, ring EMPTY/PARTIAL/FULL,
same-pill storage check) and 010 (`touchscreen-schedule`: touchscreen + status
LED on the shell, dose schedule, barcode reader moved onto the shell, `scanner_dx`
-29). Read `specs/009-verification-subsystem/spec.md` / `plan.md` and
`specs/010-touchscreen-schedule/spec.md` / `plan.md` before work on them. Code:
`docs/visualizer/verification-controller.js`, `schedule-controller.js`,
`housing-modules.js`, `subsystem-ui.js`; tests `tests/test_feature009_*.py`,
`tests/test_feature010_*.py`. Both are ASSUMED / NOT_VALIDATED, read the locked demo
controller only, and the wiring window is not changed (pin plans are in plan.md).
The active feature pointer is `.specify/feature.json` (now 010); Feature 005's
rotation notes below still apply to the mechanism.
The active Spec Kit feature is 005, `first-subsystem-rotation-pin-gates`.
Feature 006 (`compartment-weight-verification`) is parked: its spec and plan
exist (read `specs/006-compartment-weight-verification/spec.md` and
`plan.md` before weight-verification work) but nothing is implemented; keep the
first subsystem ready for it (reserved pad corridor and slots, no electronics
on the drum, rotating mass at or below 150 g).
Feature 005 is the first-subsystem
rotation design: read `specs/005-first-subsystem-rotation-pin-gates/spec.md` and
`specs/005-first-subsystem-rotation-pin-gates/plan.md` before first-subsystem
work; its plan is a rotation-only, ASSUMED / NOT_VALIDATED mechanical design
(keep exactly 52 component IDs; Features 001-004 stay untouched). Task state:
`specs/005-first-subsystem-rotation-pin-gates/tasks.md`; evidence and the
NOT CONVERGED verdict: `.../implementation-evidence.md`; build documents:
`specs/005-first-subsystem-rotation-pin-gates/build/`; standalone logic:
`docs/visualizer/rotation-controller.js` (not wired into the viewer).
`docs/visualizer/demo-controller.js` is locked (sha1
0c8396023ca6fc85cb135fbbf58ea39e903cee11) and must not be edited. Feature 004 remains the dispense/container-identification feature:
read `specs/004-dispense-and-container-identification/spec.md` before work on
the product dispense/container-identification workflow and review
`specs/004-dispense-and-container-identification/plan.md` before extending its
local browser increment. The scoped
software-only local browser increment is implemented under
`docs/visualizer/feature004/`; it uses fictional local fixtures and remains
separate from Feature 003. Future changes may extend this bounded UI after
reviewing the Feature 004 plan/tasks. Real NDC data-source/currentness,
connectivity, sensor interpretation, refill/replacement, recovery, reader,
actuator, and hardware decisions remain unresolved; do not implement physical
integration or resolve those decisions by assumption.

Feature 003 remains the offline, deterministic main 3D concept simulation/export.
Its scanner demo is part of the main 3D scene and has its own show/hide control;
it starts/reset to exactly empty, zero-count RED/BLUE/GREEN/ORANGE compartments,
closed/locked caps, and no pill actors. Its only supported fictional fixtures
are 5012345678900→RED, 5012345678917→BLUE, 5012345678924→GREEN, and
5012345678931→ORANGE. A successful scan shows package-in/read/result,
matching-only container placement, package-out, then opens only that simulated
cap; placement leaves count zero. Pill actors appear only after explicit Fill
while the matching cap is open. Unsupported, unmapped, unknown, ambiguous,
invalid, and loaded/unavailable-target scans report a result without placement,
cap changes, or compartment mutation. It does not import or share state with
Feature 004's separate subsystem lab. For Feature 003 work, read
`specs/003-3d-mechanism-visualization/plan.md` and preserve its concept-only,
offline, non-readiness and feature-001/002 boundaries below.

Feature 003 was re-scoped 2026-10-10; read
specs/003-3d-mechanism-visualization/plan.md before feature-003 work. The rotating-drum
scan concept supersedes every slider-gate visualization/export artifact and
implementation path. Target: offline static Three.js r128 browser viewer at
docs/visualizer/ reproducing the 4-cartridge drum, pin/blade/tongue mechanism,
deterministic demo FSM, barcode/cap workflow and responsive orbit/zoom UI.
Use one versioned shared geometry JSON for the browser and Python 3MF export;
browser assets must load from file:// with no CDN/network/server. Vendor the
pinned Three.js browser build with its MIT notice; no npm or runtime Python viz
dependency. Retire the Python pyglet/CPU-projected 3D viewer, preserving the
core simulator, persisted records and feature-002 2D player.

3MF now covers the full parked portable concept with separately named physical
instances (station housing, central post, drum, four cartridges/caps/upper
blade-tab-springs, servo/crank/rod, carriage/rails/solenoid/pin, shared tongue
actuator/spring, scanner housing and tray). Right-handed mm, one Core assembly
build item, canonical-geometry provenance, staged/hash-validated package and
manifest, per-file atomic replacement and handled rollback; not crash-atomic
as a pair. Reject source/run-tree/symlink destinations even with --force.
Always disclose NOT VALIDATED / NOT PRINT-READY, print_ready=false and
fabricable_as_designed=false. FDM/PLA/0.4 mm nozzle is provisional guidance.

The UI demo is independent of core simulation records and makes no single-dose
or hardware claim. No demo randomness; explicit elapsed-time FSM, non-skipping
interlocks, one pill visual event, 20 s real-time cap unlock. Implementation
is in progress; the local browser viewer, canonical geometry, concept 3MF
exporter and 14-case browser controller harness now exist. Keep specs/003 tasks/evidence
current. Browser validation must use the workspace-local file in a foreground
real browser at desktop and phone-sized viewports. Unit tests alone do not
establish WebGL/FPS/driver compatibility; that performance and full viewport
evidence remains pending.
Actual unborn Git branch remains 001-dispensing-mechanism-simulation while the
active Spec Kit feature is 005. Constitution I completion is ERROR / BLOCKED
by recorded zero-/multi-dose violations; the viewer is not a waiver. No
feature-converged claim. Install non-editable (`pip install .`) after Python
source changes; pytest uses pythonpath=["src"] because macOS hidden flags break
editable imports.
<!-- SPECKIT END -->
