(function () {
  'use strict';
  // Presentation-only restyle: reference-model visuals layered over the canonical component nodes.
  var built = null, failed = false;

  function build(ctx) {
    var T = ctx.THREE, COLORS = ctx.COLORS, DATA = ctx.DATA, root3d = ctx.root3d, componentMap = ctx.componentMap;
    var SRGB = Boolean(ctx.renderer && T.sRGBEncoding !== undefined && ctx.renderer.outputEncoding === T.sRGBEncoding);
    var CAP_OPEN = ctx.CAP_OPEN_RAD || 1.75;
    var RR = 15, CY = 15, ZP = 6.0, EC = 5.7, EO = -5.7, TRAY = -12.5, YC = -54, CR = 5.2, PZ = 6.3, PUP = 5, CZ = 15.2, PIN_Y = -14.8;
    var XA = DATA.station.blade.tip_y_closed_open_mm[0], STROKE = DATA.station.blade.stroke_mm;
    var SPEC = window.DispenserRotationSpec;
    if (!SPEC || !SPEC.g) throw new Error('rotation-spec.js did not load locally.');
    var S = SPEC.g, MY = S.axle[1] + S.motor_offset_y;

    function tint(hex) { var c = new T.Color(hex); if (SRGB) c.convertSRGBToLinear(); return c; }
    function std(hex, o) { o = o || {}; o.color = tint(hex); return new T.MeshStandardMaterial(o); }
    function MT(c, m, r) { return std(c, { metalness: m, roughness: r }); }
    function lineMat(hex) { return new T.LineBasicMaterial({ color: tint(hex) }); }
    function canvasTexture(canvas) { var tex = new T.CanvasTexture(canvas); if (SRGB) tex.encoding = T.sRGBEncoding; return tex; }

    var H = std(0xc9d1da, { transparent: true, opacity: .26, depthWrite: false }), EL = lineMat(0x7a8696);
    var GM = std(0x2f9e9a), BM = std(0xe0a43a), DK = std(0x555d66), SP = std(0x8a8f96);
    var TF = std(0x9fb0c3, { transparent: true, opacity: .8 });
    var M_STEEL = MT(0xb4bcc6, .6, .35), M_DSTEEL = MT(0x59616b, .5, .4), M_BLACK = MT(0x1b1f24, .1, .6), M_WHITE = MT(0xeeeeee, 0, .5);
    var M_COPPER = MT(0xb87333, .5, .45), M_PCB = MT(0x1d7a4a, 0, .6), M_GOLD = MT(0xd4af37, .7, .3), M_BLUE = MT(0x2f5ea8, 0, .5);
    var CM = std(0x1f7a76), FLG = std(0xf4c542), STL = std(0xb8c0c8, { metalness: .5, roughness: .35 });
    var BLADE_EDGE = lineMat(0x6b4a10);
    var HL_HEX = 0xffb300;
    var HR = std(0xc9d1da, { transparent: true, opacity: .5, depthWrite: false }), M_PRINT = std(0x8fb4d9), M_MAG = MT(0xa83279, .7, .3);
    var H2 = std(0xc9d1da, { transparent: true, opacity: .26, depthWrite: false, side: T.DoubleSide });
    var WALL_SOLID = std(0xdde2e8, { roughness: .55, metalness: .05, side: T.DoubleSide }), PLINTH_SOLID = std(0x3b4350, { roughness: .6, metalness: .1, side: T.DoubleSide }), LID_SOLID = std(0xd3d9e1, { roughness: .5, metalness: .05, side: T.DoubleSide });
    if (ctx.renderer) ctx.renderer.localClippingEnabled = true;
    var M_PTFE = MT(0xf2f2ee, 0, .6), M_BEAR = MT(0xc7ced6, .8, .25), M_SHIELD = MT(0x3c434b, .5, .4), M_FLAT = std(0xff8c1a);
    var lidG = null, lidLift = 0;
    // housing look (assembled / transparent / cutaway / exploded) and the exploded layout: how far each assembly lifts along the shaft axis
    var housing = [], housingMode = 'assembled', housingHidden = false, housingSuspended = false, explode = 0, explodeTarget = 0, explodeNodes = [], explodeTags = null, crankLimbs = [];
    var EX = { platform: 16, drum: 36, cart: 45, wall: 152, lid: 170 };
    function ex(name, o) { explodeNodes.push({ name: name, o: o, y0: null }); return o; }
    var rotParts = [], callouts = [], rotSaved = [], rotActive = false, rotSelected = null, rotLabels = false, fadeOpacity = .07, ghostMats = [], rotMats = [], draftEdges = [], draftMat = new T.LineBasicMaterial({ color: tint(0x8a99aa), transparent: true, opacity: .35 });
    // rotation-subsystem tagging (presentation only; canonical component IDs are untouched)
    function rtag(obj, label, kind, piece) { obj.userData.rotationPart = { label: label, kind: kind, piece: piece || label }; rotParts.push(obj); return obj; }
    // part type for the Part types control: 'printed', 'electronic' or 'hardware'; set directly where the part has no rotation tag
    var jobObjs = [];
    function hs(o, solid, kind) { housing.push({ o: o, glass: o.material, solid: solid, kind: kind }); return o; }
    function ptype(o, t) { o.userData.partType = t; return o; }
    function ptypeSince(par, from, t) { for (var i = from; i < par.children.length; i++) ptype(par.children[i], t); }
    function ptypeJob(o, job) { o.userData.partType = 'printed'; o.userData.printJob = job; jobObjs.push(o); return o; }
    function ptypeJobSince(par, from, job) { for (var i = from; i < par.children.length; i++) ptypeJob(par.children[i], job); }
    function tagSince(par, from, label, kind, piece) { for (var i = from; i < par.children.length; i++) rtag(par.children[i], label, kind, piece); }
    // Subsystem 1 has two sub-views: the rotation mechanism and the stepper mount; the stepper belongs to both.
    var VIEW_LABELS = {
      mount: ['Stepper mount', 'M3 screws', 'Housing socket collar', 'Station housing platform', '28BYJ-48 stepper', 'Base tray'],
      housing: ['Cylindrical shell', 'Service lid', 'Base tray', 'Tray foot', 'Station housing platform'],
      compartment: ['Compartment cartridges', 'Slide blades', 'Blade return springs', 'Catch ledges', 'Drum hub + socket decks']
    };
    var activeView = 'rotation', OWN_VIEW = ['Stepper mount', 'Station bracket', 'Pin cam', 'Pin return spring', 'Pin lever', 'Tongue lever', 'Tongue gate', 'Cylindrical shell', 'Service lid', 'Base tray', 'Tray foot', 'M3 screws', 'Housing socket collar', 'Station housing platform', 'Compartment cartridges', 'Slide blades', 'Blade return springs', 'Catch ledges'];
    function viewHas(label) { return activeView === 'rotation' ? OWN_VIEW.indexOf(label) < 0 : VIEW_LABELS[activeView].indexOf(label) >= 0; }
    function inRotationSet(o) { while (o) { var p = o.userData && o.userData.rotationPart; if (p) return !p.label || viewHas(p.label); o = o.parent; } return false; }
    var calloutMap = {};
    function callout(par, label, kind, a, l) {
      var color = kind === 'printed' ? '#4fc3f7' : '#7ee08a', lineHex = kind === 'printed' ? 0x4fc3f7 : 0x7ee08a;
      function face(hot) {
        var cv = document.createElement('canvas'), c;
        cv.width = 384; cv.height = 64; c = cv.getContext('2d');
        c.fillStyle = hot ? 'rgba(74,48,0,.98)' : 'rgba(8,15,24,.9)'; c.fillRect(0, 0, 384, 64);
        c.strokeStyle = hot ? '#ffb300' : color; c.lineWidth = hot ? 6 : 3; c.strokeRect(hot ? 3 : 1.5, hot ? 3 : 1.5, hot ? 378 : 381, hot ? 58 : 61);
        c.font = 'bold 20px sans-serif'; c.fillStyle = hot ? '#ffffff' : '#eff8ff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label + ' \u00b7 ' + kind, 192, 32);
        return canvasTexture(cv);
      }
      var sprite = new T.Sprite(new T.SpriteMaterial({ map: face(false), transparent: true, depthTest: false }));
      sprite.userData.texNormal = sprite.material.map; sprite.userData.texHot = face(true); sprite.userData.partLabel = label;
      sprite.scale.set(24, 4, 1); sprite.position.set(l[0], l[2], -l[1]); sprite.renderOrder = 20;
      var line = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(a[0], a[2], -a[1]), sprite.position.clone()]), new T.LineBasicMaterial({ color: tint(lineHex), transparent: true, depthTest: false }));
      line.renderOrder = 19; (calloutMap[label] = calloutMap[label] || []).push({ sprite: sprite, line: line, lineHex: lineHex });
      [sprite, line].forEach(function (o) { o.name = 'rotation callout \u00b7 ' + label; o.visible = false; o.userData.rotationPart = { callout: true, label: label }; par.add(o); callouts.push(o); });
    }

    function group(name, parent) { var g = new T.Group(); g.name = 'reference look · ' + name; if (parent) parent.add(g); return g; }
    // canonical mm (X right, Y depth, Z up) -> three (x, z, -y)
    function box(x0, x1, y0, y1, z0, z1, m, par) {
      var g = new T.BoxGeometry(x1 - x0, z1 - z0, y1 - y0), o = new T.Mesh(g, m);
      o.position.set((x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2);
      if (m === H || m === TF) o.add(new T.LineSegments(new T.EdgesGeometry(g), EL));
      par.add(o); return o;
    }
    function cylA(par, ax, x, y, z, r, len, m, seg) {
      var g = new T.CylinderGeometry(r, r, len, seg || 20);
      if (ax === 'y') g.rotateX(Math.PI / 2); else if (ax === 'x') g.rotateZ(Math.PI / 2);
      var o = new T.Mesh(g, m); o.position.set(x, z, -y); par.add(o); return o;
    }
    function cylY(par, x, z, y0, y1, r, m, seg) {
      var g = new T.CylinderGeometry(r, r, Math.abs(y1 - y0), seg || 14); g.rotateX(Math.PI / 2);
      var o = new T.Mesh(g, m); o.position.set(x, z, -(y0 + y1) / 2); par.add(o); return o;
    }
    function makeSpring(r, coils, wire, m) {
      var g = new T.Group(); g.userData.len = -1; g.userData.p = [r, coils, wire]; g.add(new T.Mesh(new T.BufferGeometry(), m)); return g;
    }
    // extension spring with an eye at each end: the eyes lie flat around vertical pegs, joined to the coil by short straight legs
    var HOOK_R = .9, HOOK_LEG = .9;
    function makeHookSpring(r, coils, wire, m) {
      var g = makeSpring(r, coils, wire, m), eye = new T.TorusGeometry(HOOK_R, wire * .7, 8, 24), leg = new T.CylinderGeometry(wire * .7, wire * .7, HOOK_LEG, 8);
      eye.rotateX(Math.PI / 2); leg.rotateX(Math.PI / 2);
      g.userData.hooks = true;
      [new T.Mesh(eye, m), new T.Mesh(eye, m), new T.Mesh(leg, m), new T.Mesh(leg, m)].forEach(function (o) { g.add(o); });
      return g;
    }
    function setHookSpring(g, len) {
      var p = g.userData.p, c = p[1], w = p[2], z0 = HOOK_R + HOOK_LEG, blen = len - 2 * z0, N = c * 18, pts = [], i, t, a, m;
      if (blen < .5) return;
      for (i = 0; i <= N; i++) { t = i / N; a = t * c * 2 * Math.PI; pts.push(new T.Vector3(p[0] * Math.cos(a), p[0] * Math.sin(a), z0 + t * blen)); }
      m = g.children[0]; m.geometry.dispose(); m.geometry = new T.TubeGeometry(new T.CatmullRomCurve3(pts), N, w, 6, false);
      g.children[1].position.z = 0; g.children[2].position.z = len;
      g.children[3].position.z = HOOK_R + HOOK_LEG / 2; g.children[4].position.z = len - HOOK_R - HOOK_LEG / 2;
    }
    function setSpring(g, len) {
      if (len < .5 || Math.abs(len - g.userData.len) < .03) return;
      if (g.userData.hooks) { g.userData.len = len; setHookSpring(g, len); return; }
      g.userData.len = len;
      var p = g.userData.p, r = p[0], c = p[1], w = p[2], N = c * 18, pts = [], i, t, a, m;
      for (i = 0; i <= N; i++) { t = i / N; a = t * c * 2 * Math.PI; pts.push(new T.Vector3(r * Math.cos(a), r * Math.sin(a), t * len)); }
      m = g.children[0]; m.geometry.dispose(); m.geometry = new T.TubeGeometry(new T.CatmullRomCurve3(pts), N, w, 6, false);
    }
    var roots = [];
    // Fixed reference-world root (identity frame, same mapping as the reference page).
    var fixedRoot = group('fixed assembly'); roots.push([ctx.fixedGroup, fixedRoot]);
    var scanRoot = group('scanner and electronics'); roots.push([ctx.scannerGroup, scanRoot]);
    var elg = group('electronics deck', scanRoot);
    scanRoot.position.x = S.scanner_dx; elg.position.x = -S.scanner_dx;   // scanner housing moved toward the axle; the electronics group is placed in fixed coordinates
    // rotation-drive parts and their decks live in the fixed (Subsystem 1) tree; the rest of the electronics deck stays with Subsystem 2
    var rotElec = group('rotation drive electronics', fixedRoot);

    // ---- station housing, pill tray, post ----
    // housing platform (printed) and the outlet chute walls beneath it; the boxes live in rotation-spec.js so the print files use the same numbers
    (function () {
      var CYd = S.axle[1];
      S.deck_layers.forEach(function (ly) {
        var sh = new T.Shape(); sh.absarc(0, CYd, S.platform_r, 0, Math.PI * 2, false);
        ly.holes.forEach(function (h) { var q = new T.Path(); q.moveTo(h[0], h[2]); q.lineTo(h[1], h[2]); q.lineTo(h[1], h[3]); q.lineTo(h[0], h[3]); q.closePath(); sh.holes.push(q); });
        var m = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: ly.z1 - ly.z0, bevelEnabled: false, curveSegments: 96 }), H);
        m.rotation.x = -Math.PI / 2; m.position.y = ly.z0; fixedRoot.add(m); rtag(m, 'Station housing platform', 'printed', 'platform'); ex('platform', m);
      });
    }());
    // single exit: the pill drops straight through the deck hole (covered by the tongue gate until it opens), down a short chute and out of the hole in the base tray
    (function () {
      var C = S.chute, th = C.t;
      [[C.x[0] - th, C.x[1] + th, C.y[0] - th, C.y[0]], [C.x[0] - th, C.x[1] + th, C.y[1], C.y[1] + th],
       [C.x[0] - th, C.x[0], C.y[0], C.y[1]], [C.x[1], C.x[1] + th, C.y[0], C.y[1]]].forEach(function (b) {
        ex('platform', rtag(box(b[0], b[1], b[2], b[3], C.z0, C.z1, H, fixedRoot), 'Station housing platform', 'printed', 'platform')); });
    }());
    // printed stepper mount: plate with the boss hole on the drum axle, carried by two columns up to the housing floor
    (function () {
      var ps = new T.Shape(), pb = new T.Path();
      ps.moveTo(-S.plate_x, S.plate_y0); ps.lineTo(S.plate_x, S.plate_y0); ps.lineTo(S.plate_x, S.plate_y1); ps.lineTo(-S.plate_x, S.plate_y1); ps.closePath();
      pb.absarc(S.axle[0], S.axle[1], S.boss_hole_r, 0, Math.PI * 2, true); ps.holes.push(pb);
      [-S.column_x, S.column_x].forEach(function (x) { var sh = new T.Path(); sh.absarc(x, MY, S.screw_hole_r, 0, Math.PI * 2, true); ps.holes.push(sh); });
      var pm = new T.Mesh(new T.ExtrudeGeometry(ps, { depth: S.plate_z1 - S.plate_z0, bevelEnabled: false, curveSegments: 32 }), H);
      pm.rotation.x = -Math.PI / 2; pm.position.y = S.plate_z0; fixedRoot.add(pm); rtag(pm, 'Stepper mount', 'printed', 'plate');
    }());
    [-S.column_x, S.column_x].forEach(function (x) { rtag(box(x - S.column_half, x + S.column_half, MY - S.column_half, MY + S.column_half, S.column_z0, S.column_z1, H, fixedRoot), 'Stepper mount', 'printed', 'columns'); });
    [-S.column_x, S.column_x].forEach(function (x) { rtag(box(x - S.spigot_half, x + S.spigot_half, MY - S.spigot_half, MY + S.spigot_half, S.column_z1, S.spigot_z1, H, fixedRoot), 'Stepper mount', 'printed', 'columns'); });
    // housing: flask-profile wall (3 sectors), base tray with a locating ridge, deck ledge, three screw bosses, DC jack saddle and the service lid
    (function () {
      var CYc = S.axle[1], DEG = Math.PI / 180;
      function slab(shape, z0, z1, mat) {
        var m = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false, curveSegments: 96 }), mat || H);
        m.rotation.x = -Math.PI / 2; m.position.y = z0; fixedRoot.add(m); return m;
      }
      function ringSector(r0, r1, a0, a1, z0, z1) {
        var sh = new T.Shape(); sh.absarc(0, CYc, r1, a0 * DEG, a1 * DEG, false); sh.absarc(0, CYc, r0, a1 * DEG, a0 * DEG, true); sh.closePath();
        return slab(sh, z0, z1);
      }
      function lathe(points, a0, a1, mat) {
        var m = new T.Mesh(new T.LatheGeometry(points, Math.max(12, Math.ceil((a1 - a0) / 3)), (a0 + 90) * DEG, (a1 - a0) * DEG), mat); m.position.set(0, 0, -CYc); fixedRoot.add(m); return m;
      }
      // angular spans of a sector that stay after the windows covering the band [zA, zB] are removed
      function spansFor(a0, a1, zA, zB) {
        var spans = [[a0, a1]];
        S.shell_windows.forEach(function (w) {
          if (w.z0 > zA + 1e-6 || w.z1 < zB - 1e-6) return;
          var lo = w.a - w.half, hi = w.a + w.half, next = [];
          spans.forEach(function (sp) { if (hi <= sp[0] || lo >= sp[1]) next.push(sp); else { if (lo > sp[0]) next.push([sp[0], lo]); if (hi < sp[1]) next.push([hi, sp[1]]); } });
          spans = next;
        });
        return spans;
      }
      // base tray: chamfered disc (the flat bottom and the electronics tray)
      var FH = S.floor_hole, BF = S.feet, RB = S.base_r - 7;
      var bp = [new T.Vector2(RB, S.base_z0), new T.Vector2(S.base_r - S.base_chamfer, S.base_z0), new T.Vector2(S.base_r, S.base_z0 + S.base_chamfer), new T.Vector2(S.base_r, S.base_z1), new T.Vector2(RB, S.base_z1)];
      hs(rtag(lathe(bp, -90, 270, H2), 'Base tray', 'printed', 'base'), PLINTH_SOLID, 'plinth');
      var fs = new T.Shape(), fh = new T.Path(); fs.absarc(0, CYc, RB, 0, Math.PI * 2, false);
      fh.moveTo(FH.x[0], FH.y[0]); fh.lineTo(FH.x[0], FH.y[1]); fh.lineTo(FH.x[1], FH.y[1]); fh.lineTo(FH.x[1], FH.y[0]); fh.closePath(); fs.holes.push(fh);
      hs(rtag(slab(fs, S.base_z0, S.base_z1, H2), 'Base tray', 'printed', 'base'), PLINTH_SOLID, 'plinth');
      BF.angles.forEach(function (a) { hs(rtag(cylA(fixedRoot, 'z', BF.r * Math.cos(a * DEG), CYc + BF.r * Math.sin(a * DEG), S.base_z0 - BF.h / 2, BF.rad, BF.h, H2, 28), 'Tray foot', 'printed', 'foot'), PLINTH_SOLID, 'plinth'); });
      // platform posts: three printed posts from the tray floor to the deck underside, so the product stands with the wall removed
      (function () {
        var PP = S.platform_posts, h = -3.0 - S.base_z1;
        PP.angles.forEach(function (a) { rtag(cylA(fixedRoot, 'z', PP.r * Math.cos(a * DEG), CYc + PP.r * Math.sin(a * DEG), S.base_z1 + h / 2, PP.rad, h, H, 20), 'Base tray', 'printed', 'base'); });
      }());
      // locating ridge inside the wall foot
      var rz0 = S.base_z1, rz1 = S.base_z1 + S.base_ridge[2];
      // the ridge is notched where the wall's screw bosses stand (boss radius + 0.4 mm of clearance)
      var ridgeGap = Math.asin((S.base_screws.boss_r + 0.4) / ((S.base_ridge[0] + S.base_ridge[1]) / 2)) * 180 / Math.PI;
      var ridgeSpans = spansFor(-180, 180, rz0, rz1);
      S.base_screws.angles.forEach(function (a) {
        var c = ((a + 180) % 360 + 360) % 360 - 180, lo0 = c - ridgeGap, hi0 = c + ridgeGap, next = [];
        ridgeSpans.forEach(function (sp) { var lo = Math.max(sp[0], lo0), hi = Math.min(sp[1], hi0); if (hi <= lo) { next.push(sp); return; } if (lo > sp[0]) next.push([sp[0], lo]); if (hi < sp[1]) next.push([hi, sp[1]]); });
        ridgeSpans = next;
      });
      ridgeSpans.forEach(function (sp) { hs(rtag(ringSector(S.base_ridge[0], S.base_ridge[1], sp[0], sp[1], rz0, rz1), 'Base tray', 'printed', 'base'), PLINTH_SOLID, 'plinth'); });
      // wall: flask profile, banded by window heights; each sector is a lathe of the closed wall section
      var OUT = S.housing_outer, WT = S.shell_r1 - S.shell_r0;
      function rOut(z) { for (var i = 0; i + 1 < OUT.length; i++) { var a = OUT[i], b = OUT[i + 1]; if (z >= a[1] - 1e-9 && z <= b[1] + 1e-9) return a[0] + (b[0] - a[0]) * (z - a[1]) / Math.max(1e-9, b[1] - a[1]); } return OUT[OUT.length - 1][0]; }
      function band(zA, zB) {
        var zs = [zA]; OUT.forEach(function (q) { if (q[1] > zA + 1e-6 && q[1] < zB - 1e-6) zs.push(q[1]); }); zs.push(zB);
        var pts = zs.map(function (z) { return new T.Vector2(rOut(z), z); }), i;
        for (i = zs.length - 1; i >= 0; i--) pts.push(new T.Vector2(rOut(zs[i]) - WT, zs[i]));
        pts.push(pts[0].clone()); return pts;
      }
      var zs = [S.shell_z0, S.shell_z1];
      S.shell_windows.forEach(function (w) { zs.push(w.z0, w.z1); });
      zs = zs.filter(function (z, i) { return zs.indexOf(z) === i; }).sort(function (a, b) { return a - b; });
      for (var zi = 0; zi + 1 < zs.length; zi++) {
        S.shell_sectors.forEach(function (sec) {
          spansFor(sec[0], sec[1], zs[zi], zs[zi + 1]).forEach(function (sp) { ex('wall', hs(rtag(lathe(band(zs[zi], zs[zi + 1]), sp[0], sp[1], H2), 'Cylindrical shell', 'printed', 'shell'), WALL_SOLID, 'wall')); });
        });
      }
      // deck ledge: the round deck rests on this ring inside each wall sector
      var LG = S.ledge;
      S.shell_sectors.forEach(function (sec) { ex('wall', rtag(ringSector(LG[0], LG[1], sec[0], sec[1], LG[2], LG[3]), 'Cylindrical shell', 'printed', 'shell')); });
      // three screw bosses on the wall foot; M3 screws go up through the base tray into them
      var BS = S.base_screws;
      BS.angles.forEach(function (a) {
        var bx = BS.r * Math.cos(a * DEG), by = CYc + BS.r * Math.sin(a * DEG);
        ex('wall', rtag(cylA(fixedRoot, 'z', bx, by, (S.shell_z0 + BS.boss_z1) / 2, BS.boss_r, BS.boss_z1 - S.shell_z0, H, 20), 'Cylindrical shell', 'printed', 'shell'));
        rtag(cylA(fixedRoot, 'z', bx, by, S.base_z0 + 1, BS.head_r, 2, M_STEEL, 20), 'M3 screws', 'bought', 'm3base');
        rtag(cylA(fixedRoot, 'z', bx, by, (S.base_z0 + 2 + BS.boss_z1 - 3) / 2, S.m3_r, BS.boss_z1 - 3 - (S.base_z0 + 2), M_STEEL, 14), 'M3 screws', 'bought', 'm3base');
      });
      // USB-C 5 V inlet in the back wall opening, on a printed saddle from the base tray
      var JK = S.jack;
      ex('wall', ptype(rtag(box(JK.xy[0] - JK.w / 2, JK.xy[0] + JK.w / 2, JK.xy[1] - JK.d / 2, JK.xy[1] + JK.d / 2, JK.z0, JK.z1, M_BLACK, elg), 'USB-C inlet 5 V', 'bought', 'jack'), 'electronic'));
      ex('wall', ptype(rtag(cylA(elg, 'y', JK.xy[0], JK.xy[1] + JK.d / 2 + 2, (JK.z0 + JK.z1) / 2, 3.4, 4, M_STEEL, 20), 'USB-C inlet 5 V', 'bought', 'jack'), 'electronic'));
      rtag(box(JK.xy[0] - JK.w / 2, JK.xy[0] + JK.w / 2, JK.xy[1] - JK.d / 2, JK.xy[1] + JK.d / 2, S.base_z1, JK.z0, H, fixedRoot), 'Base tray', 'printed', 'base');
      // service lid: flat top, a lip that locates it in the neck and an engraved ring; it comes off while a cap is open
      lidG = new T.Group(); lidG.name = 'reference look \u00b7 service lid'; fixedRoot.add(lidG);
      var LD = S.lid, lm = std(0x5b87b5, { transparent: true, opacity: .55, roughness: .35, metalness: .15, depthWrite: false });
      function lidPart(shape, z0, z1, m) { var o = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false, curveSegments: 96 }), m); o.rotation.x = -Math.PI / 2; o.position.y = z0; lidG.add(o); rtag(o, 'Service lid', 'printed', 'lid'); return hs(o, LID_SOLID, 'lid'); }
      var ld = new T.Shape(); ld.absarc(0, CYc, LD.r, 0, Math.PI * 2, false);
      var lo = lidPart(ld, LD.z0, LD.z1, lm); lo.add(new T.LineSegments(new T.EdgesGeometry(lo.geometry, 30), EL));
      var lp = new T.Shape(), lph = new T.Path(); lp.absarc(0, CYc, LD.lip_r1, 0, Math.PI * 2, false); lph.absarc(0, CYc, LD.lip_r0, 0, Math.PI * 2, true); lp.holes.push(lph);
      lidPart(lp, LD.lip_z0, LD.z0, lm);
      var lg = new T.Mesh(new T.RingGeometry(LD.groove_r0, LD.groove_r1, 96), std(0x16314f, { roughness: .6 }));
      lg.rotation.x = -Math.PI / 2; lg.position.set(0, LD.z1 + .05, -CYc); lidG.add(lg); rtag(lg, 'Service lid', 'printed', 'lid');
    }());
    // M3 screws fix the motor ears to the plate and columns; a printed collar in the housing platform holds each column spigot
    [-S.column_x, S.column_x].forEach(function (x) {
      rtag(cylA(fixedRoot, 'z', x, MY, (S.m3_head_z0 + S.m3_z0) / 2, S.m3_head_r, S.m3_z0 - S.m3_head_z0, M_STEEL, 20), 'M3 screws', 'bought', 'm3');
      rtag(cylA(fixedRoot, 'z', x, MY, (S.m3_z0 + S.m3_z1) / 2, S.m3_r, S.m3_z1 - S.m3_z0, M_STEEL, 16), 'M3 screws', 'bought', 'm3');
      var cs = new T.Shape(), co = S.collar_half, ch = new T.Path(), so = S.socket_half;
      cs.moveTo(-co, -co); cs.lineTo(co, -co); cs.lineTo(co, co); cs.lineTo(-co, co); cs.closePath();
      ch.moveTo(-so, -so); ch.lineTo(-so, so); ch.lineTo(so, so); ch.lineTo(so, -so); ch.closePath(); cs.holes.push(ch);
      var cm = new T.Mesh(new T.ExtrudeGeometry(cs, { depth: S.socket_z1 - S.column_z1, bevelEnabled: false }), H);
      cm.rotation.x = -Math.PI / 2; cm.position.set(x, S.column_z1, -MY); fixedRoot.add(cm); rtag(cm, 'Housing socket collar', 'printed', 'collar');
    });
    // platform bearing: printed seat + fixed outer race/shield here; inner race and rod turn with the drum below
    function ringMesh(par, x, y, z0, rOut, rIn, h, m) {
      var s = new T.Shape(), p = new T.Path(); s.absarc(0, 0, rOut, 0, Math.PI * 2, false); p.absarc(0, 0, rIn, 0, Math.PI * 2, true); s.holes.push(p);
      var o = new T.Mesh(new T.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 32 }), m);
      o.rotation.x = -Math.PI / 2; o.position.set(x, z0, -y); par.add(o); return o;
    }
    var BZ = S.bearing_z1 - S.bearing_z0;
    ex('platform', rtag(ringMesh(fixedRoot, 0, CY, S.bearing_z0, S.seat_r_low, S.bearing_r_out, 0.15 - S.bearing_z0, M_PRINT), 'Bearing seat', 'printed', 'seat'));
    ex('platform', rtag(ringMesh(fixedRoot, 0, CY, 0.15, S.seat_r_out, S.bearing_r_out, S.bearing_z1 - 0.15, M_PRINT), 'Bearing seat', 'printed', 'seat'));
    ex('platform', rtag(ringMesh(fixedRoot, 0, CY, S.bearing_z0, S.bearing_r_out, 6.6, BZ, M_BEAR), 'Bearing 625ZZ', 'bought', 'bearing'));
    ex('platform', rtag(ringMesh(fixedRoot, 0, CY, S.bearing_z0, 6.6, 4.2, BZ, M_SHIELD), 'Bearing 625ZZ', 'bought', 'bearing'));
    ex('platform', rtag(ringMesh(fixedRoot, 0, CY, S.ring_z0, S.ring_r_out, S.ring_r_in, S.ring_z1 - S.ring_z0, M_PTFE), 'Thrust ring (PTFE)', 'bought', 'ring'));

    // ---- tongue gate (moves with tongueGroup): a plate with a transverse slot near the tail for the tongue lever's crank pin ----
    var tongueRoot = group('tongue assembly');
    var tsh = new T.Shape(); tsh.moveTo(-7, -24); tsh.lineTo(7, -24); tsh.lineTo(7, -1); tsh.lineTo(6, 0); tsh.lineTo(-6, 0); tsh.lineTo(-7, -1); tsh.closePath();
    var tslot = new T.Path(), TSH = S.act.s2.slot_half, TSY = S.act.tongue_slot_y;
    tslot.moveTo(-TSH, TSY - 1.8); tslot.lineTo(-TSH, TSY + 1.8); tslot.lineTo(TSH, TSY + 1.8); tslot.lineTo(TSH, TSY - 1.8); tslot.closePath(); tsh.holes.push(tslot);
    var tgeo = new T.ExtrudeGeometry(tsh, { depth: 1.5, bevelEnabled: false }), tm = new T.Mesh(tgeo, GM);
    tm.rotation.x = -Math.PI / 2; tm.position.y = -1.5; tm.add(new T.LineSegments(new T.EdgesGeometry(tgeo, 25), EL)); tongueRoot.add(tm); rtag(tm, 'Tongue gate', 'printed', 'tgate');
    function makeLimb(w, th, mat, par) { var m = new T.Mesh(new T.BoxGeometry(w, th, 1), mat); par.add(m); return m; }
    function setLimb(m, a, b) {
      var p1 = new T.Vector3(a[0], a[2], -a[1]), p2 = new T.Vector3(b[0], b[2], -b[1]), d = p2.clone().sub(p1), len = d.length();
      if (len < 1e-6) return;
      m.position.copy(p1).add(p2).multiplyScalar(.5); m.scale.set(1, 1, len); m.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), d.normalize());
    }
    // A3144-class hall switch flush with the platform top, under the drum home magnet (0.3 mm gap to the deck)
    ex('platform', rtag(box(S.hall_x[0], S.hall_x[1], S.hall_y[0], S.hall_y[1], S.hall_z0, S.hall_z1, M_BLACK, fixedRoot), 'Hall sensor A3144', 'bought', 'hall'));
    // three bare leads straight down from the body (as bought, about 12 mm); they pass through the platform until the wire exit is designed (R18)
    [-1, 0, 1].forEach(function (k) {
      ex('platform', rtag(cylA(fixedRoot, 'z', (S.hall_x[0] + S.hall_x[1]) / 2 + k * S.hall_lead_pitch, (S.hall_y[0] + S.hall_y[1]) / 2, S.hall_z0 - S.hall_lead_len / 2, S.hall_lead_r, S.hall_lead_len, M_STEEL, 8), 'Hall sensor A3144', 'bought', 'hall'));
    });

    // ---- carriage: the engagement pin rides on the tip of the pin lever (a servo horn) ----
    var PIN = S.act.s1.pin, carRoot = group('pin lever tip'), pinRoot = group('engagement pin', carRoot), pinCoils = [];
    var cone = new T.Mesh(new T.CylinderGeometry(.6, PIN.rod_r, 2, 16), DK); cone.position.y = 1; pinRoot.add(cone);
    var pinRod = new T.Mesh(new T.CylinderGeometry(PIN.rod_r, PIN.rod_r, PIN.rod - 2, 16), DK); pinRod.position.y = 2 + (PIN.rod - 2) / 2; pinRoot.add(pinRod);
    var pinHead = new T.Mesh(new T.CylinderGeometry(PIN.head_r, PIN.head_r, PIN.head_t, 24), DK); pinHead.position.y = PIN.rod + PIN.head_t / 2; pinRoot.add(pinHead);
    for (var ci = 0; ci < 7; ci++) { var coil = new T.Mesh(new T.TorusGeometry(PIN.rod_r + .6, .2, 6, 18), M_STEEL); coil.rotation.x = Math.PI / 2; pinRoot.add(coil); rtag(coil, 'Pin return spring', 'bought', 'pinspring'); pinCoils.push(coil); }

    // ---- actuators: two 9 g micro servos, no links and no springs. The horn arm of each servo is its lever: S1 above the deck turns the pin lever, S2 under the deck turns the tongue lever ----
    var ACT = S.act, SV = ACT.servo, A1 = ACT.s1, A2 = ACT.s2, D2R = Math.PI / 180, LEV_DZ = A1.lever_z[0] - 13.5;
    function wrapPi(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
    function leverAt(cfg, vTarget) {
      var P = cfg.pivot, Pp = cfg.pin_parked, a0 = Math.atan2(Pp[1] - P[1], Pp[0] - P[0]), sn = Math.max(-1, Math.min(1, (vTarget - P[1]) / cfg.arm1)), c1 = Math.asin(sn), c2 = Math.PI - c1;
      var p1 = wrapPi(c1 - a0), p2 = wrapPi(c2 - a0), phi = Math.abs(p1) <= Math.abs(p2) ? p1 : p2;
      return { phi: phi, pin: [P[0] + cfg.arm1 * Math.cos(a0 + phi), P[1] + cfg.arm1 * Math.sin(a0 + phi)] };
    }
    // servo body along cfg.body_dir with the output shaft at the pivot; z0 = body bottom, shaftDown: shaft leaves the bottom face
    function servo(cfg, name, label, z0, shaftDown) {
      var g = new T.Group(); g.name = name; g.position.set(cfg.pivot[0], z0, -(cfg.pivot[1] + CY)); g.rotation.y = Math.atan2(cfg.body_dir[1], cfg.body_dir[0]); fixedRoot.add(g);
      var x0 = -SV.shaft_off, x1 = SV.len - SV.shaft_off, hw = SV.w / 2, ez = shaftDown ? 0 : SV.h - 1.5;
      ptype(rtag(box(x0, x1, -hw, hw, 0, SV.h, M_BLUE, g), label, 'bought', 'servo'), 'electronic');
      ptype(rtag(box(x0 - SV.ear, x1 + SV.ear, -hw, hw, ez, ez + 1.5, M_BLUE, g), label, 'bought', 'servo'), 'electronic');
      var shl = shaftDown ? cfg.plate_z[1] - cfg.lever_z[0] : 2.25;
      ptype(rtag(cylA(g, 'z', 0, 0, shaftDown ? -shl / 2 : SV.h + .875, 2.5, shl, M_STEEL, 16), label, 'bought', 'servo'), 'electronic');
      return g;
    }
    function arm(par, vx, vy, hw, z0, z1, mat, label, piece) {
      var len = Math.hypot(vx, vy), tip = hw, m = new T.Mesh(new T.BoxGeometry(len + hw + tip, z1 - z0, 2 * hw), mat), mid = (len + tip - hw) / 2 / len;
      m.position.set(vx * mid, (z0 + z1) / 2, -vy * mid); m.rotation.y = Math.atan2(vy, vx); par.add(m); return rtag(m, label, 'printed', piece);
    }
    function leverGroup(cfg, label, piece, h) {
      var g = new T.Group(); g.position.set(cfg.pivot[0], cfg.lever_z[0], -(cfg.pivot[1] + CY)); fixedRoot.add(g); ex('platform', g);
      var Pp = cfg.pin_parked;
      arm(g, Pp[0] - cfg.pivot[0], Pp[1] - cfg.pivot[1], 2.5, 0, h, M_WHITE, label, piece);
      rtag(cylA(g, 'z', 0, 0, h / 2, 3.8, h, M_WHITE, 24), label, 'printed', piece);
      return g;
    }
    // S1: pin servo hangs upside down from a printed plate that stands on two legs outside the peg sweep; the horn is just above the peg tops
    var s1 = servo(A1, 'micro servo S1', 'Micro servo S1 (pin)', A1.plate_z[1], true); ex('platform', s1);
    (function () {
      var P = A1.pivot, th = Math.atan2(A1.body_dir[1], A1.body_dir[0]), c = Math.cos(th), s = Math.sin(th);
      var g = new T.Group(); g.position.set(P[0], A1.plate_z[0], -(P[1] + CY)); g.rotation.y = th; fixedRoot.add(g); ex('platform', g);
      rtag(box(-SV.shaft_off - .5, SV.len - SV.shaft_off + .5, -SV.w / 2, SV.w / 2, 0, A1.plate_z[1] - A1.plate_z[0], H, g), 'Station bracket', 'printed', 'bracket');
      A1.legs.forEach(function (q) {
        var wx = P[0] + q[0] * c - q[1] * s, wy = P[1] + q[0] * s + q[1] * c;
        rtag(box(wx - A1.leg / 2, wx + A1.leg / 2, wy + CY - A1.leg / 2, wy + CY + A1.leg / 2, S.platform_top, A1.plate_z[0], H, fixedRoot), 'Station bracket', 'printed', 'bracket'); ex('platform', fixedRoot.children[fixedRoot.children.length - 1]);
      });
    }());
    var CAMD = null;
    // pin cam: a post on the deck outside the peg sweep and an arm that holds the pin head down over the pull path, then ramps up toward the release position
    (function () {
      var C = A1.cam, E = [A1.pin_parked[0], A1.pin_parked[1] + CY], Rr = leverAt(A1, A1.pin_parked[1] + A1.release).pin, R = [Rr[0], Rr[1] + CY], py = C.post_v + CY;
      function tagC(o) { rtag(o, 'Pin cam', 'printed', 'cam'); ex('platform', o); return o; }
      tagC(box(E[0] - C.hw, E[0] + C.hw, py - C.post_r, py + C.post_r, S.platform_top, C.z0 + C.t, H, fixedRoot));
      tagC(box(E[0] - C.flange, E[0] + C.flange, py - C.flange, py + C.flange, S.platform_top, S.platform_top + C.flange_t, H, fixedRoot));
      tagC(box(E[0] - C.hw, E[0] + C.hw, py - C.post_r, E[1], C.z0, C.z0 + C.t, H, fixedRoot));
      var d = [R[0] - E[0], R[1] - E[1]], L = Math.hypot(d[0], d[1]), rg = new T.Group(), rh = PIN.head_r, Lr = L - rh, rt = C.ramp_top;
      CAMD = { E: A1.pin_parked, dir: [d[0] / L, d[1] / L], L: L };
      rg.position.set(E[0], 0, -E[1]); rg.rotation.y = Math.atan2(d[1], d[0]); fixedRoot.add(rg); ex('platform', rg);
      // flat pin head: its rim toward the post touches the ramp, so the underside is measured at the rim and rises over Lr
      var sh = new T.Shape(); sh.moveTo(0, C.z0); sh.lineTo(Lr, rt); sh.lineTo(Lr + .6, rt); sh.lineTo(Lr + .6, rt + C.t); sh.lineTo(Lr, rt + C.t); sh.lineTo(0, C.z0 + C.t); sh.closePath();
      var rm = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 2 * C.hw, bevelEnabled: false }), H); rm.position.z = -C.hw; rg.add(rm); tagC(rm);
    }());
    var pl1 = leverGroup(A1, 'Pin lever', 'plever', A1.lever_z[1] - A1.lever_z[0]);
    // S2: tongue servo hangs under the deck from two posts at its ears; the tongue lever (horn arm) carries a crank pin into the tongue slot
    var s2 = servo(A2, 'micro servo S2', 'Micro servo S2 (tongue)', A2.body_z0, false); ex('platform', s2);
    (function () {
      var P = A2.pivot, th = Math.atan2(A2.body_dir[1], A2.body_dir[0]), c = Math.cos(th), s = Math.sin(th), ztop = A2.body_z0 + SV.h;
      [-SV.shaft_off - SV.ear / 2, SV.len - SV.shaft_off + SV.ear / 2].forEach(function (xl) {
        var wx = P[0] + xl * c, wy = P[1] + xl * s;
        ex('platform', rtag(cylA(fixedRoot, 'z', wx, wy + CY, (ztop + -3.0) / 2, A2.post_r, -3.0 - ztop, H, 14), 'Station housing platform', 'printed', 'platform'));
      });
    }());
    var pl2 = leverGroup(A2, 'Tongue lever', 'tlever', A2.lever_z[1] - A2.lever_z[0]);
    rtag(cylA(pl2, 'z', A2.pin_parked[0] - A2.pivot[0], A2.pin_parked[1] - A2.pivot[1], 2.6, 1.5, 5.2, M_STEEL, 14), 'Tongue lever', 'printed', 'tlever');
    // pinZ (0 released .. -5 engaged) is the controller's engage state: the lever swings the pin along the cam, which sets the pin height
    function actuate(sn, e, pinZ) {
      var L1 = leverAt(A1, PIN_Y - CY - sn + A1.release * (1 + (pinZ || 0) / 5)), L2 = leverAt(A2, e - 36), dz = EX.platform * explode;
      pl1.rotation.y = L1.phi; carRoot.position.set(L1.pin[0], LEV_DZ + dz, -(L1.pin[1] + CY)); carRoot.rotation.y = L1.phi;
      // the pin rides the cam: down over the pull path, spring-lifted along the ramp toward the release position
      var cs = Math.max(0, (L1.pin[0] - CAMD.E[0]) * CAMD.dir[0] + (L1.pin[1] - CAMD.E[1]) * CAMD.dir[1]), f = Math.max(0, Math.min(1, (cs - PIN.head_r) / (CAMD.L - PIN.head_r))), tip = PIN.tip_eng + (PIN.tip_rel - PIN.tip_eng) * f;
      pinRoot.position.y = tip - LEV_DZ;
      var cb = A1.lever_z[1] - tip, cl = PIN.rod - cb; pinCoils.forEach(function (c, i) { c.position.y = cb + (i + .5) * cl / pinCoils.length; });
      pl2.rotation.y = L2.phi;
      return L1;
    }
    actuate(0, EC, 0);

    // ---- barcode scanner + electronics deck (presentation only) ----
    function capEl(par, x, y, z0, r, h) { ptype(cylA(par, 'z', x, y, z0 + h / 2, r, h, M_BLACK, 20), 'electronic'); ptype(cylA(par, 'z', x, y, z0 + h + .1, r * .9, .3, M_STEEL, 20), 'electronic'); }
    function diodeX(par, x, y, z) { ptype(cylA(par, 'x', x, y, z, 1.35, 5.2, M_BLACK, 12), 'electronic'); ptype(cylA(par, 'x', x + 2, y, z, 1.4, .8, M_STEEL, 12), 'electronic'); }
    // the barcode reader stands outside the product on the table: foot plate, column, housing
    box(-64, -32, -10, 10, S.table_z, S.table_z + 1.6, M_DSTEEL, scanRoot); box(-50.7, -44.7, -3, 3, S.table_z + 1.6, 24, M_DSTEEL, scanRoot);
    box(-38, -33, -4, 4, 23.8, 25.2, M_DSTEEL, scanRoot);   // bracket from the housing face to the container stage (the demo guide stop)
    ptype(box(-58.4, -37, -6.75, 6.75, 24, 35.8, M_BLACK, scanRoot), 'electronic'); ptype(box(-37.4, -37, -4.5, 4.5, 26, 33, MT(0x4a0f10, .2, .2), scanRoot), 'electronic');
    box(-59.6, -58.4, -2, 2, S.table_z + 1.6, 28, MT(0x8a8f96, 0, .8), scanRoot);
    [-4, 4].forEach(function (dy) { ptype(cylA(scanRoot, 'z', -43.5, dy, 24.6, .9, 1.2, M_STEEL, 10), 'electronic'); });
    // under-base direct-drive stepper on the drum axis (assumed; replaces the right-deck stepper)
    // 28BYJ-48: body centre is offset from the output shaft, which sits on the drum axle
    rtag(cylA(elg, 'z', 0, MY, (S.motor_body_z0 + S.motor_body_z1) / 2, S.motor_body_r, S.motor_body_z1 - S.motor_body_z0, M_STEEL, 40), '28BYJ-48 stepper', 'bought', 'motor-body');
    rtag(box(-S.plate_x, S.plate_x, MY - 3.5, MY + 3.5, S.motor_body_z1 - 1, S.motor_body_z1, M_STEEL, elg), '28BYJ-48 stepper', 'bought', 'motor-body');
    rtag(cylA(elg, 'z', 0, CY, (S.motor_shaft_z0 + S.motor_shaft_z1) / 2, S.motor_shaft_r, S.motor_shaft_z1 - S.motor_shaft_z0, M_DSTEEL, 16), '28BYJ-48 stepper', 'bought', 'motor-shaft');
    // modules are modelled lengthwise (u) and widthwise (v); the packed bay boxes put the length along y... world x = x0 + v, world y = y0 + u
    var MROT = 'y'; // 'y': module length along y; 'x': along x (S.bay_rot)
    function mbox(x0, y0, u0, u1, v0, v1, z0, z1, m) { return MROT === 'y' ? box(x0 + v0, x0 + v1, y0 + u0, y0 + u1, z0, z1, m, elg) : box(x0 + u0, x0 + u1, y0 + v0, y0 + v1, z0, z1, m, elg); }
    function mcyl(x0, y0, u, v, zc, r, h, m, n) { return MROT === 'y' ? cylA(elg, 'z', x0 + v, y0 + u, zc, r, h, m, n) : cylA(elg, 'z', x0 + u, y0 + v, zc, r, h, m, n); }
    function pcbMod(x0, y0, u1, v1, z0, c) { return mbox(x0, y0, 0, u1, 0, v1, z0, z0 + 1.6, MT(c, 0, .6)); }
    function ulnBoard(x0, y0, z0) {
      pcbMod(x0, y0, 25, 35, z0, 0x1b4f9c);
      mbox(x0, y0, 3, 10, 2, 14, z0 + 1.6, z0 + 9.6, M_WHITE); mbox(x0, y0, 9, 16, 18, 32, z0 + 1.6, z0 + 5, M_BLACK);
      [0, 1, 2, 3].forEach(function (i) { mbox(x0, y0, 19, 21, 8 + i * 3.5, 10 + i * 3.5, z0 + 1.6, z0 + 2.8, MT(0xff4040, 0, .4)); });
      mbox(x0, y0, 21.5, 24, 20, 33, z0 + 1.6, z0 + 10.1, M_BLACK);
    }
    function espMini(x0, y0, z0) {
      pcbMod(x0, y0, 23, 18.5, z0, 0x1b1f24);
      mbox(x0, y0, 5, 21, 3, 15.5, z0 + 1.6, z0 + 4.2, M_STEEL); mbox(x0, y0, -.6, 4.6, 6.5, 12, z0 + 1.6, z0 + 4.4, M_STEEL);
      [0, 1, 2, 3, 4, 5, 6, 7].forEach(function (i) { mbox(x0, y0, 2 + i * 2.5, 3.2 + i * 2.5, .4, 1.6, z0 + 1.6, z0 + 2.4, M_GOLD); mbox(x0, y0, 2 + i * 2.5, 3.2 + i * 2.5, 16.9, 18.1, z0 + 1.6, z0 + 2.4, M_GOLD); });
    }
    function buckMod(x0, y0, z0) {
      pcbMod(x0, y0, 22, 17, z0, 0x1f5fbf);
      mbox(x0, y0, 3, 10, 4, 13, z0 + 1.6, z0 + 5.6, M_BLACK); mcyl(x0, y0, 16, 5, z0 + 3.6, 2.2, 4, M_BLACK, 16); mcyl(x0, y0, 16, 12, z0 + 3.6, 2.2, 4, M_BLACK, 16);
      mbox(x0, y0, .6, 2, 1, 16, z0 + 1.6, z0 + 2, M_GOLD); mbox(x0, y0, 20, 21.4, 1, 16, z0 + 1.6, z0 + 2, M_GOLD);
    }
    function mosfet2Mod(x0, y0, z0) {
      pcbMod(x0, y0, 30, 20, z0, 0x2b2b2b);
      [0, 1].forEach(function (i) { mbox(x0, y0, 4 + i * 12, 12 + i * 12, 4, 10, z0 + 1.6, z0 + 5.6, M_BLACK); mbox(x0, y0, 4 + i * 12, 12 + i * 12, 10, 11, z0 + 1.6, z0 + 5.6, M_STEEL); });
      mbox(x0, y0, 3, 27, 14, 19, z0 + 1.6, z0 + 5.6, M_BLUE);
    }
    // ---- electronics tray: four modules on 3 mm standoffs on the base tray, kept together beside the motor ----
    var BZ0 = S.bay_z0, BAY = S.bay_modules;
    var espFrom = elg.children.length; MROT = S.bay_rot.esp; espMini(BAY.esp[0], BAY.esp[2], BZ0); tagSince(elg, espFrom, 'ESP32 controller', 'bought', 'esp'); 
    var ulnFrom = elg.children.length; MROT = S.bay_rot.uln; ulnBoard(BAY.uln[0], BAY.uln[2], BZ0); tagSince(elg, ulnFrom, 'ULN2003 driver board', 'bought', 'uln');
    // four standoffs under every module (printed with the base)
    Object.keys(BAY).forEach(function (k) {
      var b = BAY[k], d = S.standoff_inset;
      [[b[0] + d, b[2] + d], [b[1] - d, b[2] + d], [b[0] + d, b[3] - d], [b[1] - d, b[3] - d]].forEach(function (q) {
        rtag(cylA(fixedRoot, 'z', q[0], q[1], (S.base_z1 + BZ0) / 2, S.standoff_r, BZ0 - S.base_z1, H, 10), 'Base tray', 'printed', 'base');
      });
    });
    rotParts.slice().forEach(function (o) { var pc = o.userData.rotationPart.piece; if (pc === 'motor-body' || pc === 'motor-shaft' || pc === 'uln' || pc === 'esp') rotElec.add(o); });

    // ---- rotating drum hub (rotates with drumGroup; reference drum frame origin = canonical z 0) ----
    var drumRoot = group('drum hub'); roots.push([ctx.drumGroup, drumRoot]);
    drumRoot.position.copy(ctx.drumGroup.worldToLocal(new T.Vector3(0, 0, -CY))); ex('drum', drumRoot);
    // D-shaped profile: circle of radius r cut by a flat at x = flatX
    function dPath(target, r, flatX) {
      var a0 = Math.acos(flatX / r), y0 = r * Math.sin(a0);
      target.moveTo(flatX, y0); target.absarc(0, 0, r, a0, Math.PI * 2 - a0, false); target.lineTo(flatX, y0);
      return target;
    }
    var hs = new T.Shape(); hs.absarc(0, 0, S.hub_r, 0, Math.PI * 2, false); hs.holes.push(dPath(new T.Path(), S.bore_r, S.bore_flat_x));
    var hubGeo = new T.ExtrudeGeometry(hs, { depth: S.hub_z1 - S.hub_z0, bevelEnabled: false, curveSegments: 32 }), hub = new T.Mesh(hubGeo, H);
    hub.rotation.x = -Math.PI / 2; hub.position.y = S.hub_z0; drumRoot.add(hub); rtag(hub, 'Drum hub + socket decks', 'printed', 'hub');
    // one D-flat rod, coupler and bearing inner race turn with the drum (drumRoot origin = canonical (0, 15, 0))
    var rodGeo = new T.ExtrudeGeometry(dPath(new T.Shape(), S.rod_r, S.rod_flat_x), { depth: S.rod_z1 - S.rod_z0, bevelEnabled: false, curveSegments: 32 }), rodMesh = new T.Mesh(rodGeo, M_STEEL);
    rodMesh.rotation.x = -Math.PI / 2; rodMesh.position.y = S.rod_z0; drumRoot.add(rodMesh); rtag(rodMesh, 'D-flat rod 5 mm', 'bought', 'rod');
    rtag(box(S.rod_flat_x, S.rod_flat_x + .08, -1.5, 1.5, S.rod_z0 + 1, S.rod_z1 - 1, M_FLAT, drumRoot), 'D-flat rod 5 mm', 'bought', 'rod');
    rtag(cylA(drumRoot, 'z', 0, 0, (S.coupler_z0 + S.coupler_z1) / 2, S.coupler_r, S.coupler_z1 - S.coupler_z0, M_BLUE, 28), 'Flexible coupler', 'bought', 'coupler');
    // two grub screws per end, 90 degrees apart (+x and +y); they seat flush with the OD
    (function () {
      var inner = S.coupler_r - S.coupler_screw_len;
      [S.coupler_screw_z0, S.coupler_screw_z1].forEach(function (z) {
        ['x', 'y'].forEach(function (ax) {
          var c = inner + S.coupler_screw_len / 2;
          rtag(cylA(drumRoot, ax, ax === 'x' ? c : 0, ax === 'y' ? c : 0, z, S.coupler_screw_r, S.coupler_screw_len, M_STEEL, 16), 'Coupler set screws', 'bought', 'cscrew');
        });
      });
    }());
    rtag(ringMesh(drumRoot, 0, 0, S.bearing_z0, 4.2, S.bearing_r_in, BZ, M_BEAR), 'Bearing 625ZZ', 'bought', 'bearing');

    // ---- cartridge towers ----
    var bs = new T.Shape(); [[0, 5], [0, 5.3], [2.6, 6], [22, 6], [22, 5]].forEach(function (p, i) { if (i) bs.lineTo(p[0], p[1]); else bs.moveTo(p[0], p[1]); });
    var bgeo = new T.ExtrudeGeometry(bs, { depth: 10.5, bevelEnabled: false }); bgeo.rotateY(-Math.PI / 2); bgeo.translate(5.25, 0, 0);
    var Y_AXIS = new T.Vector3(0, 1, 0);
    var palette = {}; DATA.palette.forEach(function (p) { palette[p.id] = p; });
    var towers = {}, towerFrames = [], magnet, deck0, cgByColor = {}, cgBase = {}, clipsByColor = {};
    root3d.updateMatrixWorld(true);
    var SPRING_OFF = -S.peg_blade_y + S.peg_fixed_y; // peg to peg length is blade offset + this
    COLORS.forEach(function (color, i) {
      var station = ctx.stationGroups[color], lift = ctx.cartridgeLiftGroups[color];
      var socket = (DATA.assembly_schedule.socket_frames || []).filter(function (s) { return s.color === color; })[0];
      var angle = socket && isFinite(socket.angle_rad) ? socket.angle_rad : i * Math.PI / 2;
      var qs = station.getWorldQuaternion(new T.Quaternion()), want = new T.Quaternion().setFromAxisAngle(Y_AXIS, angle);
      var corrQ = qs.clone().invert().multiply(want);
      var wantPos = new T.Vector3(RR * Math.sin(angle), 0, RR * Math.cos(angle) - CY), corrP = station.worldToLocal(wantPos.clone());
      var accent = palette[color] ? palette[color].three : 0x8294a5, css = palette[color] ? palette[color].css : '#888888';
      function frameGroup(name, parent) { var g = group(color + ' ' + name, parent); g.position.copy(corrP); g.quaternion.copy(corrQ); return g; }
      var deck = frameGroup('socket deck'), cg = frameGroup('cartridge assembly');
      towerFrames.push({ color: color, station: station, frame: deck, wantPos: wantPos, want: want }); ex('drum', deck);
      towerFrames.push({ color: color + ' (lift)', station: lift, frame: cg, wantPos: wantPos, want: want });
      roots.push([station, deck], [lift, cg]);
      // drum socket deck with its bore
      // one quarter of the round deck: hub circle to the deck circle, meeting the next quarter on the 45-degree diagonal
      var hu = S.hub_r / Math.SQRT2, ou = S.deck_r / Math.SQRT2, dk = new T.Shape();
      dk.moveTo(-ou, S.axle[1] - ou); dk.absarc(0, S.axle[1], S.deck_r, -3 * Math.PI / 4, -Math.PI / 4, false); dk.lineTo(hu, S.axle[1] - hu);
      dk.absarc(0, S.axle[1], S.hub_r, -Math.PI / 4, -3 * Math.PI / 4, true); dk.closePath();
      var dh = new T.Path(); dh.moveTo(-S.deck_hole_x, -S.deck_hole_y); dh.lineTo(-S.deck_hole_x, S.deck_hole_y); dh.lineTo(S.deck_hole_x, S.deck_hole_y); dh.lineTo(S.deck_hole_x, -S.deck_hole_y); dh.closePath(); dk.holes.push(dh);
      var dg = new T.ExtrudeGeometry(dk, { depth: S.deck_t, bevelEnabled: false }), dm = new T.Mesh(dg, H);
      dm.rotation.x = -Math.PI / 2; dm.position.y = S.hub_z0; dm.add(new T.LineSegments(new T.EdgesGeometry(dg, 25), EL)); deck.add(dm); rtag(dm, 'Drum hub + socket decks', 'printed', 'deck' + i);
      if (i === 0) {
        magnet = new T.Mesh(new T.CylinderGeometry(S.magnet_r, S.magnet_r, S.magnet_z1 - S.magnet_z0, 16), M_MAG);
        magnet.position.set(S.magnet_xy[0], (S.magnet_z0 + S.magnet_z1) / 2, -S.magnet_xy[1]); deck.add(magnet); rtag(magnet, 'Home magnet 3x1 mm', 'bought', 'magnet'); deck0 = deck;
        var bossH = S.boss_z1 - (S.hub_z0 + S.deck_t), boss = new T.Mesh(new T.CylinderGeometry(S.boss_r, S.boss_r, bossH, 24), H);
        boss.position.set(S.magnet_xy[0], S.hub_z0 + S.deck_t + bossH / 2, -S.magnet_xy[1]); deck.add(boss); rtag(boss, 'Drum hub + socket decks', 'printed', 'boss');
      }
      // hollow transparent tube with edges
      var sh = new T.Shape(); sh.moveTo(-7.4, -6.2); sh.lineTo(7.4, -6.2); sh.lineTo(7.4, 6.2); sh.lineTo(-7.4, 6.2); sh.closePath();
      var hp = new T.Path(); hp.moveTo(-5.4, -4.2); hp.lineTo(-5.4, 4.2); hp.lineTo(5.4, 4.2); hp.lineTo(5.4, -4.2); hp.closePath(); sh.holes.push(hp);
      var g = new T.ExtrudeGeometry(sh, { depth: 40, bevelEnabled: false }), tube = new T.Mesh(g, H);
      tube.rotation.x = -Math.PI / 2; tube.position.y = ZP; tube.add(new T.LineSegments(new T.EdgesGeometry(g, 25), EL)); cg.add(tube); rtag(tube, 'Compartment cartridges', 'printed', 'cartridge');
      [-1, 1].forEach(function (s) {
        var r = new T.Mesh(new T.BoxGeometry(2, 1, 24.2), H); r.position.set(s * 6.4, 5.5, 5.9);
        r.add(new T.LineSegments(new T.EdgesGeometry(r.geometry), EL)); cg.add(r); rtag(r, 'Compartment cartridges', 'printed', 'cartridge');
      });
      var tag = new T.Mesh(new T.BoxGeometry(8, 12, 1.2), std(accent)); tag.position.set(0, ZP + 34, 6.8); cg.add(tag); rtag(tag, 'Compartment cartridges', 'printed', 'cartridge');
      // blade with top wedge and slotted tab
      var bl = new T.Group(), wd = new T.Mesh(bgeo, BM); wd.add(new T.LineSegments(new T.EdgesGeometry(bgeo), BLADE_EDGE)); bl.add(wd);
      // the tab slot is open at its +y end: the pin leaves it sideways, so no vertical pin motion is needed
      var ts = new T.Shape(); ts.moveTo(-4.5, -24); ts.lineTo(4.5, -24); ts.lineTo(4.5, -18); ts.lineTo(2.5, -18); ts.lineTo(2.5, -22); ts.lineTo(-2.5, -22); ts.lineTo(-2.5, -18); ts.lineTo(-4.5, -18); ts.closePath();
      var tgm = new T.ExtrudeGeometry(ts, { depth: 2.5, bevelEnabled: false }), tab = new T.Mesh(tgm, BM);
      tab.rotation.x = -Math.PI / 2; tab.position.y = 6; tab.add(new T.LineSegments(new T.EdgesGeometry(tgm, 25), BLADE_EDGE)); bl.add(tab);
      bl.position.z = XA; cg.add(bl); rtag(bl, 'Slide blades', 'printed', 'blade');
      // return spring: loops go over a vertical peg on a printed lug (fixed) and a peg on the tab's outer strip (moves with the blade)
      rtag(box(S.spring_x - 1.5, S.spring_x + 1.5, S.peg_fixed_y - 1.2, -6.2, 6, 9, H, cg), 'Compartment cartridges', 'printed', 'cartridge');
      rtag(cylA(cg, 'z', S.spring_x, S.peg_fixed_y, 9 + S.peg_h / 2, S.peg_r, S.peg_h, H, 12), 'Compartment cartridges', 'printed', 'cartridge');
      cylA(bl, 'z', S.spring_x, S.peg_blade_y, 8.5 + S.peg_h / 2, S.peg_r, S.peg_h, BM, 12);
      cylA(bl, 'z', S.spring_x, S.peg_blade_y, 8.5 + S.peg_h + .25, .9, .5, BM, 12);
      rtag(cylA(cg, 'z', S.spring_x, S.peg_fixed_y, 9 + S.peg_h + .25, .9, .5, H, 12), 'Compartment cartridges', 'printed', 'cartridge');
      var sp = makeHookSpring(1.2, 8, .22, SP); sp.position.set(S.spring_x, S.spring_z, -S.peg_fixed_y); cg.add(sp); setSpring(sp, XA + SPRING_OFF); rtag(sp, 'Blade return springs', 'bought', 'bspring');
      // hinged cap plate + knob (hinge pivot at the inner tower edge)
      var cpm = std(accent, { transparent: true, opacity: .85 }), cp = new T.Group();
      var plate = new T.Mesh(new T.BoxGeometry(14.8, 1.5, 12.4), cpm); plate.position.set(0, 0, 6.2);
      var kn = new T.Mesh(new T.CylinderGeometry(3, 3, 4, 20), cpm); kn.position.set(0, 2.75, 6.2);
      cp.position.set(0, 46.75, -6.2); cp.add(plate, kn); cg.add(cp); rtag(cp, 'Compartment cartridges', 'printed', 'cap');
      // tool-free retention: a catch ledge on each cartridge side and a flexure clip on the deck whose hook sits over it
      [-1, 1].forEach(function (sx) {
        function sbox(xa, xb, ya, yb, za, zb, par) { return box(Math.min(sx * xa, sx * xb), Math.max(sx * xa, sx * xb), ya, yb, za, zb, H, par); }
        rtag(sbox(S.tube_half_x, S.ledge_x1, -S.clip_half_y, S.clip_half_y, S.ledge_z0, S.ledge_z1, cg), 'Catch ledges', 'printed', 'ledge');
        [sbox(S.clip_x0, S.clip_x1, -S.clip_half_y, S.clip_half_y, S.hub_z0 + S.deck_t, S.clip_z1, deck), sbox(S.hook_x0, S.clip_x0, -S.clip_half_y, S.clip_half_y, S.hook_z0, S.hook_z1, deck)].forEach(function (cm) {
          rtag(cm, 'Drum hub + socket decks', 'printed', 'clip'); // clips are printed in one piece with the deck
          cm.userData.baseX = cm.position.x; cm.userData.side = sx; (clipsByColor[color] = clipsByColor[color] || []).push(cm);
        });
      });
      var latchMat = std(0xd33a3a), lt = new T.Mesh(new T.BoxGeometry(5, 2.5, 1.5), latchMat); lt.position.set(0, 45, 6.9); cg.add(lt);
      cgByColor[color] = cg; cgBase[color] = cg.position.clone();
      towers[color] = { blade: bl, spring: sp, cap: cp, latchMat: latchMat, latchOpen: false };
    });

    // ---- compartment removal demo (viewer only): the clips flex outward, then the compartment lifts straight up ----
    var rem = { liftT: {}, lift: {}, flexT: 0, flex: 0, color: null, bladeT: 0, blade: 0 };
    function removalTick() {
      var k = .14;
      rem.flex += (rem.flexT - rem.flex) * k; if (Math.abs(rem.flexT - rem.flex) < .002) rem.flex = rem.flexT;
      rem.blade += (rem.bladeT - rem.blade) * k; if (Math.abs(rem.bladeT - rem.blade) < .002) rem.blade = rem.bladeT;
      Object.keys(cgByColor).forEach(function (c) {
        var t = rem.liftT[c] || 0, v = rem.lift[c] || 0;
        v += (t - v) * k; if (Math.abs(t - v) < .002) v = t;
        rem.lift[c] = v; cgByColor[c].position.copy(cgBase[c]); cgByColor[c].position.y += v * S.lift_travel + EX.cart * explode;
        (clipsByColor[c] || []).forEach(function (m) { m.position.x = m.userData.baseX + m.userData.side * S.flex_out * (c === rem.color ? rem.flex : 0); });
      });
    }
    function setRemovalState(st) {
      st = st || {};
      if ('color' in st) rem.color = st.color;
      if ('flex' in st) rem.flexT = st.flex ? 1 : 0;
      if ('blade' in st) rem.bladeT = Math.max(0, Math.min(1, Number(st.blade) || 0));
      if ('lift' in st) Object.keys(cgByColor).forEach(function (c) { rem.liftT[c] = (st.lift && st.color === c) ? 1 : 0; });
    }
    function removalSettled() { return rem.flex === rem.flexT && rem.blade === rem.bladeT && Object.keys(cgByColor).every(function (c) { return (rem.lift[c] || 0) === (rem.liftT[c] || 0); }); }
    function resetRemoval() { rem.flexT = 0; rem.flex = 0; rem.bladeT = 0; rem.blade = 0; Object.keys(cgByColor).forEach(function (c) { rem.liftT[c] = 0; rem.lift[c] = 0; }); removalTick(); }
    // rotation-only view callouts (anchors on the axis stay put while the drum turns)
    callout(fixedRoot, 'Drum hub + socket decks', 'printed', [0, CY, 38], [-42, CY, 46]);
    callout(fixedRoot, 'Thrust ring (PTFE)', 'bought', [-9.2, CY, 3.85], [-42, CY, 12]);
    callout(fixedRoot, 'Bearing 625ZZ', 'bought', [-8, CY, 1.2], [-42, CY, 2]);
    callout(fixedRoot, 'Bearing seat', 'printed', [-10.2, CY, -1], [-42, CY, -8]);
    callout(fixedRoot, 'Stepper mount', 'printed', [-17.5, MY, -9], [-42, MY, -18]);
    callout(fixedRoot, 'D-flat rod 5 mm', 'bought', [0, CY, 30], [42, CY, 34]);
    callout(fixedRoot, 'Hall sensor A3144', 'bought', [S.magnet_xy[0], S.magnet_xy[1], 3.2], [34, S.magnet_xy[1], 14]);
    callout(fixedRoot, 'Coupler set screws', 'bought', [S.coupler_r, CY, S.coupler_screw_z0], [42, CY, -2]);
    callout(fixedRoot, 'Flexible coupler', 'bought', [S.coupler_r, CY, S.coupler_z0], [42, CY, -12]);
    callout(fixedRoot, '28BYJ-48 stepper', 'bought', [14, MY, -42], [42, MY, -44]);
    callout(deck0, 'Home magnet 3x1 mm', 'bought', [S.magnet_xy[0], S.magnet_xy[1], 5.1], [26, -26, 14]);
    callout(elg, 'ULN2003 driver board', 'bought', [5, -6, -31], [32, -6, -18]);
    callout(elg, 'ESP32 controller', 'bought', [25, 22, -29], [44, 22, -18]);
    callout(deck0, 'Compartment cartridges', 'printed', [0, 6.2, 30], [-26, 14, 40]);
    callout(deck0, 'Catch ledges', 'printed', [-S.ledge_x1, 0, 17.4], [-30, -12, 24]);
    callout(fixedRoot, 'Base tray', 'printed', [S.base_r, S.axle[1], (S.base_z0 + S.base_z1) / 2], [S.base_r + 14, S.axle[1], S.base_z0 - 8]);
    callout(fixedRoot, 'Service lid', 'printed', [S.lid.r, S.axle[1], (S.lid.z0 + S.lid.z1) / 2], [S.lid.r + 14, S.axle[1], S.lid.z1 + 8]);
    callout(fixedRoot, 'Cylindrical shell', 'printed', [S.shell_r1, S.axle[1], 20], [S.shell_r1 + 14, S.axle[1], 34]);
    callout(fixedRoot, 'M3 screws', 'bought', [S.column_x, MY, S.m3_head_z0], [S.column_x + 24, MY, S.m3_head_z0 - 6]);
    callout(fixedRoot, 'Station housing platform', 'printed', [S.column_x + 4, MY + 9, -2.3], [S.column_x + 26, MY + 12, -9]);
    callout(fixedRoot, 'Housing socket collar', 'printed', [S.column_x, MY, S.socket_z1], [S.column_x + 24, MY, S.socket_z1 + 12]);

    // rotation dimension overlay: one group at a time, values and endpoints come from rotation-spec.js
    var dimRoots = { fixed: group('rotation dimensions (fixed)', fixedRoot), drum: group('rotation dimensions (drum)', drumRoot) };
    var dimGroups = {}, dimObjs = {};
    SPEC.groups.forEach(function (gr) {
      dimGroups[gr.id] = { fixed: group(gr.id, dimRoots.fixed), drum: group(gr.id, dimRoots.drum) };
      dimGroups[gr.id].fixed.visible = false; dimGroups[gr.id].drum.visible = false;
    });
    function dimSprite(text) {
      function face(hot) {
        var cv = document.createElement('canvas'), c;
        cv.width = 768; cv.height = 96; c = cv.getContext('2d');
        c.fillStyle = hot ? 'rgba(74,48,0,.98)' : 'rgba(8,15,24,.96)'; c.fillRect(0, 0, 768, 96);
        c.strokeStyle = hot ? '#ffb300' : '#c9a0ff'; c.lineWidth = hot ? 9 : 4; c.strokeRect(hot ? 4.5 : 2, hot ? 4.5 : 2, hot ? 759 : 764, hot ? 87 : 92);
        c.font = '700 46px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = hot ? '#ffffff' : '#f4e8ff'; c.fillText(text, 384, 50, 730);
        return canvasTexture(cv);
      }
      var sp = new T.Sprite(new T.SpriteMaterial({ map: face(false), transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }));
      sp.userData.texNormal = sp.material.map; sp.userData.texHot = face(true);
      sp.scale.set(0.2088, 0.0261, 1); sp.renderOrder = 100; return sp;
    }
    SPEC.dims.forEach(function (d) {
      var drum = d.frame === 'drum', ox = drum ? S.axle : [0, 0], holder = dimGroups[d.group][drum ? 'drum' : 'fixed'];
      function P(p) { return new T.Vector3(p[0] - ox[0], p[2], -(p[1] - ox[1])); }
      var a = P(d.a), b = P(d.b), off = new T.Vector3(d.off[0], d.off[2], -d.off[1]), a2 = a.clone().add(off), b2 = b.clone().add(off);
      var line = new T.LineSegments(new T.BufferGeometry().setFromPoints([a, a2, b, b2, a2, b2]), new T.LineBasicMaterial({ color: tint(0xe8c4ff), transparent: true, depthTest: false }));
      line.renderOrder = 29; line.name = 'rotation dimension \u00b7 ' + d.id;
      var label = dimSprite(d.short + ' ' + d.nominal.toFixed(2) + ' mm ' + d.tol);
      label.position.copy(a2.clone().add(b2).multiplyScalar(.5));
      label.name = 'rotation dimension label \u00b7 ' + d.id;
      [line, label].forEach(function (o) { o.userData.rotationPart = { dimension: true }; o.userData.dimensionId = d.id; holder.add(o); });
      dimObjs[d.id] = { line: line, label: label };
    });
    // hover/click highlight of the components a dimension measures, and of the dimension line itself
    var hlSaved = [], hlDimension = null;
    function highlightParts(piecesToLight) {
      hlSaved.forEach(function (r) { r.o.material = r.material; r.hl.dispose(); });
      hlSaved = [];
      if (!piecesToLight || !piecesToLight.length) return;
      rotParts.forEach(function (o) {
        if (piecesToLight.indexOf(o.userData.rotationPart.piece) < 0) return;
        o.traverse(function (m) {
          if (!m.isMesh || !m.material || Array.isArray(m.material)) return;
          var hl = m.material.clone();
          hl.color.copy(tint(HL_HEX)); hl.emissive.copy(tint(HL_HEX)); hl.emissiveIntensity = .5; hl.opacity = Math.max(hl.opacity, .95); hl.transparent = hl.opacity < 1;
          hlSaved.push({ o: m, material: m.material, hl: hl }); m.material = hl;
        });
      });
    }
    function highlightDimension(id) {
      function paint(key, hot) {
        var o = dimObjs[key]; if (!o) return;
        o.line.material.color.copy(tint(hot ? HL_HEX : 0xe8c4ff));
        o.label.material.map = hot ? o.label.userData.texHot : o.label.userData.texNormal;
        o.label.scale.set(hot ? 0.2296 : 0.2088, hot ? 0.0287 : 0.0261, 1); o.label.renderOrder = hot ? 101 : 100;
      }
      if (hlDimension) paint(hlDimension, false);
      hlDimension = id || null;
      if (hlDimension) paint(hlDimension, true);
    }
    // Dimension selection mirrors part-label selection: state lives here and visibility is derived from it.
    var rotSelectedDim = null;
    // Nothing dimension-related is drawn unless Show dimensions is on. When on, a selected part shows exactly the dimensions that measure it, from every group; otherwise the chosen group's.
    var dimsOn = false, dimsGroup = null, groupView = {}, dimById = {};
    SPEC.groups.forEach(function (g) { groupView[g.id] = g.view || 'rotation'; });
    SPEC.dims.forEach(function (d) { dimById[d.id] = d; });
    function dimInView(d) { return groupView[d.group] === activeView || (d.alsoViews || []).indexOf(activeView) >= 0; }
    function partDimensionIds(label) {
      var pcs = [], ids = {};
      rotParts.forEach(function (o) { var q = o.userData.rotationPart; if (q.label === label && q.piece && pcs.indexOf(q.piece) < 0) pcs.push(q.piece); });
      SPEC.dims.forEach(function (d) {
        var hit = (d.pieces || []).some(function (p) { return pcs.indexOf(p) >= 0; }) || (d.features || []).some(function (f) { return pcs.indexOf(featureOwner[f]) >= 0; });
        if (hit && dimInView(d)) ids[d.id] = true;
      });
      return ids;
    }
    function refreshDimensions() {
      var mine = dimsOn && rotSelected && !rotSelectedDim ? partDimensionIds(rotSelected) : null;
      Object.keys(dimGroups).forEach(function (id) {
        var show = dimsOn && (mine ? true : (dimsGroup === 'all' || id === dimsGroup));
        dimGroups[id].fixed.visible = show; dimGroups[id].drum.visible = show;
      });
      Object.keys(dimObjs).forEach(function (key) {
        var keep = dimsOn && dimInView(dimById[key]) && (rotSelectedDim ? key === rotSelectedDim : (mine ? Boolean(mine[key]) : true));
        dimObjs[key].label.visible = keep; dimObjs[key].line.visible = keep;
      });
    }
    // Part labels and the all-dimensions view keep only labels that do not overlap on screen (part names first, then the hovered item).
    var declutterOn = false;
    function declutterLabels(camera, w, h) {
      var idle = !rotSelected && !rotSelectedDim, partsOn = rotActive && rotLabels && idle, dimsAll = rotActive && dimsOn && !rotSelectedDim && (dimsGroup === 'all' || Boolean(rotSelected));
      if (!partsOn && !dimsAll) { if (declutterOn) { declutterOn = false; refreshCallouts(); refreshDimensions(); } return; }
      declutterOn = true;
      var kept = [], v = new T.Vector3(), cam = camera.getWorldPosition(new T.Vector3()), unit = h / (2 * Math.tan(camera.fov * Math.PI / 360));
      function place(o, lw, lh) {
        o.getWorldPosition(v); var d = v.distanceTo(cam), s = o.userData.pxFixed ? 1 : unit / d, x, y;
        lw *= s; lh *= s; v.project(camera); x = (v.x + 1) / 2 * w; y = (1 - v.y) / 2 * h;
        var clash = kept.some(function (k) { return Math.abs(k[0] - x) < (lw + k[2]) / 2 && Math.abs(k[1] - y) < (lh + k[3]) / 2; });
        if (!clash) kept.push([x, y, lw, lh]); return !clash;
      }
      if (partsOn) {
        var names = Object.keys(calloutMap).filter(viewHas);
        if (hlPartLabel && calloutMap[hlPartLabel]) names.unshift(names.splice(names.indexOf(hlPartLabel), 1)[0]);
        names.forEach(function (name) {
          calloutMap[name].forEach(function (c) { var ok = place(c.sprite, 24 + 2, 4 + .6); c.sprite.visible = c.line.visible = ok; });
        });
      }
      if (dimsAll) {
        var mine = rotSelected ? partDimensionIds(rotSelected) : null;
        var order = Object.keys(dimObjs).filter(function (k) { return dimInView(dimById[k]) && (!mine || mine[k]); });
        if (hlDimension && dimObjs[hlDimension]) order.unshift(order.splice(order.indexOf(hlDimension), 1)[0]);
        order.forEach(function (key) {
          var o = dimObjs[key]; o.label.userData.pxFixed = true;
          var ok = place(o.label, .272 * h + 6, .0333 * h + 4); o.label.visible = o.line.visible = ok;
        });
      }
    }
    // one focus at a time: selecting a dimension drops any selected part, and selecting a part drops any selected dimension
    function selectDimension(id) { rotSelectedDim = id || null; if (rotSelectedDim) rotSelected = null; refreshDimensions(); refreshCallouts(); applyFade(); return rotSelectedDim; }
    // hole and bore features: shown amber only while their dimension is highlighted
    var AMBER = new T.MeshBasicMaterial({ color: tint(HL_HEX), transparent: true, opacity: .8, depthTest: false, depthWrite: false });
    var featureObjs = {};
    function feature(id, mesh) { mesh.material = AMBER; mesh.visible = false; mesh.renderOrder = 25; mesh.userData.rotationPart = { feature: true }; featureObjs[id] = mesh; }
    function flatFeature(par, shape, z0, depth) {
      var m = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false, curveSegments: 32 }), AMBER);
      m.rotation.x = -Math.PI / 2; m.position.y = z0; par.add(m); return m;
    }
    feature('bore', flatFeature(drumRoot, dPath(new T.Shape(), S.bore_r, S.bore_flat_x), S.hub_z0, S.hub_z1 - S.hub_z0));
    (function () {
      var hx = S.deck_hole_x, hy = S.deck_hole_y, hole = new T.Shape();
      hole.moveTo(-hx, -hy); hole.lineTo(hx, -hy); hole.lineTo(hx, hy); hole.lineTo(-hx, hy); hole.closePath();
      feature('deck0-hole', flatFeature(deck0, hole, S.hub_z0, S.deck_t));
    }());
    feature('plate-hole', cylA(fixedRoot, 'z', S.axle[0], S.axle[1], (S.plate_z0 + S.plate_z1) / 2, S.boss_hole_r, S.plate_z1 - S.plate_z0, AMBER, 40));
    (function () {
      var screws = new T.Group();
      [-S.column_x, S.column_x].forEach(function (x) { cylA(screws, 'z', x, MY, (S.plate_z0 + S.plate_z1) / 2, S.screw_hole_r, S.plate_z1 - S.plate_z0, AMBER, 24); });
      fixedRoot.add(screws); feature('plate-screws', screws);
    }());
    feature('seat-bore', cylA(fixedRoot, 'z', S.axle[0], S.axle[1], (S.bearing_z0 + S.bearing_z1) / 2, S.bearing_r_out, S.bearing_z1 - S.bearing_z0, AMBER, 40));
    feature('ring-bore', cylA(fixedRoot, 'z', S.axle[0], S.axle[1], (S.ring_z0 + S.ring_z1) / 2, S.ring_r_in, S.ring_z1 - S.ring_z0, AMBER, 48));
    feature('pocket', cylA(deck0, 'z', S.magnet_xy[0], S.magnet_xy[1], (S.magnet_z0 + S.boss_z1) / 2, S.pocket_r, S.boss_z1 - S.magnet_z0, AMBER, 24));
    (function () {
      var bores = new T.Group();
      [[S.rod_z0, S.coupler_z1], [S.coupler_z0, S.motor_shaft_z1]].forEach(function (z) { cylA(bores, 'z', 0, 0, (z[0] + z[1]) / 2, S.rod_r, z[1] - z[0], AMBER, 24); });
      drumRoot.add(bores); feature('coupler-bores', bores);
    }());
    (function () {
      var sockets = new T.Group();
      [-S.column_x, S.column_x].forEach(function (x) { box(x - S.socket_half, x + S.socket_half, MY - S.socket_half, MY + S.socket_half, S.column_z1, S.socket_z1, AMBER, sockets); });
      fixedRoot.add(sockets); feature('column-socket', sockets);
    }());
    // amber highlight of the 4 mm threaded holes through the coupler wall
    (function () {
      var holes = new T.Group(), wall = S.coupler_r - S.rod_r, mid = (S.rod_r + S.coupler_r) / 2;
      [S.coupler_screw_z0, S.coupler_screw_z1].forEach(function (z) {
        ['x', 'y'].forEach(function (ax) { cylA(holes, ax, ax === 'x' ? mid : 0, ax === 'y' ? mid : 0, z, S.coupler_screw_r, wall, AMBER, 16); });
      });
      drumRoot.add(holes); feature('coupler-screw-holes', holes);
    }());
    function highlightFeatures(ids) {
      Object.keys(featureObjs).forEach(function (k) { featureObjs[k].visible = Boolean(ids) && ids.indexOf(k) >= 0; });
    }
    // part-label highlight: the whole part (all its pieces) plus its callout, same behaviour as a dimension
    var hlPartLabel = null;
    function paintCallout(key, hot) {
      (calloutMap[key] || []).forEach(function (c) {
        c.sprite.material.map = hot ? c.sprite.userData.texHot : c.sprite.userData.texNormal;
        c.sprite.scale.set(hot ? 26 : 24, hot ? 4.33 : 4, 1); c.sprite.renderOrder = hot ? 21 : 20;
        c.line.material.color.copy(tint(hot ? HL_HEX : c.lineHex));
      });
    }
    function highlightPartLabel(label) {
      if (hlPartLabel) paintCallout(hlPartLabel, false);
      hlPartLabel = label || null;
      var pieces = [];
      if (hlPartLabel) {
        paintCallout(hlPartLabel, true);
        rotParts.forEach(function (o) { var q = o.userData.rotationPart; if (q.label === hlPartLabel && pieces.indexOf(q.piece) < 0) pieces.push(q.piece); });
      }
      highlightParts(pieces);
    }
    // dimension highlight: its line and label, the specific parts it measures, and any hole it measures (like a part label)
    function highlightDimensionFull(id) {
      var d = id ? SPEC.dims.filter(function (x) { return x.id === id; })[0] : null;
      highlightDimension(id || null); highlightParts(d ? (d.pieces || []) : []); highlightFeatures(d ? (d.features || null) : null);
    }
    function setRotationDimensions(on, groupId) {
      dimsOn = Boolean(on); dimsGroup = groupId;
      selectDimension(null);
      refreshDimensions();
    }
    // ---- commit: numeric corrections for moving frames, then attach and hide default geometry ----
    var tongueTarget = new T.Vector3(0, 0, -EC);
    tongueRoot.position.copy(ctx.tongueGroup.worldToLocal(tongueTarget.clone())); roots.push([ctx.tongueGroup, tongueRoot]); ex('platform', tongueRoot);
    fixedRoot.add(carRoot);   // posed by actuate(): the pin rides on the lever tip
    if (ctx.scannerVisualObjects) ctx.scannerVisualObjects.push(scanRoot);
    [elg, rotElec].forEach(function (g) { g.children.forEach(function (c) { if (c.isMesh && !c.userData.partType && !c.userData.rotationPart && (c.material === M_DSTEEL || (c.material === M_STEEL && c.geometry.type === 'CylinderGeometry' && g === rotElec))) ptype(c, 'hardware'); }); });
    roots.forEach(function (pair) { pair[0].add(pair[1]); });
    root3d.updateMatrixWorld(true);

    var hideSubmeshes = ['lid-unlocker-column', 'lid-unlocker-arm-y', 'lid-unlocker-body', 'lid-unlocker-pin', 'microswitch-body', 'lower-tongue-pull-solenoid-body', 'lower-plunger', 'lower-tongue-moving-carriage', 'lower-tongue-strap', 'stepper-body',
      'stepper-shaft', 'drive-shaft-extension', 'stepper-mount-plate', 'stepper-mount-column-left', 'stepper-mount-column-right'];
    var hidden = 0;
    Object.keys(componentMap).forEach(function (id) {
      var node = componentMap[id];
      node.children.forEach(function (child) {
        if (child.name === node.name + ' geometry' || (child.userData && hideSubmeshes.indexOf(child.userData.submeshId) >= 0)) { child.visible = false; hidden += 1; }
      });
    });

    var report = { hiddenGeometryNodes: hidden, towers: [], tongueRootWorld: null, carriageRootWorld: null, sRGBCompensated: SRGB, capOpenRad: CAP_OPEN };
    towerFrames.forEach(function (item) {
      var p = item.frame.getWorldPosition(new T.Vector3()), q = item.frame.getWorldQuaternion(new T.Quaternion());
      report.towers.push({ frame: item.color, positionError: p.distanceTo(item.wantPos), quaternionError: 1 - Math.abs(q.dot(item.want)) });
    });
    report.tongueRootWorld = tongueRoot.getWorldPosition(new T.Vector3()).toArray();
    report.carriageRootWorld = carRoot.getWorldPosition(new T.Vector3()).toArray();

    // ---- housing look and exploded layout (viewer only; no part is added or changed) ----
    var CUT = null;
    function cutPlanes() {
      if (CUT) return CUT;
      var c = [Math.sin(.72), Math.cos(.72)], a = 55 * Math.PI / 180;
      CUT = [a, -a].map(function (da) {
        var l = [c[0] * Math.cos(da) - c[1] * Math.sin(da), c[0] * Math.sin(da) + c[1] * Math.cos(da)], n = [-l[1], l[0]];
        if (n[0] * c[0] + n[1] * c[1] < 0) n = [l[1], -l[0]];
        return new T.Plane(new T.Vector3(-n[0], 0, -n[1]), -n[1] * CY);   // negative inside the removed wedge, which faces the default camera
      });
      return CUT;
    }
    var housingShell = null;
    function applyHousing() {
      var mode = housingSuspended ? 'transparent' : housingMode, cut = mode === 'cutaway';
      if (!housingShell) { housingShell = []; fixedRoot.traverse(function (o) { var rp = o.userData && o.userData.rotationPart; if (o.isMesh && rp && (rp.label === 'Cylindrical shell' || rp.label === 'Service lid')) housingShell.push(o); }); }
      housingShell.forEach(function (o) { o.visible = !housingHidden; });
      housing.forEach(function (h) { h.o.material = mode === 'transparent' || (mode === 'exploded' && h.kind === 'wall') ? h.glass : h.solid; });
      [WALL_SOLID, LID_SOLID].forEach(function (m) { m.clippingPlanes = cut ? cutPlanes() : null; m.clipIntersection = cut; m.needsUpdate = true; });
    }
    function explodeApply() {
      explodeNodes.forEach(function (n) { if (n.y0 === null) n.y0 = n.o.position.y; n.o.position.y = n.y0 + EX[n.name] * explode; });
      if (explodeTags) explodeTags.visible = explode > .6;
    }
    function explodeTick() {
      if (explode === explodeTarget) return;
      explode += (explodeTarget - explode) * .12;
      if (Math.abs(explodeTarget - explode) < .003) explode = explodeTarget;
      explodeApply();
    }
    function buildExplodeTags() {
      explodeTags = new T.Group(); explodeTags.name = 'reference look \u00b7 exploded labels'; explodeTags.visible = false; fixedRoot.add(explodeTags);
      [['Service lid', 'lifts off', 64.5 + EX.lid], ['Wall sectors \u00d73', 'slide up off the base groove', 4 + EX.wall], ['Cartridges \u00d74', 'with caps, blades, springs', 28 + EX.cart],
       ['Drum hub + round deck', 'slides up the rod', 25 + EX.drum], ['Platform stack', 'tongue, rail block, carriage', 2 + EX.platform], ['Stepper, coupler, rod', 'and mount plate', -30],
       ['Electronics bay', 'boards on standoffs', -45], ['Base plinth', 'feet and wall groove', -56]].forEach(function (t) {
        var sp = printLabelSprite(t[0], t[1], '#4fc3f7', 46); sp.position.set(112, t[2], -CY); explodeTags.add(sp);
      });
    }
    function housingSuspend(on) {
      housingSuspended = on;
      if (on) { explode = 0; explodeTarget = 0; explodeApply(); } else explodeTarget = housingMode === 'exploded' ? 1 : 0;
      applyHousing();
    }
    function setHousingMode(mode) {
      if (['assembled', 'transparent', 'cutaway', 'exploded'].indexOf(mode) < 0) return housingMode;
      housingMode = mode;
      if (mode === 'exploded' && !explodeTags) buildExplodeTags();
      explodeTarget = mode === 'exploded' && !housingSuspended ? 1 : 0;
      clearMainFilter(); applyHousing(); if (!rotActive) applyMainFilter();
      return housingMode;
    }
    function setHousingHidden(on) { housingHidden = Boolean(on); applyHousing(); return housingHidden; }
    applyHousing();

    function update(s) {
      explodeTick();
      removalTick();
      var e = s.tongueEdge, tongueClosed = s.tongueMotion === 'closed' && Math.abs(e - 5.7) < 1e-9;
      actuate(s.carriage, s.tongueEdge, s.pinZ);
      // the upper blade slides straight along its rails by the controller's blade state (open = +z, 10.4 mm); the return spring stretches with it
      COLORS.forEach(function (c) {
        var tw = towers[c], st = s.cartridges && s.cartridges[c]; if (!tw || !st) return;
        var b = tongueClosed ? Math.max(0, Math.min(1, st.blade || 0)) : 0;
        if (c === rem.color) b = Math.max(b, rem.blade);
        var z = XA + STROKE * b;
        if (tw.z !== z) { tw.z = z; tw.blade.position.z = z; setSpring(tw.spring, z + SPRING_OFF); }
      });
    }
    // Ghost everything outside the rotation set; shared state and controller are never touched.
    function setRotationViewCore(on, view) {
      on = Boolean(on);
      if (on && rotActive && view && view !== activeView) { setRotationViewCore(false); rotSelected = null; rotSelectedDim = null; }
      if (on === rotActive) return;
      if (on) activeView = view || 'rotation';
      rotActive = on; resetRemoval();
      if (on) housingSuspend(true);
      if (on) {
        rotSaved = []; ghostMats = []; rotMats = [];
        root3d.traverse(function (o) {
          var rp = o.userData && o.userData.rotationPart;
          if (rp && rp.callout) return;
          if (rp && (rp.feature || rp.dimension || rp.draft)) return;
          if (inRotationSet(o)) {
            if (o.isMesh && o.material && !Array.isArray(o.material)) {
              var own = (o.material === H ? HR : o.material).clone();
              if (activeView === 'mount' && partPieceOf(o) === 'platform') { own.transparent = true; own.opacity = .3; own.depthWrite = false; }
              rotSaved.push({ o: o, material: o.material, ghost: own }); o.material = own;
              rotMats.push({ o: o, mat: own, base: own.opacity, baseTransparent: own.transparent, baseDepthWrite: own.depthWrite });
            }
            return;
          }
          if (o.isLine || o.isSprite) { if (o.visible) { rotSaved.push({ o: o, visible: true }); o.visible = false; } }
          else if (o.isMesh && o.visible && o.material && !Array.isArray(o.material)) {
            var g = o.material.clone(), base = g.opacity === undefined ? 1 : g.opacity; g.transparent = true; g.depthWrite = false;
            rotSaved.push({ o: o, material: o.material, ghost: g }); o.material = g; ghostMats.push({ mat: g, base: base });
            // draft look: faint fill plus an outline of the other parts
            if (o.geometry && o.geometry.type !== 'SphereGeometry' && o.geometry.attributes && o.geometry.attributes.position && o.geometry.attributes.position.count < 4000) {
              var eg = new T.EdgesGeometry(o.geometry, 25);
              if (eg.attributes.position.count) { var ls = new T.LineSegments(eg, draftMat); ls.userData.rotationPart = { draft: true }; o.add(ls); draftEdges.push(ls); }
            }
          }
        });
        refreshCallouts(); applyFade();
      } else {
        highlightPartLabel(null); highlightDimensionFull(null); selectDimension(null);
        rotSaved.forEach(function (r) { if (r.material) { r.o.material = r.material; if (r.ghost) r.ghost.dispose(); } if (r.visible) r.o.visible = true; });
        draftEdges.forEach(function (ls) { if (ls.parent) ls.parent.remove(ls); ls.geometry.dispose(); }); draftEdges = [];
        rotSaved = []; ghostMats = []; rotMats = []; callouts.forEach(function (c) { c.visible = false; }); setRotationDimensions(false);
        housingSuspend(false);
      }
    }
    // ---- print view (viewer only): every printed part on its own, grouped by how it is printed ----
    var printLayout = null, printSel = null, PRINT_JOBS = SPEC.printJobs || [];
    function under(o, anc) { for (; o; o = o.parent) if (o === anc) return true; return false; }
    function printLabelSprite(title, sub, hex, w) {
      var cv = document.createElement('canvas'), c; cv.width = 640; cv.height = 112; c = cv.getContext('2d');
      c.fillStyle = 'rgba(8,15,24,.92)'; c.fillRect(0, 0, 640, 112); c.strokeStyle = hex; c.lineWidth = 5; c.strokeRect(2.5, 2.5, 635, 107);
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffffff'; c.font = 'bold 40px sans-serif'; c.fillText(title, 320, sub ? 36 : 56);
      if (sub) { c.fillStyle = '#c4d2e2'; c.font = '28px sans-serif'; c.fillText(sub, 320, 80); }
      var sp = new T.Sprite(new T.SpriteMaterial({ map: canvasTexture(cv), transparent: true, depthTest: false }));
      sp.scale.set(w, w * 112 / 640, 1); sp.renderOrder = 21; return sp;
    }
    function buildPrintLayout() {
      root3d.updateMatrixWorld(true);
      var group = new T.Group(), jobMats = {}, sections = { one: [], separate: [] }, ink = { one: '#4fc3f7', separate: '#ffb347' };
      group.name = 'reference look · print layout'; group.visible = false;
      function matches(o, job) {
        if (o.userData.printJob) return o.userData.printJob === job.id;
        var p = o.userData.rotationPart;
        return !p || !job.labels.length ? false : !p.callout && !p.feature && !p.dimension && !p.draft && job.labels.indexOf(p.label) >= 0 && (!job.pieces || job.pieces.indexOf(p.piece) >= 0);
      }
      PRINT_JOBS.forEach(function (job) {
        var mat = std(parseInt(job.color.slice(1), 16), { roughness: .6 });
        jobMats[job.id] = mat;
        var insts = job.anchor === 'drum' ? [{ name: '', anchor: ctx.drumGroup }] : job.anchor === 'fixed' ? [{ name: '', anchor: fixedRoot }]
          : job.anchor === 'each' ? rotParts.concat(jobObjs).filter(function (o) { return matches(o, job); }).map(function (o, i) { return { name: String(i + 1), anchor: o }; })
          : COLORS.map(function (c) { return { name: c.charAt(0).toUpperCase() + c.slice(1), anchor: cgByColor[c] }; });
        insts.forEach(function (inst) {
          var roots = rotParts.concat(jobObjs).filter(function (o) { return matches(o, job) && under(o, inst.anchor); });
          if (!roots.length) return;
          var ig = new T.Group(), inv = new T.Matrix4().copy(inst.anchor.matrixWorld).invert();
          ig.name = 'print \u00b7 ' + job.id + (inst.name ? ' \u00b7 ' + inst.name : '');
          roots.forEach(function (o) {
            var cl = o.clone(true), kill = [];
            cl.traverse(function (n) { var rp = n.userData && n.userData.rotationPart; if (n !== cl && rp && (rp.feature || rp.dimension || rp.draft || rp.callout)) kill.push(n); });
            kill.forEach(function (n) { if (n.parent) n.parent.remove(n); });
            cl.traverse(function (n) { n.userData = {}; n.visible = true; if (n.isMesh) n.material = mat; });
            if (job.anchor === 'self' || job.anchor === 'each') { cl.position.set(0, 0, 0); cl.quaternion.identity(); cl.scale.set(1, 1, 1); }
            else new T.Matrix4().multiplyMatrices(inv, o.matrixWorld).decompose(cl.position, cl.quaternion, cl.scale);
            var meshes = []; cl.traverse(function (n) { if (n.isMesh) meshes.push(n); });
            meshes.forEach(function (m) {
              var hasEdges = m.children.some(function (c) { return c.isLineSegments; });
              if (!hasEdges && m.geometry.attributes.position.count < 4000) m.add(new T.LineSegments(new T.EdgesGeometry(m.geometry, 25), EL));
            });
            ig.add(cl);
          });
          if (job.flip) ig.rotation.x = Math.PI;
          ig.updateMatrixWorld(true);
          var box = new T.Box3().setFromObject(ig);
          sections[job.mode].push({ job: job, inst: inst, group: ig, box: box, size: box.getSize(new T.Vector3()) });
        });
      });
      var gap = 9, zCursor = 0, layoutInfo = [], plates = [], rowLabels = [];
      ['one', 'separate'].forEach(function (mode) {
        var rows = [], rowOf = {}, x0 = Infinity, x1 = -Infinity, z = zCursor;
        sections[mode].forEach(function (it) {
          var key = mode === 'one' ? 'one' : it.job.id;
          if (!rowOf[key]) { rowOf[key] = []; rows.push(rowOf[key]); }
          rowOf[key].push(it);
        });
        rows.forEach(function (row, ri) {
          var total = row.reduce(function (n, it) { return n + it.size.x; }, 0) + gap * (row.length - 1), x = -total / 2, rowD = 0;
          row.forEach(function (it) {
            var w = it.size.x, d = it.size.z;
            it.group.position.set(x + w / 2 - (it.box.min.x + it.box.max.x) / 2, -it.box.min.y, 0);
            it.cx = x + w / 2; it.rowTop = z; it.d = d;
            x0 = Math.min(x0, x); x1 = Math.max(x1, x + w); x += w + gap; rowD = Math.max(rowD, d);
            group.add(it.group);
          });
          row.forEach(function (it) { it.cz = z + rowD / 2; it.group.position.z = it.cz - (it.box.min.z + it.box.max.z) / 2; });
          if (mode === 'separate') rowLabels.push({ job: row[0].job, n: row.length, z: z + rowD + 9 });
          z += rowD + (ri < rows.length - 1 ? 18 : 0);
        });
        plates.push({ mode: mode, x0: x0, x1: x1, z0: zCursor, z1: z });
        zCursor = z + 70;
      });
      var allX0 = Math.min(plates[0].x0, plates[1].x0), allX1 = Math.max(plates[0].x1, plates[1].x1), allZ1 = plates[1].z1;
      var dark = std(0x1a2636, { roughness: .9 });
      plates.forEach(function (pl) {
        var pw = pl.x1 - pl.x0 + 20, pd = pl.z1 - pl.z0 + 20, ph = pl.mode === 'one' ? 'PRINT AS ONE PIECE' : 'PRINT SEPARATELY';
        var slab = new T.Mesh(new T.BoxGeometry(pw, 2, pd), dark); slab.position.set((pl.x0 + pl.x1) / 2, -1.01, (pl.z0 + pl.z1) / 2);
        slab.add(new T.LineSegments(new T.EdgesGeometry(slab.geometry), lineMat(ink[pl.mode]))); group.add(slab);
        var prints = sections[pl.mode].length, sub = pl.mode === 'one' ? prints + ' bodies, each one print' : prints + ' small parts, each its own print';
        var title = printLabelSprite(ph, sub, ink[pl.mode], 96); title.position.set((pl.x0 + pl.x1) / 2, 4, pl.z1 + 30); group.add(title);
        layoutInfo.push({ mode: pl.mode, prints: prints });
      });
      var labelSprites = [];
      sections.one.forEach(function (it) {
        var sp = printLabelSprite(it.job.label, 'one piece', ink.one, Math.max(38, Math.min(56, it.size.x + 14)));
        sp.position.set(it.cx, it.size.y + 8, it.cz); sp.userData.job = it.job.id; sp.userData.mode = it.job.mode; group.add(sp); labelSprites.push(sp);
      });
      rowLabels.forEach(function (rl) {
        var sp = printLabelSprite(rl.job.label + ' \u00d7' + rl.n, 'separate parts', ink.separate, 52);
        sp.position.set(0, 3, rl.z); sp.userData.job = rl.job.id; sp.userData.mode = rl.job.mode; group.add(sp); labelSprites.push(sp);
      });
      group.scale.setScalar(.42); // reduced so the whole layout fits the default camera
      group.position.set(-(allX0 + allX1) * .21, 0, -allZ1 * .21);
      return { group: group, jobMats: jobMats, labels: labelSprites, info: layoutInfo };
    }
    function selectPrintJob(id) {
      printSel = id || null;
      if (printLayout) {
        PRINT_JOBS.forEach(function (job) {
          var m = printLayout.jobMats[job.id], faded = Boolean(printSel && printSel !== job.id && printSel !== job.mode);
          m.transparent = faded; m.opacity = faded ? .12 : 1; m.depthWrite = !faded; m.needsUpdate = true;
        });
        printLayout.labels.forEach(function (sp) { sp.material.opacity = printSel && sp.userData.job !== printSel && sp.userData.mode !== printSel ? .25 : 1; });
      }
      if (rotActive) { refreshCallouts(); applyFade(); } else applyMainFilter();
      return printSel;
    }
    // ---- Part types control: fade everything that is not a 3D-printed part, or not an electronic component ----
    var typeFilter = [], layoutOn = false, layoutSaved = [], mainSaved = [], ghostCache = [], ELECTRONIC = SPEC.electronicLabels || [];
    function typeOfObj(o) {
      for (var n = o; n; n = n.parent) {
        var u = n.userData || {}, p = u.rotationPart;
        if (u.partType) return u.partType;
        if (p && !p.callout && !p.feature && !p.dimension && !p.draft && p.label) return p.kind === 'printed' ? 'printed' : (ELECTRONIC.indexOf(p.label) >= 0 ? 'electronic' : 'hardware');
        if (n === elg || n === rotElec) return 'electronic';
      }
      return null;
    }
    function typeOfLabel(label) {
      var hit = rotParts.filter(function (o) { return o.userData.rotationPart.label === label; })[0];
      return hit ? typeOfObj(hit) : null;
    }
    function inJob(o, id) {
      // id is a print job, or 'one' / 'separate' for the whole group
      var jobs = PRINT_JOBS.filter(function (j) { return j.id === id || j.mode === id; });
      if (!jobs.length) return false;
      for (var n = o; n; n = n.parent) {
        var u = n.userData || {}, p = u.rotationPart;
        if (u.printJob) return jobs.some(function (j) { return j.id === u.printJob; });
        if (p && !p.callout && !p.feature && !p.dimension && !p.draft && p.label) return jobs.some(function (j) { return j.labels.indexOf(p.label) >= 0 && (!j.pieces || j.pieces.indexOf(p.piece) >= 0); });
      }
      return false;
    }
    function partFilterMiss(o) {
      var t = typeOfObj(o);
      if (typeFilter.length && typeFilter.indexOf(t) < 0) return true;
      return Boolean(printSel && t === 'printed' && !inJob(o, printSel));
    }
    var ghostOpacity = .07;
    function ghostOf(mat) {
      for (var i = 0; i < ghostCache.length; i++) if (ghostCache[i].src === mat) return ghostCache[i].ghost;
      var g = mat.clone(); g.transparent = true; g.opacity = Math.min(g.opacity === undefined ? 1 : g.opacity, ghostOpacity); g.depthWrite = false;
      ghostCache.push({ src: mat, ghost: g }); return g;
    }
    // how faint the parts outside the Part types filter are (the wiring view uses a fainter ghost so the boards stay clear)
    function setGhostOpacity(v) {
      ghostOpacity = Math.max(0, Math.min(.5, v));
      ghostCache.forEach(function (e) { e.ghost.opacity = Math.min(e.src.opacity === undefined ? 1 : e.src.opacity, ghostOpacity); });
    }
    function clearMainFilter() {
      mainSaved.forEach(function (s) { if (s.material) s.o.material = s.material; else s.o.visible = true; });
      mainSaved = [];
    }
    function applyMainFilter() {
      clearMainFilter();
      if (rotActive || layoutOn || (!typeFilter.length && !printSel)) return;
      root3d.traverse(function (o) {
        var rp = o.userData && o.userData.rotationPart;
        if (rp && rp.callout) return;
        if (printLayout && under(o, printLayout.group)) return;
        if (o.isMesh && o.material && !Array.isArray(o.material)) {
          if (partFilterMiss(o)) { mainSaved.push({ o: o, material: o.material }); o.material = ghostOf(o.material); }
        } else if (o.isLineSegments && o.visible && o.parent && o.parent.isMesh && partFilterMiss(o.parent)) { mainSaved.push({ o: o }); o.visible = false; }
      });
      if (wiring3d && wiring3d.reapply) wiring3d.reapply();
    }
    function setPartFilter(types) {
      typeFilter = (Array.isArray(types) ? types : []).filter(function (t) { return t === 'printed' || t === 'electronic'; });
      if (rotActive) { refreshCallouts(); applyFade(); } else applyMainFilter();
      return typeFilter;
    }
    function electronicList() {
      if (!rotActive) return (SPEC.electronicLabels || []).concat(SPEC.electronicExtras || []);
      return partsList().filter(function (p) { return p.type === 'electronic'; }).map(function (p) { return p.label; });
    }
    function setRotationView(on, view) {
      clearMainFilter();
      setRotationViewCore(on, view);
      if (rotActive) { refreshCallouts(); applyFade(); } else applyMainFilter();
    }
    // print plates: the printed parts laid out by how they are printed (hides the machine while it is on)
    function setPrintLayout(on) {
      on = Boolean(on); if (on === layoutOn) return;
      layoutOn = on;
      if (on) {
        clearMainFilter();
        if (!printLayout) printLayout = buildPrintLayout();
        if (!printLayout.group.parent) root3d.add(printLayout.group);
        root3d.children.forEach(function (ch) { if (ch !== printLayout.group && ch.visible) { layoutSaved.push(ch); ch.visible = false; } });
        printLayout.group.visible = true; selectPrintJob(printSel);
      } else {
        layoutSaved.forEach(function (ch) { ch.visible = true; }); layoutSaved = [];
        if (printLayout) printLayout.group.visible = false;
        if (rotActive) applyFade(); else applyMainFilter();
      }
    }
    function printJobsList() {
      function inView(j) {
        if (!rotActive) return true;
        return rotParts.some(function (o) { var p = o.userData.rotationPart; return j.labels.indexOf(p.label) >= 0 && (!j.pieces || j.pieces.indexOf(p.piece) >= 0) && viewHas(p.label); });
      }
      return PRINT_JOBS.map(function (j) { return { id: j.id, label: j.label, mode: j.mode, qty: j.qty, includes: j.includes, orientation: j.orientation, note: j.note || '', inView: inView(j), partial: rotActive && j.labels.some(function (l) { return !viewHas(l); }) }; });
    }
    // Fade slider: other objects always; rotation parts other than the selected one while a part is selected.
    // a selected dimension keeps its own pieces solid (a hole keeps the part that owns it); the rest fade like unselected parts
    var featureOwner = { bore: 'hub', 'deck0-hole': 'deck0', 'plate-hole': 'plate', 'plate-screws': 'plate', 'seat-bore': 'seat', 'ring-bore': 'ring', pocket: 'boss', 'coupler-bores': 'coupler', 'coupler-screw-holes': 'coupler', 'column-socket': 'columns' };
    function partPieceOf(o) {
      while (o) { var p = o.userData && o.userData.rotationPart; if (p && !p.callout && p.piece) return p.piece; o = o.parent; }
      return null;
    }
    function applyFade() {
      var dim = rotSelectedDim ? SPEC.dims.filter(function (x) { return x.id === rotSelectedDim; })[0] : null, keepPieces = null;
      if (dim) keepPieces = (dim.pieces || []).concat((dim.features || []).map(function (f) { return featureOwner[f]; }));
      ghostMats.forEach(function (e) { e.mat.opacity = Math.min(e.base, fadeOpacity); });
      draftMat.opacity = fadeOpacity <= 0 ? 0 : .3 + .7 * fadeOpacity;
      rotMats.forEach(function (e) {
        var faded = rotSelected ? partLabelOf(e.o) !== rotSelected : (keepPieces ? keepPieces.indexOf(partPieceOf(e.o)) < 0 : false);
        if (!faded && partFilterMiss(e.o)) faded = true;
        var target = faded ? Math.min(e.base, fadeOpacity) : e.base;
        e.mat.opacity = target; e.mat.transparent = target < 1 || e.baseTransparent; e.mat.depthWrite = target >= 1 ? e.baseDepthWrite : false;
      });
    }
    function setRotationFade(v) { fadeOpacity = Math.max(0, Math.min(1, Number(v) || 0)); applyFade(); }
    function partsList() {
      var seen = {}, out = [];
      rotParts.forEach(function (o) { var p = o.userData.rotationPart, key = p.label; if (viewHas(key) && !seen[key]) { seen[key] = true; out.push({ label: p.label, kind: p.kind, type: typeOfObj(o) }); } });
      return out;
    }
    function refreshCallouts() {
      callouts.forEach(function (c) { var lb = c.userData.rotationPart.label; c.visible = rotActive && rotLabels && viewHas(lb) && !rotSelectedDim && (!rotSelected || lb === rotSelected) && (!typeFilter.length || typeFilter.indexOf(typeOfLabel(lb)) >= 0); });
    }
    function selectPart(label) {
      rotSelected = label || null; if (rotSelected) rotSelectedDim = null;
      refreshCallouts(); refreshDimensions(); applyFade();
      return rotSelected;
    }
    function setRotationLabels(on) { rotLabels = Boolean(on); refreshCallouts(); }
    function partLabelOf(o) {
      while (o) { var p = o.userData && o.userData.rotationPart; if (p && !p.callout) return p.label; o = o.parent; }
      return null;
    }
    // 3D wiring harness: built here so it shares the scene; routed on first use (see wiring-3d.js)
    var wiring3d = null;
    function skipForWiring(o) {
      for (var n = o; n; n = n.parent) {
        if (n === ctx.drumGroup || (n.userData && n.userData.identity)) return true;
        if (ctx.cartridgeLiftGroups && Object.keys(ctx.cartridgeLiftGroups).some(function (k) { return ctx.cartridgeLiftGroups[k] === n; })) return true;
      }
      return false;
    }
    // wiring system of an electronic scene part (null for everything else); the reader is the unlabelled electronics in the scanner tree
    function wiringPartGroup(o) {
      var spec = window.DispenserWiringSpec;
      for (var n = o; n; n = n.parent) {
        var p = n.userData && n.userData.rotationPart;
        if (p && p.label) {
          var c = spec.components.filter(function (k) { return p.label === k.viewer_label || p.label.indexOf(k.viewer_label) === 0 || (k.id === 'usbc' && p.label.indexOf('USB-C') === 0); })[0];
          return c ? c.group : null;
        }
        if (n === elg) return null;
        if (n === scanRoot) return typeOfObj(o) === 'electronic' ? 'scanner' : null;
      }
      return null;
    }
    try { if (window.DispenserWiring3D && window.DispenserWiringSpec && window.DispenserWiringModel) { wiring3d = window.DispenserWiring3D.build({ THREE: T, root3d: root3d, W: window.DispenserWiringSpec, S: S, skip: skipForWiring, partGroup: wiringPartGroup }); wiring3d.group.userData.partType = 'electronic'; } }
    catch (error) { wiring3d = null; if (window.console) console.error('Wiring harness not built.', error); }
    var wiringLayout = null;
    try { if (window.DispenserWiringLayout3D && window.DispenserWiring3D && window.DispenserWiringSpec) wiringLayout = window.DispenserWiringLayout3D.build({ THREE: T, root3d: root3d, W: window.DispenserWiringSpec }); }
    catch (error) { wiringLayout = null; if (window.console) console.error('Wiring layout not built.', error); }
    return { wiring: wiring3d, wiringLayout: wiringLayout, setGhostOpacity: setGhostOpacity, cartridgeOffset: function (c) { return cgByColor[c] ? cgByColor[c].position.y - cgBase[c].y : 0; }, setHousingMode: setHousingMode, setHousingHidden: setHousingHidden, housingMode: function () { return housingMode; }, update: update, report: report, removalSettled: removalSettled, printJobs: printJobsList, selectPrintJob: selectPrintJob, setPartFilter: setPartFilter, partFilter: function () { return typeFilter.slice(); }, electronicList: electronicList, setPrintLayout: setPrintLayout, printLayoutOn: function () { return layoutOn; }, selectedPrintJob: function () { return printSel; }, printLayoutInfo: function () { return printLayout ? printLayout.info : null; }, setRotationView: setRotationView, parts: partsList, active: function () { return rotActive; }, select: selectPart, selected: function () { return rotSelected; }, setLabels: setRotationLabels, setFade: setRotationFade, setDimensions: setRotationDimensions, declutter: declutterLabels, highlightDim: highlightDimensionFull, selectDim: selectDimension, selectedDim: function () { return rotSelectedDim; }, highlightLabel: highlightPartLabel, partLabelOf: partLabelOf, view: function () { return activeView; }, viewHas: viewHas, setRemoval: setRemovalState,
      clearance: function (pieceA, pieceB) {
        function boxes(match) { root3d.updateMatrixWorld(true); return rotParts.filter(function (o) { return match(o.userData.rotationPart.piece); }).map(function (o) { return new T.Box3().setFromObject(o); }); }
        var a = boxes(function (p) { return p === pieceA; }), b = boxes(function (p) { return pieceB.test(p); }), gap = Infinity, overlap = 0;
        a.forEach(function (x) { b.forEach(function (y) {
          var dx = Math.max(x.min.x - y.max.x, y.min.x - x.max.x, 0), dz = Math.max(x.min.z - y.max.z, y.min.z - x.max.z, 0), dy = Math.max(x.min.y - y.max.y, y.min.y - x.max.y);
          if (dx === 0 && dz === 0) { gap = Math.min(gap, dy); if (dy < 0) overlap += 1; }
        }); });
        return { pieces: [a.length, b.length], overlappingPairs: overlap, minVerticalGap: gap };
      }, dimsOf: function (groupId) { return SPEC.dims.filter(function (d) { return groupId === 'all' ? dimInView(d) : d.group === groupId; }); } };
  }

  function install(ctx) {
    if (built || failed) return built && built.report;
    try { built = build(ctx); built.update(ctx.initialSnapshot || defaultSnapshot(ctx)); }
    catch (error) { failed = true; built = null; if (window.console) console.error('Reference look not installed; default geometry kept.', error); }
    return built && built.report;
  }
  function defaultSnapshot(ctx) {
    var cartridges = {};
    ctx.COLORS.forEach(function (id) { cartridges[id] = { blade: 0, capAngle: 0, cap: 'locked' }; });
    return { tongueEdge: 5.7, tongueMotion: 'closed', servoAngle: 180, carriage: 0, pinZ: 0, cartridges: cartridges };
  }
  function update(snapshot) {
    if (!built) return;
    try { built.update(snapshot); }
    catch (error) { built = null; failed = true; if (window.console) console.error('Reference look update failed; visuals frozen.', error); }
  }
  window.DispenserReferenceLook = {
    install: install, update: update, report: function () { return built ? built.report : null; },
    setHousingMode: function (m) { return built ? built.setHousingMode(m) : m; }, setHousingHidden: function (b) { return built ? built.setHousingHidden(b) : b; }, housingMode: function () { return built ? built.housingMode() : 'assembled'; },
    setRemovalState: function (st) { if (built) built.setRemoval(st); },
    setGhostOpacity: function (v) { if (built) built.setGhostOpacity(v); },
    cartridgeOffset: function (c) { return built ? built.cartridgeOffset(c) : 0; },
    removalSettled: function () { return built ? built.removalSettled() : true; },
    printJobs: function () { return built ? built.printJobs() : []; },
    selectPrintJob: function (id) { return built ? built.selectPrintJob(id) : null; },
    setPartFilter: function (t) { return built ? built.setPartFilter(t) : []; },
    partFilter: function () { return built ? built.partFilter() : []; },
    electronicList: function () { return built ? built.electronicList() : []; },
    get wiring() { return built ? built.wiring : null; },
    get wiringLayout() { return built ? built.wiringLayout : null; },
    setPrintLayout: function (on) { if (built) built.setPrintLayout(on); },
    printLayoutOn: function () { return Boolean(built && built.printLayoutOn()); },
    selectedPrintJob: function () { return built ? built.selectedPrintJob() : null; },
    printLayoutInfo: function () { return built ? built.printLayoutInfo() : null; },
    setRotationView: function (on, view) { if (built) built.setRotationView(on, view); },
    rotationParts: function () { return built ? built.parts() : []; },
    rotationViewActive: function () { return Boolean(built && built.active()); },
    selectRotationPart: function (label) { return built ? built.select(label) : null; },
    setRotationLabels: function (on) { if (built) built.setLabels(on); },
    setRotationFade: function (v) { if (built) built.setFade(v); },
    setRotationDimensions: function (on, groupId) { if (built) built.setDimensions(on, groupId); },
    highlightRotationDimension: function (id) { if (built) built.highlightDim(id); },
    declutterLabels: function (camera, w, h) { if (built) built.declutter(camera, w, h); },
    selectRotationDimension: function (id) { return built ? built.selectDim(id) : null; },
    selectedRotationDimension: function () { return built ? built.selectedDim() : null; },
    highlightRotationPartLabel: function (label) { if (built) built.highlightLabel(label); },
    rotationDimensionGroups: function () { var v = built ? built.view() : 'rotation'; return window.DispenserRotationSpec ? window.DispenserRotationSpec.groups.filter(function (g) { return (g.view || 'rotation') === v; }) : []; },
    rotationDimensions: function (groupId) { return built ? built.dimsOf(groupId) : []; },
    selectedRotationPart: function () { return built ? built.selected() : null; },
    clearance: function (a, b) { return built ? built.clearance(a, new RegExp(b)) : null; },
    rotationPartLabelOf: function (object) { var label = built ? built.partLabelOf(object) : null; return label && built.viewHas(label) ? label : null; }
  };
}());
