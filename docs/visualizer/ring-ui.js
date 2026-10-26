(function () {
  'use strict';
  /* Controls for the ring-magazine design: design selector, Pocket Size slider and the top-loading refill sequence.
     Everything else in the page is untouched; the demo controller is only read (and its inventory counts written after a refill). */
  var tries = 0;
  function $(id) { return document.getElementById(id); }
  function init() {
    var look = window.DispenserReferenceLook, rm = look && look.ringMagazine;
    if (!rm || !$('ringTools')) { if (tries++ < 60) setTimeout(init, 250); return; }
    var tools = $('ringTools'), slider = $('pocketSize'), out = $('pocketOut'), info = $('pocketInfo'), note = $('ringRefillNote');
    var rb = { open: $('ringOpenLid'), load: $('ringLoad'), index: $('ringIndex'), lift: $('ringLift'), close: $('ringCloseLid') };
    var names = ['Red', 'Blue', 'Green', 'Orange'];
    Array.prototype.forEach.call(document.querySelectorAll('input[name="designOpt"]'), function (r) {
      r.addEventListener('change', function () { if (!r.checked) return; rm.setActive(r.value === 'ring'); tools.hidden = r.value !== 'ring'; refresh(); });
    });
    function pocketText() {
      var p = rm.pocket();
      out.textContent = Math.round(p.q * 100) + '%';
      info.textContent = 'Pocket widths (mm): ' + names.map(function (n, i) { return n + ' ' + p.widths[i].toFixed(1) + ' (divider ' + p.dividers[i].toFixed(1) + ')'; }).join(' · ');
    }
    slider.addEventListener('input', function () { rm.setPocket(Number(slider.value) / 100); pocketText(); });
    Array.prototype.forEach.call(document.querySelectorAll('#refillRings [data-ring]'), function (b) {
      b.addEventListener('click', function () { rm.refill.select(Number(b.dataset.ring)); refresh(); });
    });
    rb.open.addEventListener('click', function () { rm.refill.openLid(); refresh(); });
    rb.load.addEventListener('click', function () { rm.refill.load(); refresh(); });
    rb.index.addEventListener('click', function () { rm.refill.index(); refresh(); });
    rb.lift.addEventListener('click', function () { rm.refill.lift(); refresh(); });
    rb.close.addEventListener('click', function () { rm.refill.closeLid(); refresh(); });
    function refresh() {
      if (!rm.active()) return;
      var s = rm.refill.state();
      rb.open.disabled = !s.canOpen; rb.load.disabled = !s.canLoad; rb.index.disabled = !s.canIndex; rb.lift.disabled = !s.canLift; rb.close.disabled = !s.canClose;
      rb.lift.textContent = s.lifted ? 'Put cartridge back' : 'Lift cartridge out';
      Array.prototype.forEach.call(document.querySelectorAll('#refillRings [data-ring]'), function (b) { var i = Number(b.dataset.ring); b.disabled = !s.canSelect; b.classList.toggle('active', s.ring === i); b.setAttribute('aria-pressed', s.ring === i ? 'true' : 'false'); });
      var text;
      if (s.busy) text = 'Working…';
      else if (!s.lid) text = 'Lid closed. Open the lid to refill: select a ring, then load pills one at a time (each load indexes the ring by one pocket).';
      else if (s.ring < 0) text = 'Lid open. Select the ring to refill.';
      else text = names[s.ring] + ' ring: ' + s.counts[s.ring] + '/5 pills. ' + (s.counts[s.ring] >= 5 ? 'Full. Close the lid.' : 'Drop a pill into the marked pocket (Load pill). Close the lid when done: the ring indexes so the first pill sits at the exit.');
      note.textContent = text;
    }
    pocketText(); setInterval(refresh, 250);
  }
  init();
}());
