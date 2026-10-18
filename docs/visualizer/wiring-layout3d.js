/* Organised 3D wiring layout (ASSUMED / NOT_VALIDATED concept). Only the electronics, laid out on a plate in four columns
   (supply and sensors | ESP32-S3 | driver, servos | stepper). Every pin and net comes from wiring-spec.js. Each signal runs on its own
   height lane between the columns and the 5 V / GND nets run as two stacked buses above, so nothing touches. Units are mm, z is up. */
(function () {
  'use strict';
  var K = {
    usbc: { c: [-150, 80], size: [28, 20, 11], pz: 6, pitch: 5, col: 1 },
    hall: { c: [-150, 8], size: [26, 20, 2], pz: 3, pitch: 6, col: 1 },
    reader: { c: [-150, -72], size: [44, 30, 30], pz: 15, pitch: 6, col: 1 },
    esp32: { c: [0, 0], size: [46, 66, 2], pz: 3, pitch: 7, col: 2 },
    uln2003: { c: [152, 72], size: [58, 48, 2], pz: 3, pitch: 7, col: 3 },
    s1: { c: [152, -8], size: [44, 22, 30], pz: 15, pitch: 7, col: 3 },
    s2: { c: [152, -76], size: [44, 22, 30], pz: 15, pitch: 7, col: 3 },
    stepper: { c: [270, 72], size: [44, 44, 26], pz: 8, pitch: 7, col: 4, plug: 8 }
  };
  var STUB = 6, LANE0 = 16, LANE = 3.0, Z_POWER = { '5V': 64, 'GND': 70 };
  var FN_COLOR = { coil: 0x71d6c6, servo: 0xef963f, hall: 0x51b879, uart: 0xb08cff }, NET_COLOR = { '5V': 0xef555c, 'GND': 0x9aa7b8 };
  function fnColor(fn) { return FN_COLOR[fn.replace(/[0-9]+$/, '').replace(/_.*/, '')] || 0xcbd7e6; }

  function build(ctx) {
    var T = ctx.THREE, W = ctx.W, root = ctx.root3d, WM = window.DispenserWiringModel, tl = window.DispenserWiring3D.tools(T, WM);
    var grp = new T.Group(); grp.name = 'wiring layout · 3D'; grp.visible = false; root.add(grp);
    function M(hex, o) { o = o || {}; return new T.MeshStandardMaterial({ color: hex, roughness: o.r === undefined ? 0.55 : o.r, metalness: o.m || 0, transparent: o.a !== undefined, opacity: o.a === undefined ? 1 : o.a, emissive: o.e || 0x000000 }); }
    var PCB_K = M(0x1b1f24), PCB_B = M(0x1b4f9c), PCB_G = M(0x1d7a4a), STEEL = M(0xb4bcc6, { m: 0.6, r: 0.35 }), DSTEEL = M(0x59616b, { m: 0.5, r: 0.4 }), BLACK = M(0x1b1f24), WHITE = M(0xeeeeee), GOLD = M(0xd4af37, { m: 0.7, r: 0.3 }), BLUE = M(0x2f5ea8), RED = M(0xff4040), PLATE = M(0x131a26, { r: 0.9 });
    function bx(cx, cy, cz, sx, sy, sz, m, name) { var o = new T.Mesh(new T.BoxGeometry(sx, sz, sy), m); o.position.set(cx, cz, -cy); if (name) o.name = name; grp.add(o); return o; }
    function cyl(cx, cy, cz, r, h, m) { var o = new T.Mesh(new T.CylinderGeometry(r, r, h, 36), m); o.position.set(cx, cz, -cy); grp.add(o); return o; }

    // ---------- pins ----------
    var comps = {}, pins = {};
    W.components.forEach(function (c) {
      comps[c.id] = c; var k = K[c.id], n = { l: 0, r: 0 }, tot = { l: 0, r: 0 };
      c.pins.forEach(function (p) { tot[p.side]++; });
      c.pins.forEach(function (p) {
        var i = n[p.side]++, dir = p.side === 'l' ? -1 : 1, ex = (k.plug && p.side === 'l') ? k.plug : 0;
        pins[c.id + '.' + p.id] = { comp: c, pin: p, dir: dir, x: k.c[0] + dir * (k.size[0] / 2 + ex), y: k.c[1] + ((tot[p.side] - 1) / 2 - i) * k.pitch, z: k.pz };
      });
    });
    function stub(p) { return [p.x + p.dir * STUB, p.y, p.z]; }
    function at(p) { return [p.x, p.y, p.z]; }

    // ---------- parts ----------
    function label(text, pos, hex, k) { var s = tl.textSprite(text, hex || '#cbd7e6', true, k || 2); s.position.set(pos[0], pos[2], -pos[1]); grp.add(s); return s; }
    function pinLabels(id) {
      Object.keys(pins).forEach(function (pid) {
        var p = pins[pid]; if (p.comp.id !== id) return;
        var has = p.pin.gpio !== undefined, text = has ? 'GPIO' + p.pin.gpio : p.pin.id, s = tl.textSprite(text, has ? '#71d6c6' : (p.pin.net ? ({ '5V': '#ef555c', '3V3': '#ef963f', 'GND': '#8795a8' }[p.pin.net]) : '#8795a8'), false, 1.7);
        s.position.set(p.x - p.dir * 8.5, p.z + 3.2, -p.y); grp.add(s);
        bx(p.x, p.y, p.z, 2.6, 2.6, 2.6, GOLD);
      });
    }
    function model(id) {
      var k = K[id], x = k.c[0], y = k.c[1], w = k.size[0], d = k.size[1], h = k.size[2], top = h;
      if (id === 'esp32') {
        bx(x, y, 1, w, d, 2, PCB_K); bx(x, y + 8, 4.5, 26, 30, 5, STEEL); bx(x, y + d / 2 - 7, 2.9, 22, 12, 1.8, GOLD); bx(x, y - d / 2 + 4, 4, 10, 8, 4, STEEL);
        [-1, 1].forEach(function (s) { for (var i = 0; i < 8; i++) bx(x + s * (w / 2 - 2.4), y + d / 2 - 8 - i * 7, 2.6, 4, 4.6, 1.2, GOLD); });
        top = 7;
      } else if (id === 'uln2003') {
        bx(x, y, 1, w, d, 2, PCB_B); bx(x - 8, y + 6, 4, 18, 8, 4, BLACK); bx(x - w / 2 + 4, y, 4, 6, 44, 4, BLACK); bx(x + w / 2 - 6, y, 6, 10, 34, 8, WHITE);
        for (var i = 0; i < 4; i++) bx(x + 6, y - 9 + i * 6, 2.6, 3, 3, 1.4, RED);
        top = 10;
      } else if (id === 'stepper') {
        cyl(x, y, 13, 22, 26, STEEL); bx(x, y, 26, 2 * 22 + 14, 8, 1.2, STEEL); cyl(x + 6, y, 31, 2.6, 10, DSTEEL); bx(x - w / 2 - 4, y, 8, 8, 38, 8, WHITE);
        top = 36;
      } else if (id === 's1' || id === 's2') {
        bx(x, y, 15, w, d, 30, BLUE); bx(x, y, 25, w + 14, d, 1.6, BLUE); cyl(x + 10, y, 33, 2.6, 6, DSTEEL); bx(x + 10, y, 36.4, 22, 5, 1.6, WHITE);
        top = 38;
      } else if (id === 'hall') {
        bx(x, y, 1, w, d, 2, PCB_G); cyl(x - 2, y, 6, 4, 8, BLACK);
        for (var j = 0; j < 3; j++) bx(x + 5, y + (1 - j) * 6, 2.6, 17, 1, 1, STEEL);
        top = 10;
      } else if (id === 'usbc') {
        bx(x, y, 5.5, w, d, 11, BLACK); bx(x - w / 2 - 3, y, 5.5, 8, 12, 6, STEEL);
      } else if (id === 'reader') {
        var g = M(0x23282f); bx(x, y, 15, w, d, 30, g); bx(x - w / 2 - 0.4, y, 18, 1, 20, 10, M(0xc0392b, { e: 0x4a0f10 }));
        top = 30;
      }
      pinLabels(id);
      label(comps[id].label + (comps[id].external ? ' (external)' : ''), [x, y, top + 14], comps[id].external ? '#8795a8' : '#edf3fa', 2.8);
    }
    bx(55, 0, -1, 540, 240, 2, PLATE, 'wiring layout plate');
    var parts = {};
    Object.keys(K).forEach(function (id) { var from = grp.children.length; model(id); parts[id] = grp.children.slice(from); });

    // ---------- wires ----------
    var wires = [];
    W.signals.forEach(function (s) { wires.push({ id: s.id, group: s.group, cls: 'signal', fn: s.fn, color: fnColor(s.fn), from: s.from, to: s.to }); });
    W.links.forEach(function (l) { wires.push({ id: l.id, group: l.group, cls: 'motor', fn: l.fn, color: parseInt(l.color.slice(1), 16), from: l.from, to: l.to }); });
    function colOf(pid) { return K[pins[pid].comp.id].col; }
    function ext(id, side) { var k = K[id]; return k.c[0] + (side === 'r' ? 1 : -1) * (k.size[0] / 2 + (side === 'l' && k.plug ? k.plug : 0)); }
    function colEdge(col, side) {
      var xs = Object.keys(K).filter(function (id) { return K[id].col === col; }).map(function (id) { return ext(id, side); });
      return side === 'r' ? Math.max.apply(null, xs) : Math.min.apply(null, xs);
    }
    var espL = colEdge(2, 'l') - STUB, espR = colEdge(2, 'r') + STUB;
    var spine = { L: { '5V': espL - 12, 'GND': espL - 19 }, R: { '5V': espR + 12, 'GND': espR + 19 } };
    var gaps = { '1-2': [colEdge(1, 'r') + STUB + 10, espL - 28], '2-3': [espR + 28, colEdge(3, 'l') - STUB - 10], '3-4': [colEdge(3, 'r') + STUB + 8, colEdge(4, 'l') - STUB - 8] };
    var byGap = {};
    wires.forEach(function (w, k) {
      w.lane = LANE0 + LANE * k;
      var a = colOf(w.from), b = colOf(w.to), g = Math.min(a, b) + '-' + Math.max(a, b);
      (byGap[g] = byGap[g] || []).push(w);
    });
    Object.keys(byGap).forEach(function (g) {
      var list = byGap[g].sort(function (p, q) { return Math.max(pins[q.from].y, pins[q.to].y) - Math.max(pins[p.from].y, pins[p.to].y); }), lo = gaps[g][0], hi = gaps[g][1];
      list.forEach(function (w, i) {
        var cx = lo + (i + 0.5) * (hi - lo) / list.length, A = pins[w.from], B = pins[w.to], S = stub(A), E = stub(B);
        w.pts = [at(A), S, [S[0], S[1], w.lane], [cx, S[1], w.lane], [cx, E[1], w.lane], [E[0], E[1], w.lane], E, at(B)];
      });
    });
    // 5 V and GND: a bus of each on its own height, left and right of the ESP32, branching to every supplied pin
    W.power.forEach(function (pw) {
      if (!NET_COLOR[pw.net]) return;
      var hubId = null; comps.esp32.pins.forEach(function (p) { if (p.net === pw.net) hubId = 'esp32.' + p.id; });
      var H = pins[hubId], H1 = stub(H), zN = Z_POWER[pw.net], sL = spine.L[pw.net], sR = spine.R[pw.net], col = NET_COLOR[pw.net];
      var src = pins[pw.source], S1 = stub(src);
      wires.push({ id: 'PWR_' + pw.net + '_IN', group: 'power', cls: 'power', fn: 'in', net: pw.net, color: col, from: pw.source, to: hubId,
        pts: [at(src), S1, [S1[0], S1[1], zN], [sL, S1[1], zN], [sL, H1[1], zN], [H1[0], H1[1], zN], H1, at(H)] });
      W.components.forEach(function (c) {
        if (['esp32', 'usbc', 'stepper'].indexOf(c.id) >= 0) return;
        c.pins.forEach(function (p) {
          if (p.net !== pw.net || (c.id === 'uln2003' && p.side === 'r')) return;
          var q = pins[c.id + '.' + p.id], Q1 = stub(q), s = K[c.id].col === 1 ? sL : sR;
          wires.push({ id: 'PWR_' + pw.net + '_' + c.id.toUpperCase(), group: c.group, cls: 'power', fn: c.id, net: pw.net, color: col, from: hubId, to: c.id + '.' + p.id,
            pts: [at(H), H1, [H1[0], H1[1], zN], [s, H1[1], zN], [s, Q1[1], zN], [Q1[0], Q1[1], zN], Q1, at(q)] });
        });
      });
    });
    wires.forEach(function (w) { tl.makeTube(w, w.pts, grp, w.cls === 'power' ? 1.0 : 1.1, 2.2, 3); });

    var show = { signal: true, motor: true, power: true }, groupsOn = null, hideOthers = false;
    function groupOn(g) { return !groupsOn || g === 'core' || groupsOn.indexOf(g) >= 0; }
    function fadeMat(m, on, base) { m.transparent = !on || base < 1; m.opacity = on ? base : 0.1; m.depthWrite = on; }
    // parts of systems that are not picked swap to a ghost copy of their material (materials are shared between parts)
    function fadePart(o, on) {
      if (o.isSprite) { o.material.opacity = on ? 1 : 0.15; return; }
      if (!o.isMesh) return;
      if (!o.userData.orig) { o.userData.orig = o.material; o.userData.ghost = o.material.clone(); o.userData.ghost.transparent = true; o.userData.ghost.depthWrite = false; o.userData.ghost.opacity = Math.min(0.12, o.material.opacity); }
      o.material = on ? o.userData.orig : o.userData.ghost;
    }
    function applyClasses() {
      Object.keys(parts).forEach(function (id) { var on = groupOn(comps[id].group); parts[id].forEach(function (o) { o.visible = on || !hideOthers; fadePart(o, on); }); });
      wires.forEach(function (w) { var on = groupOn(w.group); w.dim = !on; w.mesh.visible = Boolean(grp.visible && show[w.cls] && (on || !hideOthers)); fadeMat(w.mat, on, 1); w.pulses.forEach(function (p) { if (!w.mesh.visible || w.dim) p.mesh.visible = false; }); });
    }
    return {
      group: grp,
      setVisible: function (on) { grp.visible = Boolean(on); applyClasses(); },
      setClass: function (cls, on) { show[cls] = Boolean(on); applyClasses(); },
      setGroups: function (list, hide) { groupsOn = list ? list.slice() : null; hideOthers = Boolean(hide); applyClasses(); },
      update: function (m, nowSec) { if (grp.visible) tl.live(wires, m, nowSec); },
      colors: function () { return wires.map(function (w) { return { id: w.id, cls: w.cls, fn: w.fn, color: '#' + ('000000' + w.color.toString(16)).slice(-6) }; }); },
      report: function () { return { wires: wires.map(function (w) { return { id: w.id, cls: w.cls, length: Math.round(w.length * 10) / 10, points: w.pts }; }) }; },
      samples: function () { return wires.map(function (w) { var n = Math.ceil(w.length / 0.5), pts = []; for (var k = 0; k <= n; k++) { var v = w.curve.getPointAt(k / n); pts.push([v.x, -v.z, v.y]); } return { id: w.id, cls: w.cls, pts: pts }; }); }
    };
  }
  window.DispenserWiringLayout3D = { build: build };
}());
