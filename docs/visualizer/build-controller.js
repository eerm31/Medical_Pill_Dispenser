(function () {
  'use strict';
  /* Current build: ONE cartridge turned by a 28BYJ-48 stepper, no pin, no sensors.
     A plain-JS copy of electronics-ESP32/scheduling-system (schedule.cpp + cartridge_turn.cpp + main.cpp): when a dose is
     due the cartridge turns DEGREES_PER_PILL for every pill, pausing PAUSE_S after each move so the pill can fall, then
     the dose counts as taken (nothing can check it).
     Keep the constants equal to the firmware (tests/test_current_build.py compares them). ASSUMED / NOT VALIDATED. */
  var MAX_ENTRIES = 8, MAX_PILLS = 5, GRACE_MIN = 30, DAY_S = 86400;
  var DEGREES_PER_PILL = 30, PAUSE_S = 1, STEP_INTERVAL_US = 1500, STEPS_PER_REV = 4096;
  var SLOTS = 360 / DEGREES_PER_PILL;
  var STEPS_PER_S = 1e6 / STEP_INTERVAL_US;
  var DEG_PER_S = STEPS_PER_S * 360 / STEPS_PER_REV;
  var AVG_MOVE_S = DEGREES_PER_PILL / DEG_PER_S;
  /* half-steps of one move, worked out from the slot so a full turn adds up to exactly STEPS_PER_REV */
  function moveSeconds(slot) {
    var steps = Math.floor((slot + 1) * STEPS_PER_REV / SLOTS) - Math.floor(slot * STEPS_PER_REV / SLOTS);
    return steps * STEP_INTERVAL_US / 1e6;
  }

  function parse(text) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(text || ''));
    if (!m) return null;
    var h = +m[1], min = +m[2];
    return h > 23 || min > 59 ? null : h * 60 + min;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(minutes) { return pad(Math.floor(minutes / 60) % 24) + ':' + pad(minutes % 60); }
  function fmtSeconds(s) { s = Math.floor(s) % DAY_S; return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); }

  function create(opts) {
    opts = opts || {};
    var startMinutes = opts.start === undefined ? 480 : opts.start;
    var first = opts.doses || [];
    var st;

    function reset() {
      st = { seconds: startMinutes * 60, playing: true, speed: opts.speed || 10, entries: [], nextId: 1, spin: null, angle: 0, slot: 0, dispensed: 0 };
      first.forEach(function (d) { add(d[0], d[1]); });
    }
    function endOf(e) { return (e.minutes + GRACE_MIN) * 60; }
    function evaluate() {
      st.entries.forEach(function (e) {
        if (e.tomorrow) return;
        var start = e.minutes * 60, end = endOf(e);
        if (e.status === 'PENDING' && st.seconds >= start && st.seconds <= end) e.status = 'DUE';
        else if ((e.status === 'PENDING' || e.status === 'DUE') && st.seconds > end) e.status = 'MISSED';
      });
    }
    function newDay() { st.entries.forEach(function (e) { e.status = 'PENDING'; e.tomorrow = false; }); }
    function find(id) { return st.entries.filter(function (e) { return e.id === id; })[0] || null; }
    function before(a, b) { return a.minutes < b.minutes; }
    function due() {
      var best = null;
      st.entries.forEach(function (e) { if (e.status === 'DUE' && (!best || before(e, best))) best = e; });
      return best;
    }
    function add(minutes, pills) {
      if (typeof minutes === 'string') minutes = parse(minutes);
      if (minutes === null || minutes === undefined || minutes < 0 || minutes >= 1440) return { ok: false, error: 'Enter a time as HH:MM.' };
      pills = Math.round(Number(pills));
      if (!(pills >= 1 && pills <= MAX_PILLS)) return { ok: false, error: 'Pills must be 1 to ' + MAX_PILLS + '.' };
      if (st.entries.length >= MAX_ENTRIES) return { ok: false, error: 'The schedule is full (' + MAX_ENTRIES + ').' };
      if (st.entries.some(function (e) { return e.minutes === minutes; })) return { ok: false, error: 'A dose is already set at ' + fmt(minutes) + '.' };
      var e = { id: st.nextId++, minutes: minutes, pills: pills, status: 'PENDING', tomorrow: st.seconds > (minutes + GRACE_MIN) * 60 };
      st.entries.push(e);
      st.entries.sort(function (a, b) { return a.minutes - b.minutes; });
      evaluate();
      return { ok: true, id: e.id };
    }
    function remove(id) {
      if (st.spin && st.spin.id === id) return false;
      var n = st.entries.length;
      st.entries = st.entries.filter(function (e) { return e.id !== id; });
      return st.entries.length < n;
    }
    function setClock(minutes) {
      if (minutes === null || minutes === undefined) return false;
      var seconds = minutes * 60, wrapped = seconds < st.seconds;
      st.seconds = seconds;
      if (wrapped) newDay();
      evaluate();
      return true;
    }
    function advance(dt) {
      st.seconds += dt * st.speed;
      if (st.seconds >= DAY_S) { st.seconds -= DAY_S; newDay(); }
      evaluate();
    }
    /* dt = real seconds. Returns the number of pills that left the cartridge during this call. */
    function tick(dt) {
      var dropped = 0;
      if (!st.playing || !(dt > 0)) return 0;
      advance(dt);
      if (!st.spin) {
        var d = due();
        if (d) { d.status = 'TAKING'; st.spin = { id: d.id, pills: d.pills, out: 0, phase: 'move', t: 0, fromAngle: st.angle, moveS: moveSeconds(st.slot) }; }
      }
      if (st.spin) {
        var s = st.spin, left = dt;
        while (left > 0 && st.spin) {
          if (s.phase === 'move') {
            var use = Math.min(left, s.moveS - s.t);
            s.t += use; left -= use;
            st.angle = s.fromAngle + DEGREES_PER_PILL * (s.t / s.moveS);
            if (s.t >= s.moveS - 1e-9) {
              st.slot = (st.slot + 1) % SLOTS; st.angle = st.slot * DEGREES_PER_PILL;
              s.out += 1; dropped += 1; st.dispensed += 1; s.phase = 'pause'; s.t = 0;
            }
          } else {
            var wait = Math.min(left, PAUSE_S - s.t);
            s.t += wait; left -= wait;
            if (s.t >= PAUSE_S - 1e-9) {
              if (s.out < s.pills) { s.phase = 'move'; s.t = 0; s.fromAngle = st.angle; s.moveS = moveSeconds(st.slot); }
              else { var e = find(s.id); if (e) e.status = 'TAKEN'; st.spin = null; }
            }
          }
        }
      }
      return dropped;
    }
    function stop() {
      if (!st.spin) return;
      var e = find(st.spin.id);
      if (e) e.status = 'DUE';
      st.spin = null;
    }
    function snapshot() {
      var sp = null;
      if (st.spin) {
        var cycle = AVG_MOVE_S + PAUSE_S, o = st.spin.out, t = st.spin.t;
        sp = { id: st.spin.id, pills: st.spin.pills, out: o, phase: st.spin.phase, elapsed: st.spin.phase === 'move' ? o * cycle + t : (o - 1) * cycle + AVG_MOVE_S + t, total: st.spin.pills * cycle };
      }
      return {
        seconds: st.seconds, clock: fmtSeconds(st.seconds), playing: st.playing, speed: st.speed, angle: st.angle,
        entries: st.entries.map(function (e) { return { id: e.id, minutes: e.minutes, time: fmt(e.minutes), pills: e.pills, status: e.status, tomorrow: e.tomorrow }; }),
        spin: sp,
        dispensed: st.dispensed, count: st.entries.length
      };
    }
    reset();
    return {
      add: add, remove: remove, setClock: setClock, tick: tick, snapshot: snapshot, reset: reset, stop: stop,
      setPlaying: function (on) { st.playing = !!on; },
      setSpeed: function (x) { st.speed = Math.max(1, +x || 1); }
    };
  }

  window.DispenserBuild = {
    create: create, parse: parse, fmt: fmt,
    MAX_ENTRIES: MAX_ENTRIES, MAX_PILLS: MAX_PILLS, GRACE_MIN: GRACE_MIN,
    DEGREES_PER_PILL: DEGREES_PER_PILL, PAUSE_S: PAUSE_S, STEP_INTERVAL_US: STEP_INTERVAL_US, STEPS_PER_REV: STEPS_PER_REV, DEG_PER_S: DEG_PER_S
  };
}());
