/* Software view: a flowchart of the dispenser firmware for the ESP32-S3 or the Arduino UNO, plus the board switch shared with
   the Wiring view. The flowchart is drawn from the two firmware sources by hand (setup, loop, refill states, storage); it is a
   concept aid, ASSUMED / NOT_VALIDATED, and reads no simulation state. The wiring code picks its spec in wiring-board.js, so a
   board change in the Wiring view reloads the page (keeping design, view and style in the URL). */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var KEY = window.DispenserBoardKey || 'dispenser-board';
  var specBoard = window.DispenserWiringBoard || 'esp32';
  var board = specBoard;
  var pane = document.getElementById('softwareView');
  if (!pane) return;

  var BOARDS = {
    esp32: {
      name: 'ESP32-S3',
      source: 'electronics-ESP32/scheduling-system/firmware/main.cpp (Arduino framework, PlatformIO)',
      store: ['EEPROM (emulated in flash)', 'schedule 0 · settings 72', 'dose log 80 (last 10 events)'],
      notes: ['Stepper GPIO4-7, hall GPIO1', 'Times in whole minutes (HH:MM)', 'No repeat: a dose runs daily', 'Messages via Serial.printf']
    },
    uno: {
      name: 'Arduino UNO',
      source: 'electronics-Arduino-UNO/scheduling-system/src/scheduling-system.ino (ATmega328P, 2 KB RAM)',
      store: ['EEPROM', 'schedule 0 · settings 160', 'dose log 168 (last 10 events)'],
      notes: ['Stepper D8-D11, hall D2', 'Times HH:MM:SS, optional repeat', 'F() strings save RAM', 'No servos, no barcode reader']
    }
  };

  // ---------- drawing helpers ----------
  var STYLE = {
    start: ['#12312f', '#5fcfbd'], proc: ['#172335', '#34465c'], dec: ['#2a2312', '#ffb300'], io: ['#231b34', '#9b7bd6'],
    store: ['#14281d', '#51b879'], state: ['#172335', '#6aa6e8'], bad: ['#331a1d', '#ef555c']
  };
  function el(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function label(g, cx, cy, lines, size, bold) {
    var y0 = cy - (lines.length - 1) * (size + 3) / 2 + size / 3;
    lines.forEach(function (t, i) {
      el('text', { x: cx, y: y0 + i * (size + 3), 'text-anchor': 'middle', 'font-size': size, fill: i === 0 && bold ? '#edf3fa' : '#cbd7e6', 'font-weight': i === 0 && bold ? 700 : 400 }, g, t);
    });
  }
  function node(g, kind, cx, cy, w, h, lines) {
    var c = STYLE[kind];
    if (kind === 'dec') el('polygon', { points: [cx, cy - h / 2, cx + w / 2, cy, cx, cy + h / 2, cx - w / 2, cy].join(' '), fill: c[0], stroke: c[1], 'stroke-width': 1.6 }, g);
    else el('rect', { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: kind === 'start' ? h / 2 : 10, fill: c[0], stroke: c[1], 'stroke-width': 1.6 }, g);
    label(g, cx, cy, lines, kind === 'dec' ? 11.5 : 12, true);
  }
  function arrow(g, pts, text, tx, ty, dashed, noHead) {
    el('polyline', { points: pts.map(function (p) { return p.join(','); }).join(' '), fill: 'none', stroke: dashed ? '#6aa6e8' : '#8ea3bd', 'stroke-width': 1.6, 'stroke-dasharray': dashed ? '5 4' : '', 'marker-end': noHead ? '' : 'url(#swArrow)' }, g);
    if (text) el('text', { x: tx, y: ty, 'font-size': 11, fill: dashed ? '#9fc4f0' : '#ffd08a', 'font-weight': 700 }, g, text);
  }

  function chart(b) {
    var B = BOARDS[b], svg = el('svg', { viewBox: '0 0 1120 1230', role: 'img', 'aria-label': B.name + ' firmware flowchart', xmlns: NS });
    var defs = el('defs', {}, svg);
    var mk = el('marker', { id: 'swArrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#8ea3bd' }, mk);
    var g = el('g', {}, svg), X = 260, SX = 640, RX = 960;

    // loop container
    el('rect', { x: 60, y: 300, width: 740, height: 780, rx: 16, fill: 'none', stroke: '#2c3e57', 'stroke-dasharray': '6 5' }, g);
    el('text', { x: 78, y: 324, 'font-size': 12, 'font-weight': 700, fill: '#9fd8ff' }, g, 'loop()  repeats forever');

    // setup chain
    node(g, 'start', X, 28, 220, 36, ['Power on / reset']);
    node(g, 'proc', X, 100, 360, 64, ['setup()', 'Serial 115200 · stepper.begin() · store.begin()', 'clock = START_TIME from my_schedule.h']);
    node(g, 'store', X, 182, 360, 52, ['Load saved schedule and settings', 'none saved: use the doses in my_schedule.h']);
    node(g, 'proc', X, 254, 360, 50, ['Refilling System starts READY', "print 'scheduling system ready'"]);
    arrow(g, [[X, 46], [X, 68]]); arrow(g, [[X, 132], [X, 156]]); arrow(g, [[X, 208], [X, 229]]); arrow(g, [[X, 279], [X, 338]]);

    // loop body
    node(g, 'proc', X, 366, 360, 54, ['Clock tick, once per second', 'schedule.setClock(): PENDING, DUE, MISSED']);
    node(g, 'proc', X, 440, 360, 50, ['turner.update(micros())', 'one stepper half-step when it is time']);
    node(g, 'proc', X, 512, 360, 50, ['refill.update(millis())', 'print the refill status when it changed']);
    arrow(g, [[X, 393], [X, 415]]); arrow(g, [[X, 465], [X, 487]]); arrow(g, [[X, 537], [X, 572]]);

    // decisions with a side action; the side box returns to the main line
    function decision(cy, q, side, sh, no, next) {
      node(g, 'dec', X, cy, 330, 68, q);
      arrow(g, [[X + 165, cy], [SX - 140, cy]], 'yes', X + 178, cy - 7);
      node(g, 'io', SX, cy, 280, sh, side);
      arrow(g, [[SX, cy + sh / 2], [SX, next - 22], [X, next - 22]], '', 0, 0, false, true);
      arrow(g, [[X, cy + 34], [X, next]], no, X + 8, cy + 52);
    }
    decision(606, ['Active dose', 'was deleted?'], ['interruptDose()', 'stop the motor', "print 'dose was deleted'"], 64, 'no', 694);
    decision(728, ['Dose DUE, cartridge free,', 'no refill running?'], ['beginTake(id): ring has enough pills?', "yes: TAKING, turner.start(n), 'dose start'", 'no: log FINISHED 0/n, nothing turns'], 76, 'no', 826);
    decision(860, ['A pill move', 'has finished?'], ['schedule.confirmPill(), save to EEPROM', "print 'pill k/n left r'", 'last pill: TAKEN, log COMPLETED'], 76, 'no', 952);
    // last decision loops back to the top of the loop
    node(g, 'dec', X, 986, 330, 68, ['Serial line', 'received?']);
    arrow(g, [[X + 165, 986], [SX - 140, 986]], 'yes', X + 178, 979);
    node(g, 'io', SX, 986, 280, 92, ['handleCommand(line)', 'time · add · rm · clear · save · refill', 'pills · set · list · log · step · stop', 'help']);
    arrow(g, [[X, 1020], [X, 1100], [40, 1100], [40, 366], [80, 366]], 'no', X + 8, 1050);
    arrow(g, [[SX, 1032], [SX, 1100], [X, 1100]], '', 0, 0, false, true);
    el('text', { x: 26, y: 700, 'font-size': 11, fill: '#9fc4f0', transform: 'rotate(-90 26 700)', 'text-anchor': 'middle' }, g, 'next pass');

    // refill state machine
    el('text', { x: RX, y: 300, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: '#9fd8ff' }, g, 'Refilling System');
    var states = [['READY', 'a refill can begin'], ['REFILL_MODE', 'ring chosen, cartridge locked'], ['POSITIONING', 'one 30° move'], ['WAITING_FOR_REFILL', 'pills put in, count told'], ['SAVING_INVENTORY', 'count saved'], ['COMPLETED', 'ring count is the new count']];
    var labels = ['refill <ring>', 'move starts', 'move done', 'pills <n>', 'refill complete'];
    states.forEach(function (s, i) {
      var y = 350 + i * 80;
      node(g, i === states.length - 1 ? 'start' : 'state', RX, y, 230, 50, [s[0], s[1]]);
      if (i) arrow(g, [[RX, y - 80 + 25], [RX, y - 25]], labels[i - 1], RX + 8, y - 34);
    });
    node(g, 'bad', RX, 830, 230, 64, ['CANCELLED · ERROR', 'cancel, timeout, save failed', 'counts stay as they were']);
    arrow(g, [[RX + 115, 350 + 3 * 80], [1088, 350 + 3 * 80], [1088, 830], [RX + 115, 830]], '', 0, 0, true);
    arrow(g, [[X + 180, 512], [RX - 115, 512]], 'refill.update', 520, 504, true);

    // storage and board notes
    node(g, 'store', RX, 960, 230, 70, B.store);
    node(g, 'proc', RX, 1075, 230, 96, ['This board'].concat(B.notes));
    el('text', { x: X, y: 1150, 'text-anchor': 'middle', 'font-size': 11, fill: '#8795a8' }, g, 'Yellow: decision · purple: board action · green: stored data');
    return svg;
  }

  function render() {
    var B = BOARDS[board];
    pane.replaceChildren();
    var head = document.createElement('div'); head.className = 'sw-head';
    var t = document.createElement('strong'); t.textContent = B.name + ' firmware flow';
    var s = document.createElement('span'); s.textContent = B.source;
    head.appendChild(t); head.appendChild(s); pane.appendChild(head);
    pane.appendChild(chart(board));
    var foot = document.createElement('p'); foot.className = 'sw-foot';
    foot.textContent = 'CONCEPT ONLY. A hand-drawn summary of the sketch logic, not generated from the code and not validated on hardware.';
    pane.appendChild(foot);
  }

  // ---------- board switch ----------
  var radios = document.querySelectorAll('input[name="boardOpt"], input[name="boardOptSw"]');
  function syncRadios() { radios.forEach(function (r) { r.checked = r.value === board; }); }
  function checkedOf(name) { var r = document.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; }
  function reloadForBoard() {
    var q = '?board=' + board + '&design=' + checkedOf('designOpt') + '&view=' + checkedOf('viewMode') + '&style=' + checkedOf('wiringStyle');
    window.location.replace(window.location.href.split(/[?#]/)[0] + q);
  }
  function setBoard(next) {
    if (next === board) return;
    board = next;
    try { window.localStorage.setItem(KEY, board); } catch (e) { /* storage blocked: the URL still carries the choice */ }
    syncRadios(); render();
    if (document.body.classList.contains('wiring-view')) reloadForBoard();
  }
  radios.forEach(function (r) { r.addEventListener('change', function () { if (r.checked) setBoard(r.value); }); });
  // entering Hardware after the board was changed in Software: the wiring data is built at load, so reload once
  new MutationObserver(function () {
    if (document.body.classList.contains('wiring-view') && board !== specBoard) reloadForBoard();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // hardware texts that name the board (the wiring data itself comes from wiring-board.js)
  function applyWiringText() {
    var W = window.DispenserWiringSpec; if (!W) return;
    var title = document.getElementById('wiringHudTitle'), foot = document.getElementById('wiringHudFoot'), pinNote = document.querySelector('#wiringPins .small-note');
    if (title) title.textContent = W.mcu_name + ' hardware';
    if (foot && W.hud_foot) foot.textContent = W.hud_foot;
    if (pinNote) pinNote.textContent = 'Pins of the ticked systems only; the ' + W.mcu_name + '\'s power pins belong to Power supply. ASSUMED / NOT VALIDATED.';
    var inPlace = document.querySelector('input[name="wiringStyle"][value="wiring3d"]');
    if (inPlace) {
      inPlace.disabled = W.in_place === false;
      var lab = inPlace.closest('label'); if (lab) lab.title = W.in_place === false ? 'The 3D scene has no Arduino UNO model; use Layout 3D or the 2D diagram' : '';
    }
    var note = document.getElementById('softwareNote');
    if (note) note.textContent = 'Flowchart of the sketch: setup, the main loop, the refill states and what is stored. Pick the board above. ASSUMED / NOT VALIDATED.';
  }

  // ---------- restore the view after a board reload ----------
  function restore() {
    var q = {}, m = /^\?(.*)$/.exec(window.location.search);
    if (!m) return;
    m[1].split('&').forEach(function (kv) { var p = kv.split('='); q[p[0]] = p[1]; });
    function click(name, value) { var r = document.querySelector('input[name="' + name + '"][value="' + value + '"]'); if (r && !r.disabled && !r.checked) r.click(); }
    if (q.design && q.design !== 'legacy') click('designOpt', q.design);
    if (q.view === 'wiring') {
      click('viewMode', 'wiring');
      var style = q.style === 'wiring3d' && specBoard === 'uno' ? 'wiringlayout' : q.style;
      if (style) click('wiringStyle', style);
    } else if (q.view === 'software') click('viewMode', 'software');
  }

  syncRadios(); render(); applyWiringText();
  if (/[?&]view=/.test(window.location.search)) window.addEventListener('load', function () { window.setTimeout(restore, 350); });
}());
