from pathlib import Path

VIEWER = Path(__file__).resolve().parents[1] / "docs" / "visualizer"


def test_rotation_parts_only_view_is_wired_and_leaves_controller_untouched():
    html = (VIEWER / "index.html").read_text(encoding="utf-8")
    app = (VIEWER / "app.js").read_text(encoding="utf-8")
    look = (VIEWER / "reference-look.js").read_text(encoding="utf-8")
    controller = (VIEWER / "demo-controller.js").read_text(encoding="utf-8")
    for element_id in ("rotationOnlyToggle", "rotationPanel", "rotationSpin90", "rotationSpin360", "rotationHome",
                       "rotAngle", "rotSteps", "rotHome", "rotationPartsList"):
        assert f'id="{element_id}"' in html
    assert "setRotationView" in look and "rotationPart" in look
    assert "setRotationOnly" in app and "advanceRotationPreview" in app
    assert 'src="rotation-spec.js"' in html and html.index("rotation-spec.js") < html.index("reference-look.js")
    assert "renderRotationDimensions" in app and "setRotationDimensions" in look
    assert "rotationPreview" not in controller


def test_rotation_parts_are_labelled_printed_or_bought():
    look = (VIEWER / "reference-look.js").read_text(encoding="utf-8")
    for label in ("Drum hub + socket decks", "D-flat rod 5 mm", "Flexible coupler", "Bearing 625ZZ", "Bearing seat",
                  "Thrust ring (PTFE)", "28BYJ-48 stepper", "Stepper mount", "Home magnet 3x1 mm",
                  "Hall sensor A3144", "ULN2003 driver board", "ESP32 controller"):
        assert f"'{label}', '" in look
    assert "'printed'" in look and "'bought'" in look


def test_step_by_step_animation_player_is_wired_and_leaves_controller_untouched():
    html = (VIEWER / "index.html").read_text(encoding="utf-8")
    app = (VIEWER / "app.js").read_text(encoding="utf-8")
    player = (VIEWER / "step-animations.js").read_text(encoding="utf-8")
    assert "Step-by-step Animation" in html
    for element_id in ("stepAnimSelect", "stepAnimColor", "stepAnimBack", "stepAnimNext", "stepAnimPlay", "stepAnimRestart", "stepAnimSteps"):
        assert f'id="{element_id}"' in html
    assert html.index("app.js") < html.index("step-animations.js")
    assert "DispenserStepHost" in app and "DispenserStepAnimations" in app
    for animation in ("load", "dispense", "exchange", "schedule", "rotate", "removal", "blade"):
        assert f"id: '{animation}'" in player
    assert "feature004" not in player.lower()
    assert "sha1" not in player


def test_print_view_groups_every_printed_part_into_one_piece_or_separate_jobs():
    import json
    import re

    html = (VIEWER / "index.html").read_text(encoding="utf-8")
    look = (VIEWER / "reference-look.js").read_text(encoding="utf-8")
    spec_text = (VIEWER / "rotation-spec.js").read_text(encoding="utf-8")
    spec = json.loads(re.sub(r"^window\.DispenserRotationSpec\s*=\s*", "", spec_text.strip()).rstrip(";"))
    assert 'name="partType"' in html and 'id="printGroupsList"' in html and 'id="printPlatesBtn"' in html
    assert 'printOnlyToggle' not in html  # the print view is a part-type filter, not a subsystem
    jobs = spec["printJobs"]
    assert {j["mode"] for j in jobs} == {"one", "separate"}
    assert sum(j["qty"] for j in jobs if j["mode"] == "one") == 13
    assert sum(j["qty"] for j in jobs if j["mode"] == "separate") == 15
    covered = {label for j in jobs for label in j["labels"]}
    printed = set(re.findall(r"rtag\([^;]*?'([^']+)', 'printed'", look))
    assert printed <= covered, printed - covered


def test_electronic_components_are_listed_and_everything_else_is_hardware_or_printed():
    import json
    import re

    spec_text = (VIEWER / "rotation-spec.js").read_text(encoding="utf-8")
    look = (VIEWER / "reference-look.js").read_text(encoding="utf-8")
    spec = json.loads(re.sub(r"^window\.DispenserRotationSpec\s*=\s*", "", spec_text.strip()).rstrip(";"))
    bought = set(re.findall(r"'([^']+)', 'bought'", look))
    assert set(spec["electronicLabels"]) <= bought
    assert {"Hall sensor A3144", "28BYJ-48 stepper", "ULN2003 driver board", "ESP32 controller"} == set(spec["electronicLabels"])
