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
    var rb = { open: $('ringOpenLid'), load: $('ringLoad'), fill: $('ringFill'), all: $('ringFillAll'), close: $('ringCloseLid') };
    var names = ['Red', 'Blue', 'Green', 'Orange'];
    function setMode(m) {
      var ring = m === 'ring', wiring = document.querySelector('input[name="viewMode"][value="wiring"]'), open = document.querySelector('input[name="subsystemView"]:checked');
      if (open) open.click(); // leave any system sub-view so its part lists are rebuilt for the new prototype
      $('compartmentOnlyToggle').parentNode.lastChild.textContent = ring ? ' Ring compartments' : ' Compartments & decks';
      rm.setActive(ring); $('ringSection').hidden = !ring; if (ring) $('ringSection').classList.remove('collapsed');
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
      b.addEventListener('click', function () { rm.refill.select(Number(b.dataset.ring)); refresh(); });
    });
    [['open', 'openLid'], ['load', 'load'], ['fill', 'fill'], ['all', 'fillAll'], ['close', 'closeLid']].forEach(function (e) {
      rb[e[0]].addEventListener('click', function () { rm.refill[e[1]](); refresh(); });
    });
    function refresh() {
      if (!rm.active()) return;
      rm.setLabels(labelsToggle.checked);
      var s = rm.refill.state();
      rb.open.disabled = !s.canOpen; rb.load.disabled = !s.canLoad; rb.fill.disabled = !s.canFill; rb.all.disabled = !s.canFillAll; rb.close.disabled = !s.canClose;
      Array.prototype.forEach.call(document.querySelectorAll('#refillRings [data-ring]'), function (b) {
        var i = Number(b.dataset.ring); b.disabled = !s.canSelect; b.classList.toggle('active', s.ring === i); b.setAttribute('aria-pressed', s.ring === i ? 'true' : 'false');
        b.textContent = names[i] + ' ' + s.counts[i] + '/5';
      });
      guide.textContent = 'Pills stand on edge between the dividers. Each pocket is a fixed ' + rm.pocket().width.toFixed(1) + ' mm wide and takes any pill model (up to 12 mm tall, 6.2 mm wide, 5 mm thick).';
      var text;
      if (s.busy) text = 'Working\u2026';
      else if (!s.lid) text = 'Press Refill all rings: each ring in turn unlocks, opens its own hatch, turns an empty pocket under it and takes its pills, then everything locks again. Or open the hatch yourself and pour pill by pill.';
      else if (s.ring < 0) text = 'Hatch ready. Pick a ring: only that ring unlocks and only its hatch opens; the other rings stay clamped.';
      else text = names[s.ring] + ' ring: ' + s.counts[s.ring] + '/5 pills. ' + (s.counts[s.ring] >= 5 ? 'Full. Pick another ring or close the hatch.' : 'Pour 1 pill: the ring turns the next empty pocket under the amber mark, a pill drops through the funnel, the dividers hold it. Fill this ring repeats that.');
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
