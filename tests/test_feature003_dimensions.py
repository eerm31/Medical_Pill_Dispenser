from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
VIEWER = ROOT / "docs" / "visualizer"
SOURCE = ROOT / "src" / "dispenser_sim" / "viz3d" / "concept_geometry.json"


def test_main_viewer_can_hide_dispensing_mechanism_without_hiding_scanner():
    html = (VIEWER / "index.html").read_text(encoding="utf-8")
    app = (VIEWER / "app.js").read_text(encoding="utf-8")
    assert 'id="mechanismToggle" type="checkbox" checked> Subsystem 1: Dispensing mechanism' in html
    assert 'id="rotationOnlyToggle" type="radio" name="subsystemView" autocomplete="off"> Rotation mechanism' in html
    assert 'id="scannerSubsystemToggle" type="checkbox" checked> Subsystem 2: Barcode scanner' in html
    assert "mechanismToggle.addEventListener('change',function(){setDispensingMechanismVisibility(mechanismToggle.checked);});" in app
    assert "function setDispensingMechanismVisibility(visible){mechanismVisible=Boolean(visible);if(mechanismGroup)mechanismGroup.visible=mechanismVisible;}" in app
    assert "mechanismGroup.add(dimensionGroups.fixed)" in app
    assert "fixedAssemblyGroup.add(mechanismGroup)" in app
    assert "fixedAssemblyGroup.add(scannerGroup)" in app
    assert "mechanismVisible:mechanismGroup.visible,scannerVisible:scannerVisible" in app


def test_tongue_return_spring_tracks_the_y_stroke_and_housing_reaction_seat():
    app = (VIEWER / "app.js").read_text(encoding="utf-8")
    assert "var spring=componentMap['tongue-return-spring']" in app
    assert "spring_center_fallback_mm" in app
    assert "spring_axis_canonical" in app
    assert "spring_end_seat_offsets_mm" in app
    assert "A–K spring lengths are historical and are not used as the current lower-plunger spring endpoints" in app
    assert "window.dispenserSceneQA.tongueSpringState=function()" in app
    assert "springCenterFallbackMm" in app
    assert "sourcePositionMm:null" in app
    assert "closed_length_mm\":21.7" in (SOURCE.read_text(encoding="utf-8"))
    assert "open_length_mm\":10.3" in (SOURCE.read_text(encoding="utf-8"))


def test_dimension_overlay_control_is_default_off_and_only_controls_overlay():
    html = (VIEWER / "index.html").read_text(encoding="utf-8")
    app = (VIEWER / "app.js").read_text(encoding="utf-8")
    assert 'id="dimensionsToggle"' in html
    assert 'id="dimensionsToggle" type="checkbox">' in html
    assert 'id="dimensionCategory"' in html
    assert 'id="dimensionCategoryRow"' in html
    assert 'id="dimensionDetails"' in html
    for color in ("red", "blue", "green", "orange"):
        assert f'value="upper-blade-{color}"' in html
        assert f'value="cartridge-channel-cap-{color}"' in html
    assert 'value="pin-slot-red"' in html
    assert "dimensionGroups.fixed.visible=dimensionsToggle.checked" in app
    assert "dimensionGroups.rotating.visible=dimensionsToggle.checked" in app
    assert "dimensionsToggle.addEventListener('change'" in app
    assert "controller." not in app.split("dimensionsToggle.addEventListener('change'", 1)[1].split("});", 1)[0]
    assert "DispenserDimensionAnnotations" in app
    assert "dimensionDetails" in app
    assert "makeDimensionValueLabel" in app
    assert "new THREE.Sprite" in app
    assert "dimension value label" in app
    assert "addDimensionSegment(annotation,start,end" in app
    assert "new THREE.BufferGeometry().setFromPoints([start,end])" in app
    assert "new THREE.LineSegments(geometry,new THREE.LineBasicMaterial" in app
    assert "linewidth:1" in app
    assert "new THREE.CylinderGeometry(radius,radius,length,8)" not in app
    assert "dimension segment · " in app
    assert "visibleDimensionSegments" in app
    assert "visibleGuideSegments" in app
    assert "arrowhead" not in app and "end tick" not in app
    assert "new THREE.Vector3(-axis.y,axis.x,0)" not in app
    assert "guide line" in app
    assert "callout.y=58+layoutIndex*2.5" in app
    assert "callout.x+=" not in app and "callout.z+=" not in app
    assert "valueLabel.position.copy(callout)" in app
    assert "anchor,callout,item.label+' guide line'" in app
    assert "item.label+' guide line',0xb9c3cf" in app
    assert "item.label,0xe8edf3" in app
    assert "if(object.isLineSegments&&object.name.indexOf('dimension segment')===0)" in app
    assert "category==='pin-slot')return item.group==='pin-slot'&&!item.color" in app
    assert "setDimensionCategory(dimensionCategory.value)" in app
    assert "renderDimensionDetails()" in app


def test_dimension_annotation_catalog_uses_only_canonical_records_and_recipes():
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    catalog_path = VIEWER / "dimension-annotations.js"
    catalog = catalog_path.read_text(encoding="utf-8")
    dimensions = {item["id"]: item for item in source["dimensions"]}
    recipes = {item["recipe_id"]: item for item in source["component_recipes"]}

    expected_dimension_ids = {
        "station.footprint_x", "station.footprint_y", "post.radius", "post.height",
        "drum.outer_radius", "cartridge.radial_position", "station.channel_xy",
        "blade.profile", "blade.top_wedge", "blade.tip_travel", "tongue.length",
        "tongue.edge_positions", "tongue.floor_z", "tongue.y_travel", "pin.diameter",
        "pin.stroke", "pin.slot", "servo.crank_radius", "servo.connecting_rod_length",
        "servo.pivot_y", "servo.pivot_z", "station.outlet_aperture", "tray.approximate_size",
        "tray.height",
    }
    assert expected_dimension_ids <= dimensions.keys()
    assert 'data.dimensions' in catalog
    assert "component_recipes" in catalog
    assert "getBoundingBox" not in catalog and "Box3" not in catalog
    for value in ("station-housing", "central-post", "rotating-drum", "shared-lower-tongue", "engagement-pin", "servo-crank", "connecting-rod", "outlet-tray"):
        assert value in catalog, f"dimension annotation target missing: {value}"
    assert "['red', 'blue', 'green', 'orange']" in catalog
    assert "color+'-cartridge'" in catalog and "color + '-upper-blade-tab'" in catalog
    assert recipes["cartridge"]["parameters"]["size"] == [12.4, 14.8, 40]
    assert recipes["cartridge-recipe-fr031"]["parameters"]["size"] == [12.8, 10.4, 40]
    assert recipes["cap"]["parameters"]["size"] == [13, 12, 2]
    assert dimensions["tray.height"]["value"] is None
    assert all(item["verification_status"] == "NOT_VALIDATED" for item in dimensions.values())
    assert len(source["components"]) == source["export"]["physical_component_count"] == 52


def test_dimension_overlay_control_and_catalog_are_local_browser_scripts():
    html = (VIEWER / "index.html").read_text(encoding="utf-8")
    test_html = (ROOT / "tests" / "browser" / "index.html").read_text(encoding="utf-8")
    assert 'src="dimension-annotations.js"' in html
    assert 'src="../../docs/visualizer/dimension-annotations.js"' in test_html
    assert "Show dimensions" in html
    assert "NOT VALIDATED" in html


def test_sc029_browser_renders_integrated_recipe_submeshes_with_canonical_transforms():
    app = (VIEWER / "app.js").read_text(encoding="utf-8")
    assert "function addIntegratedSubmeshes" in app
    assert "recipe.integrated_submeshes" in app
    assert "integrated submesh · " in app
    assert "feature.position_mm" in app
    assert "mappedRotation(feature.rotation_rad" in app
    assert "feature.owner_component_id" in app
    assert "integratedSubmeshMeshes" in app
    assert "lower-tongue-moving-carriage" in app
    assert "tongue-return-fixed-bracket" in app


def test_selected_dimension_values_are_labelled_on_the_3d_measurement_lines():
    app = (VIEWER / "app.js").read_text(encoding="utf-8")
    assert "makeDimensionValueLabel" in app
    assert "new THREE.Sprite" in app
    assert "formatDimensionValue(item)" in app
    assert "dimension value label" in app
