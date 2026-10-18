(function () {
  'use strict';
  var Model = window.Feature004Model;
  var fixtures = window.FEATURE004_FIXTURES;
  var state = Model.initialState();
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('[role="tab"][data-view]'));
  var viewPanels = {
    subsystem1: document.getElementById('view-subsystem1'),
    subsystem2: document.getElementById('view-subsystem2'),
    overall: document.getElementById('view-overall')
  };
  var subsystem1Card = document.getElementById('subsystem1Template').content.firstElementChild.cloneNode(true);
  var subsystem2Card = document.getElementById('subsystem2Template').content.firstElementChild.cloneNode(true);
  var parkedPanels = document.createElement('div');
  parkedPanels.hidden = true;
  parkedPanels.setAttribute('aria-hidden', 'true');
  document.body.appendChild(parkedPanels);

  var includeSubsystem1 = document.getElementById('includeSubsystem1');
  var includeSubsystem2 = document.getElementById('includeSubsystem2');
  var emptyComposition = document.getElementById('emptyComposition');
  var composition = document.querySelector('.overall-grid');
  var scannerSvg = subsystem2Card.querySelector('.scanner-diagram');
  var sampleContainer = scannerSvg.querySelector('[data-scanner-part="sample-container"]');
  var placementPackages = {};
  var resetMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  Model.compartmentDefinitions.forEach(function (compartment, index) {
    var marker = index === 0 ? scannerSvg.querySelector('#placementPackage') : sampleContainer.cloneNode(true);
    if (index === 0) marker.innerHTML = sampleContainer.innerHTML;
    marker.removeAttribute('data-scanner-part');
    marker.removeAttribute('class');
    marker.id = 'placed-container-' + compartment.color;
    marker.classList.add('placement-package');
    marker.setAttribute('aria-hidden', 'true');
    scannerSvg.appendChild(marker);
    marker.style.display = 'none';
    placementPackages[compartment.color] = marker;
  });

  function setState(next) { state = next; render(); }
  function placePanel(panel, mount) {
    if (panel.parentNode !== mount) mount.appendChild(panel);
  }
  function renderPanelComposition() {
    var s1Mount, s2Mount;
    if (state.selectedView === 'subsystem1') {
      s1Mount = document.getElementById('subsystem1Mount');
      s2Mount = parkedPanels;
    } else if (state.selectedView === 'subsystem2') {
      s1Mount = parkedPanels;
      s2Mount = document.getElementById('subsystem2Mount');
    } else {
      s1Mount = state.includeSubsystem1 ? document.getElementById('overallSubsystem1Mount') : parkedPanels;
      s2Mount = state.includeSubsystem2 ? document.getElementById('overallSubsystem2Mount') : parkedPanels;
    }
    placePanel(subsystem1Card, s1Mount);
    placePanel(subsystem2Card, s2Mount);
    emptyComposition.hidden = state.selectedView !== 'overall' || state.includeSubsystem1 || state.includeSubsystem2;
    composition.hidden = state.selectedView !== 'overall' || (!state.includeSubsystem1 && !state.includeSubsystem2);
  }

  function renderRoster() {
    var roster = subsystem2Card.querySelector('#compartmentRoster');
    roster.replaceChildren();
    Object.keys(state.compartments).forEach(function (id) {
      var compartment = state.compartments[id];
      var item = document.createElement('div');
      item.className = 'roster-item ' + compartment.color + (compartment.occupancy === 'loading' ? ' loading' : '');
      item.dataset.compartmentId = id;
      var name = document.createElement('strong');
      name.textContent = compartment.label;
      var detail = document.createElement('small');
      var boundName = compartment.boundFixture ? compartment.boundFixture.fictionalDisplayName : 'No fixture association';
      detail.textContent = compartment.occupancy.toUpperCase() + ' · ' + boundName + ' · lid ' + compartment.simulatedLidState + ' · ' + compartment.simulatedLockState;
      item.appendChild(name);
      item.appendChild(detail);
      if (compartment.occupancy === 'occupied' && compartment.boundFixture) {
        var actions = document.createElement('div');
        actions.className = 'roster-actions';
        [['demoRefill', 'Demo Refill'], ['demoReplace', 'Demo Replace']].forEach(function (action) {
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'text-button';
          button.dataset.action = action[0];
          button.dataset.compartmentId = id;
          button.textContent = action[1];
          button.setAttribute('aria-label', action[1] + ' · ' + compartment.label);
          button.disabled = scanIsBusy();
          actions.appendChild(button);
        });
        item.appendChild(actions);
      }
      roster.appendChild(item);
    });
  }

  function scanIsBusy() {
    return ['reading', 'resolving', 'result', 'placing', 'loading'].indexOf(state.scannerDemo.phase) >= 0;
  }

  function renderScannerVisual() {
    var phase = state.scannerDemo.phase;
    var diagram = subsystem2Card.querySelector('#scannerSimulation');
    var badge = subsystem2Card.querySelector('#scannerStageBadge');
    var codeLabel = subsystem2Card.querySelector('#scannerCodeVisual');
    var resultLabel = subsystem2Card.querySelector('#scannerResultVisual');
    var sequenceStatus = subsystem2Card.querySelector('#scannerSequenceStatus');
    var phaseLabels = {
      ready: 'READY', reading: 'READING', resolving: 'LOOKUP', result: 'RESULT', placing: 'PLACING',
      loading: 'LOADING', unavailable: 'UNAVAILABLE', 'unsupported-color': 'UNSUPPORTED COLOR', ambiguous: 'AMBIGUOUS',
      'no-match': 'NO MATCH', invalid: 'INVALID'
    };
    var decoderLabels = {
      ready: 'Four compartments empty', reading: 'Optical read in progress', resolving: 'Checking local fixtures',
      result: 'Fixture result confirmed', placing: 'Container placement in progress',
      loading: 'Mapped compartment loading', unavailable: 'Mapped compartment unavailable',
      'unsupported-color': 'No supported color compartment',
      ambiguous: 'Multiple demo candidates', 'no-match': 'No local fixture match', invalid: 'Invalid demo code'
    };
    diagram.dataset.phase = phase;
    badge.textContent = phaseLabels[phase] || 'READY';
    codeLabel.textContent = state.scannerDemo.demoCode || 'NO CODE';
    resultLabel.textContent = decoderLabels[phase] || 'Demo result';
    sequenceStatus.textContent = state.lastLookupOutcome.message;
    subsystem2Card.querySelectorAll('[data-scan-stage]').forEach(function (node) {
      var stage = node.dataset.scanStage;
      var order = ['reading', 'resolving', 'result', 'placing', 'loading'];
      var terminalResult = ['unavailable', 'unsupported-color', 'ambiguous', 'no-match', 'invalid'].indexOf(phase) >= 0;
      var active = phase === stage || (stage === 'result' && terminalResult);
      var stageIndex = order.indexOf(stage);
      var currentIndex = order.indexOf(phase);
      node.classList.toggle('active', active);
      node.classList.toggle('complete', (currentIndex > stageIndex && stageIndex >= 0) || (terminalResult && stageIndex >= 0 && stageIndex < 2));
    });
    scannerSvg.querySelectorAll('.demo-compartment[data-compartment-id]').forEach(function (node) {
      var id = node.dataset.compartmentId;
      var compartment = state.compartments[id];
      node.classList.toggle('scan-target', compartment.color === state.scannerDemo.targetColor && phase !== 'ready');
      node.classList.toggle('lid-open', compartment.simulatedLidState === 'open');
      node.classList.toggle('loading-compartment', compartment.occupancy === 'loading');
      node.classList.toggle('occupied-compartment', compartment.occupancy === 'occupied');
      node.classList.toggle('unlocked-compartment', compartment.simulatedLockState === 'unlocked');
      node.querySelector('.compartment-name').textContent = compartment.occupancy.toUpperCase();
    });
    Object.keys(placementPackages).forEach(function (color) {
      var compartment = state.compartments[color];
      var marker = placementPackages[color];
      marker.style.display = compartment.occupancy !== 'empty' || (phase === 'placing' && state.scannerDemo.targetColor === color) ? '' : 'none';
      if (compartment.occupancy === 'empty' && !(phase === 'placing' && state.scannerDemo.targetColor === color)) marker.style.transform = '';
    });
  }

  function animatePackageToTarget(color) {
    var marker = placementPackages[color];
    var target = scannerSvg.querySelector('.demo-compartment[data-compartment-id="' + color + '"]');
    if (!marker || !target || !sampleContainer) return Promise.resolve();
    var sourceRect = sampleContainer.getBoundingClientRect();
    var targetRect = target.getBoundingClientRect();
    var dx = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
    var dy = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);
    var scale = Math.min((targetRect.width * 0.7) / sourceRect.width, (targetRect.height * 0.6) / sourceRect.height);
    var finalTransform = 'translate(' + dx + 'px, ' + dy + 'px) scale(' + scale + ')';
    var duration = resetMotion ? 0 : 750;
    marker.style.display = '';
    marker.style.transformOrigin = 'center center';
    marker.style.transformBox = 'fill-box';
    marker.style.transition = 'none';
    marker.style.transform = '';
    return new Promise(function (resolve) {
      marker.getBoundingClientRect();
      window.setTimeout(function () {
        marker.style.transition = duration ? 'transform ' + duration + 'ms ease-in-out' : 'none';
        marker.getBoundingClientRect();
        marker.style.transform = finalTransform;
        window.setTimeout(function () {
          marker.style.transition = '';
          resolve();
        }, duration + 40);
      }, 16);
    });
  }

  function startDemoScan(code) {
    if (scanIsBusy()) return;
    setState(Model.beginDemoScan(state, code));
    window.setTimeout(function () {
      if (state.scannerDemo.phase !== 'reading') return;
      setState(Model.advanceDemoScan(state));
      window.setTimeout(function () {
        if (state.scannerDemo.phase !== 'resolving') return;
        setState(Model.completeDemoScan(state));
        if (state.scannerDemo.phase !== 'result') return;
        window.setTimeout(function () {
          if (state.scannerDemo.phase !== 'result') return;
          var color = state.scannerDemo.targetColor;
          setState(Model.beginPlacement(state));
          animatePackageToTarget(color).then(function () {
            if (state.scannerDemo.phase === 'placing') setState(Model.completePlacement(state));
          });
        }, 350);
      }, 650);
    }, 850);
  }

  function renderScannerCard() {
    var loading = state.scannerDemo.phase === 'loading';
    var loadingPanel = subsystem2Card.querySelector('#loadingPanel');
    var finishButton = subsystem2Card.querySelector('#finishLoadingBtn');
    var input = subsystem2Card.querySelector('#demoCode');
    var submit = subsystem2Card.querySelector('#scanForm button[type="submit"]');
    var busy = scanIsBusy();
    loadingPanel.hidden = !loading;
    finishButton.disabled = !loading;
    if (loading) {
      var compartment = state.compartments[state.scannerDemo.targetCompartmentId];
      subsystem2Card.querySelector('#loadingTargetLabel').textContent = compartment.label;
      subsystem2Card.querySelector('#boundName').textContent = compartment.boundFixture.fictionalDisplayName;
    }
    input.disabled = busy;
    submit.disabled = busy;
    subsystem2Card.querySelectorAll('.fixture-button').forEach(function (button) { button.disabled = busy; });
    includeSubsystem1.checked = state.includeSubsystem1;
    includeSubsystem2.checked = state.includeSubsystem2;
    renderRoster();
    renderScannerVisual();
  }

  function render() {
    tabButtons.forEach(function (button) {
      var selected = button.dataset.view === state.selectedView;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    Object.keys(viewPanels).forEach(function (view) {
      viewPanels[view].hidden = view !== state.selectedView;
    });
    renderPanelComposition();
    renderScannerCard();
  }

  tabButtons.forEach(function (button, index) {
    button.addEventListener('click', function () {
      setState(Model.setView(state, button.dataset.view));
    });
    button.addEventListener('keydown', function (event) {
      var nextIndex;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabButtons.length;
      else if (event.key === 'ArrowLeft') nextIndex = (index + tabButtons.length - 1) % tabButtons.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabButtons.length - 1;
      else return;
      event.preventDefault();
      tabButtons[nextIndex].focus();
      setState(Model.setView(state, tabButtons[nextIndex].dataset.view));
    });
  });

  includeSubsystem1.addEventListener('change', function () {
    setState(Model.setIncluded(state, 'subsystem1', includeSubsystem1.checked));
  });
  includeSubsystem2.addEventListener('change', function () {
    setState(Model.setIncluded(state, 'subsystem2', includeSubsystem2.checked));
  });

  subsystem2Card.querySelector('#scanForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var input = subsystem2Card.querySelector('#demoCode');
    startDemoScan(input.value);
  });
  subsystem2Card.querySelector('#fixtureButtons').replaceChildren();
  fixtures.cases.forEach(function (fixture) {
    if (fixture.expectedOutcome === 'invalid') return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'fixture-button';
    button.dataset.code = fixture.demoCode;
    button.textContent = fixture.demoCode + ' · ' + fixture.demoLabel;
    button.addEventListener('click', function () {
      subsystem2Card.querySelector('#demoCode').value = fixture.demoCode;
      startDemoScan(fixture.demoCode);
    });
    subsystem2Card.querySelector('#fixtureButtons').appendChild(button);
  });

  subsystem2Card.querySelector('#finishLoadingBtn').addEventListener('click', function () {
    setState(Model.finishLoading(state));
  });
  subsystem2Card.querySelector('#compartmentRoster').addEventListener('click', function (event) {
    var button = event.target.closest('button[data-action][data-compartment-id]');
    if (!button || scanIsBusy()) return;
    var action = button.dataset.action;
    if (action === 'demoRefill') setState(Model.demoRefill(state, button.dataset.compartmentId));
    if (action === 'demoReplace') setState(Model.demoReplace(state, button.dataset.compartmentId));
  });

  window.Feature004Prototype = Object.freeze({
    snapshot: function () { return JSON.parse(JSON.stringify(state)); },
    visibleSubsystems: function () { return Model.visibleSubsystems(state); }
  });
  render();
}());
