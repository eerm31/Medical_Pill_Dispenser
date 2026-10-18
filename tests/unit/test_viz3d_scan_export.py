import hashlib
import json
import zipfile
from pathlib import Path

import pytest

from dispenser_sim.viz3d.concept_export import (
    build_manifest,
    build_package,
    export_concept,
    validate_package,
)
from dispenser_sim.viz3d.scene import build_concept_assembly

EXPECTED_52_NAMES = [
    "Station Housing", "Central Post", "Rotating Drum",
    "Red Cartridge", "Blue Cartridge", "Green Cartridge", "Orange Cartridge",
    "Red Cap", "Blue Cap", "Green Cap", "Orange Cap",
    "Red Upper Blade Tab", "Blue Upper Blade Tab", "Green Upper Blade Tab", "Orange Upper Blade Tab",
    "Red Upper Blade Return Spring", "Blue Upper Blade Return Spring", "Green Upper Blade Return Spring", "Orange Upper Blade Return Spring",
    "Servo Unit", "Servo Crank", "Connecting Rod", "Pin Carriage", "Carriage Rail Left", "Carriage Rail Right",
    "Pull Solenoid", "Engagement Pin", "Shared Lower Tongue", "Tongue Actuator Rod", "Tongue Return Spring",
    "Barcode Scanner Housing", "Outlet Tray",
    "Red Cap Label Plate", "Blue Cap Label Plate", "Green Cap Label Plate", "Orange Cap Label Plate",
    "Red Passive Tag Carrier", "Blue Passive Tag Carrier", "Green Passive Tag Carrier", "Orange Passive Tag Carrier",
    "Red Cap Hinge Assembly", "Blue Cap Hinge Assembly", "Green Cap Hinge Assembly", "Orange Cap Hinge Assembly",
    "Red Cap Latch Body", "Blue Cap Latch Body", "Green Cap Latch Body", "Orange Cap Latch Body",
    "Electronics Deck", "Controller Board Placeholder", "Scanner Head Placeholder", "Scanner Mount",
]


def test_concept_package_contains_52_parts_and_honest_manifest():
    assembly = build_concept_assembly()
    package = build_package(assembly)
    manifest = build_manifest(assembly, package)
    validate_package(package, manifest)
    basis = manifest["design_basis"]
    assert manifest["generator_revision"] == assembly.generator_revision
    assert manifest["source"]["geometry_json_sha256"] == assembly.source_geometry_sha256
    assert basis["station"]["channel"]["size_mm"] == [10.8, 8.4]
    assert basis["station"]["pill"]["size_mm"] == [10, 7, 5]
    assert basis["station"]["blade"]["stroke_axis"] == "component_local_y"
    assert basis["station"]["tongue"]["stroke_axis"] == "canonical_y"
    assert "perpendicular-gate sentence" in basis["frames"]["note"]
    assert "USER_SPECIFIED" in basis["provenance_sources"]
    assert all(value is None for value in basis["unknowns"].values())
    assert any(rule["rule_id"] == "two-gate-station-1" for rule in basis["derived_rules"])
    assert manifest["validation_status"] == "NOT_VALIDATED"
    assert manifest["print_ready"] is False
    assert manifest["fabricable_as_designed"] is False
    assert "FDM" == manifest["process_guidance"]["process"]
    assert len(manifest["components"]) == 52
    assert len(manifest["artifact_integrity"]["package_sha256"]) == 64
    assert len(manifest["artifact_integrity"]["manifest_sha256"]) == 64
    with zipfile.ZipFile(__import__("io").BytesIO(package)) as archive:
        root = __import__("xml.etree.ElementTree", fromlist=["ElementTree"]).fromstring(archive.read("3D/3dmodel.model"))
    objects = root.findall("{http://schemas.microsoft.com/3dmanufacturing/core/2015/02}resources/{http://schemas.microsoft.com/3dmanufacturing/core/2015/02}object")
    assert len(objects) == 53
    assert [item.get("id") for item in objects] == [str(index) for index in range(1, 54)]
    assert [item.get("id") for item in objects if item.find("{http://schemas.microsoft.com/3dmanufacturing/core/2015/02}mesh") is not None] == [str(index) for index in range(1, 53)]
    assert objects[-1].get("name") == "Portable Dispenser Assembly"
    assert objects[-1].get("id") == "53"
    assert len(root.findall("{http://schemas.microsoft.com/3dmanufacturing/core/2015/02}build/{http://schemas.microsoft.com/3dmanufacturing/core/2015/02}item")) == 1
    description = next(item.text for item in root.findall("{http://schemas.microsoft.com/3dmanufacturing/core/2015/02}metadata") if item.get("name") == "Description")
    assert "approximately 52" in description
    assert "32" not in description


def test_package_is_deterministic_and_manifest_corruption_fails():
    assembly = build_concept_assembly()
    a = build_package(assembly)
    b = build_package(assembly)
    assert a == b
    manifest = build_manifest(assembly, a)
    bad = dict(manifest)
    bad["scope"] = "fabrication ready"
    with pytest.raises(ValueError, match="manifest SHA-256"):
        validate_package(a, bad)


def test_export_publication_is_run_free_safe_and_atomic_per_file(tmp_path):
    destination = tmp_path / "portable-concept.3mf"
    result = export_concept(destination)
    sidecar = Path(str(destination) + ".manifest.json")
    assert destination.is_file() and sidecar.is_file()
    assert result["artifact_integrity"]["package_sha256"] == hashlib.sha256(destination.read_bytes()).hexdigest()
    with pytest.raises(ValueError, match="already exists"):
        export_concept(destination)
    export_concept(destination, force=True)
    assert json.loads(sidecar.read_text())["print_ready"] is False


def test_export_rejects_project_and_symlink_destinations(tmp_path):
    project = Path(__file__).resolve().parents[2]
    with pytest.raises(ValueError, match="outside the project"):
        export_concept(project / "forbidden.3mf")
    target = tmp_path / "linked.3mf"
    target.symlink_to(tmp_path / "real.3mf")
    with pytest.raises(ValueError, match="symlink"):
        export_concept(target)


def test_export_rejects_hardlink_to_source_even_with_force(tmp_path):
    target=tmp_path/"alias.3mf"
    target.hardlink_to(Path(__file__).resolve().parents[2]/"pyproject.toml")
    with pytest.raises(ValueError,match="hardlink"):
        export_concept(target,force=True)


def test_handled_manifest_replace_failure_removes_package(tmp_path):
    destination = tmp_path / "injected.3mf"
    def fail(point):
        if point == "replace_manifest":
            raise OSError("injected publication fault")
    with pytest.raises(OSError, match="injected"):
        export_concept(destination, fault=fail)
    assert not destination.exists()
    assert not Path(str(destination) + ".manifest.json").exists()


def test_handled_failure_restores_both_previous_siblings(tmp_path):
    destination=tmp_path/"previous.3mf"
    sidecar=Path(str(destination)+".manifest.json")
    destination.write_bytes(b"old-package")
    sidecar.write_bytes(b"old-manifest")
    def fail(point):
        if point=="replace_manifest":
            raise OSError("stop after package replacement")
    with pytest.raises(OSError,match="stop after package"):
        export_concept(destination,force=True,fault=fail)
    assert destination.read_bytes()==b"old-package"
    assert sidecar.read_bytes()==b"old-manifest"


def test_rollback_failure_retains_recovery_backup(tmp_path,monkeypatch):
    import dispenser_sim.viz3d.concept_export as exporter
    destination=tmp_path/"recover.3mf"
    destination.write_bytes(b"previous")
    original=exporter.os.replace
    def replace(source,target):
        if Path(source).name=="backup-0":
            raise OSError("injected rollback failure")
        return original(source,target)
    monkeypatch.setattr(exporter.os,"replace",replace)
    def fail(point):
        if point=="replace_manifest":
            raise OSError("injected publication failure")
    with pytest.raises(OSError,match="ROLLBACK FAILED") as exc:
        export_concept(destination,force=True,fault=fail)
    message=str(exc.value)
    recovery=Path(message.rsplit(" ",1)[-1])
    assert recovery.is_dir()
    assert (recovery/"backup-0").read_bytes()==b"previous"


def test_fr034_package_manifest_and_hierarchy_contain_exact_52_physical_instances():
    assembly = build_concept_assembly()
    package = build_package(assembly)
    manifest = build_manifest(assembly, package)
    validate_package(package, manifest)
    assert [part.name for part in assembly.parts] == EXPECTED_52_NAMES
    assert [item["component_id"] for item in manifest["components"]] == [item["component_id"] for item in assembly.source_geometry["components"]]
    assert [part.name for part in assembly.parts] == EXPECTED_52_NAMES
    assert [item["name"] for item in manifest["components"]] == EXPECTED_52_NAMES
    assert len(manifest["components"]) == 52
    assert all(item["component_id"] == part.component_id for item, part in zip(manifest["components"], assembly.parts))
    assert all(item["parent_component_id"] == part.parent_component_id for item, part in zip(manifest["components"], assembly.parts))
    assert all(item["motion_group"] == part.group_id for item, part in zip(manifest["components"], assembly.parts))
    assert all(item["placement_provenance"] == "ASSUMED" for item in manifest["components"])
    assert all(item["verification_status"] == "NOT_VALIDATED" for item in manifest["components"])
    assert all(item["coordinate_frame"] == "canonical_right_handed_mm" for item in manifest["components"])
    assert all("assumptions" in item and "unresolved_schedule" in item for item in manifest["components"])
    schedule = assembly.source_geometry["assembly_schedule"]
    conflict_ids = [item["conflict_id"] for item in schedule["conflicts"]]
    clearance_ids = [item["check_id"] for item in schedule["clearance_checks"]]
    assert all(item["unresolved_schedule"]["revision"] == schedule["revision"] for item in manifest["components"])
    assert all(item["unresolved_schedule"]["conflict_ids"] == conflict_ids for item in manifest["components"])
    assert all(item["unresolved_schedule"]["clearance_check_ids"] == clearance_ids for item in manifest["components"])
    placement_by_id = {item["component_id"]: item for item in schedule["component_placements"]}
    assert all(item["assumptions"]["placement"] == placement_by_id[item["component_id"]] for item in manifest["components"])
    assert manifest["design_basis"]["assembly_schedule"] == schedule
    assert manifest["design_basis"]["assembly_schedule"]["datum"]["station_s_mm"] == [0, 0, 0]
    assert manifest["design_basis"]["assembly_schedule"]["integrated_features"]
    assert manifest["design_basis"]["assembly_schedule"]["conflicts"]
    assert all(check["status"] != "PASS" for check in manifest["design_basis"]["assembly_schedule"]["clearance_checks"])
    assert manifest["validation_status"] == "NOT_VALIDATED"
    assert manifest["print_ready"] is False and manifest["fabricable_as_designed"] is False
    assert len(manifest["artifact_integrity"]["package_sha256"]) == 64
    assert len(manifest["artifact_integrity"]["manifest_sha256"]) == 64
    assert not any("Credit Card" in item["name"] or "Pill" in item["name"] for item in manifest["components"])
    assert any("card" in entry.lower() for entry in manifest["export_excluded"])
    with zipfile.ZipFile(__import__("io").BytesIO(package)) as archive:
        root = __import__("xml.etree.ElementTree", fromlist=["ElementTree"]).fromstring(archive.read("3D/3dmodel.model"))
    ns = "{http://schemas.microsoft.com/3dmanufacturing/core/2015/02}"
    objects = root.findall(ns + "resources/" + ns + "object")
    meshes = [item for item in objects if item.find(ns + "mesh") is not None]
    roots = [item for item in objects if item.find(ns + "components") is not None]
    builds = root.findall(ns + "build/" + ns + "item")
    references = roots[0].findall(ns + "components/" + ns + "component")
    assert [item.get("name") for item in meshes] == EXPECTED_52_NAMES
    assert len(references) == 52
    assert len(roots) == len(builds) == 1
    assert builds[0].get("objectid") == "53"
    assert roots[0].get("id") == "53"
    assert [item.get("id") for item in meshes] == [str(index) for index in range(1, 53)]
    assert [item.get("objectid") for item in references] == [str(index) for index in range(1, 53)]
    for manifest_item, reference in zip(manifest["components"], references):
        assert tuple(map(float, reference.get("transform", "").split())) == pytest.approx(tuple(manifest_item["transform_mm"]))
