(function (root) {
  'use strict';
  var H = root.Feature005Harness, C = root.DispenserRotationController;

  H.register('ROT-C01', 'sixteen moves end at the commanded station', function (ctx) {
    H.COLORS.forEach(function (start) {
      H.COLORS.forEach(function (target) {
        var step = start + '->' + target;
        var c = H.homed();
        H.go(c, start);
        var before = c.snapshot();
        var r = c.requestIndex(target);
        var mid = c.snapshot();
        var after = c.tick(1e6);
        if (start === target) {
          ctx.check(step + ':verdict', r.verdict, 'already_at_station', r.verdict === 'already_at_station');
          ctx.check(step + ':motion', mid.drum_state + ' angle ' + (mid.drum_angle_deg - before.drum_angle_deg), 'STILL angle 0',
            mid.drum_state === 'STILL' && mid.drum_angle_deg === before.drum_angle_deg && after.drum_angle_deg === before.drum_angle_deg);
          ctx.check(step + ':at_station', after.at_station, target, after.at_station === target);
        } else {
          ctx.check(step + ':at_station', after.at_station, target, after.at_station === target && r.verdict === 'started');
          ctx.check(step + ':error_deg', after.last_move.error_deg, 0.5, Math.abs(after.last_move.error_deg) <= 0.5);
        }
      });
    });
  });

  H.register('ROT-C02', 'repeatability under the lost-motion model', function (ctx) {
    var lash = C.CONSTANTS.lash_deg;
    ['unidirectional', 'shortest'].forEach(function (policy) {
      // The comparison case widens the tolerance so the lash spread stays observable instead of faulting.
      var opts = policy === 'shortest' ? { policy: policy, index_tolerance_deg: 1.5 } : { policy: policy };
      H.COLORS.forEach(function (target, k) {
        var c = H.homed(opts), errors = [], wrong = 0, maxAbs = 0;
        var others = H.COLORS.filter(function (x) { return x !== target; });
        for (var j = 0; j < 10; j++) {
          H.go(c, others[j % 3]);
          H.go(c, target);
          var lm = c.snapshot().last_move;
          errors.push(lm.error_deg);
          maxAbs = Math.max(maxAbs, Math.abs(lm.error_deg));
          if (H.nearest(lm.achieved_deg) !== target || c.snapshot().at_station !== target) wrong += 1;
        }
        var spread = Math.max.apply(null, errors) - Math.min.apply(null, errors);
        var want = policy === 'unidirectional' ? 0 : lash;
        var tag = target + ':' + policy;
        ctx.check(tag + ':spread_deg', spread, want, Math.abs(spread - want) < 1e-4);
        ctx.check(tag + ':neighbour_endings', wrong, 0, wrong === 0);
        if (policy === 'unidirectional') ctx.check(tag + ':max_abs_error_deg', maxAbs, 0.5, maxAbs <= 0.5);
      });
    });
  });
}(this));
