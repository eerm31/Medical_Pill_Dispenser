"""ActuationCycle: the complete dispense attempt, rest to rest (FR-001).

State machine: LOADED -> PRESENTED -> SINGULATED -> RELEASED -> RESET.
Any stage can transition to FAULT (jam, interrupted stroke); a faulted cycle
is still resolved — the engine records exactly one classified outcome for it
(FR-002, spec edge case: partial/interrupted actuation is a fault scenario).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class CycleStage(str, Enum):
    """Stages of one actuation cycle (FR-001)."""

    LOADED = "LOADED"
    PRESENTED = "PRESENTED"
    SINGULATED = "SINGULATED"
    RELEASED = "RELEASED"
    RESET = "RESET"
    FAULT = "FAULT"


#: Happy-path stage order; RESET is terminal.
_STAGE_ORDER = (
    CycleStage.LOADED,
    CycleStage.PRESENTED,
    CycleStage.SINGULATED,
    CycleStage.RELEASED,
    CycleStage.RESET,
)


@dataclass
class ActuationCycle:
    """One actuation cycle of the mechanism (rest -> rest)."""

    index: int
    stage: CycleStage = CycleStage.LOADED
    fault_reason: str | None = None
    _history: list[CycleStage] = field(
        default_factory=lambda: [CycleStage.LOADED]
    )

    def advance(self) -> CycleStage:
        """Move to the next happy-path stage.

        Raises ValueError if the cycle is already resolved (RESET or FAULT).
        """
        if self.stage is CycleStage.RESET:
            raise ValueError(f"cycle {self.index}: cannot advance past RESET")
        if self.stage is CycleStage.FAULT:
            raise ValueError(
                f"cycle {self.index}: cannot advance from FAULT "
                f"({self.fault_reason})"
            )
        next_stage = _STAGE_ORDER[_STAGE_ORDER.index(self.stage) + 1]
        self.stage = next_stage
        self._history.append(next_stage)
        return next_stage

    def fault(self, reason: str) -> None:
        """Transition the current stage to FAULT with a recorded reason.

        Raises ValueError if the cycle already faulted or completed.
        """
        if self.stage is CycleStage.FAULT:
            raise ValueError(f"cycle {self.index}: already in FAULT")
        if self.stage is CycleStage.RESET:
            raise ValueError(f"cycle {self.index}: cannot fault after RESET")
        self.stage = CycleStage.FAULT
        self.fault_reason = reason
        self._history.append(CycleStage.FAULT)

    @property
    def is_fault(self) -> bool:
        return self.stage is CycleStage.FAULT

    @property
    def is_complete(self) -> bool:
        """A cycle is resolved once it reaches RESET or FAULT."""
        return self.stage in (CycleStage.RESET, CycleStage.FAULT)

    @property
    def history(self) -> list[CycleStage]:
        """Ordered stages visited, starting at LOADED."""
        return list(self._history)
