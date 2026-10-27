(function (root) {
  'use strict';
  /* Subsystem 3 verification logic (Feature 009; ASSUMED / NOT_VALIDATED concept, no hardware or dose claim).
     Pure state machine: it only READS a snapshot of the demo controller and the level sensors, never changes the dispense controller.
     Three checks: (1) a dispense is verified when the exit break-beam saw exactly one pill, (2) each ring is EMPTY / PARTIAL / FULL from two
     level sensors (READY at the pocket next to the exit, FULL at the last queue pocket), (3) a ring can store another pill of the SAME colour
     only while it has a free pocket. No randomness; time comes from the caller. */
  var COLORS = ['red', 'blue', 'green', 'orange'];
  var BEAM_HOLD_MS = 700;

  function create(opts) {
    opts = opts || {};
    var max = opts.max || 5, sense = opts.sense || null, moving = opts.moving || null, listeners = [];
    var st = { rings: {}, beam: false, beamUntil: 0, op: null, run: null, prevTray: null, last: null, history: [], settled: true };
    COLORS.forEach(function (c) { st.rings[c] = { color: c, count: 0, present: true, ready: false, full: false, level: 'EMPTY', free: max, mismatch: false, canStore: true, reason: '' }; });

    function reading(c, count) {
      var r = sense ? sense(c) : null;
      return { ready: r && r.ready !== null && r.ready !== undefined ? Boolean(r.ready) : count >= 1, full: r && r.full !== null && r.full !== undefined ? Boolean(r.full) : count >= max };
    }
    function ring(c, cs, now) {
      var rec = st.rings[c], count = cs && cs.occupancy === 'loaded' ? cs.count : 0, sensors = reading(c, count);
      rec.count = count; rec.present = !cs || cs.present !== false; rec.ready = sensors.ready; rec.full = sensors.full;
      rec.level = !rec.ready ? 'EMPTY' : rec.full ? 'FULL' : 'PARTIAL';
      rec.free = rec.present ? Math.max(0, max - count) : 0;
      // the sensors and the pill count must agree whenever the mechanism is still (for 400 ms); a ring in motion is not judged
      var raw = (rec.level === 'EMPTY' && count > 0) || (rec.level === 'FULL' && count < max) || (rec.level === 'PARTIAL' && (count === 0 || count >= max));
      if (!st.settled || !raw) rec.since = null; else if (rec.since === null || rec.since === undefined) rec.since = now;
      rec.mismatch = raw && st.settled && now - rec.since >= 400;
      rec.canStore = rec.present && rec.level !== 'FULL' && rec.free > 0 && !rec.mismatch;
      rec.reason = !rec.present ? 'compartment removed' : rec.mismatch ? 'sensors disagree with the pill count' : rec.level === 'FULL' ? 'no free pocket (ring is FULL)' : '';
    }
    function finish(now) {
      var run = st.run, s = st.rings[run.color], taken = run.count0 - s.count, verdict;
      verdict = run.beams === 0 ? 'NO_PILL' : run.beams > 1 ? 'MULTIPLE' : taken === 1 ? 'VERIFIED' : 'COUNT_MISMATCH';
      st.last = { color: run.color, verdict: verdict, beams: run.beams, countBefore: run.count0, countAfter: s.count, at: now };
      st.history.unshift(st.last); st.history.length = Math.min(st.history.length, 8);
      st.run = null;
      listeners.forEach(function (fn) { fn(st.last); });
    }

    // s is the demo controller's snapshot; now is a millisecond clock
    function observe(s, now) {
      now = now === undefined ? Date.now() : now;
      var op = s.operation === undefined ? null : s.operation;
      st.settled = op === null && !(moving && moving());
      COLORS.forEach(function (c) { ring(c, s.cartridges && s.cartridges[c], now); });
      if (st.prevTray === null) st.prevTray = s.trayCount || 0;
      if (op === 'dispense' && !st.run) st.run = { color: s.selected, count0: st.rings[s.selected] ? st.rings[s.selected].count : 0, beams: 0 };
      if (st.run && op === 'dispense' && st.run.count0 === undefined) st.run.count0 = 0;
      var tray = s.trayCount || 0;
      if (tray > st.prevTray) { if (st.run) st.run.beams += tray - st.prevTray; st.beamUntil = now + BEAM_HOLD_MS; }
      st.prevTray = tray;
      st.beam = now < st.beamUntil;
      if (st.run && op !== 'dispense') { ring(st.run.color, s.cartridges && s.cartridges[st.run.color], now); finish(now); }
      st.op = op;
      return snapshot();
    }
    function snapshot() {
      var out = { rings: {}, beam: st.beam, last: st.last, history: st.history.slice(), busy: st.op !== null };
      COLORS.forEach(function (c) { out.rings[c] = Object.assign({}, st.rings[c]); });
      return out;
    }
    // can this pill colour be dispensed now? An EMPTY ring (no pill at the exit pocket) refuses.
    function canDispense(color) {
      var r = st.rings[color];
      if (!r) return { ok: false, reason: 'unknown pill' };
      if (st.op !== null) return { ok: false, reason: 'the mechanism is busy' };
      if (!r.present) return { ok: false, reason: 'compartment removed' };
      if (r.level === 'EMPTY') return { ok: false, reason: color + ' ring is EMPTY (no pill at the exit pocket)' };
      return { ok: true, reason: '' };
    }
    // may another pill of the SAME colour be stored in that ring? Needs a free pocket.
    function canStore(color) {
      var r = st.rings[color];
      return r ? { ok: r.canStore, free: r.free, level: r.level, reason: r.reason } : { ok: false, free: 0, level: 'EMPTY', reason: 'unknown pill' };
    }
    return { observe: observe, snapshot: snapshot, canDispense: canDispense, canStore: canStore, onVerdict: function (fn) { listeners.push(fn); }, max: max, colors: COLORS.slice() };
  }
  root.DispenserVerification = { create: create, COLORS: COLORS, BEAM_HOLD_MS: BEAM_HOLD_MS };
}(window));
