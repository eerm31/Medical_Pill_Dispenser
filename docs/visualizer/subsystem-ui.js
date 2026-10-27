(function () {
  'use strict';
  /* Panel wiring for Subsystem 3 (verification) and Subsystem 4 (touchscreen schedule). Creates the two controllers, feeds them from the demo
     controller's snapshot ten times a second and renders their state. The only way it acts on the machine is controller.requestDispense(),
     and only after a tap on TAKE and a pass from the verification check. */
  var tries = 0, COLORS = ['red', 'blue', 'green', 'orange'];
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cap(c) { return c.charAt(0).toUpperCase() + c.slice(1); }

  function init() {
    var look = window.DispenserReferenceLook, host = window.DispenserStepHost, mods = look && look.housingModules;
    if (!look || !host || !host.controller || !mods || !window.DispenserVerification || !window.DispenserSchedule || !$('verRings')) { if (tries++ < 80) setTimeout(init, 250); return; }
    var ctl = host.controller, rm = look.ringMagazine, MAX = (rm && rm.capacity) || 5;
    var ver = window.DispenserVerification.create({
      max: MAX,
      sense: function (c) { if (!rm || !rm.active()) return null; var k = COLORS.indexOf(c); return { ready: rm.sense(k, 1), full: rm.sense(k, rm.capacity) }; },
      moving: function () { return Boolean(rm && rm.active() && rm.report().busy); }
    });
    var sch = window.DispenserSchedule.create({ start: 8 * 60 });
    window.dispenserSubsystems = { verification: ver, schedule: sch };
    var pending = null, msg = '', lastReal = performance.now(), sig = { ver: '', sch: '' };

    // a verdict for the pill being taken closes that schedule entry
    ver.onVerdict(function (v) {
      if (pending && pending.color === v.color) { sch.finishTake(pending.id, v.verdict); msg = v.verdict === 'VERIFIED' ? 'Dose taken and verified.' : 'Dose NOT verified: ' + v.verdict.replace('_', ' ').toLowerCase() + '.'; pending = null; }
    });

    function setMsg(t) { msg = t; $('schedMsg').textContent = t; }
    function take() {
      var due = sch.due(); if (!due) return;
      var ok = ver.canDispense(due.color);
      if (!ok.ok) { setMsg('Cannot dispense: ' + ok.reason + '.'); return; }
      if (!sch.beginTake(due.id)) return;
      if (ctl.requestDispense(due.color)) { pending = { id: due.id, color: due.color }; setMsg('Dispensing ' + due.color + '\u2026'); }
      else { sch.abortTake(due.id); setMsg('Dispense refused: ' + (ctl.state.rejection || 'the mechanism is not ready') + '.'); }
      render(true);
    }

    function renderVer(v) {
      $('verBeam').textContent = v.beam ? 'BEAM BROKEN' : 'BEAM CLEAR'; $('verBeam').classList.toggle('alert', v.beam);
      var html = COLORS.map(function (c) {
        var r = v.rings[c], store = ver.canStore(c);
        return '<div class="ver-ring ' + r.level.toLowerCase() + (r.mismatch ? ' bad' : '') + '"><i class="dot ' + c + '"></i><div class="ver-name"><strong>' + cap(c) + '</strong><small>READY ' + (r.ready ? '\u25cf' : '\u25cb') + ' \u00b7 FULL ' + (r.full ? '\u25cf' : '\u25cb') + '</small></div>' +
          '<span class="ver-level">' + r.level + (r.mismatch ? ' \u26a0' : '') + '</span><span class="ver-store">' + r.count + '/' + MAX + ' \u00b7 ' + (store.ok ? store.free + ' free \u00b7 can store ' + c : esc(store.reason || 'no free pocket')) + '</span></div>';
      }).join('');
      $('verRings').innerHTML = html;
      var l = v.last;
      $('verLast').textContent = l ? l.verdict.replace('_', ' ') + ' \u00b7 ' + cap(l.color) + ' \u00b7 ' + l.beams + ' pill' + (l.beams === 1 ? '' : 's') + ' seen \u00b7 count ' + l.countBefore + '\u2192' + l.countAfter : 'none yet';
      $('verLast').className = l ? (l.verdict === 'VERIFIED' ? 'ok' : 'bad') : '';
    }
    function renderSch(s) {
      $('clockText').textContent = s.clock; $('clockPlay').textContent = s.playing ? 'Pause' : 'Play'; $('clockPlay').setAttribute('aria-pressed', s.playing ? 'true' : 'false');
      $('schedList').innerHTML = s.entries.length ? s.entries.map(function (e) {
        return '<li class="sched-item ' + e.status.toLowerCase() + '"><i class="dot ' + e.color + '"></i><strong>' + e.time + '</strong><span>' + cap(e.color) + (e.tomorrow ? ' \u00b7 tomorrow' : '') + '</span><em>' + e.status + '</em><button type="button" class="mini-button" data-del="' + e.id + '" aria-label="Remove ' + e.color + ' at ' + e.time + '">\u2715</button></li>';
      }).join('') : '<li class="sched-empty">No scheduled pills yet. Pick a colour, a time and press Add.</li>';
      var due = s.due; $('dueBox').hidden = !due; if (due) { $('dueText').textContent = 'DUE: ' + cap(due.color) + ' pill (' + due.time + ')'; }
      var led = mods.led(Date.now()); $('ledState').textContent = 'LED: ' + led.name.split(' (')[0]; $('ledState').style.color = led.css;
    }
    function render(force) {
      var v = ver.snapshot(), s = sch.snapshot();
      var vs = JSON.stringify([v.beam, COLORS.map(function (c) { var r = v.rings[c]; return [r.level, r.count, r.mismatch, r.ready, r.full]; }), v.last && v.last.at]), ss = JSON.stringify([s.clock, s.playing, s.entries, s.due && s.due.id]);
      if (force || vs !== sig.ver) { sig.ver = vs; renderVer(v); }
      if (force || ss !== sig.sch) { sig.sch = ss; renderSch(s); }
      var chk = s.due ? ver.canDispense(s.due.color) : { ok: true, reason: '' };
      $('takeBtn').disabled = !s.due || !chk.ok || Boolean(pending);
      $('takeBtn').title = chk.ok ? '' : chk.reason;
      $('dueReason').textContent = chk.ok ? '' : 'Cannot take now: ' + chk.reason + (/EMPTY/.test(chk.reason) ? '. Refill the ring first.' : '.');
    }

    // ---------- controls ----------
    [['clockPlus1', 1], ['clockPlus15', 15], ['clockPlus60', 60]].forEach(function (e) { $(e[0]).addEventListener('click', function () { sch.advance(e[1]); render(true); }); });
    $('clockPlay').addEventListener('click', function () { sch.setPlaying(!sch.snapshot().playing); render(true); });
    $('clockSet').addEventListener('click', function () { if (!sch.setClock($('clockInput').value)) setMsg('Enter the clock as HH:MM.'); else setMsg(''); render(true); });
    $('schedAdd').addEventListener('click', function () {
      var chosen = document.querySelector('input[name="schedColor"]:checked'), r = sch.add(chosen ? chosen.value : '', $('schedTime').value);
      setMsg(r.ok ? 'Added. Status: ' + r.status + '.' : r.error); render(true);
    });
    $('schedList').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (b) { sch.remove(Number(b.dataset.del)); render(true); } });
    $('takeBtn').addEventListener('click', take);
    $('verifySubsystemToggle').addEventListener('change', function (e) { mods.setVisible('verify', e.target.checked); });
    $('displaySubsystemToggle').addEventListener('change', function (e) { mods.setVisible('display', e.target.checked); });
    mods.setVisible('verify', $('verifySubsystemToggle').checked); mods.setVisible('display', $('displaySubsystemToggle').checked);

    setInterval(function () {
      var now = performance.now(), dt = Math.min(1, (now - lastReal) / 1000); lastReal = now;
      sch.tick(dt); ver.observe(ctl.snapshot ? ctl.snapshot() : ctl.state, now); render(false);
    }, 100);
    render(true);
  }
  init();
}());
