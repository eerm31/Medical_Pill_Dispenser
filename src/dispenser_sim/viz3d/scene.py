"""Canonical, run-independent parked assembly for the rotating-drum concept."""
from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Any

from .geometry_schema import load_geometry, source_hash
from .mesh import Mesh, bounds, mesh_from_recipe, validate_transform

WARNING = "CONCEPT ONLY — NOT VALIDATED / NOT PRINT-READY"


@dataclass(frozen=True)
class PartDefinition:
    part_id: int
    component_id: str
    name: str
    category: str
    recipe_id: str
    recipe: dict[str, Any]
    mesh: Mesh
    placement_transform: tuple[float, ...]
    dimensions: tuple[dict[str, Any], ...]
    provenance: str
    missing_inputs: tuple[str, ...]
    color: str | None = None
    parent_component_id: str | None = None
    group_id: str = "fixed-housing"
    world_transform: tuple[float, ...] = ()
    world_bounds_mm: tuple[tuple[float, float, float], tuple[float, float, float]] = ((0., 0., 0.), (0., 0., 0.))
    source_position_mm: tuple[float, float, float] | None = None
    position_provenance: str = "ASSUMED"
    rendered_fallback: bool = False
    ownership_provenance: str = "ASSUMED"
    coordinate_frame: str = "canonical_right_handed_mm"
    parent_transform_applied: bool = False
    integrated_submeshes: tuple[dict[str, Any], ...] = ()


@dataclass(frozen=True)
class ConceptAssembly:
    parts: tuple[PartDefinition, ...]
    source_geometry: dict[str, Any]
    source_geometry_sha256: str
    station_geometry: dict[str, Any]
    generator_revision: str
    units: str = "mm"
    handedness: str = "right"
    scope: str = "portable_rotating_cartridge_concept"
    reference_pose: str = "parked_rest"
    reference_envelope_mm: tuple[float, float, float] | None = None
    validation_status: str = "NOT_VALIDATED"
    print_ready: bool = False
    fabricable_as_designed: bool = False


def _transform(position, rotation):
    rx, ry, rz = rotation
    sx,cx = math.sin(rx),math.cos(rx)
    sy,cy = math.sin(ry),math.cos(ry)
    sz,cz = math.sin(rz),math.cos(rz)
    r = (cz*cy, sz*cy, -sy,
         cz*sy*sx-sz*cx, sz*sy*sx+cz*cx, cy*sx,
         cz*sy*cx+sz*sx, sz*sy*cx-cz*sx, cy*cx)
    result = r + tuple(float(v) for v in position)
    validate_transform(result)
    return result


def build_concept_assembly(source: dict[str, Any] | None = None) -> ConceptAssembly:
    data = load_geometry() if source is None else source
    recipes = {recipe["recipe_id"]: recipe for recipe in data["component_recipes"]}
    dimensions = {item["id"]: item for item in data["dimensions"]}
    schedule = data.get("assembly_schedule", {})
    placements = {item["component_id"]: item for item in schedule.get("component_placements", ())}
    parts = []
    for index, component in enumerate(data["components"], 1):
        recipe = recipes[component["recipe_id"]]
        refs = tuple(dimensions[ref] for ref in component.get("dimension_refs", ()))
        placement = placements.get(component["component_id"], {})
        world_position = placement.get("world_position_mm")
        fallback = False
        if world_position is None:
            world_position = placement.get("rendered_fallback_position_mm")
            fallback = True
        if not isinstance(world_position, list) or len(world_position) != 3:
            raise ValueError(f"missing canonical world pose and explicit fallback: {component['component_id']}")
        world_rotation = placement.get("world_rotation_rad", component["rotation"])
        world_transform = _transform(world_position, world_rotation)
        if any(abs(a - b) > 1e-8 for a, b in zip(world_position, component["position"])):
            raise ValueError(f"component source transform diverges from scheduled world pose: {component['component_id']}")
        mesh = mesh_from_recipe(recipe)
        parts.append(PartDefinition(
            part_id=index, component_id=component["component_id"], name=component["name"],
            category=component["category"], recipe_id=component["recipe_id"], recipe=recipe,
            mesh=mesh,
            placement_transform=world_transform,
            dimensions=refs, provenance=component["provenance"],
            missing_inputs=tuple(component.get("missing_inputs", ())), color=component.get("color"),
            parent_component_id=placement.get("parent_component_id", component.get("parent_component_id")),
            group_id=placement.get("motion_group", component.get("motion_group", "fixed-housing")),
            world_transform=world_transform,
            world_bounds_mm=bounds(mesh, world_transform),
            source_position_mm=(tuple(placement["source_position_mm"])
                                if placement.get("source_position_mm") is not None else None),
            position_provenance=(placement.get("world_position_provenance")
                                 or placement.get("rendered_fallback_provenance")
                                 or placement.get("source_provenance", "ASSUMED")),
            rendered_fallback=fallback,
            ownership_provenance=placement.get("placement_provenance", "ASSUMED"),
            integrated_submeshes=tuple(recipe.get("integrated_submeshes", ())),
        ))
    if len(parts) != data["export"]["physical_component_count"]:
        raise ValueError("canonical assembly physical component count mismatch")
    return ConceptAssembly(tuple(parts), data, source_hash(data), data["station"], data["generator_revision"])
