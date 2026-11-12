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
      notes: ['Stepper GPIO4-7, hall GPIO1', 'Times in whole minutes', 'No repeat: dose runs daily', 'Has servos and barcode reader']
    },
    uno: {
      name: 'Arduino UNO',
      notes: ['Stepper D8-D11, hall D2', 'Time in seconds, can repeat', 'No servos, no barcode reader']
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
    var y0 = cy - (lines.length - 1) * (size + 5) / 2 + size / 3;
    lines.forEach(function (t, i) {
      el('text', { x: cx, y: y0 + i * (size + 5), 'text-anchor': 'middle', 'font-size': size, fill: i === 0 && bold ? '#edf3fa' : '#cbd7e6', 'font-weight': i === 0 && bold ? 700 : 400 }, g, t);
    });
  }
  function node(g, kind, cx, cy, w, h, lines) {
    var c = STYLE[kind];
    if (kind === 'dec') el('polygon', { points: [cx, cy - h / 2, cx + w / 2, cy, cx, cy + h / 2, cx - w / 2, cy].join(' '), fill: c[0], stroke: c[1], 'stroke-width': 1.6 }, g);
    else el('rect', { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: kind === 'start' ? h / 2 : 10, fill: c[0], stroke: c[1], 'stroke-width': 1.6 }, g);
    label(g, cx, cy, lines, kind === 'dec' ? 13 : 13.5, true);
  }
  function arrow(g, pts, text, tx, ty, dashed, noHead) {
    el('polyline', { points: pts.map(function (p) { return p.join(','); }).join(' '), fill: 'none', stroke: dashed ? '#6aa6e8' : '#8ea3bd', 'stroke-width': 1.6, 'stroke-dasharray': dashed ? '5 4' : '', 'marker-end': noHead ? '' : 'url(#swArrow)' }, g);
    if (text) el('text', { x: tx, y: ty, 'font-size': 12, fill: dashed ? '#9fc4f0' : '#ffd08a', 'font-weight': 700 }, g, text);
  }

  function chart(b, wide) {
    var B = BOARDS[b], svg = el('svg', { viewBox: wide ? '0 0 1410 1040' : '0 0 700 1850', role: 'img', 'aria-label': 'How the ' + B.name + ' dispenser works, step by step', xmlns: NS });
    var defs = el('defs', {}, svg);
    var mk = el('marker', { id: 'swArrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#8ea3bd' }, mk);
    var root = el('g', {}, svg), g = root, X = 215, SX = 555, W = 300, LOOP_DX = 710;
    function place(dx, dy) { g = el('g', { transform: 'translate(' + dx + ' ' + dy + ')' }, root); }
    function heading(y, text, anchor, x) { el('text', { x: x || 24, y: y, 'text-anchor': anchor || 'start', 'font-size': 13, 'font-weight': 700, 'letter-spacing': '.08em', fill: '#9fd8ff' }, g, text); }

    // 1. start-up, once
    heading(22, 'START-UP (ONCE)');
    node(g, 'start', X, 56, 240, 38, ['Dispenser switched on']);
    node(g, 'proc', X, 124, W, 56, ['Get ready', 'Start the motor, memory and clock']);
    node(g, 'store', X, 200, W, 56, ['Read the saved schedule', 'none saved: use the starter one']);
    node(g, 'proc', X, 272, W, 40, ['Say "scheduling system ready"']);
    arrow(g, [[X, 75], [X, 96]]); arrow(g, [[X, 152], [X, 172]]); arrow(g, [[X, 228], [X, 252]]);
    // wide: the start-up hands over sideways to the loop block; narrow: straight down
    arrow(g, wide ? [[X + W / 2, 272], [X - W / 2 + LOOP_DX, 272]] : [[X, 292], [X, 364]]);

    // 2. the main loop, forever
    place(wide ? LOOP_DX : 0, wide ? -120 : 0);
    el('rect', { x: 10, y: 316, width: 680, height: 814, rx: 16, fill: 'none', stroke: '#2c3e57', 'stroke-dasharray': '6 5' }, g);
    heading(338, 'THEN IT REPEATS THESE STEPS FOREVER', 'end', 676);
    node(g, 'proc', X, 392, W, 56, ['Check the clock', 'Is a dose due, or missed?']);
    node(g, 'proc', X, 472, W, 56, ['Move the motor', 'one small step when it is time']);
    node(g, 'proc', X, 552, W, 56, ['Check the refill', 'tell the computer if it changed']);
    arrow(g, [[X, 420], [X, 444]]); arrow(g, [[X, 500], [X, 524]]); arrow(g, [[X, 580], [X, 615]]);

    // a question with a side action; the side box rejoins the main line
    function decision(cy, q, side, sh, nextTop) {
      node(g, 'dec', X, cy, W, 70, q);
      arrow(g, [[X + W / 2, cy], [SX - 120, cy]], 'yes', X + W / 2 + 22, cy - 8);
      node(g, 'io', SX, cy, 240, sh, side);
      arrow(g, [[SX, cy + sh / 2], [SX, nextTop - 22], [X, nextTop - 22]], '', 0, 0, false, true);
      arrow(g, [[X, cy + 35], [X, nextTop]], 'no', X + 8, cy + 58);
    }
    decision(650, ['Was the current dose', 'deleted?'], ['Stop the motor', 'Say "dose was deleted"'], 56, 745);
    decision(780, ['Dose due, cartridge free,', 'no refill running?'], ['Enough pills for the dose?', 'yes: start turning the cartridge', 'no: skip it, nothing turns'], 76, 875);
    decision(910, ['Did a pill just', 'come out?'], ['Count the pill and save it', 'Say how many are left', 'last pill: dose is taken'], 76, 1005);
    // the last question loops back to the top
    node(g, 'dec', X, 1040, W, 70, ['Message from', 'the computer?']);
    arrow(g, [[X + W / 2, 1040], [SX - 120, 1040]], 'yes', X + W / 2 + 22, 1032);
    node(g, 'io', SX, 1040, 240, 76, ['Do what the message asks', 'set time · add or remove a dose', 'save · refill · list · stop']);
    arrow(g, [[X, 1075], [X, 1110], [40, 1110], [40, 392], [X - W / 2, 392]], 'no', X + 8, 1098);
    arrow(g, [[SX, 1078], [SX, 1110], [X, 1110]], '', 0, 0, false, true);
    el('text', { x: 26, y: 760, 'font-size': 12, fill: '#9fc4f0', transform: 'rotate(-90 26 760)', 'text-anchor': 'middle' }, g, 'back to the top');

    // 3. refilling the cartridge
    place(0, wide ? -830 : 0);
    heading(1170, 'REFILLING THE CARTRIDGE');
    el('text', { x: 24, y: 1192, 'font-size': 12, fill: '#8795a8' }, g, '"Check the refill" above moves it along, one step at a time');
    var states = [['Ready', 'no refill going on'], ['Refill requested', 'the cartridge is locked'], ['Turning', 'one 30° step'], ['Waiting for pills', 'you add pills and tell the count'], ['Saving', 'the new count is stored'], ['Done', 'the cartridge count is updated']];
    var steps = ['you ask to refill', 'the cartridge turns', 'the turn is finished', 'you tell the count', 'count saved'];
    states.forEach(function (s, i) {
      var y = 1250 + i * 76;
      node(g, i === states.length - 1 ? 'start' : 'state', X, y, W, 50, [s[0], s[1]]);
      if (i) arrow(g, [[X, y - 51], [X, y - 25]], steps[i - 1], X + 8, y - 34);
    });
    node(g, 'bad', SX, 1478, 240, 76, ['Stopped', 'cancel, timeout or save error', 'counts stay as they were']);
    arrow(g, [[X + W / 2, 1478], [SX - 120, 1478]], 'problem', X + W / 2 + 8, 1470, true);

    // 4. what is kept, and this board
    place(0, wide ? -830 : 0);
    heading(1700, 'KEPT AND BOARD NOTES');
    node(g, 'store', X, 1760, W, 76, ['Kept when switched off', 'the schedule and settings', 'the last 10 doses']);
    node(g, 'proc', SX, 1760, 240, 34 + (B.notes.length + 1) * 18, ['About this board'].concat(B.notes));
    el('text', { x: 350, y: 1836, 'text-anchor': 'middle', 'font-size': 12, fill: '#8795a8' }, g, 'Yellow: question · purple: action · green: saved data · red: stopped');
    return svg;
  }

  function isFull() { return document.fullscreenElement === pane || pane.classList.contains('sw-full'); }
  function syncFull() {
    var b = pane.querySelector('.sw-full-btn'); if (!b) return;
    b.textContent = isFull() ? 'Exit full screen' : 'Full screen';
    b.setAttribute('aria-pressed', isFull() ? 'true' : 'false');
  }
  function toggleFull() {
    if (document.fullscreenElement === pane) { document.exitFullscreen(); return; }
    if (pane.classList.contains('sw-full')) { pane.classList.remove('sw-full'); render(); return; }
    var req = pane.requestFullscreen && pane.requestFullscreen();
    if (req && req.catch) req.catch(function () { pane.classList.add('sw-full'); render(); });
    else if (!req) { pane.classList.add('sw-full'); render(); }
  }
  document.addEventListener('fullscreenchange', render);
  ['pointerdown', 'pointerup', 'pointermove', 'touchstart', 'wheel', 'dblclick'].forEach(function (n) { pane.addEventListener(n, function (e) { e.stopPropagation(); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pane.classList.contains('sw-full')) toggleFull(); });

  function render() {
    var B = BOARDS[board];
    pane.replaceChildren();
    var head = document.createElement('div'); head.className = 'sw-head';
    var t = document.createElement('strong'); t.textContent = 'How the ' + B.name + ' dispenser works';
    head.appendChild(t);
    var fs = document.createElement('button'); fs.type = 'button'; fs.className = 'quiet-button sw-full-btn';
    fs.addEventListener('click', toggleFull);
    head.appendChild(fs);
    pane.appendChild(head);
    syncFull();
    pane.appendChild(chart(board, isFull()));
    var foot = document.createElement('p'); foot.className = 'sw-foot';
    foot.textContent = 'Read from top to bottom. Scroll to follow the whole chart.';
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
