(function (root) {
  'use strict';

  function byId(items) {
    var result = {};
    items.forEach(function (item) { result[item.id || item.component_id || item.recipe_id] = item; });
    return result;
  }

  function build(data) {
    var dimensions = byId(data.dimensions || []);
    var recipes = byId(data.component_recipes || []);
    var components = byId(data.components || []);
    var annotations = [];

    function add(sourceId, group, componentId, label, anchor, axis, fallback, suffix) {
      var source = dimensions[sourceId];
      var value = source ? source.value : fallback;
      var provenance = source ? source.provenance : 'ASSUMED';
      var unit = source ? source.unit : 'mm';
      var caveat = source ? (source.caveat || (source.value === null ? 'UNSPECIFIED: ' + (source.reason || 'No numeric value supplied.') : '')) : 'Documented concept recipe value; NOT VALIDATED.';
      annotations.push({
        id: sourceId + ':' + componentId,
        sourceId: sourceId,
        group: group,
        componentId: componentId,
        color: components[componentId] && components[componentId].color || null,
        label: label,
        value: value,
        unit: unit,
        provenance: provenance,
        verificationStatus: source ? source.verification_status : 'NOT_VALIDATED',
        caveat: caveat,
        anchor: anchor.slice(),
        axis: axis.slice(),
        suffix: suffix || ''
      });
    }

    add('station.footprint_x', 'station', 'station-housing', 'Housing X', [0, 0, -4], [1, 0, 0]);
    add('station.footprint_y', 'station', 'station-housing', 'Housing Y', [0, 0, -4], [0, 1, 0]);
    add('post.radius', 'post-drum', 'central-post', 'Post radius', [0, 0, 46], [1, 0, 0]);
    add('post.height', 'post-drum', 'central-post', 'Post height', [3, 0, 0], [0, 0, 1]);
    add('drum.outer_radius', 'post-drum', 'rotating-drum', 'Drum outer radius', [9, 0, 25], [1, 0, 0]);
    add('recipe:drum.height', 'post-drum', 'rotating-drum', 'Drum height', [11, 0, 25], [0, 0, 1], recipes.drum.parameters.height, '42; recipe-defined, assumed concept envelope');
    ['red', 'blue', 'green', 'orange'].forEach(function (color) {
      var cartridgeId=color+'-cartridge',cartridge=components[cartridgeId],capId=color+'-cap';
      add('cartridge.radial_position', 'cartridge-channel-cap', cartridgeId, 'Cartridge radial position', cartridge.position, [0, 1, 0]);
      add('station.channel_xy', 'cartridge-channel-cap', cartridgeId, 'Channel X × Y', cartridge.position.map(function(v,i){return v+(i===2?4:0);}), [1, 0, 0], null, '10.8 × 8.4');
      add('recipe:cartridge.size', 'cartridge-channel-cap', cartridgeId, 'Cartridge envelope', cartridge.position.map(function(v,i){return v+(i===2?8:0);}), [1, 0, 0], recipes.cartridge.parameters.size, '12.8 × 10.4 × 40');
      add('recipe:cap.size', 'cartridge-channel-cap', capId, 'Cap envelope', components[capId].position, [1, 0, 0], recipes.cap.parameters.size, '13 × 12 × 2');
    });

    ['red', 'blue', 'green', 'orange'].forEach(function (color) {
      var bladeId = color + '-upper-blade-tab';
      var station=color.toUpperCase()+' ';
      add('blade.profile', 'upper-blade', bladeId, station+'blade W × L × T', components[bladeId].position, [1, 0, 0], null, '10.5 × 22 × 1');
      add('blade.top_wedge', 'upper-blade', bladeId, station+'top wedge start → end / length', components[bladeId].position.map(function (v, i) { return v + (i === 2 ? 4 : 0); }), [0, 0, 1], null, '0.3 → 1 / 2.6');
      add('blade.tip_travel', 'upper-blade', bladeId, station+'blade local-Y endpoints', components[bladeId].position.map(function (v, i) { return v + (i === 2 ? 8 : 0); }), [0, 1, 0], null, '−5.2 → +5.2; stroke 10.4');
    });
    add('tongue.length', 'lower-tongue', 'shared-lower-tongue', 'Tongue length', [0, -21, -2], [0, 1, 0], null, 'Source labels a perpendicular gate direction; modeled local Y per user clarification');
    add('tongue.floor_z', 'lower-tongue', 'shared-lower-tongue', 'Floor Z bounds', [0, -21, -6], [0, 0, 1], null, '−1.5..0');
    add('tongue.edge_positions', 'lower-tongue', 'shared-lower-tongue', 'Tongue edge endpoints', [0, -21, 2], [0, 1, 0], null, '+5.7 → −5.7');
    add('tongue.y_travel', 'lower-tongue', 'shared-lower-tongue', 'Tongue Y travel', [0, -21, 6], [0, 1, 0]);
    add('pin.diameter', 'pin-slot', 'engagement-pin', 'Pin diameter', [0, -31.8, 15], [1, 0, 0]);
    add('pin.stroke', 'pin-slot', 'engagement-pin', 'Pin stroke', [0, -31.8, 12], [0, 0, 1]);
    add('pin.slot', 'pin-slot', 'red-upper-blade-tab', 'Pull-tab slot', [0, -31.8, 9], [1, 0, 0], null, '5 × 4');
    add('servo.crank_radius', 'actuator-linkage', 'servo-crank', 'Crank radius', [6, -54, 15], [1, 0, 0]);
    add('servo.connecting_rod_length', 'actuator-linkage', 'connecting-rod', 'Connecting rod length', [0, -37, 24], [0, 1, 0]);
    add('carriage.stroke', 'actuator-linkage', 'pin-carriage', 'Carriage stroke', [0, -31.8, 28], [1, 0, 0]);
    add('servo.pivot_y', 'actuator-linkage', 'servo-unit', 'Pivot Y', [3, -54, 11], [0, 1, 0]);
    add('servo.pivot_z', 'actuator-linkage', 'servo-unit', 'Pivot Z ≈', [5, -54, 11], [0, 0, 1]);
    add('station.outlet_aperture', 'outlet-tray', 'outlet-tray', 'Outlet aperture X × Y', [0, -13, -7], [1, 0, 0], null, '11.8 × 9.4; axis assignment unverified');
    add('tray.approximate_size', 'outlet-tray', 'outlet-tray', 'Tray footprint ≈', [0, -17, -16], [1, 0, 0], null, '40 × 50; reduced from inferred 58 to clear the stepper drive shaft');
    add('tray.height', 'outlet-tray', 'outlet-tray', 'Tray height', [0, -17, -19], [0, 0, 1], null, 'UNSPECIFIED');

    annotations.forEach(function (item) {
      item.numeric = item.value !== null && item.value !== undefined;
      if (!item.numeric) item.value = null;
      if (item.verificationStatus !== 'NOT_VALIDATED') item.verificationStatus = 'NOT_VALIDATED';
      if (!item.caveat) item.caveat = 'Concept value only; NOT VALIDATED and not a manufacturing tolerance.';
    });
    return annotations;
  }

  root.DispenserDimensionAnnotations = Object.freeze({ build: build });
}(typeof window !== 'undefined' ? window : this));
