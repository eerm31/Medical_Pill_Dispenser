"""Feature-003 cross-boundary checks for untouched 001/002 behavior."""
import hashlib
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / "runs" / "00d370d37c0b"


def _run(*args):
    return subprocess.run(
        [sys.executable, "-m", "dispenser_sim", *args],
        cwd=ROOT,
        env={**os.environ, "PYTHONPATH": str(ROOT / "src")},
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )


def test_core_validation_and_2d_animation_check_remain_available():
    validation = _run(
        "validate", "--mechanism", "configs/mechanisms/slider_gate_v1.json",
        "--pills", "configs/pills/standard_mix.json",
    )
    assert validation.returncode == 0, validation.stderr
    assert "VALID" in validation.stdout
    replay = _run("animate", "--run", str(RUN), "--check")
    assert replay.returncode == 0, replay.stderr
    assert "frames: OK (10000 derived)" in replay.stdout
    assert "--3d" not in _run("animate", "--help").stdout


def test_concept_export_does_not_mutate_persisted_run(tmp_path):
    record = RUN / "run.json"
    before = hashlib.sha256(record.read_bytes()).hexdigest()
    target = tmp_path / "scan-concept.3mf"
    exported = _run("export-3mf", "--output", str(target))
    assert exported.returncode == 0, exported.stderr
    after = hashlib.sha256(record.read_bytes()).hexdigest()
    assert after == before
    assert target.is_file() and Path(str(target) + ".manifest.json").is_file()


def test_base_python_dependencies_stay_empty_and_no_pyglet_core_import():
    from dispenser_sim.cli import main
    from dispenser_sim.viz3d.geometry_schema import load_geometry
    import tomllib

    project = tomllib.loads((ROOT / "pyproject.toml").read_text())
    assert project["project"]["dependencies"] == []
    assert "viz" not in project["project"].get("optional-dependencies", {})
    assert load_geometry()["concept_id"] == "rotating-cartridge-dispenser-scan"
    code = (
        "import sys; from dispenser_sim.cli import main; "
        f"assert main(['animate','--run',{str(RUN)!r},'--check']) == 0; "
        "assert 'pyglet' not in sys.modules"
    )
    child = subprocess.run(
        [sys.executable, "-c", code], cwd=ROOT,
        env={**os.environ, "PYTHONPATH": str(ROOT / "src")},
        capture_output=True, text=True, timeout=15, check=False,
    )
    assert child.returncode == 0, child.stderr
