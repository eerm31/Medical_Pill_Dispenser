(function () {
  'use strict';
  /* Set-up window. The shimmering Fill button on an empty schedule opens it. It asks for the medication one thing at a time,
     ends with an Add button, then shows the schedule so the person can edit it, cancel, renew (start over) or confirm.
     Confirm saves the schedule to the board and offers the refill. It reaches the page only through window.UISystem.
     ASSUMED / NOT VALIDATED. */
  var UI = window.UISystem;
  if (!UI) return;

  var STEPS = ['name', 'time', 'pills', 'repeat', 'add'];
  var data = blank(), step = 0, view = 'steps', msg = '', staged = null;   // view: steps, review, saving or done

  function el(tag, attrs, kids) {
    var n = document.createElement(tag), k;
    for (k in (attrs || {})) {
      if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }
  function button(text, cls, onClick, type) {
    var b = el('button', { type: type || 'button', class: cls || '', text: text });
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }
  function blank() { return { name: '', time: '', pills: '1', recurNum: '', recurUnit: '' }; }
  function recurOf() { return data.recurUnit && Number(data.recurNum) ? { num: Number(data.recurNum), unit: data.recurUnit } : null; }
  function turns(n) { return 'The cartridge turns ' + n + (n === 1 ? ' time' : ' times') + ' at every dose, once for each pill.'; }

  // ---------- the layer ----------
  var body = el('div', { class: 'wizard-body' });
  var layer = el('div', { id: 'setupLayer', class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Set up a medication', hidden: '' }, [
    el('div', { class: 'modal-content wizard' }, [body])
  ]);
  document.body.appendChild(layer);

  function open() {
    if (!layer.hidden) return;
    data = blank(); step = 0; view = 'steps'; msg = ''; staged = null;
    layer.hidden = false;
    render();
  }
  function close() {
    layer.hidden = true;
    data = blank(); staged = null;
  }

  // the problem with one step's answer, or an empty text
  function problem(which) {
    var p = Number(data.pills), n = Number(data.recurNum);
    if (which === 'name' && !data.name.trim()) return 'Type the name of the medication.';
    if (which === 'time' && UI.parseTime(data.time) === null) return 'Choose a time.';
    if (which === 'pills' && !(p >= 1 && p <= UI.maxPills && Math.floor(p) === p)) return 'Enter a whole number from 1 to ' + UI.maxPills + '.';
    if (which === 'repeat') {
      if (data.recurUnit && !(n >= 1 && n <= 24 && Math.floor(n) === n)) return 'Enter a whole number from 1 to 24.';
      if (!data.recurUnit && data.recurNum !== '') return 'Choose hours, minutes or seconds, or choose No repeat.';
    }
    return '';
  }

  // ---------- the steps, one question each ----------
  function renderStep() {
    var which = STEPS[step], last = which === 'add';
    var form = el('form', { novalidate: '' });
    var help = el('p', { class: 'wizard-help' });
    form.appendChild(el('div', { class: 'wizard-step', text: 'Step ' + (step + 1) + ' of ' + STEPS.length }));

    if (which === 'name') {
      form.appendChild(el('h3', { text: 'What is the medication called?' }));
      var name = el('input', { type: 'text', maxlength: '40', placeholder: 'Medication name', autocomplete: 'off', 'aria-label': 'Medication name', value: data.name });
      name.addEventListener('input', function () { data.name = name.value; });
      form.appendChild(name);
    } else if (which === 'time') {
      form.appendChild(el('h3', { text: 'At what time is the first dose?' }));
      var time = el('input', { type: 'time', 'aria-label': 'Time of the first dose', value: data.time });
      time.addEventListener('input', function () { data.time = time.value; });
      form.appendChild(time);
    } else if (which === 'pills') {
      form.appendChild(el('h3', { text: 'How many pills in each dose?' }));
      var pills = el('input', { type: 'number', min: '1', max: String(UI.maxPills), step: '1', 'aria-label': 'Pills in each dose', value: data.pills });
      var showTurns = function () { var n = Number(data.pills); help.textContent = n >= 1 ? turns(n) : ''; };
      pills.addEventListener('input', function () { data.pills = pills.value; showTurns(); });
      form.appendChild(pills);
      showTurns();
    } else if (which === 'repeat') {
      form.appendChild(el('h3', { text: 'Should the dose repeat?' }));
      var num = el('input', { type: 'number', min: '1', max: '24', step: '1', 'aria-label': 'Repeat every', placeholder: 'Every', value: data.recurNum });
      var unit = el('select', { 'aria-label': 'Repeat unit' }, [
        el('option', { value: '', text: 'No repeat' }), el('option', { value: 'h', text: 'Hours' }),
        el('option', { value: 'm', text: 'Minutes' }), el('option', { value: 's', text: 'Seconds' })
      ]);
      unit.value = data.recurUnit;
      num.addEventListener('input', function () { data.recurNum = num.value; });
      unit.addEventListener('change', function () { data.recurUnit = unit.value; });
      form.appendChild(el('div', { class: 'wizard-repeat' }, [num, unit]));
      help.textContent = 'Leave it on No repeat for a single dose at that time.';
    } else {
      form.appendChild(el('h3', { text: 'Everything is filled in' }));
      help.textContent = 'Press Add to put "' + data.name.trim() + '" on the schedule. You will see it before it is saved.';
    }
    form.appendChild(help);
    if (last) form.appendChild(button('Add', 'wizard-add', null, 'submit'));
    form.appendChild(el('p', { class: 'hint badtext wizard-msg', role: 'alert', text: msg }));

    var back = button('Back', '', function () { msg = ''; step--; render(); });
    back.disabled = step === 0;
    var row = [button('Cancel', '', close), back];
    if (!last) row.push(button('Next', 'primary', null, 'submit'));
    form.appendChild(el('div', { class: 'modal-buttons' }, row));

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (last) { msg = ''; view = 'review'; render(); return; }
      msg = problem(which);
      if (!msg) step++;
      render();
    });
    body.appendChild(form);
  }

  // ---------- the schedule to confirm ----------
  function renderReview() {
    var rows = [
      ['Medication', data.name.trim()],
      ['First dose', UI.time12(data.time)],
      ['Pills per dose', data.pills],
      ['Repeat', recurOf() ? UI.recurText(recurOf()) : 'Does not repeat']
    ];
    body.appendChild(el('h3', { text: 'Check the schedule' }));
    body.appendChild(el('p', { class: 'wizard-help', text: 'Is this right? ' + turns(Number(data.pills)) }));
    body.appendChild(el('div', { class: 'wizard-summary' }, rows.map(function (r) {
      return el('div', {}, [el('span', { text: r[0] }), el('strong', { text: r[1] })]);
    })));
    body.appendChild(el('p', { class: 'hint badtext wizard-msg', role: 'alert', text: msg }));
    body.appendChild(el('div', { class: 'modal-buttons wizard-four' }, [
      button('Cancel', '', close),
      button('Renew', '', function () { data = blank(); step = 0; view = 'steps'; msg = ''; render(); }),
      button('Edit', '', function () { step = 0; view = 'steps'; msg = ''; render(); }),
      button('Confirm', 'primary', confirmSchedule)
    ]));
  }

  function confirmSchedule() {
    var res = UI.confirmSchedule({ name: data.name.trim(), time: data.time, pills: Number(data.pills), recur: recurOf() });
    if (res.errors.length) { msg = res.errors.join(' '); render(); return; }
    staged = res.item;
    msg = '';
    view = 'saving';
    render();
  }

  UI.onSave(function (ok, text) {
    if (view !== 'saving') return;
    if (ok) view = 'done';
    else { UI.discardStaged(staged); staged = null; view = 'review'; msg = text; }
    render();
  });

  function renderSaving() {
    body.appendChild(el('h3', { text: 'Saving to the Arduino...' }));
    body.appendChild(el('p', { class: 'wizard-help', text: 'Please wait.' }));
  }

  function renderDone() {
    body.appendChild(el('h3', { text: 'Schedule saved' }));
    body.appendChild(el('p', { class: 'wizard-help', text: 'The Arduino turns the cartridge by itself at these times. It cannot give a dose until there are pills in the cartridge, so fill it next.' }));
    body.appendChild(el('div', { class: 'modal-buttons' }, [
      button('Later', '', close),
      button('Fill the cartridge', 'primary', function () {
        close();
        document.dispatchEvent(new CustomEvent('ui:refill', { detail: { ring: 0 } }));
      })
    ]));
  }

  function render() {
    body.replaceChildren();
    if (view === 'steps') renderStep();
    else if (view === 'review') renderReview();
    else if (view === 'saving') renderSaving();
    else renderDone();
    var first = body.querySelector('input, select, .wizard-add, .primary');
    if (first) first.focus();
  }

  document.addEventListener('ui:setup', open);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !layer.hidden && view !== 'saving') close(); });
}());
