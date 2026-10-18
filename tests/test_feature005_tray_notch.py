"""Single-hole pill exit: deck hole (covered by the tongue gate), short chute, hole in the base tray, three feet (ASSUMED /
NOT_VALIDATED; canonical tray untouched)."""
import math

from feature005_spec import G, Item, clearance, drum_items, rect, viewer_tray_boxes


def test_chute_runs_straight_from_the_deck_hole_to_the_floor_hole():
    g = G()
    c, fh = g["chute"], g["floor_hole"]
    assert c["z1"] == -3.0 and c["z0"] == g["base_z1"]  # deck underside to tray floor
    pill = (10.0, 7.0)  # the fictional pill, lying flat
    assert fh["x"][1] - fh["x"][0] >= pill[0] + 1.0 and fh["y"][1] - fh["y"][0] >= pill[1] + 1.0
    assert c["x"][0] <= fh["x"][0] and fh["x"][1] <= c["x"][1] and c["y"][0] <= fh["y"][0] and fh["y"][1] <= c["y"][1]  # the floor hole sits inside the chute
    hole = [h for layer in g["deck_layers"] for h in layer["holes"] if h[0] < 0 < h[1] and h[2] < 0 < h[3]]
    assert hole and all(h[1] - h[0] >= pill[0] + 0.5 and h[3] - h[2] >= pill[1] + 0.5 for h in hole)


def test_feet_lift_the_tray_so_the_pill_can_leave_and_clear_the_screw_heads():
    g = G()
    f = g["feet"]
    assert g["table_z"] == g["base_z0"] - f["h"] and f["h"] >= 8.0
    ay = g["axle"][1]
    for a in f["angles"]:
        fx, fy = f["r"] * math.cos(math.radians(a)), ay + f["r"] * math.sin(math.radians(a))
        assert math.hypot(fx, fy - ay) + f["rad"] <= g["base_r"]
        assert math.hypot(fx, fy) > g["floor_hole"]["x"][1] + f["rad"]  # clear of the exit hole
        for b in g["base_screws"]["angles"]:
            bx, by = g["base_screws"]["r"] * math.cos(math.radians(b)), ay + g["base_screws"]["r"] * math.sin(math.radians(b))
            assert math.hypot(fx - bx, fy - by) > f["rad"] + g["base_screws"]["head_r"]


def test_chute_clears_the_coupler_and_the_stepper():
    g = G()
    coupler = next(d for d in drum_items(g) if d.name == "coupler")
    for i, b in enumerate(viewer_tray_boxes()):
        assert clearance(coupler, Item(f"chute{i}", rect(b[0], b[1], b[2], b[3]), b[4], b[5])) >= 0.5, i
        my, mr = g["axle"][1] + g["motor_offset_y"], g["motor_body_r"]
        nx, ny = min(max(0, b[0]), b[1]), min(max(my, b[2]), b[3])
        assert math.hypot(nx, ny - my) >= mr + 0.5
