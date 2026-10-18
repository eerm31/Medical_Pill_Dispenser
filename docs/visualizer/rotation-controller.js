/* Standalone rotation-controller logic (home search, CCW index, interlock guard).
   ASSUMED / NOT_VALIDATED. Logic only: no hardware, sensor or friction behaviour is modelled.
   Deterministic: elapsed time comes only from tick(dt). Not wired into the viewer. */
(function (root) {
  'use strict';

  var COLORS = ['red', 'blue', 'green', 'orange'];
  var EPS = 1e-9;
  var CONSTANTS = {
    status: 'ASSUMED / NOT_VALIDATED',
    colors: COLORS,
    lash_deg: 1.0,
    overshoot_deg: 3.0,
    steps_per_rev: 2048,
    index_tolerance_deg: 0.5,
    hardware_rad_s: 0.8,
    hardware_ramp_s: 0.2,
    sim_rad_s: 1.3,
    home_offset_deg: 3.66,
    home_search_limit_steps: 2560,
    max_reindex_attempts: 2,
    fault_default_deg: 2.0,
    tongue_closed_edge: 5.7,
    quarter_deg: 90
  };

  var PRECEDENCE = ['invalid_color', 'fault_active', 'not_homed', 'invalid_snapshot', 'pin_not_up',
    'carriage_not_parked', 'gate_open', 'cap_open', 'busy', 'cartridge_lift_active'];
  var TEXT = {
    invalid_color: 'Unknown cartridge color.',
    fault_active: 'A rotation fault is active; explicit recovery is required.',
    not_homed: 'The drum is not homed; the station is not confirmed.',
    invalid_snapshot: 'The mechanism snapshot is missing or malformed.',
    pin_not_up: 'The pin must be fully up.',
    carriage_not_parked: 'The carriage must be parked.',
    gate_open: 'All four blades and the tongue must be fully closed.',
    cap_open: 'Every cap must be closed.',
    busy: 'The mechanism, scanner or drum is busy.',
    cartridge_lift_active: 'A cartridge lift is in progress.',
    rotation_active: 'A rotation is in progress.',
    station_not_confirmed: 'No station is confirmed.',
    invalid_kind: 'Unknown auxiliary command kind.',
    not_faulted: 'Re-index is only available after a missed-index fault.'
  };

  function wrap360(a) {
    var w = a - 360 * Math.floor(a / 360);
    return (360 - w < EPS) ? 0 : w;
  }
  function wrap180(a) { var w = wrap360(a); return w > 180 ? w - 360 : w; }
  function r6(x) { return Math.round(x * 1e6) / 1e6; }
  function sign(x) { return x > 0 ? 1 : (x < 0 ? -1 : 0); }
  function mod(a, n) { return ((a % n) + n) % n; }
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function freeze(v) {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) {
      Object.keys(v).forEach(function (k) { freeze(v[k]); });
      Object.freeze(v);
    }
    return v;
  }
  function stepsToReach(distanceDeg, stepDeg) { return distanceDeg <= EPS ? 0 : Math.ceil(distanceDeg / stepDeg - EPS); }
  function reasonFor(codes) { return codes.map(function (c) { return TEXT[c] || c; }).join(' '); }
  function ordered(codes) { return PRECEDENCE.filter(function (c) { return codes.indexOf(c) >= 0; }); }

  function parkedSnapshot() {
    var cartridges = {};
    COLORS.forEach(function (c) {
      cartridges[c] = { blade: 0, bladeMotion: 'closed', capOpen: false, cap: 'locked', lift: 0, liftTarget: 0 };
    });
    return { phase: 'PARKED', operation: null, pin: 'up', carriage: 0, tongueMotion: 'closed',
      tongueEdge: CONSTANTS.tongue_closed_edge, cartridges: cartridges };
  }

  // Guard over a DispenserDemoController.snapshot()-shaped object; pure.
  function canRotate(s) {
    var failed = [];
    var valid = s && typeof s === 'object' && s.cartridges && typeof s.cartridges === 'object' &&
      COLORS.every(function (c) { return s.cartridges[c] && typeof s.cartridges[c] === 'object'; });
    if (!valid) return { allowed: false, failed_rules: ['invalid_snapshot'], reason: reasonFor(['invalid_snapshot']) };
    if (s.pin !== 'up') failed.push('pin_not_up');
    if (typeof s.carriage !== 'number' || Math.abs(s.carriage) > EPS) failed.push('carriage_not_parked');
    var gateOpen = s.tongueMotion !== 'closed' ||
      (typeof s.tongueEdge === 'number' && Math.abs(s.tongueEdge - CONSTANTS.tongue_closed_edge) > EPS) ||
      COLORS.some(function (c) { return s.cartridges[c].bladeMotion !== 'closed' || s.cartridges[c].blade !== 0; });
    if (gateOpen) failed.push('gate_open');
    if (COLORS.some(function (c) { return s.cartridges[c].capOpen === true || s.cartridges[c].cap === 'open'; })) failed.push('cap_open');
    if (s.phase !== 'PARKED' || s.operation !== null) failed.push('busy');
    var lift = s.operation === 'cartridge' || COLORS.some(function (c) {
      var k = s.cartridges[c];
      return typeof k.lift === 'number' && typeof k.liftTarget === 'number' && Math.abs(k.lift - k.liftTarget) > EPS;
    });
    if (lift) failed.push('cartridge_lift_active');
    failed = ordered(failed);
    return { allowed: failed.length === 0, failed_rules: failed, reason: failed.length ? reasonFor(failed) : '' };
  }

  // Shared planner on a circle of `full` units (360 degrees or steps_per_rev steps).
  function planOnCircle(from, to, full, over, policy) {
    if (policy !== 'unidirectional' && policy !== 'shortest') throw new RangeError('unknown policy: ' + policy);
    var s = mod(to - from, full);
    if (s * 2 > full + EPS) s -= full;
    if (Math.abs(s) < EPS) return { policy: policy, delta: 0, segments: [], final_direction: 0 };
    var segs = (s > 0 || policy === 'shortest') ? [s] : [s - over, over];
    return { policy: policy, delta: s, segments: segs, final_direction: sign(segs[segs.length - 1]) };
  }
  function planRotation(fromDeg, toDeg, policy, overshootDeg) {
    var o = overshootDeg === undefined ? CONSTANTS.overshoot_deg : overshootDeg;
    var p = planOnCircle(wrap360(fromDeg), wrap360(toDeg), 360, o, policy || 'unidirectional');
    p.delta = r6(p.delta);
    p.segments = p.segments.map(r6);
    return p;
  }

  function stationSteps(color, n) {
    var k = COLORS.indexOf(color);
    return k < 0 ? null : mod(Math.round(k * n / 4), n);
  }
  // Error is 0 after a CCW final move, -lash otherwise.
  function lostMotionError(lastDirection, lashDeg) { return lastDirection > 0 ? 0 : -lashDeg; }

  // Trapezoid (ramp > 0) or cruise-only (ramp = 0); distance in rad.
  function motionProfile(distance, rate, ramp) {
    if (distance <= 0) return { duration: 0, position: function () { return 0; } };
    if (!(ramp > 0)) {
      return { duration: distance / rate, position: function (t) { return Math.min(distance, rate * t); } };
    }
    var a = rate / ramp, rampDist = 0.5 * rate * ramp, dur, pos;
    if (distance >= 2 * rampDist) {
      var cruise = (distance - 2 * rampDist) / rate;
      dur = 2 * ramp + cruise;
      pos = function (t) {
        if (t >= dur) return distance;
        if (t < ramp) return 0.5 * a * t * t;
        if (t < ramp + cruise) return rampDist + rate * (t - ramp);
        return distance - 0.5 * a * (dur - t) * (dur - t);
      };
    } else {
      var tp = Math.sqrt(distance / a);
      dur = 2 * tp;
      pos = function (t) {
        if (t >= dur) return distance;
        return t < tp ? 0.5 * a * t * t : distance - 0.5 * a * (dur - t) * (dur - t);
      };
    }
    return { duration: dur, position: pos };
  }

  function Controller(options) {
    var o = options || {};
    var n = o.steps_per_rev === undefined ? CONSTANTS.steps_per_rev : o.steps_per_rev;
    if (!isFinite(n) || n < 8 || Math.floor(n) !== n) throw new RangeError('steps_per_rev must be an integer >= 8');
    this.cfg = {
      steps_per_rev: n,
      actual_steps_per_rev: o.actual_steps_per_rev === undefined ? n : Number(o.actual_steps_per_rev),
      lash_deg: o.lash_deg === undefined ? CONSTANTS.lash_deg : Number(o.lash_deg),
      overshoot_deg: o.overshoot_deg === undefined ? CONSTANTS.overshoot_deg : Number(o.overshoot_deg),
      index_tolerance_deg: o.index_tolerance_deg === undefined ? CONSTANTS.index_tolerance_deg : Number(o.index_tolerance_deg),
      home_offset_deg: o.home_offset_deg === undefined ? CONSTANTS.home_offset_deg : Number(o.home_offset_deg),
      home_search_limit_steps: o.home_search_limit_steps === undefined ? CONSTANTS.home_search_limit_steps : Number(o.home_search_limit_steps),
      max_reindex_attempts: o.max_reindex_attempts === undefined ? CONSTANTS.max_reindex_attempts : Number(o.max_reindex_attempts),
      policy: o.policy || 'unidirectional',
      profile: o.profile || 'hardware',
      initial_deg: o.initial_deg === undefined ? 0 : Number(o.initial_deg)
    };
    planOnCircle(0, 0, 360, 0, this.cfg.policy);
    if (this.cfg.profile !== 'hardware' && this.cfg.profile !== 'sim') throw new RangeError('unknown profile: ' + this.cfg.profile);
    this.cfg.rate = this.cfg.profile === 'sim' ? CONSTANTS.sim_rad_s : CONSTANTS.hardware_rad_s;
    this.cfg.ramp = this.cfg.profile === 'sim' ? 0 : CONSTANTS.hardware_ramp_s;
    this.y = wrap360(this.cfg.initial_deg);
    this.lastDir = 1;
    this.elapsed = 0;
    this.trace = [];
    this.ext = null;
    this._resetLogic();
  }

  Controller.prototype._resetLogic = function () {
    this.n = this.cfg.steps_per_rev;
    this.state = 'UNHOMED';
    this.pos = null;
    this.home_record = null;
    this.fault = null;
    this.attempts = 0;
    this.lastMove = null;
    this.job = null;
    this.queue = [];
    this.cur = null;
    this.inject = { move: [], home: [] };
  };

  Controller.prototype._log = function (text) {
    this.trace.push(text);
    if (this.trace.length > 256) this.trace.shift();
  };
  Controller.prototype._stepDeg = function () { return 360 / this.cfg.actual_steps_per_rev; };
  Controller.prototype.canRotate = function (snapshot) { return canRotate(snapshot); };
  Controller.prototype.planRotation = function (from, to, policy) {
    return planRotation(from, to, policy || this.cfg.policy, this.cfg.overshoot_deg);
  };
  Controller.prototype.stationSteps = function (color) { return stationSteps(color, this.n); };
  Controller.prototype.observe = function (snapshot) {
    var g = canRotate(snapshot);
    this.ext = { lift: !!snapshot && g.failed_rules.indexOf('cartridge_lift_active') >= 0 };
    return g;
  };

  Controller.prototype._stationAtPos = function () {
    if (this.pos === null) return null;
    for (var i = 0; i < COLORS.length; i++) if (stationSteps(COLORS[i], this.n) === this.pos) return COLORS[i];
    return null;
  };
  Controller.prototype._rotating = function () { return this.cur !== null || this.job !== null; };

  // Collects controller-level and snapshot-level refusals in precedence order.
  Controller.prototype._refusals = function (options, needHomed) {
    var codes = [];
    if (this.state === 'MISSED_INDEX_FAULT' || this.state === 'HARD_FAULT') codes.push('fault_active');
    if (needHomed && this.state === 'UNHOMED') codes.push('not_homed');
    var g = canRotate(options && options.snapshot ? options.snapshot : parkedSnapshot());
    g.failed_rules.forEach(function (c) { codes.push(c); });
    if (this._rotating() && codes.indexOf('busy') < 0) codes.push('busy');
    return ordered(codes);
  };
  function refused(codes) {
    return { accepted: false, verdict: 'refused', failed_rules: codes, reason: reasonFor(codes), move: null };
  }

  Controller.prototype.requestIndex = function (color, options) {
    var opt = options || {};
    if (COLORS.indexOf(color) < 0) return refused(['invalid_color']);
    var policy = opt.policy || this.cfg.policy;
    planOnCircle(0, 0, 360, 0, policy);
    var codes = this._refusals(opt, true);
    if (codes.length) return refused(codes);
    var target = stationSteps(color, this.n);
    var startColor = this._stationAtPos();
    if (this.pos === target) {
      return { accepted: true, verdict: 'already_at_station', failed_rules: [], reason: '',
        move: { start_color: startColor, target_color: color, policy: policy, planned_path_deg: [], steps: 0 } };
    }
    var move = this._startIndex(color, policy, false);
    return { accepted: true, verdict: 'started', failed_rules: [], reason: '', move: move };
  };

  Controller.prototype._startIndex = function (color, policy, isReindex) {
    var n = this.n, self = this;
    var target = stationSteps(color, n);
    var plan = planOnCircle(this.pos, target, n, Math.round(this.cfg.overshoot_deg * n / 360), policy);
    var startColor = this._stationAtPos();
    var pathDeg = plan.segments.map(function (st) { return r6(st * 360 / n); });
    this.state = 'MOVING';
    this.job = { type: 'index', color: color, target: target, policy: policy, start_color: startColor,
      path_deg: pathDeg, reindex: isReindex };
    this._log('index:' + (startColor || 'none') + '>' + color + ':' + policy);
    plan.segments.forEach(function (st) {
      self.queue.push({ kind: 'segment', steps: st, done: function () { self.pos = mod(self.pos + st, self.n); } });
    });
    this.queue.push({ kind: 'check', steps: 0, done: function () { self._finishIndex(); } });
    if (this.cur === null) this._startNext();
    return { start_color: startColor, target_color: color, policy: policy, planned_path_deg: pathDeg, steps: plan.segments.length };
  };

  Controller.prototype._finishIndex = function () {
    var job = this.job, k = COLORS.indexOf(job.color), inj = this.inject.move.shift() || null;
    if (inj) {
      if (inj.kind === 'short') this.y = wrap360(this.y - inj.deg);
      else if (inj.kind === 'over') this.y = wrap360(this.y + inj.deg);
      else this.y = wrap360(this.y + CONSTANTS.quarter_deg);
    }
    var err = wrap180(this.y - k * CONSTANTS.quarter_deg), code = null;
    if (Math.abs(err) > 45) code = 'wrong_stop';
    else if (Math.abs(err) > this.cfg.index_tolerance_deg + EPS) code = err < 0 ? 'missed_index_short' : 'missed_index_over';
    var result = { start_color: job.start_color, target_color: job.color, planned_path_deg: job.path_deg,
      policy: job.policy, achieved_deg: r6(this.y), error_deg: r6(err), station_confirmed: code === null,
      verdict: code === null ? 'indexed' : 'missed_index_fault', fault_code: code, refusal_reason: null,
      injected: !!inj, reindex: job.reindex };
    this.lastMove = result;
    this.job = null;
    if (code === null) {
      this.state = 'HOMED_CONFIRMED';
      this.fault = null;
      this.pos = job.target;
      if (job.reindex) this.attempts = 0;
      this._log('state:HOMED_CONFIRMED:' + job.color);
      return;
    }
    this.pos = null;
    this.fault = { code: code, target_color: job.color, error_deg: r6(err), attempt: this.attempts };
    if (job.reindex && this.attempts >= this.cfg.max_reindex_attempts) {
      this.fault = { code: 'hard_fault', cause: code, target_color: job.color, error_deg: r6(err), attempt: this.attempts };
      this.state = 'HARD_FAULT';
    } else {
      this.state = 'MISSED_INDEX_FAULT';
    }
    this._log('state:' + this.state + ':' + code);
  };

  Controller.prototype.reindex = function (options) {
    var opt = options || {};
    if (this.state !== 'MISSED_INDEX_FAULT') {
      var c = this.state === 'HARD_FAULT' ? ['fault_active'] : ['not_faulted'];
      return refused(c);
    }
    var codes = this._refusals(opt, false).filter(function (x) { return x !== 'fault_active'; });
    if (codes.length) return refused(codes);
    this.attempts += 1;
    var color = this.fault.target_color;
    this._log('reindex:attempt:' + this.attempts);
    this._beginHome(false, { color: color, policy: opt.policy || this.cfg.policy });
    return { accepted: true, verdict: 'started', failed_rules: [], reason: '',
      move: { target_color: color, attempt: this.attempts } };
  };

  Controller.prototype.home = function (options) {
    var opt = options || {};
    var codes = this._refusals(opt, false);
    if (codes.length) return refused(codes);
    this._beginHome(opt.calibrate === true, null);
    return { accepted: true, verdict: 'started', failed_rules: [], reason: '', move: null };
  };

  // CCW search to the hall rising edge; origin steps are counted from the RED station.
  Controller.prototype._beginHome = function (calibrate, thenIndex) {
    var self = this, sd = this._stepDeg(), lim = this.cfg.home_search_limit_steps;
    var edge = wrap360(-this.cfg.home_offset_deg);
    var d = wrap360(edge - this.y);
    if (d < EPS) d = 360;
    var i1 = stepsToReach(d, sd);
    var noEdge = this.inject.home.shift() || null;
    this.state = 'HOMING';
    this.pos = null;
    this.job = { type: 'home', calibrate: calibrate, then: thenIndex };
    this._log('home:search' + (calibrate ? ':calibrate' : ''));
    if (noEdge || i1 > lim) {
      this.queue.push({ kind: 'segment', steps: lim, done: function () {
        self.job = null;
        self.pos = null;
        self.state = 'HARD_FAULT';
        self.fault = { code: 'home_not_found', limit_steps: lim, attempt: self.attempts };
        self._log('state:HARD_FAULT:home_not_found');
      } });
    } else {
      this.queue.push({ kind: 'segment', steps: i1, done: function () {
        var delta = i1 * sd - d;
        if (calibrate) {
          var count = stepsToReach(360 - delta, sd);
          self.queue.push({ kind: 'segment', steps: count, done: function () {
            self.n = count;
            self._homeOffsetMove(count);
          } });
        } else {
          self._homeOffsetMove(null);
        }
      } });
    }
    if (this.cur === null) this._startNext();
  };

  Controller.prototype._homeOffsetMove = function (measured) {
    var self = this, off = Math.round(this.cfg.home_offset_deg * this.n / 360);
    this.queue.push({ kind: 'segment', steps: off, done: function () {
      var job = self.job;
      self.pos = 0;
      self.home_record = { calibrated: measured !== null, steps_per_rev: self.n,
        nominal_steps_per_rev: self.cfg.steps_per_rev, measured_steps_between_edges: measured,
        home_offset_deg: self.cfg.home_offset_deg, home_offset_steps: off, edge: 'ccw_rising' };
      self.state = 'HOMED_CONFIRMED';
      self.job = null;
      self._log('state:HOMED_CONFIRMED:red');
      if (job && job.then) {
        if (self.pos === stationSteps(job.then.color, self.n)) {
          self.job = { type: 'index', color: job.then.color, target: self.pos, policy: job.then.policy,
            start_color: 'red', path_deg: [], reindex: true };
          self.state = 'MOVING';
          self.queue.push({ kind: 'check', steps: 0, done: function () { self._finishIndex(); } });
        } else {
          self._startIndex(job.then.color, job.then.policy, true);
        }
      }
    } });
  };

  Controller.prototype._startNext = function () {
    if (this.cur !== null) return;
    var item = this.queue.shift();
    if (!item) { this.cur = null; return; }
    var dist = Math.abs(item.steps) * 2 * Math.PI / this.n;
    var prof = motionProfile(dist, this.cfg.rate, this.cfg.ramp);
    var dir = sign(item.steps);
    if (dir !== 0 && dir !== this.lastDir) {
      this.y = wrap360(this.y + (dir > 0 ? this.cfg.lash_deg : -this.cfg.lash_deg));
      this.lastDir = dir;
    }
    this.cur = { item: item, t: 0, dur: prof.duration, prof: prof, dist: dist, y0: this.y, dir: dir };
    if (item.kind === 'segment') this._log('segment:' + (dir > 0 ? 'ccw' : 'cw') + ':' + Math.abs(item.steps));
  };

  Controller.prototype._finishCur = function () {
    var c = this.cur;
    this.y = wrap360(c.y0 + c.item.steps * this._stepDeg());
    this.cur = null;
    if (c.item.done) c.item.done();
  };

  Controller.prototype.tick = function (dt) {
    if (typeof dt !== 'number' || !isFinite(dt) || dt < 0) throw new RangeError('dt must be a finite number >= 0');
    this.elapsed += dt;
    var left = dt, guard = 0;
    if (this.cur === null) this._startNext();
    while (this.cur !== null && guard++ < 100000) {
      var need = this.cur.dur - this.cur.t;
      if (left + 1e-12 >= need) {
        left = Math.max(0, left - need);
        this.cur.t = this.cur.dur;
        this._finishCur();
        this._startNext();
      } else {
        this.cur.t += left;
        left = 0;
        break;
      }
    }
    return this.snapshot();
  };

  Controller.prototype.injectFault = function (kind, options) {
    var opt = options || {}, i, count = opt.count === undefined ? 1 : opt.count;
    var deg = opt.deg === undefined ? CONSTANTS.fault_default_deg : opt.deg;
    if (kind === 'hard_fault') {
      this.queue = [];
      this.cur = null;
      this.job = null;
      this.pos = null;
      this.state = 'HARD_FAULT';
      this.fault = { code: 'hard_fault', cause: 'injected', attempt: this.attempts };
      this._log('state:HARD_FAULT:injected');
      return { accepted: true };
    }
    if (kind === 'home_not_found') {
      for (i = 0; i < count; i++) this.inject.home.push({ kind: kind });
      return { accepted: true };
    }
    if (kind === 'short' || kind === 'over' || kind === 'wrong_stop') {
      for (i = 0; i < count; i++) this.inject.move.push({ kind: kind, deg: deg });
      return { accepted: true };
    }
    return { accepted: false, reason: 'Unknown fault kind.' };
  };

  Controller.prototype.reset = function () {
    if (this._rotating()) return refused(['busy']);
    this._resetLogic();
    this._log('reset');
    return { accepted: true, verdict: 'reset', failed_rules: [], reason: '', move: null };
  };

  Controller.prototype.requestAuxCommand = function (kind) {
    var rule = null;
    if (kind !== 'dispense' && kind !== 'pin' && kind !== 'gate') rule = 'invalid_kind';
    else if (this._rotating()) rule = 'rotation_active';
    else if (!this._pinGateAllowed()) rule = 'station_not_confirmed';
    return { kind: kind, permitted: rule === null, rule_code: rule, reason: rule ? TEXT[rule] : '' };
  };

  Controller.prototype._pinGateAllowed = function () {
    return this.state === 'HOMED_CONFIRMED' && !this._rotating() && this._stationAtPos() !== null;
  };

  Controller.prototype.snapshot = function () {
    var y = this.y;
    if (this.cur && this.cur.dist > 0) {
      y = wrap360(this.cur.y0 + this.cur.dir * (this.cur.prof.position(this.cur.t) / this.cur.dist) *
        Math.abs(this.cur.item.steps) * this._stepDeg());
    }
    var still = this.cur === null;
    var atStation = this._pinGateAllowed() ? this._stationAtPos() : null;
    return freeze(copy({
      status: CONSTANTS.status,
      state: this.state,
      drum_state: still ? 'STILL' : 'ROTATING',
      at_station: atStation,
      station_confirmed: atStation !== null,
      pin_gate_allowed: this._pinGateAllowed(),
      sequence_active: this.job !== null,
      lift_in_progress: this.ext ? this.ext.lift : false,
      steps_per_rev: this.n,
      step_position: this.pos,
      believed_deg: this.pos === null ? null : r6(this.pos * 360 / this.n),
      drum_angle_deg: r6(y),
      policy: this.cfg.policy,
      profile: this.cfg.profile,
      home: this.home_record,
      fault: this.fault,
      reindex_attempts: this.attempts,
      max_reindex_attempts: this.cfg.max_reindex_attempts,
      last_move: this.lastMove,
      elapsed_s: r6(this.elapsed),
      trace: this.trace.slice()
    }));
  };

  Controller.CONSTANTS = freeze(copy(CONSTANTS));
  Controller.RULE_PRECEDENCE = PRECEDENCE.slice();
  Controller.canRotate = canRotate;
  Controller.planRotation = planRotation;
  Controller.stationSteps = stationSteps;
  Controller.lostMotionError = lostMotionError;
  Controller.motionProfile = motionProfile;
  Controller.parkedSnapshot = parkedSnapshot;

  root.DispenserRotationController = Controller;
}(this));
