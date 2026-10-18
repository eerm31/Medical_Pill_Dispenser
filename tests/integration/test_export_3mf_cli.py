import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]


def _cli(*args):
    return subprocess.run(
        [sys.executable, "-m", "dispenser_sim", *args],
        cwd=ROOT,
        env={**__import__("os").environ, "PYTHONPATH": str(ROOT / "src")},
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )


def test_export_3mf_cli_writes_full_run_independent_concept(tmp_path):
    target = tmp_path / "rotating-dispenser.3mf"
    result = _cli("export-3mf", "--output", str(target))
    assert result.returncode == 0, result.stderr
    assert "components: 52" in result.stdout
    assert "NOT VALIDATED / NOT PRINT-READY" in result.stdout
    assert "print_ready=false" in result.stdout
    assert "fabricable_as_designed=false" in result.stdout
    manifest = json.loads(Path(str(target) + ".manifest.json").read_text())
    assert len(manifest["components"]) == 52
    assert manifest["validation_status"] == "NOT_VALIDATED"
    assert "package_sha256" in manifest["artifact_integrity"]
    assert "manifest_sha256" in manifest["artifact_integrity"]


def test_export_cli_requires_path_and_rejects_project_tree():
    missing = _cli("export-3mf")
    assert missing.returncode == 2
    assert "--output" in missing.stderr
    protected = _cli("export-3mf", "--output", str(ROOT / "forbidden.3mf"))
    assert protected.returncode == 1
    assert "outside the project" in protected.stderr


def test_2d_animate_cli_remains_and_no_3d_option():
    help_result = _cli("animate", "--help")
    assert help_result.returncode == 0
    assert "--3d" not in help_result.stdout
    assert "--check" in help_result.stdout


def test_fr034_export_cli_reports_exact_52_part_schedule_and_false_readiness(tmp_path):
    target = tmp_path / "fr034-portable-concept.3mf"
    result = _cli("export-3mf", "--output", str(target))
    assert result.returncode == 0, result.stderr
    assert "components: 52" in result.stdout
    assert "NOT VALIDATED / NOT PRINT-READY" in result.stdout
    assert "print_ready=false" in result.stdout
    assert "fabricable_as_designed=false" in result.stdout
    manifest = json.loads(Path(str(target) + ".manifest.json").read_text())
    assert len(manifest["components"]) == 52
    assert [item["name"] for item in manifest["components"][-20:]] == [
        "Red Cap Label Plate", "Blue Cap Label Plate", "Green Cap Label Plate", "Orange Cap Label Plate",
        "Red Passive Tag Carrier", "Blue Passive Tag Carrier", "Green Passive Tag Carrier", "Orange Passive Tag Carrier",
        "Red Cap Hinge Assembly", "Blue Cap Hinge Assembly", "Green Cap Hinge Assembly", "Orange Cap Hinge Assembly",
        "Red Cap Latch Body", "Blue Cap Latch Body", "Green Cap Latch Body", "Orange Cap Latch Body",
        "Electronics Deck", "Controller Board Placeholder", "Scanner Head Placeholder", "Scanner Mount",
    ]
    assert manifest["validation_status"] == "NOT_VALIDATED"
    assert manifest["print_ready"] is False and manifest["fabricable_as_designed"] is False
    assert len(manifest["artifact_integrity"]["package_sha256"]) == 64
    assert len(manifest["artifact_integrity"]["manifest_sha256"]) == 64
    assert all(item["placement_provenance"] == "ASSUMED" for item in manifest["components"])
    assert all(item["verification_status"] == "NOT_VALIDATED" for item in manifest["components"])
    assert all(item["coordinate_frame"] == "canonical_right_handed_mm" for item in manifest["components"])
    assert all("parent_component_id" in item and "motion_group" in item for item in manifest["components"])
    assert all("assumptions" in item and "unresolved_schedule" in item for item in manifest["components"])
    schedule = manifest["design_basis"]["assembly_schedule"]
    assert schedule["revision"] == "fr034-ak-corrected-52-v2"
    assert all(item["unresolved_schedule"]["revision"] == schedule["revision"] for item in manifest["components"])
    assert all(item["unresolved_schedule"]["conflict_ids"] == [conflict["conflict_id"] for conflict in schedule["conflicts"]] for item in manifest["components"])
