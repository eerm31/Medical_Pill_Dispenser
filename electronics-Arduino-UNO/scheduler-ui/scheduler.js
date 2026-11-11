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
  var MAX_ENTRIES = 8, MAX_PILLS = 5;
  var STORE_KEY = 'dispenser-ui-system-' + BOARD.short;

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag), k;
    for (k in (attrs || {})) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }
  function wait(ms) { return new Promise(function (resolve) { window.setTimeout(resolve, ms); }); }

  // ---------- rules (same as schedule.cpp) ----------
  function parseTime(text) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(text || ''));
    if (!m) return null;
    var h = +m[1], min = +m[2];
    return h > 23 || min > 59 ? null : h * 60 + min;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function nowText() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  // expand a dose with recurrence into multiple individual doses (24h window)
  function expandDose(dose) {
    if (!dose.recur || !dose.recur.num || !dose.recur.unit) return [dose];
    var expanded = [], startMin = parseTime(dose.time);
    if (startMin === null) return [dose];
    var intervalMs = 0;
    if (dose.recur.unit === 'h') intervalMs = dose.recur.num * 3600000;
    else if (dose.recur.unit === 'm') intervalMs = dose.recur.num * 60000;
    else if (dose.recur.unit === 's') intervalMs = dose.recur.num * 1000;
    if (intervalMs <= 0) return [dose];
    var now = new Date(), dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var startMs = dayStart.getTime() + startMin * 60000;
    for (var offset = 0; offset < 86400000; offset += intervalMs) {
      var ms = startMs + offset;
      if (ms >= dayStart.getTime() + 86400000) break;  // stop after 24h
      var d = new Date(ms);
      var timeStr = pad(d.getHours()) + ':' + pad(d.getMinutes());
      expanded.push({ name: dose.name, time: timeStr, pills: dose.pills, recur: null });
    }
    return expanded.length ? expanded : [dose];
  }

  function recurText(recur) {
    if (!recur || !recur.num || !recur.unit) return '';
    var units = { h: 'hour', m: 'min', s: 'sec' };
    return 'Every ' + recur.num + ' ' + units[recur.unit] + (recur.num > 1 ? 's' : '');
  }

  var state = load();
  var expandedRows = {};  // track which rows are expanded
  function load() {
    var s = { doses: [] };
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null');
      if (saved && Array.isArray(saved.doses)) {
        s.doses = saved.doses.map(function (d) {
          return {
            name: String(d.name || '').slice(0, 40),
            time: String(d.time),
            pills: Number(d.pills),
            recur: d.recur ? { num: Number(d.recur.num), unit: String(d.recur.unit) } : null
          };
        });
      }
    } catch (e) { /* no storage, start empty */ }
    return s;
  }
  function save() { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  function check() {
    var errors = [], expanded = [], seen = {}, i;
    // expand all doses first
    for (i = 0; i < state.doses.length; i++) {
      var doseExpanded = expandDose(state.doses[i]);
      expanded = expanded.concat(doseExpanded);
    }
    if (expanded.length > MAX_ENTRIES) errors.push('After expansion, the schedule would have ' + expanded.length + ' doses, but the board keeps at most ' + MAX_ENTRIES + '.');
    state.doses.forEach(function (d, i) {
      var t = parseTime(d.time), label = 'Row ' + (i + 1);
      if (t === null) errors.push(label + ': choose a time.');
      else if (seen[t]) errors.push(label + ': another dose already uses ' + d.time + ' as a start time.');
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

  // ---------- the schedule table ----------
  function renderRows() {
    var body = $('doseRows');
    body.textContent = '';
    state.doses.forEach(function (d, i) {
      var isExpanded = expandedRows[i];
      var expanded = expandDose(d);
      
      // compact row (the main row shown always)
      var name = el('input', { type: 'text', value: d.name, maxlength: '40', placeholder: 'Medication name', 'aria-label': 'Medication name, row ' + (i + 1) });
      var time = el('input', { type: 'time', value: d.time, required: '', 'aria-label': 'Time, row ' + (i + 1) });
      var pills = el('input', { type: 'number', min: '1', max: String(MAX_PILLS), step: '1', value: String(d.pills), 'aria-label': 'Pills, row ' + (i + 1) });
      var recurLabel = el('span', { class: 'recur-label', text: recurText(d.recur) || '—' });
      var expandBtn = el('button', { type: 'button', class: 'expand', 'aria-label': 'Toggle dose expansion, row ' + (i + 1), text: isExpanded ? '▼' : '▶' });
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
      rm.addEventListener('click', function () { state.doses.splice(i, 1); delete expandedRows[i]; renderRows(); changed(); });
      
      var compactRow = el('tr', { class: 'dose-compact' }, [el('td', {}, [name]), el('td', {}, [time]), el('td', {}, [pills]), el('td', {}, [recurLabel]), el('td', {}, [expandBtn]), el('td', {}, [rm])]);
      body.appendChild(compactRow);
      
      // expanded rows (shown only when expanded and if recurrence exists)
      if (isExpanded && d.recur && d.recur.num && d.recur.unit && expanded.length > 1) {
        expanded.forEach(function (e, j) {
          var expandedRow = el('tr', { class: 'dose-expanded' }, [
            el('td', { text: '├─ ' + e.time }),
            el('td', {}),
            el('td', { text: String(e.pills) }),
            el('td', {}),
            el('td', {}),
            el('td', {})
          ]);
          body.appendChild(expandedRow);
        });
      }
    });
    $('emptyMsg').hidden = state.doses.length > 0;
    $('doseTable').hidden = state.doses.length === 0;
    $('doseCount').textContent = state.doses.length + ' of ' + MAX_ENTRIES;
  }

  function changed() {
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
    saveText = text;
    $('saveMsg').className = 'hint ' + (ok ? 'good' : 'badtext');
    updateBar();
  }

  function parseLine(line) {
    var m;
    if (/^clock /.test(line)) { sawClock = true; return; }
    m = /^saved (\d+) dose/.exec(line);
    if (m && saving) saveResult(true, 'Saved ' + m[1] + (m[1] === '1' ? ' dose' : ' doses') + ' to the Arduino. It turns the cartridge by itself at these times.');
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
      if (ok) { setConn('ok', BOARD.name + ' connected', false); return; }
      return closePort().then(function () { setConn('bad', 'Something answered on the USB port, but not the dispenser program. ' + BOARD.uploadHelp, true); });
    }).catch(function (e) {
      return closePort().then(function () {
        setConn('bad', 'Could not open the USB port (' + (e && e.message ? e.message : 'error') + '). ' + BOARD.busyHelp, true);
      });
    });
  }

  function notFound() { setConn('bad', 'Arduino not connected. ' + BOARD.plugHelp, true); }

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

  // clock, clear the old doses, the new doses (expanded), then keep it all in the board's memory
  function saveToBoard() {
    if (!connected || check().length || !state.doses.length) return;
    saveText = '';
    $('saveMsg').className = 'hint';
    // expand all doses for saving
    var allExpanded = [];
    state.doses.forEach(function (d) { allExpanded = allExpanded.concat(expandDose(d)); });
    saving = { timer: window.setTimeout(function () { saveResult(false, 'The Arduino did not answer. Check the USB cable and press Connect.'); }, 6000 + 400 * allExpanded.length) };
    updateBar();
    var chain = send('time ' + nowText());   // the board has no clock chip, so it gets the computer's time
    function next(cmd) { chain = chain.then(function () { return wait(180); }).then(function () { return send(cmd); }); }
    next('clear');
    allExpanded.slice().sort(function (a, b) { return parseTime(a.time) - parseTime(b.time); }).forEach(function (d) { next('add ' + d.time + ' ' + d.pills); });
    next('save');
  }

  // ---------- wiring ----------
  function init() {
    $('boardName').textContent = BOARD.name;
    document.title = 'UI System \u00b7 ' + BOARD.name;
    sortDoses();
    renderRows();
    changed();
    $('connectBtn').addEventListener('click', chooseAndConnect);
    $('saveBtn').addEventListener('click', saveToBoard);
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
