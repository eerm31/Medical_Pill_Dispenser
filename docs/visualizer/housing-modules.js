(function () {
  'use strict';
  /* Housing modules (Features 009 and 010; ASSUMED / NOT_VALIDATED concept, offline, no hardware claim).
     Subsystem 4: a 2.4 in touchscreen in a printed display pod on the front of the shell, with an RGB status LED bar under it.
     Subsystem 3: reflective IR level sensors under IR-clear floor windows at queue pockets 1 (READY) and 5 (FULL) of every ring, and an
     IR break-beam pair across the exit funnel. The sensors belong to Prototype 2 and show only while it is active.
     Everything here only READS the controllers; positions come from rotation-spec.js and the ring magazine. */
  var DEG = Math.PI / 180;
  var COLORS = ['red', 'blue', 'green', 'orange'];
  var TONE = { red: '#ef555c', blue: '#438de8', green: '#51b879', orange: '#ef963f' };

  function build(ctx) {
    var T = ctx.THREE, S = ctx.S, std = ctx.std, EL = ctx.EL, CYa = S.axle[1], rm = ctx.ringMag;
    var modG = new T.Group(); modG.name = 'housing modules'; ctx.parent.add(modG);
    var vis = { display: true, verify: true };

    // ---------- Subsystem 4: display pod, touchscreen and status LED ----------
    var POD = { angle: 255 * DEG, w: 66, z0: -17, z1: 37, front: 55, back: S.shell_r1 - 1 };
    var podG = new T.Group(); podG.name = 'display pod'; podG.position.set(0, 0, -CYa); podG.rotation.y = POD.angle; modG.add(podG);
    var half = POD.w / 2, aB = Math.asin(half / POD.back), ue = POD.back * Math.cos(aB), shape = new T.Shape();
    shape.moveTo(ue, -half); shape.lineTo(POD.front, -half); shape.lineTo(POD.front, half); shape.lineTo(ue, half); shape.absarc(0, 0, POD.back, aB, -aB, true);
    var pod = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: POD.z1 - POD.z0, bevelEnabled: false, curveSegments: 48 }), ctx.wallGlass);
    pod.rotation.x = -Math.PI / 2; pod.position.y = POD.z0; podG.add(pod); pod.add(new T.LineSegments(new T.EdgesGeometry(pod.geometry, 30), EL));

    function box(par, u0, u1, v0, v1, z0, z1, mat) {
      var m = new T.Mesh(new T.BoxGeometry(u1 - u0, z1 - z0, v1 - v0), mat); m.position.set((u0 + u1) / 2, (z0 + z1) / 2, -(v0 + v1) / 2); par.add(m); return m;
    }
    function mounted(m, kind) { m.userData.partType = kind || 'electronic'; m.userData.onHousing = true; return m; }
    var DZ0 = -9, DZ1 = 33.7, ZC = (DZ0 + DZ1) / 2;   // 2.4 in module, landscape: 60.3 x 42.7 mm, active area 49.0 x 36.7 mm
    mounted(box(podG, 54.2, 56.0, -30.15, 30.15, DZ0, DZ1, ctx.mats.dark));
    mounted(box(podG, 56.0, 56.4, -26.5, 26.5, ZC - 19.5, ZC + 19.5, std(0x05080d, { roughness: 0.15, metalness: 0.3 })));
    var canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
    var tex = ctx.canvasTexture(canvas), ctx2d = canvas.getContext('2d');
    var screen = new T.Mesh(new T.PlaneGeometry(49.0, 36.7), new T.MeshBasicMaterial({ map: tex })); screen.rotation.y = Math.PI / 2; screen.position.set(56.45, ZC, 0); mounted(screen); podG.add(screen);
    var ledMat = new T.MeshStandardMaterial({ color: 0x1a2430, emissive: 0x000000, emissiveIntensity: 1, roughness: 0.4 });
    var led = mounted(box(podG, 54.5, 56.2, -18, 18, -14.5, -11.5, ledMat));
    ctx.housingMount(podG, pod);   // last, so the housing's hide list also finds the display and the LED

    // ---------- scanner mount arm label anchor (the arm itself is built with the scanner in reference-look.js) ----------

    // ---------- Subsystem 3: level sensors under the floor and the exit break-beam ----------
    var senG = new T.Group(); senG.name = 'verification sensors'; senG.position.set(0, 0, -CYa); senG.visible = false; modG.add(senG);
    var ZF = S.ring.floor_z, sensors = [], dim = new T.Color(0x2a3340), lit = new T.Color(0x38d98a);
    function polar(par, r, phi) { var g = new T.Group(); g.rotation.y = phi; par.add(g); return g; }
    COLORS.forEach(function (c, k) {
      [1, S.ring.cap].forEach(function (u) {
        var q = rm.queuePocket(k, u), g = polar(senG, q.r, q.phi), win, glow;
        g.position.set(q.r * Math.cos(q.phi), 0, -q.r * Math.sin(q.phi)); g.rotation.y = q.phi;
        win = new T.Mesh(new T.CircleGeometry(1.5, 24), std(0x06090d, { roughness: 0.2 })); win.rotation.x = -Math.PI / 2; win.position.y = ZF + 0.04; g.add(win);
        glow = new T.Mesh(new T.RingGeometry(1.7, 2.4, 24), new T.MeshBasicMaterial({ color: 0x2a3340, side: T.DoubleSide })); glow.rotation.x = -Math.PI / 2; glow.position.y = ZF + 0.05; g.add(glow);
        var mod = new T.Mesh(new T.BoxGeometry(5, 3.5, 6), ctx.mats.blue); mod.position.set(0, -4.75, 0); g.add(mod);
        [win, glow, mod].forEach(function (m) { m.userData.partType = 'electronic'; });
        sensors.push({ k: k, u: u, glow: glow });
      });
    });
    // break-beam across the exit funnel, 6 mm above the funnel floor at x = 44
    var FUN = S.ring.funnel, bx = 44, bz = FUN.z0 + (FUN.z1 - FUN.z0) * (bx - FUN.x0) / (FUN.x1 - FUN.x0) + 6, lv0 = S.ring.slot.v[0] - FUN.t, lv1 = S.ring.slot.v[1] + FUN.t;
    function lumpAt(l0, l1) { var m = new T.Mesh(new T.BoxGeometry(3, 3, Math.abs(l1 - l0)), ctx.mats.dark); m.position.set(bx, bz, -(l0 + l1) / 2); m.userData.partType = 'electronic'; senG.add(m); return m; }
    lumpAt(lv0 - 2.5, lv0); lumpAt(lv1, lv1 + 2.5);
    var beamMat = new T.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.55 });
    var beam = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, lv1 - lv0, 8), beamMat); beam.rotation.x = Math.PI / 2; beam.position.set(bx, bz, -(lv0 + lv1) / 2); beam.userData.partType = 'electronic'; senG.add(beam);

    // ---------- callouts (main view labels) ----------
    var cx = Math.cos(POD.angle), cy = Math.sin(POD.angle);
    if (ctx.callout) {
      ctx.callout(ctx.parent, 'Touchscreen 2.4 in', 'bought', [56.4 * cx, CYa + 56.4 * cy, ZC + 14], [92 * cx - 16, CYa + 92 * cy, ZC + 30]);
      ctx.callout(ctx.parent, 'Status LED', 'bought', [55.6 * cx, CYa + 55.6 * cy, -13], [92 * cx - 16, CYa + 92 * cy, -22]);
      ctx.callout(ctx.parent, 'Display pod', 'printed', [53 * cx - 28 * cy, CYa + 53 * cy + 28 * cx, 24], [92 * cx - 40, CYa + 92 * cy + 28, 40]);
      ctx.callout(ctx.parent, 'Reader mount arm', 'printed', [-38 + S.scanner_dx, 0, 22.5], [-38 + S.scanner_dx - 30, -14, 8]);
    }
    if (rm.addLabel) {
      var q = rm.queuePocket(3, 1);
      rm.addLabel('IR level sensor', 'bought', [q.r * Math.cos(q.phi), q.r * Math.sin(q.phi), ZF], [72, -60, 30]);
      rm.addLabel('Exit break-beam', 'bought', [bx, (lv0 + lv1) / 2, bz], [76, 14, -2]);
    }

    // ---------- screen drawing ----------
    var lastSig = '';
    function rr(c, x, y, w, h, r, fill) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fillStyle = fill; c.fill(); }
    function draw(sch, ver, ledInfo) {
      var c = ctx2d, W = 320, H = 240;
      c.fillStyle = '#0b1220'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#9fb3c8'; c.font = '600 14px sans-serif'; c.textBaseline = 'top'; c.fillText('SIM CLOCK', 14, 10);
      c.fillStyle = '#edf3fa'; c.font = '700 54px sans-serif'; c.fillText(sch.clock, 12, 26);
      c.beginPath(); c.arc(292, 24, 9, 0, Math.PI * 2); c.fillStyle = ledInfo.css; c.fill();
      c.fillStyle = '#9fb3c8'; c.font = '600 12px sans-serif'; c.textAlign = 'right'; c.fillText(sch.playing ? 'PLAYING' : 'PAUSED', 306, 40); c.textAlign = 'left';
      var due = sch.due, taking = sch.entries.filter(function (e) { return e.status === 'TAKING'; })[0];
      var msg = due ? 'DUE  ' + due.color.toUpperCase() + '  ' + due.time : taking ? 'DISPENSING  ' + taking.color.toUpperCase() : sch.next ? 'NEXT  ' + sch.next.color.toUpperCase() + '  ' + sch.next.time : sch.entries.length ? 'NO MORE DOSES' : 'NO SCHEDULE';
      rr(c, 10, 90, 300, 40, 8, due ? '#8a5a12' : '#16233a'); c.fillStyle = due ? '#ffe2a6' : '#c7d6e8'; c.font = '700 22px sans-serif'; c.fillText(msg, 22, 100);
      if (due) { rr(c, 218, 96, 86, 28, 6, '#2a7f74'); c.fillStyle = '#f2fffc'; c.font = '800 16px sans-serif'; c.fillText('TAKE', 236, 102); }
      c.font = '600 14px sans-serif';
      sch.entries.slice(0, 4).forEach(function (e, i) {
        var y = 140 + i * 18; c.fillStyle = TONE[e.color]; c.beginPath(); c.arc(20, y + 8, 5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#dbe5f0'; c.fillText(e.time + '  ' + e.color, 34, y); c.fillStyle = e.status === 'TAKEN' ? '#51b879' : e.status === 'DUE' || e.status === 'TAKING' ? '#ffb347' : e.status === 'MISSED' || e.status === 'FAILED' ? '#ef555c' : '#7d8a9c'; c.fillText(e.status, 150, y);
      });
      var snap = ver ? ver.rings : null;
      COLORS.forEach(function (col, i) {
        var r = snap && snap[col], lv = r ? r.level[0] : '-', x = 10 + i * 76;
        rr(c, x, 216, 70, 20, 5, '#16233a'); c.fillStyle = TONE[col]; c.fillRect(x + 6, 222, 8, 8); c.fillStyle = r && r.level === 'EMPTY' ? '#ef555c' : '#c7d6e8'; c.font = '700 13px sans-serif'; c.fillText(col[0].toUpperCase() + ' ' + (r ? r.level : ''), x + 20, 220);
      });
      tex.needsUpdate = true;
    }

    // ---------- status LED ----------
    function ledState(sch, ver, now) {
      var last = ver && ver.last;
      if (last && last.verdict !== 'VERIFIED' && now - last.at < 8000) return { name: 'red (last dispense not verified)', hex: 0xff3b3b, css: '#ff3b3b', k: 1 };
      if (sch && sch.entries.some(function (e) { return e.status === 'FAILED' || e.status === 'MISSED'; }) && !sch.due) return { name: 'red steady (missed or failed dose)', hex: 0xff3b3b, css: '#ff3b3b', k: 0.55 };
      if (sch && (sch.due || sch.entries.some(function (e) { return e.status === 'TAKING'; }))) { var k = 0.55 + 0.45 * Math.sin(now / 220); return { name: 'amber pulsing (dose due)', hex: 0xffb300, css: '#ffb300', k: k }; }
      if (last && last.verdict === 'VERIFIED' && now - last.at < 5000) return { name: 'green (dispense verified)', hex: 0x38d98a, css: '#38d98a', k: 1 };
      return { name: 'dim teal (idle)', hex: 0x2fb7a6, css: '#2fb7a6', k: 0.18 };
    }

    function update(s, now) {
      var sub = window.dispenserSubsystems || {}, sch = sub.schedule ? sub.schedule.snapshot() : null, ver = sub.verification ? sub.verification.snapshot() : null;
      podG.visible = vis.display; senG.visible = vis.verify && rm && rm.active();
      var info = ledState(sch, ver, now);
      ledMat.emissive.setHex(info.hex); ledMat.emissiveIntensity = info.k; ledMat.color.setHex(info.hex);
      if (podG.visible && sch) {
        var sig = JSON.stringify([sch.clock, sch.playing, sch.entries.map(function (e) { return e.id + e.status; }), sch.due && sch.due.id, ver && Object.keys(ver.rings).map(function (c) { return ver.rings[c].level; }), info.css]);
        if (sig !== lastSig) { lastSig = sig; draw(sch, ver, info); }
      }
      if (senG.visible) {
        sensors.forEach(function (e) { e.glow.material.color.copy(rm.sense(e.k, e.u) ? lit : dim); });
        var hit = ver && ver.beam; beamMat.color.setHex(hit ? 0xffffff : 0xff3b3b); beamMat.opacity = hit ? 1 : 0.55;
      }
    }
    draw({ clock: '--:--', playing: false, entries: [], due: null, next: null }, null, { css: '#2fb7a6' });
    return {
      update: update, led: function (now) { var sub = window.dispenserSubsystems || {}; return ledState(sub.schedule ? sub.schedule.snapshot() : null, sub.verification ? sub.verification.snapshot() : null, now || Date.now()); },
      setVisible: function (which, on) { vis[which] = Boolean(on); }, visible: function (which) { return vis[which]; }, group: modG, pod: podG, sensors: senG
    };
  }
  window.DispenserHousingModules = { build: build };
}());
