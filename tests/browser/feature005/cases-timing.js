(function (root) {
  'use strict';
  var H = root.Feature005Harness, C = root.DispenserRotationController;

  function duration(c, color) {
    var n = 0;
    c.requestIndex(color);
    while (c.snapshot().drum_state === 'ROTATING' && n < 20000) { c.tick(0.001); n += 1; }
    return n * 0.001;
  }
  function expectedHardware(rad) { return 0.4 + (rad - 0.16) / 0.8; }
  function newTrace(c, from) { return c.snapshot().trace.slice(from).join(' | '); }

  H.register('ROT-C07', 'motion profile durations', function (ctx) {
    var q = expectedHardware(Math.PI / 2), half = expectedHardware(Math.PI), simQ = (Math.PI / 2) / 1.3;
    var a = duration(H.homed(), 'blue');
    ctx.check('hardware:quarter_s', a, q, Math.abs(a - q) <= 0.002);
    var b = duration(H.homed(), 'green');
    ctx.check('hardware:half_turn_s', b, half, Math.abs(b - half) <= 0.002);
    var s = duration(H.homed({ profile: 'sim' }), 'blue');
    ctx.check('sim:quarter_s', s, simQ, Math.abs(s - simQ) <= 0.002);
  });

  H.register('ROT-C07', 'no skipped state under a large time step', function (ctx) {
    ['blue', 'green', 'orange'].forEach(function (color) {
      var big = H.homed(), small = H.homed(), n0 = big.snapshot().trace.length, k;
      big.requestIndex(color);
      var s = big.tick(1e9);
      small.requestIndex(color);
      for (k = 0; k < 4000 && small.snapshot().drum_state === 'ROTATING'; k++) small.tick(0.37);
      var t = newTrace(big, n0);
      var order = /^index:red>[a-z]+:unidirectional( \| segment:(cw|ccw):\d+)+ \| state:HOMED_CONFIRMED:[a-z]+$/.test(t) && (t.match(/state:/g) || []).length === 1;
      ctx.check('red->' + color + ':trace', t, 'index, segment(s), one state entry in order', order);
      var u = small.snapshot();
      ctx.check('red->' + color + ':same_result_as_small_steps', s.at_station + '/' + s.step_position, u.at_station + '/' + u.step_position,
        s.at_station === color && H.snap(s.last_move) === H.snap(u.last_move) && s.drum_angle_deg === u.drum_angle_deg);
    });
    var c = H.homed();
    c.requestIndex('orange');
    c.tick(1e9);
    var cw = c.snapshot().last_move.planned_path_deg;
    ctx.check('red->orange:cw_then_ccw_overshoot', cw.join(','), 'about -93,3 (rounded to whole steps)',
      cw.length === 2 && cw[0] < 0 && Math.abs(cw[1] - 3) < 0.1 && Math.abs(cw[0] + cw[1] + 90) < 1e-6);
  });

  H.register('ROT-C07', 'direction policy and wrapping', function (ctx) {
    [['red', 0, 'green', 180], ['blue', 90, 'orange', 270], ['green', 180, 'red', 0], ['orange', 270, 'blue', 90]].forEach(function (t) {
      ['unidirectional', 'shortest'].forEach(function (policy) {
        var p = C.planRotation(t[1], t[3], policy);
        ctx.check(t[0] + '->' + t[2] + ':' + policy + ':tie_ccw', p.segments.join(','), '180', p.segments.length === 1 && p.segments[0] === 180);
      });
    });
    var cw = C.planRotation(0, 270), sh = C.planRotation(0, 270, 'shortest'), ccw = C.planRotation(270, 0);
    ctx.check('unidirectional:cw_needs_overshoot', cw.segments.join(','), '-93,3', cw.segments.join(',') === '-93,3');
    ctx.check('shortest:cw_direct', sh.segments.join(','), '-90', sh.segments.join(',') === '-90');
    ctx.check('wrap:270->0_is_ccw_90', ccw.segments.join(','), '90', ccw.segments.join(',') === '90');
    ctx.check('wrap:370->10_is_zero', C.planRotation(370, 10).segments.length, 0, C.planRotation(370, 10).segments.length === 0);
    ctx.check('default_policy', H.homed().snapshot().policy, 'unidirectional', H.homed().snapshot().policy === 'unidirectional');
    var c = H.homed(), lo = 1000, hi = -1, i;
    c.requestIndex('orange');
    for (i = 0; i < 200 && c.snapshot().drum_state === 'ROTATING'; i++) {
      c.tick(0.05);
      lo = Math.min(lo, c.snapshot().drum_angle_deg);
      hi = Math.max(hi, c.snapshot().drum_angle_deg);
    }
    ctx.check('angle_range_during_wrap', lo + '..' + hi, '[0, 360)', lo >= 0 && hi < 360);
    ctx.check('lost_motion_model', C.lostMotionError(1, 1) + '/' + C.lostMotionError(-1, 1), '0/-1', C.lostMotionError(1, 1) === 0 && C.lostMotionError(-1, 1) === -1);
  });

  H.register('ROT-C08', 'readouts and pin/gate permission gating', function (ctx) {
    var c = H.homed(), s = c.snapshot();
    ['at_station', 'drum_state', 'sequence_active', 'lift_in_progress', 'pin_gate_allowed'].forEach(function (key) {
      ctx.check('readout:' + key, key in s, true, key in s);
    });
    ctx.check('still:red', s.at_station + '/' + s.drum_state + '/' + s.sequence_active + '/' + s.pin_gate_allowed, 'red/STILL/false/true',
      s.at_station === 'red' && s.drum_state === 'STILL' && s.sequence_active === false && s.pin_gate_allowed === true);
    c.requestIndex('green');
    var m = c.tick(0.5);
    ctx.check('rotating', String(m.at_station) + '/' + m.drum_state + '/' + m.sequence_active + '/' + m.pin_gate_allowed, 'null/ROTATING/true/false',
      m.at_station === null && m.drum_state === 'ROTATING' && m.sequence_active === true && m.pin_gate_allowed === false);
    var e = c.tick(1e6);
    ctx.check('arrived:green', e.at_station + '/' + e.drum_state + '/' + e.pin_gate_allowed, 'green/STILL/true', e.at_station === 'green' && e.drum_state === 'STILL' && e.pin_gate_allowed === true);
    var parked = C.parkedSnapshot(), lifting = C.parkedSnapshot();
    lifting.cartridges.blue.lift = 0.5;
    lifting.cartridges.blue.liftTarget = 1;
    c.observe(parked);
    var l0 = c.snapshot().lift_in_progress;
    c.observe(lifting);
    var l1 = c.snapshot().lift_in_progress;
    ctx.check('lift_in_progress', l0 + '/' + l1, 'false/true', l0 === false && l1 === true);
    ctx.check('snapshot_frozen', Object.isFrozen(e) && Object.isFrozen(e.trace) && Object.isFrozen(e.last_move), true,
      Object.isFrozen(e) && Object.isFrozen(e.trace) && Object.isFrozen(e.last_move));
    var u = new C().snapshot();
    ctx.check('unhomed:pin_gate_blocked', String(u.at_station) + '/' + u.pin_gate_allowed, 'null/false', u.at_station === null && u.pin_gate_allowed === false);
  });
}(this));
