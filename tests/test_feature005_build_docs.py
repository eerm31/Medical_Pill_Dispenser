"""Builder-facing documents under specs/005-first-subsystem-rotation-pin-gates/build/ (documents only).

Checks the posture strings, that no claim phrase appears un-negated, that the measure-before-ordering model values
equal rotation-spec.js values, that the coupon / bench-step / ROT-R rows exist and that result cells stay blank.
ASSUMED / NOT_VALIDATED; nothing here claims a print, a build or a measurement.
"""
import re

import pytest

from feature005_spec import REPO, load_spec

SPEC_DIR = REPO / "specs" / "005-first-subsystem-rotation-pin-gates"
BUILD = SPEC_DIR / "build"
DOCS = ("print-list.md", "bought-parts.md", "coupons.md", "bench-build-order.md", "bench-home-index-test.md")
POSTURE = ("NOT VALIDATED", "print_ready=false", "fabricable_as_designed=false")
CLAIM = re.compile(r"print[- ]ready|\bvalidated\b|fabricable|single[- ]dose|medication[- ]safe", re.I)
NEGATION = re.compile(r"\b(not|no|never)\b", re.I)
TOKENS = re.compile(r"print_ready=false|fabricable_as_designed=false", re.I)
BLANK = "not validated \u2014 to be measured on a built rig"
RESULT_HEADERS = {"result", "measured", "within tolerance", "action", "observed", "recorded"}


def read(name):
    return (BUILD / name).read_text(encoding="utf-8")


def claim_violations(text):
    """(line number, sentence) for every claim phrase whose sentence has no negation."""
    found = []
    for no, line in enumerate(text.splitlines(), 1):
        for sentence in re.split(r"(?<=[.;!?])\s+", TOKENS.sub("", line)):
            if CLAIM.search(sentence) and not NEGATION.search(sentence):
                found.append((no, sentence.strip()))
    return found


@pytest.mark.parametrize("name", DOCS)
def test_each_document_exists_carries_the_posture_and_makes_no_claim(name):
    text = read(name)
    for needle in POSTURE:
        assert needle in text, (name, needle)
    assert claim_violations(text) == [], (name, claim_violations(text))


def test_claim_scanner_detects_unnegated_claim():
    text = read("print-list.md")
    plain = text.rstrip("\n") + "\nThis design is print-ready.\n"
    hits = claim_violations(plain)
    assert len(hits) == 1 and hits[0][0] == len(plain.splitlines()) and "print-ready" in hits[0][1]
    assert claim_violations(text.rstrip("\n") + "\nThis design is NOT print-ready.\n") == []


def _rows(text):
    rows, header = [], None
    for line in text.splitlines():
        if not line.startswith("|"):
            header = None
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", c) for c in cells):
            continue
        if header is None:
            header = [c.lower() for c in cells]
            continue
        rows.append(dict(zip(header, cells)))
    return rows


def test_measure_before_ordering_model_values_equal_the_viewer_spec():
    spec = load_spec()
    dims = {d["id"]: d["nominal"] for d in spec["dims"]}
    section = read("bought-parts.md").split("## Measure before ordering")[1]
    checked = 0
    for row in _rows(section):
        if "spec key" not in row:
            continue
        kind, _, key = row["spec key"].strip("`").partition(":")
        value = float(row["model value"])
        assert abs(value - (dims[key] if kind == "dims" else spec["g"][key])) < 1e-9, row
        checked += 1
    assert checked >= 20


def test_coupons_bench_steps_and_mode_b_rows_are_present():
    coupons = read("coupons.md")
    for n in range(1, 8):
        assert f"C-{n}" in coupons, n
    build_order = read("bench-build-order.md") + read("bench-home-index-test.md")
    for n in range(1, 12):
        assert re.search(rf"^\|\s*{n}\s*\|", build_order, re.M), f"bench step {n}"
    ratings = read("bench-home-index-test.md")
    for n in range(1, 7):
        assert f"ROT-R0{n}" in ratings, n
    assert "OPEN" in ratings and "coil release" in ratings.lower()


@pytest.mark.parametrize("name", DOCS)
def test_result_cells_are_blank_or_marked_not_validated(name):
    for row in _rows(read(name)):
        for header, cell in row.items():
            if header in RESULT_HEADERS:
                assert cell == "" or cell.lower() == BLANK, (name, header, cell)


def test_plan_counts_seven_coupons_and_records_risks():
    plan = (SPEC_DIR / "plan.md").read_text(encoding="utf-8")
    for no, line in enumerate(plan.splitlines(), 1):
        if re.search(r"superseded|supersedes|original note|original text|earlier text", line, re.I):
            continue
        assert "six coupons" not in line.lower() and "C-1..C-6" not in line, (no, line[:120])
    for risk in ("R13", "R14", "R17", "R18"):
        assert re.search(rf"\| {risk} \|.*RECORDED", plan), risk
    for risk in ("R10", "R15", "R16"):
        assert re.search(rf"\| {risk} \|.*(RESOLVED|Resolved)", plan), risk
