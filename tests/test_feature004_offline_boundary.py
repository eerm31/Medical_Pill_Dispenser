from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "docs" / "visualizer" / "feature004"
RUNTIME_SUFFIXES = {".html", ".css", ".js"}


def _runtime_files() -> list[Path]:
    return sorted(path for path in APP.rglob("*") if path.is_file() and path.suffix in RUNTIME_SUFFIXES)


def test_feature004_page_assets_are_local_and_present() -> None:
    files = _runtime_files()
    assert files, "Feature 004 browser prototype assets have not been created"
    assert (APP / "index.html").is_file()
    html = (APP / "index.html").read_text(encoding="utf-8")
    for target in re.findall(r"(?:src|href)=['\"]([^'\"]+)['\"]", html):
        assert not target.startswith(("http:", "https:", "//", "data:")), target
        assert "?" not in target and "#" not in target, target


def test_overall_design_labels_the_dispensing_mechanism_visibility_toggle() -> None:
    html = (APP / "index.html").read_text(encoding="utf-8")
    assert 'id="includeSubsystem1" type="checkbox" checked aria-label="Show Subsystem 1 dispensing mechanism"' in html
    assert "<strong>Dispensing mechanism</strong>" in html
    assert "<small>Show in overall design</small>" in html
    assert "<em>Show / hide</em>" in html


def test_feature004_stylesheets_do_not_use_css_imports() -> None:
    stylesheets = list(APP.rglob("*.css"))
    assert stylesheets, "Feature 004 stylesheet is missing"
    for stylesheet in stylesheets:
        source = stylesheet.read_text(encoding="utf-8")
        assert not re.search(r"@import\b", source, re.IGNORECASE), f"CSS imports are not used in this local prototype: {stylesheet}"


def test_feature004_scanner_view_has_labeled_demo_components() -> None:
    html = (APP / "index.html").read_text(encoding="utf-8")
    app = (APP / "app.js").read_text(encoding="utf-8")
    required_parts = (
        "sample-container", "container-barcode", "container-guide", "scanner-head",
        "scanner-optics", "scan-beam", "fixture-decoder", "compartment-target-bank",
    )
    for part in required_parts:
        assert f'data-scanner-part="{part}"' in html, f"scanner diagram component missing: {part}"
    for phase in ("reading", "resolving", "result", "placing", "loading", "unavailable", "ambiguous", "no-match", "invalid"):
        assert phase in app, f"scanner presentation phase missing: {phase}"


def test_feature004_color_mapping_loading_actions_and_placement_boundary() -> None:
    html = (APP / "index.html").read_text(encoding="utf-8")
    app = (APP / "app.js").read_text(encoding="utf-8")
    model = (APP / "model.js").read_text(encoding="utf-8")
    fixtures = (APP / "fixtures.js").read_text(encoding="utf-8")
    assert "compartmentSelect" not in html, "scanner must not offer manual target selection"
    assert 'id="finishLoadingBtn"' in html, "loading completion action is missing"
    assert 'id="placementPackage"' in html, "container placement visual is missing"
    assert 'data-compartment-id="red"' in html and 'data-compartment-id="blue"' in html
    assert 'data-compartment-id="green"' in html and 'data-compartment-id="orange"' in html
    assert "targetColor" in fixtures, "fixtures must map unique cases to compartment colors"
    assert "unsupported-color" in fixtures and "unsupported-color" in model
    assert "unsupported-color" in app
    assert 'id="tab-subsystem2"' in html and 'aria-selected="true"' in html.split('id="tab-subsystem2"', 1)[1].split("</button>", 1)[0]
    assert 'id="view-subsystem2"' in html and 'id="view-subsystem2" class="view"' in html
    for color in ("RED", "BLUE", "GREEN", "ORANGE"):
        assert color in html, f"supported compartment color missing: {color}"
    assert "completePlacement" in app and "completePlacement" in model
    assert "finishLoading" in app and "finishLoading" in model
    assert "Demo Refill" in app and "Demo Replace" in app
    assert "phase === 'placing' && state.scannerDemo.targetColor === color" in app
    assert "compartment.occupancy !== 'empty'" in app
    assert "state.scannerDemo.phase !== 'result'" in app, "failed results must not start a placement animation"


def test_feature004_runtime_has_no_network_storage_or_hardware_access() -> None:
    files = _runtime_files()
    assert files, "Feature 004 browser prototype assets have not been created"
    source = "\n".join(path.read_text(encoding="utf-8") for path in files)
    prohibited = {
        "remote URL": r"(?:https?://|//[A-Za-z0-9.-]+\.[A-Za-z]{2,})",
        "fetch": r"\bfetch\s*\(",
        "XMLHttpRequest": r"\bXMLHttpRequest\b",
        "WebSocket": r"\bWebSocket\b",
        "browser storage": r"\b(?:localStorage|sessionStorage|indexedDB|document\.cookie)\b",
        "service worker": r"\bserviceWorker\b",
        "hardware serial APIs": r"\b(?:serial|usb|hid)\.requestDevice\s*\(",
    }
    for label, pattern in prohibited.items():
        assert not re.search(pattern, source, re.IGNORECASE), f"prohibited runtime access: {label}"


def test_feature004_runtime_does_not_import_feature003_or_threejs() -> None:
    files = _runtime_files()
    assert files, "Feature 004 browser prototype assets have not been created"
    source = "\n".join(path.read_text(encoding="utf-8") for path in files)
    for forbidden in ("concept-data.js", "demo-controller.js", "three-r128.min.js", "DISPENSER_CONCEPT_DATA", "DispenserDemoController"):
        assert forbidden not in source, f"Feature 003 runtime coupling found: {forbidden}"
