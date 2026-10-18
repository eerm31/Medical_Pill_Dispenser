from pathlib import Path
import json
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
VIEWER = ROOT / "docs" / "visualizer"


def test_main_simulation_has_default_visible_scanner_subsystem_toggle():
    html = (VIEWER / "index.html").read_text(encoding="utf-8")
    app = (VIEWER / "app.js").read_text(encoding="utf-8")
    assert 'id="scannerSubsystemToggle"' in html
    assert "Subsystem 2: Barcode scanner" in html
    assert '<input id="scannerSubsystemToggle" type="checkbox" checked>' in html
    assert "scannerToggle.addEventListener('change'" in app
    assert "setScannerSubsystemVisibility(scannerToggle.checked)" in app


def test_main_simulation_scanner_actors_are_separate_from_feature004_runtime():
    app = (VIEWER / "app.js").read_text(encoding="utf-8")
    html = (VIEWER / "index.html").read_text(encoding="utf-8")
    for label in (
        "scanner optical bezel",
        "scanner optical read point",
        "demo container positioning guide",
        "local fixture decoder module",
        "fictional demo container with barcode",
        "scanner read beam",
    ):
        assert label in app, f"main simulation scanner visual missing: {label}"
    assert "feature004" not in html.lower()
    assert "feature004" not in app.lower()
    assert "scannerVisualObjects" in app


def test_main_simulation_scanner_scan_stages_finish_before_lid_open():
    controller = (VIEWER / "demo-controller.js").read_text(encoding="utf-8")
    tests = (ROOT / "tests" / "browser" / "browser-tests.js").read_text(encoding="utf-8")
    for phase in ("PACKAGE_IN", "BEAM", "SCAN_RESULT", "PACKAGE_PLACE", "PACKAGE_OUT", "CAP_OPEN"):
        assert phase in controller
    assert "Matching" in controller and "package-out" in controller
    assert "scanPlacementReady" in controller
    assert "s.phase==='PACKAGE_OUT'" in controller
    assert "cap.capOpen=true;cap.cap='open'" in controller
    assert "successful scanner flow auto-opens only its matched cap after package-out" in tests


def test_main_simulation_shows_four_supported_fixtures_and_one_invalid_container():
    app = (VIEWER / "app.js").read_text(encoding="utf-8")
    html = (VIEWER / "index.html").read_text(encoding="utf-8")
    assert "invalidCode=examples.invalid" in app
    assert "if(color)addScanButton(code,color)" in app
    assert "addScanButton(invalidCode,null)" in app
    assert "Object.keys(examples).forEach" not in app
    assert "INVALID CONTAINER" in app
    assert "single invalid-container example" in html


def test_invalid_container_is_purple_in_scene_and_fixture_control():
    app = (VIEWER / "app.js").read_text(encoding="utf-8")
    styles = (VIEWER / "styles.css").read_text(encoding="utf-8")
    assert "color==='purple'?0x9b59ff" in app
    assert "s.scanCode===invalidExample?'purple':fixtureColor" in app
    assert ".barcode-button.invalid-container-fixture" in styles


def test_placed_containers_hide_when_cap_is_closed_and_scan_package_uses_fixture_color():
    app = (VIEWER / "app.js").read_text(encoding="utf-8")
    assert "&&c.occupancy==='loaded'&&c.capOpen" in app
    assert "fixtureColor=DATA.demo.barcodes[s.scanCode]||'red'" in app
    assert "window.dispenserSceneQA.containerVisible" in app


def test_successful_package_out_does_not_animate_the_container_back_to_scanner():
    app = (VIEWER / "app.js").read_text(encoding="utf-8")
    assert "s.scanAction==='place'&&s.scanMatchedColor)targets.package.position.copy(containerTargetPosition(s.scanMatchedColor))" in app
    assert "lerpVectors(exitStart,packagePark,s.phaseProgress)" not in app


def test_matching_zero_count_rescan_reuses_existing_container_without_replacement():
    controller = (VIEWER / "demo-controller.js").read_text(encoding="utf-8")
    app = (VIEWER / "app.js").read_text(encoding="utf-8")
    quickstart = (ROOT / "specs" / "003-3d-mechanism-visualization" / "quickstart.md").read_text(encoding="utf-8")
    assert "target.containerCode===s.scanCode" in controller
    assert "s.scanAction='reuse'" in controller
    assert "s.scanAction!=='place'" in controller
    assert "targets.package.position.lerpVectors(packageAtReader,packagePark,s.phaseProgress)" in app
    assert "skips PACKAGE_PLACE" in quickstart


def test_main_simulation_exposes_query_gated_scanner_scene_diagnostics():
    app = (VIEWER / "app.js").read_text(encoding="utf-8")
    assert "window.dispenserSceneQA.scannerSubsystem" in app
    assert "packagePosition:targets.package.position.toArray()" in app
    assert "beamEnd:new THREE.Vector3().fromBufferAttribute(beamPositions,1).toArray()" in app


def test_main_simulation_uses_exact_supported_empty_scanner_palette():
    source_path = ROOT / "src" / "dispenser_sim" / "viz3d" / "concept_geometry.json"
    source = json.loads(source_path.read_text(encoding="utf-8"))
    bundle_path = VIEWER / "concept-data.js"
    bundle = bundle_path.read_text(encoding="utf-8")
    controller = (VIEWER / "demo-controller.js").read_text(encoding="utf-8")
    html = (VIEWER / "index.html").read_text(encoding="utf-8")
    assert [item["id"] for item in source["palette"]] == ["red", "blue", "green", "orange"]
    assert {code: color for code, color in source["demo"]["barcodes"].items() if color} == {
        "5012345678900": "red",
        "5012345678917": "blue",
        "5012345678924": "green",
        "5012345678931": "orange",
    }
    assert source["demo"]["initial_pills_per_cartridge"] == 0
    assert source["demo"]["loaded_pills_per_container"] == 5
    examples = source["demo"].get("scan_examples")
    assert examples is not None, "scanner refusal examples are missing from canonical demo metadata"
    assert set(examples) == {"unsupported_color", "unmapped", "unknown", "ambiguous", "invalid"}
    assert examples["unsupported_color"] in source["demo"]["barcodes"]
    assert examples["unknown"] in source["demo"]["barcodes"]
    assert examples["unmapped"] not in source["demo"]["barcodes"]
    assert len(set(examples.values())) == len(examples)
    assert source["demo"]["barcodes"][examples["unsupported_color"]] is None
    assert source["demo"]["barcodes"][examples["unknown"]] is None
    assert source["export"]["physical_component_count"] == 52
    assert source["export"]["print_ready"] is False
    assert source["export"]["fabricable_as_designed"] is False
    with tempfile.TemporaryDirectory() as directory:
        regenerated = Path(directory) / "concept-data.js"
        subprocess.run(
            [sys.executable, str(ROOT / "tools" / "build_visualizer_data.py"), "--output", str(regenerated)],
            cwd=ROOT,
            check=True,
        )
        assert regenerated.read_text(encoding="utf-8") == bundle
    assert '"id":"green"' in bundle and '"id":"orange"' in bundle
    assert '"initial_pills_per_cartridge":0' in bundle
    runtime = "\n".join(path.read_text(encoding="utf-8") for path in VIEWER.glob("*.js"))
    runtime += "\n" + html
    assert "feature004" not in runtime.lower()
    assert "Feature004" not in runtime
    assert "FEATURE004" not in runtime
    assert "PACKAGE_PLACE" in controller
    assert "scanPlacementReady" in controller
    assert "unsupported" in controller.lower() or "unknown" in controller.lower()
    assert "all four supported compartments are empty" in html.lower()
