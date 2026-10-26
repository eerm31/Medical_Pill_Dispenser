(function () {
  'use strict';
  /* Prototype tabs (1 original, 2 stacked flask, 3 concentric rings) plus the Pocket Size, refill and weight/stability controls
     shared by prototypes 2 and 3. The demo controller is only read, and its inventory counts are written after a refill. */
  var tries = 0;
  function $(id) { return document.getElementById(id); }
  var HEAD = {
    legacy: ['PROTOTYPE 1 \u00b7 ASSEMBLY VIEW', 'Four-cartridge drum'],
    flask: ['PROTOTYPE 2 \u00b7 ASSEMBLY VIEW', 'Stacked flask'],
    ring: ['PROTOTYPE 3 \u00b7 ASSEMBLY VIEW', 'Concentric ring magazine']
  };
  function init() {
    var look = window.DispenserReferenceLook, D = look && look.designs;
    if (!D || !D.ring || !D.flask || !$('ringTools')) { if (tries++ < 60) setTimeout(init, 250); return; }
    var mode = 'legacy', slider = $('pocketSize'), out = $('pocketOut'), info = $('pocketInfo'), note = $('ringRefillNote');
    var rb = { open: $('ringOpenLid'), load: $('ringLoad'), index: $('ringIndex'), fill: $('ringFill'), close: $('ringCloseLid') };
    var names = ['Red', 'Blue', 'Green', 'Orange'];
    function cur() { return mode === 'legacy' ? null : D[mode]; }
    function setMode(m) {
      var wiring = document.querySelector('input[name="viewMode"][value="wiring"]');
      mode = m; D.ring.setActive(m === 'ring'); D.flask.setActive(m === 'flask');
      $('ringSection').hidden = m === 'legacy'; if (m !== 'legacy') $('ringSection').classList.remove('collapsed');
      $('protoEyebrow').textContent = HEAD[m][0]; $('protoTitle').textContent = HEAD[m][1];
      $('ringSectionEyebrow').textContent = m === 'flask' ? 'PROTOTYPE 2' : 'PROTOTYPE 3'; $('ringSectionTitle').textContent = HEAD[m][1];
      if (wiring) wiring.disabled = m === 'flask';
      if (cur()) { cur().setPocket(Number(slider.value) / 100); pocketText(); }
      refresh();
    }
    Array.prototype.forEach.call(document.querySelectorAll('input[name="designOpt"]'), function (r) {
      r.addEventListener('change', function () { if (r.checked) setMode(r.value); });
    });
    function pocketText() {
      var m = cur(); if (!m) return;
      var p = m.pocket();
      out.textContent = Math.round(p.q * 100) + '%';
      info.textContent = 'Pocket widths (mm): ' + names.map(function (n, i) { return n + ' ' + p.widths[i].toFixed(1) + ' (divider ' + p.dividers[i].toFixed(1) + ')'; }).join(' \u00b7 ');
    }
    slider.addEventListener('input', function () { var m = cur(); if (!m) return; m.setPocket(Number(slider.value) / 100); pocketText(); });
    Array.prototype.forEach.call(document.querySelectorAll('#refillRings [data-ring]'), function (b) {
      b.addEventListener('click', function () { var m = cur(); if (m) m.refill.select(Number(b.dataset.ring)); refresh(); });
    });
    [['open', 'openLid'], ['load', 'load'], ['index', 'index'], ['fill', 'fill'], ['close', 'closeLid']].forEach(function (e) {
      rb[e[0]].addEventListener('click', function () { var m = cur(); if (m) m.refill[e[1]](); refresh(); });
    });
    function refresh() {
      var m = cur(); if (!m || !m.active()) return;
      var s = m.refill.state();
      rb.open.disabled = !s.canOpen; rb.load.disabled = !s.canLoad; rb.index.disabled = !s.canIndex; rb.fill.disabled = !s.canFill; rb.close.disabled = !s.canClose;
      Array.prototype.forEach.call(document.querySelectorAll('#refillRings [data-ring]'), function (b) { var i = Number(b.dataset.ring); b.disabled = !s.canSelect; b.classList.toggle('active', s.ring === i); b.setAttribute('aria-pressed', s.ring === i ? 'true' : 'false'); });
      var text;
      if (s.busy) text = 'Working\u2026';
      else if (!s.lid) text = 'Lid closed. Open the lid to refill: select a ring, then load pills one at a time (each load indexes the ring by one pocket).';
      else if (s.ring < 0) text = 'Lid open. Select the ring to refill.';
      else text = names[s.ring] + ' ring: ' + s.counts[s.ring] + '/5 pills. ' + (s.counts[s.ring] >= 5 ? 'Full. Close the lid.' : 'Drop a pill into the marked pocket (Load pill). Close the lid when done: the ring indexes so the first pill sits at the exit.');
      note.textContent = text;
      var w = m.stability(), g = window.DispenserRotationSpec.g;
      $('stabMass').textContent = Math.round(w.mass) + ' g';
      $('stabCom').textContent = w.comAboveTable.toFixed(0) + ' mm of ' + Math.round(w.height || (g.lid.z1 - g.table_z)) + ' mm';
      $('stabRot').textContent = Math.round(w.rotating) + ' g'; $('stabTip').textContent = w.tip.toFixed(0) + '\u00b0 tilt';
    }
    setInterval(refresh, 250);
  }
  init();
}());
