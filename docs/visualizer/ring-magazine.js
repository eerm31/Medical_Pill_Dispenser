(function () {
  'use strict';
  /* Ring magazine: an alternative internal mechanism for the same housing (ASSUMED / NOT_VALIDATED, concept only).
     Four concentric ring cartridges lie on the fixed deck. Each ring is a wheel of radial dividers; a pill sits in the pocket
     between two dividers and is pushed along the deck by the divider behind it. Pills stand on edge, so any pill fits any ring. One movable actuator arm (rack-driven pin
     carriage) selects a ring, drops its pin behind one divider and swings one pocket pitch. All four rings share ONE exit slot
     in the deck, ONE funnel and ONE cup. Geometry numbers come from rotation-spec.js (g.ring); the demo controller is untouched
     and only drives the phase names this file maps to motion.
     Support: the rod runs through a bushing in the fixed post; each ring rests on 4 captive balls in a fixed grooved track on the deck
     (balls carry the weight; PTFE-lined guide walls between the rings hold them radially). A clamp pad per ring locks it; only the ring being served is unlocked.
     Refill: a small hatch per ring in the lid sits over that ring's loading pocket; the ring turns an empty pocket under it first. */
  var TAU = Math.PI * 2;
  function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  function ease(q) { q = Math.max(0, Math.min(1, q)); return q * q * (3 - 2 * q); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mod(a, n) { return ((a % n) + n) % n; }

  // pill models: small round, large round, oval, capsule. Pills STAND on edge between the dividers: L (the thinnest side) runs along
  // the track, W across it, H (the longest side) is vertical, so even the 12 mm capsule needs only 5 mm of pocket and fits every ring (mm)
  var PILLS = [
    { kind: 'round', name: 'small round', L: 2.0, W: 4.2, H: 4.2 },
    { kind: 'round', name: 'large round', L: 2.8, W: 6.0, H: 6.0 },
    { kind: 'oval', name: 'oval', L: 3.4, W: 6.2, H: 9.5 },
    { kind: 'capsule', name: 'capsule', L: 5.0, W: 5.0, H: 12.0 }
  ];
  var PIN_R = 0.35, PIN_LEN = 11, TOOTH = 1.6;
  var ORDER = ['PIN_ENGAGE', 'BLADE_PULL_RELEASE', 'STACK_SETTLE', 'BLADE_ISOLATE_CLOSE', 'BLADE_CLOSED_DWELL', 'PIN_LIFT', 'TONGUE_RELEASE', 'PILL_CLEAR', 'TONGUE_RETURN'];
  var DURS = [0.625, 1.01, 0.5, 1.01, 0.3, 0.625, 0.814, 0.5, 0.814];
  var LABELS = {
    DRUM_ROTATE: ['Rod slides to the selected ring', 'The single actuator rod slides along the arm under the deck to the selected ring (push-pull cable from servo S1 on the tray). Only that ring\'s lock pad lifts; the other rings stay clamped.'],
    CARRIAGE_APPROACH: ['Arm swings to the pin start', 'The stepper turns the arm under the floor until the pin sits below the slot under the ring\'s inner rim, behind a drive tooth.'],
    PIN_ENGAGE: ['Pin rises behind a tooth', 'Servo S2 pulls its cable and the pin rises through the floor slot into the sealed channel under the rim, behind one drive tooth. It never enters a pill pocket.'],
    BLADE_PULL_RELEASE: ['Divider pushes the pill', 'The arm swings one pocket pitch; the pin pushes the tooth, the ring rolls on its balls and each divider pushes the pill in front of it across the floor.'],
    STACK_SETTLE: ['Pill drops through the exit', 'The front pill passes the leading edge of the single exit slot and falls into the funnel.'],
    BLADE_ISOLATE_CLOSE: ['Pill slides down the funnel', 'The pill slides down the shared funnel while the pin lowers below the floor.'],
    BLADE_CLOSED_DWELL: ['Pin clear (dwell)', 'Short pause with the pin lowered below the deck.'],
    PIN_LIFT: ['Arm returns to park', 'The arm swings back to its home position under the deck.'],
    TONGUE_RELEASE: ['Pill leaves the housing', 'The pill slides out of the wall window.'],
    PILL_CLEAR: ['Pill drops into the cup', 'The pill drops from the funnel lip into the collection cup.'],
    TONGUE_RETURN: ['Carriage parks', 'Single movable actuator at rest; nothing else moved.']
  };

  function build(ctx) {
    var T = ctx.THREE, S = ctx.S, R = S.ring, M = ctx.mats, COLORS = ctx.COLORS, std = ctx.std;
    var CYa = S.axle[1], N = R.n, P = TAU / N, ZF = R.floor_z, WH = R.wheel_h, RT = R.rim_t, VMIN = R.vane_t, CAP = R.cap;
    var VL = R.slot.v[0], VT_ = R.slot.v[1], FUN = R.funnel, SV = S.act.servo, PARK = R.park_deg * Math.PI / 180;
    var rc = R.tracks.map(function (t) { return (t[0] + t[1]) / 2; });
    // the drive pin works under the inner rim (radius rp), in a sealed channel beside the pill pockets, and pushes a tooth under each divider
    var rp = R.tracks.map(function (t) { return t[0] + 0.4; });
    var thL = rc.map(function (r) { return Math.asin(VL / r); });
    var CUPV = (VL + VT_) / 2, LIP_X = 54, CUP = { x0: 52.5, x1: 66, floor: -30 };
    var st = { active: false, q: 0.45, sel: -1, lid: 0, lidT: 0, session: false, armLift: 0, show: -1, showHatch: -1 };
    var root = new T.Group(); root.name = 'ring magazine'; root.position.set(0, 0, -CYa); root.visible = false; ctx.parent.add(root);
    var PR = std(0x9fc2e6, { transparent: true, opacity: 0.8, roughness: 0.45 });
    // each ring rides on NB captive balls (radius BR) in a fixed grooved track; the loading pocket sits UL pockets before the exit
    var BR = 0.55, TRK = 0.3, RAISE = TRK + 2 * BR, RZ = ZF + RAISE, NB = 4, UL = CAP, LOCK_A = -Math.PI / 2, LDS = S.lid;
    var thLoad = thL.map(function (t) { return t - (UL - 0.5) * P; }), rh = rc.map(function (r) { return Math.min(r, LDS.r - 4); }), DROPH = (LDS.z1 + 6 - ZF) / 9;

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
    // steel ballast between the feet, under the tray: lowers the centre of mass without using any room inside
    var BALLAST = { r: 28, z0: S.base_z0 - 5, z1: S.base_z0 };
    tag(cy(fixedG, 0, 0, BALLAST.z0, BALLAST.z1, BALLAST.r, M.steel, 48), 'Base ballast', 'bought', 'ballast');
    var cupG = new T.Group(); fixedG.add(cupG);
    tag(bx(cupG, CUP.x0, CUP.x1, VL - 0.6, VT_ + 0.6, -31, CUP.floor, PR), 'Collection cup', 'printed', 'cup');
    [[CUP.x0, CUP.x1, VL - 0.6, VL + 0.4], [CUP.x0, CUP.x1, VT_ - 0.4, VT_ + 0.6], [CUP.x1 - 1, CUP.x1, VL, VT_], [CUP.x0, CUP.x0 + 1, VL, VT_]].forEach(function (b) {
      tag(bx(cupG, b[0], b[1], b[2], b[3], CUP.floor, -23.5, PR), 'Collection cup', 'printed', 'cup');
    });

    // ---------- ring wheels ----------
    var rings = [], pillMats = [], rimMats = [];
    // each ring can hold any of the pill models that fits its pockets: pitch = ring circumference / N, minus the divider and 0.6 mm play
    var pillOf = [0, 1, 2, 3];
    function pl(k) { return PILLS[pillOf[k]]; }
    function maxLen(k) { return P * rc[k] - VMIN - 0.6; }
    function fits(k, i) { var tr = R.tracks[k]; return PILLS[i].L <= maxLen(k) + 1e-9 && PILLS[i].W + 0.4 <= tr[1] - tr[0] - 2 * RT + 1e-9; }
    function pocketW(k, q) { var pitch = P * rc[k], cmax = Math.max(0.6, Math.min(3.0, pitch - VMIN - pl(k).L)); return pl(k).L + 0.6 + (cmax - 0.6) * q; }
    function vaneT(k, q) { return P * rc[k] - pocketW(k, q); }
    COLORS.forEach(function (color, k) {
      var tr = R.tracks[k], accent = ctx.accent[color] || 0x8294a5, g = new T.Group(), rim = std(accent, { transparent: true, opacity: 0.5, roughness: 0.5, side: T.DoubleSide, depthWrite: false }), solid = std(accent, { roughness: 0.55 });
      rimMats.push(rim); g.position.y = RZ; root.add(g);
      var mi = new T.Mesh(ringGeo(tr[0] + RT, tr[0], WH), rim), mo = new T.Mesh(ringGeo(tr[1], tr[1] - RT, WH), rim), band = new T.Mesh(ringGeo(tr[1], tr[1] - RT - 0.2, 0.9), solid);
      band.position.y = WH - 0.9; [mi, mo, band].forEach(function (m) { g.add(m); tag(m, 'Ring magazine', 'printed', 'ring' + k); });
      var vanes = [], width = (tr[1] - RT) - (tr[0] + RT) + 0.2, vaneGeo = new T.CylinderGeometry(0.5, 0.5, width, 16);
      vaneGeo.rotateZ(Math.PI / 2); // smooth oval divider: its thickness (scale.z) is the adjustable part
      var toothGeo = new T.BoxGeometry(RT, 1.2, TOOTH);
      for (var j = 0; j < N; j++) {
        var vg = new T.Group(); vg.rotation.y = thL[k] - j * P; g.add(vg);
        var tooth = new T.Mesh(toothGeo, solid); tooth.position.set(rp[k], -0.6, 0); vg.add(tooth); tag(tooth, 'Drive tooth', 'printed', 'tooth' + k);
        var v = new T.Mesh(vaneGeo, solid); v.scale.y = WH; v.position.set(rc[k], WH / 2, 0); vg.add(v); tag(v, 'Adjustable divider', 'printed', 'divider' + k); vanes.push(v);
      }
      rings.push({ k: k, g: g, vanes: vanes, K: 0, A: 0, pills: [], lift: 0, liftT: 0, sess: false, canon: true, nextM: 0 });
      var c = accent;
      pillMats.push({ main: std(c, { roughness: 0.35 }), white: std(0xf4f4f0, { roughness: 0.4 }) });
    });
    function applyPocket() { rings.forEach(function (r) { var t = vaneT(r.k, st.q); r.vanes.forEach(function (v) { v.scale.z = t; }); }); }
    applyPocket();
    function slack(k) { return Math.max(0, (pocketW(k, st.q) - pl(k).L) / 2) / rc[k]; }

    // ---------- fixed pocket floor: closes the bottom of every pocket; pills slide on it to the one exit hole, the pin rises through the arc slots ----------
    var floorG = (function () {
      var sh = new T.Shape(), hp = new T.Path(), d2r = Math.PI / 180;
      sh.absarc(0, 0, R.tracks[3][1] + 1.2, 0, TAU, false); hp.absarc(0, 0, 2.8, 0, TAU, true); sh.holes.push(hp);
      var ex = new T.Path(); ex.moveTo(R.slot.x[0], R.slot.v[0]); ex.lineTo(R.slot.x[1], R.slot.v[0]); ex.lineTo(R.slot.x[1], R.slot.v[1]); ex.lineTo(R.slot.x[0], R.slot.v[1]); ex.closePath(); sh.holes.push(ex);
      R.arc_slots.forEach(function (a) {
        var h = new T.Path(), r0 = a.r - a.w / 2, r1 = a.r + a.w / 2; h.absarc(0, 0, r1, a.a0 * d2r, a.a1 * d2r, false); h.absarc(0, 0, r0, a.a1 * d2r, a.a0 * d2r, true); h.closePath(); sh.holes.push(h);
      });
      var g = new T.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false, curveSegments: 96 }); g.rotateX(-Math.PI / 2);
      var m = new T.Mesh(g, std(0xd7dfe8, { roughness: 0.6 })); m.position.y = ZF - 0.3; fixedG.add(m); tag(edges(m), 'Pocket floor', 'printed', 'floor'); return m;
    }());

    // ---------- ring support: shaft -> bushing -> fixed post; ring -> balls -> grooved track -> deck; one clamp pad per ring ----------
    var bronze = std(0xc08a3e, { roughness: 0.4, metalness: 0.5 }), redM = std(0xd33a3a, { roughness: 0.5 }), balls = [], pads = [], lockV = [0, 0, 0, 0], PADUP = 1.0;
    function polarG(par, phi) { var g = new T.Group(); g.rotation.y = phi; par.add(g); return g; }
    var bush = new T.Mesh(ringGeo(2.8, 2.5, WH), bronze); bush.position.y = ZF; fixedG.add(bush); tag(bush, 'Shaft bushing', 'bought', 'bushing', 'hardware');
    R.tracks.forEach(function (tr, k) {
      var rb = tr[1] - RT / 2, top = RZ + WH, lg = polarG(fixedG, LOCK_A), list = [];
      // flat race, inner lip (below the dividers) and a guide wall that stands in the gap between rings and guides both neighbours
      [[tr[1] + 0.3, tr[1] - 1.15, TRK], [tr[1] - 0.95, tr[1] - 1.15, RAISE - 0.1], [tr[1] + 0.65, tr[1] + 0.15, RAISE + 0.6], [tr[0] + 1.0, tr[0] + 0.9, RAISE - 0.1]].forEach(function (p) {
        var m = new T.Mesh(ringGeo(p[0], p[1], p[2]), PR); m.position.y = ZF; fixedG.add(m); tag(edges(m), 'Ring support track', 'printed', 'track' + k);
      });
      // PTFE tape on both wall faces: the rims slide on it with 0.1 mm clearance
      [[tr[1] + 0.15, tr[1] + 0.1], [tr[1] + 0.7, tr[1] + 0.65]].forEach(function (p) {
        var m = new T.Mesh(ringGeo(p[0], p[1], RAISE + 0.5), M.white); m.position.y = ZF; fixedG.add(m); tag(m, 'PTFE liner', 'bought', 'ptfe' + k, 'hardware');
      });
      for (var i = 0; i < NB; i++) { var b = new T.Mesh(new T.SphereGeometry(BR, 14, 10), M.steel); fixedG.add(b); tag(b, 'Ball bearings', 'bought', 'balls' + k, 'hardware'); list.push(b); }
      balls.push({ rb: rb, list: list });
      // lock: bracket on the track lip, arm over the rim, pad that clamps the rim top (down = locked)
      tag(bx(lg, tr[1] + 0.1, tr[1] + 0.4, -1.2, 1.2, ZF, top + 2.2, PR), 'Ring lock', 'printed', 'lock' + k);
      tag(bx(lg, tr[1] - 2.6, tr[1] + 0.4, -1.2, 1.2, top + 1.6, top + 2.2, PR), 'Ring lock', 'printed', 'lock' + k);
      var pad = tag(bx(lg, tr[1] - 1.0, tr[1] - 0.1, -0.9, 0.9, top, top + 1.6, redM), 'Ring lock pad', 'printed', 'pad' + k); pad.userData.y0 = pad.position.y; pads.push(pad);
    });
    // the innermost ring is guided by a sleeve on the centre post, also lined with PTFE
    var guide0 = new T.Mesh(ringGeo(R.tracks[0][0] - 0.2, R.tracks[0][0] - 0.8, RAISE + 0.6), PR), ptfe0 = new T.Mesh(ringGeo(R.tracks[0][0] - 0.1, R.tracks[0][0] - 0.2, RAISE + 0.5), M.white);
    [guide0, ptfe0].forEach(function (m) { m.position.y = ZF; fixedG.add(m); });
    tag(edges(guide0), 'Ring support track', 'printed', 'track0'); tag(ptfe0, 'PTFE liner', 'bought', 'ptfe0', 'hardware');

    // ---------- loading hatches: one small hatch per ring in the lid, a short funnel down to that ring's loading pocket ----------
    var hatches = [], lidHost = root;
    if (ctx.lid) { lidHost = new T.Group(); lidHost.position.set(0, 0, -CYa); lidHost.visible = false; ctx.lid.add(lidHost); }
    COLORS.forEach(function (color, k) {
      var pg = polarG(lidHost, thLoad[k]), acc = std(ctx.accent[color] || 0x8294a5, { roughness: 0.5 }), z1 = LDS.z1, zb = RZ + WH + 1.0, dx = rc[k] - rh[k], dz = LDS.z0 - zb;
      tag(bx(pg, rh[k] - 3.0, rh[k] + 3.0, -3.6, 3.6, z1, z1 + 0.3, M.dark), 'Loading hatch', 'printed', 'hatch' + k);
      var fg = new T.Group(); fg.position.set(rh[k] + 2.6, z1 + 0.3, 0); pg.add(fg);
      tag(bx(fg, -5.2, 0, -3.3, 3.3, 0, 0.8, acc), 'Loading hatch', 'printed', 'hatch' + k);
      var tube = new T.Mesh(new T.CylinderGeometry(3.1, 3.1, Math.hypot(dx, dz), 20, 1, true), std(ctx.accent[color] || 0x8294a5, { transparent: true, opacity: 0.25, side: T.DoubleSide, depthWrite: false }));
      tube.position.set((rh[k] + rc[k]) / 2, (zb + LDS.z0) / 2, 0); tube.rotation.z = -Math.atan2(-dx, dz); pg.add(tube); tag(tube, 'Fill funnel', 'printed', 'funnel' + k);
      hatches.push({ g: fg, v: 0 });
    });

    // ---------- pills ----------
    function pillObject(k) {
      var d = pl(k), mm = pillMats[k], g = new T.Group(), body = new T.Group(), m; g.add(body);
      if (d.kind === 'round') { m = new T.Mesh(new T.CylinderGeometry(d.H / 2, d.H / 2, d.L, 28), mm.main); m.rotation.z = Math.PI / 2; m.position.y = d.H / 2; body.add(m); }
      else if (d.kind === 'oval') { m = new T.Mesh(new T.SphereGeometry(1, 24, 16), mm.main); m.scale.set(d.L / 2, d.H / 2, d.W / 2); m.position.y = d.H / 2; body.add(m); }
      else {
        var r = d.W / 2, half = (d.H - d.W) / 2, a = new T.Mesh(new T.CylinderGeometry(r, r, half, 20), mm.main), b = new T.Mesh(new T.CylinderGeometry(r, r, half, 20), mm.white);
        a.position.y = r + half / 2; b.position.y = r + half * 1.5; body.add(a, b);
        [[r, mm.main], [d.H - r, mm.white]].forEach(function (e) { var s = new T.Mesh(new T.SphereGeometry(r, 20, 12), e[1]); s.position.y = e[0]; body.add(s); });
      }
      // f = 0 stands on edge in its pocket, f = 1 lies flat (after it leaves the ring, or while it falls into a pocket)
      g.userData.lay = function (f) { body.rotation.z = -f * Math.PI / 2; body.position.set(-f * d.H / 2, f * d.L / 2, 0); };
      g.userData.noWire = true; root.add(g); return g;
    }
    function uOf(r, p) { return ((((p.m - r.K) % N) + N) % N) + 1; }
    function mOfU(r, u) { return (((u - 1 + r.K) % N) + N) % N; }
    function newPill(r, u, drop) { var p = { k: r.k, m: mOfU(r, u), off: 0, mesh: pillObject(r.k), drop: drop || 0, yaw: 0 }; r.pills.push(p); return p; }
    function killPill(p) { if (p.mesh.parent) p.mesh.parent.remove(p.mesh); }
    function rebuild(r, n) { r.pills.forEach(killPill); r.pills = []; for (var u = 1; u <= n; u++) newPill(r, u, 0.6 + 0.12 * u); r.canon = true; r.nextM = mod(r.K + n, N); }
    // refill drops the pill into the next empty pocket (nextM), which the ring has turned under the hatch
    function newPillAt(r) { var p = { k: r.k, m: r.nextM, off: 0, mesh: pillObject(r.k), drop: 0, yaw: 0 }; r.pills.push(p); r.nextM = mod(r.nextM + 1, N); return p; }
    function pocketCenter(r, m) { return r.A + thL[r.k] - (m + 0.5) * P; }
    function placePill(p, r, pos) {
      var phi = pocketCenter(r, p.m) + p.off, d = pl(p.k), lift = r.lift * 30, rad = rc[p.k] + (p.hold ? (rh[p.k] - rc[p.k]) * Math.min(1, p.drop / DROPH) : 0);
      p.mesh.position.set(rad * Math.cos(phi), ZF + p.drop * 9 + lift, -rad * Math.sin(phi)); p.mesh.rotation.set(0, phi + Math.PI / 2, 0); p.mesh.userData.lay(p.lay || 0); p.mesh.visible = true;
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

    // ---------- the actuator: one arm UNDER the deck; its pin rises through arc slots. Both servos stand on the tray and pull push-pull cables ----------
    var armG = new T.Group(); root.add(armG);
    var ZA0 = R.arm_z[0], ZA1 = R.arm_z[1], PINZ = R.pin, ZB = S.bay_z0;
    var hubSleeve = new T.Mesh(ringGeo(9, 7.1, 7), PR); hubSleeve.position.y = -12.5; armG.add(hubSleeve); tag(edges(hubSleeve), 'Actuator arm', 'printed', 'arm');
    tag(bx(armG, 7, 10, -3, 3, ZA0, ZA1, PR), 'Actuator arm', 'printed', 'arm');
    tag(bx(armG, 7, 45.5, -3, -1.5, ZA0, ZA1, PR), 'Actuator arm', 'printed', 'arm');
    tag(bx(armG, 7, 45.5, 1.5, 3, ZA0, ZA1, PR), 'Actuator arm', 'printed', 'arm');
    var carG = new T.Group(); armG.add(carG);
    tag(bx(carG, -4.5, 4.5, -4.5, 4.5, ZA1, ZA1 + 3.3, PR), 'Actuator arm', 'printed', 'carriage');
    function wire(l, z) { var g = new T.CylinderGeometry(0.35, 0.35, 1, 8); g.rotateZ(Math.PI / 2); var m = new T.Mesh(g, M.steel); m.position.set(0, z, -l); armG.add(m); tag(m, 'Push-pull cable', 'bought', 'cable'); return m; }
    var wireA = wire(-3.5, ZA1 + 1.6), wireB = wire(3.5, ZA1 + 1.6);
    var pinG = new T.Group(); carG.add(pinG);
    var pr = new T.Mesh(new T.CylinderGeometry(PIN_R, PIN_R, PIN_LEN, 14), M.dark); pr.position.y = PIN_LEN / 2 - 0.4; pinG.add(pr);
    var pc = new T.Mesh(new T.CylinderGeometry(0.3, PIN_R, 1.6, 14), M.dark); pc.position.y = PIN_LEN - 0.8; pinG.add(pc);
    [pc, pr].forEach(function (m) { tag(m, 'Engagement pin', 'bought', 'pin'); });
    function servoAt(label, cx, vc) {
      var g = new T.Group(); g.position.set(cx, 0, -vc); root.add(g);
      var x0 = -(SV.len - SV.shaft_off), x1 = SV.shaft_off, hw = SV.w / 2, list = [bx(g, x0, x1, -hw, hw, ZB, ZB + SV.h, M.blue, false), bx(g, x0 - SV.ear, x1 + SV.ear, -hw, hw, ZB, ZB + 1.5, M.blue, false)];
      list.forEach(function (m) { tag(m, label, 'bought', 'servo', 'electronic'); });
      [[x0 - SV.ear + 1, 0], [x1 + SV.ear - 1, 0]].forEach(function (q) { tag(bx(g, q[0] - 1.5, q[0] + 1.5, -hw, hw, ZB - 3, ZB, PR), 'Tray standoff', 'printed', 'standoff'); });
      var horn = new T.Group(); horn.position.set(0, ZB + SV.h + 0.4, 0); g.add(horn);
      var bar = new T.Mesh(new T.BoxGeometry(10, 1.4, 2.4), M.white); bar.position.x = 5; horn.add(bar); tag(bar, 'Actuator arm', 'printed', 'horn');
      return { g: g, horn: horn, top: [cx, vc, ZB + SV.h + 1.6] };
    }
    var S1X = -12, S1V = 29, S2X = 20, S2V = 29;
    var sv1 = servoAt('Micro servo S1 (pin)', S1X, S1V), sv2 = servoAt('Micro servo S2 (tongue)', S2X, S2V);
    var sheaths = [0, 1].map(function (i) { var m = new T.Mesh(new T.BufferGeometry(), M.dark); root.add(m); tag(m, 'Push-pull cable', 'bought', 'cable'); return m; }), sheathAt = { th: NaN, c: NaN };
    function updateSheaths() {
      if (Math.abs(arm.theta - sheathAt.th) < 0.004) return; sheathAt.th = arm.theta;
      var c = Math.cos(arm.theta), s = Math.sin(arm.theta);
      [[sv1, -2.2], [sv2, 2.2]].forEach(function (e, i) {
        var a = e[0].top, h = [11 * c - e[1] * s, 11 * s + e[1] * c, -11.5], q = function (u, v, z) { return new T.Vector3(u, z, -v); };
        var pts = [q(a[0], a[1], a[2]), q(a[0] + (h[0] - a[0]) * 0.1, a[1] + (h[1] - a[1]) * 0.1, a[2] + 2.5), q(a[0] + (h[0] - a[0]) * 0.55, a[1] + (h[1] - a[1]) * 0.55, -13.6), q(h[0], h[1], h[2])];
        sheaths[i].geometry.dispose(); sheaths[i].geometry = new T.TubeGeometry(new T.CatmullRomCurve3(pts), 24, 0.9, 8, false);
      });
    }

    // amber marker on the next empty pocket of every ring that is not full (shown while the lid is open)
    var markers = rings.map(function () {
      var m = new T.Mesh(new T.RingGeometry(2.6, 3.6, 28), new T.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.9, side: T.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 30; m.visible = false; root.add(m); return m;
    });
    // pill bottle held over the marked pocket while refilling (visual only)
    var bottle = new T.Group(), bTilt = new T.Group(); bottle.add(bTilt); bottle.visible = false; bottle.userData.noWire = true; root.add(bottle);
    var bandMat = std(0x888888, { roughness: 0.5 });
    [[new T.CylinderGeometry(5.5, 5.5, 18, 28), std(0xf3f6fa, { transparent: true, opacity: 0.5, roughness: 0.3, depthWrite: false }), 11],
     [new T.CylinderGeometry(3.7, 3.7, 3, 20), std(0xe0a43a, { roughness: 0.5 }), 0.5],
     [new T.CylinderGeometry(5.65, 5.65, 7, 28), bandMat, 12]].forEach(function (e) { var m = new T.Mesh(e[0], e[1]); m.rotation.z = Math.PI / 2; m.position.x = e[2]; bTilt.add(m); });

    // ---------- state shared by the dispense mapping and the refill tasks ----------
    var arm = { theta: PARK, carr: rp[0], pin: 0 }, rec = null, cup = [], tasks = [], task = null, last = 0;
    function delta(k) { return TOOTH / 2 + PIN_R + 0.05; }
    function norm(a) { while (a < 0) a += TAU; while (a >= TAU) a -= TAU; return a; }
    function thetaFwd(k) { return norm(thL[k] - 8 * P - delta(k) / rp[k]); }
    function thetaRev(k) { return norm(thL[k] - 8 * P + delta(k) / rp[k]); }
    function applyArm() {
      armG.rotation.y = arm.theta; carG.position.x = arm.carr;
      pinG.position.y = PINZ.retracted_z + (PINZ.engaged_z - PINZ.retracted_z) * arm.pin - PIN_LEN;
      var L = Math.max(1, arm.carr - 4.5 - 10.5); [wireA, wireB].forEach(function (w) { w.scale.x = L; w.position.x = 10.5 + L / 2; });
      sv1.horn.rotation.y = -(arm.carr - rp[0]) / (rp[3] - rp[0]) * 2.4; sv2.horn.rotation.y = -arm.pin * 0.7;
      updateSheaths();
    }
    function applyRings(selColor) {
      rings.forEach(function (r) {
        r.lift += (r.liftT - r.lift) * 0.15; if (Math.abs(r.liftT - r.lift) < 0.002) r.lift = r.liftT;
        r.g.rotation.y = r.A; r.g.position.y = RZ + r.lift * 30;
        // the cage carries the balls at half the ring's turn (rolling without slipping)
        balls[r.k].list.forEach(function (b, i) { var a = r.A / 2 + i * TAU / NB; b.position.set(balls[r.k].rb * Math.cos(a), ZF + TRK + BR, -balls[r.k].rb * Math.sin(a)); });
        rimMats[r.k].emissive = rimMats[r.k].emissive || new T.Color(0); var on = COLORS[r.k] === selColor || r.k === st.sel;
        rimMats[r.k].emissive.setHex(on ? 0x333333 : 0x000000);
        r.pills.forEach(function (p) { if (p.drop > 0 && !p.hold) p.drop = Math.max(0, p.drop - 0.06); placePill(p, r); });
      });
    }
    // pill meshes have their origin on the underside, so every z below is the underside height
    function cupSpot(n) { return [57 + ((n % 3) - 1) * 3.2, CUPV + ((Math.floor(n / 3) % 2) - 0.5) * 4.2, CUP.floor + Math.floor(n / 6) * 3]; }
    function landPill(p) { var spot = cupSpot(cup.length); p.mesh.position.set(spot[0], spot[2], -spot[1]); p.mesh.rotation.set(0, Math.PI, 0); p.mesh.userData.lay(1); cup.push(p); }
    function fallPose(f, tau) {
      var a = 0.12, b = 0.70, x0 = f.u0, zf0 = zf(Math.max(FUN.x0, x0)) + 0.1, spot = cupSpot(cup.length), pos, yaw;
      if (tau < a) { var t = tau / a; pos = [x0, f.v0, lerp(ZF, zf0, t * t)]; yaw = f.yaw0; }
      else if (tau < b) {
        var s = ease((tau - a) / (b - a)), x = lerp(x0, LIP_X, s); pos = [x, lerp(f.v0, CUPV, Math.min(1, s * 1.6)), zf(x) + 0.1]; yaw = lerp(f.yaw0, Math.PI, s);
      } else {
        var u = (tau - b) / (1 - b), zl = zf(LIP_X) + 0.1; pos = [lerp(LIP_X, spot[0], u), lerp(CUPV, spot[1], u), lerp(zl, spot[2], u * u)]; yaw = Math.PI;
      }
      f.p.mesh.position.set(pos[0], pos[2], -pos[1]); f.p.mesh.rotation.set(0, yaw, 0); f.p.mesh.userData.lay(ease((tau - 0.02) / 0.2)); f.p.mesh.visible = true;
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
      arm.theta = PARK; arm.carr = rp[rec.k]; arm.pin = 0; rec = null;
    }
    function dispenseDrive(s) {
      var k = ringOf(s); if (k < 0) return;
      if (!rec) startDispense(s, k);
      var r = rings[rec.k], ph = s.phase, q = s.phaseProgress || 0, e = ease(q), thF = thetaFwd(rec.k), carr = rp[rec.k], th = PARK, pin = 0, adv = 0;
      if (ph === 'DRUM_ROTATE') { rec.sawDrum = true; carr = lerp(rec.carr0, rp[rec.k], e); }
      else if (ph === 'CARRIAGE_APPROACH') { carr = rec.sawDrum ? rp[rec.k] : lerp(rec.carr0, rp[rec.k], e); th = lerp(PARK, thF, e); }
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
    function turnTask(k, dir, f) {
      var r = rings[k], th0 = dir > 0 ? thetaFwd(k) : thetaRev(k), A0;
      enqueue({ dur: 0.75 * f, start: function () { A0 = r.A; }, run: function (q) { var e = ease(q); arm.theta = th0 + dir * e * P; var dA = A0 + dir * e * P - r.A; movePills(r, dA); }, end: function () { r.K += dir; r.A = r.K * P; } });
    }
    function stroke(k, dir, f) {
      f = f || 1; armTo(dir > 0 ? thetaFwd(k) : thetaRev(k), rp[k], 0.55 * f, 0); pinTo(1, 0.22 * f);
      turnTask(k, dir, f);
      pinTo(0, 0.22 * f);
    }
    // a task that expands into more tasks when it runs, so counts and ring angle are read at that moment
    function macro(fn) { enqueue({ dur: 0.001, run: function () {}, start: function () { var rest = tasks; tasks = []; fn(); tasks = tasks.concat(rest); } }); }
    // turn ring k with the pin until its index reaches Kt (forward = towards the exit), then park the arm
    function indexTo(k, Kt, f) {
      var d = mod(Kt - rings[k].K, N); if (d > N / 2) d -= N;
      for (var i = 0; i < Math.abs(d); i++) stroke(k, d > 0 ? 1 : -1, f);
      if (d) armTo(PARK, rp[k], 0.5 * f, 0);
    }
    // before each pill the ring turns the next empty pocket under the open hatch (UL pockets before the exit)
    function stageLoad(k, f) { macro(function () { if (lockV[k] < 0.95) wait(0.45, null); indexTo(k, mod(rings[k].nextM + 1 - UL, N), f); }); }
    // after loading, turn the pills forward until the first one sits right before the exit again
    function stageHome(k, f) { macro(function () { var r = rings[k]; if (r.pills.length) indexTo(k, mod(r.nextM - r.pills.length, N), f); }); }
    // the hatch is aligned with the loading pocket: a bottle comes down over it, tips, one pill drops through the funnel, the bottle lifts away
    function loadDrop(k, quick) {
      var r = rings[k], p = null, ZB0 = LDS.z1 + 8;
      enqueue({ dur: quick ? 0.9 : 1.5, start: function () { bandMat.color.setHex(ctx.accent[COLORS[k]] || 0x888888); bottle.visible = true; p = null; },
        run: function (q) {
          var phi = thLoad[k], up = q < 0.25 ? 1 - ease(q / 0.25) : q < 0.8 ? 0 : ease((q - 0.8) / 0.2);
          var tilt = q < 0.25 ? 0 : q < 0.45 ? ease((q - 0.25) / 0.2) : q < 0.8 ? 1 : 1 - ease((q - 0.8) / 0.2);
          bottle.position.set(rh[k] * Math.cos(phi), ZB0 + 28 * up, -rh[k] * Math.sin(phi)); bottle.rotation.y = phi + Math.PI / 2; bTilt.rotation.z = tilt * 0.62;
          if (!p && q >= 0.45) { p = newPillAt(r); p.off = 0; p.hold = true; p.drop = DROPH; p.lay = 1; r.loading = p; }
          if (p && q >= 0.45) { var f = Math.min(1, (q - 0.45) / 0.3); p.drop = DROPH * (1 - f * f); p.lay = 1 - ease(f); }
        },
        end: function () { bottle.visible = false; if (p) { p.hold = false; p.drop = 0; p.lay = 0; } r.loading = null; pushCounts(); } });
    }
    function loadOne(k, quick) { stageLoad(k, quick ? 0.4 : 0.7); loadDrop(k, quick); }
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
    function wait(dur, start, end) { enqueue({ dur: dur, start: start, run: function () {}, end: end }); }
    function finishSession() { pushCounts(); st.session = false; st.sel = -1; }
    var refill = {
      state: function () {
        var s = host(), k = st.sel, r = k >= 0 ? rings[k] : null, free = idle(s) && !busy(), open = st.lidT > 0;
        return { lid: open, ring: k, counts: rings.map(function (x) { return x.pills.length; }), busy: !free, lifted: false, lidOpen: st.lid > 0.98, lidClosed: st.lidT === 0 && st.lid < 0.02,
          canOpen: free && !open, canClose: free && open, canSelect: free && open,
          canLoad: free && open && Boolean(r) && r.pills.length < CAP, canFill: free && open && Boolean(r) && r.pills.length < CAP, canIndex: false, canLift: false,
          canFillAll: free && rings.some(function (x) { return x.pills.length < CAP; }) };
      },
      openLid: function () { if (!refill.state().canOpen) return false; st.lidT = 1; st.session = true; return true; },
      // picking a ring releases only its lock and opens only its hatch; the previous ring is first turned back so its first pill sits before the exit
      select: function (k) {
        if (!refill.state().canSelect || k < 0 || k >= rings.length) return false;
        var prev = st.sel;
        if (prev >= 0 && prev !== k) { stageHome(prev, 0.5); wait(0.3, function () { st.sel = k; }); } else st.sel = k;
        return true;
      },
      prepare: function () { return refill.state().canLoad; },
      load: function () { if (!refill.state().canLoad) return false; loadOne(st.sel, false); return true; },
      drop: function () { return refill.load(); },
      advance: function () { return false; },
      index: function () { return false; },
      lift: function () { return false; },
      fill: function () {
        if (!refill.state().canFill) return false;
        var k = st.sel, n = CAP - rings[k].pills.length;
        for (var j = 0; j < n; j++) loadOne(k, true);
        return true;
      },
      // one click: open the hatch session if needed, load every ring that is not full (its own lock and hatch only), close the hatch
      fillAll: function () {
        if (!refill.state().canFillAll) return false;
        if (st.lidT === 0) { st.session = true; wait(0.6, function () { st.lidT = 1; }); }
        rings.forEach(function (r) {
          var n = CAP - r.pills.length; if (n <= 0) return;
          wait(0.2, function () { st.sel = r.k; });
          for (var j = 0; j < n; j++) loadOne(r.k, true);
        });
        macro(function () { if (st.sel >= 0) stageHome(st.sel, 0.4); });
        wait(1.0, function () { st.lidT = 0; }, finishSession);
        return true;
      },
      closeLid: function () {
        if (!refill.state().canClose) return false;
        macro(function () { if (st.sel >= 0) stageHome(st.sel, 0.5); });
        wait(1.0, function () { st.lidT = 0; }, finishSession);
        return true;
      }
    };

    // ---------- hatches and ring locks, per-frame update ----------
    function applyLid() {
      st.lid += (st.lidT - st.lid) * 0.12; if (Math.abs(st.lidT - st.lid) < 0.002) st.lid = st.lidT;
      hatches.forEach(function (h, k) {
        var t = (st.lidT > 0 && st.sel === k) || st.showHatch === k ? 1 : 0; h.v += (t - h.v) * 0.12; if (Math.abs(t - h.v) < 0.002) h.v = t;
        h.g.rotation.z = -1.75 * ease(h.v);
      });
    }
    // only the ring being refilled or dispensed is unlocked; every other pad stays down on its rim
    function applyLocks() {
      var open = rec ? rec.k : (st.session ? st.sel : st.show);
      pads.forEach(function (pad, k) { var t = k === open ? 1 : 0; lockV[k] += (t - lockV[k]) * 0.15; if (Math.abs(t - lockV[k]) < 0.002) lockV[k] = t; pad.position.y = pad.userData.y0 + PADUP * lockV[k]; });
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
      sync(s); applyArm(); applyRings(s && s.operation === 'dispense' ? s.selected : null); applyLid(); applyLocks();
      var now2 = Date.now() / 400;
      rings.forEach(function (r, k) {
        var show = st.lidT > 0 && k === st.sel && r.pills.length < CAP, m = markers[k];
        m.visible = show; if (!show) return;
        m.position.set(rc[k] * Math.cos(thLoad[k]), ZF + 0.4, -rc[k] * Math.sin(thLoad[k])); m.scale.setScalar(1.25 + 0.15 * Math.sin(now2)); m.material.opacity = 1;
      });
    }

    // ---------- servo mounts for the wiring harness (pivot = axle-relative shaft position at the parked arm) ----------
    function ringAct() {
      if (!st.active) return null;
      return {
        s1: { pivot: [S1X, S1V], body_dir: [-1, 0], plate_z: [ZB - 1, ZB] },
        s2: { pivot: [S2X, S2V], body_dir: [-1, 0], body_z0: ZB }
      };
    }
    // Mass and tip-over estimate (ASSUMED densities and bought-part masses; the arm's servos and rings count as rotating mass).
    function stability() {
      var RHO = 0.6, RHO_R = 0.8, items = [], MYc = CYa + S.motor_offset_y, th = arm.theta, c = Math.cos(th), s = Math.sin(th);
      function add(m, x, y, z, rot) { items.push({ m: m, x: x, y: y, z: z, rot: Boolean(rot) }); }
      function cyl(r, z0, z1, rho) { return Math.PI * r * r * (z1 - z0) / 1000 * rho; }
      function onArm(x, l) { return [S.axle[0] + x * c - l * s, CYa + x * s + l * c]; }
      add(2 * Math.PI * S.shell_r1 * 3 * (S.lid.z0 - S.base_z1) / 1000 * RHO, S.axle[0], CYa, (S.lid.z0 + S.base_z1) / 2);
      add(cyl(S.base_r, S.base_z0, S.base_z1, RHO), S.axle[0], CYa, (S.base_z0 + S.base_z1) / 2);
      add(cyl(S.platform_r, -3, S.platform_top, RHO), S.axle[0], CYa, 0.35);
      add(cyl(S.lid.r, S.lid.z0, S.lid.z1, RHO), S.axle[0], CYa, (S.lid.z0 + S.lid.z1) / 2);
      add(30, S.axle[0], MYc, (S.motor_body_z0 + S.motor_body_z1) / 2);
      add(10, S.bay_modules.esp[0] + 9, S.bay_modules.esp[2] + 11, S.bay_z0 + 2);
      add(8, S.bay_modules.uln[0] + 12, S.bay_modules.uln[2] + 12, S.bay_z0 + 4);
      add(6, S.axle[0] - 20, CYa - 20, S.bay_z0 + 2);
      add(3, 20, CYa, -12); add(5, 59, CYa - 1.6, -27);
      add(Math.PI * BALLAST.r * BALLAST.r * (BALLAST.z1 - BALLAST.z0) / 1000 * 7.85, S.axle[0], CYa, (BALLAST.z0 + BALLAST.z1) / 2);
      add(9, S1X - 9 + S.axle[0], CYa + S1V, ZB + 11); add(9, S2X - 9 + S.axle[0], CYa + S2V, ZB + 11);
      var pa = onArm(25, 0); add(4, pa[0], pa[1], -9, true);
      rings.forEach(function (r) {
        var tr = R.tracks[r.k], vol = 0;
        vol += 0.8 * WH * TAU * (tr[0] + 0.4) + 0.8 * WH * TAU * (tr[1] - 0.4);
        vol += N * (tr[1] - tr[0] - 2 * RT) * WH * vaneT(r.k, st.q);
        add(vol / 1000 * RHO_R + r.pills.length * 0.25, S.axle[0], CYa, ZF + WH / 2, true);
      });
      add(cup.length * 0.25, 57, CYa - 1.6, -29);
      var M_ = 0, X = 0, Y = 0, Z = 0, rot = 0;
      items.forEach(function (i) { M_ += i.m; X += i.m * i.x; Y += i.m * i.y; Z += i.m * i.z; if (i.rot) rot += i.m; });
      X /= M_; Y /= M_; Z /= M_;
      var F = S.feet, pts = F.angles.map(function (a) { return [S.axle[0] + F.r * Math.cos(a * Math.PI / 180), CYa + F.r * Math.sin(a * Math.PI / 180)]; }), tip = 90;
      pts.forEach(function (p, i) {
        var q = pts[(i + 1) % pts.length], dx = q[0] - p[0], dy = q[1] - p[1], d = (dx * (Y - p[1]) - dy * (X - p[0])) / Math.hypot(dx, dy);
        tip = Math.min(tip, Math.atan2(d, Z - S.table_z) * 180 / Math.PI);
      });
      return { mass: M_, rotating: rot, com: [X, Y, Z], comAboveTable: Z - S.table_z, tip: tip };
    }
    function setActive(on) {
      on = Boolean(on); if (on === st.active) return;
      st.active = on; root.visible = on; lidHost.visible = on; if (ctx.legacy) ctx.legacy(on);
      if (on) { last = 0; applyArm(); applyRings(null); }
      else { st.lidT = 0; st.lid = 0; st.session = false; st.show = -1; st.showHatch = -1; applyLid(); }
      if (ctx.changed) ctx.changed();
    }
    // labels for the parts: constant screen size with a leader line in the main view; the same names are callouts in the system sub-views
    var tagG = new T.Group(); tagG.name = 'ring part labels'; root.add(tagG); var tagItems = [];
    // leader: up to three segments, each along one axis (x, then depth, then height)
    function axisLeader(a, l) {
      var pts = [[a[0], a[1], a[2]], [l[0], a[1], a[2]], [l[0], l[1], a[2]], [l[0], l[1], l[2]]], out = [];
      for (var i = 0; i < 3; i++) if (Math.abs(pts[i][0] - pts[i + 1][0]) + Math.abs(pts[i][1] - pts[i + 1][1]) + Math.abs(pts[i][2] - pts[i + 1][2]) > 1e-9) out.push(new T.Vector3(pts[i][0], pts[i][2], -pts[i][1]), new T.Vector3(pts[i + 1][0], pts[i + 1][2], -pts[i + 1][1]));
      return out;
    }
    function tagLabel(text, kind, a, l) {
      if (ctx.callout) ctx.callout(root, text, kind, a, l);
      var cv = document.createElement('canvas'), c, hex = kind === 'printed' ? 0x4fc3f7 : 0x7ee08a; cv.width = 384; cv.height = 64; c = cv.getContext('2d');
      c.fillStyle = 'rgba(8,15,24,.94)'; c.fillRect(0, 0, 384, 64); c.strokeStyle = '#' + hex.toString(16); c.lineWidth = 3; c.strokeRect(1.5, 1.5, 381, 61);
      c.font = 'bold 28px sans-serif'; c.fillStyle = '#eff8ff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 192, 33, 366);
      var sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }));
      sp.scale.set(0.15, 0.025, 1); sp.position.set(l[0], l[2], -l[1]); sp.renderOrder = 60; sp.name = 'ring label \u00b7 ' + text;
      var ln = new T.LineSegments(new T.BufferGeometry().setFromPoints(axisLeader(a, l)), new T.LineBasicMaterial({ color: hex, transparent: true, depthTest: false }));
      ln.renderOrder = 59; [sp, ln].forEach(function (o) { o.userData.noWire = true; tagG.add(o); });
      tagItems.push({ sprite: sp, line: ln, anchor: new T.Vector3(a[0], a[2], -a[1]), par: tagG, key: null });
    }
    (function () {
      var pol = function (r, phi, z) { return [r * Math.cos(phi), r * Math.sin(phi), z]; }, ca = tagLabel;
      ca('Shaft bushing', 'bought', [0, 0, ZF + WH], [-72, 10, 46]);
      ca('Ball bearings', 'bought', pol(balls[3].rb, Math.PI / 2, ZF + TRK + BR), [-72, 40, 14]);
      ca('Pocket floor', 'printed', pol(R.tracks[3][1] + 0.6, Math.PI * 0.9, ZF), [-72, 70, -8]);
      ca('Ring support track', 'printed', pol(R.tracks[1][1] - 0.2, Math.PI * 0.75, ZF + 0.2), [-72, 40, -2]);
      ca('PTFE liner', 'bought', pol(R.tracks[2][1] + 0.7, Math.PI * 0.6, ZF + 1.2), [-72, 40, 30]);
      ca('Adjustable divider', 'printed', pol(rc[2], thL[2] - 3 * P, RZ + WH), [72, 40, 40]);
      ca('Ring lock pad', 'printed', pol(R.tracks[3][1] - 0.5, LOCK_A, RZ + WH + 1.6), [72, -40, 22]);
      ca('Loading hatch', 'printed', pol(rh[2], thLoad[2], LDS.z1 + 0.8), [-72, -10, LDS.z1 + 22]);
      ca('Fill funnel', 'printed', pol(rh[1], thLoad[1], 36), [-72, -10, 62]);
      ca('Actuator arm', 'printed', pol(26, PARK, ZA1), [72, 40, 4]);
      ca('Engagement pin', 'bought', pol(rp[0], PARK, ZA1 + 3), [-72, 40, -18]);
      ca('Exit funnel', 'printed', [30, 0, zf(30)], [76, 0, -14]);
      ca('Collection cup', 'printed', [58, CUPV, -28], [76, -10, -34]);
      ca('Ring magazine', 'printed', pol(R.tracks[3][1] - 0.4, Math.PI * 0.35, RZ + WH), [72, 70, 56]);
    }());

    // calls for the step-by-step animations of the system views; the controller is not involved
    var demo = {
      free: function () { var s = host(); return idle(s) && !busy() && !st.session; },
      unlock: function (k) { st.show = k; return true; },
      hatch: function (k) { st.showHatch = k; return true; },
      lockOpen: function (k) { return lockV[k] > 0.95; },
      allLocked: function () { return lockV.every(function (v) { return v < 0.02; }); },
      hatchOpen: function (k) { return hatches[k].v > 0.98; },
      allHatchesShut: function () { return hatches.every(function (h) { return h.v < 0.02; }); },
      rodTo: function (k, dir) { armTo(dir > 0 ? thetaFwd(k) : thetaRev(k), rp[k], 0.7, 0); return true; },
      pin: function (v) { pinTo(v, 0.6); return true; },
      turn: function (k, dir) { turnTask(k, dir, 1.3); return true; },
      park: function (k) { armTo(PARK, rp[k], 0.8, 0); return true; },
      // after an unfinished demo: lock everything, close hatches, turn every ring back so its first pill sits before the exit
      reset: function () { st.show = -1; st.showHatch = -1; pinTo(0, 0.3); rings.forEach(function (r) { stageHome(r.k, 0.5); }); armTo(PARK, rp[0], 0.6, 0); }
    };

    return { active: function () { return st.active; }, setLabels: function (on) { tagG.visible = Boolean(on); }, labelsShown: function () { return tagG.visible; }, labelItems: function () { return tagItems; }, setFloor: function (on) { floorG.visible = Boolean(on); }, demo: demo, setActive: setActive, update: update, ringAct: ringAct, refill: refill, stability: stability,
      setPocket: function (q) { st.q = Math.max(0, Math.min(1, Number(q))); applyPocket(); rings.forEach(function (r) { var sl = slack(r.k); r.pills.forEach(function (p) { p.off = Math.max(-sl, Math.min(sl, p.off)); }); }); return st.q; },
      pocket: function () { return { q: st.q, widths: rings.map(function (r) { return Math.round(pocketW(r.k, st.q) * 10) / 10; }), dividers: rings.map(function (r) { return Math.round(vaneT(r.k, st.q) * 10) / 10; }), pills: PILLS.map(function (p) { return p.name + ' ' + p.L + 'x' + p.W; }), assigned: pillOf.slice(), maxLen: rings.map(function (r) { return Math.round(maxLen(r.k) * 10) / 10; }) }; },
      fits: fits,
      // a ring takes another pill model only while it is empty, the mechanism is idle and the pill fits its pockets
      setPill: function (k, i) {
        var r = rings[k]; if (!r || !PILLS[i] || !fits(k, i) || r.pills.length || busy() || st.session || rec) return false;
        pillOf[k] = i; applyPocket(); return true;
      },
      label: function (ph) { return st.active && LABELS[ph] ? LABELS[ph] : null; },
      report: function () { return { active: st.active, pockets: N, rings: rings.map(function (r) { return { k: r.k, K: r.K, pills: r.pills.length, front: frontU(r) }; }), arm: { theta: arm.theta, carr: arm.carr, pin: arm.pin }, cup: cup.length, lid: st.lid, busy: busy(), locks: lockV.slice(), hatches: hatches.map(function (h) { return h.v; }), selected: st.sel }; },
      root: root, constants: { N: N, rc: rc, thL: thL, PARK: PARK, ZF: ZF }
    };
  }
  window.DispenserRingMagazine = { build: build };
}());
