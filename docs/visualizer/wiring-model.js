/* Electrical state derived from the demo-controller state (ASSUMED / NOT_VALIDATED).
   Shared by the 2D wiring page and the 3D harness so both show the same levels. Pure apart from its own memory. */
(function () {
  'use strict';
  var TWO_PI = Math.PI * 2, MOVE_HOLD = 0.25;
  function mod(a, n) { return ((a % n) + n) % n; }

  function leverPhi(cfg, vTarget) {
    var P = cfg.pivot, Pp = cfg.pin_parked, a0 = Math.atan2(Pp[1] - P[1], Pp[0] - P[0]);
    var c1 = Math.asin(Math.max(-1, Math.min(1, (vTarget - P[1]) / cfg.arm1))), c2 = Math.PI - c1;
    function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
    var p1 = wrap(c1 - a0), p2 = wrap(c2 - a0);
    return Math.abs(p1) <= Math.abs(p2) ? p1 : p2;
  }

  function create() {
    var W = window.DispenserWiringSpec, A = window.DispenserRotationSpec.g.act;
    var mem = { angle: null, moveUntil: 0, s1: null, s2: null, s1Until: 0, s2Until: 0, txUntil: 0, rxUntil: 0, phase: null, t0: null };
    function servoCmd(phi) {
      var deg = Math.max(0, Math.min(W.pwm.range_deg, W.pwm.center_deg + phi * 180 / Math.PI));
      return { deg: deg, us: W.pwm.min_us + deg / W.pwm.range_deg * (W.pwm.max_us - W.pwm.min_us) };
    }
    // s: controller snapshot, angle: drum angle in rad, nowMs: any monotonic clock
    function derive(s, angle, nowMs) {
      var t = nowMs / 1000, N = W.stepper.half_steps_per_rev, seq = W.stepper.sequence, events = [];
      if (mem.t0 === null) mem.t0 = t;
      angle = mod(angle, TWO_PI);
      if (mem.angle !== null && Math.abs(mod(angle - mem.angle + Math.PI, TWO_PI) - Math.PI) > 1e-5) mem.moveUntil = t + MOVE_HOLD;
      mem.angle = angle;
      var moving = t < mem.moveUntil, half = Math.round(angle / TWO_PI * N), idx = mod(half, seq.length);
      var coils = moving ? seq[idx] : [0, 0, 0, 0];
      var home = angle < W.hall.home_window_rad || angle > TWO_PI - W.hall.home_window_rad;
      var c1 = servoCmd(leverPhi(A.s1, A.s1.pin_parked[1] - (s.carriage || 0) + A.s1.release * (1 + (s.pinZ || 0) / 5)));
      var c2 = servoCmd(leverPhi(A.s2, A.s2.pin_parked[1] + (s.tongueEdge - 5.7)));
      if (mem.s1 && Math.abs(c1.us - mem.s1.us) > 0.5) mem.s1Until = t + MOVE_HOLD;
      if (mem.s2 && Math.abs(c2.us - mem.s2.us) > 0.5) mem.s2Until = t + MOVE_HOLD;
      mem.s1 = c1; mem.s2 = c2;
      if (s.phase !== mem.phase) {
        if (s.phase === 'BEAM') { mem.txUntil = t + 0.4; events.push({ kind: 'uart', text: 'TX  scan trigger' }); }
        if (s.phase === 'SCAN_RESULT') { mem.rxUntil = t + 0.4; events.push({ kind: 'uart', text: 'RX  ' + (s.scanCode === null || s.scanCode === undefined ? '' : String(s.scanCode)) + '\\r' }); }
        events.push({ kind: 'phase', sec: t - mem.t0, phase: s.phase });
        mem.phase = s.phase;
      }
      return { phase: s.phase, angle: angle, half: half, idx: idx, moving: moving, coils: coils, home: home, s1: c1, s2: c2,
        s1Moving: t < mem.s1Until, s2Moving: t < mem.s2Until, beam: s.phase === 'BEAM', tx: t < mem.txUntil, rx: t < mem.rxUntil, events: events };
    }
    return { derive: derive };
  }

  function liveText(fn, m) {
    if (fn.indexOf('coil') === 0) return m.coils[Number(fn.slice(4)) - 1] ? '1' : '0';
    if (fn === 'servo1') return (m.s1.us / 1000).toFixed(2) + ' ms';
    if (fn === 'servo2') return (m.s2.us / 1000).toFixed(2) + ' ms';
    if (fn === 'hall') return m.home ? 'LOW' : 'HIGH';
    if (fn === 'uart_tx') return m.tx ? 'TX' : 'idle';
    if (fn === 'uart_rx') return m.rx ? 'RX' : 'idle';
    return '';
  }
  function isHigh(fn, m) {
    if (fn.indexOf('coil') === 0) return Boolean(m.coils[Number(fn.slice(4)) - 1]);
    if (fn === 'servo1' || fn === 'servo2') return true;
    if (fn === 'hall') return !m.home;
    if (fn === 'uart_tx') return m.tx;
    if (fn === 'uart_rx') return m.rx;
    return false;
  }
  // true while the signal is actually changing (stepper pulsing, servo moving, UART bytes)
  function isActive(fn, m) {
    if (fn.indexOf('coil') === 0) return m.moving;
    if (fn === 'servo1') return m.s1Moving;
    if (fn === 'servo2') return m.s2Moving;
    if (fn === 'hall') return m.home;
    if (fn === 'uart_tx') return m.tx;
    if (fn === 'uart_rx') return m.rx;
    return false;
  }
  function loads(m) {
    var L = window.DispenserWiringSpec.loads_ma, coils = m.coils.reduce(function (a, b) { return a + b; }, 0);
    return [['ESP32-S3', L.esp32], ['28BYJ-48 stepper', coils * L.stepper_per_coil], ['Servo S1', m.s1Moving ? L.servo_moving : L.servo_idle],
      ['Servo S2', m.s2Moving ? L.servo_moving : L.servo_idle], ['Barcode reader', m.beam ? L.reader_scan : L.reader_idle], ['Hall sensor', L.hall]];
  }
  window.DispenserWiringModel = { create: create, liveText: liveText, isHigh: isHigh, isActive: isActive, loads: loads };
}());
