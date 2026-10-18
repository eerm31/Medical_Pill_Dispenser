(function (root) {
  'use strict';
  var H = root.Feature005Harness, C = root.DispenserRotationController;
  var CODE = { short: 'missed_index_short', over: 'missed_index_over', wrong_stop: 'wrong_stop' };

  H.register('ROT-C04', 'injected missed index blocks pin and gate until re-index', function (ctx) {
    Object.keys(CODE).forEach(function (kind) {
      var c = H.homed();
      c.injectFault(kind);
      c.requestIndex('blue');
      var s = c.tick(1e6);
      ctx.check(kind + ':fault_code', s.fault && s.fault.code, CODE[kind], s.state === 'MISSED_INDEX_FAULT' && s.fault.code === CODE[kind]);
      ctx.check(kind + ':station_unconfirmed', String(s.at_station) + '/' + s.pin_gate_allowed, 'null/false', s.at_station === null && s.pin_gate_allowed === false);
      var aux = c.requestAuxCommand('pin');
      ctx.check(kind + ':pin_refused', aux.rule_code, 'station_not_confirmed', aux.permitted === false && aux.rule_code === 'station_not_confirmed');
      var again = c.requestIndex('green'), h = c.home(), a0 = c.snapshot().drum_angle_deg;
      ctx.check(kind + ':motion_refused', again.failed_rules.join(',') + '|' + h.failed_rules.join(','), 'fault_active|fault_active',
        again.verdict === 'refused' && again.failed_rules[0] === 'fault_active' && h.failed_rules[0] === 'fault_active' && c.snapshot().drum_state === 'STILL');
      c.tick(5);
      ctx.check(kind + ':no_motion_after_refusal', c.snapshot().drum_angle_deg, a0,
        c.snapshot().drum_angle_deg === a0 && c.snapshot().state === 'MISSED_INDEX_FAULT');
    });

    var r = H.homed();
    r.injectFault('short', { count: 1 });
    r.requestIndex('green');
    r.tick(1e6);
    var acc = r.reindex(), rec = r.tick(1e6);
    ctx.check('reindex:recovers', rec.state + '/' + rec.at_station, 'HOMED_CONFIRMED/green',
      acc.accepted === true && rec.state === 'HOMED_CONFIRMED' && rec.at_station === 'green' && rec.pin_gate_allowed === true && rec.last_move.reindex === true);

    var h = H.homed();
    h.injectFault('short', { count: 3 });
    h.requestIndex('green');
    h.tick(1e6);
    h.reindex();
    var a1 = h.tick(1e6);
    ctx.check('reindex:attempt1_fails', a1.state + '/' + a1.reindex_attempts, 'MISSED_INDEX_FAULT/1', a1.state === 'MISSED_INDEX_FAULT' && a1.reindex_attempts === 1);
    h.reindex();
    var a2 = h.tick(1e6);
    ctx.check('reindex:bounded_hard_fault', a2.state + '/' + a2.fault.code + '/' + a2.fault.cause, 'HARD_FAULT/hard_fault/missed_index_short',
      a2.state === 'HARD_FAULT' && a2.fault.code === 'hard_fault' && a2.fault.cause === 'missed_index_short' && a2.reindex_attempts === 2);
    var third = h.reindex(), blocked = h.requestIndex('red');
    ctx.check('hard_fault:no_motion', third.failed_rules.join(',') + '|' + blocked.failed_rules.join(','), 'fault_active|fault_active',
      third.verdict === 'refused' && blocked.verdict === 'refused' && h.snapshot().pin_gate_allowed === false);
    var rs = h.reset();
    ctx.check('hard_fault:explicit_reset', rs.accepted + '/' + h.snapshot().state, 'true/UNHOMED', rs.accepted === true && h.snapshot().state === 'UNHOMED' && h.snapshot().fault === null);
    h.home();
    ctx.check('hard_fault:rehome_after_reset', h.tick(1e6).state, 'HOMED_CONFIRMED', h.snapshot().state === 'HOMED_CONFIRMED');

    var j = H.homed();
    j.injectFault('hard_fault');
    ctx.check('injected_hard_fault', j.snapshot().state, 'HARD_FAULT', j.snapshot().state === 'HARD_FAULT' && j.snapshot().pin_gate_allowed === false);

    var n = H.homed(), nr = n.reindex();
    ctx.check('reindex_without_fault', nr.failed_rules.join(','), 'not_faulted', nr.verdict === 'refused' && nr.failed_rules[0] === 'not_faulted');

    var m = H.homed();
    m.requestIndex('green');
    m.tick(0.5);
    var rr = m.reset();
    ctx.check('reset_while_rotating', rr.failed_rules.join(','), 'busy', rr.verdict === 'refused' && m.snapshot().drum_state === 'ROTATING');

    var small = H.homed({ index_tolerance_deg: 0.5 });
    small.injectFault('short', { deg: 0.2 });
    small.requestIndex('blue');
    ctx.check('inside_tolerance_not_a_fault', small.tick(1e6).state, 'HOMED_CONFIRMED', small.snapshot().state === 'HOMED_CONFIRMED');
    ctx.check('constants:max_reindex_attempts', C.CONSTANTS.max_reindex_attempts, 2, C.CONSTANTS.max_reindex_attempts === 2);
  });
}(this));
