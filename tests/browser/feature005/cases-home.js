(function (root) {
  'use strict';
  var H = root.Feature005Harness, C = root.DispenserRotationController;

  function homeFor(options, calibrate) {
    var c = new C(options);
    c.home({ calibrate: calibrate === true });
    c.tick(1e6);
    return c;
  }
  function quarterDrift(c) {
    var a0 = c.snapshot().drum_angle_deg;
    H.go(c, 'blue');
    return H.wrap180(c.snapshot().drum_angle_deg - a0 - 90);
  }

  H.register('ROT-C06', 'unhomed refusal and station confirmation by home', function (ctx) {
    var c = new C(), s0 = c.snapshot(), r = c.requestIndex('blue');
    ctx.check('unhomed:index_refused', r.failed_rules.join(','), 'not_homed', r.verdict === 'refused' && r.failed_rules.join(',') === 'not_homed');
    ctx.check('unhomed:station_unconfirmed', String(s0.at_station) + '/' + s0.station_confirmed + '/' + s0.state, 'null/false/UNHOMED',
      s0.at_station === null && s0.station_confirmed === false && s0.state === 'UNHOMED');
    [0, 3, 90, 123.4, 200, 356.34, 359].forEach(function (start) {
      var h = homeFor({ initial_deg: start }), s = h.snapshot(), e = H.wrap180(s.drum_angle_deg);
      ctx.check('home:from_' + start + 'deg', s.state + '/' + s.at_station, 'HOMED_CONFIRMED/red', s.state === 'HOMED_CONFIRMED' && s.at_station === 'red');
      ctx.check('home:from_' + start + 'deg:error_deg', e, 0.5, Math.abs(e) <= 0.5);
    });
    var m = new C({ initial_deg: 123.4 });
    m.home();
    ctx.check('home:rotating_not_confirmed', m.tick(0.5).drum_state + '/' + m.snapshot().at_station, 'ROTATING/null',
      m.snapshot().drum_state === 'ROTATING' && m.snapshot().at_station === null && m.snapshot().state === 'HOMING');
    var rec = homeFor({}).snapshot().home;
    ctx.check('home:record', rec.edge + '/' + rec.home_offset_steps, 'ccw_rising/21', rec.edge === 'ccw_rising' && rec.home_offset_steps === 21 && rec.calibrated === false);
  });

  H.register('ROT-C06', 'steps_per_rev calibration', function (ctx) {
    [2048, 2037.9].forEach(function (actual) {
      var nominal = quarterDrift(homeFor({ actual_steps_per_rev: actual }));
      var expectedNominal = 512 * 360 / actual - 90;
      ctx.check('actual_' + actual + ':uncalibrated_quarter_drift_deg', nominal, expectedNominal, Math.abs(nominal - expectedNominal) < 0.01);
      var c = homeFor({ actual_steps_per_rev: actual }, true), s = c.snapshot(), n = s.steps_per_rev;
      ctx.check('actual_' + actual + ':measured_steps', n, actual, Math.abs(n - actual) <= 1 && s.home.calibrated === true);
      var ok = H.COLORS.every(function (color, k) { return c.stationSteps(color) === Math.round(k * n / 4) % n; });
      ctx.check('actual_' + actual + ':targets_round_k_n_over_4', ok, true, ok);
      var calibrated = quarterDrift(c);
      ctx.check('actual_' + actual + ':calibrated_quarter_drift_deg', calibrated, 0.2, Math.abs(calibrated) <= 0.2 && Math.abs(calibrated) <= Math.abs(nominal) + 1e-9);
    });
  });

  H.register('ROT-C06', 'home_not_found', function (ctx) {
    var c = new C({ initial_deg: 123.4 });
    c.injectFault('home_not_found');
    c.home();
    var s = c.tick(1e6);
    ctx.check('injected', s.state + '/' + (s.fault && s.fault.code), 'HARD_FAULT/home_not_found', s.state === 'HARD_FAULT' && s.fault.code === 'home_not_found' && s.fault.limit_steps === 2560);
    var r = c.requestIndex('blue');
    ctx.check('injected:index_refused', r.failed_rules.join(','), 'fault_active', r.verdict === 'refused' && r.failed_rules.join(',') === 'fault_active');
    c.reset();
    ctx.check('injected:reset_to_unhomed', c.snapshot().state, 'UNHOMED', c.snapshot().state === 'UNHOMED');
    var d = new C({ initial_deg: 123.4, home_search_limit_steps: 100 });
    d.home();
    var t = d.tick(1e6);
    ctx.check('search_limit_100_steps', t.fault && t.fault.code, 'home_not_found', t.state === 'HARD_FAULT' && t.fault.code === 'home_not_found' && t.drum_state === 'STILL');
  });
}(this));
