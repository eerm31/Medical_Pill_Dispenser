"""Offline concept-only 3MF export for the scanned rotating dispenser.

The standard-library writer emits a bounded 3MF Core package and sibling
manifest. Mesh/package checks are structural only; they do not establish
printability or physical fit.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
import zipfile
import xml.etree.ElementTree as ET

from .geometry_schema import canonical_json, load_geometry, source_hash
from .mesh import bounds, validate_mesh
from .scene import ConceptAssembly, build_concept_assembly

CORE = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
REL = "http://schemas.openxmlformats.org/package/2006/relationships"
CT = "http://schemas.openxmlformats.org/package/2006/content-types"
START = "http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"
MODEL_TYPE = "application/vnd.ms-package.3dmanufacturing-3dmodel+xml"
ENTRIES = ("[Content_Types].xml", "_rels/.rels", "3D/3dmodel.model")
WARNING = "NOT VALIDATED / NOT PRINT-READY"


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _float(value: float) -> str:
    if not __import__("math").isfinite(value):
        raise ValueError("non-finite mesh coordinate")
    return format(float(value), ".15g")


def _xml(element: ET.Element) -> bytes:
    return ET.tostring(element, encoding="utf-8", xml_declaration=True)


def build_package(assembly: ConceptAssembly) -> bytes:
    """Create deterministic Core 3MF: 52 named parts, one assembly/build."""
    def node(parent, name, attributes=None, namespace=CORE):
        return ET.SubElement(parent, f"{{{namespace}}}{name}", attributes or {})

    model = ET.Element(f"{{{CORE}}}model", {
        "unit": "millimeter",
        "{http://www.w3.org/XML/1998/namespace}lang": "en-US",
    })
    node(model, "metadata", {"name": "Title", "preserve": "true"}).text = (
        "Rotating Cartridge Dispenser Scan Concept — " + WARNING
    )
    node(model, "metadata", {"name": "Description", "preserve": "true"}).text = (
        f"{WARNING}; approximately {len(assembly.parts)} concept physical instances with approximate placements; "
        "parked rest pose; right-handed mm; "
        "FDM/PLA/0.4 mm nozzle is provisional guidance only; "
        "print_ready=false; fabricable_as_designed=false; see sibling manifest."
    )
    resources = node(model, "resources")
    for part in assembly.parts:
        obj = node(resources, "object", {
            "id": str(part.part_id), "type": "model", "name": part.name,
        })
        mesh = node(obj, "mesh")
        vertices = node(mesh, "vertices")
        for point in part.mesh.vertices:
            node(vertices, "vertex", dict(zip(("x", "y", "z"), map(_float, point))))
        triangles = node(mesh, "triangles")
        for face in part.mesh.triangles:
            node(triangles, "triangle", dict(zip(("v1", "v2", "v3"), map(str, face))))
    root_id = len(assembly.parts) + 1
    root = node(resources, "object", {
        "id": str(root_id), "type": "model", "name": "Portable Dispenser Assembly",
    })
    group = node(root, "components")
    for part in assembly.parts:
        matrix = " ".join(map(_float, part.placement_transform))
        node(group, "component", {"objectid": str(part.part_id), "transform": matrix})
    node(node(model, "build"), "item", {"objectid": str(root_id)})

    content_types = ET.Element(f"{{{CT}}}Types")
    node(content_types, "Default", {
        "Extension": "rels",
        "ContentType": "application/vnd.openxmlformats-package.relationships+xml",
    }, CT)
    node(content_types, "Override", {
        "PartName": "/3D/3dmodel.model", "ContentType": MODEL_TYPE,
    }, CT)
    relationships = ET.Element(f"{{{REL}}}Relationships")
    node(relationships, "Relationship", {
        "Id": "rel0", "Type": START, "Target": "/3D/3dmodel.model",
    }, REL)
    payloads = (_xml(content_types), _xml(relationships), _xml(model))
    import io
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in zip(ENTRIES, payloads):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o600 << 16
            archive.writestr(info, data)
    return output.getvalue()


def build_manifest(assembly: ConceptAssembly, package: bytes) -> dict:
    source = assembly.source_geometry
    schedule = source["assembly_schedule"]
    schedule_placements = {
        item["component_id"]: item for item in schedule["component_placements"]
    }
    unresolved_schedule = {
        "revision": schedule["revision"],
        "status": "UNRESOLVED",
        "conflict_ids": [item["conflict_id"] for item in schedule["conflicts"]],
        "clearance_check_ids": [item["check_id"] for item in schedule["clearance_checks"]],
    }
    components = []
    for part in assembly.parts:
        definition = next(item for item in source["components"] if item["component_id"] == part.component_id)
        placement = schedule_placements.get(part.component_id)
        if placement is None:
            raise ValueError(f"missing assembly-schedule placement for {part.component_id}")
        components.append({
            "part_id": part.part_id,
            "component_id": part.component_id,
            "name": part.name,
            "category": part.category,
            "recipe": part.recipe,
            "transform_mm": part.placement_transform,
            "bounds_mm": bounds(part.mesh, part.placement_transform),
            "provenance": part.provenance,
            "placement_provenance": placement["placement_provenance"],
            "verification_status": placement["verification_status"],
            "parent_component_id": part.parent_component_id,
            "motion_group": part.group_id,
            "coordinate_frame": part.coordinate_frame,
            "assumptions": {
                "placement": placement,
                "recipe_provenance": part.recipe.get("provenance", "ASSUMED"),
                "recipe_verification_status": part.recipe.get("verification_status", "NOT_VALIDATED"),
            },
            "unresolved_schedule": unresolved_schedule,
            "parent_transform_applied": part.parent_transform_applied,
            "dimension_refs": definition.get("dimension_refs", []),
            "missing_inputs": list(part.missing_inputs),
            "mesh_qa": validate_mesh(part.mesh),
        })
    body = {
        "schema_version": 1,
        "generator_revision": source["generator_revision"],
        "source": {
            "identifier": source["source"]["identifier"],
            "revision": source["source"]["revision"],
            "authority": source["source"]["authority"],
            "geometry_json_sha256": source_hash(source),
        },
        "scope": "portable rotating-cartridge concept assembly",
        "reference_pose": "parked_rest",
        "units": "mm",
        "handedness": "right",
        "components": components,
        "dimensions": source["dimensions"],
        "design_basis": {
            "station": source["station"],
            "frames": source["frames"],
            "assembly_schedule": schedule,
            "provenance_sources": source["provenance_sources"],
            "derived_rules": source["derived_rules"],
            "unknowns": source["unknowns"],
        },
        "missing_inputs": source["missing_inputs"],
        "export_excluded": source["export"]["excluded"],
        "process_guidance": source["export"]["process_guidance"],
        "artifact_integrity": {
            "status": "PASS",
            "scope": "bounded emitted-subset ZIP/XML/hash/mesh checks only; not XSD, slicer, fit, or manufacturing validation",
            "numerical_mesh_qa_mm": 0.01,
            "package_sha256": _sha(package),
        },
        "manufacturing_gate": {
            "status": "BLOCKED",
            "required": [
                "authoritative drawings/interfaces/tolerances",
                "reconcile inferred geometry",
                "actuator and spring specifications",
                "material/process settings",
                "measured prototype fit and authorized review",
            ],
        },
        "validation_status": "NOT_VALIDATED",
        "print_ready": False,
        "fabricable_as_designed": False,
    }
    body["artifact_integrity"]["manifest_sha256"] = _sha(canonical_json(body))
    return body


def validate_package(package: bytes, manifest: dict) -> None:
    """Fail-closed structural check of the exact emitted 3MF Core subset."""
    import io
    integrity = manifest.get("artifact_integrity", {})
    if _sha(package) != integrity.get("package_sha256"):
        raise ValueError("package SHA-256 mismatch")
    manifest_copy = dict(manifest)
    manifest_integrity = dict(integrity)
    claimed_manifest_hash = manifest_integrity.pop("manifest_sha256", None)
    manifest_copy["artifact_integrity"] = manifest_integrity
    if claimed_manifest_hash != _sha(canonical_json(manifest_copy)):
        raise ValueError("manifest SHA-256 mismatch")
    if manifest.get("validation_status") != "NOT_VALIDATED" or manifest.get("print_ready") is not False or manifest.get("fabricable_as_designed") is not False:
        raise ValueError("concept readiness declarations were altered")
    with zipfile.ZipFile(io.BytesIO(package)) as archive:
        if tuple(archive.namelist()) != ENTRIES or archive.testzip() is not None:
            raise ValueError("invalid 3MF ZIP entry set or CRC")
        model = ET.fromstring(archive.read("3D/3dmodel.model"))
    if model.tag != f"{{{CORE}}}model" or model.get("unit") != "millimeter":
        raise ValueError("3MF must be a millimetre Core model")
    objects = model.findall(f"{{{CORE}}}resources/{{{CORE}}}object")
    parts = [item for item in objects if item.find(f"{{{CORE}}}mesh") is not None]
    roots = [item for item in objects if item.find(f"{{{CORE}}}components") is not None]
    builds = model.findall(f"{{{CORE}}}build/{{{CORE}}}item")
    expected_names = [item["name"] for item in manifest["components"]]
    expected_part_ids = [str(i) for i in range(1, 53)]
    if (
        len(parts) != 52
        or [part.get("id") for part in parts] != expected_part_ids
        or [part.get("name") for part in parts] != expected_names
        or len(roots) != 1
        or roots[0].get("id") != "53"
        or roots[0].get("name") != "Portable Dispenser Assembly"
        or len(builds) != 1
    ):
        raise ValueError("expected 52 named parts and one assembly build item")
    component_ids = [item.get("part_id") for item in manifest["components"]]
    if component_ids != list(range(1, 53)):
        raise ValueError("manifest must contain the ordered 52-part inventory")
    for item in manifest["components"]:
        if (
            not item.get("name")
            or "parent_component_id" not in item
            or not item.get("motion_group")
            or item.get("coordinate_frame") != "canonical_right_handed_mm"
            or not item.get("placement_provenance")
            or item.get("verification_status") != "NOT_VALIDATED"
            or not isinstance(item.get("assumptions"), dict)
            or not isinstance(item.get("unresolved_schedule"), dict)
        ):
            raise ValueError("manifest component is missing required schedule/provenance metadata")
        if item["unresolved_schedule"].get("status") != "UNRESOLVED":
            raise ValueError("unresolved assembly schedule must remain unresolved")
    references = roots[0].findall(f"{{{CORE}}}components/{{{CORE}}}component")
    if len(references) != 52 or [ref.get("objectid") for ref in references] != [str(i) for i in range(1,53)]:
        raise ValueError("assembly must reference all 52 physical instances")
    for component, reference in zip(manifest["components"], references):
        serialized = tuple(map(float, reference.get("transform", "").split()))
        expected = tuple(component["transform_mm"])
        if len(serialized) != len(expected) or any(abs(a-b) > 1e-12 for a,b in zip(serialized, expected)):
            raise ValueError("assembly transform differs from the canonical manifest")
    if builds[0].get("objectid") != "53":
        raise ValueError("build item must reference the assembly root")
    metadata = model.findall(f"{{{CORE}}}metadata")
    if not metadata or not all(WARNING in (item.text or "") for item in metadata):
        raise ValueError("mandatory not-ready warnings absent from 3MF metadata")
    description = next((item.text or "" for item in metadata if item.get("name") == "Description"), "")
    if (
        "approximately 52" not in description
        or "32" in description
        or "print_ready=false" not in description
        or "fabricable_as_designed=false" not in description
    ):
        raise ValueError("3MF metadata must describe the approximate 52-part concept and false readiness")


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _destination(output: str | Path, force: bool) -> tuple[Path, Path]:
    target = Path(os.path.abspath(output))
    sidecar = Path(str(target) + ".manifest.json")
    if target.suffix.lower() != ".3mf":
        raise ValueError("output path must end in .3mf")
    for path in (target, sidecar):
        if any(parent.is_symlink() for parent in (path, *path.parents)):
            raise ValueError("symlink destination or ancestor is forbidden, even with --force")
    if not target.parent.is_dir() or not os.access(target.parent, os.W_OK):
        raise ValueError("output parent must already exist and be writable")
    protected = _project_root()
    for path in (target, sidecar):
        resolved = path.resolve()
        if resolved.is_relative_to(protected):
            raise ValueError("output must be outside the project source/run tree")
        if path.exists():
            if not path.is_file():
                raise ValueError("output and manifest must be regular files")
            if not force:
                raise ValueError("output pair already exists; use --force")
            for source_path in protected.rglob("*"):
                if source_path.is_file() and path.samefile(source_path):
                    raise ValueError("output must not hardlink to a source/run file, even with --force")
            for child in protected.rglob("*"):
                if child.is_file() and path.samefile(child):
                    raise ValueError("output aliases a protected source/run file, even with --force")
    return target, sidecar


def export_concept(output: str | Path, *, force: bool = False, fault=None) -> dict:
    """Export the canonical parked concept; source is independent of runs."""
    target, sidecar = _destination(output, force)
    assembly = build_concept_assembly(load_geometry())
    package = build_package(assembly)
    manifest = build_manifest(assembly, package)
    validate_package(package, manifest)
    hook = fault or (lambda _point: None)
    stage = Path(tempfile.mkdtemp(prefix=".dispenser-concept-", dir=target.parent))
    backups: dict[Path, Path] = {}
    published: list[Path] = []
    preserve_stage = False
    try:
        staged_package, staged_manifest = stage / "model.3mf", stage / "manifest.json"
        staged_package.write_bytes(package); hook("staged_package")
        staged_manifest.write_bytes(canonical_json(manifest) + b"\n"); hook("staged_manifest")
        for index, path in enumerate((target, sidecar)):
            if path.exists():
                backup = stage / f"backup-{index}"
                shutil.copy2(path, backup)
                backups[path] = backup
        hook("backup")
        _destination(output, force)
        for source_path, destination_path, point in (
            (staged_package, target, "replace_package"),
            (staged_manifest, sidecar, "replace_manifest"),
        ):
            os.replace(source_path, destination_path)
            published.append(destination_path)
            hook(point)
        validate_package(target.read_bytes(), json.loads(sidecar.read_text(encoding="utf-8")))
        hook("committed")
        return manifest
    except Exception as exc:
        rollback_errors = []
        for destination_path in reversed(published):
            backup = backups.get(destination_path)
            try:
                if backup:
                    os.replace(backup, destination_path)
                else:
                    destination_path.unlink(missing_ok=True)
            except OSError as rollback_exc:
                rollback_errors.append(f"{destination_path}: {rollback_exc}")
        if rollback_errors:
            preserve_stage = True
            raise OSError(
                f"publication failed: {exc}; ROLLBACK FAILED: "
                f"{'; '.join(rollback_errors)}; recovery files retained at {stage}"
            ) from exc
        raise
    finally:
        if not preserve_stage:
            shutil.rmtree(stage, ignore_errors=True)
