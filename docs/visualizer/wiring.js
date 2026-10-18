/* Electronics wiring simulation window. ASSUMED / NOT_VALIDATED concept only.
   Every pin, GPIO and net comes from wiring-spec.js; signal levels are derived from the demo-controller state
   (live from the 3D viewer through postMessage, or from a bench instance of the same controller). */
(function () {
  'use strict';
  var W = window.DispenserWiringSpec, G = window.DispenserRotationSpec && window.DispenserRotationSpec.g;
  var D = window.DISPENSER_CONCEPT_DATA, Ctrl = window.DispenserDemoController;
  var NS = 'http://www.w3.org/2000/svg', HEAD = 34, ROW = 26, PAD = 8, EXTRA = 16;
  var NET_COLOR = { '5V': '#ef555c', '3V3': '#ef963f', 'GND': '#8795a8' };
  var NET_TEXT = { '5V': '+5V', '3V3': '3V3', 'GND': 'GND' };
  var FN_COLOR = { coil: '#71d6c6', servo: '#ef963f', hall: '#51b879', uart: '#b08cff' };
  var FEED_MS = 1500;
  var $ = function (id) { return document.getElementById(id); };

  function svg(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function html(tag, attrs, parent, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function mod(a, n) { return ((a % n) + n) % n; }
  function fnColor(fn) { return FN_COLOR[fn.replace(/[0-9]+$/, '').replace(/_.*/, '')] || '#cbd7e6'; }

  var comps = {}, pins = {}, sigByFn = {}, wireEls = {}, tagEls = {}, dotEls = {}, linkEls = {}, rowEls = {}, liveCells = {}, widgets = {};

  // ---------- layout ----------
  function rowsOf(c) { var l = 0, r = 0; c.pins.forEach(function (p) { if (p.side === 'l') l++; else r++; }); return Math.max(l, r); }
  function widgetH(c) { return c.kind === 'servo' ? 84 : c.kind === 'stepper' ? 96 : (c.kind === 'hall' || c.kind === 'reader') ? 30 : 0; }
  function heightOf(c) { return HEAD + rowsOf(c) * ROW + PAD + (c.extra ? c.extra.length * EXTRA + 6 : 0) + widgetH(c); }

  function buildDiagram() {
    var root = $('diagram'), maxX = 0, maxY = 0;
    W.components.forEach(function (c) { comps[c.id] = c; maxX = Math.max(maxX, c.box[0] + c.box[2]); maxY = Math.max(maxY, c.box[1] + heightOf(c)); });
    root.setAttribute('viewBox', '0 0 ' + (maxX + 40) + ' ' + (maxY + 30));
    var back = svg('g', {}, root), front = svg('g', {}, root);
    var linked = {};
    W.links.forEach(function (l) { linked[l.from] = true; linked[l.to] = true; });
    W.components.forEach(function (c) {
      var x = c.box[0], y = c.box[1], w = c.box[2], h = heightOf(c), cnt = { l: 0, r: 0 };
      var cf = svg('g', { 'data-group': c.group, 'data-part': '1' }, front), cb = svg('g', { 'data-group': c.group, 'data-part': '1' }, back);
      svg('rect', { x: x, y: y, width: w, height: h, rx: 10, 'class': 'box' + (c.external ? ' external' : '') }, cf);
      svg('text', { x: x + 12, y: y + 20, 'class': 'title' }, cf, c.label);
      c.pins.forEach(function (p) {
        var i = cnt[p.side]++, px = p.side === 'l' ? x : x + w, py = y + HEAD + i * ROW + ROW / 2;
        pins[c.id + '.' + p.id] = { comp: c, pin: p, x: px, y: py };
        svg('text', { x: p.side === 'l' ? x + 12 : x + w - 12, y: py + 4, 'class': 'pinname', 'text-anchor': p.side === 'l' ? 'start' : 'end' }, cf, p.name);
        dotEls[c.id + '.' + p.id] = svg('circle', { cx: px, cy: py, r: 4.5, 'class': 'pindot' }, cf);
        var flag = linked[c.id + '.' + p.id] ? '' : (p.net ? NET_TEXT[p.net] : (p.note || ''));
        if (flag) {
          var dir = p.side === 'l' ? -1 : 1, col = p.net ? NET_COLOR[p.net] : '#8795a8';
          svg('line', { x1: px, y1: py, x2: px + dir * 16, y2: py, stroke: col, 'stroke-width': 2 }, cb);
          svg('text', { x: px + dir * 20, y: py + 4, 'class': 'flag', fill: col, 'text-anchor': dir < 0 ? 'end' : 'start' }, cf, flag).style.fill = col;
        }
      });
      var ey = y + HEAD + rowsOf(c) * ROW + PAD + 10;
      (c.extra || []).forEach(function (line, i) { svg('text', { x: x + 12, y: ey + i * EXTRA, 'class': 'extra' }, cf, line); });
      var wy = y + HEAD + rowsOf(c) * ROW + PAD + (c.extra ? c.extra.length * EXTRA + 6 : 0);
      buildWidget(c, cf, x, wy, w);
    });
    routeWires(back, front);
  }

  function espSideOf(s) { var a = pins[s.from], b = pins[s.to]; return a.comp.id === 'esp32' ? a : (b.comp.id === 'esp32' ? b : null); }
  function routeWires(back, front) {
    var groups = { l: [], r: [] };
    W.signals.forEach(function (s) {
      var e = espSideOf(s), a = pins[s.from], b = pins[s.to];
      if (Math.abs(a.y - b.y) > 0.5) groups[e.pin.side].push({ s: s, e: e });
    });
    var chan = {};
    ['l', 'r'].forEach(function (side) {
      var g = groups[side].sort(function (p, q) { return p.e.y - q.e.y; });
      g.forEach(function (it, i) { var dist = 40 + 30 * (g.length - 1 - i); chan[it.s.id] = side === 'l' ? it.e.x - dist : it.e.x + dist; });
    });
    W.signals.forEach(function (s) {
      var a = pins[s.from], b = pins[s.to], e = espSideOf(s), o = e === a ? b : a, d = 'M' + a.x + ' ' + a.y;
      if (chan[s.id] !== undefined) d += ' H' + chan[s.id] + ' V' + b.y;
      d += ' H' + b.x;
      wireEls[s.id] = svg('path', { d: d, 'class': 'wire' + (s.fn.indexOf('servo') === 0 ? ' pwm' : ''), stroke: fnColor(s.fn), color: fnColor(s.fn), 'data-group': s.group }, back);
      var tx = o.x + (o.pin.side === 'r' ? 36 : -36), tw = 46;
      var tg = svg('g', { 'data-group': s.group }, front);
      svg('rect', { x: tx - tw / 2, y: o.y - 8, width: tw, height: 16, rx: 8, 'class': 'tagbg' }, tg);
      tagEls[s.id] = svg('text', { x: tx, y: o.y + 4, 'class': 'tag', 'text-anchor': 'middle' }, tg, '');
    });
    W.links.forEach(function (l) {
      var a = pins[l.from], b = pins[l.to];
      linkEls[l.id] = svg('path', { d: 'M' + a.x + ' ' + a.y + ' H' + b.x + (Math.abs(a.y - b.y) > .5 ? ' V' + b.y : ''), 'class': 'link', stroke: l.color, 'data-group': l.group }, back);
    });
  }

  // ---------- widgets ----------
  function buildWidget(c, g, x, y, w) {
    var cx = x + w / 2;
    if (c.kind === 'stepper') {
      var cy = y + 44;
      svg('circle', { cx: cx, cy: cy, r: 34, fill: '#0e1623', stroke: '#30445f' }, g);
      ['red', 'blue', 'green', 'orange'].forEach(function (col, i) {
        var a = i * Math.PI / 2;
        svg('circle', { cx: cx + 34 * Math.cos(a), cy: cy - 34 * Math.sin(a), r: 4, fill: { red: '#ef555c', blue: '#438de8', green: '#51b879', orange: '#ef963f' }[col] }, g);
      });
      widgets.stepper = { hand: svg('line', { x1: cx, y1: cy, x2: cx + 28, y2: cy, stroke: '#edf3fa', 'stroke-width': 3, 'stroke-linecap': 'round' }, g), cx: cx, cy: cy, text: svg('text', { x: cx, y: y + 90, 'text-anchor': 'middle', 'class': 'extra' }, g, '') };
    } else if (c.kind === 'servo') {
      var sy = y + 52, id = c.id;
      svg('path', { d: 'M' + (cx - 66) + ' ' + sy + ' A26 26 0 0 1 ' + (cx - 14) + ' ' + sy, fill: 'none', stroke: '#30445f', 'stroke-width': 2 }, g);
      widgets[id] = { cx: cx - 40, cy: sy, hand: svg('line', { x1: cx - 40, y1: sy, x2: cx - 40, y2: sy - 24, stroke: '#ef963f', 'stroke-width': 4, 'stroke-linecap': 'round' }, g), text: svg('text', { x: cx + 4, y: sy - 8, 'class': 'extra' }, g, ''), text2: svg('text', { x: cx + 4, y: sy + 8, 'class': 'extra' }, g, '') };
      svg('circle', { cx: cx - 40, cy: sy, r: 4, fill: '#edf3fa' }, g);
    } else if (c.kind === 'hall' || c.kind === 'reader') {
      widgets[c.id] = { led: svg('circle', { cx: x + 18, cy: y + 14, r: 5, 'class': 'led' }, g), text: svg('text', { x: x + 30, y: y + 18, 'class': 'extra' }, g, '') };
    }
  }

  // ---------- derived electrical state (shared model) ----------
  var WM = window.DispenserWiringModel, model = null, uartLines = [], events = [];
  function logEvents(list) {
    list.forEach(function (e) {
      if (e.kind === 'uart') { uartLines.push(e.text); if (uartLines.length > 40) uartLines.shift(); }
      if (e.kind === 'phase') {
        var m = lastModel;
        events.unshift(e.sec.toFixed(1).padStart(6, ' ') + ' s  ' + e.phase + '  · S1 ' + m.s1.deg.toFixed(0) + '° ' + (m.s1.us / 1000).toFixed(2) + ' ms · S2 ' + m.s2.deg.toFixed(0) + '° ' + (m.s2.us / 1000).toFixed(2) + ' ms · hall ' + (m.home ? 'LOW' : 'HIGH'));
        if (events.length > 60) events.pop();
        var ol = $('eventLog'); ol.replaceChildren();
        events.forEach(function (line) { html('li', {}, ol, line); });
      }
    });
  }
  var lastModel = null;

  // ---------- rendering ----------
  function render(m) {
    W.signals.forEach(function (s) {
      var hi = WM.isHigh(s.fn, m), txt = WM.liveText(s.fn, m), w = wireEls[s.id];
      w.setAttribute('class', 'wire' + (s.fn.indexOf('servo') === 0 ? ' pwm' + ((s.fn === 'servo1' ? m.s1Moving : m.s2Moving) ? ' moving' : '') : '') + (hi ? ' hi' : ''));
      tagEls[s.id].textContent = txt;
      [s.from, s.to].forEach(function (pid) { dotEls[pid].setAttribute('class', 'pindot' + (hi ? ' hi' : '')); });
      if (liveCells[s.id]) liveCells[s.id].textContent = txt;
    });
    W.links.forEach(function (l) {
      var on = l.fn === 'common' || m.coils[Number(l.fn.slice(4)) - 1];
      linkEls[l.id].setAttribute('class', 'link' + (on ? ' hi' : ''));
    });
    var st = widgets.stepper;
    if (st) {
      st.hand.setAttribute('x2', st.cx + 28 * Math.cos(m.angle)); st.hand.setAttribute('y2', st.cy - 28 * Math.sin(m.angle));
      st.text.textContent = (m.angle * 180 / Math.PI).toFixed(1) + '° · half-step ' + mod(m.half, W.stepper.half_steps_per_rev);
    }
    [['s1', m.s1], ['s2', m.s2]].forEach(function (p) {
      var w = widgets[p[0]]; if (!w) return;
      var a = Math.PI - p[1].deg * Math.PI / 180;
      w.hand.setAttribute('x2', w.cx + 24 * Math.cos(a)); w.hand.setAttribute('y2', w.cy - 24 * Math.sin(a));
      w.text.textContent = p[1].deg.toFixed(0) + '° command'; w.text2.textContent = (p[1].us / 1000).toFixed(2) + ' ms pulse';
    });
    if (widgets.hall) { widgets.hall.led.setAttribute('class', 'led' + (m.home ? ' on' : '')); widgets.hall.text.textContent = m.home ? 'magnet at home · OUT pulled LOW' : 'no magnet · OUT pulled HIGH'; }
    if (widgets.reader) { widgets.reader.led.setAttribute('class', 'led' + (m.beam ? ' on' : '')); widgets.reader.text.textContent = m.beam ? 'scanning' : 'idle'; }
    renderScope(m); renderPhase(m); renderPower(m);
    $('uartLog').textContent = uartLines.length ? uartLines.join('\n') : 'no traffic yet';
  }

  function renderScope(m) {
    var root = $('scope'); root.replaceChildren();
    var x0 = 64, x1 = 312, k = (x1 - x0) / 3000;
    [['servo1', m.s1, 8], ['servo2', m.s2, 62]].forEach(function (r) {
      var sig = sigByFn[r[0]], hi = r[2] + 6, lo = r[2] + 36, w = r[1].us * k;
      svg('text', { x: 6, y: r[2] + 25, fill: '#cbd7e6', 'font-size': 11 }, root, 'GPIO' + sig.gpio);
      svg('polyline', { points: x0 + ',' + lo + ' ' + x0 + ',' + hi + ' ' + (x0 + w) + ',' + hi + ' ' + (x0 + w) + ',' + lo + ' ' + x1 + ',' + lo, fill: 'none', stroke: '#ef963f', 'stroke-width': 2 }, root);
    });
    [0, 1, 2, 3].forEach(function (ms) {
      var x = x0 + ms * 1000 * k;
      svg('line', { x1: x, y1: 4, x2: x, y2: 104, stroke: '#26354a', 'stroke-dasharray': '2 3' }, root);
      svg('text', { x: x, y: 116, fill: '#7e8ea3', 'font-size': 10, 'text-anchor': 'middle' }, root, ms + ' ms');
    });
  }
  function renderPhase(m) {
    var root = $('phaseTable'); root.replaceChildren();
    var seq = W.stepper.sequence, x0 = 50, cw = 33, y0 = 22, rh = 20;
    for (var c = 0; c < seq.length; c++) svg('text', { x: x0 + c * cw + cw / 2, y: 14, fill: '#7e8ea3', 'font-size': 10, 'text-anchor': 'middle' }, root, String(c + 1));
    for (var r = 0; r < 4; r++) {
      svg('text', { x: 6, y: y0 + r * rh + 14, fill: '#cbd7e6', 'font-size': 11 }, root, 'GPIO' + sigByFn['coil' + (r + 1)].gpio);
      for (var q = 0; q < seq.length; q++) svg('rect', { x: x0 + q * cw + 2, y: y0 + r * rh + 2, width: cw - 4, height: rh - 4, rx: 3, fill: seq[q][r] ? '#1f6f66' : '#162132' }, root);
    }
    svg('rect', { x: x0 + m.idx * cw, y: y0 - 1, width: cw, height: 4 * rh + 2, rx: 4, fill: 'none', stroke: m.moving ? '#71d6c6' : '#4b5b72', 'stroke-width': 2 }, root);
    $('stepReadout').textContent = m.moving
      ? 'Half-step ' + mod(m.half, W.stepper.half_steps_per_rev) + ' / ' + W.stepper.half_steps_per_rev + ' · sequence state ' + (m.idx + 1) + ' of ' + seq.length
      : 'Drum not moving: ' + W.stepper.idle + '.';
  }
  function renderPower(m) {
    var L = W.loads_ma, items = WM.loads(m);
    var total = items.reduce(function (a, i) { return a + i[1]; }, 0), box = $('powerBars'); box.replaceChildren();
    items.concat([['Total', total]]).forEach(function (i, n) {
      var row = html('div', { 'class': 'pbar' + (n === items.length ? ' total' : '') }, box);
      html('span', {}, row, i[0]); var tr = html('span', { 'class': 'track' }, row), f = html('i', { 'class': 'fill' }, tr);
      f.style.width = Math.min(100, i[1] / L.budget * 100) + '%'; html('b', {}, row, Math.round(i[1]) + ' mA');
    });
    $('powerTotal').textContent = Math.round(total) + ' of ' + L.budget + ' mA (' + L.budget_note + ')';
  }

  // ---------- static panels ----------
  function describe(pid) { var p = pins[pid]; return p.comp.label + ' · ' + p.pin.name; }
  function buildTable() {
    var tb = $('gpioRows');
    W.signals.slice().sort(function (a, b) { return a.gpio - b.gpio; }).forEach(function (s) {
      var e = espSideOf(s), o = e === pins[s.from] ? pins[s.to] : pins[s.from], tr = html('tr', { 'data-group': s.group }, tb);
      html('td', { 'class': 'gpio' }, tr, 'GPIO' + s.gpio); html('td', {}, tr, s.id); html('td', {}, tr, describe(o.comp.id + '.' + o.pin.id));
      html('td', {}, tr, s.role); html('td', {}, tr, s.dir === 'out' ? 'output' : 'input');
      liveCells[s.id] = html('td', { 'class': 'live' }, tr, '');
      rowEls[s.id] = tr;
      tr.addEventListener('mouseenter', function () { tr.classList.add('hot'); wireEls[s.id].setAttribute('stroke-width', 4.5); });
      tr.addEventListener('mouseleave', function () { tr.classList.remove('hot'); wireEls[s.id].setAttribute('stroke-width', 2.4); });
    });
    $('gpioCount').textContent = W.signals.length + ' GPIOs in use';
    $('plannedNote').textContent = 'Held back, not wired: ' + W.planned_gpio.map(function (p) { return 'GPIO' + p.gpio + ' (' + p.why + ')'; }).join('; ') + '.';
    var rl = $('reservedList');
    W.reserved_gpio.forEach(function (r) { html('li', {}, rl, 'GPIO ' + r.gpio.join(', ') + ': ' + r.why); });
    $('specNotice').textContent = W.notice;
    $('phaseTitle').textContent = 'Stepper half-step table (GPIO' + sigByFn.coil1.gpio + ' to GPIO' + sigByFn.coil4.gpio + ')';
    $('uartTitle').textContent = 'Reader UART (GPIO' + sigByFn.uart_tx.gpio + ' TX, GPIO' + sigByFn.uart_rx.gpio + ' RX)';
    var pn = $('powerNotes');
    W.power.forEach(function (p) { html('li', {}, pn, p.label + ': ' + p.note + '.'); });
  }
  function runChecks() {
    var out = [], used = {}, dup = [], bad = [], reserved = {}, mism = [], loose = [], clash = [];
    W.reserved_gpio.forEach(function (r) { r.gpio.forEach(function (g) { reserved[g] = true; }); });
    W.signals.forEach(function (s) {
      if (used[s.gpio]) dup.push(s.gpio); used[s.gpio] = s.id;
      if (reserved[s.gpio]) bad.push(s.gpio);
      var e = espSideOf(s); if (!e || e.pin.gpio !== s.gpio) mism.push(s.id);
    });
    W.planned_gpio.forEach(function (p) { if (used[p.gpio]) clash.push(p.gpio); });
    var wired = {};
    W.signals.concat(W.links).forEach(function (s) { wired[s.from] = true; wired[s.to] = true; });
    Object.keys(pins).forEach(function (id) { var p = pins[id].pin; if ((p.type === 'signal') && !wired[id]) loose.push(id); });
    out.push([!dup.length, 'Each GPIO drives exactly one net (' + W.signals.length + ' GPIOs, ' + (dup.length ? 'duplicate ' + dup.join(', ') : 'no duplicates') + ').']);
    out.push([!bad.length, 'No signal uses a strapping, USB, flash/PSRAM, JTAG, UART0 or on-board LED pin' + (bad.length ? ' (GPIO ' + bad.join(', ') + ')' : '') + '.']);
    out.push([!mism.length, 'Every net lands on the ESP32 pin with the same GPIO number' + (mism.length ? ' (' + mism.join(', ') + ')' : '') + '.']);
    out.push([!loose.length, 'No signal pin is left unconnected' + (loose.length ? ' (' + loose.join(', ') + ')' : '') + '.']);
    out.push([!clash.length, 'Pins held back for Feature 006 do not clash with any wired GPIO.']);
    var ul = $('checks'); ul.replaceChildren();
    out.forEach(function (c) { html('li', { 'class': c[0] ? '' : 'bad' }, ul, c[1]); });
  }

  // ---------- subsystem filter (sent by the viewer) ----------
  var groupsKey = null, hideOthers = false;
  function applyGroups(list) {
    document.querySelectorAll('[data-group]').forEach(function (el) {
      var g = el.getAttribute('data-group'), off = Boolean(list) && g !== 'core' && list.indexOf(g) < 0;
      el.setAttribute('data-dim', off ? (hideOthers ? '2' : '1') : '0');
    });
  }

  // ---------- sources ----------
  var feed = { state: null, angle: 0, at: -1e9 }, bench = { ctrl: null, closeAt: 0 };
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.source === 'dispenser-viewer-filter' && Array.isArray(d.groups) && (e.source === window.parent || e.source === window.opener)) { hideOthers = Boolean(d.hide); applyGroups(d.groups.filter(function (g) { return typeof g === 'string'; })); return; }
    if (!d || d.source !== 'dispenser-viewer' || !d.state || typeof d.state.phase !== 'string') return;
    if (e.source !== window.parent && e.source !== window.opener) return;
    if (typeof d.drumAngle !== 'number' || typeof d.state.carriage !== 'number' || typeof d.state.pinZ !== 'number' || typeof d.state.tongueEdge !== 'number') return;
    feed.state = d.state; feed.angle = d.drumAngle; feed.at = performance.now();
    if (Array.isArray(d.groups)) { var key = d.groups.join(',') + (d.hide ? '|hide' : ''); if (key !== groupsKey) { groupsKey = key; hideOthers = Boolean(d.hide); applyGroups(d.groups.filter(function (g) { return typeof g === 'string'; })); } }
  });
  function benchReset() {
    bench.ctrl = new Ctrl();
    ['red', 'blue', 'green', 'orange'].forEach(function (c) {
      var k = bench.ctrl.state.cartridges[c];
      k.occupancy = 'loaded'; k.count = D.demo.max_inventory;
      k.containerCode = Object.keys(D.demo.barcodes).filter(function (code) { return D.demo.barcodes[code] === c; })[0] || null;
    });
  }
  function setBenchEnabled(on) {
    ['benchColor', 'benchDispense', 'benchScan', 'benchReset'].forEach(function (id) { $(id).disabled = !on; });
  }
  var lastLive = null;
  function frame(now) {
    requestAnimationFrame(frame);
    var live = now - feed.at < FEED_MS, s, angle;
    if (live !== lastLive) {
      lastLive = live; setBenchEnabled(!live && Boolean(bench.ctrl));
      var b = $('sourceBadge'); b.textContent = live ? 'LIVE · 3D VIEWER' : 'BENCH · STANDALONE'; b.className = 'badge' + (live ? ' live' : '');
      $('sourceNote').textContent = live ? 'Receiving the state of the 3D viewer. Use the viewer controls to drive the electronics.' : 'No 3D viewer connected. Bench mode drives the same demo controller from the buttons below.';
    }
    if (live) { s = feed.state; angle = feed.angle; }
    else if (bench.ctrl) {
      var dt = Math.min(0.25, (now - (frame.last || now)) / 1000);
      s = bench.ctrl.tick(dt, now); angle = s.drumAngle;
      var open = ['red', 'blue', 'green', 'orange'].filter(function (c) { return s.cartridges[c].capOpen; })[0];
      if (open && bench.ctrl.idle()) { if (!bench.closeAt) bench.closeAt = now + 1200; else if (now > bench.closeAt) { bench.ctrl.closeCap(open); bench.closeAt = 0; } }
    } else return;
    frame.last = now;
    var m = model.derive(s, angle, now);
    lastModel = m; logEvents(m.events); render(m);
  }
  function init() {
    if (!W || !G) { document.body.textContent = 'Wiring data is missing.'; return; }
    W.signals.forEach(function (s) { sigByFn[s.fn] = s; });
    model = WM.create();
    if (/[?&]embed=1/.test(location.search)) document.body.classList.add('embed');
    buildDiagram(); buildTable(); runChecks();
    if (Ctrl && D) {
      benchReset(); setBenchEnabled(true);
      $('benchDispense').addEventListener('click', function () { bench.ctrl.requestDispense($('benchColor').value); });
      $('benchScan').addEventListener('click', function () {
        var color = $('benchColor').value, code = Object.keys(D.demo.barcodes).filter(function (c) { return D.demo.barcodes[c] === color; })[0];
        bench.ctrl.scan(code, performance.now());
      });
      $('benchReset').addEventListener('click', function () { if (bench.ctrl.idle()) benchReset(); });
    } else setBenchEnabled(false);
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
