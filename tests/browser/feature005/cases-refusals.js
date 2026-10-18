(function (root) {
  'use strict';
  var H = root.Feature005Harness, C = root.DispenserRotationController;

  function snapWith(mutate) { var s = C.parkedSnapshot(); mutate(s); return s; }
  var UNSAFE = [
    ['pin_not_up:down', ['pin_not_up'], function (s) { s.pin = 'down'; }],
    ['pin_not_up:engaged', ['pin_not_up'], function (s) { s.pin = 'engaged'; }],
    ['carriage_not_parked', ['carriage_not_parked'], function (s) { s.carriage = 10.4; }],
    ['gate_open:red-blade', ['gate_open'], function (s) { s.cartridges.red.blade = 1; s.cartridges.red.bladeMotion = 'open'; }],
    ['gate_open:blue-blade', ['gate_open'], function (s) { s.cartridges.blue.blade = 0.5; s.cartridges.blue.bladeMotion = 'opening'; }],
    ['gate_open:green-blade', ['gate_open'], function (s) { s.cartridges.green.blade = 0.5; s.cartridges.green.bladeMotion = 'closing'; }],
    ['gate_open:orange-blade', ['gate_open'], function (s) { s.cartridges.orange.blade = 1; s.cartridges.orange.bladeMotion = 'open'; }],
    ['gate_open:tongue', ['gate_open'], function (s) { s.tongueMotion = 'open'; s.tongueEdge = -5.7; }],
    ['cap_open', ['cap_open'], function (s) { s.cartridges.green.capOpen = true; s.cartridges.green.cap = 'open'; }],
    ['busy:dispense', ['busy'], function (s) { s.phase = 'DRUM_ROTATE'; s.operation = 'dispense'; }],
    ['busy:scan', ['busy'], function (s) { s.phase = 'PACKAGE_IN'; s.operation = 'scan'; }],
    ['cartridge_lift_active', ['cartridge_lift_active'], function (s) { s.cartridges.orange.lift = 0.5; s.cartridges.orange.liftTarget = 1; }],
    ['combined:pin+gate+cap', ['pin_not_up', 'gate_open', 'cap_open'], function (s) {
      s.pin = 'down'; s.tongueMotion = 'open'; s.cartridges.red.capOpen = true; }],
    ['combined:all-six', ['pin_not_up', 'carriage_not_parked', 'gate_open', 'cap_open', 'busy', 'cartridge_lift_active'], function (s) {
      s.pin = 'engaged'; s.carriage = 5; s.tongueMotion = 'opening'; s.cartridges.blue.capOpen = true;
      s.phase = 'CARTRIDGE_LIFT'; s.operation = 'cartridge'; s.cartridges.green.lift = 0.2; s.cartridges.green.liftTarget = 1; }]
  ];

  H.register('ROT-C03', 'unsafe states refuse rotation with zero motion', function (ctx) {
    ctx.check('parked:allowed', C.canRotate(C.parkedSnapshot()).allowed, true, C.canRotate(C.parkedSnapshot()).allowed === true);
    UNSAFE.forEach(function (u) {
      ['green', 'red'].forEach(function (target) {
        var c = H.homed(), before = H.snap(c.snapshot());
        var r = c.requestIndex(target, { snapshot: snapWith(u[2]) });
        var after = c.snapshot();
        var rulesOk = r.verdict === 'refused' && r.failed_rules.join(',') === u[1].join(',');
        ctx.check(u[0] + '->' + target + ':rules', r.failed_rules.join(','), u[1].join(','), rulesOk && r.reason.length > 0);
        c.tick(1e6);
        ctx.check(u[0] + '->' + target + ':zero_motion', after.drum_state + '/' + c.snapshot().drum_angle_deg, 'STILL/' + JSON.parse(before).drum_angle_deg,
          after.drum_state === 'STILL' && H.snap(c.snapshot()).replace(/"elapsed_s":[^,]*,/, '') === before.replace(/"elapsed_s":[^,]*,/, ''));
      });
    });
    var c = H.homed();
    var inv = c.requestIndex('purple');
    ctx.check('invalid_color', inv.failed_rules.join(','), 'invalid_color', inv.verdict === 'refused' && inv.failed_rules[0] === 'invalid_color');
    var fresh = new C(), nh = fresh.requestIndex('blue', { snapshot: snapWith(function (s) { s.pin = 'down'; }) });
    ctx.check('not_homed+pin_not_up', nh.failed_rules.join(','), 'not_homed,pin_not_up', nh.failed_rules.join(',') === 'not_homed,pin_not_up');
    var bad = c.canRotate(null);
    ctx.check('invalid_snapshot', bad.failed_rules.join(','), 'invalid_snapshot', bad.allowed === false && bad.failed_rules[0] === 'invalid_snapshot');
    ctx.check('precedence_list', C.RULE_PRECEDENCE.join(','), 'invalid_color,fault_active,not_homed,invalid_snapshot,pin_not_up,carriage_not_parked,gate_open,cap_open,busy,cartridge_lift_active',
      C.RULE_PRECEDENCE.join(',') === 'invalid_color,fault_active,not_homed,invalid_snapshot,pin_not_up,carriage_not_parked,gate_open,cap_open,busy,cartridge_lift_active');
    var m = H.homed();
    m.requestIndex('green');
    m.tick(0.5);
    var busy = m.requestIndex('blue');
    ctx.check('busy:self_rotating', busy.failed_rules.join(','), 'busy', busy.verdict === 'refused' && busy.failed_rules.join(',') === 'busy');
  });

  H.register('ROT-C03', 'auxiliary commands during rotation (acceptance scenario 5)', function (ctx) {
    ['dispense', 'pin', 'gate'].forEach(function (kind) {
      var c = H.homed();
      c.requestIndex('green');
      c.tick(0.5);
      var before = H.snap(c.snapshot());
      var r = c.requestAuxCommand(kind);
      var mid = c.snapshot();
      ctx.check(kind + ':rule', r.rule_code, 'rotation_active', r.permitted === false && r.rule_code === 'rotation_active');
      ctx.check(kind + ':pin_gate_allowed', mid.pin_gate_allowed, false, mid.pin_gate_allowed === false);
      ctx.check(kind + ':state_unchanged', H.snap(mid) === before, true, H.snap(mid) === before);
      var end = c.tick(1e6);
      ctx.check(kind + ':rotation_completes', end.at_station, 'green', end.at_station === 'green' && end.last_move.verdict === 'indexed');
      var ok = c.requestAuxCommand(kind);
      ctx.check(kind + ':permitted_when_still', ok.permitted, true, ok.permitted === true && c.snapshot().pin_gate_allowed === true);
    });
    var u = new C(), n = u.requestAuxCommand('pin');
    ctx.check('unhomed:rule', n.rule_code, 'station_not_confirmed', n.permitted === false && n.rule_code === 'station_not_confirmed');
    var bad = u.requestAuxCommand('open-sesame');
    ctx.check('invalid_kind', bad.rule_code, 'invalid_kind', bad.permitted === false && bad.rule_code === 'invalid_kind');
  });

  H.register('ROT-C03', 'shape check against the real demo controller snapshot (read-only)', function (ctx) {
    var D = root.DispenserDemoController;
    if (typeof D !== 'function' || !root.DISPENSER_CONCEPT_DATA) {
      ctx.check('demo_controller_loaded', 'missing', 'DispenserDemoController and concept data loaded', false);
      return;
    }
    var d = new D();
    ctx.check('initial:allowed', C.canRotate(d.snapshot()).allowed, true, C.canRotate(d.snapshot()).allowed === true);
    d.state.cartridges.red.occupancy = 'loaded';
    d.state.cartridges.red.count = 5;
    var started = d.requestDispense('red');
    var seen = { pin: 0, blade: 0, tongue: 0, busy: 0 }, mismatch = 0, last = null, i, s, g;
    for (i = 0; started && i < 6000; i++) {
      s = d.tick(0.05);
      g = C.canRotate(s);
      var bladeOpen = H.COLORS.some(function (c) { return s.cartridges[c].bladeMotion !== 'closed' || s.cartridges[c].blade !== 0; });
      var tongueOpen = s.tongueMotion !== 'closed';
      var pinDown = s.pin !== 'up';
      if (pinDown) seen.pin += 1;
      if (bladeOpen) seen.blade += 1;
      if (tongueOpen) seen.tongue += 1;
      if (s.phase !== 'PARKED') seen.busy += 1;
      if (pinDown !== (g.failed_rules.indexOf('pin_not_up') >= 0)) mismatch += 1;
      if ((bladeOpen || tongueOpen) !== (g.failed_rules.indexOf('gate_open') >= 0)) mismatch += 1;
      if ((s.phase !== 'PARKED' || s.operation !== null) !== (g.failed_rules.indexOf('busy') >= 0)) mismatch += 1;
      last = s;
      if (s.phase === 'PARKED' && s.operation === null) break;
    }
    ctx.check('dispense:started', started, true, started === true);
    ctx.check('dispense:pin_down_seen', seen.pin > 0, true, seen.pin > 0);
    ctx.check('dispense:blade_open_seen', seen.blade > 0, true, seen.blade > 0);
    ctx.check('dispense:tongue_open_seen', seen.tongue > 0, true, seen.tongue > 0);
    ctx.check('dispense:guard_matches_fields', mismatch, 0, mismatch === 0);
    ctx.check('dispense:parked_again_allowed', C.canRotate(last).allowed, true, C.canRotate(last).allowed === true);

    var d2 = new D(), cap = d2.state.cartridges.blue;
    cap.cap = 'unlocked';
    cap.unlockUntil = 1e12;
    var opened = d2.openCap('blue');
    for (i = 0; i < 400 && d2.snapshot().operation !== null; i++) d2.tick(0.05);
    g = C.canRotate(d2.snapshot());
    ctx.check('cap:open', g.failed_rules.join(','), 'cap_open', opened === true && g.failed_rules.join(',') === 'cap_open');

    var d3 = new D(), ex = d3.exchange('green'), mid = d3.tick(0.01);
    g = C.canRotate(mid);
    ctx.check('lift:active', g.failed_rules.join(','), 'busy,cartridge_lift_active',
      ex === true && g.failed_rules.indexOf('cartridge_lift_active') >= 0 && g.failed_rules.indexOf('busy') >= 0);
  });
}(this));
