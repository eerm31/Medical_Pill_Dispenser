(function () {
  'use strict';
  /* Prototype tabs (1 original, 2 ring magazine) plus the refill and weight/stability controls of Prototype 2.
     The demo controller is only read, and its inventory counts are written after a refill. */
  var tries = 0;
  function $(id) { return document.getElementById(id); }
  var HEAD = { legacy: ['PROTOTYPE 1 \u00b7 ASSEMBLY VIEW', 'Four-cartridge drum'], ring: ['PROTOTYPE 2 \u00b7 ASSEMBLY VIEW', 'Ring magazine'] };
  function init() {
    var look = window.DispenserReferenceLook, rm = look && look.ringMagazine;
    if (!rm || !$('ringTools')) { if (tries++ < 60) setTimeout(init, 250); return; }
    var info = $('pocketInfo'), note = $('ringRefillNote'), guide = $('ringGuide');
    var rb = { open: $('ringOpenLid'), fill: $('ringFill'), all: $('ringFillAll'), close: $('ringCloseLid') };
    var names = ['Red', 'Blue', 'Green', 'Orange'];
    function setMode(m) {
      var ring = m === 'ring', wiring = document.querySelector('input[name="viewMode"][value="wiring"]'), open = document.querySelector('input[name="subsystemView"]:checked');
      if (open) open.click(); // leave any system sub-view so its part lists are rebuilt for the new prototype
      $('compartmentOnlyToggle').parentNode.lastChild.textContent = ring ? ' Ring magazine' : ' Compartments & decks';
      rm.setActive(ring); $('ringSection').hidden = !ring; if (ring) $('ringSection').classList.remove('collapsed');
      $('ringBearingsRow').hidden = !ring; if (!ring && $('ringBearings').checked) { $('ringBearings').checked = false; rm.setBearings(false); }
      $('protoEyebrow').textContent = HEAD[m][0]; $('protoTitle').textContent = HEAD[m][1];
      if (wiring) wiring.disabled = false;
      refresh();
    }
    Array.prototype.forEach.call(document.querySelectorAll('input[name="designOpt"]'), function (r) {
      r.addEventListener('change', function () { if (r.checked) setMode(r.value); });
    });
    function pocketText() {
      var p = rm.pocket();
      info.textContent = 'Every pocket has the same fixed size: ' + p.width.toFixed(1) + ' mm along the track, so any pill size or shape fits any pocket of any ring. Pockets are filled with a repeating mix (' + p.pills.join(', ') + '), a different start in each ring. Divider thickness (mm): ' + names.map(function (n, i) { return n + ' ' + p.dividers[i].toFixed(1); }).join(' \u00b7 ');
    }
    var labelsToggle = $('labelsToggle');
    $('ringFloor').addEventListener('change', function (e) { rm.setFloor(e.target.checked); });
    $('ringBearings').addEventListener('change', function (e) { rm.setBearings(e.target.checked); });
    Array.prototype.forEach.call(document.querySelectorAll('#refillRings [data-ring]'), function (b) {
      b.addEventListener('click', function () { rm.refill.drop(Number(b.dataset.ring)); refresh(); });
    });
    [['open', 'openLid'], ['fill', 'fill'], ['all', 'fillAll'], ['close', 'closeLid']].forEach(function (e) {
      rb[e[0]].addEventListener('click', function () { rm.refill[e[1]](); refresh(); });
    });
    function refresh() {
      if (!rm.active()) return;
      rm.setLabels(labelsToggle.checked);
      var s = rm.refill.state();
      rb.open.disabled = !s.canOpen; rb.fill.disabled = !s.canFill; rb.all.disabled = !s.canFillAll; rb.close.disabled = !s.canClose;
      Array.prototype.forEach.call(document.querySelectorAll('#refillRings [data-ring]'), function (b) {
        var i = Number(b.dataset.ring), subs = window.dispenserSubsystems, chk = subs && subs.verification ? subs.verification.canStore(['red', 'blue', 'green', 'orange'][i]) : { ok: true };
        b.disabled = !s.canDrop[i] || !chk.ok; b.title = chk.ok ? '' : 'Storage check: ' + chk.reason;
        b.textContent = names[i] + ' ' + s.counts[i] + '/5';
      });
      guide.textContent = 'Pills stand on edge between the dividers. Each pocket is a fixed ' + rm.pocket().width.toFixed(1) + ' mm wide and takes any pill model (up to 12 mm tall, 6.2 mm wide, 5 mm thick). The ring never turns while it is refilled.';
      var text;
      if (s.busy) text = 'Working\u2026';
      else if (!s.lid) text = 'Press Refill all rings: the flap lifts over the queue pockets of every ring, a pill goes into each empty pocket (amber marks show where), then the flap closes. The rings stay locked and do not turn.';
      else text = 'Flap open: the amber mark is the next empty pocket of each ring. Add one pill to a ring, fill every ring, or close the flap.';
      note.textContent = text;
      var w = rm.stability(), g = window.DispenserRotationSpec.g;
      $('stabMass').textContent = Math.round(w.mass) + ' g';
      $('stabCom').textContent = w.comAboveTable.toFixed(0) + ' mm of ' + Math.round(w.height || (g.lid.z1 - g.table_z)) + ' mm';
      $('stabRot').textContent = Math.round(w.rotating) + ' g'; $('stabTip').textContent = w.tip.toFixed(0) + '\u00b0 tilt';
    }
    pocketText(); setInterval(refresh, 250);
  }
  init();
}());
