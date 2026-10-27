(function () {
  'use strict';
  /* Prototype 2 (ASSUMED / NOT_VALIDATED, concept only): the concentric ring magazine inside a slim, tall flask.
     Rings sit on one deck at the TOP, under a hinged lid, so a patient opens the lid and pours straight into the marked pocket of each
     ring. Everything that moves or draws power is below the deck: stepper, arm, two servos, ESP32, driver, battery. The pin rises through
     arc slots in the deck. One exit wedge in the deck leads to ONE funnel, ONE chute down the wall and a cup in the base. The demo
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
  var PIN_R = 0.9, PIN_LEN = 11;
  var ORDER = ['PIN_ENGAGE', 'BLADE_PULL_RELEASE', 'STACK_SETTLE', 'BLADE_ISOLATE_CLOSE', 'BLADE_CLOSED_DWELL', 'PIN_LIFT', 'TONGUE_RELEASE', 'PILL_CLEAR', 'TONGUE_RETURN'];
  var DURS = [0.625, 1.01, 0.5, 1.01, 0.3, 0.625, 0.814, 0.5, 0.814];
  var LABELS = {
    DRUM_ROTATE: ['Carriage slides to the ring', 'The pin carriage slides along the arm under the deck to the selected ring (servo S1, push-pull cable).'],
    CARRIAGE_APPROACH: ['Arm swings to the pin start', 'The stepper under the deck turns the arm until the pin sits below the arc slot, behind a divider of the selected ring.'],
    PIN_ENGAGE: ['Pin rises behind a divider', 'Servo S2 pulls its cable and the pin rises through the deck slot into the pocket behind one divider.'],
    BLADE_PULL_RELEASE: ['Divider pushes the pill', 'The arm swings one pocket pitch; each divider pushes the pill in front of it along the deck.'],
    STACK_SETTLE: ['Pill drops through the exit', 'The front pill passes the edge of the single exit wedge and falls onto the funnel.'],
    BLADE_ISOLATE_CLOSE: ['Pill slides to the chute', 'The pill slides down the shared funnel while the pin lowers out of the pocket.'],
    BLADE_CLOSED_DWELL: ['Pin clear (dwell)', 'Short pause with the pin lowered below the deck.'],
    PIN_LIFT: ['Arm returns to park', 'The arm swings back to its home position under the deck.'],
    TONGUE_RELEASE: ['Pill falls down the chute', 'The pill drops down the single chute along the flask wall.'],
    PILL_CLEAR: ['Pill lands in the cup', 'The pill lands in the collection cup in the base.'],
    TONGUE_RETURN: ['Carriage parks', 'The arm and carriage are at rest; nothing else moved.']
  };

  function build(ctx) {
    var T = ctx.THREE, S = ctx.S, M = ctx.mats, COLORS = ctx.COLORS, std = ctx.std;
    var CYa = S.axle[1], N = 12, P = TAU / N, CAP = 5, WH = 7.5, RT = 0.8, VMIN = 1.4, SV = S.act.servo;
    var RR = [12.5, 20, 27.5, 35], TB = 3.5, ZT = S.table_z, ZD0 = 100, ZR = 103, ZLID = 120, SR = 45, RCH = 39.8, FOOT = 54;
    var thE = -20 * Math.PI / 180, PARK = thE + 170 * Math.PI / 180;
    var st = { active: false, q: 0.45, sel: -1, lid: 0, lidT: 0, session: false };
    var root = new T.Group(); root.name = 'slim flask'; root.position.set(0, 0, -CYa); root.visible = false; ctx.parent.add(root);
    var PR = std(0x9fc2e6, { transparent: true, opacity: 0.8, roughness: 0.45 }), SILVER = std(0xc9d1da, { metalness: 0.7, roughness: 0.3 }), WHITE = std(0xf1f3f5, { roughness: 0.4 });
    var GLASS = std(0xdfe8f0, { transparent: true, opacity: 0.14, roughness: 0.1, metalness: 0.2, side: T.DoubleSide, depthWrite: false });
    var DARKPCB = std(0x1b1f24, { roughness: 0.6 }), BLUEPCB = std(0x1b4f9c, { roughness: 0.6 });

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

    // ---------- ring geometry helpers ----------
    function pitchMm(k) { return P * RR[k]; }
    function cmaxOf(k) { return Math.max(0.6, Math.min(3.0, pitchMm(k) - VMIN - PILLS[k].L)); }
    function pocketW(k, q) { return PILLS[k].L + 0.6 + (cmaxOf(k) - 0.6) * q; }
    function vaneT(k, q) { return pitchMm(k) - pocketW(k, q); }
    function slack(k) { return Math.max(0, (pocketW(k, st.q) - PILLS[k].L) / 2) / RR[k]; }
    function arcOf(k) {
      var d = (vaneT(k, 1) / 2 + PIN_R + 0.05 + 1.2) / RR[k];
      return [thE + 3 * P + d, thE + 5 * P - d];
    }

    // ---------- housing: slim flask, white base, silver lid ----------
    var shell = new T.Mesh(new T.CylinderGeometry(SR, SR, ZLID - ZT - 5, 72, 1, true), GLASS); shell.position.y = (ZLID + ZT + 5) / 2; root.add(shell); tag(shell, 'Flask shell', 'printed', 'shell');
    // wide foot: the base flares out to FOOT so the tall flask does not tip easily
    var foot = new T.Mesh(new T.CylinderGeometry(SR + 0.4, FOOT, 5, 72), WHITE); foot.position.y = ZT + 2.5; root.add(foot); tag(foot, 'Flask base', 'printed', 'base');
    [ZT + 5, ZLID - 3].forEach(function (z) { var b = new T.Mesh(ringGeo(SR + 0.6, SR - 1.2, 3), SILVER); b.position.y = z; root.add(b); });
    var lidG = new T.Group(); root.add(lidG);
    tag(cy(lidG, 0, 0, ZLID, ZLID + 8, SR + 0.6, SILVER, 72), 'Flask lid', 'printed', 'lid'); tag(cy(lidG, 0, 0, ZLID + 8, ZLID + 11, 9, WHITE, 40), 'Flask lid', 'printed', 'lid');
    // deck: exit wedge and one pin arc slot per ring cut through it
    (function () {
      var sh = new T.Shape(); sh.absarc(0, 0, SR - 1.5, 0, TAU, false);
      var a0 = thE, a1 = thE + 34 * Math.PI / 180, w = new T.Path();
      w.moveTo(8 * Math.cos(a0), 8 * Math.sin(a0)); w.lineTo(40 * Math.cos(a0), 40 * Math.sin(a0)); w.absarc(0, 0, 40, a0, a1, false); w.lineTo(8 * Math.cos(a1), 8 * Math.sin(a1)); w.absarc(0, 0, 8, a1, a0, true); w.closePath(); sh.holes.push(w);
      RR.forEach(function (r, k) {
        var q = new T.Path(), b0 = arcOf(k)[0], b1 = arcOf(k)[1], ro = r + 1.2, ri = r - 1.2;
        q.moveTo(ro * Math.cos(b0), ro * Math.sin(b0)); q.absarc(0, 0, ro, b0, b1, false); q.lineTo(ri * Math.cos(b1), ri * Math.sin(b1)); q.absarc(0, 0, ri, b1, b0, true); q.closePath(); sh.holes.push(q);
      });
      var g = new T.ExtrudeGeometry(sh, { depth: ZR - ZD0, bevelEnabled: false, curveSegments: 72 }); g.rotateX(-Math.PI / 2);
      var deck = new T.Mesh(g, PR); deck.position.y = ZD0; root.add(deck); tag(edges(deck), 'Flask deck', 'printed', 'deck');
    }());
    tag(cy(root, 0, 0, ZR, ZR + WH, 7, SILVER, 40), 'Central post', 'bought', 'post');

    // ---------- one funnel, ONE chute down the wall, one cup in the base ----------
    var exitG = new T.Group(); exitG.rotation.y = thE; root.add(exitG);
    function zfun(x) { return (ZD0 - 1) + (88 - (ZD0 - 1)) * (x - 8) / (RCH - 3 - 8); }
    tag(profile(exitG, [[8, ZD0 - 2], [RCH - 3, 87], [RCH - 3, 88], [8, ZD0 - 1]], -13, 13, PR), 'Exit funnel', 'printed', 'funnel');
    [[-14, -13], [13, 14]].forEach(function (l) { tag(profile(exitG, [[8, ZD0 - 1], [RCH - 3, 88], [RCH - 3, ZD0], [8, ZD0]], l[0], l[1], PR), 'Exit funnel', 'printed', 'funnel'); });
    tag(cy(exitG, RCH, 0, -30, 90, 3.6, GLASS, 28, true), 'Shared chute', 'printed', 'chute');
    var CUPX = 34;
    tag(cy(exitG, CUPX, 0, -46, -28, 8.5, GLASS, 32, true), 'Collection cup', 'printed', 'cup'); tag(cy(exitG, CUPX, 0, -46, -45, 8.5, PR, 32), 'Collection cup', 'printed', 'cup');

    // ---------- rings (open on top, directly under the lid) ----------
    var rings = [], pillMats = [], rimMats = [];
    COLORS.forEach(function (color, k) {
      var r0 = RR[k] - TB, r1 = RR[k] + TB, accent = ctx.accent[color] || 0x8294a5, g = new T.Group(), rim = std(accent, { transparent: true, opacity: 0.5, roughness: 0.5, side: T.DoubleSide, depthWrite: false }), solid = std(accent, { roughness: 0.55 });
      rimMats.push(rim); g.position.y = ZR + 0.2; root.add(g);
      var parts = [new T.Mesh(ringGeo(r0 + RT, r0, WH), rim), new T.Mesh(ringGeo(r1, r1 - RT, WH), rim), new T.Mesh(ringGeo(r1, r1 - RT - 0.2, 0.9), solid)];
      parts[2].position.y = WH - 0.9; parts.forEach(function (m) { g.add(m); tag(m, 'Ring magazine', 'printed', 'ring' + k); });
      var vanes = [], width = (r1 - RT) - (r0 + RT) + 0.2;
      for (var j = 0; j < N; j++) {
        var vg = new T.Group(); vg.rotation.y = thE - j * P; g.add(vg);
        var v = new T.Mesh(new T.BoxGeometry(width, WH, 1), solid); v.position.set(RR[k], WH / 2, 0); vg.add(v); tag(v, 'Ring magazine', 'printed', 'ring' + k); vanes.push(v);
      }
      rings.push({ k: k, g: g, vanes: vanes, K: 0, A: 0, pills: [], sess: false, canon: true });
      pillMats.push({ main: std(accent, { roughness: 0.35 }), white: std(0xf4f4f0, { roughness: 0.4 }) });
    });
    function applyPocket() { rings.forEach(function (r) { var t = vaneT(r.k, st.q); r.vanes.forEach(function (v) { v.scale.z = t; }); }); }
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
      p.mesh.position.set(RR[p.k] * Math.cos(phi), ZR + p.drop * 9, -RR[p.k] * Math.sin(phi)); p.mesh.rotation.set(0, phi + Math.PI / 2, 0); p.mesh.visible = true;
    }
    function movePills(r, dA) { var sl = slack(r.k); r.A += dA; r.pills.forEach(function (p) { p.off = Math.max(-sl, Math.min(sl, p.off - dA)); }); }
    function crossed(r) {
      for (var i = 0; i < r.pills.length; i++) {
        var p = r.pills[i], phi = pocketCenter(r, p.m) + p.off;
        if (wrap(phi - thE) * RR[r.k] >= 0.6 && uOf(r, p) <= 2) return p;
      }
      return null;
    }

    // ---------- under the deck: stepper, arm with carriage and pin, two servos ----------
    var ZA0 = 96, ZA1 = 97.4, ZRET = ZD0 + 1.5, ZENG = ZR + 5;
    tag(bx(root, -21, 21, -6, 6, 74, 75.5, PR), 'Stepper mount', 'printed', 'plate');
    [-17.5, 17.5].forEach(function (x) { tag(cy(root, x, 0, 75.5, ZD0, 2, PR, 14), 'Stepper mount', 'printed', 'columns'); });
    tag(cy(root, 0, 0, 76, 95, 14, SILVER, 40), '28BYJ-48 stepper', 'bought', 'motor-body');
    tag(cy(root, 0, 0, 95, 99.5, 2.5, M.steel, 14), '28BYJ-48 stepper', 'bought', 'motor-shaft');
    var armG = new T.Group(); root.add(armG);
    tag(cy(armG, 0, 0, 94, 99, 7, PR, 32), 'Actuator arm', 'printed', 'arm');
    tag(bx(armG, 7, 10, -3, 3, ZA0, ZA1, PR), 'Actuator arm', 'printed', 'arm');
    tag(bx(armG, 7, 38.5, -3, -1.5, ZA0, ZA1, PR), 'Actuator arm', 'printed', 'arm');
    tag(bx(armG, 7, 38.5, 1.5, 3, ZA0, ZA1, PR), 'Actuator arm', 'printed', 'arm');
    function servoLabel(list, label) { list.forEach(function (m) { tag(m, label, 'bought', 'servo', 'electronic'); }); }
    servoLabel([bx(armG, 17, 40, 1.6, 13.8, ZA0 - SV.h, ZA0, M.blue, false)], 'Micro servo S1 (pin)');
    servoLabel([bx(armG, 17, 40, -13.8, -1.6, ZA0 - SV.h, ZA0, M.blue, false)], 'Micro servo S2 (tongue)');
    var carG = new T.Group(); armG.add(carG);
    tag(bx(carG, -4.5, 4.5, -4.5, 4.5, ZA1, ZD0, PR), 'Actuator arm', 'printed', 'carriage');
    var pinG = new T.Group(); carG.add(pinG);
    var pr = new T.Mesh(new T.CylinderGeometry(PIN_R, PIN_R, PIN_LEN, 14), M.dark); pr.position.y = PIN_LEN / 2; pinG.add(pr);
    var pc = new T.Mesh(new T.CylinderGeometry(0.3, PIN_R, 1.6, 14), M.dark); pc.position.y = PIN_LEN - 0.8; pinG.add(pc);
    [pr, pc].forEach(function (m) { tag(m, 'Engagement pin', 'bought', 'pin'); });
    function wire(l) { var g = new T.CylinderGeometry(0.35, 0.35, 1, 8); g.rotateZ(Math.PI / 2); var m = new T.Mesh(g, M.steel); m.position.set(0, ZA1 + 1.3, -l); armG.add(m); tag(m, 'Push-pull cable', 'bought', 'cable'); return m; }
    var wireA = wire(-3.5), wireB = wire(3.5);

    // ---------- electronics, battery and cup at the bottom ----------
    var BZ = ZT + 5;
    [[-34, -9], [-16, -9], [-34, 9], [-16, 9]].forEach(function (c) { tag(cy(root, c[0], c[1], 30, 36, 1.4, M.steel, 10), 'Base standoff', 'printed', 'standoff'); });
    tag(bx(root, -37, -12, -14, 14, 28.5, 30, PR), 'Electronics shelf', 'printed', 'shelf');
    [bx(root, -34, -15, -10, 10, 36, 37.6, DARKPCB, false), bx(root, -32, -17, -5, 5, 37.6, 41, M.steel, false)].forEach(function (m) { tag(m, 'ESP32 controller', 'bought', 'esp'); });
    [bx(root, -34, -15, -12, 12, 46, 47.6, BLUEPCB, false), bx(root, -31, -19, -6, 6, 47.6, 54, M.white, false)].forEach(function (m) { tag(m, 'ULN2003 driver board', 'bought', 'uln'); });
    [[-20, 12], [-2, 12]].forEach(function (c) { tag(cy(root, c[0], c[1], BZ, BZ + 65, 9.2, std(0x2f7fd1, { roughness: 0.4 }), 28), 'Battery 18650', 'bought', 'battery', 'electronic'); });
    tag(bx(root, -45, -41, -6, 6, BZ + 6, BZ + 14, M.dark, false), 'USB-C inlet 5 V', 'bought', 'jack', 'electronic');
    var BALLAST = { r0: 22, r1: 40, z0: ZT + 5, z1: ZT + 11 };
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
    var arm = { theta: PARK, carr: RR[0], pin: 0 }, rec = null, cup = [], tasks = [], task = null, last = 0;
    function delta(k) { return (vaneT(k, st.q) / 2 + PIN_R + 0.05) / RR[k]; }
    function norm(a) { while (a < 0) a += TAU; while (a >= TAU) a -= TAU; return a; }
    function thetaFwd(k) { return norm(thE - 8 * P - delta(k)); }
    function thetaRev(k) { return norm(thE - 8 * P + delta(k)); }
    function applyArm() {
      armG.rotation.y = arm.theta; carG.position.x = arm.carr;
      pinG.position.y = lerp(ZRET, ZENG, arm.pin) - PIN_LEN;
      var L = Math.max(1, arm.carr - 4.5 - 10.5); [wireA, wireB].forEach(function (w) { w.scale.x = L; w.position.x = 10.5 + L / 2; });
    }
    function applyRings(selColor) {
      rings.forEach(function (r) {
        r.g.rotation.y = r.A;
        var on = COLORS[r.k] === selColor || r.k === st.sel; rimMats[r.k].emissive.setHex(on ? 0x333333 : 0x000000);
        r.pills.forEach(function (p) { if (p.drop > 0 && !p.hold) p.drop = Math.max(0, p.drop - 0.06); placePill(p, r); });
      });
    }
    function cupSpot(n) { var dx = ((n % 3) - 1) * 3, dy = (Math.floor(n / 3) % 2 - 0.5) * 3.5, c = Math.cos(thE), s = Math.sin(thE); return [(CUPX + dx) * c - dy * s, (CUPX + dx) * s + dy * c, -45 + Math.floor(n / 6) * 3]; }
    function landPill(p) { var sp = cupSpot(cup.length); p.mesh.position.set(sp[0], sp[2], -sp[1]); p.mesh.rotation.set(0, 0.6 * cup.length, 0); cup.push(p); }
    function fallPose(f, tau) {
      var k = f.p.k, c = Math.cos(thE), s = Math.sin(thE), sp = cupSpot(cup.length), pos, yaw, xe = RCH - 3;
      if (tau < 0.07) { var u = ease(tau / 0.07); pos = [f.r0 * Math.cos(f.a0), f.r0 * Math.sin(f.a0), lerp(ZR, zfun(f.r0) + 0.1, u)]; yaw = f.yaw0; }
      else if (tau < 0.35) { var d = ease((tau - 0.07) / 0.28), x = lerp(f.r0, xe, d), a = lerp(f.a0, thE, d); pos = [x * Math.cos(a), x * Math.sin(a), zfun(x) + 0.1]; yaw = lerp(f.yaw0, thE, d); }
      else if (tau < 0.9) { var e = (tau - 0.35) / 0.55, x2 = lerp(xe, RCH, Math.min(1, e * 4)); pos = [x2 * c, x2 * s, lerp(88, -38, e * e)]; yaw = thE + e * 4; }
      else { var l = (tau - 0.9) / 0.1; pos = [lerp(RCH * c, sp[0], l), lerp(RCH * s, sp[1], l), lerp(-38, sp[2], l)]; yaw = thE + 4; }
      f.p.mesh.position.set(pos[0], pos[2], -pos[1]); f.p.mesh.rotation.set(0, yaw, 0); f.p.mesh.visible = true;
    }
    function cum(ph, q) { var i = ORDER.indexOf(ph); if (i < 0) return 0; var c = 0; for (var j = 0; j < i; j++) c += DURS[j]; return c + q * DURS[i]; }
    var CUM_END = DURS.slice(0, 8).reduce(function (a, b) { return a + b; }, 0);

    function ringOf(s) { return s && s.selected ? COLORS.indexOf(s.selected) : -1; }
    function startDispense(s, k) {
      var r = rings[k], n = s.cartridges[s.selected].count;
      if (!r.canon || r.pills.length !== n) { rebuild(r, n); r.sess = false; }
      rec = { k: k, sawDrum: false, c0: arm.carr, K0: r.K, A0: r.A, fall: null, adv: 0 };
    }
    function finishDispense() {
      if (!rec) return;
      var r = rings[rec.k];
      if (rec.fall) { landPill(rec.fall.p); rec.fall = null; }
      if (rec.adv >= 0.999) { r.K = rec.K0 + 1; r.A = r.K * P; } else { r.A = rec.A0 + rec.adv * P; }
      arm.theta = PARK; arm.carr = RR[rec.k]; arm.pin = 0; rec = null;
    }
    function dispenseDrive(s) {
      var k = ringOf(s); if (k < 0) return;
      if (!rec) startDispense(s, k);
      var r = rings[rec.k], ph = s.phase, q = s.phaseProgress || 0, e = ease(q), thF = thetaFwd(rec.k), carr = RR[rec.k], th = PARK, pin = 0, adv = 0;
      if (ph === 'DRUM_ROTATE') { rec.sawDrum = true; carr = lerp(rec.c0, carr, e); }
      else if (ph === 'CARRIAGE_APPROACH') { carr = rec.sawDrum ? carr : lerp(rec.c0, carr, e); th = lerp(PARK, thF, e); }
      else if (ph === 'PIN_ENGAGE') { th = thF; pin = e; }
      else if (ph === 'BLADE_PULL_RELEASE') { th = thF + e * P; pin = 1; adv = e; }
      else if (ph === 'STACK_SETTLE') { th = thF + P; pin = 1; adv = 1; }
      else if (ph === 'BLADE_ISOLATE_CLOSE') { th = thF + P; pin = 1 - e; adv = 1; }
      else if (ph === 'BLADE_CLOSED_DWELL') { th = thF + P; adv = 1; }
      else if (ph === 'PIN_LIFT') { th = lerp(thF + P, PARK, e); adv = 1; }
      else if (ORDER.indexOf(ph) >= 0) adv = 1;
      arm.theta = th; arm.carr = carr; arm.pin = pin; rec.adv = Math.max(rec.adv, adv);
      var A = (rec.K0 + adv) * P, dA = A - r.A;
      if (Math.abs(dA) > 1e-9) movePills(r, dA);
      if (!rec.fall) { var c = crossed(r); if (c) { r.pills.splice(r.pills.indexOf(c), 1); var phi = pocketCenter(r, c.m) + c.off; rec.fall = { p: c, r0: RR[r.k], a0: phi, yaw0: phi + Math.PI / 2, tau0: cum(ph, q) }; } }
      if (rec.fall) { var tau = Math.max(0, Math.min(1, (cum(ph, q) - rec.fall.tau0) / (CUM_END - rec.fall.tau0))); if (ph === 'TONGUE_RETURN') tau = 1; fallPose(rec.fall, tau); if (tau >= 1 && ph === 'TONGUE_RETURN') { landPill(rec.fall.p); rec.fall = null; } }
    }

    // ---------- timed tasks (refill) ----------
    function enqueue(t) { tasks.push(t); }
    function armTo(theta, k, dur, pin) {
      var f;
      enqueue({ dur: dur, start: function () { f = { th: arm.theta, c: arm.carr, p: arm.pin }; }, run: function (q) { var e = ease(q); arm.theta = lerp(f.th, theta, e); arm.carr = lerp(f.c, RR[k], e); if (pin !== undefined) arm.pin = lerp(f.p, pin, e); } });
    }
    function pinTo(v, dur) { var f; enqueue({ dur: dur, start: function () { f = arm.pin; }, run: function (q) { arm.pin = lerp(f, v, ease(q)); } }); }
    function stroke(k, dir) {
      var r = rings[k], th0 = dir > 0 ? thetaFwd(k) : thetaRev(k);
      armTo(th0, k, 0.55, 0); pinTo(1, 0.22);
      var A0;
      enqueue({ dur: 0.75, start: function () { A0 = r.A; }, run: function (q) { var e = ease(q); arm.theta = th0 + dir * e * P; movePills(r, A0 + dir * e * P - r.A); }, end: function () { r.K += dir; r.A = r.K * P; } });
      pinTo(0, 0.22);
    }
    // a bottle comes down over the marked pocket, tips, one pill drops, the bottle lifts away
    function loadDrop(k) {
      var r = rings[k], p = null, ZB0 = ZR + 15;
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

    // ---------- refill API ----------
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
      select: function (k) { if (!refill.state().canSelect || k < 0 || k >= rings.length) return false; st.sel = k; armTo(PARK, k, 0.6, 0); return true; },
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
    var lidHinge = new T.Vector3(0, ZLID, -SR);
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
      if (marker.visible) { var phi = sel.A + thE - 5.5 * P; marker.position.set(RR[sel.k] * Math.cos(phi), ZR + 0.4, -RR[sel.k] * Math.sin(phi)); }
    }

    // Mass and tip-over estimate (ASSUMED densities and bought-part masses).
    function stability() {
      var RHO = 0.6, items = [], c = Math.cos(arm.theta), s = Math.sin(arm.theta);
      function add(m, x, y, z, rot) { items.push({ m: m, x: x, y: y, z: z, rot: Boolean(rot) }); }
      function cyl(r, z0, z1, rho) { return Math.PI * r * r * (z1 - z0) / 1000 * rho; }
      add(2 * Math.PI * SR * 1.5 * (ZLID - ZT) / 1000 * 1.2, 0, 0, (ZLID + ZT) / 2);
      add(cyl(SR, ZT, ZT + 5, RHO), 0, 0, ZT + 2.5); add(cyl(SR, ZLID, ZLID + 8, RHO), 0, 0, ZLID + 4); add(cyl(SR - 1.5, ZD0, ZR, RHO), 0, 0, (ZD0 + ZR) / 2);
      add(30, 0, 0, 85.5); add(12, 0, 0, 74.7); add(10, -24, 0, 38); add(8, -24, 0, 50);
      add(94, -11, 12, BZ + 32.5); add(10, 0, 0, ZT + 20);
      add(18, 28 * c, 28 * s, 85, true); add(5, 22 * c, 22 * s, 96.7, true);
      var ballast = Math.PI * (BALLAST.r1 * BALLAST.r1 - BALLAST.r0 * BALLAST.r0) * (BALLAST.z1 - BALLAST.z0) / 1000 * 7.85; add(ballast, 0, 0, (BALLAST.z0 + BALLAST.z1) / 2);
      rings.forEach(function (r) {
        var vol = 0.8 * WH * TAU * (RR[r.k] - TB + 0.4) + 0.8 * WH * TAU * (RR[r.k] + TB - 0.4) + N * (2 * TB - 2 * RT) * WH * vaneT(r.k, st.q);
        add(vol / 1000 * 0.8 + r.pills.length * 0.25, 0, 0, ZR + WH / 2, true);
      });
      add(cup.length * 0.25, CUPX * Math.cos(thE), CUPX * Math.sin(thE), -44);
      var M_ = 0, X = 0, Y = 0, Z = 0, rot = 0;
      items.forEach(function (i) { M_ += i.m; X += i.m * i.x; Y += i.m * i.y; Z += i.m * i.z; if (i.rot) rot += i.m; });
      X /= M_; Y /= M_; Z /= M_;
      var h = Z - ZT, off = Math.hypot(X, Y);
      return { mass: M_, rotating: rot, com: [X, Y, Z], comAboveTable: h, tip: Math.atan2(FOOT - off, h) * 180 / Math.PI, height: ZLID + 11 - ZT, diameter: 2 * SR };
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
      report: function () { return { active: st.active, pockets: N, rings: rings.map(function (r) { return { k: r.k, K: r.K, pills: r.pills.length, front: frontU(r) }; }), arm: { theta: arm.theta, carr: arm.carr, pin: arm.pin }, cup: cup.length, lid: st.lid, busy: busy() }; },
      root: root, wiring: false
    };
  }
  window.DispenserFlaskMagazine = { build: build };
}());
