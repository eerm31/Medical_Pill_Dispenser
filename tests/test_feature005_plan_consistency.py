"""Feature 005 plan/data-model/research/quickstart stay consistent with docs/visualizer/rotation-spec.js.

Stale numbers may remain only on lines that say they are superseded; the posture strings must be present.
"""
import re

from feature005_spec import REPO

SPEC_DIR = REPO / "specs" / "005-first-subsystem-rotation-pin-gates"
DOCS = ("plan.md", "data-model.md", "research.md", "quickstart.md")
# Stale 2026-10-13 values (regex, label). The "six coupons" check lives in the build-docs test (T017).
DENY = [
    (r"x 5\.\.9\b", "hall pocket x 5..9"),
    (r"[\u2212-]20\.3\s*\.\.\s*[\u2212-]17\.3", "hall pocket y -20.3..-17.3"),
    (r"\u00d86\s*[\u00d7x]\s*1\.0 mm boss", "diameter 6 x 1.0 mm boss"),
    (r"boss \u00d8 / height.*\b6\.0\b", "boss dia 6.0 in the tolerance table"),
    (r"\u2248 4 \u00d7 3 \u00d7 1\.6", "hall box 4 x 3 x 1.6"),
    (r"\b224 tests\b", "224 tests"),
    (r"4\.6 mm clear", "4.6 mm clear"),
]
EXEMPT = re.compile(r"superseded|supersedes|original note|original text|earlier text", re.I)


def _lines(name):
    return (SPEC_DIR / name).read_text(encoding="utf-8").splitlines()


def test_no_stale_numbers_outside_superseded_text():
    stale = []
    for name in DOCS:
        for no, line in enumerate(_lines(name), 1):
            if EXEMPT.search(line):
                continue
            for pattern, label in DENY:
                if re.search(pattern, line):
                    stale.append(f"{name}:{no}: {label}")
    assert not stale, stale


def test_posture_strings_are_present():
    plan = (SPEC_DIR / "plan.md").read_text(encoding="utf-8")
    model = (SPEC_DIR / "data-model.md").read_text(encoding="utf-8")
    research = (SPEC_DIR / "research.md").read_text(encoding="utf-8")
    quick = (SPEC_DIR / "quickstart.md").read_text(encoding="utf-8")
    for text in (plan, model):
        for needle in ("ASSUMED / NOT_VALIDATED", "print_ready=false", "fabricable_as_designed=false"):
            assert needle in text, needle
    assert "ASSUMED / NOT_VALIDATED" in research and "NOT VALIDATED" in quick
