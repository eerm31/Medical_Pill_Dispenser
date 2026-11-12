(function () {
  'use strict';
  /* UI System for the dispenser electronics (Arduino Uno / ESP32-S3).
     A medication schedule table (name, time, pills). The page first looks for the board over USB (Web Serial, Chrome or
     Edge); when the board answers it shows a green check mark. "Save schedule" sets the board's clock, sends the doses
     and tells the board to keep them in its memory, so it turns the cartridge by itself at those times.
     The medication names stay in this browser (they are for the barcode scanner later); the board only gets time and pills.
     Works offline from file://. The same file is used for both boards; the board settings come from window.SCHEDULER_BOARD.
     Keep the constants and commands equal to the firmware (tests/test_scheduler_ui.py compares them). ASSUMED / NOT VALIDATED. */
  var BOARD = window.SCHEDULER_BOARD;
  var MAX_ENTRIES = 12, MAX_PILLS = 5, RING_CAPACITY = 11, HISTORY_MAX = 10;
  var STORE_KEY = 'dispenser-ui-system-' + BOARD.short;

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag), k;
    for (k in (attrs || {})) { 
      if (k === 'text') n.textContent = attrs[k]; 
      else if (k === 'hidden') { if (attrs[k]) n.setAttribute('hidden', ''); else n.removeAttribute('hidden'); }
      else n.setAttribute(k, attrs[k]); 
    }
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }
  function wait(ms) { return new Promise(function (resolve) { window.setTimeout(resolve, ms); }); }

  // ---------- rules (same as schedule.cpp) ----------
  function parseTime(text) {
    var m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(text || ''));
    if (!m) return null;
    var h = +m[1], min = +m[2], sec = m[3] ? +m[3] : 0;
    return h > 23 || min > 59 || sec > 59 ? null : h * 3600 + min * 60 + sec;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function formatTimeHMS(seconds) {
    var h = Math.floor(seconds / 3600) % 24;
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }
  function nowText() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }

  // ---------- 12-hour display (times are stored as 24-hour HH:MM:SS and only shown as AM/PM) ----------
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function ampm(h, m, s, withSeconds) {
    return (h % 12 || 12) + ':' + pad(m) + (withSeconds ? ':' + pad(s) : '') + ' ' + (h >= 12 ? 'PM' : 'AM');
  }
  // "20:05" or "20:05:09" -> "8:05 PM" / "8:05:09 PM"
  function text12(text, withSeconds) {
    var t = parseTime(text);
    if (t === null) return String(text || '');
    return ampm(Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60, withSeconds);
  }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function shortDate(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    return m ? MONTHS[+m[2] - 1].slice(0, 3) + ' ' + (+m[3]) : String(key || '');
  }
  // "2026-11-12" + "08:00:12" -> "Nov 12, 8:00:12 AM"
  function stampText(date, time) { return shortDate(date) + ', ' + text12(time, true); }
  function msText(ms) { var d = new Date(ms); return shortDate(dateKey(d)) + ', ' + ampm(d.getHours(), d.getMinutes(), d.getSeconds(), true); }
  function liveClockText(d) {
    return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' \u2014 ' + ampm(d.getHours(), d.getMinutes(), d.getSeconds(), true);
  }
  function elapsedText(sinceMs) { return Math.max(0, Math.floor((Date.now() - sinceMs) / 1000)) + ' s'; }
  function tickClock() {
    var d = new Date();
    $('liveClock').textContent = liveClockText(d);
    Array.prototype.forEach.call(document.querySelectorAll('.live-elapsed'), function (n) { n.textContent = elapsedText(Number(n.getAttribute('data-since'))); });
    window.setTimeout(tickClock, 1000 - (d.getTime() % 1000) + 5);   // next whole second of the real system clock
  }

  // expand a dose with recurrence into multiple individual doses (24h window)
  function expandDose(dose) {
    if (!dose.recur || !dose.recur.num || !dose.recur.unit) return [dose];
    var expanded = [], startSec = parseTime(dose.time);
    if (startSec === null) return [dose];
    var intervalMs = 0;
    if (dose.recur.unit === 'h') intervalMs = dose.recur.num * 3600000;
    else if (dose.recur.unit === 'm') intervalMs = dose.recur.num * 60000;
    else if (dose.recur.unit === 's') intervalMs = dose.recur.num * 1000;
    if (intervalMs <= 0) return [dose];
    var now = new Date(), dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var startMs = dayStart.getTime() + startSec * 1000;
    for (var offset = 0; offset < 86400000; offset += intervalMs) {
      var ms = startMs + offset;
      if (ms >= dayStart.getTime() + 86400000) break;  // stop after 24h
      var d = new Date(ms);
      var timeStr = formatTimeHMS((ms - dayStart.getTime()) / 1000);
      expanded.push({ name: dose.name, time: timeStr, pills: dose.pills, recur: null });
    }
    return expanded.length ? expanded : [dose];
  }

  function recurText(recur) {
    if (!recur || !recur.num || !recur.unit) return '';
    var units = { h: 'hour', m: 'min', s: 'sec' };
    return 'Every ' + recur.num + ' ' + units[recur.unit] + (recur.num > 1 ? 's' : '');
  }

  // does this dose (or one of its repeats) have the scheduled time "secs" (seconds since midnight)?
  function doseAt(d, secs) {
    return parseTime(d.time) === secs || expandDose(d).some(function (e) { return parseTime(e.time) === secs; });
  }
  function savedIndexFor(fwId, secs) {
    var i;
    if (fwId) for (i = 0; i < state.savedDoses.length; i++) if (state.savedDoses[i].fwId === fwId) return i;
    for (i = 0; i < state.savedDoses.length; i++) if (state.savedDoses[i].fwId == null && doseAt(state.savedDoses[i], secs)) return i;
    return -1;
  }
  // the board numbers its doses; a schedule keeps that number so a repeating dose, whose time moves, is still found
  function mapBoardDose(id, secs) {
    for (var i = 0; i < state.savedDoses.length; i++) {
      var d = state.savedDoses[i];
      if (d.fwId == null && parseTime(d.time) === secs) { d.fwId = id; save(); return; }
    }
  }

  // the board confirmed a step of a dose: remember the real time on the table row of that dose
  function recordDispensedTimestamp(fwId, scheduledSecs, actualMs, label) {
    var actual = new Date(actualMs), hit = savedIndexFor(fwId, scheduledSecs);
    var dateStr = dateKey(actual), timeStr = pad(actual.getHours()) + ':' + pad(actual.getMinutes()) + ':' + pad(actual.getSeconds());
    var targets = hit >= 0 ? [state.savedDoses[hit]] : state.doses.filter(function (d) { return doseAt(d, scheduledSecs); });
    targets.forEach(function (d) {
      if (!d.timestamps) d.timestamps = [];
      d.timestamps.push({ date: dateStr, time: timeStr, label: label });
    });
  }
  function stampLine(ts) { return '\u251c\u2500 ' + (ts.label || '\u2713') + '  ' + stampText(ts.date, ts.time); }

  // the line under a saved schedule's status: a dose that is turning right now (with a ticking time), else the last real dispensing
  function liveLine(d) {
    for (var i = state.history.length - 1; i >= 0; i--) {
      var r = state.history[i];
      if (r.status !== 'DISPENSING' || !r.startedAt || Date.now() - r.startedAt > 120000) continue;   // an old open record is a missed end line
      if (d.fwId != null ? r.fwId === d.fwId : doseAt(d, parseTime(r.scheduled))) {
        return el('div', { class: 'live-line live' }, [
          el('span', { class: 'live-dot', text: '\u25cf ' }),
          el('span', { text: 'Dispensing ' + r.dispensed + '/' + r.required + ' \u00b7 ' }),
          el('span', { class: 'live-elapsed', 'data-since': String(r.startedAt), text: elapsedText(r.startedAt) })
        ]);
      }
    }
    var last = null;
    (d.timestamps || []).forEach(function (ts) { if (/^Completed/.test(ts.label || '')) last = ts; });
    return last ? el('div', { class: 'live-line', text: 'Last dispensed ' + stampText(last.date, last.time) }) : null;
  }
  // a ▶/▼ button that opens or closes the rows kept in "open" under key "key"
  function expandToggle(open, key, what) {
    var isOpen = !!open[key];
    var b = el('button', { type: 'button', class: 'expand', 'aria-label': 'Show all timestamps, ' + what, 'aria-expanded': isOpen ? 'true' : 'false', text: isOpen ? '\u25bc' : '\u25b6' });
    b.addEventListener('click', function () {
      if (isOpen) delete open[key];
      else open[key] = true;
      renderRows();
    });
    return b;
  }

  // ---------- dosage history: one record per dispensing and one for every schedule that ends (FINISHED or DELETED) ----------
  var DONE = { COMPLETED: 1, INCOMPLETE: 1, FAILED: 1, FINISHED: 1, DELETED: 1 };
  var END_LABEL = { COMPLETED: 'Completed', INCOMPLETE: 'Stopped', FAILED: 'Failed' };
  var lastRequired = 1;   // pills of the last dose the board reported
  function openRecord(fwId) {
    for (var i = state.history.length - 1; i >= 0; i--) {
      if (state.history[i].fwId === fwId && state.history[i].status === 'DISPENSING') return state.history[i];
    }
    return null;
  }
  function newRecord(fwId, sched, required, status) {
    var now = Date.now(), i = savedIndexFor(fwId, sched), n = ++state.seq;
    var rec = {
      id: 'dose-' + now + '-' + n, n: n, fwId: fwId, scheduledDate: dateKey(new Date(now)), scheduled: formatTimeHMS(sched),
      name: i >= 0 ? state.savedDoses[i].name : '', required: required, dispensed: 0,
      startedAt: null, completedAt: null, endedAt: null, status: status, events: [], timestamps: []
    };
    state.history.push(rec);
    while (state.history.length > HISTORY_MAX) state.history.shift();   // like the board, keep only the last 10
    return rec;
  }
  function historyStart(fwId, sched, required) {
    var stale = openRecord(fwId);
    if (stale) { stale.status = 'INCOMPLETE'; stale.endedAt = Date.now(); }   // the board started this id again
    var now = Date.now(), rec = newRecord(fwId, sched, required, 'DISPENSING');
    rec.startedAt = now;
    rec.events.push({ label: 'Started', ms: now });
    recordDispensedTimestamp(fwId, sched, now, 'Started');
    save();
    renderRows();
  }
  function historyPill(fwId, done, left) {
    var rec = openRecord(fwId), now = Date.now();
    if (rec) {
      var label = 'Pill ' + done + '/' + rec.required + ' out';
      rec.dispensed = done;
      rec.events.push({ label: label, ms: now });
      recordDispensedTimestamp(fwId, parseTime(rec.scheduled), now, label);
    }
    setRing(left);
  }
  function historyEnd(fwId, sched, status, done, required, left) {
    lastRequired = required;
    if (status === 'FINISHED') { setRing(left); return; }   // the "schedule FINISHED" line that follows makes the FINISHED row
    var rec = openRecord(fwId) || newRecord(fwId, sched, required, status), now = Date.now();
    var label = END_LABEL[status] + (status === 'COMPLETED' ? '' : ' (' + done + '/' + required + ')');
    rec.status = status;
    rec.dispensed = done;
    rec.required = required;
    rec.endedAt = now;
    if (status === 'COMPLETED') rec.completedAt = now;   // only a full dose has a completion time
    rec.events.push({ label: label, ms: now });
    recordDispensedTimestamp(fwId, sched, now, label);
    setRing(left);
  }
  // a schedule ends: its row keeps every timestamp the schedule collected, and the schedule leaves the saved table
  function endSchedule(status, label, dose, index, sched, required) {
    var now = Date.now(), rec = newRecord(0, sched, required, status);
    if (dose) rec.name = dose.name;
    rec.endedAt = now;
    rec.events.push({ label: label, ms: now });
    rec.timestamps = dose ? (dose.timestamps || []).slice() : [];
    if (index >= 0) state.savedDoses.splice(index, 1);
    expandedSaved = {};
    save();
    renderRows();
  }
  function historyFinished(fwId, sched) {
    var i = savedIndexFor(fwId, sched);
    endSchedule('FINISHED', 'Finished', i >= 0 ? state.savedDoses[i] : null, i, sched, i >= 0 ? state.savedDoses[i].pills : lastRequired);
  }
  function archiveDeletedSchedule(dose, index) {
    endSchedule('DELETED', 'Deleted', dose, index, parseTime(dose.time) || 0, dose.pills);
  }
  function setRing(pills) {
    var n = Number(pills);
    state.ring = { pills: n };
    if (state.ringMax === null || n > state.ringMax) state.ringMax = n;   // a bigger count than the known max raises it
    save();
    renderRows();
  }
  // the max of the ring is the count when the last fill was confirmed (never above RING_CAPACITY); before any fill it shows the limit
  function ringMaxShown() { return state.ringMax > 0 ? Math.max(state.ringMax, state.ring.pills || 0) : RING_CAPACITY; }

  var state = load();
  var expandedRows = {};  // track which rows are expanded
  var expandedSaved = {}, expandedHistory = {};
  var scheduleIsSaved = false;
  function load() {
    var s = { doses: [], savedDoses: [], history: [], seq: 0, ring: { pills: null }, ringMax: null, pendingRm: [] };
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null');
      if (saved) {
        if (Array.isArray(saved.doses)) {
          s.doses = saved.doses.map(function (d) {
            return {
              name: String(d.name || '').slice(0, 40),
              time: String(d.time),
              pills: Number(d.pills),
              fwId: d.fwId == null ? null : Number(d.fwId),
              recur: d.recur ? { num: Number(d.recur.num), unit: String(d.recur.unit) } : null,
              timestamps: Array.isArray(d.timestamps) ? d.timestamps : []
            };
          });
        }
        if (Array.isArray(saved.savedDoses)) {
          s.savedDoses = saved.savedDoses.map(function (d) {
            return {
              name: String(d.name || '').slice(0, 40),
              time: String(d.time),
              pills: Number(d.pills),
              fwId: d.fwId == null ? null : Number(d.fwId),
              recur: d.recur ? { num: Number(d.recur.num), unit: String(d.recur.unit) } : null,
              timestamps: Array.isArray(d.timestamps) ? d.timestamps : []
            };
          });
        }
        if (Array.isArray(saved.history)) {
          s.history = saved.history.map(function (r) {
            var num = function (v) { return v === null || v === undefined ? null : Number(v); };
            return {
              id: String(r.id), n: Number(r.n) || 0, fwId: Number(r.fwId), scheduledDate: String(r.scheduledDate), scheduled: String(r.scheduled),
              name: String(r.name || '').slice(0, 40), required: Number(r.required), dispensed: Number(r.dispensed),
              startedAt: num(r.startedAt), completedAt: num(r.completedAt), endedAt: num(r.endedAt),
              status: DONE[r.status] ? r.status : 'DISPENSING',
              events: Array.isArray(r.events) ? r.events.map(function (e) { return { label: String(e.label), ms: Number(e.ms) }; }) : [],
              timestamps: Array.isArray(r.timestamps) ? r.timestamps : []
            };
          });
        }
        // the old separate Data Logs table becomes FINISHED / DELETED rows of the history
        if (Array.isArray(saved.dataLogs)) {
          saved.dataLogs.forEach(function (d, i) {
            var deleted = d.status === 'DELETED', day = String((deleted ? d.deletedDate : d.completedDate) || '');
            var ms = Date.parse(day + 'T00:00:00') || Date.now();
            s.history.push({
              id: 'log-' + ms + '-' + i, n: 0, fwId: 0, scheduledDate: day, scheduled: formatTimeHMS(parseTime(d.time) || 0),
              name: String(d.name || '').slice(0, 40), required: Number(d.pills), dispensed: 0,
              startedAt: null, completedAt: null, endedAt: ms, status: deleted ? 'DELETED' : 'FINISHED',
              events: [], timestamps: Array.isArray(d.timestamps) ? d.timestamps : []
            });
          });
        }
        s.history.sort(function (a, b) { return (a.startedAt || a.endedAt || 0) - (b.startedAt || b.endedAt || 0); });
        s.seq = Number(saved.seq) || 0;
        s.history.forEach(function (r) { s.seq = Math.max(s.seq, r.n); });
        s.history.forEach(function (r) { if (!r.n) r.n = ++s.seq; });
        while (s.history.length > HISTORY_MAX) s.history.shift();
        if (saved.ring && saved.ring.pills !== null && saved.ring.pills !== undefined) s.ring = { pills: Number(saved.ring.pills) };
        if (saved.ringMax !== null && saved.ringMax !== undefined) s.ringMax = Number(saved.ringMax);
        if (Array.isArray(saved.pendingRm)) s.pendingRm = saved.pendingRm.map(Number);
      }
    } catch (e) { /* no storage, start empty */ }
    return s;
  }
  function save() { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  function check() {
    var errors = [], seen = {}, i;
    state.doses.forEach(function (d, i) {
      var t = parseTime(d.time), label = 'Row ' + (i + 1);
      if (t === null) errors.push(label + ': choose a time.');
      else if (seen[t]) errors.push(label + ': another dose already uses ' + text12(d.time) + ' as a start time.');
      else seen[t] = true;
      if (!(d.pills >= 1 && d.pills <= MAX_PILLS && Math.floor(d.pills) === d.pills)) errors.push(label + ': pills must be a whole number from 1 to ' + MAX_PILLS + '.');
      if (d.recur && d.recur.num && d.recur.unit) {
        if (!(d.recur.num > 0 && d.recur.num <= 24)) errors.push(label + ': recurrence interval must be from 1 to 24.');
      }
    });
    return errors;
  }

  function sortDoses() {
    state.doses.sort(function (a, b) { return (parseTime(a.time) === null ? 9999 : parseTime(a.time)) - (parseTime(b.time) === null ? 9999 : parseTime(b.time)); });
  }

  // ---------- render both the saved and to-be-added tables ----------
  function renderRows() {
    // Render SAVED doses table
    var savedBody = $('savedRows');
    savedBody.textContent = '';
    state.savedDoses.forEach(function (d, i) {
      var recurLabel = el('span', { class: 'recur-label', text: recurText(d.recur) || '—' });
      // complete doses the ring can still give = floor(pills in ring / pills per dose); never a partial dose
      var left = state.ring.pills === null ? null : Math.floor(state.ring.pills / d.pills);
      var isFinished = left === 0;
      var statusLabel = el('span', { class: 'status-label ' + (isFinished ? 'finished' : ''), text: left === null ? '—' : (isFinished ? 'FINISHED' : left + (left === 1 ? ' dose left' : ' doses left')) });
      var pillsLeft = el('span', { class: 'pills-left' + (state.ring.pills === 0 ? ' none' : ''), text: state.ring.pills === null ? '—' : state.ring.pills + ' / ' + ringMaxShown() });
      var pillsCell = el('td', { class: 'pills-cell' }, [pillsLeft]);
      if (state.ring.pills !== null && state.ring.pills >= RING_CAPACITY) {
        pillsCell.appendChild(el('span', { class: 'badge st-completed', text: 'FULL' }));
      } else {
        // the refill starts here (see refill.js); the button shimmers when this dose cannot be given any more
        var fillBtn = el('button', { type: 'button', class: 'fill-btn' + (isFinished ? ' shimmer' : ''), text: 'Fill', 'aria-label': 'Fill the cartridge for ' + d.name });
        fillBtn.disabled = !connected;
        fillBtn.addEventListener('click', function () { document.dispatchEvent(new CustomEvent('ui:refill', { detail: { ring: 0 } })); });
        pillsCell.appendChild(fillBtn);
      }
      var statusCell = el('td', {}, [statusLabel]);
      var live = liveLine(d);
      if (live) statusCell.appendChild(live);
      
      var editBtn = el('button', { type: 'button', class: 'edit-dose', text: 'Edit', 'aria-label': 'Edit saved dose ' + (i + 1) });
      editBtn.addEventListener('click', function () {
        // move dose from savedDoses back to doses for editing
        var dose = state.savedDoses.splice(i, 1)[0];
        // reset timestamps when moving to edit (user can review in history but they're cleared for re-save)
        dose.timestamps = [];
        state.doses.push(dose);
        sortDoses();
        save();
        renderRows();
      });
      
      var deleteBtn = el('button', { type: 'button', class: 'remove', text: 'Remove', 'aria-label': 'Remove saved dose ' + (i + 1) });
      deleteBtn.addEventListener('click', function () {
        askConfirm('Delete this schedule?', '"' + d.name + '" at ' + text12(d.time) + ' will be deleted and its dosing on the Arduino stops at once. This cannot be undone. It stays in the history with the status DELETED.', 'Delete schedule', function () {
          deleteSavedDose(d);
        });
      });
      
      var compactRow = el('tr', { class: 'dose-compact' }, [
        el('td', { text: d.name }),
        el('td', { text: text12(d.time) }),
        el('td', { text: String(d.pills) }),
        el('td', {}, [recurLabel]),
        pillsCell,
        statusCell,
        el('td', {}, [expandToggle(expandedSaved, i, 'saved dose ' + (i + 1))]),
        el('td', {}, [editBtn]),
        el('td', {}, [deleteBtn])
      ]);
      savedBody.appendChild(compactRow);
      
      // every timestamp of this schedule, until it is FINISHED or DELETED
      if (expandedSaved[i]) {
        var stamps = d.timestamps && d.timestamps.length ? d.timestamps.map(stampLine) : ['No timestamps yet.'];
        stamps.forEach(function (text) {
          savedBody.appendChild(el('tr', { class: 'dose-expanded' }, [el('td', { colspan: '9', text: text })]));
        });
      }
    });
    $('savedEmptyMsg').hidden = state.savedDoses.length > 0;
    // with no schedule the same Fill button is the prompt, shimmering until the cartridge has pills
    var emptyFill = $('emptyFillBtn');
    emptyFill.hidden = state.savedDoses.length > 0 || (state.ring.pills !== null && state.ring.pills >= RING_CAPACITY);
    emptyFill.disabled = !connected;
    emptyFill.className = 'fill-btn' + (state.ring.pills === null || state.ring.pills === 0 ? ' shimmer' : '');
    $('savedTable').hidden = state.savedDoses.length === 0;
    $('savedCount').textContent = state.savedDoses.length + ' saved';
    
    // Render TO-BE-ADDED doses table
    var body = $('doseRows');
    body.textContent = '';
    state.doses.forEach(function (d, i) {
      var isExpanded = expandedRows[i];
      
      // compact row (the main row shown always)
      var name = el('input', { type: 'text', value: d.name, maxlength: '40', placeholder: 'Medication name', 'aria-label': 'Medication name, row ' + (i + 1) });
      var time = el('input', { type: 'time', value: d.time, required: '', 'aria-label': 'Time, row ' + (i + 1) });
      var pills = el('input', { type: 'number', min: '1', max: String(MAX_PILLS), step: '1', value: String(d.pills), 'aria-label': 'Pills, row ' + (i + 1) });
      var recurLabel = el('span', { class: 'recur-label', text: recurText(d.recur) || '—' });
      var expandBtn = el('button', { type: 'button', class: 'expand', 'aria-label': 'Toggle dose history, row ' + (i + 1), text: isExpanded ? '▼' : '▶' });
      var editBtn = el('button', { type: 'button', class: 'edit-dose', text: 'Edit', 'aria-label': 'Edit dose settings, row ' + (i + 1) });
      var rm = el('button', { type: 'button', class: 'remove', text: 'Remove', 'aria-label': 'Remove row ' + (i + 1) });
      
      name.addEventListener('input', function () { d.name = name.value; changed(); });
      time.addEventListener('input', function () { d.time = time.value; changed(); });
      time.addEventListener('change', function () { sortDoses(); renderRows(); });
      pills.addEventListener('input', function () { d.pills = Number(pills.value); changed(); });
      expandBtn.addEventListener('click', function () {
        if (isExpanded) delete expandedRows[i];
        else expandedRows[i] = true;
        renderRows();
      });
      editBtn.addEventListener('click', function () { showDoseEditor(i); });
      rm.addEventListener('click', function () { state.doses.splice(i, 1); delete expandedRows[i]; renderRows(); changed(); });
      
      var compactRow = el('tr', { class: 'dose-compact' }, [el('td', {}, [name]), el('td', {}, [time]), el('td', {}, [pills]), el('td', {}, [recurLabel]), el('td', {}, [expandBtn]), el('td', {}, [editBtn]), el('td', {}, [rm])]);
      body.appendChild(compactRow);
      
      // expanded rows with timestamps (live from Arduino) - show when expanded
      if (isExpanded) {
        var addStamps = d.timestamps && d.timestamps.length ? d.timestamps.map(stampLine) : ['No timestamps yet.'];
        addStamps.forEach(function (text) {
          body.appendChild(el('tr', { class: 'dose-expanded' }, [el('td', { colspan: '7', text: text })]));
        });
      }
    });
    $('emptyMsg').hidden = state.doses.length > 0;
    $('doseTable').hidden = state.doses.length === 0;
    $('doseCount').textContent = state.doses.length + ' to add';
    
    renderHistory();
    fireChange();
  }

  // ---------- dosage history (the only log): newest first, every row opens to show its timestamps ----------
  var STATUS_CLASS = { COMPLETED: 'st-completed', FAILED: 'st-failed', INCOMPLETE: 'st-incomplete', FINISHED: 'st-finished', DELETED: 'st-deleted', DISPENSING: 'st-dispensing' };
  function historyDetails(r) {
    var lines = (r.events || []).map(function (e) { return e.label + '  ' + msText(e.ms); });
    (r.timestamps || []).forEach(function (ts) { lines.push(stampLine(ts)); });
    return lines.length ? lines : ['No timestamps were recorded.'];
  }
  function renderHistory() {
    var rows = state.history.slice().sort(function (a, b) { return (b.startedAt || b.endedAt || 0) - (a.startedAt || a.endedAt || 0); });
    var body = $('historyRows');
    body.textContent = '';
    rows.forEach(function (r, i) {
      var ended = r.status === 'FINISHED' || r.status === 'DELETED';
      var label = [el('span', { text: 'Dose ' + r.n })];
      if (r.name) label.push(el('span', { class: 'recur-label', text: ' ' + r.name }));
      if (i === 0) label.push(el('span', { class: 'badge st-latest', text: 'Latest' }));
      body.appendChild(el('tr', { class: 'dose-compact' + (i === 0 ? ' latest' : '') }, [
        el('td', {}, [expandToggle(expandedHistory, r.id, 'dosage ' + r.n)]),
        el('td', {}, label),
        el('td', { text: stampText(r.scheduledDate, r.scheduled) }),
        el('td', { text: r.startedAt ? msText(r.startedAt) : '—' }),
        el('td', { text: r.completedAt ? msText(r.completedAt) : '—' }),
        el('td', { text: r.status === 'DELETED' ? '—' : r.dispensed + '/' + r.required }),
        el('td', {}, [el('span', { class: 'badge ' + STATUS_CLASS[r.status], text: r.status })])
      ]));
      if (expandedHistory[r.id]) {
        historyDetails(r).forEach(function (text) {
          body.appendChild(el('tr', { class: 'dose-expanded' }, [el('td', { colspan: '7', text: text })]));
        });
      }
    });
    $('historyTable').hidden = rows.length === 0;
    $('historyEmptyMsg').hidden = rows.length > 0;
    $('clearHistoryBtn').hidden = rows.length === 0;
    $('historyCount').textContent = rows.length + ' of ' + HISTORY_MAX;
  }

  // a styled yes/no dialog for things that cannot be undone; the focus starts on Cancel
  var confirmAction = null;
  function askConfirm(title, text, yesLabel, onYes) {
    confirmAction = onYes;
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = text;
    $('confirmYesBtn').textContent = yesLabel;
    $('confirmModal').hidden = false;
    $('confirmNoBtn').focus();
  }
  function closeConfirm() {
    $('confirmModal').hidden = true;
    confirmAction = null;
  }

  // timestamp editor modal
  var editingDose = null, editingTimestamp = null;
  
  function showTimestampEditor(doseIdx, tsIdx) {
    editingDose = doseIdx;
    editingTimestamp = tsIdx;
    if (tsIdx === -1) {
      // new timestamp: set today's date and current time as defaults
      var now = new Date();
      $('editTsDate').value = pad(now.getFullYear()) + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
      $('editTsTime').value = pad(now.getHours()) + ':' + pad(now.getMinutes());
    } else {
      // existing timestamp
      var ts = state.doses[doseIdx].timestamps[tsIdx];
      $('editTsDate').value = ts.date;
      $('editTsTime').value = ts.time;
    }
    $('tsModal').hidden = false;
  }
  
  function closeTimestampEditor() {
    $('tsModal').hidden = true;
    editingDose = null;
    editingTimestamp = null;
  }
  
  function saveTimestampEditor() {
    if (editingDose === null || editingTimestamp === null && editingTimestamp !== -1) return;
    var newDate = $('editTsDate').value, newTime = $('editTsTime').value;
    if (!newDate || !newTime) { alert('Date and time are required.'); return; }
    if (editingTimestamp === -1) {
      // new timestamp
      if (!state.doses[editingDose].timestamps) state.doses[editingDose].timestamps = [];
      state.doses[editingDose].timestamps.push({ date: newDate, time: newTime });
    } else {
      // edit existing
      state.doses[editingDose].timestamps[editingTimestamp] = { date: newDate, time: newTime };
    }
    save();
    renderRows();
    closeTimestampEditor();
  }

  // dose editor modal (for editing scheduled pill time/interval)
  var editingDoseIdx = null;

  function showDoseEditor(doseIdx) {
    editingDoseIdx = doseIdx;
    var d = state.doses[doseIdx];
    $('editDoseName').value = d.name;
    $('editDoseTime').value = d.time;
    $('editDosePills').value = String(d.pills);
    $('editDoseRecurNum').value = d.recur && d.recur.num ? String(d.recur.num) : '';
    $('editDoseRecurUnit').value = d.recur && d.recur.unit ? d.recur.unit : '';
    $('doseModal').hidden = false;
  }

  function closeDoseEditor() {
    $('doseModal').hidden = true;
    editingDoseIdx = null;
  }

  function saveDoseEditor() {
    if (editingDoseIdx === null) return;
    var name = $('editDoseName').value.trim(), t = $('editDoseTime').value, p = Number($('editDosePills').value),
        recurNum = Number($('editDoseRecurNum').value) || 0, recurUnit = $('editDoseRecurUnit').value || '';
    if (parseTime(t) === null) { alert('Choose a valid time.'); return; }
    if (!(p >= 1 && p <= MAX_PILLS && Math.floor(p) === p)) { alert('Pills must be 1 to ' + MAX_PILLS + '.'); return; }
    var d = state.doses[editingDoseIdx];
    d.name = name;
    d.time = t;
    d.pills = p;
    d.recur = (recurNum > 0 && recurUnit) ? { num: recurNum, unit: recurUnit } : null;
    save();
    sortDoses();
    renderRows();
    changed();
    closeDoseEditor();
  }

  function changed() {
    scheduleIsSaved = false;  // mark as needing re-save after any edit
    save();
    var errors = check(), box = $('problems');
    box.textContent = '';
    errors.forEach(function (e) { box.appendChild(el('li', { text: e })); });
    box.hidden = errors.length === 0;
    $('doseCount').textContent = state.doses.length + ' of ' + MAX_ENTRIES;
    updateBar();
  }

  // ---------- connection (Web Serial) ----------
  var port = null, writer = null, reader = null, keepReading = false, lineBuf = '';
  var connected = false, sawClock = false, saving = null, saveText = '';

  function setConn(kind, text, showConnect) {
    $('connIcon').className = 'icon ' + kind;
    $('connText').textContent = text;
    $('connectBtn').hidden = !showConnect;
    connected = kind === 'ok';
    updateBar();
    renderRows();   // the Fill buttons depend on the connection (renderRows also tells the other page parts)
  }

  // the Save button and the line under the status
  function updateBar() {
    var valid = check().length === 0, any = state.doses.length > 0, hint;
    $('saveBtn').disabled = !(connected && any && valid) || !!saving;
    if (saving) hint = 'Saving...';
    else if (saveText) hint = saveText;
    else if (!connected) hint = 'Connect the Arduino to save.';
    else if (!any) hint = 'Add a medication to the schedule to save it.';
    else if (!valid) hint = 'Fix the problems in the table to save.';
    else hint = 'Ready to save.';
    if (!saveText) $('saveMsg').className = 'hint';
    $('saveMsg').textContent = hint;
  }

  function saveResult(ok, text) {
    if (saving) { window.clearTimeout(saving.timer); saving = null; }
    if (ok) {
      // Move saved doses to the savedDoses table; the board numbers them again, so ask which number each one got
      state.doses.forEach(function (d) { d.fwId = null; });
      state.savedDoses = state.doses.slice();
      state.doses = [];
      state.pendingRm = [];   // the board cleared everything, so a waiting removal has nothing left to remove
      scheduleIsSaved = true;
      renderRows();
      send('list');
    }
    saveText = text;
    $('saveMsg').className = 'hint ' + (ok ? 'good' : 'badtext');
    updateBar();
  }

  function parseLine(line) {
    var m;
    lineListeners.forEach(function (fn) { fn(line); });
    if (/^clock /.test(line)) { sawClock = true; return; }
    m = /^saved (\d+) dose/.exec(line);
    if (m && saving) saveResult(true, 'Saved ' + m[1] + (m[1] === '1' ? ' dose' : ' doses') + ' to the Arduino. It turns the cartridge by itself at these times.');
    m = /^dose start #(\d+) (\d{2}:\d{2}:\d{2}) (\d+)$/.exec(line);
    if (m) { historyStart(+m[1], parseTime(m[2]), +m[3]); return; }
    m = /^pill #(\d+) (\d+)\/\d+ left (\d+)$/.exec(line);
    if (m) { historyPill(+m[1], +m[2], +m[3]); return; }
    m = /^dose end #(\d+) (\d{2}:\d{2}:\d{2}) (COMPLETED|INCOMPLETE|FAILED|FINISHED) (\d+)\/(\d+) left (\d+)$/.exec(line);
    if (m) { historyEnd(+m[1], parseTime(m[2]), m[3], +m[4], +m[5], +m[6]); return; }
    m = /^ring (\d+) (EMPTY|READY)$/.exec(line);
    if (m) { setRing(+m[1]); return; }
    m = /^schedule FINISHED #(\d+) (\d{2}:\d{2}:\d{2})/.exec(line);
    if (m) { historyFinished(+m[1], parseTime(m[2])); return; }   // the board cannot give this dose in full any more
    m = /^\s+#(\d+) (\d{2}:\d{2})(?::(\d{2}))? x\d+ /.exec(line);
    if (m) mapBoardDose(+m[1], parseTime(m[2] + ':' + (m[3] || '00')));   // a line of the board's "list"
  }
  function feed(text) {
    lineBuf += text.replace(/\r/g, '');
    var parts = lineBuf.split('\n');
    lineBuf = parts.pop();
    parts.forEach(function (l) { if (l.length) parseLine(l); });
  }

  function send(cmd) {
    if (!writer) return Promise.resolve();
    return writer.write(new TextEncoder().encode(cmd + '\n')).catch(function () { /* the check below reports a lost connection */ });
  }

  function readLoop() {
    var decoder = new TextDecoder();
    function pump() {
      if (!keepReading || !port || !port.readable) return Promise.resolve();
      reader = port.readable.getReader();
      function step() {
        return reader.read().then(function (r) {
          if (r.done) return;
          feed(decoder.decode(r.value, { stream: true }));
          return step();
        });
      }
      return step().catch(function () {}).then(function () { reader.releaseLock(); reader = null; });
    }
    return pump();
  }

  function waitForClock(ms) {
    var until = Date.now() + ms;
    function poll() {
      if (sawClock || Date.now() >= until || !port) return Promise.resolve(sawClock);
      return wait(100).then(poll);
    }
    return poll();
  }

  function closePort() {
    keepReading = false;
    var p = port;
    port = null;
    var done = Promise.resolve();
    if (reader) done = reader.cancel().catch(function () {});
    return done.then(function () { if (writer) { writer.releaseLock(); writer = null; } if (p) return p.close(); }).catch(function () {});
  }

  // opens the port and checks that our program answers (the board prints its clock line)
  function openPort(p) {
    setConn('busy', 'Looking for the Arduino...', false);
    port = p;
    sawClock = false;
    lineBuf = '';
    return p.open({ baudRate: BOARD.baud }).then(function () {
      writer = p.writable.getWriter();
      keepReading = true;
      readLoop();
      setConn('busy', 'Checking the Arduino...', false);
      return waitForClock(BOARD.settleMs);
    }).then(function (seen) {
      if (seen) return true;
      return send('list').then(function () { return waitForClock(2500); });
    }).then(function (ok) {
      if (ok) { setConn('ok', BOARD.name + ' connected', false); flushBoardQueue(); return; }
      return closePort().then(function () { setConn('bad', 'Something answered on the USB port, but not the dispenser program. ' + BOARD.uploadHelp, true); });
    }).catch(function (e) {
      return closePort().then(function () {
        setConn('bad', 'Could not open the USB port (' + (e && e.message ? e.message : 'error') + '). ' + BOARD.busyHelp, true);
      });
    });
  }

  function notFound() { setConn('bad', 'Arduino not connected. ' + BOARD.plugHelp, true); }

  // ---------- deleting a schedule also stops it on the board ----------
  function notify(good, text) {
    saveText = text;
    $('saveMsg').className = 'hint ' + (good ? 'good' : 'badtext');
    updateBar();
  }
  // "rm <number>" makes the board stop that dose at once (also while it is turning) and forget it
  function sendRm(id) {
    if (connected) return send('rm ' + id).then(function () { return 'sent'; });
    if (state.pendingRm.indexOf(id) < 0) state.pendingRm.push(id);
    save();
    return Promise.resolve('queued');
  }
  function stopOnBoard(d) {
    if (d.fwId != null) return sendRm(d.fwId);
    if (!connected) return Promise.resolve('unknown');
    return send('list').then(function () { return wait(400); }).then(function () { return d.fwId != null ? sendRm(d.fwId) : 'unknown'; });
  }
  function closeOpenRecord(d) {
    state.history.forEach(function (r) {
      if (r.status !== 'DISPENSING' || !(d.fwId != null ? r.fwId === d.fwId : doseAt(d, parseTime(r.scheduled)))) return;
      r.status = 'INCOMPLETE';
      r.endedAt = Date.now();
      r.events.push({ label: 'Stopped (' + r.dispensed + '/' + r.required + ')', ms: r.endedAt });
    });
  }
  function deleteSavedDose(d) {
    stopOnBoard(d).then(function (result) {
      if (result !== 'sent') closeOpenRecord(d);   // when the board answers, its own "dose end" line closes the row
      var i = state.savedDoses.indexOf(d);
      if (i >= 0) archiveDeletedSchedule(d, i);
      if (result === 'sent') notify(true, '"' + d.name + '" was stopped on the Arduino and will not be dispensed any more.');
      else if (result === 'queued') notify(false, 'The Arduino is not connected. It will stop "' + d.name + '" as soon as this page connects.');
      else notify(false, 'Could not find "' + d.name + '" on the Arduino. Connect it and save the schedule again to replace what the board has.');
    });
  }
  // after a reconnect: learn the board's numbers and send the removals that were waiting
  function flushBoardQueue() {
    var ids = state.pendingRm.slice();
    state.pendingRm = [];
    save();
    send('list');
    ids.forEach(function (id) { send('rm ' + id); });
  }

  function startUp() {
    if (!('serial' in navigator)) {
      setConn('bad', 'This browser cannot talk to the Arduino. Open this page in Chrome or Edge.', false);
      return;
    }
    setConn('busy', 'Looking for the Arduino...', false);
    navigator.serial.getPorts().then(function (ports) {
      if (ports.length) return openPort(ports[0]);
      notFound();
    }).catch(notFound);
    navigator.serial.addEventListener('disconnect', function () {
      if (port) closePort().then(function () { saveText = ''; notFound(); });
    });
  }

  function chooseAndConnect() {
    navigator.serial.requestPort().then(function (p) { return openPort(p); }).catch(function (e) {
      if (!(e && e.name === 'NotFoundError')) notFound();   // NotFoundError: the person closed the chooser
    });
  }

  // calculate recurrence interval in seconds
  function recurToSeconds(recur) {
    if (!recur || !recur.num || !recur.unit) return 0;
    if (recur.unit === 'h') return recur.num * 3600;
    if (recur.unit === 'm') return recur.num * 60;
    if (recur.unit === 's') return recur.num;
    return 0;
  }

  // clock, clear the old doses, the new doses (with recurrence), then keep it all in the board's memory
  function saveToBoard() {
    if (!connected || check().length || !state.doses.length) return;
    saveText = '';
    $('saveMsg').className = 'hint';
    saving = { timer: window.setTimeout(function () { saveResult(false, 'The Arduino did not answer. Check the USB cable and press Connect.'); }, 6000 + 400 * state.doses.length) };
    updateBar();
    save();  // persist state
    var chain = send('time ' + nowText());   // the board has no clock chip, so it gets the computer's time
    function next(cmd) { chain = chain.then(function () { return wait(30); }).then(function () { return send(cmd); }); }
    next('clear');
    state.doses.slice().sort(function (a, b) { return parseTime(a.time) - parseTime(b.time); }).forEach(function (d) { 
      var recurSec = recurToSeconds(d.recur);
      next('add ' + d.time + ' ' + d.pills + ' ' + recurSec);
    });
    next('save');
  }

  // ---------- the small interface the separate pages (refill.js) use: the board, the dialog and the saved schedules ----------
  var lineListeners = [], changeListeners = [];
  function fireChange() { changeListeners.forEach(function (fn) { fn(); }); }
  window.UISystem = {
    board: BOARD,
    send: function (cmd) { return send(cmd); },
    isConnected: function () { return connected; },
    savedScheduleCount: function () { return state.savedDoses.length; },
    ringPills: function () { return state.ring.pills; },
    // a confirmed fill: the count that was put in is the new max of the ring
    setRingMax: function (n) { state.ringMax = Number(n); save(); renderRows(); },
    ask: askConfirm,
    stampText: msText,
    onLine: function (fn) { lineListeners.push(fn); },
    onChange: function (fn) { changeListeners.push(fn); }
  };

  // ---------- wiring ----------
  function init() {
    $('boardName').textContent = BOARD.name;
    document.title = 'UI System \u00b7 ' + BOARD.name;
    tickClock();
    $('emptyFillBtn').addEventListener('click', function () { document.dispatchEvent(new CustomEvent('ui:refill', { detail: { ring: 0 } })); });
    sortDoses();
    renderRows();
    changed();
    $('connectBtn').addEventListener('click', chooseAndConnect);
    $('saveBtn').addEventListener('click', saveToBoard);
    $('doseSaveBtn').addEventListener('click', saveDoseEditor);
    $('doseCancelBtn').addEventListener('click', closeDoseEditor);
    $('tsSaveBtn').addEventListener('click', saveTimestampEditor);
    $('tsCancelBtn').addEventListener('click', closeTimestampEditor);
    $('clearHistoryBtn').addEventListener('click', function () {
      askConfirm('Clear the dosage history?', 'All dosage history rows and their timestamps will be removed from this page. This cannot be undone.', 'Clear history', function () {
        state.history = [];
        expandedHistory = {};
        save();
        renderRows();
      });
    });
    $('confirmYesBtn').addEventListener('click', function () {
      var run = confirmAction;
      closeConfirm();
      if (run) run();
    });
    $('confirmNoBtn').addEventListener('click', closeConfirm);
    $('confirmModal').addEventListener('click', function (e) { if (e.target === $('confirmModal')) closeConfirm(); });
    document.addEventListener('keydown', function (e) { 
      if (e.key === 'Escape') {
        if (!$('confirmModal').hidden) closeConfirm();
        if (!$('doseModal').hidden) closeDoseEditor();
        if (!$('tsModal').hidden) closeTimestampEditor();
      }
    });
    $('addForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('newName').value.trim(), t = $('newTime').value, p = Number($('newPills').value),
          recurNum = Number($('newRecurNum').value) || 0, recurUnit = $('newRecurUnit').value || '',
          recur = (recurNum > 0 && recurUnit) ? { num: recurNum, unit: recurUnit } : null,
          msg = $('addMsg');
      msg.className = 'hint';
      if (parseTime(t) === null) { msg.textContent = 'Choose a time.'; return; }
      if (!(p >= 1 && p <= MAX_PILLS && Math.floor(p) === p)) { msg.textContent = 'Pills must be a whole number from 1 to ' + MAX_PILLS + '.'; return; }
      if (state.doses.length >= MAX_ENTRIES) { msg.textContent = 'The schedule is full (' + MAX_ENTRIES + ' entry rows).'; return; }
      if (state.doses.some(function (d) { return parseTime(d.time) === parseTime(t); })) { msg.textContent = 'A dose is already set at ' + t + '.'; return; }
      msg.textContent = '';
      state.doses.push({ name: name, time: t, pills: p, recur: recur });
      sortDoses();
      $('newName').value = '';
      $('newTime').value = '';
      $('newPills').value = '1';
      $('newRecurNum').value = '';
      $('newRecurUnit').value = '';
      saveText = '';
      renderRows();
      changed();
      $('newName').focus();
    });
    startUp();
  }

  window.SchedulerUI = { parseTime: parseTime, check: check, feed: feed, state: function () { return JSON.parse(JSON.stringify(state)); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
