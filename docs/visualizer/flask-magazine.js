(function () {
  'use strict';
  /* Stacked flask (Prototype 2, ASSUMED / NOT_VALIDATED, concept only): four ring magazines stacked like a wedding cake in a slim
     flask-shaped housing. One vertical rod beside the stack rides on an arm at the bottom: servo S1 lifts the pin carrier to a ring,
     servo S2 pushes the pin in behind a divider, the stepper swings the arm one pocket. Pills are pushed by the divider behind them,
     slide down a ramp into ONE shared chute and drop into a cup at the base. The top is free: open the lid and pour. The demo
     controller is untouched; this file only maps its phase names to motion. */
  var TAU = Math.PI * 2;
  function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  function ease(q) { q = Math.max(0, Math.min(1, q)); return q * q * (3 - 2 * q); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  var PILLS = [
    { kind: 'round', name: 'small round', L: 4.2, W: 4.2, H: 2.0 },
    { kind: 'round', name: 'large round', L: 6.0, W: 6.0, H: 2.8 },
    { kind: 'oval', name: 'oval', L: 9.5, W: 6.2, H: 3.4 },
    { kind: 'capsule', name: 'capsule', L: 12.0, W: 5.0, H: 5.0 }
  ];
  var PIN_R = 0.9;
  var ORDER = ['PIN_ENGAGE', 'BLADE_PULL_RELEASE', 'STACK_SETTLE', 'BLADE_ISOLATE_CLOSE', 'BLADE_CLOSED_DWELL', 'PIN_LIFT', 'TONGUE_RELEASE', 'PILL_CLEAR', 'TONGUE_RETURN'];
  var DURS = [0.625, 1.01, 0.5, 1.01, 0.3, 0.625, 0.814, 0.5, 0.814];
  var LABELS = {
    DRUM_ROTATE: ['Carrier lifts to the ring', 'Servo S1 lifts the pin carrier up the rod to the level of the selected ring.'],
    CARRIAGE_APPROACH: ['Arm swings to the pin start', 'The stepper at the base turns the arm until the rod stands beside the divider to push.'],
    PIN_ENGAGE: ['Pin pushes in behind a divider', 'Servo S2 pushes the pin in from the rod, into the pocket behind one divider of the selected ring.'],
    BLADE_PULL_RELEASE: ['Divider pushes the pill', 'The arm swings one pocket pitch; each divider pushes the pill in front of it along its ring.'],
    STACK_SETTLE: ['Pill reaches the exit', 'The front pill is pushed past the exit edge and starts down the ramp.'],
    BLADE_ISOLATE_CLOSE: ['Pill slides to the chute', 'The pill slides down the ramp into the shared chute while the pin pulls back.'],
    BLADE_CLOSED_DWELL: ['Pin clear (dwell)', 'Short pause with the pin withdrawn into the rod.'],
    PIN_LIFT: ['Arm returns to park', 'The arm swings back to its home position at the bottom.'],
    TONGUE_RELEASE: ['Pill falls down the chute', 'The pill drops down the single chute along the flask wall.'],
    PILL_CLEAR: ['Pill lands in the cup', 'The pill lands in the collection cup in the base.'],
    TONGUE_RETURN: ['Carrier parks', 'The rod and carrier are at rest; nothing else moved.']
  };

  function build(ctx) {
    var T = ctx.THREE, S = ctx.S, M = ctx.mats, COLORS = ctx.COLORS, std = ctx.std;
    var CYa = S.axle[1], N = 12, P = TAU / N, CAP = 5, WH = 7.5, RT = 0.8, TAB = 2.5, VMIN = 1.4;
    var RR = [14, 19, 24, 29], ZL = [69, 45, 21, -3], ZT = S.table_z, ZTOP = 84, SR = 42.5, RROD = 38.5, RCH = 38.5, TB = 4;
    var thE = -20 * Math.PI / 180, PARK = thE + 170 * Math.PI / 180, SV = S.act.servo;
    var st = { active: false, q: 0.45, sel: -1, lid: 0, lidT: 0, session: false };
    var root = new T.Group(); root.name = 'stacked flask'; root.position.set(0, 0, -CYa); root.visible = false; ctx.parent.add(root);
    var PR = std(0x9fc2e6, { transparent: true, opacity: 0.8, roughness: 0.45 }), SILVER = std(0xc9d1da, { metalness: 0.7, roughness: 0.3 }), WHITE = std(0xf1f3f5, { roughness: 0.4 });
    var GLASS = std(0xdfe8f0, { transparent: true, opacity: 0.14, roughness: 0.1, metalness: 0.2, side: T.DoubleSide, depthWrite: false });

    function tag(o, label, kind, piece, type) { ctx.rtag(o, label, kind, piece); o.userData.ring = true; if (type) ctx.ptype(o, type); return o; }
    function edges(m) { m.add(new T.LineSegments(new T.EdgesGeometry(m.geometry, 30), ctx.EL)); return m; }
    function bx(par, x0, x1, l0, l1, z0, z1, mat, edge) {
      var m = new T.Mesh(new T.BoxGeometry(x1 - x0, z1 - z0, l1 - l0), mat); m.position.set((x0 + x1) / 2, (z0 + z1) / 2, -(l0 + l1) / 2); par.add(m);
      return edge === false ? m : edges(m);
    }
    function cy(par, x, l, z0, z1, r, mat, seg, open) { var m = new T.Mesh(new T.CylinderGeometry(r, r, z1 - z0, seg || 24, 1, Boolean(open)), mat); m.position.set(x, (z0 + z1) / 2, -l); par.add(m); return m; }
    function ringGeo(rOut, rIn, h) {
      var s = new T.Shape(), p = new T.Path(); s.absarc(0, 0, rOut, 0, TAU, false); p.absarc(0, 0, rIn, 0, TAU, true); s.holes.push(p);
      var g = new T.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 72 }); g.rotateX(-Math.PI / 2); return g;
    }
    function profile(par, pts, l0, l1, mat) {
      var s = new T.Shape(); pts.forEach(function (p, i) { if (i) s.lineTo(p[0], p[1]); else s.moveTo(p[0], p[1]); }); s.closePath();
      var m = new T.Mesh(new T.ExtrudeGeometry(s, { depth: l1 - l0, bevelEnabled: false }), mat); m.position.z = -l1; par.add(m); return edges(m);
    }

    // ---------- housing: slim glass flask, white base, steel spine, ledges ----------
    var shell = new T.Mesh(new T.CylinderGeometry(SR, SR, ZTOP - ZT - 5, 72, 1, true), GLASS); shell.position.y = (ZTOP + ZT + 5) / 2; root.add(shell); tag(shell, 'Flask shell', 'printed', 'shell');
    tag(cy(root, 0, 0, ZT, ZT + 5, SR + 0.4, WHITE, 72), 'Flask base', 'printed', 'base');
    [ZT + 5, ZTOP - 3].forEach(function (z) { var b = new T.Mesh(ringGeo(SR + 0.6, SR - 1.2, 3), SILVER); b.position.y = z; root.add(b); });
    tag(cy(root, 0, 0, -6, ZTOP, 6, SILVER, 40), 'Central spine', 'bought', 'spine');
    var lidG = new T.Group(); root.add(lidG); tag(cy(lidG, 0, 0, ZTOP, ZTOP + 8, SR + 0.6, SILVER, 72), 'Flask lid', 'printed', 'lid'); tag(cy(lidG, 0, 0, ZTOP + 8, ZTOP + 11, 9, WHITE, 40), 'Flask lid', 'printed', 'lid');
    RR.forEach(function (r, k) { var l = new T.Mesh(ringGeo(r + TB + 1.5, 6, 1.5), PR); l.position.y = ZL[k] - 1.5; root.add(l); tag(edges(l), 'Ring ledge', 'printed', 'ledge' + k); });
    tag(cy(root, 0, 0, -4.5, -3, SR - 1, PR, 72), 'Flask base', 'printed', 'base');

    // ---------- one exit ramp per ring, ONE shared chute, one cup ----------
    var exitG = new T.Group(); exitG.rotation.y = thE; root.add(exitG);
    RR.forEach(function (r, k) { tag(profile(exitG, [[r + TB, ZL[k] - 1], [RCH - 3, ZL[k] - 11], [RCH - 3, ZL[k] - 10], [r + TB, ZL[k]]], -3.2, 3.2, PR), 'Exit ramp', 'printed', 'ramp' + k); });
    tag(cy(exitG, RCH, 0, -44, ZL[0] - 6, 3.6, GLASS, 28, true), 'Shared chute', 'printed', 'chute');
    tag(cy(exitG, RCH, 0, -47, -38, 8.5, GLASS, 32, true), 'Collection cup', 'printed', 'cup');
    tag(cy(exitG, RCH, 0, -47, -46, 8.5, PR, 32), 'Collection cup', 'printed', 'cup');

    // ---------- rings ----------
    var rings = [], pillMats = [], rimMats = [];
    function pitchMm(k) { return P * RR[k]; }
    function pocketW(k, q) { var cmax = Math.max(0.6, Math.min(3.0, pitchMm(k) - VMIN - PILLS[k].L)); return PILLS[k].L + 0.6 + (cmax - 0.6) * q; }
    function vaneT(k, q) { return pitchMm(k) - pocketW(k, q); }
    function slack(k) { return Math.max(0, (pocketW(k, st.q) - PILLS[k].L) / 2) / RR[k]; }
    COLORS.forEach(function (color, k) {
      var r0 = RR[k] - TB, r1 = RR[k] + TB, accent = ctx.accent[color] || 0x8294a5, g = new T.Group(), rim = std(accent, { transparent: true, opacity: 0.5, roughness: 0.5, side: T.DoubleSide, depthWrite: false }), solid = std(accent, { roughness: 0.55 });
      rimMats.push(rim); g.position.y = ZL[k] + 0.2; root.add(g);
      var parts = [new T.Mesh(ringGeo(r0 + RT, r0, WH), rim), new T.Mesh(ringGeo(r1, r1 - RT, WH), rim), new T.Mesh(ringGeo(r1, r1 - RT - 0.2, 0.9), solid)];
      parts[2].position.y = WH - 0.9; parts.forEach(function (m) { g.add(m); tag(m, 'Ring magazine', 'printed', 'ring' + k); });
      var vanes = [], tabs = [], width = (r1 - RT) - (r0 + RT) + 0.2;
      for (var j = 0; j < N; j++) {
        var vg = new T.Group(); vg.rotation.y = thE - j * P; g.add(vg);
        var v = new T.Mesh(new T.BoxGeometry(width, WH, 1), solid); v.position.set(RR[k], WH / 2, 0); vg.add(v); tag(v, 'Ring magazine', 'printed', 'ring' + k); vanes.push(v);
        var tb = new T.Mesh(new T.BoxGeometry(TAB + RT, 3, 1), solid); tb.position.set(r1 + (TAB - RT) / 2, WH - 2.2, 0); vg.add(tb); tag(tb, 'Ring magazine', 'printed', 'ring' + k); tabs.push(tb);
      }
      rings.push({ k: k, g: g, vanes: vanes, tabs: tabs, K: 0, A: 0, pills: [], sess: false, canon: true });
      pillMats.push({ main: std(accent, { roughness: 0.35 }), white: std(0xf4f4f0, { roughness: 0.4 }) });
    });
    function applyPocket() { rings.forEach(function (r) { var t = vaneT(r.k, st.q); r.vanes.forEach(function (v) { v.scale.z = t; }); r.tabs.forEach(function (v) { v.scale.z = t; }); }); }
    applyPocket();

    // ---------- pills ----------
    function pillObject(k) {
      var d = PILLS[k], mm = pillMats[k], g = new T.Group(), m;
      if (d.kind === 'round') { m = new T.Mesh(new T.CylinderGeometry(d.L / 2, d.L / 2, d.H, 28), mm.main); m.position.y = d.H / 2; g.add(m); }
      else if (d.kind === 'oval') { m = new T.Mesh(new T.SphereGeometry(1, 24, 16), mm.main); m.scale.set(d.L / 2, d.H / 2, d.W / 2); m.position.y = d.H / 2; g.add(m); }
      else {
        var r = d.W / 2, half = (d.L - d.W) / 2, a = new T.Mesh(new T.CylinderGeometry(r, r, half, 20), mm.main), b = new T.Mesh(new T.CylinderGeometry(r, r, half, 20), mm.white);
        a.rotation.z = b.rotation.z = Math.PI / 2; a.position.set(-half / 2, r, 0); b.position.set(half / 2, r, 0); g.add(a, b);
        [[-half, mm.main], [half, mm.white]].forEach(function (e) { var s = new T.Mesh(new T.SphereGeometry(r, 20, 12), e[1]); s.position.set(e[0], r, 0); g.add(s); });
      }
      g.userData.noWire = true; root.add(g); return g;
    }
    function uOf(r, p) { return ((((p.m - r.K) % N) + N) % N) + 1; }
    function mOfU(r, u) { return (((u - 1 + r.K) % N) + N) % N; }
    function newPill(r, u, drop) { var p = { k: r.k, m: mOfU(r, u), off: 0, mesh: pillObject(r.k), drop: drop || 0 }; r.pills.push(p); return p; }
    function killPill(p) { if (p.mesh.parent) p.mesh.parent.remove(p.mesh); }
    function rebuild(r, n) { r.pills.forEach(killPill); r.pills = []; for (var u = 1; u <= n; u++) newPill(r, u, 0.6 + 0.12 * u); r.canon = true; }
    function pocketCenter(r, m) { return r.A + thE - (m + 0.5) * P; }
    function placePill(p, r) {
      var phi = pocketCenter(r, p.m) + p.off;
      p.mesh.position.set(RR[p.k] * Math.cos(phi), ZL[p.k] + p.drop * 9, -RR[p.k] * Math.sin(phi)); p.mesh.rotation.set(0, phi + Math.PI / 2, 0); p.mesh.visible = true;
    }
    function movePills(r, dA) { var sl = slack(r.k); r.A += dA; r.pills.forEach(function (p) { p.off = Math.max(-sl, Math.min(sl, p.off - dA)); }); }
    function crossed(r) {
      for (var i = 0; i < r.pills.length; i++) {
        var p = r.pills[i], phi = pocketCenter(r, p.m) + p.off;
        if (wrap(phi - thE) * RR[r.k] >= 0.6 && uOf(r, p) <= 2) return p;
      }
      return null;
    }

    // ---------- the actuator at the bottom: stepper, arm, two servos; rod with carrier and pin beside the stack ----------
    var Z_ARM0 = -9, Z_ARM1 = -7.6, ZTAB = function (k) { return ZL[k] + 0.2 + WH - 2.2; };
    var armG = new T.Group(); root.add(armG);
    tag(cy(root, 0, 0, -48, -29, 14, SILVER, 40), '28BYJ-48 stepper', 'bought', 'motor-body');
    tag(cy(root, 0, 0, -29, -7.6, 2.5, M.steel, 14), '28BYJ-48 stepper', 'bought', 'motor-shaft');
    tag(cy(armG, 0, 0, -10, -5.5, 7, PR, 32), 'Actuator arm', 'printed', 'arm');
    tag(bx(armG, 7, RROD + 1.5, -3, 3, Z_ARM0, Z_ARM1, PR), 'Actuator arm', 'printed', 'arm');
    tag(cy(armG, RROD, 0, Z_ARM0, ZTOP - 6, 1.6, M.steel, 14), 'Actuator arm', 'bought', 'rod');
    function servoLabel(list, label) { list.forEach(function (m) { tag(m, label, 'bought', 'servo', 'electronic'); }); }
    servoLabel([bx(armG, 4, 27, 1, 23, -21.2, Z_ARM0, M.blue, false)], 'Micro servo S1 (pin)');
    servoLabel([bx(armG, 4, 27, -23, -1, -21.2, Z_ARM0, M.blue, false)], 'Micro servo S2 (tongue)');
    var carG = new T.Group(); armG.add(carG); carG.position.x = RROD;
    tag(bx(carG, -3.2, 3.2, -3.2, 3.2, -2.2, 2.2, PR), 'Actuator arm', 'printed', 'carriage');
    var pinGeo = new T.CylinderGeometry(PIN_R, PIN_R, 1, 14); pinGeo.rotateZ(Math.PI / 2);
    var pinM = new T.Mesh(pinGeo, M.dark); carG.add(pinM); tag(pinM, 'Engagement pin', 'bought', 'pin');
    function wire(l) { var g = new T.CylinderGeometry(0.35, 0.35, 1, 8), m = new T.Mesh(g, M.steel); m.position.set(RROD - 1.8, 0, -l); armG.add(m); tag(m, 'Push-pull cable', 'bought', 'cable'); return m; }
    var wireA = wire(2.2), wireB = wire(-2.2);
    // electronics in the base: ESP32 with the ULN2003 board stacked above it
    var espG = [bx(root, -34, -15, -10, 10, -47, -45.4, new T.MeshStandardMaterial({ color: 0x1b1f24 }), false), bx(root, -32, -17, -5, 5, -45.4, -42, M.steel, false)];
    espG.forEach(function (m) { tag(m, 'ESP32 controller', 'bought', 'esp'); });
    var ulnG = [bx(root, -34, -15, -12, 12, -38, -36.4, new T.MeshStandardMaterial({ color: 0x1b4f9c }), false), bx(root, -31, -19, -6, 6, -36.4, -30, M.white, false)];
    ulnG.forEach(function (m) { tag(m, 'ULN2003 driver board', 'bought', 'uln'); });
    [[-33, -9], [-16, -9], [-33, 9], [-16, 9]].forEach(function (c) { var s = cy(root, c[0], c[1], -47, -38, 1.4, M.steel, 10); tag(s, 'Base standoff', 'printed', 'standoff'); });
    // steel ballast ring in the base
    var BALLAST = { r0: 30, r1: 40, z0: -50.4, z1: -46.4 };
    tag(new T.Mesh(ringGeo(BALLAST.r1, BALLAST.r0, BALLAST.z1 - BALLAST.z0), M.steel), 'Base ballast', 'bought', 'ballast').position.y = BALLAST.z0;

    // loading-window marker and the pill bottle
    var marker = new T.Mesh(new T.RingGeometry(2.6, 3.6, 28), new T.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.9, depthTest: false, side: T.DoubleSide }));
    marker.rotation.x = -Math.PI / 2; marker.renderOrder = 30; marker.visible = false; root.add(marker);
    var bottle = new T.Group(), bTilt = new T.Group(); bottle.add(bTilt); bottle.visible = false; bottle.userData.noWire = true; root.add(bottle);
    var bandMat = std(0x888888, { roughness: 0.5 });
    [[new T.CylinderGeometry(5.5, 5.5, 18, 28), std(0xf3f6fa, { transparent: true, opacity: 0.5, roughness: 0.3, depthWrite: false }), 11],
     [new T.CylinderGeometry(3.7, 3.7, 3, 20), std(0xe0a43a, { roughness: 0.5 }), 0.5],
     [new T.CylinderGeometry(5.65, 5.65, 7, 28), bandMat, 12]].forEach(function (e) { var m = new T.Mesh(e[0], e[1]); m.rotation.z = Math.PI / 2; m.position.x = e[2]; bTilt.add(m); });

    // ---------- shared state ----------
    var arm = { theta: PARK, zc: ZTAB(3), ext: 0, k: 3 }, rec = null, cup = [], tasks = [], task = null, last = 0;
    function tipR(k) { return RR[k] + TB + TAB * 0.6; }
    function delta(k) { return (vaneT(k, st.q) / 2 + PIN_R + 0.05) / tipR(k); }
    function norm(a) { while (a < 0) a += TAU; while (a >= TAU) a -= TAU; return a; }
    function thetaFwd(k) { return norm(thE - 8 * P - delta(k)); }
    function thetaRev(k) { return norm(thE - 8 * P + delta(k)); }
    function applyArm() {
      armG.rotation.y = arm.theta; carG.position.y = arm.zc;
      var len = Math.max(1, RROD - lerp(RROD - 1.5, tipR(arm.k), arm.ext)); pinM.scale.x = len; pinM.position.x = -len / 2;
      var h = Math.max(1, arm.zc - Z_ARM0); [wireA, wireB].forEach(function (w) { w.scale.y = h; w.position.y = Z_ARM0 + h / 2; });
    }
    function applyRings(selColor) {
      rings.forEach(function (r) {
        r.g.rotation.y = r.A;
        var on = COLORS[r.k] === selColor || r.k === st.sel; rimMats[r.k].emissive.setHex(on ? 0x333333 : 0x000000);
        r.pills.forEach(function (p) { if (p.drop > 0 && !p.hold) p.drop = Math.max(0, p.drop - 0.06); placePill(p, r); });
      });
    }
    function cupSpot(n) { var dx = ((n % 3) - 1) * 3, dy = (Math.floor(n / 3) % 2 - 0.5) * 3.5, c = Math.cos(thE), s = Math.sin(thE); return [(RCH + dx) * c - dy * s, (RCH + dx) * s + dy * c, -46 + Math.floor(n / 6) * 3]; }
    function landPill(p) { var sp = cupSpot(cup.length); p.mesh.position.set(sp[0], sp[2], -sp[1]); p.mesh.rotation.set(0, 0.6 * cup.length, 0); cup.push(p); }
    function fallPose(f, tau) {
      var k = f.p.k, c = Math.cos(thE), s = Math.sin(thE), sp = cupSpot(cup.length), pos, yaw;
      var rampEnd = [RCH - 3, ZL[k] - 11], tubeBot = -39;
      if (tau < 0.22) { var u = ease(tau / 0.22), r = lerp(f.r0, rampEnd[0], u), a = lerp(f.a0, thE, u); pos = [r * Math.cos(a), r * Math.sin(a), lerp(ZL[k], rampEnd[1], u)]; yaw = lerp(f.yaw0, thE, u); }
      else if (tau < 0.82) { var d = (tau - 0.22) / 0.6, x = lerp(rampEnd[0], RCH, Math.min(1, d * 3)); pos = [x * c, x * s, lerp(rampEnd[1], tubeBot, d * d)]; yaw = thE + d * 3; }
      else { var l = (tau - 0.82) / 0.18; pos = [lerp(RCH * c, sp[0], l), lerp(RCH * s, sp[1], l), lerp(tubeBot, sp[2], l * l)]; yaw = thE + 3; }
      f.p.mesh.position.set(pos[0], pos[2], -pos[1]); f.p.mesh.rotation.set(0, yaw, 0); f.p.mesh.visible = true;
    }
    function cum(ph, q) { var i = ORDER.indexOf(ph); if (i < 0) return 0; var c = 0; for (var j = 0; j < i; j++) c += DURS[j]; return c + q * DURS[i]; }
    var CUM_END = DURS.slice(0, 8).reduce(function (a, b) { return a + b; }, 0);

    function ringOf(s) { return s && s.selected ? COLORS.indexOf(s.selected) : -1; }
    function startDispense(s, k) {
      var r = rings[k], n = s.cartridges[s.selected].count;
      if (!r.canon || r.pills.length !== n) { rebuild(r, n); r.sess = false; }
      rec = { k: k, sawDrum: false, z0: arm.zc, K0: r.K, A0: r.A, fall: null, adv: 0 };
    }
    function finishDispense() {
      if (!rec) return;
      var r = rings[rec.k];
      if (rec.fall) { landPill(rec.fall.p); rec.fall = null; }
      if (rec.adv >= 0.999) { r.K = rec.K0 + 1; r.A = r.K * P; } else { r.A = rec.A0 + rec.adv * P; }
      arm.theta = PARK; arm.zc = ZTAB(rec.k); arm.ext = 0; rec = null;
    }
    function dispenseDrive(s) {
      var k = ringOf(s); if (k < 0) return;
      if (!rec) startDispense(s, k);
      var r = rings[rec.k], ph = s.phase, q = s.phaseProgress || 0, e = ease(q), thF = thetaFwd(rec.k), zc = ZTAB(rec.k), th = PARK, ext = 0, adv = 0;
      arm.k = rec.k;
      if (ph === 'DRUM_ROTATE') { rec.sawDrum = true; zc = lerp(rec.z0, zc, e); }
      else if (ph === 'CARRIAGE_APPROACH') { zc = rec.sawDrum ? zc : lerp(rec.z0, zc, e); th = lerp(PARK, thF, e); }
      else if (ph === 'PIN_ENGAGE') { th = thF; ext = e; }
      else if (ph === 'BLADE_PULL_RELEASE') { th = thF + e * P; ext = 1; adv = e; }
      else if (ph === 'STACK_SETTLE') { th = thF + P; ext = 1; adv = 1; }
      else if (ph === 'BLADE_ISOLATE_CLOSE') { th = thF + P; ext = 1 - e; adv = 1; }
      else if (ph === 'BLADE_CLOSED_DWELL') { th = thF + P; adv = 1; }
      else if (ph === 'PIN_LIFT') { th = lerp(thF + P, PARK, e); adv = 1; }
      else if (ORDER.indexOf(ph) >= 0) adv = 1;
      arm.theta = th; arm.zc = zc; arm.ext = ext; rec.adv = Math.max(rec.adv, adv);
      var A = (rec.K0 + adv) * P, dA = A - r.A;
      if (Math.abs(dA) > 1e-9) movePills(r, dA);
      if (!rec.fall) { var c = crossed(r); if (c) { r.pills.splice(r.pills.indexOf(c), 1); var phi = pocketCenter(r, c.m) + c.off; rec.fall = { p: c, r0: RR[r.k], a0: phi, yaw0: phi + Math.PI / 2, tau0: cum(ph, q) }; } }
      if (rec.fall) { var tau = Math.max(0, Math.min(1, (cum(ph, q) - rec.fall.tau0) / (CUM_END - rec.fall.tau0))); if (ph === 'TONGUE_RETURN') tau = 1; fallPose(rec.fall, tau); if (tau >= 1 && ph === 'TONGUE_RETURN') { landPill(rec.fall.p); rec.fall = null; } }
    }

    // ---------- timed tasks (refill) ----------
    function enqueue(t) { tasks.push(t); }
    function armTo(theta, k, dur, ext) {
      var f;
      enqueue({ dur: dur, start: function () { f = { th: arm.theta, z: arm.zc, e: arm.ext }; arm.k = k; }, run: function (q) { var e = ease(q); arm.theta = lerp(f.th, theta, e); arm.zc = lerp(f.z, ZTAB(k), e); if (ext !== undefined) arm.ext = lerp(f.e, ext, e); } });
    }
    function extTo(v, dur) { var f; enqueue({ dur: dur, start: function () { f = arm.ext; }, run: function (q) { arm.ext = lerp(f, v, ease(q)); } }); }
    function stroke(k, dir) {
      var r = rings[k], th0 = dir > 0 ? thetaFwd(k) : thetaRev(k);
      armTo(th0, k, 0.55, 0); extTo(1, 0.22);
      var A0;
      enqueue({ dur: 0.75, start: function () { A0 = r.A; }, run: function (q) { var e = ease(q); arm.theta = th0 + dir * e * P; movePills(r, A0 + dir * e * P - r.A); }, end: function () { r.K += dir; r.A = r.K * P; } });
      extTo(0, 0.22);
    }
    // a bottle comes down over the marked pocket from above, tips, one pill drops, the bottle lifts away
    function loadDrop(k) {
      var r = rings[k], p = null, ZB0 = ZL[k] + 15;
      enqueue({ dur: 2.0, start: function () { bandMat.color.setHex(ctx.accent[COLORS[k]] || 0x888888); bottle.visible = true; p = null; },
        run: function (q) {
          var phi = r.A + thE - 5.5 * P, up = q < 0.3 ? 1 - ease(q / 0.3) : q < 0.78 ? 0 : ease((q - 0.78) / 0.22);
          var tilt = q < 0.3 ? 0 : q < 0.5 ? ease((q - 0.3) / 0.2) : q < 0.78 ? 1 : 1 - ease((q - 0.78) / 0.22);
          bottle.position.set(RR[k] * Math.cos(phi), ZB0 + 28 * up, -RR[k] * Math.sin(phi)); bottle.rotation.y = phi + Math.PI / 2; bTilt.rotation.z = tilt * 0.62;
          if (!p && q >= 0.5) { p = newPill(r, 6, 0); p.off = 0; p.hold = true; p.drop = 1.7; r.loading = p; }
          if (p && q >= 0.5) { var f = Math.min(1, (q - 0.5) / 0.28); p.drop = 1.7 * (1 - f * f); }
        },
        end: function () { bottle.visible = false; if (p) { p.hold = false; p.drop = 0; } r.loading = null; pushCounts(); } });
    }
    function pushCounts() {
      var host = window.DispenserStepHost; if (!host || !host.controller) return;
      rings.forEach(function (r) { var c = host.controller.state.cartridges[COLORS[r.k]]; if (!c) return; c.count = r.pills.length; c.occupancy = r.pills.length ? 'loaded' : 'empty'; });
    }
    function runTasks(dt) {
      if (!task && tasks.length) { task = tasks.shift(); task.t = 0; if (task.start) task.start(); }
      if (!task) return;
      task.t += dt; var q = Math.min(1, task.t / task.dur); task.run(q);
      if (q >= 1) { if (task.end) task.end(); task = null; }
    }
    function busy() { return Boolean(task || tasks.length); }
    function frontU(r) { var u = N + 1; r.pills.forEach(function (p) { u = Math.min(u, uOf(r, p)); }); return u; }

    // ---------- refill API (same shape as the concentric prototype) ----------
    function idle(s) { return !s || s.operation === null; }
    function host() { return window.DispenserStepHost && window.DispenserStepHost.controller.state; }
    var refill = {
      state: function () {
        var s = host(), k = st.sel, r = k >= 0 ? rings[k] : null, free = idle(s) && !busy();
        return { lid: st.lidT > 0, ring: k, counts: rings.map(function (x) { return x.pills.length; }), busy: !free, lifted: false, lidOpen: st.lid > 0.98, lidClosed: st.lidT === 0 && st.lid < 0.02,
          canOpen: free && st.lidT === 0, canClose: free && st.lidT > 0, canSelect: free && st.lidT > 0,
          canLoad: free && st.lidT > 0 && r && r.pills.length < CAP, canIndex: free && st.lidT > 0 && r && r.sess && frontU(r) > 1, canLift: false, canFill: free && st.lidT > 0 && r && r.pills.length < CAP };
      },
      openLid: function () { if (!refill.state().canOpen) return false; st.lidT = 1; st.session = true; return true; },
      select: function (k) { if (!refill.state().canSelect || k < 0 || k >= rings.length) return false; st.sel = k; armTo(PARK, k, 0.7, 0); return true; },
      prepare: function () {
        if (!refill.state().canLoad) return false;
        var k = st.sel, r = rings[k];
        if (!r.sess) { r.sess = true; r.canon = false; var n = CAP - r.pills.length; for (var i = 0; i < n; i++) stroke(k, -1); }
        armTo(PARK, k, 0.4, 0); return true;
      },
      drop: function () { if (!refill.state().canLoad || !rings[st.sel].sess) return false; loadDrop(st.sel); return true; },
      advance: function () { if (!refill.state().canIndex) return false; var k = st.sel; stroke(k, 1); armTo(PARK, k, 0.5, 0); return true; },
      load: function () { if (!refill.state().canLoad) return false; refill.prepare(); loadDrop(st.sel); var k = st.sel; stroke(k, 1); armTo(PARK, k, 0.5, 0); return true; },
      fill: function () {
        if (!refill.state().canFill) return false;
        var k = st.sel, r = rings[k], n = CAP - r.pills.length;
        if (!r.sess) { r.sess = true; r.canon = false; for (var i = 0; i < n; i++) stroke(k, -1); }
        for (var j = 0; j < n; j++) { armTo(PARK, k, 0.4, 0); loadDrop(k); stroke(k, 1); }
        armTo(PARK, k, 0.5, 0); return true;
      },
      index: function () { return refill.advance(); },
      lift: function () { return false; },
      closeLid: function () {
        if (!refill.state().canClose) return false;
        rings.forEach(function (r) { if (!r.sess) return; var n = frontU(r) - 1; for (var i = 0; i < n; i++) stroke(r.k, 1); });
        armTo(PARK, Math.max(0, st.sel), 0.5, 0);
        enqueue({ dur: 0.01, run: function () {}, end: function () { rings.forEach(function (r) { if (r.sess) { r.sess = false; r.canon = true; } }); pushCounts(); st.lidT = 0; st.session = false; st.sel = -1; } });
        return true;
      }
    };

    // ---------- lid and per-frame update ----------
    var lidHinge = new T.Vector3(0, ZTOP, -SR);
    function applyLid() {
      st.lid += (st.lidT - st.lid) * 0.12; if (Math.abs(st.lidT - st.lid) < 0.002) st.lid = st.lidT;
      var a = -1.75 * ease(st.lid), c = Math.cos(a), s = Math.sin(a);
      lidG.rotation.x = a; lidG.position.set(0, lidHinge.y - (lidHinge.y * c - lidHinge.z * s), lidHinge.z - (lidHinge.y * s + lidHinge.z * c));
    }
    function sync(s) {
      if (st.session || busy() || rec || !s || s.operation !== null) return;
      COLORS.forEach(function (c, k) { var r = rings[k], cs = s.cartridges[c], n = cs && cs.occupancy === 'loaded' ? cs.count : 0; if (r.pills.length !== n) rebuild(r, n); });
      while (cup.length > (s.trayCount || 0)) killPill(cup.pop());
    }
    function update(s, now) {
      if (!st.active) return;
      var t = now || Date.now(), dt = last ? Math.min(0.1, (t - last) / 1000) : 0.016; last = t;
      if (s && s.operation === 'dispense') dispenseDrive(s);
      else { if (rec) finishDispense(); runTasks(dt); }
      sync(s); applyArm(); applyRings(s && s.operation === 'dispense' ? s.selected : null); applyLid();
      var sel = st.sel >= 0 ? rings[st.sel] : null;
      marker.visible = Boolean(sel && st.lidT > 0);
      if (marker.visible) { var phi = sel.A + thE - 5.5 * P; marker.position.set(RR[sel.k] * Math.cos(phi), ZL[sel.k] + 0.4, -RR[sel.k] * Math.sin(phi)); }
    }

    // Mass and tip-over estimate (ASSUMED densities and bought-part masses).
    function stability() {
      var RHO = 0.6, items = [], c = Math.cos(arm.theta), s = Math.sin(arm.theta);
      function add(m, x, y, z, rot) { items.push({ m: m, x: x, y: y, z: z, rot: Boolean(rot) }); }
      function cyl(r, z0, z1, rho) { return Math.PI * r * r * (z1 - z0) / 1000 * rho; }
      add(2 * Math.PI * SR * 1.5 * (ZTOP - ZT) / 1000 * 1.2, 0, 0, (ZTOP + ZT) / 2);
      add(cyl(SR, ZT, ZT + 5, RHO), 0, 0, ZT + 2.5); add(cyl(SR, ZTOP, ZTOP + 8, RHO), 0, 0, ZTOP + 4); add(cyl(6, -6, ZTOP, 2.7), 0, 0, ZTOP / 2);
      RR.forEach(function (r, k) { add(Math.PI * ((r + 5.5) * (r + 5.5) - 36) * 1.5 / 1000 * RHO, 0, 0, ZL[k] - 0.7); });
      add(30, 0, 0, -38.5); add(10, -24, 0, -45); add(8, -24, 0, -34);
      add(18, 12 * c, 12 * s, -15, true); add(5, RROD * c, RROD * s, 30, true); add(5, 18 * c, 18 * s, -8, true);
      var ballast = Math.PI * (BALLAST.r1 * BALLAST.r1 - BALLAST.r0 * BALLAST.r0) * (BALLAST.z1 - BALLAST.z0) / 1000 * 7.85; add(ballast, 0, 0, (BALLAST.z0 + BALLAST.z1) / 2);
      rings.forEach(function (r) {
        var vol = 0.8 * WH * TAU * (RR[r.k] - TB + 0.4) + 0.8 * WH * TAU * (RR[r.k] + TB - 0.4) + N * (2 * TB - 2 * RT) * WH * vaneT(r.k, st.q);
        add(vol / 1000 * 0.8 + r.pills.length * 0.25, 0, 0, ZL[r.k] + WH / 2, true);
      });
      add(cup.length * 0.25, RCH * Math.cos(thE), RCH * Math.sin(thE), -45);
      var M_ = 0, X = 0, Y = 0, Z = 0, rot = 0;
      items.forEach(function (i) { M_ += i.m; X += i.m * i.x; Y += i.m * i.y; Z += i.m * i.z; if (i.rot) rot += i.m; });
      X /= M_; Y /= M_; Z /= M_;
      var h = Z - ZT, off = Math.hypot(X, Y);
      return { mass: M_, rotating: rot, com: [X, Y, Z], comAboveTable: h, tip: Math.atan2(SR - off, h) * 180 / Math.PI, height: ZTOP + 11 - ZT, diameter: 2 * SR };
    }

    var hidden = [];
    function setActive(on) {
      on = Boolean(on); if (on === st.active) return;
      st.active = on; root.visible = on;
      if (on) {
        hidden = []; ctx.root3d.children.forEach(function (o) { if (o !== root && o.visible && !(o.userData && o.userData.keepVisible)) { hidden.push(o); o.visible = false; } });
        last = 0; applyArm(); applyRings(null);
      } else {
        hidden.forEach(function (o) { o.visible = true; }); hidden = []; st.lidT = 0; st.lid = 0; st.session = false; applyLid();
      }
      if (ctx.changed) ctx.changed();
    }
    return {
      active: function () { return st.active; }, setActive: setActive, update: update, ringAct: function () { return null; }, refill: refill, stability: stability,
      setPocket: function (q) { st.q = Math.max(0, Math.min(1, Number(q))); applyPocket(); rings.forEach(function (r) { var sl = slack(r.k); r.pills.forEach(function (p) { p.off = Math.max(-sl, Math.min(sl, p.off)); }); }); return st.q; },
      pocket: function () { return { q: st.q, widths: rings.map(function (r) { return Math.round(pocketW(r.k, st.q) * 10) / 10; }), dividers: rings.map(function (r) { return Math.round(vaneT(r.k, st.q) * 10) / 10; }), pills: PILLS.map(function (p) { return p.name + ' ' + p.L + 'x' + p.W; }) }; },
      label: function (ph) { return st.active && LABELS[ph] ? LABELS[ph] : null; },
      report: function () { return { active: st.active, pockets: N, rings: rings.map(function (r) { return { k: r.k, K: r.K, pills: r.pills.length, front: frontU(r) }; }), arm: { theta: arm.theta, zc: arm.zc, ext: arm.ext }, cup: cup.length, lid: st.lid, busy: busy() }; },
      root: root, wiring: false
    };
  }
  window.DispenserFlaskMagazine = { build: build };
}());
