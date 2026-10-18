"""Parametric 2D kinematic/pseudo-physics singulation model (T018, research R1/R2).

Per actuation cycle, the model evaluates the pill path at the metering point:

1. **Clearance check** — the pill's maximum transverse width at its sampled
   orientation (Pill.transverse_width, research.md R2) is compared against the
   effective passage clearance (nominal ``passage_clearance_mm`` plus tolerance
   jitter drawn from the seeded cycles sub-stream). A pill wider than the
   effective clearance cannot singulate: the cycle faults as a jam.

2. **Force balance** — the mean actuation force available over the stroke
   (``actuation_energy_j / stroke_length``, from E = F * d) must overcome the
   Coulomb friction resistance of the pill against the gate. Contact force
   grows as the fit tightens (width approaching clearance), so sticky pills in
   tight passages can fail to release: a missed dispense.

3. **Multi-release** — when a follower pill is presented and both pills' widths
   fit the effective gate width side by side, both pass the metering point in
   one stroke (double-drop). If they cannot pass side by side but the follower
   individually clears the passage, it may be dragged through aligned behind
   the lead pill (stacking); the probability scales with the lead pill's
   clearance headroom.

The diagnostic fields on SingulationResult (effective_clearance_mm,
effective_gate_width_mm, force_sufficient, side_by_side_release) exist so
simulation/failure_modes.py (T024) can classify violations without
re-evaluating the physics (FR-013/014).

Simplifications (physical justification per FR-005, Constitution II):
- 2D cross-section at the singulation plane; pill thickness enters only via
  mass. Justified because singulation is governed by transverse width vs
  passage clearance.
- Pills present at their sampled orientation without flow alignment; this is
  a conservative worst case for tumbling reservoirs, so predicted jam rates
  are upper bounds for agitated hoppers.
- Coulomb friction with a single per-pill coefficient; reservoir wall contact
  during one stroke is brief, and coated/uncoated tablets are bracketed by the
  documented mu range (research.md R2).
- Energy-to-force conversion uses the mean force over the stroke
  (E = F * d); impact dynamics within the 0.1-1 s stroke are neglected.
- Aligned-follower stacking is a lumped probability scaled by clearance
  headroom; justified because end-to-end pill trains through the metering
  point are observed in rotary/slider feeders but their tribology exceeds a
  2D quasi-static model.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

from ..models.mechanism import MechanismConfig
from ..models.pill import Pill

#: Standard gravity (m/s^2) for friction force estimates.
GRAVITY_M_S2 = 9.81

#: Fit factor amplification: a pill whose transverse width approaches the
#: clearance sees higher gate contact force. fit of 1.0 (width == clearance)
#: triples the baseline friction resistance.
_FIT_CONTACT_FACTOR = 4.0

#: Base probability that a presented follower which cannot pass side by side
#: is nonetheless dragged through the metering point aligned behind the lead
#: pill (stacking), before scaling by the lead's clearance headroom.
_STACKING_BASE_PROBABILITY = 0.3


@dataclass(frozen=True)
class SingulationResult:
    """Outcome of evaluating one presented pill (plus optional follower)."""

    pills_dispensed: int
    jammed: bool
    fault_reason: str | None
    pills: tuple[Pill, ...] = field(default_factory=tuple)
    effective_clearance_mm: float | None = None
    effective_gate_width_mm: float | None = None
    force_sufficient: bool = True
    side_by_side_release: bool = False


def effective_clearance_mm(mechanism: MechanismConfig, rng: random.Random) -> float:
    """Effective passage clearance for one cycle: nominal plus tolerance jitter."""
    tol = mechanism.tolerances_mm.get("passage_clearance", 0.0)
    return mechanism.passage_clearance_mm + rng.uniform(-tol, tol)


def effective_gate_width_mm(mechanism: MechanismConfig, rng: random.Random) -> float:
    """Effective metering gate width for one cycle (falls back to clearance)."""
    nominal = mechanism.metering_geometry.get(
        "gate_width_mm", mechanism.passage_clearance_mm
    )
    tol = mechanism.tolerances_mm.get("gate_width", 0.0)
    return nominal + rng.uniform(-tol, tol)


def available_force_n(mechanism: MechanismConfig) -> float:
    """Mean actuation force over the stroke, from E = F * d (J / m = N)."""
    stroke_mm = mechanism.metering_geometry.get("stroke_length_mm")
    if not stroke_mm or stroke_mm <= 0:
        # No stroke model: any positive actuation energy is assumed sufficient.
        return float("inf")
    return mechanism.actuation_energy_j / (stroke_mm / 1000.0)


def resistive_force_n(pill: Pill, mechanism: MechanismConfig) -> float:
    """Coulomb friction resistance of the pill at the gate (N).

    Baseline normal force is the pill's weight; tight fits (transverse width
    above half the clearance) multiply the contact force.
    """
    weight_n = (pill.mass / 1000.0) * GRAVITY_M_S2
    fit = pill.transverse_width() / mechanism.passage_clearance_mm
    contact = 1.0 + max(0.0, fit - 0.5) * _FIT_CONTACT_FACTOR
    return pill.friction_coefficient * weight_n * contact


def singulate(
    pill: Pill,
    mechanism: MechanismConfig,
    rng: random.Random,
    *,
    follower: Pill | None = None,
) -> SingulationResult:
    """Evaluate one singulation attempt for ``pill`` (and optional ``follower``).

    Deterministic given the seeded ``rng`` (cycles sub-stream). Returns a
    SingulationResult with the number of pills released, whether the cycle
    jammed, a fault reason for faulted cycles, and the pills involved.
    """
    clearance = effective_clearance_mm(mechanism, rng)
    width = pill.transverse_width()
    if width > clearance:
        return SingulationResult(
            pills_dispensed=0,
            jammed=True,
            fault_reason=(
                f"jam: pill transverse width {width:.2f} mm exceeds effective "
                f"clearance {clearance:.2f} mm"
            ),
            pills=(pill,),
            effective_clearance_mm=clearance,
        )
    force_ok = available_force_n(mechanism) >= resistive_force_n(pill, mechanism)
    if not force_ok:
        return SingulationResult(
            pills_dispensed=0,
            jammed=False,
            fault_reason=(
                "missed dispense: actuation force below friction resistance "
                f"for {pill.mass:.3f} g pill at mu={pill.friction_coefficient:.2f}"
            ),
            pills=(pill,),
            effective_clearance_mm=clearance,
            force_sufficient=False,
        )
    if follower is not None:
        gate = effective_gate_width_mm(mechanism, rng)
        follower_width = follower.transverse_width()
        if width + follower_width <= gate:
            # Double-drop: both pills pass the oversized outlet side by side.
            return SingulationResult(
                pills_dispensed=2,
                jammed=False,
                fault_reason=None,
                pills=(pill, follower),
                effective_clearance_mm=clearance,
                effective_gate_width_mm=gate,
                side_by_side_release=True,
            )
        # Stacking: the follower cannot pass side by side but may be dragged
        # through the metering point aligned behind the lead pill.
        headroom = max(0.0, 1.0 - width / clearance)
        if (
            follower_width <= clearance
            and rng.random() < _STACKING_BASE_PROBABILITY * headroom
        ):
            return SingulationResult(
                pills_dispensed=2,
                jammed=False,
                fault_reason=None,
                pills=(pill, follower),
                effective_clearance_mm=clearance,
                effective_gate_width_mm=gate,
                side_by_side_release=False,
            )
    return SingulationResult(
        pills_dispensed=1,
        jammed=False,
        fault_reason=None,
        pills=(pill,),
        effective_clearance_mm=clearance,
    )
