"""MechanismConfig -> Layout mapping (T009, FR-004/005; Decision 3).

Pure, display-free geometry: a MechanismConfig maps to a normalized 0-1
schematic Layout (reservoir box with capacity, pill path polyline,
singulation/metering zone sized from passage_clearance_mm and
metering_geometry, release point, reset position). Two templates ship with
the MVP — slider-gate (linear stroke) and rotary-disk — selected from
metering_geometry keys; any other config gets a generic config-driven
linear layout. CSV-fallback mode (mechanism=None) uses the generic layout
and is flagged approximate.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..models.mechanism import MechanismConfig

Point = tuple[float, float]
Rect = tuple[float, float, float, float]  # x, y, width, height (0-1 space)


@dataclass(frozen=True)
class Layout:
    """Normalized schematic primitives for one mechanism view."""

    template: str  # "slider_gate" | "rotary_disk" | "generic"
    mechanism_name: str
    reservoir: Rect
    reservoir_capacity: int | None  # None when unknown (CSV fallback)
    path: tuple[Point, ...]  # polyline: reservoir -> metering -> release
    metering_zone: Rect
    release_point: Point
    reset_position: Point
    clearance_mm: float | None  # passage clearance; None when approximate
    disk: tuple[float, float, float] | None = None  # rotary: cx, cy, r
    geometry_approximate: bool = False

    @property
    def clearance_label(self) -> str:
        if self.clearance_mm is None:
            return "passage clearance: unknown (approximate)"
        return f"passage clearance {self.clearance_mm:g} mm"


def _select_template(mechanism: MechanismConfig) -> str:
    keys = set(mechanism.metering_geometry)
    if any("disk" in key or "rotation" in key for key in keys):
        return "rotary_disk"
    if any("stroke" in key or "gate" in key for key in keys):
        return "slider_gate"
    return "generic"


def build_layout(
    mechanism: MechanismConfig | None, *, geometry_approximate: bool = False
) -> Layout:
    """Build the normalized layout for a mechanism config (or fallback).

    The metering zone's width scales with passage_clearance_mm relative to
    the stroke, so a wider gate reads as a wider zone; physical dimensions
    stay visible as labels rather than fabricated scale (Constitution II).
    """
    if mechanism is None:
        return Layout(
            template="generic",
            mechanism_name="unknown mechanism",
            reservoir=(0.05, 0.15, 0.20, 0.55),
            reservoir_capacity=None,
            path=((0.25, 0.42), (0.50, 0.42), (0.78, 0.42)),
            metering_zone=(0.50, 0.32, 0.14, 0.20),
            release_point=(0.80, 0.42),
            reset_position=(0.50, 0.20),
            clearance_mm=None,
            geometry_approximate=True,
        )

    template = _select_template(mechanism)
    clearance = mechanism.passage_clearance_mm
    stroke = mechanism.metering_geometry.get("stroke_length_mm", 25.0)
    # Metering-zone width: clearance relative to the stroke, clamped to a
    # readable schematic size.
    zone_width = min(0.30, max(0.08, clearance / max(stroke, 1.0) * 0.6))
    metering_zone = (0.50, 0.32, zone_width, 0.20)

    if template == "rotary_disk":
        return Layout(
            template=template,
            mechanism_name=mechanism.name,
            reservoir=(0.05, 0.15, 0.20, 0.55),
            reservoir_capacity=mechanism.reservoir_capacity,
            path=((0.25, 0.42), (0.42, 0.42), (0.78, 0.30)),
            metering_zone=metering_zone,
            release_point=(0.80, 0.28),
            reset_position=(0.50, 0.62),
            clearance_mm=clearance,
            disk=(0.55, 0.42, 0.16),
            geometry_approximate=geometry_approximate,
        )
    # slider_gate and the generic fallback share the linear-stroke layout.
    return Layout(
        template=template,
        mechanism_name=mechanism.name,
        reservoir=(0.05, 0.15, 0.20, 0.55),
        reservoir_capacity=mechanism.reservoir_capacity,
        path=((0.25, 0.42), (0.50, 0.42), (0.80, 0.42)),
        metering_zone=metering_zone,
        release_point=(0.82, 0.42),
        reset_position=(0.50, 0.20),
        clearance_mm=clearance,
        geometry_approximate=geometry_approximate,
    )
