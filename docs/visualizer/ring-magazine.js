(function () {
  'use strict';
  /* Ring magazine: an alternative internal mechanism for the same housing (ASSUMED / NOT_VALIDATED, concept only).
     Four concentric ring cartridges lie on the fixed deck. Each ring is a wheel of radial dividers; a pill sits in the pocket
     between two dividers and is pushed along the deck by the divider behind it. One movable actuator arm (rack-driven pin
     carriage) selects a ring, drops its pin behind one divider and swings one pocket pitch. All four rings share ONE exit slot
     in the deck, ONE funnel and ONE cup. Geometry numbers come from rotation-spec.js (g.ring); the demo controller is untouched
     and only drives the phase names this file maps to motion. */
  var TAU = Math.PI * 2;
  function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  function ease(q) { q = Math.max(0, Math.min(1, q)); return q * q * (3 - 2 * q); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // pill models, one per ring: small round, large round, oval, capsule (L along the track, W across it, H tall; mm)
  var PILLS = [
    { kind: 'round', name: 'small round', L: 4.2, W: 4.2, H: 2.0 },
    { kind: 'round', name: 'large round', L: 6.0, W: 6.0, H: 2.8 },
    { kind: 'oval', name: 'oval', L: 9.5, W: 6.2, H: 3.4 },
    { kind: 'capsule', name: 'capsule', L: 12.0, W: 5.0, H: 5.0 }
  ];
  var PIN_R = 0.9, PIN_UP = 12.3, PIN_DOWN = 4.6, COLLAR = 10.7;
  var ORDER = ['PIN_ENGAGE', 'BLADE_PULL_RELEASE', 'STACK_SETTLE', 'BLADE_ISOLATE_CLOSE', 'BLADE_CLOSED_DWELL', 'PIN_LIFT', 'TONGUE_RELEASE', 'PILL_CLEAR', 'TONGUE_RETURN'];
  var DURS = [0.625, 1.01, 0.5, 1.01, 0.3, 0.625, 0.814, 0.5, 0.814];
  var LABELS = {
    DRUM_ROTATE: ['Carriage slides to the selected ring', 'The pin carriage slides along the actuator arm to the selected ring (rack and pinion).'],
    CARRIAGE_APPROACH: ['Arm swings to the pin start', 'The stepper turns the actuator arm until the pin sits behind a divider of the selected ring.'],
    PIN_ENGAGE: ['Pin drops behind a divider', 'The pin lowers into the pocket behind one divider of the selected ring.'],
    BLADE_PULL_RELEASE: ['Divider pushes the pill', 'The arm swings one pocket pitch; each divider pushes the pill in front of it along the deck.'],
    STACK_SETTLE: ['Pill drops through the exit', 'The front pill passes the leading edge of the single exit slot and falls into the funnel.'],
    BLADE_ISOLATE_CLOSE: ['Pill slides down the funnel', 'The pill slides down the shared funnel while the pin lifts out.'],
    BLADE_CLOSED_DWELL: ['Pin clear (dwell)', 'Short pause with the pin clear of the ring.'],
    PIN_LIFT: ['Arm returns to park', 'The arm swings back to its home position.'],
    TONGUE_RELEASE: ['Pill leaves the housing', 'The pill slides out of the wall window.'],
    PILL_CLEAR: ['Pill drops into the cup', 'The pill drops from the funnel lip into the collection cup.'],
    TONGUE_RETURN: ['Carriage parks', 'Single movable actuator at rest; nothing else moved.']
  };

  function build(ctx) {
    var T = ctx.THREE, S = ctx.S, R = S.ring, M = ctx.mats, COLORS = ctx.COLORS, std = ctx.std;
    var CYa = S.axle[1], N = R.n, P = TAU / N, ZF = R.floor_z, WH = R.wheel_h, RT = R.rim_t, VMIN = R.vane_t, CAP = R.cap;
    var VL = R.slot.v[0], VT_ = R.slot.v[1], FUN = R.funnel, SV = S.act.servo, PARK = R.park_deg * Math.PI / 180;
    var rc = R.tracks.map(function (t) { return (t[0] + t[1]) / 2; });
    var thL = rc.map(function (r) { return Math.asin(VL / r); });
    var CUPV = (VL + VT_) / 2, LIP_X = 54, CUP = { x0: 52.5, x1: 66, floor: -30 };
    var st = { active: false, q: 0.45, sel: -1, lid: 0, lidT: 0, session: false, armLift: 0 };
    var root = new T.Group(); root.name = 'ring magazine'; root.position.set(0, 0, -CYa); root.visible = false; ctx.parent.add(root);
    var PR = std(0x9fc2e6, { transparent: true, opacity: 0.8, roughness: 0.45 });

    function tag(o, label, kind, piece, type) { ctx.rtag(o, label, kind, piece); o.userData.ring = true; if (type) ctx.ptype(o, type); return o; }
    function edges(m) { m.add(new T.LineSegments(new T.EdgesGeometry(m.geometry, 30), ctx.EL)); return m; }
    function bx(par, x0, x1, l0, l1, z0, z1, mat, edge) {
      var m = new T.Mesh(new T.BoxGeometry(x1 - x0, z1 - z0, l1 - l0), mat); m.position.set((x0 + x1) / 2, (z0 + z1) / 2, -(l0 + l1) / 2); par.add(m);
      return edge === false ? m : edges(m);
    }
    function cy(par, x, l, z0, z1, r, mat, seg) { var m = new T.Mesh(new T.CylinderGeometry(r, r, z1 - z0, seg || 20), mat); m.position.set(x, (z0 + z1) / 2, -l); par.add(m); return m; }
    function ringGeo(rOut, rIn, h) {
      var s = new T.Shape(), p = new T.Path(); s.absarc(0, 0, rOut, 0, TAU, false); p.absarc(0, 0, rIn, 0, TAU, true); s.holes.push(p);
      var g = new T.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 72 }); g.rotateX(-Math.PI / 2); return g;
    }
    // shape in (x, z) extruded across lateral l0..l1
    function profile(par, pts, l0, l1, mat) {
      var s = new T.Shape(); pts.forEach(function (p, i) { if (i) s.lineTo(p[0], p[1]); else s.moveTo(p[0], p[1]); }); s.closePath();
      var m = new T.Mesh(new T.ExtrudeGeometry(s, { depth: l1 - l0, bevelEnabled: false }), mat); m.position.z = -l1; par.add(m); return edges(m);
    }

    // ---------- fixed parts: centre post, exit funnel, wall shelf and cup ----------
    var fixedG = new T.Group(); root.add(fixedG);
    var post = new T.Mesh(ringGeo(R.tracks[0][0] - 0.8, 2.8, WH), PR); post.position.y = ZF; fixedG.add(post); tag(edges(post), 'Ring magazine', 'printed', 'post');
    var zf = function (x) { return FUN.z0 + (FUN.z1 - FUN.z0) * (x - FUN.x0) / (FUN.x1 - FUN.x0); };
    var FT = FUN.t, WALL_X1 = 47.5, DECK_UND = -3.0;
    tag(profile(fixedG, [[FUN.x0, zf(FUN.x0) - FT], [LIP_X, zf(LIP_X) - FT], [LIP_X, zf(LIP_X)], [FUN.x0, zf(FUN.x0)]], VL - FT, VT_ + FT, PR), 'Exit funnel', 'printed', 'funnel');
    [[VL - FT, VL], [VT_, VT_ + FT]].forEach(function (w) {
      tag(profile(fixedG, [[FUN.x0, zf(FUN.x0)], [WALL_X1, zf(WALL_X1)], [WALL_X1, DECK_UND], [FUN.x0, DECK_UND]], w[0], w[1], PR), 'Exit funnel', 'printed', 'funnel');
    });
    tag(bx(fixedG, 50, 68, VL - 2, VT_ + 2, -32, -31, PR), 'Collection cup', 'printed', 'shelf');
    [[50, 56, VL - 2, VL - 0.6], [50, 56, VT_ + 0.6, VT_ + 2]].forEach(function (b) { tag(bx(fixedG, b[0], b[1], b[2], b[3], -37, -32, PR), 'Collection cup', 'printed', 'shelf'); });
    var cupG = new T.Group(); fixedG.add(cupG);
    tag(bx(cupG, CUP.x0, CUP.x1, VL - 0.6, VT_ + 0.6, -31, CUP.floor, PR), 'Collection cup', 'printed', 'cup');
    [[CUP.x0, CUP.x1, VL - 0.6, VL + 0.4], [CUP.x0, CUP.x1, VT_ - 0.4, VT_ + 0.6], [CUP.x1 - 1, CUP.x1, VL, VT_], [CUP.x0, CUP.x0 + 1, VL, VT_]].forEach(function (b) {
      tag(bx(cupG, b[0], b[1], b[2], b[3], CUP.floor, -23.5, PR), 'Collection cup', 'printed', 'cup');
    });

    // ---------- ring wheels ----------
    var rings = [], pillMats = [], rimMats = [];
    function pocketW(k, q) { var pitch = P * rc[k], cmax = Math.max(0.6, Math.min(3.0, pitch - VMIN - PILLS[k].L)); return PILLS[k].L + 0.6 + (cmax - 0.6) * q; }
    function vaneT(k, q) { return P * rc[k] - pocketW(k, q); }
    COLORS.forEach(function (color, k) {
      var tr = R.tracks[k], accent = ctx.accent[color] || 0x8294a5, g = new T.Group(), rim = std(accent, { transparent: true, opacity: 0.5, roughness: 0.5, side: T.DoubleSide, depthWrite: false }), solid = std(accent, { roughness: 0.55 });
      rimMats.push(rim); g.position.y = ZF + 0.2; root.add(g);
      var mi = new T.Mesh(ringGeo(tr[0] + RT, tr[0], WH), rim), mo = new T.Mesh(ringGeo(tr[1], tr[1] - RT, WH), rim), band = new T.Mesh(ringGeo(tr[1], tr[1] - RT - 0.2, 0.9), solid);
      band.position.y = WH - 0.9; [mi, mo, band].forEach(function (m) { g.add(m); tag(m, 'Ring magazine', 'printed', 'ring' + k); });
      var vanes = [], width = (tr[1] - RT) - (tr[0] + RT) + 0.2;
      for (var j = 0; j < N; j++) {
        var vg = new T.Group(); vg.rotation.y = thL[k] - j * P; g.add(vg);
        var v = new T.Mesh(new T.BoxGeometry(width, WH, 1), solid); v.position.set(rc[k], WH / 2, 0); vg.add(v); tag(v, 'Ring magazine', 'printed', 'ring' + k); vanes.push(v);
      }
      // finger lug on the outer rim: lift the whole magazine out by hand
      var lg = new T.Group(); lg.rotation.y = Math.PI * 0.5; g.add(lg); var lug = new T.Mesh(new T.BoxGeometry(3, 3.2, 5), solid); lug.position.set(tr[1] + 0.4, WH + 0.6, 0); lg.add(lug); tag(lug, 'Ring magazine', 'printed', 'ring' + k);
      rings.push({ k: k, g: g, vanes: vanes, K: 0, A: 0, pills: [], lift: 0, liftT: 0, sess: false, canon: true });
      var c = accent;
      pillMats.push({ main: std(c, { roughness: 0.35 }), white: std(0xf4f4f0, { roughness: 0.4 }) });
    });
    function applyPocket() { rings.forEach(function (r) { var t = vaneT(r.k, st.q); r.vanes.forEach(function (v) { v.scale.z = t; }); }); }
    applyPocket();
    function slack(k) { return Math.max(0, (pocketW(k, st.q) - PILLS[k].L) / 2) / rc[k]; }

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
    function newPill(r, u, drop) { var p = { k: r.k, m: mOfU(r, u), off: 0, mesh: pillObject(r.k), drop: drop || 0, yaw: 0 }; r.pills.push(p); return p; }
    function killPill(p) { if (p.mesh.parent) p.mesh.parent.remove(p.mesh); }
    function rebuild(r, n) { r.pills.forEach(killPill); r.pills = []; for (var u = 1; u <= n; u++) newPill(r, u, 0.6 + 0.12 * u); r.canon = true; }
    function pocketCenter(r, m) { return r.A + thL[r.k] - (m + 0.5) * P; }
    function placePill(p, r, pos) {
      var phi = pocketCenter(r, p.m) + p.off, d = PILLS[p.k], lift = r.lift * 30;
      p.mesh.position.set(rc[p.k] * Math.cos(phi), ZF + p.drop * 9 + lift, -rc[p.k] * Math.sin(phi)); p.mesh.rotation.set(0, phi + Math.PI / 2, 0); p.mesh.visible = true;
    }
    function movePills(r, dA) {
      var sl = slack(r.k); r.A += dA;
      r.pills.forEach(function (p) { p.off = Math.max(-sl, Math.min(sl, p.off - dA)); });
    }
    // after the ring angle changes by dA, a pill that crossed the leading edge of the exit slot leaves the ring
    function crossed(r) {
      for (var i = 0; i < r.pills.length; i++) {
        var p = r.pills[i], phi = pocketCenter(r, p.m) + p.off;
        if (wrap(phi - thL[r.k]) * rc[r.k] >= 0.6 && uOf(r, p) <= 2) return p;
      }
      return null;
    }

    // ---------- the actuator: one arm on the stepper rod, rack-driven pin carriage ----------
    var armG = new T.Group(); root.add(armG);
    var ZA = R.arm_z, ZA0 = ZA[0], ZA1 = ZA[1], TAILX = -46;
    tag(bx(armG, TAILX, -9, -4, 23, ZA0, ZA1, PR), 'Actuator arm', 'printed', 'arm');
    tag(bx(armG, -9, 9, -4, 10, ZA0, ZA1, PR), 'Actuator arm', 'printed', 'arm');
    tag(bx(armG, 9, 45.5, -4, -2.2, ZA0, ZA1, PR), 'Actuator arm', 'printed', 'arm');
    tag(bx(armG, 9, 45.5, 2.2, 10, ZA0, ZA1, PR), 'Actuator arm', 'printed', 'arm');
    var hubC = tag(cy(armG, 0, 0, 11.8, 17.5, 5.5, PR, 32), 'Actuator arm', 'printed', 'arm');
    tag(cy(armG, 0, 0, 14.2, 16.4, 1.2, M.steel, 12), 'Actuator arm', 'printed', 'arm');
    // S1 (carriage drive): hangs from a bracket on the tail, shaft down to a pinion beside the rack
    var S1X = -18, S1L = 15.5, S1Z0 = 17.7;
    [[-37, 9], [-11, 9], [-37, 22], [-11, 22]].forEach(function (c) { tag(bx(armG, c[0] - 1.5, c[0] + 1.5, c[1] - 1.5, c[1] + 1.5, ZA1, S1Z0 - 1, PR), 'Actuator arm', 'printed', 'arm'); });
    tag(bx(armG, -38, -10, 8, 23, S1Z0 - 1, S1Z0, PR), 'Actuator arm', 'printed', 'arm');
    var s1G = new T.Group(); s1G.position.set(S1X, 0, -S1L); armG.add(s1G);
    function servoTag(list, label) { list.forEach(function (m) { tag(m, label, 'bought', 'servo', 'electronic'); }); }
    // S1: shaft down, body standing on its ears; local frame = shaft at the origin, body toward -x
    servoTag([bx(s1G, -(SV.len - SV.shaft_off), SV.shaft_off, -SV.w / 2, SV.w / 2, S1Z0, S1Z0 + SV.h, M.blue, false),
      bx(s1G, -(SV.len - SV.shaft_off) - SV.ear, SV.shaft_off + SV.ear, -SV.w / 2, SV.w / 2, S1Z0, S1Z0 + 1.5, M.blue, false)], 'Micro servo S1 (pin)');
    tag(cy(s1G, 0, 0, 16.2, S1Z0, 1.2, M.steel, 12), 'Micro servo S1 (pin)', 'bought', 'servo', 'electronic');
    var pinion = new T.Group(); pinion.position.set(S1X, 0, -S1L); armG.add(pinion);
    tag(cy(pinion, 0, 0, 14.2, 16.2, 6, M.white, 28), 'Actuator arm', 'printed', 'arm');
    for (var ti = 0; ti < 12; ti++) { var tg = new T.Group(); tg.rotation.y = ti * TAU / 12; pinion.add(tg); var th = new T.Mesh(new T.BoxGeometry(1.4, 2, 1.4), M.white); th.position.set(6.4, 15.2, 0); tg.add(th); tag(th, 'Actuator arm', 'printed', 'arm'); }
    // carriage: slides along the arm (rack bar behind it), carries the pin and S2 (pin lift)
    var carG = new T.Group(); armG.add(carG);
    tag(bx(carG, -30, 3, -5.5, 9.5, ZA1, 15.2, PR), 'Actuator arm', 'printed', 'carriage');
    tag(bx(carG, -62, -30, 4, 9.5, ZA1, 16.7, PR), 'Actuator arm', 'printed', 'carriage');
    for (var ri = 0; ri < 20; ri++) tag(bx(carG, -61 + ri * 1.5, -60.2 + ri * 1.5, 9.5, 10.3, 14.2, 16.2, M.white, false), 'Actuator arm', 'printed', 'carriage');
    var S2X = -12, S2Z = 22, S2L0 = -22.5, S2L1 = -0.5;
    var s2G = new T.Group(); carG.add(s2G);
    // S2: lies on its side on the carriage, shaft across the arm; its horn is a lever that lifts the pin
    servoTag([bx(s2G, S2X - (SV.len - SV.shaft_off), S2X + SV.shaft_off, S2L0, S2L1, S2Z - SV.w / 2, S2Z + SV.w / 2, M.blue, false),
      bx(s2G, S2X - (SV.len - SV.shaft_off) - SV.ear, S2X + SV.shaft_off + SV.ear, S2L0 + 9, S2L0 + 10.5, S2Z - SV.w / 2, S2Z + SV.w / 2, M.blue, false)], 'Micro servo S2 (tongue)');
    var horn = new T.Group(); horn.position.set(S2X, S2Z, 0); carG.add(horn);
    var hornBar = new T.Mesh(new T.BoxGeometry(12, 1.6, 1.6), M.white); hornBar.position.set(6, 0, 0); horn.add(hornBar); tag(hornBar, 'Actuator arm', 'printed', 'horn');
    var boss = new T.Mesh(new T.CylinderGeometry(2.8, 2.8, 1.8, 16), M.white); boss.rotation.x = Math.PI / 2; horn.add(boss); tag(boss, 'Actuator arm', 'printed', 'horn');
    var pinG = new T.Group(); carG.add(pinG);
    var pc = new T.Mesh(new T.CylinderGeometry(0.3, PIN_R, 1.6, 14), M.dark); pc.position.y = 0.8; pinG.add(pc);
    var pr = new T.Mesh(new T.CylinderGeometry(PIN_R, PIN_R, 14, 14), M.dark); pr.position.y = 8.6; pinG.add(pr);
    var col = new T.Mesh(new T.CylinderGeometry(1.9, 1.9, 1.2, 18), M.steel); col.position.y = COLLAR + 0.6; pinG.add(col);
    [pc, pr, col].forEach(function (m) { tag(m, 'Engagement pin', 'bought', 'pin'); });

    // loading-window marker (amber) shown while refilling
    var marker = new T.Mesh(new T.RingGeometry(2.6, 3.6, 28), new T.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.9, depthTest: false, side: T.DoubleSide }));
    marker.rotation.x = -Math.PI / 2; marker.renderOrder = 30; marker.visible = false; root.add(marker);

    // ---------- state shared by the dispense mapping and the refill tasks ----------
    var arm = { theta: PARK, carr: rc[0], pin: 0 }, rec = null, cup = [], tasks = [], task = null, last = 0;
    function delta(k) { return vaneT(k, st.q) / 2 + PIN_R + 0.05; }
    function norm(a) { while (a < 0) a += TAU; while (a >= TAU) a -= TAU; return a; }
    function thetaFwd(k) { return norm(thL[k] - 6 * P - delta(k) / rc[k]); }
    function thetaRev(k) { return norm(thL[k] - 5 * P + delta(k) / rc[k]); }
    function applyArm() {
      armG.rotation.y = arm.theta; carG.position.x = arm.carr; pinion.rotation.y = (arm.carr - rc[0]) / 6;
      var tip = PIN_UP + (PIN_DOWN - PIN_UP) * arm.pin; pinG.position.set(0, tip, 0);
      var tz = tip + COLLAR - 0.8, dx = 0 - S2X, dz = tz - S2Z; horn.rotation.z = Math.atan2(dz, dx); hornBar.scale.x = Math.hypot(dx, dz) / 12; hornBar.position.x = 6 * hornBar.scale.x;
    }
    function applyRings(selColor) {
      rings.forEach(function (r) {
        r.lift += (r.liftT - r.lift) * 0.15; if (Math.abs(r.liftT - r.lift) < 0.002) r.lift = r.liftT;
        r.g.rotation.y = r.A; r.g.position.y = ZF + 0.2 + r.lift * 30;
        rimMats[r.k].emissive = rimMats[r.k].emissive || new T.Color(0); var on = COLORS[r.k] === selColor || r.k === st.sel;
        rimMats[r.k].emissive.setHex(on ? 0x333333 : 0x000000);
        r.pills.forEach(function (p) { if (p.drop > 0) p.drop = Math.max(0, p.drop - 0.06); placePill(p, r); });
      });
    }
    // pill meshes have their origin on the underside, so every z below is the underside height
    function cupSpot(n) { return [57 + ((n % 3) - 1) * 3.2, CUPV + ((Math.floor(n / 3) % 2) - 0.5) * 4.2, CUP.floor + Math.floor(n / 6) * 3]; }
    function landPill(p) { var spot = cupSpot(cup.length); p.mesh.position.set(spot[0], spot[2], -spot[1]); p.mesh.rotation.set(0, Math.PI, 0); cup.push(p); }
    function fallPose(f, tau) {
      var a = 0.12, b = 0.70, x0 = f.u0, zf0 = zf(Math.max(FUN.x0, x0)) + 0.1, spot = cupSpot(cup.length), pos, yaw;
      if (tau < a) { var t = tau / a; pos = [x0, f.v0, lerp(ZF, zf0, t * t)]; yaw = f.yaw0; }
      else if (tau < b) {
        var s = ease((tau - a) / (b - a)), x = lerp(x0, LIP_X, s); pos = [x, lerp(f.v0, CUPV, Math.min(1, s * 1.6)), zf(x) + 0.1]; yaw = lerp(f.yaw0, Math.PI, s);
      } else {
        var u = (tau - b) / (1 - b), zl = zf(LIP_X) + 0.1; pos = [lerp(LIP_X, spot[0], u), lerp(CUPV, spot[1], u), lerp(zl, spot[2], u * u)]; yaw = Math.PI;
      }
      f.p.mesh.position.set(pos[0], pos[2], -pos[1]); f.p.mesh.rotation.set(0, yaw, 0); f.p.mesh.visible = true;
    }
    function cum(ph, q) { var i = ORDER.indexOf(ph); if (i < 0) return 0; var c = 0; for (var j = 0; j < i; j++) c += DURS[j]; return c + q * DURS[i]; }
    var CUM_END = DURS.slice(0, 8).reduce(function (a, b) { return a + b; }, 0);

    function ringOf(s) { return s && s.selected ? COLORS.indexOf(s.selected) : -1; }
    function canonical(r, n) { rebuild(r, n); r.sess = false; }
    function startDispense(s, k) {
      var r = rings[k], n = s.cartridges[s.selected].count;
      if (!r.canon || r.pills.length !== n) canonical(r, n);
      rec = { k: k, sawDrum: false, carr0: arm.carr, K0: r.K, A0: r.A, fall: null, adv: 0, theta0: arm.theta };
    }
    function finishDispense(s) {
      if (!rec) return;
      var r = rings[rec.k];
      if (rec.fall) { landPill(rec.fall.p); rec.fall = null; }
      if (rec.adv >= 0.999) { r.K = rec.K0 + 1; r.A = r.K * P; } else { r.A = rec.A0 + rec.adv * P; }
      arm.theta = PARK; arm.carr = rc[rec.k]; arm.pin = 0; rec = null;
    }
    function dispenseDrive(s) {
      var k = ringOf(s); if (k < 0) return;
      if (!rec) startDispense(s, k);
      var r = rings[rec.k], ph = s.phase, q = s.phaseProgress || 0, e = ease(q), thF = thetaFwd(rec.k), carr = rc[rec.k], th = PARK, pin = 0, adv = 0;
      if (ph === 'DRUM_ROTATE') { rec.sawDrum = true; carr = lerp(rec.carr0, rc[rec.k], e); }
      else if (ph === 'CARRIAGE_APPROACH') { carr = rec.sawDrum ? rc[rec.k] : lerp(rec.carr0, rc[rec.k], e); th = lerp(PARK, thF, e); }
      else if (ph === 'PIN_ENGAGE') { th = thF; pin = e; }
      else if (ph === 'BLADE_PULL_RELEASE') { th = thF + e * P; pin = 1; adv = e; }
      else if (ph === 'STACK_SETTLE') { th = thF + P; pin = 1; adv = 1; }
      else if (ph === 'BLADE_ISOLATE_CLOSE') { th = thF + P; pin = 1 - e; adv = 1; }
      else if (ph === 'BLADE_CLOSED_DWELL') { th = thF + P; adv = 1; }
      else if (ph === 'PIN_LIFT') { th = lerp(thF + P, PARK, e); adv = 1; }
      else if (ORDER.indexOf(ph) >= 0) adv = 1;
      arm.theta = th; arm.carr = carr; arm.pin = pin; rec.adv = Math.max(rec.adv, adv);
      // the ring turns with the arm; each pill is pushed by the divider behind it
      var A = (rec.K0 + adv) * P, dA = A - r.A;
      if (Math.abs(dA) > 1e-9) movePills(r, dA);
      if (!rec.fall) { var c = crossed(r); if (c) { r.pills.splice(r.pills.indexOf(c), 1); var phi = pocketCenter(r, c.m) + c.off; rec.fall = { p: c, u0: rc[r.k] * Math.cos(phi), v0: rc[r.k] * Math.sin(phi), yaw0: phi + Math.PI / 2, tau0: cum(ph, q) }; } }
      if (rec.fall) { var tau = Math.max(0, Math.min(1, (cum(ph, q) - rec.fall.tau0) / (CUM_END - rec.fall.tau0))); if (ph === 'TONGUE_RETURN') tau = 1; fallPose(rec.fall, tau); if (tau >= 1 && ph === 'TONGUE_RETURN') { landPill(rec.fall.p); rec.fall = null; } }
    }

    // ---------- timed tasks (refill and self-test); the controller is idle while they run ----------
    function enqueue(t) { tasks.push(t); }
    function armTo(theta, carr, dur, pin) {
      var f;
      enqueue({ dur: dur, start: function () { f = { th: arm.theta, c: arm.carr, p: arm.pin }; }, run: function (q) { var e = ease(q); arm.theta = lerp(f.th, theta, e); arm.carr = lerp(f.c, carr, e); if (pin !== undefined) arm.pin = lerp(f.p, pin, e); } });
    }
    function pinTo(v, dur) { var f; enqueue({ dur: dur, start: function () { f = arm.pin; }, run: function (q) { arm.pin = lerp(f, v, ease(q)); } }); }
    function stroke(k, dir) {
      var r = rings[k], th0 = dir > 0 ? thetaFwd(k) : thetaRev(k);
      armTo(th0, rc[k], 0.55, 0); pinTo(1, 0.22);
      var A0;
      enqueue({ dur: 0.75, start: function () { A0 = r.A; }, run: function (q) { var e = ease(q); arm.theta = th0 + dir * e * P; var dA = A0 + dir * e * P - r.A; movePills(r, dA); }, end: function () { r.K += dir; r.A = r.K * P; } });
      pinTo(0, 0.22);
    }
    function loadDrop(k) {
      var r = rings[k];
      enqueue({ dur: 0.45, start: function () { var p = newPill(r, 6, 1); p.off = 0; r.loading = p; }, run: function (q) { r.loading.drop = 1 - ease(q); }, end: function () { r.loading = null; pushCounts(); } });
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
        return { lid: st.lidT > 0, ring: k, counts: rings.map(function (x) { return x.pills.length; }), busy: !free, lifted: Boolean(r && r.liftT > 0),
          canOpen: free && st.lidT === 0, canClose: free && st.lidT > 0, canSelect: free && st.lidT > 0 && !rings.some(function (x) { return x.liftT > 0; }),
          canLoad: free && st.lidT > 0 && r && r.liftT === 0 && r.pills.length < CAP, canIndex: free && st.lidT > 0 && r && r.liftT === 0 && r.sess && frontU(r) > 1,
          canLift: free && st.lidT > 0 && Boolean(r) };
      },
      openLid: function () { if (!refill.state().canOpen) return false; st.lidT = 1; st.session = true; return true; },
      select: function (k) {
        if (!refill.state().canSelect || k < 0 || k >= rings.length) return false;
        st.sel = k; armTo(PARK, rc[k], 0.5, 0); return true;
      },
      load: function () {
        if (!refill.state().canLoad) return false;
        var k = st.sel, r = rings[k];
        if (!r.sess) { r.sess = true; r.canon = false; var nrev = CAP - r.pills.length; for (var i = 0; i < nrev; i++) stroke(k, -1); armTo(PARK, rc[k], 0.5, 0); }
        else armTo(PARK, rc[k], 0.45, 0);
        loadDrop(k); stroke(k, 1); armTo(PARK, rc[k], 0.5, 0); return true;
      },
      index: function () { if (!refill.state().canIndex) return false; var k = st.sel; stroke(k, 1); armTo(PARK, rc[k], 0.5, 0); return true; },
      lift: function () { if (!refill.state().canLift) return false; var r = rings[st.sel]; r.liftT = r.liftT > 0 ? 0 : 1; return true; },
      closeLid: function () {
        var s = refill.state(); if (!s.canClose) return false;
        rings.forEach(function (r) { r.liftT = 0; });
        rings.forEach(function (r) { if (!r.sess) return; var n = frontU(r) - 1; for (var i = 0; i < n; i++) stroke(r.k, 1); });
        armTo(PARK, rc[Math.max(0, st.sel)], 0.5, 0);
        enqueue({ dur: 0.01, run: function () {}, end: function () { rings.forEach(function (r) { if (r.sess) { r.sess = false; r.canon = true; } }); pushCounts(); st.lidT = 0; st.session = false; st.sel = -1; } });
        return true;
      }
    };

    // ---------- lid, per-frame update ----------
    var LD = S.lid, lidHinge = new T.Vector3(0, LD.z0, -(CYa + LD.r));
    function applyLid() {
      st.lid += (st.lidT - st.lid) * 0.12; if (Math.abs(st.lidT - st.lid) < 0.002) st.lid = st.lidT;
      var g = ctx.lid; if (!g) return; var a = -1.75 * ease(st.lid), c = Math.cos(a), s = Math.sin(a);
      g.rotation.x = a; g.position.set(0, lidHinge.y - (lidHinge.y * c - lidHinge.z * s), lidHinge.z - (lidHinge.y * s + lidHinge.z * c));
    }
    function sync(s) {
      if (st.session || busy() || rec || !s || s.operation !== null) return;
      COLORS.forEach(function (c, k) {
        var r = rings[k], cs = s.cartridges[c], n = cs && cs.occupancy === 'loaded' ? cs.count : 0;
        if (r.pills.length !== n) rebuild(r, n);
      });
      while (cup.length > (s.trayCount || 0)) killPill(cup.pop());
    }
    function update(s, now) {
      if (!st.active) return;
      var t = now || Date.now(), dt = last ? Math.min(0.1, (t - last) / 1000) : 0.016; last = t;
      if (s && s.operation === 'dispense') dispenseDrive(s);
      else { if (rec) finishDispense(s); runTasks(dt); }
      sync(s); applyArm(); applyRings(s && s.operation === 'dispense' ? s.selected : null); applyLid();
      var sel = st.sel >= 0 ? rings[st.sel] : null;
      marker.visible = Boolean(sel && st.lidT > 0 && sel.liftT === 0);
      if (marker.visible) { var phi = sel.A + thL[sel.k] - 5.5 * P; marker.position.set(rc[sel.k] * Math.cos(phi), ZF + 0.4, -rc[sel.k] * Math.sin(phi)); }
    }

    // ---------- servo mounts for the wiring harness (pivot = axle-relative shaft position at the parked arm) ----------
    function ringAct() {
      if (!st.active) return null;
      var c = Math.cos(PARK), s = Math.sin(PARK), pt = function (x, l) { return [c * x - s * l, s * x + c * l]; };
      return {
        s1: { pivot: pt(S1X, S1L), body_dir: [-c, -s], plate_z: [S1Z0 - 1, S1Z0] },
        s2: { pivot: pt(rc[0] + S2X, (S2L0 + S2L1) / 2), body_dir: [-c, -s], body_z0: S2Z - SV.w / 2 }
      };
    }
    function setActive(on) {
      on = Boolean(on); if (on === st.active) return;
      st.active = on; root.visible = on; if (ctx.legacy) ctx.legacy(on);
      if (on) { last = 0; applyArm(); applyRings(null); }
      else { st.lidT = 0; st.lid = 0; st.session = false; applyLid(); }
      if (ctx.changed) ctx.changed();
    }
    return {
      active: function () { return st.active; }, setActive: setActive, update: update, ringAct: ringAct, refill: refill,
      setPocket: function (q) { st.q = Math.max(0, Math.min(1, Number(q))); applyPocket(); rings.forEach(function (r) { var sl = slack(r.k); r.pills.forEach(function (p) { p.off = Math.max(-sl, Math.min(sl, p.off)); }); }); return st.q; },
      pocket: function () { return { q: st.q, widths: rings.map(function (r) { return Math.round(pocketW(r.k, st.q) * 10) / 10; }), dividers: rings.map(function (r) { return Math.round(vaneT(r.k, st.q) * 10) / 10; }), pills: PILLS.map(function (p) { return p.name + ' ' + p.L + 'x' + p.W; }) }; },
      label: function (ph) { return st.active && LABELS[ph] ? LABELS[ph] : null; },
      report: function () { return { active: st.active, pockets: N, rings: rings.map(function (r) { return { k: r.k, K: r.K, pills: r.pills.length, front: frontU(r) }; }), arm: { theta: arm.theta, carr: arm.carr, pin: arm.pin }, cup: cup.length, lid: st.lid, busy: busy() }; },
      root: root, constants: { N: N, rc: rc, thL: thL, PARK: PARK, ZF: ZF }
    };
  }
  window.DispenserRingMagazine = { build: build };
}());
