(function () {
  'use strict';
  /* Current build tab: the printed housing with one cartridge ring turned by a 28BYJ-48 stepper, driven by a copy of
     the electronics firmware logic (build-controller.js). Shapes follow photos of the printed parts; sizes are
     ASSUMED, not measured CAD. NOT VALIDATED. It adds one group to the scene and hides the others while the tab is open. */
  var tries = 0;
  function $(id) { return document.getElementById(id); }

  function init() {
    var host = window.DispenserSceneHost, B = window.DispenserBuild;
    if (!host || !B || !$('buildSection') || !host.root()) { if (tries++ < 40) setTimeout(init, 250); return; }
    var T = host.THREE, root = host.root();
    var ctl = B.create({ start: 8 * 60, speed: 10, doses: [[8 * 60 + 1, 1], [8 * 60 + 2, 2], [8 * 60 + 3, 3]] });
    var CART_PILLS = 12, inventory = CART_PILLS, trayCount = 0, active = false, saved = null, lastRows = '', lastPanel = 0;
    var POSE = { x: 0, y: 28, z: 0, theta: 0.8, phi: 1.05 };
    var WHITE = 0xdfe3e8, DARK = 0x10151d;
    function framePose() {
      var h = $('sceneHost'), aspect = h && h.clientHeight ? h.clientWidth / h.clientHeight : 1.4;
      return { x: POSE.x, y: POSE.y, z: POSE.z, theta: POSE.theta, phi: POSE.phi, radius: Math.max(240, Math.min(560, 235 / (0.77 * Math.min(aspect, 1.7)))) };
    }

    // ---------- scene ----------
    var G = new T.Group();
    G.name = 'current build · printed housing with one cartridge ring';
    G.visible = false;
    root.add(G);

    function mat(color, extra) {
      var o = { color: color, roughness: 0.55, metalness: 0.05 };
      for (var k in extra) o[k] = extra[k];
      return new T.MeshStandardMaterial(o);
    }
    function add(mesh, x, y, z, parent) { mesh.position.set(x, y, z); (parent || G).add(mesh); return mesh; }
    function box(w, h, d, color, x, y, z, parent, extra) { return add(new T.Mesh(new T.BoxGeometry(w, h, d), mat(color, extra)), x, y, z, parent); }
    function cyl(r, h, color, x, y, z, parent, extra) { return add(new T.Mesh(new T.CylinderGeometry(r, r, h, 48), mat(color, extra)), x, y, z, parent); }
    function label(text, x, y, z) {
      var c = document.createElement('canvas'), g;
      c.width = 384; c.height = 72;
      g = c.getContext('2d');
      g.fillStyle = 'rgba(10,17,27,.82)'; g.fillRect(0, 0, 384, 72);
      g.strokeStyle = '#71d6c6'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 381, 69);
      g.fillStyle = '#edf4fb'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, 192, 37);
      var tex = new T.CanvasTexture(c), s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      s.scale.set(30, 5.6, 1); s.renderOrder = 10; s.position.set(x, y, z);
      G.add(s); return s;
    }
    // four mounting ears with a screw hole, 45 degrees from the axes (the printed parts have them)
    function ears(radius, y, parent) {
      [45, 135, 225, 315].forEach(function (deg) {
        var a = deg * Math.PI / 180, x = Math.cos(a) * radius, z = Math.sin(a) * radius;
        cyl(4.4, 3, WHITE, x, y, z, parent);
        cyl(1.6, 3.2, DARK, x, y, z, parent);
      });
    }

    // white desk and the round white base plate
    box(250, 2, 150, 0x4a586b, 15, -1, 0);
    cyl(52, 3, WHITE, 0, 1.5, 0);

    // housing: a solid white drum on the base plate (the stepper plate and stepper are inside it)
    cyl(31, 41, WHITE, 0, 23.5, 0);
    ears(36, 4.5);
    box(10, 8, 12, 0x2d6cdf, -33, 12, 0); // stepper plug (blue), where the cable leaves the housing

    // three tubes beside the housing; the middle one is open at the top and has a small square flag
    [-0.9, 0, 0.9].forEach(function (a, k) {
      var tx = Math.cos(a) * 44, tz = Math.sin(a) * 44;
      var tube = new T.Mesh(new T.CylinderGeometry(12, 12, 52, 40, 1, k === 1), mat(WHITE, { side: T.DoubleSide }));
      add(tube, tx, 29, tz);
      if (k === 1) {
        add(new T.Mesh(new T.CylinderGeometry(8.5, 8.5, 0.4, 32), mat(DARK)), tx, 54.8, tz);
        box(6, 6, 12, WHITE, tx + 14, 50, tz);
      }
    });

    // the rotating part: ring with 12 rectangular windows, lid with ears and a square opening
    var R = new T.Group();
    R.name = 'rotating cartridge ring and lid';
    G.add(R);
    cyl(29.5, 13, WHITE, 0, 50.5, 0, R);
    for (var w = 0; w < 12; w++) {
      var wa = w * Math.PI / 6, win = box(1.4, 7, 4.4, DARK, Math.cos(wa) * 29.5, 50.5, Math.sin(wa) * 29.5, R);
      win.rotation.y = -wa;
    }
    cyl(32, 3, WHITE, 0, 58.5, 0, R);
    ears(35.5, 58.5, R);
    box(12, 5, 2, WHITE, -11, 62.5, 5, R); box(12, 5, 2, WHITE, -11, 62.5, -5, R);
    box(2, 5, 12, WHITE, -16, 62.5, 0, R); box(2, 5, 12, WHITE, -6, 62.5, 0, R);
    box(8, 0.3, 8, DARK, -11, 60.2, 0, R);
    box(5, 0.3, 5, 0x6b7785, 22, 60.2, 0, R); // small triangle marker on the lid

    var pillGeo = new T.SphereGeometry(2.6, 16, 12), pillMat = mat(0xf2d9a8, { roughness: 0.4 });
    function pillMesh() { var m = new T.Mesh(pillGeo, pillMat); m.scale.set(1.4, 0.8, 0.9); return m; }

    // pill tray on the desk
    box(34, 2, 36, 0x2a3b55, 88, 0.5, 0);
    box(34, 6, 2, 0x2a3b55, 88, 3, 17); box(34, 6, 2, 0x2a3b55, 88, 3, -17); box(2, 6, 36, 0x2a3b55, 105, 3, 0);

    // electronics on the desk: ULN2003 driver (green, four blue LEDs), ESP32-S3 board, USB cable, wires
    box(34, 2, 32, 0x1f7a4d, -85, 1, -32); box(18, 4, 6, 0x111111, -85, 4, -32); box(4, 6, 20, 0xeeeeee, -100, 4, -32);
    for (var l = 0; l < 4; l++) add(new T.Mesh(new T.SphereGeometry(1.6, 12, 8), mat(0x4aa3ff, { emissive: 0x1a4f99 })), -74, 3.6, -41 + l * 5);
    box(55, 1.6, 26, 0x16202e, -85, 0.8, 28); box(18, 2.5, 25.5, 0xc7ced6, -69, 2.8, 28); box(9, 3, 7, 0xbfc7cf, -111, 3.1, 28);
    box(24, 3, 5, 0x2a6df4, -126, 2.5, 28); // USB cable
    function wire(color, pts) {
      var g = new T.BufferGeometry().setFromPoints(pts.map(function (q) { return new T.Vector3(q[0], q[1], q[2]); }));
      G.add(new T.Line(g, new T.LineBasicMaterial({ color: color })));
    }
    [[0xff9f43, -3], [0xffd84d, -1], [0x57d37c, 1], [0x5aa9ff, 3]].forEach(function (c, k) {
      wire(c[0], [[-98, 2, 20 + k * 3], [-98, 6 + k, 0], [-99 + k, 6 + k, -32 + c[1] * 3]]);
    });
    wire(0xffffff, [[-100, 8, -32], [-70, 10, -20], [-40, 12, -6], [-38, 12, 0]]);
    label('ESP32-S3', -85, 12, 28); label('ULN2003 driver', -85, 12, -32); label('Lid + ring (turn)', 0, 74, 0);
    label('Housing + stepper', -8, 34, 40); label('Tubes', 56, 62, 0); label('Pill tray', 88, 14, 0);

    // pills that leave the cartridge: window, down the middle tube, out at its foot, along the plate to the tray
    var falling = [], landed = [];
    function land(idx) { return new T.Vector3(79 + (idx % 6) * 4.6, 3.6 + Math.floor(idx / 24) * 2.2, -9 + (Math.floor(idx / 6) % 4) * 6); }
    function bez(a, c, b, t) { var u = 1 - t; return new T.Vector3(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y, u * u * a.z + 2 * u * t * c.z + t * t * b.z); }
    var P0 = new T.Vector3(26, 51, 0), PC = new T.Vector3(40, 50, 0), P1 = new T.Vector3(44, 40, 0), P2 = new T.Vector3(57, 4.5, 0);
    function pathAt(t, to) {
      if (t < 0.2) return bez(P0, PC, P1, t / 0.2);
      if (t < 0.6) return P1.clone().lerp(new T.Vector3(44, 6, 0), (t - 0.2) / 0.4);
      if (t < 0.75) return new T.Vector3(44, 6, 0).lerp(P2, (t - 0.6) / 0.15);
      var c = new T.Vector3((P2.x + to.x) / 2, P2.y + 2, to.z / 2);
      return bez(P2, c, to, (t - 0.75) / 0.25);
    }
    function drop() {
      if (inventory <= 0) return false;
      inventory--;
      var m = pillMesh(); m.position.copy(P0); G.add(m);
      falling.push({ mesh: m, t: 0, to: land(trayCount) });
      trayCount++;
      return true;
    }
    function clearTray() {
      falling.concat(landed).forEach(function (f) { G.remove(f.mesh); });
      falling = []; landed = []; trayCount = 0;
    }
    function refill() { inventory = CART_PILLS; }

    // ---------- per-frame ----------
    var emptyNote = '';
    host.onFrame(function (dt) {
      if (!active) return;
      var dropped = ctl.tick(dt), snap = ctl.snapshot(), k;
      R.rotation.y = snap.angle * Math.PI / 180;
      for (k = 0; k < dropped; k++) { if (!drop()) emptyNote = 'The cartridge is empty, but the firmware still reports the dose as taken (no sensor).'; }
      for (k = falling.length - 1; k >= 0; k--) {
        var f = falling[k]; f.t += dt / 1.3;
        if (f.t >= 1) { f.mesh.position.copy(f.to); landed.push(f); falling.splice(k, 1); }
        else f.mesh.position.copy(pathAt(f.t, f.to));
      }
      var now = performance.now();
      if (now - lastPanel > 100) { lastPanel = now; render(snap); }
    });

    // ---------- panel ----------
    function render(snap) {
      var s = snap || ctl.snapshot(), due = s.entries.filter(function (e) { return e.status === 'TAKING' || e.status === 'DUE'; })[0];
      $('buildClock').textContent = s.clock + (s.playing ? '' : ' (paused)');
      $('buildMotor').textContent = s.spin ? (s.spin.phase === 'move' ? 'Turning ' + B.DEGREES_PER_PILL + '°' : 'Holding (pill falls)') : 'Stopped';
      $('buildBadge').textContent = s.spin ? 'TURNING' : 'STOPPED';
      $('buildDose').textContent = s.spin ? 'Pill ' + Math.min(s.spin.pills, s.spin.out + (s.spin.phase === 'move' ? 1 : 0)) + ' of ' + s.spin.pills + ' (' + Math.max(0, Math.ceil(s.spin.total - s.spin.elapsed)) + ' s left)' : (due ? due.time + ' waiting' : 'None due');
      $('buildCart').textContent = inventory + ' of ' + CART_PILLS;
      $('buildTray').textContent = String(trayCount);
      $('buildPlay').textContent = s.playing ? 'Pause' : 'Play';
      var rows = JSON.stringify(s.entries);
      if (rows !== lastRows) {
        lastRows = rows;
        $('buildList').innerHTML = s.entries.length ? s.entries.map(function (e) {
          return '<li class="sched-item build ' + e.status.toLowerCase() + '"><strong>' + e.time + '</strong><span>' + e.pills + (e.pills === 1 ? ' pill' : ' pills') + (e.tomorrow ? ' · tomorrow' : '') + '</span><em>' + e.status + '</em><button class="quiet-button" type="button" data-rm="' + e.id + '">Remove</button></li>';
        }).join('') : '<li class="sched-empty">No doses scheduled</li>';
      }
      if (emptyNote) { $('buildMsg').textContent = emptyNote; emptyNote = ''; }
    }
    function msg(t) { $('buildMsg').textContent = t; }

    $('buildAdd').addEventListener('click', function () {
      var r = ctl.add($('buildTime').value, $('buildPills').value);
      msg(r.ok ? 'Added.' : r.error); lastRows = ''; render();
    });
    $('buildList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]');
      if (!b) return;
      msg(ctl.remove(Number(b.dataset.rm)) ? 'Removed.' : 'That dose is being dispensed.'); lastRows = ''; render();
    });
    $('buildClockSet').addEventListener('click', function () {
      var ok = ctl.setClock(B.parse($('buildClockInput').value));
      msg(ok ? 'Clock set. Going back in time starts a new day.' : 'Enter a time as HH:MM.'); lastRows = ''; render();
    });
    $('buildPlay').addEventListener('click', function () { ctl.setPlaying(!ctl.snapshot().playing); render(); });
    $('buildStop').addEventListener('click', function () { ctl.stop(); msg('Motor stopped. An unfinished dose goes back to DUE and starts again.'); lastRows = ''; render(); });
    $('buildReset').addEventListener('click', function () { ctl.reset(); clearTray(); refill(); R.rotation.y = 0; msg('Demo reset to 08:00.'); lastRows = ''; render(); });
    $('buildRefill').addEventListener('click', function () { refill(); render(); });
    $('buildEmpty').addEventListener('click', function () { clearTray(); render(); });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="buildSpeed"]'), function (r) {
      r.addEventListener('change', function () { if (r.checked) ctl.setSpeed(Number(r.value)); });
    });

    // ---------- tab on / off ----------
    window.DispenserBuildMode = {
      active: function () { return active; },
      controller: ctl,
      set: function (on) {
        if (on === active) return;
        var wiring = document.querySelector('input[name="viewMode"][value="wiring"]'), mech = document.querySelector('input[name="viewMode"][value="mechanism"]');
        if (on) {
          if (wiring && wiring.checked && mech) mech.click();
          saved = { pose: host.pose(), home: host.home(), vis: root.children.filter(function (c) { return c !== G; }).map(function (c) { return [c, c.visible]; }) };
          saved.vis.forEach(function (v) { v[0].visible = false; });
          G.visible = true; active = true;
          document.body.classList.add('build-view');
          $('buildSection').hidden = false; $('buildSection').classList.remove('collapsed');
          if (wiring) wiring.disabled = true;
          var pose = framePose();
          host.flyTo(pose); host.setHome(pose);
          render();
        } else {
          G.visible = false; active = false;
          if (saved) { saved.vis.forEach(function (v) { v[0].visible = v[1]; }); host.flyTo(saved.pose); host.setHome(saved.home); saved = null; }
          document.body.classList.remove('build-view');
          $('buildSection').hidden = true;
          if (wiring) wiring.disabled = false;
        }
      }
    };
    render();
  }
  init();
}());
