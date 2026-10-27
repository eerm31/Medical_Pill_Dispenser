(function (root) {
  'use strict';
  /* Subsystem 4 schedule logic (Feature 010; ASSUMED / NOT_VALIDATED concept, no clinical or dosing claim).
     A simulated clock and a list of scheduled pills. The user types a pill colour and a HH:MM time on the touchscreen; when the clock reaches
     that time the entry becomes DUE, the LED pulses amber and the screen asks for a tap on TAKE. The tap (not the clock) starts the dispense.
     No randomness and no network time: the clock moves only when the user advances it or lets it play (1 simulated minute per real second). */
  var COLORS = ['red', 'blue', 'green', 'orange'];
  var DAY = 86400, GRACE_MIN = 30, MAX_ENTRIES = 8, SPEED = 60;

  function parse(text) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(text).trim());
    if (!m) return null;
    var h = Number(m[1]), mi = Number(m[2]);
    return h < 24 && mi < 60 ? h * 60 + mi : null;
  }
  function fmt(minutes) { var h = Math.floor(minutes / 60) % 24, m = Math.floor(minutes % 60); return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }

  function create(opts) {
    opts = opts || {};
    var st = { seconds: (opts.start === undefined ? 8 * 60 : opts.start) * 60, playing: false, entries: [], nextId: 1 };

    function minutesNow() { return st.seconds / 60; }
    // PENDING -> DUE when the clock reaches the entry; DUE -> MISSED after the grace period. TAKING, TAKEN and FAILED are set by the take flow.
    function evaluate() {
      var now = minutesNow();
      st.entries.forEach(function (e) {
        if (e.tomorrow) return;
        if (e.status === 'PENDING' && now >= e.minutes && now <= e.minutes + GRACE_MIN) e.status = 'DUE';
        else if ((e.status === 'PENDING' || e.status === 'DUE') && now > e.minutes + GRACE_MIN) e.status = 'MISSED';
      });
    }
    function newDay() { st.entries.forEach(function (e) { e.status = 'PENDING'; e.tomorrow = false; e.verdict = null; }); }
    function sorted() { return st.entries.slice().sort(function (a, b) { return a.minutes - b.minutes || COLORS.indexOf(a.color) - COLORS.indexOf(b.color); }); }

    function add(color, time) {
      if (COLORS.indexOf(color) < 0) return { ok: false, error: 'Pick a pill colour.' };
      var minutes = parse(time);
      if (minutes === null) return { ok: false, error: 'Enter the time as HH:MM (00:00 to 23:59).' };
      if (st.entries.length >= MAX_ENTRIES) return { ok: false, error: 'The schedule is full (' + MAX_ENTRIES + ' entries).' };
      if (st.entries.some(function (e) { return e.color === color && e.minutes === minutes; })) return { ok: false, error: 'That pill is already scheduled at ' + fmt(minutes) + '.' };
      var e = { id: st.nextId++, color: color, minutes: minutes, time: fmt(minutes), status: 'PENDING', tomorrow: minutesNow() > minutes + GRACE_MIN };
      st.entries.push(e); evaluate();
      return { ok: true, id: e.id, status: e.status };
    }
    function remove(id) { var n = st.entries.length; st.entries = st.entries.filter(function (e) { return e.id !== id; }); return st.entries.length < n; }
    function setClock(time) {
      var minutes = parse(time); if (minutes === null) return false;
      st.seconds = minutes * 60; evaluate(); return true;
    }
    function advance(minutes) {
      var before = st.seconds; st.seconds += minutes * 60;
      if (st.seconds >= DAY) { st.seconds -= DAY * Math.floor(st.seconds / DAY); newDay(); }
      if (st.seconds < 0) st.seconds = 0;
      evaluate(); return st.seconds !== before;
    }
    // real elapsed seconds; moves the clock only while playing
    function tick(dtSec) { if (st.playing && dtSec > 0) advance(dtSec * SPEED / 60); }
    function setPlaying(on) { st.playing = Boolean(on); }
    function find(id) { return st.entries.filter(function (e) { return e.id === id; })[0] || null; }
    function dueEntry() { return sorted().filter(function (e) { return e.status === 'DUE'; })[0] || null; }
    function beginTake(id) { var e = find(id); if (!e || e.status !== 'DUE') return false; e.status = 'TAKING'; return true; }
    function abortTake(id) { var e = find(id); if (e && e.status === 'TAKING') e.status = 'DUE'; }
    // verdict comes from the verification subsystem: only VERIFIED counts as taken
    function finishTake(id, verdict) { var e = find(id); if (!e || e.status !== 'TAKING') return false; e.status = verdict === 'VERIFIED' ? 'TAKEN' : 'FAILED'; e.verdict = verdict; return true; }
    function snapshot() {
      var list = sorted().map(function (e) { return { id: e.id, color: e.color, time: e.time, status: e.status, verdict: e.verdict || null, tomorrow: Boolean(e.tomorrow) }; });
      var next = list.filter(function (e) { return e.status === 'PENDING' && !e.tomorrow; })[0] || list.filter(function (e) { return e.status === 'PENDING'; })[0] || null;
      return { clock: fmt(minutesNow()), seconds: st.seconds, playing: st.playing, entries: list, due: dueEntry(), next: next, count: list.length, max: MAX_ENTRIES, grace: GRACE_MIN };
    }
    evaluate();
    return { add: add, remove: remove, setClock: setClock, advance: advance, tick: tick, setPlaying: setPlaying, beginTake: beginTake, abortTake: abortTake, finishTake: finishTake, snapshot: snapshot, due: dueEntry };
  }
  root.DispenserSchedule = { create: create, parse: parse, fmt: fmt, COLORS: COLORS, GRACE_MIN: GRACE_MIN, MAX_ENTRIES: MAX_ENTRIES, SPEED: SPEED };
}(window));
