(function () {
  'use strict';
  /* Fill layer: the small window that opens when the person presses Fill. It shows a green Add button and Done.
     Whatever the count is when Done is pressed becomes the max of the ring (never more than 11).
     It talks to the board only with the "refill ..." commands and lines (the Refilling System on the board decides),
     and to the page only through window.UISystem. The refill history is kept here, in its own storage key. ASSUMED / NOT VALIDATED. */
  var UI = window.UISystem;
  if (!UI) return;

  var MAX = 11;   // a ring holds at most 11 pills (the board enforces it too)
  var KEY = 'dispenser-ui-refill-' + UI.board.short;
  var ACTIVE = { REFILL_MODE: 1, POSITIONING: 1, WAITING_FOR_REFILL: 1, SAVING_INVENTORY: 1 };
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

  // ---------- the layer ----------
  var title = el('h3', { id: 'fillTitle', text: 'Fill the cartridge' });
  var info = el('p', { class: 'fill-info' });
  var count = el('div', { class: 'fill-count', 'aria-live': 'polite' });
  var addBtn = el('button', { type: 'button', class: 'fill-add', text: '+ Add' });
  var doneBtn = el('button', { type: 'button', class: 'primary', text: 'Done' });
  var cancelBtn = el('button', { type: 'button', text: 'Cancel' });
  var note = el('p', { class: 'hint badtext', role: 'alert' });
  var layer = el('div', { id: 'fillLayer', class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fillTitle', hidden: '' }, [
    el('div', { class: 'modal-content fill-layer' }, [title, info, count, addBtn, note, el('div', { class: 'modal-buttons' }, [cancelBtn, doneBtn])])
  ]);
  document.body.appendChild(layer);

  function room() { return MAX - inRing; }

  function render() {
    layer.hidden = !open;
    if (!open) return;
    var ready = status === 'WAITING_FOR_REFILL';
    count.hidden = addBtn.hidden = !ready;
    doneBtn.disabled = !ready || added < 1;
    addBtn.disabled = !ready || added >= room();
    if (ready) {
      info.textContent = 'Put the pills in, and press + Add for each one. In the cartridge now: ' + inRing + '.';
      count.textContent = 'Adding ' + added + '  \u2192  ' + (inRing + added) + ' in total' + (added >= room() ? ' (full)' : '');
    } else if (status === 'POSITIONING') {
      info.textContent = 'The cartridge is turning one step. Please wait.';
    } else if (status === 'ERROR') {
      info.textContent = 'The refill stopped. The pill count was not changed.';
    } else {
      info.textContent = 'Getting the cartridge ready.';
    }
    note.textContent = message;
    // the cartridge cannot be called back while it turns, or after the count is saved
    var stuck = status === 'POSITIONING' || status === 'SAVING_INVENTORY';
    var closing = status === 'ERROR' || (message !== '' && !ACTIVE[status]);
    cancelBtn.textContent = closing ? 'Close' : 'Cancel';
    cancelBtn.disabled = stuck;
    if (ready && document.activeElement !== addBtn && document.activeElement !== doneBtn) addBtn.focus();
  }

  function close() {
    open = false;
    startedMove = false;
    added = 0;
    message = '';
    render();
  }

  addBtn.addEventListener('click', function () { if (added < room()) { added++; render(); } });
  cancelBtn.addEventListener('click', function () {
    if (ACTIVE[status]) UI.send('refill cancel');   // the board answers CANCELLED and the layer closes
    else close();
  });
  doneBtn.addEventListener('click', function () {
    if (added < 1) return;
    message = '';
    UI.send('refill add ' + added).then(function () { return UI.send('refill finish'); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open && !cancelBtn.disabled) cancelBtn.click(); });

  // the person pressed Fill on a saved schedule (or in the empty state)
  document.addEventListener('ui:refill', function (e) {
    if (open) return;
    ring = e.detail && e.detail.ring >= 0 ? e.detail.ring : 0;
    inRing = UI.ringPills() === null ? 0 : UI.ringPills();
    added = 0;
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
      message = ERRORS[m[1]] || 'The board refused this step.';
      render();
    }
  });

  function onStatus(s, ringId, pills) {
    var before = status;
    status = s;
    if (ringId >= 0) inRing = pills;
    if (s === 'REFILL_MODE' && open && !startedMove) {
      startedMove = true;
      UI.send('refill start');   // pressing Fill is the person's go-ahead for the one step
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
}());
