"""Offline/DOM/storage boundaries for the standalone rotation controller and its harness (Feature 005, T048)."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTROLLER = ROOT / "docs" / "visualizer" / "rotation-controller.js"
HARNESS = ROOT / "tests" / "browser" / "feature005"

NETWORK_AND_DYNAMIC = [
    r"https?:", r"//cdn", r"\bfetch\s*\(", r"XMLHttpRequest", r"WebSocket", r"EventSource", r"sendBeacon",
    r"\beval\s*\(", r"\bnew\s+Function\b", r"\bFunction\s*\(", r"\bimport\s*\(", r"\bimportScripts\b",
    r"\brequire\s*\(", r"<script", r"\.src\s*=",
]
NONDETERMINISM = [r"Math\.random", r"\bDate\b", r"performance\.now", r"\bsetTimeout\b", r"\bsetInterval\b", r"requestAnimationFrame"]
DOM_AND_STORAGE = [
    r"\bwindow\b", r"\bdocument\b", r"\bnavigator\b", r"\blocation\b", r"localStorage", r"sessionStorage", r"indexedDB",
    r"\bcookie", r"\binnerHTML\b", r"\bdocument\.",
]


def hits(patterns, text):
    return [p for p in patterns if re.search(p, text)]


def test_controller_has_no_network_dynamic_code_dom_storage_or_clock():
    text = CONTROLLER.read_text(encoding="utf-8")
    assert "feature004" not in text.lower()
    assert hits(NETWORK_AND_DYNAMIC, text) == []
    assert hits(NONDETERMINISM, text) == []
    assert hits(DOM_AND_STORAGE, text) == []


def test_controller_has_one_namespaced_export_and_no_other_global_assignment():
    text = CONTROLLER.read_text(encoding="utf-8")
    assert re.findall(r"\broot\.\w+\s*=", text) == ["root.DispenserRotationController ="]
    assert text.count("}(this));") == 1 and "'use strict'" in text
    assert re.search(r"(?<![\w.])(?:globalThis|global)\b", text) is None


def test_harness_files_are_offline_and_deterministic():
    files = sorted(HARNESS.glob("*.js")) + [HARNESS / "index.html"]
    assert len(files) >= 8
    for path in files:
        text = path.read_text(encoding="utf-8")
        assert path.exists()
        for pattern in (r"https?:", r"//cdn", r"\bfetch\s*\(", r"XMLHttpRequest", r"Math\.random", r"\bDate\b", r"\bimport\s*\(", r"\beval\s*\("):
            assert re.search(pattern, text) is None, f"{path.name} matches {pattern}"


def test_html_uses_relative_asset_paths_only():
    html = (HARNESS / "index.html").read_text(encoding="utf-8")
    sources = re.findall(r'(?:src|href)="([^"]*)"', html)
    assert sources
    for source in sources:
        if source:
            assert not re.match(r"^(?:[a-z][a-z0-9+.-]*:|/|//)", source, re.I), source
