# Smart Medical Dispenser — Dispensing Mechanism Simulation

Offline, stdlib-only Python simulation of the smart medical dispenser's dispensing
mechanism. Seeded actuation cycles classify each dispense as zero / exactly-one /
multiple pills, attribute failures to named failure modes, and report
single-dispense success rates against the 99.5% pass threshold.

## Install

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install . pytest
```

The Python core and 3MF writer are standard-library-only. The browser viewer
uses a locally vendored Three.js r128 build; it needs no server or network.

## Quickstart

```bash
# Validate a mechanism config against the portability envelope
dispenser-sim validate --mechanism configs/mechanisms/slider_gate_v1.json \
  --pills configs/pills/standard_mix.json

# Run a seeded simulation (writes run.json, cycles.csv, report.md)
dispenser-sim run --mechanism configs/mechanisms/slider_gate_v1.json \
  --pills configs/pills/standard_mix.json --cycles 10000 --seed 42 --out runs/

# Regenerate the report from a run record
dispenser-sim report --run runs/<run_id>/run.json

# Compare two mechanisms under identical seeds
dispenser-sim compare --mechanism configs/mechanisms/slider_gate_v1.json \
  --mechanism configs/mechanisms/rotary_disk_v1.json \
  --pills configs/pills/standard_mix.json --cycles 10000 --seed 42

# Replay a recorded run as a mechanism animation (Tk window)
dispenser-sim animate --run runs/<run_id> [--speed 4] [--start-cycle 0]

# Headless fidelity check (CI-friendly, no display needed)
dispenser-sim animate --run runs/<run_id> --check

# Export the scan-derived rotating-dispenser concept outside this project
dispenser-sim export-3mf --output "$HOME/Downloads/rotating-dispenser.3mf"
```

## Animation player

`animate` replays any recorded run cycle by cycle as a schematic 2D animation
(Tkinter Canvas; stdlib). Outcomes and failure modes come from the run record
verbatim — replay never re-simulates. JAM (including multi-cycle persistence
spans), STACKING, multi-dose/DOUBLE_DROP (truthful ×k released count), and
MISSED_DISPENSE are visually distinct; NO_PILL_AVAILABLE is shown as a
non-failure empty-reservoir state.

Keyboard controls: `Space` play/pause · `→`/`←` single-step · `+`/`-`
faster/slower (0.25–120 cycles/s) · `g` jump to cycle · `n`/`p` next/previous
failure · `Home`/`End` first/last cycle · `q` or `Esc` quit.

If `run.json` is missing but `cycles.csv` exists, replay proceeds in
geometry-approximate mode (noted on stdout and in-window). On machines without
a display, use `--check` to validate frame fidelity headlessly.

**Tk prerequisite**: Tkinter ships with CPython on macOS/Windows; on
Debian/Ubuntu install the OS package `python3-tk` (an environment
prerequisite, not a Python dependency).

## Rotating-cartridge concept viewer

Open [docs/visualizer/index.html](docs/visualizer/index.html) directly in a
browser. The offline Three.js scene recreates the scanned four-cartridge drum,
individual caps/blades/springs, pin carriage, servo/crank/rod, shared tongue,
scanner, and tray. The main scene includes scanner housing/optics, container
guide, fictional barcode package, local fixture decoder presentation, and
scan beam, with a **Show barcode scanner subsystem** visibility checkbox.
The exact supported fixtures are RED `5012345678900`, BLUE `5012345678917`,
GREEN `5012345678924`, and ORANGE `5012345678931`. On startup and safe reset,
all four compartments are empty, count zero, caps closed/locked, and no pill
actors are visible. A successful unique scan animates package-in, read/result,
placement in only its same-color empty compartment, package-out, then opens
only that compartment's simulated cap. The placed container has zero assumed
pill inventory; use its explicit **Fill** control while the cap is open to add
up to five assumed demo pills. Unsupported, unmapped, unknown, ambiguous,
invalid, and loaded/unavailable-target scans report a result without placement,
cap changes, or compartment mutation. This in-memory Feature 003 workflow uses
no Feature 004 fixtures or state. The page also provides smooth deterministic
dispense motion, per-color compartment state, cartridge exchange, camera
orbit/zoom, the RED → BLUE → GREEN → ORANGE → BLUE → RED schedule, and live
mechanism status. The demo is independent of simulation run records and makes
no hardware, medication, or single-dose claim. Its parked chamber begins empty; the selected bottom pill
falls onto the closed shared tongue only after the upper separator opens. The
upper blade follows the user's selected local-Y travel despite the disclosed
source-axis conflict; after the blade closes and dwells, the tongue releases
the same visual pill vertically through the outlet, then it moves laterally to
its tray slot. These are deterministic concept visuals, not verified mechanics.

## Concept 3MF export

`dispenser-sim export-3mf --output PATH.3mf` creates the parked 32-instance
assembly plus a mandatory `.manifest.json` sibling. Keep both files together.
The geometry is a scan-derived concept with inferred/assumed dimensions and
missing interfaces/tolerances. FDM/PLA/0.4 mm nozzle is provisional guidance;
the package always says **NOT VALIDATED / NOT PRINT-READY**,
`print_ready=false`, and `fabricable_as_designed=false`. Do not fabricate from
it without authoritative drawings, tolerance review, and measured prototype
validation. Output must be outside this repository; `--force` cannot override
the source-tree or symlink protections.

## Design-review evidence workflow

Every run directory contains three citable artifacts: `run.json` (canonical
machine-readable record with embedded config + seed), `cycles.csv` (one row per
actuation), and `report.md` (human-readable summary with PASS/FAIL verdict).
Re-running with the same seed and configs reproduces identical per-cycle outcomes.

## Tests

```bash
pytest tests/unit tests/statistical tests/integration
```

The separate [Feature 004 subsystem lab](docs/visualizer/feature004/index.html)
provides individual Dispensing and Container Identification views plus an
Overall Design composition view. Subsystem 2 displays a labeled schematic of
the sample container/barcode, guide, scanner head/optics, scan beam, local
fixture decoder, and compartment bank; a deterministic animation shows the
fictional read → lookup → selected simulated lid sequence. It uses fictional
local fixtures only; it does not connect to hardware, the FDA NDC Directory,
or Feature 003's deterministic demo state.
