(function () {
  'use strict';
  // Step-by-step player for every movement in the concept viewer. Controller-driven runs are paused at
  // phase boundaries from outside; demo-controller.js is never modified. ASSUMED / NOT_VALIDATED visuals.
  var host = window.DispenserStepHost;
  if (!host) return;
  var ctl = host.controller, COLORS = ['red', 'blue', 'green', 'orange'];
  var $ = function (id) { return document.getElementById(id); };
  var selectEl = $('stepAnimSelect'), colorEl = $('stepAnimColor'), colorRow = $('stepAnimColorRow');
  var nextBtn = $('stepAnimNext'), playBtn = $('stepAnimPlay'), restartBtn = $('stepAnimRestart'), backBtn = $('stepAnimBack');
  var listEl = $('stepAnimSteps'), statusEl = $('stepAnimStatus'), countEl = $('stepAnimCount'), barEl = $('stepAnimBar');

  function phx(n) { var look = window.DispenserReferenceLook, r = look && look.ringLabel && look.ringLabel(n); return r || PH[n]; }
  var PH = {
    DRUM_ROTATE: ['Turn the drum', 'The drum turns until the selected compartment is over the outlet.'],
    CARRIAGE_APPROACH: ['Pin carriage lines up', 'The pin carriage moves so the engagement pin sits under the selected blade tab.'],
    PIN_ENGAGE: ['Pin drops into the tab slot', 'The engagement pin moves down into the slot of the blade tab.'],
    BLADE_PULL_RELEASE: ['Upper blade opens', 'The crank pulls the blade 10.4 mm; the bore opens and the stack falls onto the lower tongue.'],
    STACK_SETTLE: ['Bottom pill settles', 'The bottom pill settles onto the closed lower tongue.'],
    BLADE_ISOLATE_CLOSE: ['Blade closes', 'The blade slides back and its wedge nose isolates the rest of the stack.'],
    BLADE_CLOSED_DWELL: ['Blade closed (dwell)', 'Short pause with the blade fully closed.'],
    PIN_LIFT: ['Pin lifts out', 'The engagement pin lifts out of the tab slot.'],
    TONGUE_RELEASE: ['Lower tongue opens', 'The shared lower tongue opens and releases the single pill.'],
    PILL_CLEAR: ['Pill falls clear', 'The pill falls through the outlet into the tray.'],
    TONGUE_RETURN: ['Lower tongue returns', 'The lower tongue springs back to closed.'],
    PACKAGE_IN: ['Package slides in', 'A fictional package slides to the scanner.'],
    BEAM: ['Scan beam reads the code', 'The scan beam reads the fictional barcode.'],
    SCAN_RESULT: ['Scan result', 'The scan result is shown and the matching compartment is chosen.'],
    PACKAGE_PLACE: ['Container is placed', 'An empty fictional container moves into the matching compartment.'],
    PACKAGE_OUT: ['Package slides out', 'The package leaves the scanner.'],
    CAP_OPEN: ['Matching cap opens', 'Only the matching simulated cap opens.'],
    CAP_CLOSE: ['Cap closes and locks', 'The cap closes and locks again.'],
    CARTRIDGE_LIFT: ['Cartridge lifts out', 'The compartment cartridge lifts straight up and out.'],
    CARTRIDGE_INSERT: ['Cartridge lowers back in', 'The compartment cartridge is lowered back into its socket.']
  };
  function phaseSteps(names) {
    return names.map(function (n) { return { label: phx(n)[0], text: phx(n)[1], kind: 'gate' }; });
  }
  function cap(c) { return c.charAt(0).toUpperCase() + c.slice(1); }
  function anyCapOpen(s) { return COLORS.some(function (c) { return s.cartridges[c].capOpen; }); }
  function busy(s) { return s.operation !== null || s.phase !== 'PARKED' ? 'the mechanism is busy' : null; }
  function codeFor(color) {
    return Object.keys(host.barcodes).filter(function (k) { return host.barcodes[k] === color; })[0];
  }
  function localStep(label, text, act, done) { return { label: label, text: text, kind: 'local', act: act, done: done }; }

  var look = function () { return window.DispenserReferenceLook; };
  var ringMag = function () { var l = look(); return l && l.ringMagazine; }, ringOn = function () { var l = look(); return Boolean(l && l.ringActive && l.ringActive()); };
  var rfIdle = function () { var m = ringMag(); return !m || !m.refill.state().busy; };
  var removalDone = function () { var l = look(); return !l || !l.removalSettled || l.removalSettled(); };

  var ANIMS = [
    {
      id: 'load', legacy: true, label: 'Load a compartment (scan, place, fill)', color: true, view: 'main',
      check: function (s, c) {
        var k = s.cartridges[c];
        return busy(s) || (anyCapOpen(s) ? 'close the open cap first' : null) || (!k.present ? 'cartridge removed' : null) ||
          (k.occupancy !== 'empty' ? 'already loaded' : null);
      },
      steps: function (s, c) {
        var list = phaseSteps(['PACKAGE_IN', 'BEAM', 'SCAN_RESULT', 'PACKAGE_PLACE', 'PACKAGE_OUT', 'CAP_OPEN']);
        list[0].act = function () { return ctl.scan(codeFor(c), performance.now()); };
        list.push({ label: 'Fill (explicit)', text: 'Fictional pills are added to the open compartment. Nothing is filled automatically.', kind: 'instant', act: function () { return ctl.fill(c); } });
        var close = phaseSteps(['CAP_CLOSE'])[0]; close.act = function () { return ctl.closeCap(c); };
        list.push(close);
        return list;
      }
    },
    {
      id: 'ringrefill', ring: true, label: 'Refill a ring (open lid, pour, close)', color: true, view: 'main',
      check: function (s, c) { var m = ringMag(); return busy(s) || (!m ? 'not available' : null) || (s.cartridges[c].count >= 5 ? 'ring already full' : (m.refill.state().busy ? 'the mechanism is busy' : null)); },
      steps: function (s, c) {
        var m = ringMag(), k = COLORS.indexOf(c), have = s.cartridges[c].count, n = 5 - have, rf = m.refill, list = [];
        list.push(localStep('Lid hinges open', 'The service lid swings up on its back hinge. Nothing sits above the rings, so every pocket is open from the top.', function () { return rf.openLid(); }, function () { return rfIdle() && rf.state().lidOpen; }));
        list.push(localStep(cap(c) + ' ring selected', 'An amber ring marks the next empty pocket of the ' + c + ' ring. The ring and the arm stay where they are.', function () { return rf.select(k); }, rfIdle));
        for (var i = 1; i <= n; i++) {
          list.push(localStep('Pill ' + (have + i) + ' of 5: pour', 'A pill bottle tips over the amber pocket and one pill drops between two dividers. The next empty pocket is marked.', function () { return rf.drop(); }, rfIdle));
        }
        list.push(localStep('Lid hinges closed', 'The lid closes and the inventory is updated. The first pill sits right before the exit slot, ready to dispense.', function () { return rf.closeLid(); }, function () { return rfIdle() && rf.state().lidClosed; }));
        return list;
      }
    },
    {
      id: 'dispense', label: 'Dispense a pill (phase by phase)', color: true, view: 'main',
      check: function (s, c) {
        var k = s.cartridges[c];
        return busy(s) || (anyCapOpen(s) ? 'close every open cap first' : null) || (!k.present ? 'cartridge removed' : null) ||
          (k.occupancy !== 'loaded' || k.count < 1 ? 'load this compartment first' : null);
      },
      steps: function (s, c) {
        var target = COLORS.indexOf(c) * Math.PI / 2, delta = Math.atan2(Math.sin(target - s.drumAngle), Math.cos(target - s.drumAngle));
        var names = (Math.abs(delta) > 0.001 ? ['DRUM_ROTATE'] : []).concat(['CARRIAGE_APPROACH', 'PIN_ENGAGE', 'BLADE_PULL_RELEASE', 'STACK_SETTLE',
          'BLADE_ISOLATE_CLOSE', 'BLADE_CLOSED_DWELL', 'PIN_LIFT', 'TONGUE_RELEASE', 'PILL_CLEAR', 'TONGUE_RETURN']);
        var list = phaseSteps(names);
        list[0].act = function () { return ctl.requestDispense(c); };
        return list;
      }
    },
    {
      id: 'exchange', legacy: true, label: 'Remove and re-insert a cartridge', color: true, view: 'main',
      check: function (s, c) {
        var k = s.cartridges[c];
        return busy(s) || (k.capOpen || k.cap === 'unlocked' ? 'close and lock the cap first' : null) || (!k.present ? 'cartridge already removed' : null);
      },
      steps: function (s, c) {
        var list = phaseSteps(['CARTRIDGE_LIFT', 'CARTRIDGE_INSERT']);
        list[0].act = function () { return ctl.exchange(c); };
        list[1].act = function () { return ctl.exchange(c); };
        return list;
      }
    },
    {
      id: 'schedule', label: 'Six-request schedule (phase by phase)', view: 'main', dynamic: true,
      check: function (s) {
        var need = {};
        host.schedule.forEach(function (c) { need[c] = (need[c] || 0) + 1; });
        var short = COLORS.filter(function (c) { var k = s.cartridges[c]; return need[c] && (k.occupancy !== 'loaded' || k.count < need[c]); });
        return busy(s) || (anyCapOpen(s) ? 'close every open cap first' : null) || (short.length ? 'load ' + short.join(', ') + ' first' : null);
      },
      steps: function () {
        var list = host.schedule.map(function (c, i) { return { label: 'Request ' + (i + 1) + ': ' + cap(c), text: '', kind: 'gate' }; });
        list[0].act = function () { return ctl.startSchedule('once'); };
        return list;
      }
    },
    {
      id: 'rotate', settled: function () { return host.rotationSettled(); }, restore: function (k) { host.rotationTo(k >= 4 ? 0 : k * Math.PI / 2); }, label: 'Drum rotation: index, then go home', view: 'rotation',
      check: function (s) { return s.operation !== null ? 'the mechanism is busy' : null; },
      steps: function () {
        var quarter = function (n) { return localStep('Index 90° (' + n + ' of 3)', 'The stepper turns the drum one quarter turn to the next compartment.', function () { host.spin(Math.PI / 2); return true; }, host.rotationSettled); };
        return [quarter(1), quarter(2), quarter(3),
          localStep('Go home', 'The drum turns back to the Hall-sensor home mark (magnet at home).', function () { host.home(); return true; }, host.rotationSettled)];
      }
    },
    {
      id: 'removal', settled: function () { return removalDone(); }, restore: function (k) { host.removalTo(k); }, label: 'Compartment removal (lift straight up)', color: true, view: 'compartment',
      check: function () { return null; },
      steps: function (s, c) {
        var adv = function () { host.removalAdvance(); return true; }, n = cap(c);
        return [localStep('Held on the deck', 'The ' + n + ' compartment sits on its deck, held by two clips over the catch ledges.', adv, removalDone),
          localStep('Clips flex outward', 'Pull up: each clip flexes outward about 0.7 mm so the hooks clear the ledges.', adv, removalDone),
          localStep('Lift straight up and out', 'The ' + n + ' compartment lifts straight up (50 mm shown). No tools are needed.', adv, removalDone),
          localStep('Lower it back in', 'The hooks snap over the ledges and the compartment is held again.', adv, removalDone)];
      }
    },
    {
      id: 'blade', settled: function () { return removalDone(); }, restore: function (k) { host.bladeSet(k === 1 ? 1 : 0); }, label: 'Blade slide (closed, open, closed)', color: true, view: 'compartment',
      check: function () { return null; },
      steps: function () {
        return [localStep('Blade slides open', 'The pin pulls the slotted tab; the blade slides 10.4 mm along the rails and the bore opens.', function () { host.bladeSet(1); return true; }, removalDone),
          localStep('Blade slides closed', 'The spring returns the blade; its wedge nose closes the bore again.', function () { host.bladeSet(0); return true; }, removalDone)];
      }
    }
  ];
  var BY_ID = {};
  ANIMS.forEach(function (a) { BY_ID[a.id] = a; });

  var run = null, lastSig = '', lastCheck = 0, lastView = host.view();

  function state() { return ctl.state; }
  function reasonFor(anim, color) { return anim.check(state(), color || colorEl.value); }
  function firstColor(anim) {
    return COLORS.filter(function (c) { return !anim.check(state(), c); })[0] || null;
  }
  function animReason(anim) {
    if (!anim.color) return anim.check(state());
    return firstColor(anim) ? null : anim.check(state(), COLORS[0]);
  }

  function visibleAnims() {
    var view = host.view();
    var ring = ringOn();
    return ANIMS.filter(function (a) { return a.view === view && !(a.ring && !ring) && !(a.legacy && ring); });
  }

  // Returns false when nothing in the current view moves (for example the stepper mount).
  function refreshOptions(keep) {
    var current = selectEl.value, list = visibleAnims();
    selectEl.replaceChildren();
    selectEl.disabled = !list.length;
    restartBtn.disabled = !list.length;
    if (!list.length) {
      var none = document.createElement('option');
      none.textContent = 'No movements in this view'; none.disabled = true; none.selected = true;
      selectEl.appendChild(none);
      colorRow.hidden = true; listEl.replaceChildren(); run = null;
      nextBtn.textContent = 'Start'; nextBtn.disabled = true; backBtn.disabled = true; playBtn.textContent = 'Play all'; playBtn.disabled = true;
      countEl.textContent = 'No animation'; barEl.style.width = '0%'; lastBar = '';
      status('Nothing moves in this view. Pick another system under Systems to see its animations');
      return false;
    }
    list.forEach(function (a) {
      var reason = animReason(a), o = document.createElement('option');
      o.value = a.id; o.textContent = a.label + (reason ? ' (' + reason + ')' : ''); o.disabled = Boolean(reason);
      selectEl.appendChild(o);
    });
    var pick = list.filter(function (a) { return a.id === current; })[0] || list[0];
    if (!keep && animReason(pick)) pick = list.filter(function (a) { return !animReason(a); })[0] || pick;
    selectEl.value = pick.id;
    refreshColors(keep);
    return true;
  }

  function refreshColors(keep) {
    var anim = BY_ID[selectEl.value], current = colorEl.value;
    colorRow.hidden = !anim.color;
    colorEl.replaceChildren();
    COLORS.forEach(function (c) {
      var reason = anim.color ? anim.check(state(), c) : null, o = document.createElement('option');
      o.value = c; o.textContent = cap(c) + (reason ? ' (' + reason + ')' : ''); o.disabled = Boolean(reason);
      colorEl.appendChild(o);
    });
    var usable = COLORS.indexOf(current) >= 0 && !(anim.color && anim.check(state(), current));
    colorEl.value = keep || usable ? (current || 'red') : (firstColor(anim) || 'red');
  }

  function newRun() {
    var anim = BY_ID[selectEl.value];
    if (!anim || selectEl.disabled) return;
    var color = anim.color ? colorEl.value : null;
    run = { anim: anim, color: color, steps: anim.steps(state(), color), i: 0, busy: false, complete: false, auto: false, gate: false, local: null, idleSince: 0 };
    render();
  }

  // A run that was left mid-way is finished at normal speed by dropping the pause.
  function abortRun() {
    if (!run) return;
    var anim = run.anim;
    if (anim.view === 'compartment' && run.i > 0) host.removalReset();
    run = null;
  }

  var DISCLAIMER = 'Fictional concept demo, ASSUMED / NOT_VALIDATED.';
  function status(text) { statusEl.textContent = text ? text + '. ' + DISCLAIMER : DISCLAIMER; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  // Busy buttons stay focusable (aria-disabled) so keyboard use is not interrupted; hard-disabled ones hand focus to Next.
  function setButton(btn, hard, soft) {
    var hadFocus = document.activeElement === btn;
    btn.disabled = hard;
    btn.setAttribute('aria-disabled', hard || soft ? 'true' : 'false');
    if (hard && hadFocus && !nextBtn.disabled) nextBtn.focus();
  }
  function playedCount() { return run.complete ? run.steps.length : (run.busy && !run.backing ? run.i - 1 : run.i); }

  function render() {
    if (!run) return;
    var a = run.anim, s = state(), n = run.steps.length, reason = !run.busy && (run.i === 0 || run.complete) ? reasonFor(a) : null;
    var played = playedCount(), current = a.dynamic ? (s.schedule.active ? s.schedule.index - 1 : 0) : played;
    listEl.replaceChildren();
    run.steps.forEach(function (st, idx) {
      var done = run.complete || (a.dynamic ? run.i > 0 && idx < current : idx < played);
      var playing = run.busy && !run.backing && idx === (a.dynamic ? current : run.i - 1);
      var next = !run.busy && !run.complete && !done && idx === (a.dynamic ? (run.i > 0 ? current : 0) : run.i);
      var li = el('li', (done ? 'done ' : '') + (playing ? 'playing ' : '') + (next ? 'next' : ''));
      li.appendChild(el('span', 'step-num', done ? '\u2713' : String(idx + 1)));
      var body = el('div', 'step-body');
      body.appendChild(el('strong', '', st.label));
      var text = a.dynamic ? (run.i > 0 && PH[s.phase] ? phx(s.phase)[1] : '') : st.text;
      if ((playing || next) && text) body.appendChild(el('small', '', text));
      li.appendChild(body);
      if (playing) li.setAttribute('aria-current', 'step');
      listEl.appendChild(li);
    });
    var unit = a.dynamic ? 'Request ' + (current + 1) : 'Step ' + run.i;
    countEl.textContent = reason && run.i === 0 ? 'Not available' : run.complete ? 'Complete \u00b7 ' + n + (a.dynamic ? ' requests' : ' steps')
      : run.backing ? 'Going back\u2026' : run.busy ? unit + ' of ' + n + ' \u00b7 playing'
      : run.i === 0 ? 'Ready \u00b7 ' + n + (a.dynamic ? ' requests' : ' steps') : unit + ' of ' + n + ' \u00b7 paused';
    nextBtn.textContent = run.busy ? 'Playing\u2026' : run.complete ? 'Replay' : run.i === 0 ? 'Start' : 'Next step';
    setButton(nextBtn, Boolean(reason), run.busy);
    nextBtn.title = !run.busy && !run.complete && !a.dynamic && run.steps[run.i] ? 'Play: ' + run.steps[run.i].label : '';
    setButton(backBtn, run.i === 0 || !a.restore, run.busy);
    backBtn.title = a.restore ? 'Go back one step' : 'A run driven by the controller cannot be rewound; use Restart';
    playBtn.textContent = run.auto ? 'Pause' : 'Play all';
    setButton(playBtn, !run.auto && Boolean(reason), !run.auto && run.busy);
    status(run.busy ? '' : run.complete ? (reason ? 'Finished. Replay is not available (' + reason + ')' : 'Finished. Press Replay to watch it again')
      : reason ? 'Not available: ' + reason : run.i === 0 ? 'Press Start, then Next step for each movement'
      : 'Paused. Press Next step' + (a.dynamic ? ' for the next phase' : ' to play "' + run.steps[run.i].label + '"'));
    lastBar = ''; updateProgress();
  }

  var lastBar = '';
  function updateProgress() {
    if (!run) return;
    var n = run.steps.length, s = state(), done = playedCount(), within = 0;
    if (run.anim.dynamic) done = run.complete ? n : (s.schedule.active ? s.schedule.index - 1 : 0);
    else if (run.busy && !run.backing) within = run.gate ? s.phaseProgress : 0.5;
    var pct = String(Math.round(Math.min(1, (done + within) / n) * 100));
    if (pct === lastBar) return;
    lastBar = pct; barEl.style.width = pct + '%'; barEl.parentNode.setAttribute('aria-valuenow', pct);
  }

  function back() {
    if (!run || run.busy || run.i === 0 || !run.anim.restore) return;
    run.complete = false; run.auto = false; run.i -= 1; run.backing = true; run.busy = true;
    run.anim.restore(run.i);
    run.local = run.anim.settled;
    render();
  }

  function startNext() {
    if (!run || run.busy) return;
    if (run.complete) { var auto = run.auto; newRun(); run.auto = auto; }
    var a = run.anim;
    if (run.i === 0) {
      var reason = reasonFor(a);
      if (reason) { render(); return; }
      if (a.view === 'compartment') host.setRemovalColor(run.color);
    }
    var step = a.dynamic && run.i > 0 ? { kind: 'gate' } : run.steps[run.i];
    if (step.act && !step.act()) { status('Refused: ' + (state().rejection || 'step not possible')); run.auto = false; render(); return; }
    run.i += 1; run.idleSince = performance.now();
    if (step.kind === 'instant' || (step.kind === 'gate' && ctl.idle())) { settle(); return; }
    run.busy = true;
    if (step.kind === 'gate') run.gate = true;
    else run.local = step.done;
    render();
  }

  function settle() {
    run.busy = false; run.backing = false; run.gate = false; run.local = null; run.idleSince = performance.now();
    var s = state();
    if (run.anim.dynamic ? (ctl.idle() && !s.schedule.active) : run.i >= run.steps.length) { run.complete = true; run.auto = false; }
    render();
  }

  var lastRing = false;
  function refreshIfChanged(now) {
    if (ringOn() !== lastRing) { lastRing = ringOn(); abortRun(); lastSig = ''; if (refreshOptions(false)) newRun(); return; }
    if (host.view() !== lastView) {
      lastView = host.view(); abortRun(); lastSig = '';
      if (refreshOptions(false)) newRun();
      return;
    }
    if (now - lastCheck < 250) return;
    lastCheck = now;
    var s = state();
    if (run && run.i > 0 && !run.complete) return;
    var sig = (s.operation !== null) + '|' + COLORS.map(function (c) { var k = s.cartridges[c]; return [k.present, k.occupancy, k.count, k.cap, k.capOpen].join(); }).join(';') + '|' + (run ? run.complete : '-');
    if (sig === lastSig) return;
    lastSig = sig;
    if (run && run.complete) { refreshOptions(true); render(); return; }
    var sel = selectEl.value, col = colorEl.value;
    refreshOptions(false);
    if (!run || sel !== selectEl.value || col !== colorEl.value) newRun(); else render();
  }

  function tick(dt, now) {
    try {
      refreshIfChanged(now);
      updateProgress();
      if (run && run.auto && !run.busy && !run.complete && now - run.idleSince > 450) startNext();
      if (run && run.local && run.local()) settle();
      if (run && run.gate) {
        var s = state(), speed = Math.max(s.speed, 1e-6), before = { p: s.phase, t: s.transitionIndex, o: s.operation };
        var snap = ctl.tick(Math.min(dt, s.remaining / speed + 1e-6), now);
        if (s.phase !== before.p || s.transitionIndex !== before.t || s.operation !== before.o) settle();
        return snap;
      }
      if (run && !run.busy && !run.complete && run.i > 0 && !ctl.idle()) return ctl.snapshot();
    } catch (error) {
      if (window.console) console.error('Step-by-step player failed; falling back to free running.', error);
      run = null;
    }
    return ctl.tick(dt, now);
  }

  selectEl.addEventListener('change', function () {
    abortRun();
    refreshColors(false);
    newRun();
  });
  colorEl.addEventListener('change', function () { abortRun(); newRun(); });
  nextBtn.addEventListener('click', startNext);
  backBtn.addEventListener('click', back);
  $('stepAnim').addEventListener('keydown', function (e) {
    if (e.target.tagName !== 'BUTTON') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); startNext(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
  });
  playBtn.addEventListener('click', function () {
    if (!run) return;
    if (run.auto) { run.auto = false; render(); return; }
    run.auto = true;
    if (!run.busy) startNext(); else render();
  });
  restartBtn.addEventListener('click', function () { abortRun(); lastSig = ''; if (refreshOptions(false)) newRun(); });

  if (refreshOptions(false)) newRun();
  window.DispenserStepAnimations = { tick: tick, animations: ANIMS.map(function (a) { return a.id; }) };
}());
