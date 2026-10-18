"""Performance validation (T036, SC-005).

A 10,000-cycle run of one mechanism against the full pill distribution must
complete in under 10 minutes on typical student laptop hardware. The model is
analytic per cycle, so it runs orders of magnitude faster; the assertion
bound is deliberately generous (120 s) to stay robust on slow CI hardware
while still catching any regression toward the 600 s budget.
"""

import time
from pathlib import Path

from dispenser_sim.models.distribution import PillDistribution
from dispenser_sim.models.envelope import PortabilityEnvelope
from dispenser_sim.models.mechanism import MechanismConfig
from dispenser_sim.simulation.engine import run_simulation

REPO_ROOT = Path(__file__).resolve().parents[2]
SLIDER_GATE = REPO_ROOT / "configs" / "mechanisms" / "slider_gate_v1.json"
STANDARD_MIX = REPO_ROOT / "configs" / "pills" / "standard_mix.json"
ENVELOPE = REPO_ROOT / "configs" / "portability_envelope.json"

#: SC-005 budget is 600 s for 10,000 cycles; assert well under it.
_BUDGET_SECONDS = 120.0


def test_10k_cycles_completes_within_budget():
    mechanism = MechanismConfig.from_json(SLIDER_GATE)
    distribution = PillDistribution.from_json(STANDARD_MIX)
    envelope = PortabilityEnvelope.from_json(ENVELOPE)
    start = time.perf_counter()
    run = run_simulation(mechanism, distribution, envelope, 10_000, seed=42)
    elapsed = time.perf_counter() - start
    assert run.cycles_completed == 10_000  # SC-001 still holds at scale
    assert elapsed < _BUDGET_SECONDS, (
        f"10,000-cycle run took {elapsed:.2f}s, exceeding the "
        f"{_BUDGET_SECONDS:.0f}s assertion bound (SC-005 budget: 600s)"
    )
