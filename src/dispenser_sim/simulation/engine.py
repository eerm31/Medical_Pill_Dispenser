"""Seeded run engine (T019, extended by T025 for US2): execute N actuation
cycles over a sampled reservoir.

Every cycle records exactly one DispenseEvent (zero / one / multiple pills, or
no pill available) per FR-002/FR-012 and SC-001. Reservoir depletion is real:
once the sampled reservoir is exhausted, subsequent cycles record
NO_PILL_AVAILABLE (spec edge case: empty reservoir is not a mechanism
failure). A jam may persist across subsequent cycles until cleared
(recorded via ``jam_persistent`` on each affected event); while a jam
persists, no new pill is presented. Partial/interrupted actuation is treated
as a fault scenario resolving to a classified outcome (spec edge cases).
Every invariant violation is classified by simulation/failure_modes.py
(FR-013/014). When no seed is supplied one is generated and recorded
(FR-015/017).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from ..mechanism.singulation import singulate
from ..models.cycle import ActuationCycle
from ..models.distribution import PillDistribution
from ..models.envelope import PortabilityEnvelope
from ..models.events import DispenseEvent, Outcome
from ..models.mechanism import MechanismConfig
from .failure_modes import CycleState, classify_violation
from .population import sample_population
from .rng import RunRng, generate_seed

#: Probability that a jam persists into subsequent cycles.
JAM_PERSIST_PROBABILITY = 0.35

#: Maximum additional cycles a persisting jam blocks presentation (drawn
#: uniformly from 0.._JAM_PERSIST_MAX_EXTRA).
_JAM_PERSIST_MAX_EXTRA = 2

#: Follower presentation is more likely when the presented pill is narrow
#: relative to the metering gate (stacking/double-drop precursor).
_FOLLOWER_BASE_PROBABILITY = 0.4

#: Probability that an actuation is interrupted mid-stroke (partial
#: actuation fault scenario, spec edge cases); the presented pill is not
#: consumed and the cycle resolves to a classified outcome.
_INTERRUPTED_STROKE_PROBABILITY = 0.005


@dataclass
class SimulationRun:
    """One seeded execution of N actuation cycles (data-model.md)."""

    run_id: str
    created_utc: str
    seed: int
    mechanism_config: MechanismConfig
    pill_distribution: PillDistribution
    envelope: PortabilityEnvelope
    cycles_requested: int
    events: list[DispenseEvent] = field(default_factory=list)

    @property
    def cycles_completed(self) -> int:
        return len(self.events)

    def to_dict(self) -> dict:
        """Serialize to the run.json record minus the summary section."""
        return {
            "run_id": self.run_id,
            "created_utc": self.created_utc,
            "seed": self.seed,
            "mechanism_config": self.mechanism_config.to_dict(),
            "pill_distribution": self.pill_distribution.to_dict(),
            "envelope": self.envelope.to_dict(),
            "cycles_requested": self.cycles_requested,
            "cycles_completed": self.cycles_completed,
            "events": [event.to_dict() for event in self.events],
        }


def run_simulation(
    mechanism: MechanismConfig,
    distribution: PillDistribution,
    envelope: PortabilityEnvelope,
    cycles: int,
    seed: int | None = None,
) -> SimulationRun:
    """Execute ``cycles`` actuation cycles and return the completed run.

    The reservoir is loaded once from the seeded population sub-stream,
    capped by the mechanism's reservoir capacity. Per-cycle process noise
    comes from the seeded cycles sub-stream, so identical seed + config
    reproduces identical events (SC-004).
    """
    if cycles < 1:
        raise ValueError(f"cycles must be >= 1, got {cycles}")
    run_seed = generate_seed() if seed is None else int(seed)
    rng = RunRng(run_seed)
    reservoir = sample_population(distribution, rng.population)[
        : mechanism.reservoir_capacity
    ]

    events: list[DispenseEvent] = []
    position = 0  # next pill index in the reservoir
    jam_cycles_left = 0

    for index in range(cycles):
        cycle = ActuationCycle(index=index)

        if jam_cycles_left > 0:
            # A jam persists until cleared: no new pill is presented; the
            # cycle still resolves to exactly one classified outcome
            # (FR-002), classified JAM (FR-013).
            cycle.advance()  # PRESENTED (blocked)
            cycle.advance()  # SINGULATED (blocked)
            cycle.fault("jam persists from a previous cycle")
            jam_cycles_left -= 1
            persists_further = jam_cycles_left > 0
            mode = classify_violation(
                CycleState(
                    pills_dispensed=0,
                    pills_available=True,
                    jammed=True,
                    jam_persistent=persists_further,
                )
            )
            events.append(
                DispenseEvent(
                    cycle_index=index,
                    pills_dispensed=0,
                    outcome=Outcome.ZERO_DOSE,
                    failure_mode=mode.value,
                    jam_persistent=persists_further,
                    pill_state=None,
                )
            )
            continue

        if position >= len(reservoir):
            # Empty reservoir: NO_PILL_AVAILABLE, never a failure (FR-012).
            for _ in range(4):  # LOADED -> ... -> RESET with no pill
                cycle.advance()
            events.append(
                DispenseEvent(
                    cycle_index=index,
                    pills_dispensed=0,
                    outcome=Outcome.NO_PILL_AVAILABLE,
                    failure_mode=None,
                    jam_persistent=False,
                    pill_state=None,
                )
            )
            continue

        pill = reservoir[position]
        gate_width = mechanism.metering_geometry.get(
            "gate_width_mm", mechanism.passage_clearance_mm
        )
        follow_probability = (
            max(0.0, 1.0 - pill.transverse_width() / gate_width)
            * _FOLLOWER_BASE_PROBABILITY
        )
        follower = None
        if (
            position + 1 < len(reservoir)
            and rng.cycles.random() < follow_probability
        ):
            follower = reservoir[position + 1]

        cycle.advance()  # PRESENTED

        if rng.cycles.random() < _INTERRUPTED_STROKE_PROBABILITY:
            # Partial/interrupted actuation: a fault scenario (spec edge
            # cases). The pill is not consumed; the violation matches no
            # named classifier and is recorded UNCLASSIFIED with the cycle
            # state preserved (FR-014).
            cycle.fault("interrupted stroke: partial actuation")
            mode = classify_violation(
                CycleState(
                    pills_dispensed=0,
                    pills_available=True,
                    interrupted=True,
                    pill_state=pill.to_dict(),
                )
            )
            events.append(
                DispenseEvent(
                    cycle_index=index,
                    pills_dispensed=0,
                    outcome=Outcome.ZERO_DOSE,
                    failure_mode=mode.value,
                    jam_persistent=False,
                    pill_state=pill.to_dict(),
                )
            )
            continue

        cycle.advance()  # SINGULATED
        result = singulate(pill, mechanism, rng.cycles, follower=follower)

        if result.jammed:
            cycle.fault(result.fault_reason or "jam")
            position += 1  # the jammed pill is stuck in the mechanism
            if rng.cycles.random() < JAM_PERSIST_PROBABILITY:
                jam_cycles_left = 1 + rng.cycles.randrange(
                    _JAM_PERSIST_MAX_EXTRA + 1
                )
            mode = classify_violation(
                CycleState(
                    pills_dispensed=0,
                    pills_available=True,
                    jammed=True,
                    jam_persistent=jam_cycles_left > 0,
                    pill_state=pill.to_dict(),
                )
            )
            events.append(
                DispenseEvent(
                    cycle_index=index,
                    pills_dispensed=0,
                    outcome=Outcome.ZERO_DOSE,
                    failure_mode=mode.value,
                    jam_persistent=jam_cycles_left > 0,
                    pill_state=pill.to_dict(),
                )
            )
        elif result.pills_dispensed == 0:
            # Missed dispense: the pill falls back into the reservoir and is
            # not consumed; the cycle is a fault scenario (spec edge cases).
            cycle.fault(result.fault_reason or "no pill released")
            mode = classify_violation(
                CycleState(
                    pills_dispensed=0,
                    pills_available=True,
                    force_sufficient=result.force_sufficient,
                    pill_state=pill.to_dict(),
                )
            )
            events.append(
                DispenseEvent(
                    cycle_index=index,
                    pills_dispensed=0,
                    outcome=Outcome.ZERO_DOSE,
                    failure_mode=mode.value,
                    jam_persistent=False,
                    pill_state=pill.to_dict(),
                )
            )
        else:
            cycle.advance()  # RELEASED
            cycle.advance()  # RESET
            position += result.pills_dispensed
            if result.pills_dispensed == 1:
                outcome = Outcome.SINGLE
                failure_mode = None
            else:
                outcome = Outcome.MULTI_DOSE
                failure_mode = classify_violation(
                    CycleState(
                        pills_dispensed=result.pills_dispensed,
                        pills_available=True,
                        follower_presented=follower is not None,
                        side_by_side_release=result.side_by_side_release,
                        pill_state=pill.to_dict(),
                    )
                ).value
            events.append(
                DispenseEvent(
                    cycle_index=index,
                    pills_dispensed=result.pills_dispensed,
                    outcome=outcome,
                    failure_mode=failure_mode,
                    jam_persistent=False,
                    pill_state=pill.to_dict(),
                )
            )

    return SimulationRun(
        run_id=uuid.uuid4().hex[:12],
        created_utc=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        seed=run_seed,
        mechanism_config=mechanism,
        pill_distribution=distribution,
        envelope=envelope,
        cycles_requested=cycles,
        events=events,
    )
