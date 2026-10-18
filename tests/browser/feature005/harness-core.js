/* Headless-capable harness for the standalone rotation controller (no DOM, no network).
   ASSUMED / NOT_VALIDATED: every threshold below is proposed. */
(function (root) {
  'use strict';
  var H = { COLORS: ['red', 'blue', 'green', 'orange'], cases: [] };
  var DISCLOSURE = 'NOT VALIDATED / NOT PRINT-READY; verifies control logic, ordering and interlocks only';
  var R_STATUS = 'not validated \u2014 to be measured on a built rig';

  H.register = function (id, title, fn) { H.cases.push({ id: id, title: title, fn: fn }); };
  H.homed = function (options) {
    var c = new root.DispenserRotationController(options);
    c.home();
    c.tick(1e6);
    return c;
  };
  H.go = function (c, color, options) {
    var r = c.requestIndex(color, options);
    c.tick(1e6);
    return r;
  };
  H.wrap180 = function (a) { var w = ((a % 360) + 360) % 360; return w > 180 ? w - 360 : w; };
  H.nearest = function (deg) { return H.COLORS[Math.round((((deg % 360) + 360) % 360) / 90) % 4]; };
  H.snap = function (s) { return JSON.stringify(s); };

  function round6(x) { return Math.round(x * 1e6) / 1e6; }
  function norm(v) {
    if (typeof v === 'number') return round6(v);
    return typeof v === 'string' ? v : String(v);
  }

  H.run = function () {
    var out = [], seq = 0;
    H.cases.forEach(function (cs) {
      var ctx = {
        check: function (step, observed, threshold, ok) {
          out.push({ seq: seq++, rec: { criterion_id: cs.id, step: step, observed: norm(observed),
            threshold: norm(threshold), threshold_label: 'proposed', verdict: ok ? 'pass' : 'fail' } });
        }
      };
      try { cs.fn(ctx, H); } catch (e) { ctx.check('exception in ' + cs.title, String(e && e.message), 'no exception', false); }
    });
    out.sort(function (a, b) {
      if (a.rec.criterion_id !== b.rec.criterion_id) return a.rec.criterion_id < b.rec.criterion_id ? -1 : 1;
      return a.seq - b.seq;
    });
    var results = out.map(function (o) { return o.rec; });
    var fails = results.filter(function (r) { return r.verdict !== 'pass'; }).length;
    ['ROT-R01', 'ROT-R02', 'ROT-R03', 'ROT-R04', 'ROT-R05', 'ROT-R06'].forEach(function (id) {
      results.push({ criterion_id: id, status: R_STATUS });
    });
    return { feature: '005-first-subsystem-rotation-pin-gates', scope: 'rotation', mode: 'a', disclosure: DISCLOSURE,
      print_ready: false, fabricable_as_designed: false,
      assumptions: root.DispenserRotationController.CONSTANTS,
      summary: { checks: out.length, fail: fails }, results: results };
  };
  H.logText = function () { return JSON.stringify(H.run(), null, 2); };

  root.Feature005Harness = H;
}(this));
