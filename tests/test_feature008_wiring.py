"""The wiring window draws everything from wiring-spec.js, so GPIO numbers exist in exactly one place (ASSUMED / NOT_VALIDATED)."""
import json
import re
from pathlib import Path

import pytest

VIS = Path(__file__).resolve().parents[1] / "docs" / "visualizer"


def _load(name):
    text = (VIS / name).read_text(encoding="utf-8")
    return json.loads(text[text.index("{"): text.rindex("}") + 1])


@pytest.fixture(scope="module")
def wiring():
    return _load("wiring-spec.js")


@pytest.fixture(scope="module")
def pins(wiring):
    return {f"{c['id']}.{p['id']}": (c, p) for c in wiring["components"] for p in c["pins"]}


def test_every_gpio_is_used_once_and_not_reserved(wiring):
    gpios = [s["gpio"] for s in wiring["signals"]]
    assert len(gpios) == len(set(gpios))
    reserved = {g for r in wiring["reserved_gpio"] for g in r["gpio"]}
    assert not reserved & set(gpios)
    assert not {p["gpio"] for p in wiring["planned_gpio"]} & set(gpios)


def test_signals_land_on_the_esp32_pin_with_the_same_gpio(wiring, pins):
    for s in wiring["signals"]:
        ends = [pins[s["from"]], pins[s["to"]]]
        esp = [(c, p) for c, p in ends if c["id"] == "esp32"]
        assert len(esp) == 1, s["id"]
        assert esp[0][1]["gpio"] == s["gpio"], s["id"]
        assert esp[0][1]["id"] == f"G{s['gpio']}"


def test_every_esp32_gpio_pin_is_wired_and_every_signal_pin_is_connected(wiring, pins):
    wired = {s["from"] for s in wiring["signals"] + wiring["links"]} | {s["to"] for s in wiring["signals"] + wiring["links"]}
    for key, (comp, pin) in pins.items():
        if pin["type"] == "signal":
            assert key in wired, key
        if comp["id"] == "esp32" and "gpio" in pin:
            assert key in wired, key


def test_power_pins_name_a_declared_net_and_a_source(wiring, pins):
    nets = {p["net"] for p in wiring["power"]}
    for key, (_, pin) in pins.items():
        if pin["type"] in ("power", "gnd"):
            assert pin["net"] in nets, key
    for p in wiring["power"]:
        assert p["source"] in pins


def test_hall_a3144_runs_on_5v_with_a_3v3_pull_up_on_the_signal(wiring, pins):
    assert pins["hall.VCC"][1]["net"] == "5V"
    assert any("3V3" in line for line in pins["hall.OUT"][0]["extra"])


def test_stepper_matches_the_viewer_half_step_readout(wiring):
    app = (VIS / "app.js").read_text(encoding="utf-8")
    assert f"HALF_STEPS_PER_REV={wiring['stepper']['half_steps_per_rev']}" in app
    assert len(wiring["stepper"]["sequence"]) == 8
    assert all(sum(row) in (1, 2) for row in wiring["stepper"]["sequence"])
    assert wiring["hall"]["home_window_rad"] == 0.07 and "home=a<.07" in app


def test_every_viewer_electronic_label_has_a_wiring_component(wiring):
    spec = _load("rotation-spec.js")
    labels = spec["electronicLabels"] + ["USB-C 5 V inlet"]
    viewer = {c["viewer_label"] for c in wiring["components"]}
    for label in labels:
        assert label in viewer, label
    for part in ("S1", "S2"):
        assert any(v.startswith(f"Micro servo {part}") for v in viewer)


def test_wiring_page_has_no_hard_coded_gpio_numbers():
    for name in ("wiring.js", "wiring.html"):
        text = (VIS / name).read_text(encoding="utf-8")
        assert not re.search(r"GPIO\s*\d", text), name
    html = (VIS / "wiring.html").read_text(encoding="utf-8")
    assert html.index("wiring-spec.js") < html.index("wiring.js")
    for src in re.findall(r'<script[^>]+src="([^"]+)"', html):
        assert not src.startswith(("http:", "https:", "//")), src


def test_viewer_switches_between_mechanism_and_wiring_in_the_same_window():
    index = (VIS / "index.html").read_text(encoding="utf-8")
    app = (VIS / "app.js").read_text(encoding="utf-8")
    for value in ("mechanism", "wiring"):
        assert f'name="viewMode" value="{value}"' in index
    for value in ("wiring3d", "wiringlayout", "wiring2d"):  # the three wiring views are switched from the side panel
        assert f'name="wiringStyle" value="{value}"' in index
    assert index.index('name="wiringStyle"') > index.index('id="wiringPanel"')
    assert 'id="wiringFrame"' in index and 'id="wiringHud"' in index
    assert "window.open" not in app and "openWiring" not in index
    for script in ("wiring-spec.js", "wiring-model.js", "wiring-3d.js", "wiring-layout3d.js"):
        assert index.index(script) < index.index("reference-look.js"), script
    assert "wiring.html?embed=1" in app and "postMessage" in app


def test_3d_harness_reads_every_pin_from_the_spec(wiring):
    js = (VIS / "wiring-3d.js").read_text(encoding="utf-8")
    assert not re.search(r"GPIO\s*\d", js)
    assert "W.signals" in js and "W.links" in js and "W.power" in js
    assert "http://" not in js and "https://" not in js


def test_s1_cable_passes_the_deck_through_a_hole_in_every_layer():
    g = _load("rotation-spec.js")["g"]
    hole = g["s1_cable_hole"]
    assert min(hole[1] - hole[0], hole[3] - hole[2]) >= 6.0
    for layer in g["deck_layers"]:
        assert hole in layer["holes"]
    # the hole stays inside the deck disc and clear of the pill chute
    cx, cy = g["axle"]
    far = max(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 for x in hole[:2] for y in hole[2:])
    assert far < g["platform_r"]
    chute = g["chute"]
    assert hole[1] < chute["x"][0] or hole[0] > chute["x"][1] or hole[3] < chute["y"][0] or hole[2] > chute["y"][1]


def test_locked_demo_controller_is_untouched():
    import hashlib

    blob = (VIS / "demo-controller.js").read_bytes()
    assert hashlib.sha1(blob).hexdigest() == "0c8396023ca6fc85cb135fbbf58ea39e903cee11"


def test_layout_3d_places_exactly_the_spec_components_and_hard_codes_no_gpio(wiring):
    js = (VIS / "wiring-layout3d.js").read_text(encoding="utf-8")
    assert not re.search(r"GPIO\s*\d", js)
    block = js[js.index("var K = {"): js.index("var STUB")]
    placed = set(re.findall(r"^\s{4}(\w+): \{ c:", block, re.M))
    assert placed == {c["id"] for c in wiring["components"]}
    for name in ("W.signals", "W.links", "W.power"):
        assert name in js


def test_every_part_and_wire_belongs_to_a_known_filter_group(wiring):
    ids = {g["id"] for g in wiring["groups"]} | {"core"}
    assert {"rotation", "blades", "tongue", "scanner", "power"} <= ids
    for item in wiring["components"] + wiring["signals"] + wiring["links"]:
        assert item["group"] in ids, item["id"]
    assert [c["group"] for c in wiring["components"] if c["id"] == "esp32"] == ["core"]


def test_side_panel_has_the_filter_and_a_pin_table():
    index = (VIS / "index.html").read_text(encoding="utf-8")
    assert 'id="wiringSystems"' in index and 'id="pinTableRows"' in index
    assert index.index('id="wiringPanel"') < index.index('class="control-section housing-section"')
    app = (VIS / "app.js").read_text(encoding="utf-8")
    assert "setGroups" in app and "dispenser-viewer-filter" in app


def test_panel_sections_collapse_and_wiring_filter_fades_by_default():
    index = (VIS / "index.html").read_text(encoding="utf-8")
    app = (VIS / "app.js").read_text(encoding="utf-8")
    assert 'id="panelExpand"' in index and 'id="panelCollapse"' in index and 'id="wiringHide"' in index
    assert "panel-tab" not in index and "setSectionOpen" in app
    for name in ("wiring-3d.js", "wiring-layout3d.js"):
        js = (VIS / name).read_text(encoding="utf-8")
        assert "hideOthers" in js and "fadeMat" in js, name


def test_scene_has_camera_presets_pan_and_reset():
    index = (VIS / "index.html").read_text(encoding="utf-8")
    app = (VIS / "app.js").read_text(encoding="utf-8")
    for cam in ("iso", "front", "side", "top", "back", "in", "out", "reset"):
        assert f'data-cam="{cam}"' in index
    for needle in ("function flyTo", "setCamHome", "contextmenu", "dblclick", "e.shiftKey"):
        assert needle in app, needle


def test_boards_fade_by_system_as_soon_as_the_wiring_view_opens():
    w3d = (VIS / "wiring-3d.js").read_text(encoding="utf-8")
    app = (VIS / "app.js").read_text(encoding="utf-8")
    look = (VIS / "reference-look.js").read_text(encoding="utf-8")
    assert "setPartsLive" in w3d and "var on = groupOn(g) || !partsLive, hi = on && hot;" in w3d
    assert "api.setPartsLive(true)" in app and "api.setPartsLive(false)" in app
    assert "wiring3d.reapply()" in look  # the part-type filter never leaves a faded board solid again
    assert "setGhostOpacity(.03)" in app and "setGhostOpacity(.07)" in app


def test_placed_containers_follow_the_lifted_or_exploded_cartridge():
    app = (VIS / "app.js").read_text(encoding="utf-8")
    look = (VIS / "reference-look.js").read_text(encoding="utf-8")
    assert "look.cartridgeOffset(color)" in app
    assert "cartridgeOffset: function (c)" in look and "cgByColor[c].position.y - cgBase[c].y" in look


def test_exploded_view_flies_the_camera_back_far_enough_for_the_whole_stack():
    app = (VIS / "app.js").read_text(encoding="utf-8")
    assert "flyTo({y:98,radius:Math.max(orbit.radius,610)})" in app


def test_picked_boards_glow_and_get_an_xray_outline_when_the_filter_is_narrowed():
    w3d = (VIS / "wiring-3d.js").read_text(encoding="utf-8")
    assert "function narrowed()" in w3d and "depthTest: false" in w3d and "wfLit" in w3d and "outline(o, hi && o.visible)" in w3d


def test_wiring_view_ignores_mechanism_filters_and_gives_them_back():
    app = (VIS / "app.js").read_text(encoding="utf-8")
    for needle in ("function captureMech()", "function wiringBaseline()", "function restoreMech(s)", "look.setHousingMode('assembled')",
                   "look.selectPrintJob(null)", "setBox(mechanismToggle,true)"):
        assert needle in app, needle
    enter = app[app.index("function enterWiring3d()"): app.index("function leaveWiring3d()")]
    assert "captureMech()" in enter and "wiringBaseline()" in enter
    assert "restoreMech(s.mech)" in app[app.index("function leaveWiring3d()"): app.index("// Side panel: every section")]
    layout = app[app.index("function enterWiringLayout()"): app.index("function setViewMode")]
    assert "captureMech()" in layout and "restoreMech(s.mech)" in layout


def test_upper_blade_slides_with_the_controller_blade_state():
    look = (VIS / "reference-look.js").read_text(encoding="utf-8")
    assert "tw.blade.position.z = z" in look and "XA + STROKE * b" in look and "setSpring(tw.spring, z + SPRING_OFF)" in look


def test_wiring_filter_filters_wires_and_dims_other_parts_but_never_hides_them():
    app = (VIS / "app.js").read_text(encoding="utf-8")
    w3d = (VIS / "wiring-3d.js").read_text(encoding="utf-8")
    lay = (VIS / "wiring-layout3d.js").read_text(encoding="utf-8")
    assert "o.visible = o.userData.wfVis;" in w3d  # parts of other systems stay in place
    assert "o.visible = true; fadePart(o, on, on && hot);" in lay
    assert "(on || !hideOthers)" in w3d and "(on || !hideOthers)" in lay  # only wires disappear
    assert "wiringGroups=checked.length?checked:null" in app  # nothing ticked is the normal view
    assert "focusWiring" not in app  # the filter never moves the camera
