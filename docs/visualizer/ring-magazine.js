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
  var PIN_R = 0.9, PIN_LEN = 11;
  var ORDER = ['PIN_ENGAGE', 'BLADE_PULL_RELEASE', 'STACK_SETTLE', 'BLADE_ISOLATE_CLOSE', 'BLADE_CLOSED_DWELL', 'PIN_LIFT', 'TONGUE_RELEASE', 'PILL_CLEAR', 'TONGUE_RETURN'];
  var DURS = [0.625, 1.01, 0.5, 1.01, 0.3, 0.625, 0.814, 0.5, 0.814];
  var LABELS = {
    DRUM_ROTATE: ['Carriage slides to the selected ring', 'The pin carriage slides along the arm under the deck to the selected ring (push-pull cable from servo S1 on the tray).'],
    CARRIAGE_APPROACH: ['Arm swings to the pin start', 'The stepper turns the arm under the deck until the pin sits below the arc slot, behind a divider of the selected ring.'],
    PIN_ENGAGE: ['Pin rises behind a divider', 'Servo S2 pulls its cable and the pin rises through the deck slot into the pocket behind one divider.'],
    BLADE_PULL_RELEASE: ['Divider pushes the pill', 'The arm swings one pocket pitch; each divider pushes the pill in front of it along the deck.'],
    STACK_SETTLE: ['Pill drops through the exit', 'The front pill passes the leading edge of the single exit slot and falls into the funnel.'],
    BLADE_ISOLATE_CLOSE: ['Pill slides down the funnel', 'The pill slides down the shared funnel while the pin lowers out of the pocket.'],
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

    // loading-window marker (amber) shown while refilling
    var marker = new T.Mesh(new T.RingGeometry(2.6, 3.6, 28), new T.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.9, depthTest: false, side: T.DoubleSide }));
    marker.rotation.x = -Math.PI / 2; marker.renderOrder = 30; marker.visible = false; root.add(marker);
    // pill bottle held over the marked pocket while refilling (visual only)
    var bottle = new T.Group(), bTilt = new T.Group(); bottle.add(bTilt); bottle.visible = false; bottle.userData.noWire = true; root.add(bottle);
    var bandMat = std(0x888888, { roughness: 0.5 });
    [[new T.CylinderGeometry(5.5, 5.5, 18, 28), std(0xf3f6fa, { transparent: true, opacity: 0.5, roughness: 0.3, depthWrite: false }), 11],
     [new T.CylinderGeometry(3.7, 3.7, 3, 20), std(0xe0a43a, { roughness: 0.5 }), 0.5],
     [new T.CylinderGeometry(5.65, 5.65, 7, 28), bandMat, 12]].forEach(function (e) { var m = new T.Mesh(e[0], e[1]); m.rotation.z = Math.PI / 2; m.position.x = e[2]; bTilt.add(m); });

    // ---------- state shared by the dispense mapping and the refill tasks ----------
    var arm = { theta: PARK, carr: rc[0], pin: 0 }, rec = null, cup = [], tasks = [], task = null, last = 0;
    function delta(k) { return vaneT(k, st.q) / 2 + PIN_R + 0.05; }
    function norm(a) { while (a < 0) a += TAU; while (a >= TAU) a -= TAU; return a; }
    function thetaFwd(k) { return norm(thL[k] - 8 * P - delta(k) / rc[k]); }
    function thetaRev(k) { return norm(thL[k] - 8 * P + delta(k) / rc[k]); }
    function applyArm() {
      armG.rotation.y = arm.theta; carG.position.x = arm.carr;
      pinG.position.y = PINZ.retracted_z + (PINZ.engaged_z - PINZ.retracted_z) * arm.pin - PIN_LEN;
      var L = Math.max(1, arm.carr - 4.5 - 10.5); [wireA, wireB].forEach(function (w) { w.scale.x = L; w.position.x = 10.5 + L / 2; });
      sv1.horn.rotation.y = -(arm.carr - rc[0]) / (rc[3] - rc[0]) * 2.4; sv2.horn.rotation.y = -arm.pin * 0.7;
      updateSheaths();
    }
    function applyRings(selColor) {
      rings.forEach(function (r) {
        r.lift += (r.liftT - r.lift) * 0.15; if (Math.abs(r.liftT - r.lift) < 0.002) r.lift = r.liftT;
        r.g.rotation.y = r.A; r.g.position.y = ZF + 0.2 + r.lift * 30;
        rimMats[r.k].emissive = rimMats[r.k].emissive || new T.Color(0); var on = COLORS[r.k] === selColor || r.k === st.sel;
        rimMats[r.k].emissive.setHex(on ? 0x333333 : 0x000000);
        r.pills.forEach(function (p) { if (p.drop > 0 && !p.hold) p.drop = Math.max(0, p.drop - 0.06); placePill(p, r); });
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
    // a bottle comes down over the marked pocket, tips, one pill drops, the bottle lifts away
    function loadDrop(k) {
      var r = rings[k], p = null, ZB0 = ZF + 15;
      enqueue({ dur: 2.0, start: function () { bandMat.color.setHex(ctx.accent[COLORS[k]] || 0x888888); bottle.visible = true; p = null; },
        run: function (q) {
          var phi = r.A + thL[k] - 5.5 * P, up = q < 0.3 ? 1 - ease(q / 0.3) : q < 0.78 ? 0 : ease((q - 0.78) / 0.22);
          var tilt = q < 0.3 ? 0 : q < 0.5 ? ease((q - 0.3) / 0.2) : q < 0.78 ? 1 : 1 - ease((q - 0.78) / 0.22);
          bottle.position.set(rc[k] * Math.cos(phi), ZB0 + 28 * up, -rc[k] * Math.sin(phi)); bottle.rotation.y = phi + Math.PI / 2; bTilt.rotation.z = tilt * 0.62;
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
        return { lid: st.lidT > 0, ring: k, counts: rings.map(function (x) { return x.pills.length; }), busy: !free, lifted: Boolean(r && r.liftT > 0), lidOpen: st.lid > 0.98, lidClosed: st.lidT === 0 && st.lid < 0.02,
          canOpen: free && st.lidT === 0, canClose: free && st.lidT > 0, canSelect: free && st.lidT > 0 && !rings.some(function (x) { return x.liftT > 0; }),
          canLoad: free && st.lidT > 0 && r && r.liftT === 0 && r.pills.length < CAP, canIndex: free && st.lidT > 0 && r && r.liftT === 0 && r.sess && frontU(r) > 1,
          canLift: free && st.lidT > 0 && Boolean(r), canFill: free && st.lidT > 0 && r && r.liftT === 0 && r.pills.length < CAP };
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
      // step-wise refill, one movement per call (used by the step-by-step player)
      prepare: function () {
        if (!refill.state().canLoad) return false;
        var k = st.sel, r = rings[k];
        if (!r.sess) { r.sess = true; r.canon = false; var n = CAP - r.pills.length; for (var i = 0; i < n; i++) stroke(k, -1); }
        armTo(PARK, rc[k], 0.4, 0); return true;
      },
      drop: function () { if (!refill.state().canLoad || !rings[st.sel].sess) return false; loadDrop(st.sel); return true; },
      advance: function () { if (!refill.state().canIndex) return false; var k = st.sel; stroke(k, 1); armTo(PARK, rc[k], 0.5, 0); return true; },
      fill: function () {
        if (!refill.state().canFill) return false;
        var k = st.sel, r = rings[k], n = CAP - r.pills.length;
        if (!r.sess) { r.sess = true; r.canon = false; for (var i = 0; i < n; i++) stroke(k, -1); }
        for (var j = 0; j < n; j++) { armTo(PARK, rc[k], 0.4, 0); loadDrop(k); stroke(k, 1); }
        armTo(PARK, rc[k], 0.5, 0); return true;
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
      st.active = on; root.visible = on; if (ctx.legacy) ctx.legacy(on);
      if (on) { last = 0; applyArm(); applyRings(null); }
      else { st.lidT = 0; st.lid = 0; st.session = false; applyLid(); }
      if (ctx.changed) ctx.changed();
    }
    return {
      active: function () { return st.active; }, setActive: setActive, update: update, ringAct: ringAct, refill: refill, stability: stability,
      setPocket: function (q) { st.q = Math.max(0, Math.min(1, Number(q))); applyPocket(); rings.forEach(function (r) { var sl = slack(r.k); r.pills.forEach(function (p) { p.off = Math.max(-sl, Math.min(sl, p.off)); }); }); return st.q; },
      pocket: function () { return { q: st.q, widths: rings.map(function (r) { return Math.round(pocketW(r.k, st.q) * 10) / 10; }), dividers: rings.map(function (r) { return Math.round(vaneT(r.k, st.q) * 10) / 10; }), pills: PILLS.map(function (p) { return p.name + ' ' + p.L + 'x' + p.W; }) }; },
      label: function (ph) { return st.active && LABELS[ph] ? LABELS[ph] : null; },
      report: function () { return { active: st.active, pockets: N, rings: rings.map(function (r) { return { k: r.k, K: r.K, pills: r.pills.length, front: frontU(r) }; }), arm: { theta: arm.theta, carr: arm.carr, pin: arm.pin }, cup: cup.length, lid: st.lid, busy: busy() }; },
      root: root, constants: { N: N, rc: rc, thL: thL, PARK: PARK, ZF: ZF }
    };
  }
  window.DispenserRingMagazine = { build: build };
}());
