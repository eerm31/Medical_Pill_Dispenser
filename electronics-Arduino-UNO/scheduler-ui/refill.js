(function () {
  'use strict';
  /* Fill layer: the small window that opens when the person presses Fill. It shows a plus button and Done.
     A plus waits a second, then asks whether the pill went in (a sensor will do this later); a Yes counts it, turns the
     cartridge one move to the next position (none after the last pill) and lets Done be pressed. After Done, if the cartridge
     already held pills, the board turns it back to where it was before the refill; then it answers "refill done".
     Whatever the count is when Done is pressed becomes the max of the ring (never more than 11).
     It talks to the board only with the "refill ..." commands and lines (the Refilling System on the board decides),
     and to the page only through window.UISystem. The refill history is kept here, in its own storage key. ASSUMED / NOT VALIDATED. */
  var UI = window.UISystem;
  if (!UI) return;

  var MAX = 11;   // a ring holds at most 11 pills (the board enforces it too)
  var KEY = 'dispenser-ui-refill-' + UI.board.short;
  var ACTIVE = { REFILL_MODE: 1, POSITIONING: 1, WAITING_FOR_REFILL: 1, SAVING_INVENTORY: 1, RETURNING: 1 };
  var ERRORS = {
    NOT_IDLE: 'Another refill is already going on.',
    BAD_RING: 'That ring does not exist.',
    RING_FULL: 'The cartridge is already full.',
    CARTRIDGE_BUSY: 'The cartridge is busy. Wait a few seconds and try again.',
    WRONG_STATE: 'That step is not possible right now.',
    BAD_AMOUNT: 'That number does not fit in the cartridge. Nothing was changed.',
    MOVE_REFUSED: 'The cartridge did not turn. Nothing was changed.',
    STORE_FAILED: 'The pill count could not be saved. Nothing was changed.',
    TIMEOUT: 'The refill took too long and was ended. Nothing was changed.'
  };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag), k;
    for (k in (attrs || {})) {
      if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }
  function plusIcon() {
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), path = document.createElementNS(NS, 'path');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('d', 'M12 5v14M5 12h14');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2.6');
    path.setAttribute('stroke-linecap', 'round');
    svg.appendChild(path);
    return svg;
  }

  // ---------- the refill history: kept for the record, every refill with the real time ----------
  var history = [];
  try { history = (JSON.parse(window.localStorage.getItem(KEY) || '{}').history || []); } catch (e) { history = []; }
  function addRecord(ringId, previous, added, updated, st) {
    var now = Date.now();
    history.unshift({ id: 'refill-' + now + '-' + ringId, ring: ringId, previous: previous, added: added, updated: updated, completedAt: now, status: st });
    try { window.localStorage.setItem(KEY, JSON.stringify({ history: history })); } catch (e) { /* ignore */ }
  }

  // ---------- state ----------
  var status = 'READY', open = false, ring = 0, startedMove = false, wasConnected = false;
  var inRing = 0, added = 0, message = '';
  // one pill at a time: plus -> settling for 1 s -> asking -> (Yes) rotating to the next position -> idle
  var phase = 'idle', settleTimer = null, retryTimer = null, retries = 0;

  // after a cancel with pills in the cartridge the window stays until the person says they are all out (kept over a reload)
  var TAKEOUT = 'dispenser-ui-takeout-' + UI.board.short;
  var takeOut = null;   // {n: pills put in, 0 when not counted}
  try { var kept = JSON.parse(window.localStorage.getItem(TAKEOUT) || 'null'); if (kept && typeof kept.n === 'number') takeOut = { n: kept.n }; } catch (e) { takeOut = null; }
  function setTakeOut(v) {
    takeOut = v;
    try { if (v) window.localStorage.setItem(TAKEOUT, JSON.stringify(v)); else window.localStorage.removeItem(TAKEOUT); } catch (e) { /* ignore */ }
  }

  // ---------- the layer ----------
  var title = el('h3', { id: 'fillTitle', text: 'Fill the cartridge' });
  var info = el('p', { class: 'fill-info' });
  var count = el('div', { class: 'fill-count', 'aria-live': 'polite' });
  var addBtn = el('button', { type: 'button', class: 'fill-add', title: 'Add a pill', 'aria-label': 'Add a pill' }, [plusIcon()]);
  var askText = el('p', { class: 'fill-ask', text: 'Did you put the pill in?' });
  var noBtn = el('button', { type: 'button', text: 'No, undo' });
  var yesBtn = el('button', { type: 'button', class: 'primary', text: 'Yes, it is in' });
  var ask = el('div', { class: 'fill-confirm', role: 'status', hidden: '' }, [askText, el('div', { class: 'modal-buttons' }, [noBtn, yesBtn])]);
  var doneBtn = el('button', { type: 'button', class: 'primary', text: 'Done' });
  var cancelBtn = el('button', { type: 'button', text: 'Cancel' });
  var note = el('p', { class: 'hint badtext', role: 'alert' });
  var sureBox = el('input', { type: 'checkbox', id: 'takeOutSure' });
  var sure = el('label', { class: 'takeout-check', for: 'takeOutSure', hidden: '' }, [sureBox, el('span', { text: ' I have taken out every pill' })]);
  var outBtn = el('button', { type: 'button', class: 'primary', text: 'Confirm', hidden: '' });
  var layer = el('div', { id: 'fillLayer', class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fillTitle', hidden: '' }, [
    el('div', { class: 'modal-content fill-layer' }, [title, info, count, addBtn, ask, sure, note, el('div', { class: 'modal-buttons' }, [cancelBtn, doneBtn, outBtn])])
  ]);
  document.body.appendChild(layer);

  function room() { return MAX - inRing; }

  function render() {
    UI.setRefilling(open);   // the schedules wait while this window is open
    layer.hidden = !open;
    if (!open) return;
    var out = takeOut !== null;
    title.textContent = out ? 'Take the pills out' : 'Fill the cartridge';
    sure.hidden = outBtn.hidden = !out;
    cancelBtn.hidden = doneBtn.hidden = out;
    if (out) {
      count.hidden = addBtn.hidden = ask.hidden = true;
      info.textContent = 'You cancelled. ' + (takeOut.n > 0 ? 'Take the ' + takeOut.n + (takeOut.n === 1 ? ' pill' : ' pills') + ' you put in' : 'Take every pill you put in') + ' out of the cartridge. Tick the box when they are all out.';
      outBtn.disabled = !sureBox.checked;
      note.textContent = '';
      return;
    }
    var ready = status === 'WAITING_FOR_REFILL';
    count.hidden = addBtn.hidden = !(ready || status === 'POSITIONING' || status === 'RETURNING');
    ask.hidden = !(ready && phase === 'asking');
    doneBtn.disabled = !ready || added < 1 || phase !== 'idle';
    addBtn.disabled = !ready || phase !== 'idle' || added >= room();
    count.textContent = String(added);
    if (ready && phase === 'rotating') {
      info.textContent = 'Turning the cartridge to the next position. Please wait.';
    } else if (ready && phase !== 'idle') {
      info.textContent = 'Put one pill into the cartridge.';
    } else if (ready) {
      info.textContent = added >= room() ? 'The cartridge is full. Press Done.' : 'Press the plus button, drop a pill into the cartridge, then confirm it.';
    } else if (status === 'RETURNING') {
      info.textContent = 'Putting the cartridge back where it started. Please wait.';
    } else if (status === 'POSITIONING') {
      info.textContent = 'The cartridge is turning. Please wait.';
    } else if (status === 'ERROR') {
      info.textContent = 'The refill stopped. The pill count was not changed.';
    } else {
      info.textContent = 'Getting the cartridge ready.';
    }
    note.textContent = message;
    // the cartridge cannot be called back while it turns, or after the count is saved
    var stuck = status === 'POSITIONING' || status === 'SAVING_INVENTORY' || status === 'RETURNING' || phase === 'rotating';
    var closing = status === 'ERROR' || (message !== '' && !ACTIVE[status]);
    cancelBtn.textContent = closing ? 'Close' : 'Cancel';
    cancelBtn.disabled = stuck;
    if (phase === 'asking') { if (!ask.contains(document.activeElement)) yesBtn.focus(); }
    else if (ready && document.activeElement !== addBtn && document.activeElement !== doneBtn) addBtn.focus();
  }

  function close() {
    open = false;
    startedMove = false;
    added = 0;
    phase = 'idle';
    window.clearTimeout(settleTimer);
    window.clearTimeout(retryTimer);
    message = '';
    render();
  }

  // a pill goes in one pass: plus, a pause of a second, then the person is asked whether the pill went in
  function settle() {
    phase = 'settling';
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(function () { if (phase === 'settling') { phase = 'asking'; render(); } }, 1000);
    render();
  }
  // the pill is in: the cartridge turns one move so the next free position meets the filling hole
  function turnNext() {
    phase = 'rotating';
    UI.send('refill next');
    render();
  }
  addBtn.addEventListener('click', function () {
    if (phase !== 'idle' || added >= room()) return;
    message = '';
    settle();
  });
  yesBtn.addEventListener('click', function () {
    if (phase !== 'asking') return;
    added++;
    retries = 0;
    if (added < room()) turnNext();   // after the last pill there is no next position
    else { phase = 'idle'; render(); }
  });
  noBtn.addEventListener('click', function () { if (phase === 'asking') { phase = 'idle'; render(); } });
  cancelBtn.addEventListener('click', function () {
    // pills may already be in the cartridge: the window stays until the person confirms they are all out
    if (status === 'WAITING_FOR_REFILL' || added > 0 || phase !== 'idle') setTakeOut({ n: phase === 'idle' ? added : 0 });
    if (ACTIVE[status]) UI.send('refill cancel');   // the board answers CANCELLED
    if (takeOut) render();
    else if (!ACTIVE[status]) close();   // otherwise that answer closes the layer
  });
  sureBox.addEventListener('change', render);
  outBtn.addEventListener('click', function () {
    if (!sureBox.checked) return;
    sureBox.checked = false;
    setTakeOut(null);
    close();
  });
  doneBtn.addEventListener('click', function () {
    if (added < 1) return;
    message = '';
    UI.send('refill add ' + added).then(function () { return UI.send('refill finish'); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open && !takeOut && !cancelBtn.disabled) cancelBtn.click(); });

  // dispensed = 11 - pills left; the cartridge turns back (dispensed - 1) times first, against the doses.
  // An empty cartridge needs no calculation: nothing turns (the filling hole is assumed to be empty)
  function startMoves(pills) {
    var dispensed = pills === 0 ? 0 : Math.max(0, MAX - pills);
    UI.send('refill start ' + Math.max(0, dispensed - 1));
  }
  // the person pressed Fill on a saved schedule (or in the empty state)
  document.addEventListener('ui:refill', function (e) {
    if (open) return;
    ring = e.detail && e.detail.ring >= 0 ? e.detail.ring : 0;
    inRing = UI.ringPills() === null ? 0 : UI.ringPills();
    added = 0;
    phase = 'idle';
    message = '';
    open = true;
    render();
    UI.send('refill request ' + ring);
  });

  // ---------- reading the board ----------
  UI.onLine(function (line) {
    var m;
    if ((m = /^refill status (\w+) ring (-?\d+) pills (\d+)(?: slot \d+)?$/.exec(line))) onStatus(m[1], +m[2], +m[3]);
    else if ((m = /^refill done ring (\d+) prev (\d+) added (\d+) new (\d+)$/.exec(line))) {
      addRecord(+m[1], +m[2], +m[3], +m[4], 'COMPLETED');
      UI.setRingMax(+m[4]);   // whatever the count was when the fill was confirmed is the max
      close();
    } else if ((m = /^refill error (\w+)$/.exec(line))) {
      if (m[1] === 'CARTRIDGE_BUSY' && phase === 'rotating' && retries < 10) {   // still holding its last position: ask again shortly
        retries++;
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(function () { if (phase === 'rotating') turnNext(); }, 1000);
        return;
      }
      message = ERRORS[m[1]] || 'The board refused this step.';
      if (phase === 'rotating') phase = 'idle';   // it did not turn: the pill count is not affected, Done still works
      render();
    }
  });

  function onStatus(s, ringId, pills) {
    var before = status;
    status = s;
    if (ringId >= 0) inRing = pills;
    if (phase === 'rotating' && s === 'WAITING_FOR_REFILL' && before === 'POSITIONING') { phase = 'idle'; }   // it has turned: ready for the next pill
    else if (phase === 'rotating' && s !== 'POSITIONING' && s !== 'WAITING_FOR_REFILL') phase = 'idle';
    if (takeOut) {   // after a cancel: only make sure the board really cancels; the window waits for the person
      if (s === 'REFILL_MODE' || s === 'WAITING_FOR_REFILL') UI.send('refill cancel');
      if (s === 'CANCELLED' && before !== s) addRecord(ring, inRing, 0, inRing, 'CANCELLED');
      render();
      return;
    }
    if (s === 'REFILL_MODE' && open && !startedMove) {
      startedMove = true;
      startMoves(pills);
    } else if (s === 'REFILL_MODE' && !open) {
      UI.send('refill cancel');   // a refill left open by an earlier page: do not turn the cartridge now
    } else if (s === 'WAITING_FOR_REFILL' && !open) {
      ring = ringId; open = true; startedMove = true; added = 0;   // an earlier page left it waiting: carry on here
    }
    if (s === 'CANCELLED' && before !== s) {
      if (open) addRecord(ring, inRing, 0, inRing, 'CANCELLED');
      close();
      return;
    }
    if (s === 'ERROR' && before !== s && open) addRecord(ring, inRing, 0, inRing, 'ERROR');
    render();
  }

  UI.onChange(function () {
    var now = UI.isConnected();
    if (now && !wasConnected) UI.send('refill list');   // learn the refill status after a (re)connect
    wasConnected = now;
  });

  if (takeOut) { open = true; render(); }   // a take-out left unconfirmed before a reload
}());
