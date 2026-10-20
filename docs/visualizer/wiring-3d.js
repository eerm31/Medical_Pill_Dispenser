/* 3D wiring harness (ASSUMED / NOT_VALIDATED concept). Every pin and net comes from wiring-spec.js; endpoints sit on the drawn parts.
   Wires are routed once on first use with a 3D path search over a voxel map of the real meshes, so they stay clear of parts,
   of the rotating drum, of the lever sweeps and of each other. Canonical mm (x right, y depth, z up) -> three (x, z, -y). */
(function () {
  'use strict';
  var CS = 1.0, ORG = [-50, -28, -37], N = [100, 88, 78], NXY = N[0] * N[1], TOTAL = N[0] * N[1] * N[2];

  // helpers shared with the 3D layout builder (wiring-layout3d.js)
  function tools(T, WM) {
    var consumerOf = { uln2003: 'stepper', s1: 's1', s2: 's2', reader: 'reader', hall: 'hall' };
    function toThree(p) { return new T.Vector3(p[0], p[2], -p[1]); }
    function filleted(pts, rmax) {
      var path = new T.CurvePath(), prev = toThree(pts[0]), i;
      for (i = 1; i < pts.length - 1; i++) {
        var a = toThree(pts[i - 1]), b = toThree(pts[i]), c = toThree(pts[i + 1]), din = b.clone().sub(a), dout = c.clone().sub(b), li = din.length(), lo = dout.length();
        if (li < 1e-6 || lo < 1e-6) continue;
        var r = Math.min(rmax || 1.6, li * 0.45, lo * 0.45), p1 = b.clone().addScaledVector(din.normalize(), -r), p2 = b.clone().addScaledVector(dout.normalize(), r);
        if (prev.distanceTo(p1) > 1e-6) path.add(new T.LineCurve3(prev, p1));
        path.add(new T.QuadraticBezierCurve3(p1, b, p2)); prev = p2;
      }
      var last = toThree(pts[pts.length - 1]); if (prev.distanceTo(last) > 1e-6) path.add(new T.LineCurve3(prev, last));
      return path;
    }
    function textSprite(text, hex, wide, scale) {
      var cv = document.createElement('canvas'); cv.width = wide ? 512 : 256; cv.height = 64;
      var c = cv.getContext('2d'); c.fillStyle = 'rgba(8,15,24,.88)'; c.fillRect(0, 0, cv.width, 64); c.strokeStyle = hex; c.lineWidth = 4; c.strokeRect(2, 2, cv.width - 4, 60);
      c.font = 'bold 30px sans-serif'; c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, cv.width / 2, 33);
      var tex = new T.CanvasTexture(cv), sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      var k = scale || 1; sp.scale.set((wide ? 20 : 8.5) * k, 2.1 * k, 1); sp.renderOrder = 22; return sp;
    }
    // tube along the points with three travelling pulses; fills w.curve, w.length, w.mesh, w.mat, w.pulses, w.points
    function makeTube(w, pts, parent, radius, pulseR, rmax) {
      var curve = filleted(pts, rmax), len = curve.getLength();
      var mat = new T.MeshStandardMaterial({ color: w.color, emissive: w.color, emissiveIntensity: 0.12, roughness: 0.45, metalness: 0.05 });
      var mesh = new T.Mesh(new T.TubeGeometry(curve, Math.max(12, Math.ceil(len / (radius * 1.8))), radius, 6, false), mat);
      mesh.name = 'wire · ' + w.id; mesh.userData.wire = w; parent.add(mesh);
      var pm = new T.MeshBasicMaterial({ color: 0xffffff }), geo = new T.SphereGeometry(pulseR, 10, 8);
      w.pulses = [0, 1, 2].map(function (k) { var s = new T.Mesh(geo, pm); s.visible = false; s.renderOrder = 5; parent.add(s); return { mesh: s, off: k / 3 }; });
      w.curve = curve; w.length = len; w.mesh = mesh; w.mat = mat; w.points = pts; w.pulseSpeed = pulseR * 47;
    }
    function powerActive(w, m) {
      var c = consumerOf[w.fn];
      if (!c) return w.fn === 'in' || w.fn === 'esp32';
      if (c === 'stepper') return m.moving; if (c === 's1') return m.s1Moving; if (c === 's2') return m.s2Moving; if (c === 'reader') return m.beam; return m.home;
    }
    function live(wires, m, nowSec) {
      wires.forEach(function (w) {
        if (!w.mesh) return;
        var on, hi, active;
        if (w.cls === 'signal') { hi = WM.isHigh(w.fn, m); active = WM.isActive(w.fn, m); on = active; }
        else if (w.cls === 'motor') { hi = w.fn === 'common' || Boolean(m.coils[Number(w.fn.slice(4)) - 1]); active = w.fn === 'common' ? m.moving : hi; on = active; }
        else { active = powerActive(w, m); hi = true; on = active; }
        w.mat.emissiveIntensity = w.dim ? 0.03 : w.cls === 'power' ? (active ? 0.7 : 0.15) : (hi && (active || w.cls === 'signal') ? (active ? 1.0 : 0.45) : 0.1);
        w.pulses.forEach(function (p) {
          p.mesh.visible = Boolean(w.mesh.visible && on && !w.dim);
          if (!p.mesh.visible) return;
          var u = (nowSec * (w.pulseSpeed || 45) / Math.max(w.length, 1) + p.off) % 1;
          p.mesh.position.copy(w.curve.getPointAt(u)); p.mesh.material.color.setHex(w.color);
        });
      });
    }
    return { toThree: toThree, filleted: filleted, textSprite: textSprite, makeTube: makeTube, live: live };
  }

  function build(ctx) {
    var T = ctx.THREE, W = ctx.W, S = ctx.S, root = ctx.root3d, grp = new T.Group();
    grp.name = 'wiring harness · 3D'; grp.visible = false; root.add(grp);
    var WM = window.DispenserWiringModel;
    var comps = {}, pinInfo = {};
    W.components.forEach(function (c) { comps[c.id] = c; var cnt = { l: 0, r: 0 }; c.pins.forEach(function (p) { pinInfo[c.id + '.' + p.id] = { comp: c, pin: p, i: cnt[p.side]++ }; }); });

    // ---------- endpoints on the drawn parts ----------
    var BZ = S.bay_z0, BAY = S.bay_modules, A = S.act, CYa = S.axle[1], MYc = S.axle[1] + S.motor_offset_y;
    function servoTail(cfg, lat, z, along) {
      var P = [cfg.pivot[0], cfg.pivot[1] + CYa], d = cfg.body_dir, SV = A.servo, L = SV.len - SV.shaft_off + (along || 0), n = [-d[1], d[0]];
      return [P[0] + d[0] * L + n[0] * lat, P[1] + d[1] * L + n[1] * lat, z];
    }
    // position of a pin in canonical mm, and how far around it the search may ignore the part it sits on
    function anchor(pid) {
      var info = pinInfo[pid], id = info.comp.id, i = info.i, p;
      if (id === 'esp32') p = [BAY.esp[0] + (info.pin.side === 'l' ? 1.0 : 17.5), BAY.esp[2] + 2.6 + 2.5 * i, BZ + 2.4];
      else if (id === 'uln2003') {
        if (info.pin.side === 'l') p = [BAY.uln[0] + 22.75, BAY.uln[2] + 20.9 + 2.2 * i, BZ + 10.1];
        else p = [BAY.uln[0] + 6.5, BAY.uln[2] + 4.0 + 2.2 * i, BZ + 9.6];
      } else if (id === 'stepper') {
        var a = (-62 + 8 * i) * Math.PI / 180;
        p = [(S.motor_body_r + 0.2) * Math.cos(a), MYc + (S.motor_body_r + 0.2) * Math.sin(a), S.motor_body_z0 + 9];
      } else if (id === 's1') p = servoTail(A.s1, (i - 1) * 2.0, A.s1.plate_z[1] + 11, 0);
      else if (id === 's2') p = servoTail(A.s2, (i - 1) * 2.0, A.s2.body_z0 + 5, 0);
      else if (id === 'hall') p = [(S.hall_x[0] + S.hall_x[1]) / 2 + (i - 1) * S.hall_lead_pitch, (S.hall_y[0] + S.hall_y[1]) / 2, S.hall_z0 - S.hall_lead_len + 0.2];
      else if (id === 'usbc') p = [(info.pin.id === 'GND' ? 2 : -2), S.jack.xy[1] - S.jack.d / 2 - 0.2, (S.jack.z0 + S.jack.z1) / 2];
      else if (id === 'reader') p = [-44.5, CYa - 4.5 + 3.0 * i, BZ + 1.5];
      return p;
    }
    var GLAND = [-48, CYa, BZ + 1.5];

    // ---------- wire list from the spec ----------
    var FN_COLOR = { coil: 0x71d6c6, servo: 0xef963f, hall: 0x51b879, uart: 0xb08cff }, NET_COLOR = { '5V': 0xef555c, 'GND': 0x9aa7b8 };
    function fnColor(fn) { return FN_COLOR[fn.replace(/[0-9]+$/, '').replace(/_.*/, '')] || 0xcbd7e6; }
    var wires = [];
    W.signals.forEach(function (s) { wires.push({ id: s.id, group: s.group, cls: 'signal', fn: s.fn, color: fnColor(s.fn), from: s.from, to: s.to, label: s.role }); });
    W.links.forEach(function (l) { wires.push({ id: l.id, group: l.group, cls: 'motor', fn: l.fn, color: parseInt(l.color.slice(1), 16), from: l.from, to: l.to, label: l.role }); });
    var consumerOf = { uln2003: 'stepper', s1: 's1', s2: 's2', reader: 'reader', hall: 'hall' };
    W.power.forEach(function (pw) {
      if (!NET_COLOR[pw.net]) return;
      var hub = null, src = pw.source;
      W.components.forEach(function (c) { c.pins.forEach(function (p) { if (c.id === 'esp32' && p.net === pw.net) hub = c.id + '.' + p.id; }); });
      if (src !== hub) wires.push({ id: 'PWR_' + pw.net + '_IN', group: 'power', cls: 'power', fn: 'in', net: pw.net, color: NET_COLOR[pw.net], from: src, to: hub, label: pw.label + ' in' });
      W.components.forEach(function (c) {
        if (c.id === 'esp32' || c.id === 'usbc' || c.id === 'stepper') return;
        c.pins.forEach(function (p) {
          if (p.net !== pw.net || (c.id === 'uln2003' && p.side === 'r')) return;
          wires.push({ id: 'PWR_' + pw.net + '_' + c.id.toUpperCase(), group: c.group, cls: 'power', fn: c.id, net: pw.net, color: NET_COLOR[pw.net], from: hub, to: c.id + '.' + p.id, label: pw.label + ' to ' + c.label });
        });
      });
    });

    // ---------- voxel map of the real parts ----------
    var raw, hard, soft, occ, g, par, stamp, stampNo = 0;
    function idxOf(x, y, z) {
      var ix = Math.floor((x - ORG[0]) / CS), iy = Math.floor((y - ORG[1]) / CS), iz = Math.floor((z - ORG[2]) / CS);
      if (ix < 0 || iy < 0 || iz < 0 || ix >= N[0] || iy >= N[1] || iz >= N[2]) return -1;
      return (iz * N[1] + iy) * N[0] + ix;
    }
    function mark(x, y, z) { var i = idxOf(x, y, z); if (i >= 0) raw[i] = 1; }
    function rasterTri(ax, ay, az, bx, by, bz, cx, cy, cz) {
      var st = [ax, ay, az, bx, by, bz, cx, cy, cz], guard = 0;
      while (st.length && guard++ < 400000) {
        var c2 = st.pop(), c1 = st.pop(), c0 = st.pop(), b2 = st.pop(), b1 = st.pop(), b0 = st.pop(), a2 = st.pop(), a1 = st.pop(), a0 = st.pop();
        var ab = Math.hypot(b0 - a0, b1 - a1, b2 - a2), bc = Math.hypot(c0 - b0, c1 - b1, c2 - b2), ca = Math.hypot(a0 - c0, a1 - c1, a2 - c2), m = Math.max(ab, bc, ca);
        if (m <= 0.7) { mark((a0 + b0 + c0) / 3, (a1 + b1 + c1) / 3, (a2 + b2 + c2) / 3); mark(a0, a1, a2); mark(b0, b1, b2); mark(c0, c1, c2); continue; }
        if (m === ab) { var m0 = (a0 + b0) / 2, m1 = (a1 + b1) / 2, m2 = (a2 + b2) / 2; st.push(a0, a1, a2, m0, m1, m2, c0, c1, c2, m0, m1, m2, b0, b1, b2, c0, c1, c2); }
        else if (m === bc) { var n0 = (b0 + c0) / 2, n1 = (b1 + c1) / 2, n2 = (b2 + c2) / 2; st.push(a0, a1, a2, b0, b1, b2, n0, n1, n2, a0, a1, a2, n0, n1, n2, c0, c1, c2); }
        else { var k0 = (c0 + a0) / 2, k1 = (c1 + a1) / 2, k2 = (c2 + a2) / 2; st.push(a0, a1, a2, b0, b1, b2, k0, k1, k2, k0, k1, k2, b0, b1, b2, c0, c1, c2); }
      }
    }
    function dilate(src, r) {
      var out = new Uint8Array(TOTAL), tmp = new Uint8Array(TOTAL), x, y, z, d, i;
      for (z = 0; z < N[2]; z++) for (y = 0; y < N[1]; y++) for (x = 0; x < N[0]; x++) { i = (z * N[1] + y) * N[0] + x; if (src[i]) for (d = -r; d <= r; d++) if (x + d >= 0 && x + d < N[0]) tmp[i + d] = 1; }
      for (z = 0; z < N[2]; z++) for (y = 0; y < N[1]; y++) for (x = 0; x < N[0]; x++) { i = (z * N[1] + y) * N[0] + x; if (tmp[i]) for (d = -r; d <= r; d++) if (y + d >= 0 && y + d < N[1]) out[i + d * N[0]] = 1; }
      tmp.fill(0);
      for (z = 0; z < N[2]; z++) for (y = 0; y < N[1]; y++) for (x = 0; x < N[0]; x++) { i = (z * N[1] + y) * N[0] + x; if (out[i]) for (d = -r; d <= r; d++) if (z + d >= 0 && z + d < N[2]) tmp[i + d * NXY] = 1; }
      return tmp;
    }
    function fillBox(x0, x1, y0, y1, z0, z1) {
      for (var z = z0; z <= z1; z += CS) for (var y = y0; y <= y1; y += CS) for (var x = x0; x <= x1; x += CS) mark(x, y, z);
    }
    function fillDisc(cx, cy, r, z0, z1, hollowFrom) {
      for (var z = z0; z <= z1; z += CS) for (var y = cy - (hollowFrom || r); y <= cy + (hollowFrom || r); y += CS) for (var x = cx - (hollowFrom || r); x <= cx + (hollowFrom || r); x += CS) {
        var d = Math.hypot(x - cx, y - cy); if (hollowFrom ? d >= r : d <= r) mark(x, y, z);
      }
    }
    function voxelise() {
      raw = new Uint8Array(TOTAL);
      root.updateMatrixWorld(true);
      var inv = new T.Matrix4().copy(root.matrixWorld).invert(), m4 = new T.Matrix4(), v = new T.Vector3(), box = new T.Box3(), wbox = new T.Box3(new T.Vector3(ORG[0], ORG[2], -(ORG[1] + N[1])), new T.Vector3(ORG[0] + N[0], ORG[2] + N[2], -ORG[1]));
      root.traverse(function (o) {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || ctx.skip(o) || !o.visible) return;
        for (var n = o.parent; n; n = n.parent) if (n.visible === false || n === grp) return;
        box.setFromObject(o); if (!box.intersectsBox(wbox)) return;
        m4.multiplyMatrices(inv, o.matrixWorld);
        var pos = o.geometry.attributes.position, idx = o.geometry.index, cnt = idx ? idx.count : pos.count, vs = [];
        function vert(k) { var q = idx ? idx.getX(k) : k; v.fromBufferAttribute(pos, q).applyMatrix4(m4); return [v.x, -v.z, v.y]; }
        for (var k = 0; k + 2 < cnt; k += 3) { var a = vert(k), b = vert(k + 1), c = vert(k + 2); rasterTri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }
      });
      // regions the moving parts sweep, the pill path and the housing envelope
      fillDisc(0, CYa, 24.8, 3.7, 58, 0); fillDisc(0, CYa, 7, -16.6, 3.7, 0);
      fillBox(-7.6, 7.6, -6.6, 6.6, -37, 3.7);
      fillDisc(A.s1.pivot[0], A.s1.pivot[1] + CYa, 19.5, 5.2, 31);
      fillDisc(A.s2.pivot[0], A.s2.pivot[1] + CYa, 13.5, -7, 0.5);
      fillDisc(0, CYa, 47, -37, 51, 47.0 + 3);
      fillDisc(0, CYa, 60, -37, -35.5, 0);
      fillDisc(0, CYa, 60, 49, 52, 0);
      hard = dilate(raw, 1); soft = dilate(hard, 1);
      occ = new Uint8Array(TOTAL); g = new Float32Array(TOTAL); par = new Int32Array(TOTAL); stamp = new Int32Array(TOTAL); closedAt = new Int32Array(TOTAL);
    }

    // ---------- 3D path search ----------
    // hr: radius (cells) around an endpoint where parts are ignored; wr: radius where other wires are ignored
    var NB = [], x, y, z;
    for (z = -1; z <= 1; z++) for (y = -1; y <= 1; y++) for (x = -1; x <= 1; x++) if (x || y || z) NB.push([x, y, z, Math.hypot(x, y, z), (z * N[1] + y) * N[0] + x]);
    function cellXYZ(i) { return [i % N[0], Math.floor(i / N[0]) % N[1], Math.floor(i / NXY)]; }
    function near(x, y, z, c0, c1, r) {
      return (Math.abs(x - c0[0]) <= r[0] && Math.abs(y - c0[1]) <= r[0] && Math.abs(z - c0[2]) <= r[0]) || (Math.abs(x - c1[0]) <= r[1] && Math.abs(y - c1[1]) <= r[1] && Math.abs(z - c1[2]) <= r[1]);
    }
    var closedAt = null;
    function search(p0, p1, o) {
      var s = idxOf(p0[0], p0[1], p0[2]), e = idxOf(p1[0], p1[1], p1[2]);
      if (s < 0 || e < 0) return null;
      var sc = cellXYZ(s), ec = cellXYZ(e), heap = [], no = ++stampNo;
      function push(f, i) { heap.push([f, i]); var k = heap.length - 1; while (k > 0) { var p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; var t = heap[p]; heap[p] = heap[k]; heap[k] = t; k = p; } }
      function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var k = 0; for (;;) { var l = 2 * k + 1, r = l + 1, m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; var t = heap[m]; heap[m] = heap[k]; heap[k] = t; k = m; } } return top; }
      function h(i) { var q = cellXYZ(i); return Math.hypot(q[0] - ec[0], q[1] - ec[1], q[2] - ec[2]); }
      g[s] = 0; par[s] = -1; stamp[s] = no; push(h(s), s);
      var iter = 0;
      while (heap.length && iter++ < 900000) {
        var cur = pop()[1];
        if (closedAt[cur] === no) continue; closedAt[cur] = no;
        if (cur === e) { var path = [], q = cur; while (q !== -1) { path.push(q); q = par[q]; } return path.reverse(); }
        var cq = cellXYZ(cur);
        for (var k = 0; k < NB.length; k++) {
          var nb = NB[k], nx = cq[0] + nb[0], ny = cq[1] + nb[1], nz = cq[2] + nb[2];
          if (nx < 0 || ny < 0 || nz < 0 || nx >= N[0] || ny >= N[1] || nz >= N[2]) continue;
          var ni = cur + nb[4];
          if (closedAt[ni] === no) continue;
          var hf = near(nx, ny, nz, sc, ec, o.hr);
          if (!hf && hard[ni]) continue;
          if (occ[ni] && occ[ni] !== o.grp && !near(nx, ny, nz, sc, ec, o.wr)) continue;
          var ng = g[cur] + nb[3] * (occ[ni] === o.grp ? 0.35 : 1 + (soft[ni] && !hf ? 0.7 : 0));
          if (stamp[ni] !== no || ng < g[ni]) { stamp[ni] = no; g[ni] = ng; par[ni] = cur; push(ng + h(ni) * 1.05, ni); }
        }
      }
      return null;
    }
    function lineFree(a, b, c0, c1, o) {
      var L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.ceil(L / 0.3);
      for (var k = 1; k < n; k++) {
        var t = k / n, i = idxOf(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
        if (i < 0) return false;
        var q = cellXYZ(i);
        if (hard[i] && !near(q[0], q[1], q[2], c0, c1, o.hr)) return false;
        if (occ[i] && occ[i] !== o.grp && !near(q[0], q[1], q[2], c0, c1, o.wr)) return false;
      }
      return true;
    }
    function route(p0, p1, o) {
      var path = search(p0, p1, o); if (!path) return null;
      var pts = path.map(function (i) { var q = cellXYZ(i); return [ORG[0] + (q[0] + .5) * CS, ORG[1] + (q[1] + .5) * CS, ORG[2] + (q[2] + .5) * CS]; });
      pts[0] = p0.slice(); pts[pts.length - 1] = p1.slice();
      var c0 = cellXYZ(idxOf(p0[0], p0[1], p0[2])), c1 = cellXYZ(idxOf(p1[0], p1[1], p1[2])), out = [pts[0]], i = 0;
      while (i < pts.length - 1) { var j = pts.length - 1; while (j > i + 1 && !lineFree(pts[i], pts[j], c0, c1, o)) j--; out.push(pts[j]); i = j; }
      return { pts: out, c0: c0, c1: c1, o: o };
    }
    function occupy(pts, c0, c1, o) {
      for (var s = 0; s + 1 < pts.length; s++) {
        var a = pts[s], b = pts[s + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.ceil(L / 0.25);
        for (var k = 0; k <= n; k++) {
          var t = k / n, i = idxOf(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
          if (i < 0) continue; var q = cellXYZ(i);
          for (var dz = -1; dz <= 1; dz++) for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
            var qx = q[0] + dx, qy = q[1] + dy, qz = q[2] + dz;
            if (qx < 0 || qy < 0 || qz < 0 || qx >= N[0] || qy >= N[1] || qz >= N[2]) continue;
            var oi = (qz * N[1] + qy) * N[0] + qx;
            if (!occ[oi] && !near(qx, qy, qz, c0, c1, o.wr)) occ[oi] = o.grp;
          }
        }
      }
    }

    // ---------- tubes with rounded corners ----------
    var tl = tools(T, WM), toThree = tl.toThree, filleted = tl.filleted, textSprite = tl.textSprite;
    function makeWire(w, pts) { tl.makeTube(w, pts, grp, w.cls === 'power' ? 0.42 : 0.45, 0.95); }
    // pin labels sit on a staircase above the pad rows, each tied to its pad by a thin leader line
    function buildLabels() {
      var esp = W.components.filter(function (c) { return c.id === 'esp32'; })[0], cnt = { l: 0, r: 0 };
      var lineMat = new T.LineBasicMaterial({ color: 0x8795a8, transparent: true, opacity: 0.8, depthTest: false });
      esp.pins.forEach(function (p) {
        var a = anchor('esp32.' + p.id), left = p.side === 'l', k = cnt[p.side]++, has = p.gpio !== undefined;
        var sp = textSprite(has ? 'GPIO' + p.gpio : p.name, has ? '#71d6c6' : '#8795a8'), at = [a[0] + (left ? -7 : 7), a[1], a[2] + 5 + 2.6 * k];
        sp.position.copy(toThree(at)); grp.add(sp);
        var ln = new T.Line(new T.BufferGeometry().setFromPoints([toThree([a[0], a[1], a[2] + 0.4]), toThree(at)]), lineMat); ln.renderOrder = 21; grp.add(ln);
      });
      var gl = new T.Mesh(new T.TorusGeometry(6.2, 0.7, 8, 28), new T.MeshStandardMaterial({ color: 0x8795a8, roughness: 0.6 }));
      gl.rotation.y = Math.PI / 2; gl.position.copy(toThree(GLAND)); gl.name = 'cable entry marker'; grp.add(gl);
      var gs = textSprite('cable entry: not designed', '#8795a8', true); gs.position.copy(toThree([GLAND[0] - 2, GLAND[1], GLAND[2] + 8])); grp.add(gs);
    }
    // external cable from the entry marker to the reader on the table (outside the product)
    function buildReaderCable() {
      var pts = [GLAND, [-56, GLAND[1], GLAND[2]], [-96, 8, -47], [-107.8, 0, -49.4], [-107.8, 0, 27], [-106.4, 0, 28]];
      var curve = filleted(pts), mat = new T.MeshStandardMaterial({ color: 0x8e7fc2, roughness: 0.6, transparent: true, opacity: 0.75 });
      var m = new T.Mesh(new T.TubeGeometry(curve, 80, 0.9, 6, false), mat); m.name = 'reader cable (external)'; m.userData.cls = 'signal'; grp.add(m); extCable = m;
    }
    function hardR(pid) { var c = pinInfo[pid].comp.id; return (c === 'esp32' || c === 'uln2003' || c === 'hall') ? 1 : 2; }
    var extCable = null, routed = false, failed = [];
    function ensure() {
      if (routed) return;
      routed = true;
      var t0 = (window.performance || Date).now();
      voxelise();
      var order = { signal: 0, motor: 1, power: 2 };
      wires.slice().sort(function (a, b) { return order[a.cls] - order[b.cls]; }).forEach(function (w) {
        var p0 = anchor(w.from), p1 = anchor(w.to);
        var r = route(p0, p1, { hr: [hardR(w.from), hardR(w.to)], wr: w.cls === 'power' ? [3, 2] : [2, 2], grp: w.cls === 'power' ? (w.net === '5V' ? 1 : 2) : 3 + wires.indexOf(w) });
        if (!r) { failed.push(w.id); w.routed = false; return; }
        w.routed = true; occupy(r.pts, r.c0, r.c1, r.o); makeWire(w, r.pts);
      });
      buildLabels(); buildReaderCable();
      grp.userData.routeMs = Math.round((window.performance || Date).now() - t0);
      applyClasses();
    }

    // ---------- live ----------
    var show = { signal: true, motor: true, power: true }, groupsOn = null, hideOthers = false, partsLive = false;
    function groupOn(g) { return !groupsOn || g === 'core' || groupsOn.indexOf(g) >= 0; }
    // picked groups stay solid and lit; the rest fade to a faint ghost (or disappear when hideOthers is set)
    function fadeMat(m, on, base) { m.transparent = !on || base < 1; m.opacity = on ? base : 0.1; m.depthWrite = on; }
    // the real electronic parts of systems that are not picked turn into a faint ghost; picked ones stay solid
    function applyParts() {
      if (!ctx.partGroup) return;
      root.traverse(function (o) {
        if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
        for (var n = o; n; n = n.parent) if (n === grp) return;
        var g = ctx.partGroup(o); if (!g) return;
        var on = groupOn(g) || !partsLive;
        if (!o.userData.wfOrig) {
          if (on) return;
          o.userData.wfOrig = o.material; o.userData.wfVis = o.visible;
          var gh = o.material.clone(); gh.transparent = true; gh.depthWrite = false; gh.opacity = Math.min(0.12, o.material.opacity === undefined ? 1 : o.material.opacity); o.userData.wfGhost = gh;
        }
        o.material = on ? o.userData.wfOrig : o.userData.wfGhost;
        o.visible = on ? o.userData.wfVis : (o.userData.wfVis && !hideOthers);
      });
    }
    function applyClasses() {
      applyParts();
      wires.forEach(function (w) { if (w.mesh) { var on = groupOn(w.group); w.dim = !on; w.mesh.visible = Boolean(grp.visible && show[w.cls] && (on || !hideOthers)); fadeMat(w.mat, on, 1); w.pulses.forEach(function (p) { if (!w.mesh.visible || w.dim) p.mesh.visible = false; }); } });
      if (extCable) { var onx = groupOn('scanner'); extCable.visible = show.signal && (onx || !hideOthers); fadeMat(extCable.material, onx, 0.75); }
    }
    function update(m, nowSec) { if (routed && grp.visible) tl.live(wires, m, nowSec); }
    function setVisible(on) { if (on) ensure(); grp.visible = Boolean(on); applyClasses(); }
    function setClass(cls, on) { show[cls] = Boolean(on); applyClasses(); }
    function setGroups(list, hide) { groupsOn = list ? list.slice() : null; hideOthers = Boolean(hide); applyClasses(); }
    // the boards fade by system as soon as the wiring view opens, not only once the harness has been routed
    function setPartsLive(on) { partsLive = Boolean(on); applyParts(); }
    function probe(a, b, grp, wr, clear) { ensure(); if (clear) occ.fill(0); var p0 = anchor(a), p1 = anchor(b), r = route(p0, p1, { hr: [hardR(a), hardR(b)], wr: wr || [2, 2], grp: grp || 250 }); return { from: p0, to: p1, startHard: hardAt(p0[0], p0[1], p0[2]), endHard: hardAt(p1[0], p1[1], p1[2]), pts: r && r.pts }; }
    function hardAt(x, y, z) { var i = idxOf(x, y, z); return i < 0 ? null : Boolean(hard && hard[i]); }
    return {
      group: grp, ensure: ensure, setVisible: setVisible, setClass: setClass, setGroups: setGroups, setPartsLive: setPartsLive, reapply: applyParts, update: update,
      colors: function () { return wires.map(function (w) { return { id: w.id, cls: w.cls, fn: w.fn, color: '#' + ('000000' + w.color.toString(16)).slice(-6) }; }); },
      report: function () { return { routed: routed, failed: failed.slice(), routeMs: grp.userData.routeMs, wires: wires.filter(function (w) { return w.mesh; }).map(function (w) { return { id: w.id, cls: w.cls, length: Math.round(w.length * 10) / 10, points: w.points.map(function (p) { return p.map(function (v) { return Math.round(v * 10) / 10; }); }) }; }) }; },
      samples: function () { return wires.filter(function (w) { return w.mesh; }).map(function (w) { var n = Math.ceil(w.length / 0.5), pts = []; for (var k = 0; k <= n; k++) { var v = w.curve.getPointAt(k / n); pts.push([v.x, -v.z, v.y]); } return { id: w.id, cls: w.cls, pts: pts }; }); },
      hardAt: hardAt, probe: probe
    };
  }
  window.DispenserWiring3D = { build: build, tools: tools };
}());
