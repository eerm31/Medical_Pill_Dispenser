"""Every product part answers "what is it attached to?": the mounts table in rotation-spec.js is a graph that must end on the table."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def spec():
    text = (ROOT / "docs" / "visualizer" / "rotation-spec.js").read_text(encoding="utf-8")
    return json.loads(re.sub(r"^window\.DispenserRotationSpec\s*=\s*", "", text.strip()).rstrip(";"))


def test_mount_ids_are_unique_and_every_support_exists():
    mounts = spec()["mounts"]
    ids = [m["id"] for m in mounts]
    assert len(ids) == len(set(ids))
    for m in mounts:
        assert all(o in ids for o in m["on"]), m["id"]
        assert m["how"].strip(), m["id"]


def test_every_part_reaches_the_table_through_its_mounts():
    mounts = {m["id"]: m for m in spec()["mounts"]}
    for pid, m in mounts.items():
        if pid == "table":
            continue
        seen, stack, ok = {pid}, [pid], False
        while stack and not ok:
            for o in mounts[stack.pop()]["on"]:
                if o == "table":
                    ok = True
                    break
                if o not in seen:
                    seen.add(o)
                    stack.append(o)
        assert ok, f"{pid} is not attached to anything that reaches the table"


def test_printed_jobs_and_electronic_labels_all_have_a_mount():
    s = spec()
    ids = {m["id"] for m in s["mounts"]}
    assert {j["id"] for j in s["printJobs"]} <= ids
    labels = {m.get("label_match") for m in s["mounts"]}
    assert set(s["electronicLabels"]) <= labels


def test_the_drum_chain_is_one_connected_load_path():
    mounts = {m["id"]: m for m in spec()["mounts"]}
    chain = ["cartridge", "drum", "rod", "coupler", "stepper", "mount", "platform", "shell", "base", "feet", "table"]
    for a, b in zip(chain, chain[1:]):
        assert b in mounts[a]["on"], (a, b)
    assert "ring" in mounts["drum"]["on"] and "platform" in mounts["ring"]["on"]  # the drum weight goes through the thrust ring, not the motor
