(function () {
  'use strict';
  var list = document.getElementById('results');
  var summary = document.getElementById('summary');
  var passed = 0, failed = 0;
  function test(name, run) {
    var item = document.createElement('li');
    try { run(); item.className = 'pass'; item.textContent = 'PASS — ' + name; passed += 1; }
    catch (error) { item.className = 'fail'; item.textContent = 'FAIL — ' + name + ': ' + error.message; failed += 1; }
    list.appendChild(item);
  }
  function equal(actual, expected) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(JSON.stringify(actual) + ' !== ' + JSON.stringify(expected));
  }
  function snapshot(state) { return JSON.stringify(state.compartments); }
  function scanToResult(state, code) { return M.completeDemoScan(M.advanceDemoScan(M.beginDemoScan(state, code))); }
  function place(state) { return M.completePlacement(M.beginPlacement(state)); }
  function load(code) { return place(scanToResult(M.initialState(), code)); }
  var M = window.Feature004Model;
  var fixtures = window.FEATURE004_FIXTURES;
  test('fictional fixtures are versioned and map one unique code to every compartment color', function () {
    if (!fixtures || fixtures.schemaVersion !== 1 || !Array.isArray(fixtures.cases)) throw new Error('fixture contract missing');
    var unique = fixtures.cases.filter(function (item) { return item.expectedOutcome === 'unique'; });
    equal(unique.length, 4);
    equal(unique.map(function (item) { return item.targetColor; }).sort(), ['blue', 'green', 'orange', 'red']);
    if (fixtures.cases.some(function (entry) { return entry.expectedOutcome !== 'invalid' && !/^DEMO-/.test(entry.demoCode); })) throw new Error('fixture code is not visibly fictional');
    if (fixtures.cases.some(function (entry) { return entry.candidates.some(function (candidate) { return !/DEMO ONLY|NOT MEDICATION/i.test(candidate.fictionalDisplayName); }); })) throw new Error('candidate name is not clearly fictional');
  });
  test('initial state has four distinct color compartments empty, unbound, closed and locked', function () {
    if (!M) throw new Error('Feature004Model is missing');
    var state = M.initialState();
      equal(state.selectedView, 'subsystem2');
    equal(state.includeSubsystem1, true); equal(state.includeSubsystem2, true);
    equal(Object.keys(state.compartments).length, 4);
    equal(Object.keys(state.compartments).map(function (id) { return state.compartments[id].color; }).sort(), ['blue', 'green', 'orange', 'red']);
    Object.keys(state.compartments).forEach(function (id) {
      var compartment = state.compartments[id];
      equal(compartment.occupancy, 'empty'); equal(compartment.boundFixture, null);
      equal(compartment.simulatedLidState, 'closed'); equal(compartment.simulatedLockState, 'locked');
    });
      equal(M.visibleSubsystems(state), ['subsystem2']);
  });
  test('same-color target remains unchanged through read, lookup, result and placement animation', function () {
    var state = M.initialState(), before = snapshot(state);
    state = M.beginDemoScan(state, 'DEMO-RED'); equal(state.scannerDemo.phase, 'reading'); equal(snapshot(state), before);
    state = M.advanceDemoScan(state); equal(state.scannerDemo.phase, 'resolving'); equal(snapshot(state), before);
    state = M.completeDemoScan(state); equal(state.scannerDemo.phase, 'result');
    equal(state.scannerDemo.targetColor, 'red'); equal(state.lastLookupOutcome.outcome, 'unique'); equal(snapshot(state), before);
    state = M.beginPlacement(state); equal(state.scannerDemo.phase, 'placing'); equal(snapshot(state), before);
    state = M.completePlacement(state);
    var red = state.compartments.red;
    equal(red.color, 'red'); equal(red.occupancy, 'loading'); equal(red.simulatedLidState, 'open'); equal(red.simulatedLockState, 'unlocked');
    if (!red.boundFixture) throw new Error('mapped compartment association missing after placement');
    ['blue', 'green', 'orange'].forEach(function (color) { equal(state.compartments[color].occupancy, 'empty'); equal(state.compartments[color].simulatedLidState, 'closed'); equal(state.compartments[color].simulatedLockState, 'locked'); });
  });
  test('each of the four unique fixtures opens only its matching color after placement', function () {
    fixtures.cases.filter(function (item) { return item.expectedOutcome === 'unique'; }).forEach(function (fixture) {
      var state = place(scanToResult(M.initialState(), fixture.demoCode));
      equal(state.compartments[fixture.targetColor].occupancy, 'loading');
      Object.keys(state.compartments).filter(function (color) { return color !== fixture.targetColor; }).forEach(function (color) {
        equal(state.compartments[color].occupancy, 'empty'); equal(state.compartments[color].boundFixture, null);
        equal(state.compartments[color].simulatedLidState, 'closed'); equal(state.compartments[color].simulatedLockState, 'locked');
      });
    });
  });
  test('Finish loading marks only the mapped target occupied, closed and locked', function () {
    var loading = load('DEMO-BLUE'), association = loading.compartments.blue.boundFixture;
    var finished = M.finishLoading(loading);
    equal(finished.compartments.blue.occupancy, 'occupied');
    equal(finished.compartments.blue.simulatedLidState, 'closed'); equal(finished.compartments.blue.simulatedLockState, 'locked');
    equal(finished.compartments.blue.boundFixture, association);
    ['red', 'green', 'orange'].forEach(function (color) { equal(finished.compartments[color].occupancy, 'empty'); equal(finished.compartments[color].simulatedLockState, 'locked'); });
  });
  test('occupied same-color target rejects a scan without placement or compartment mutation', function () {
    var state = M.finishLoading(load('DEMO-RED')), before = snapshot(state);
    state = scanToResult(state, 'DEMO-RED');
    equal(state.lastLookupOutcome.outcome, 'unavailable'); equal(state.scannerDemo.phase, 'unavailable');
    equal(snapshot(state), before); if (state.scannerDemo.placementShown) throw new Error('unavailable target was shown as placed');
  });
  test('ambiguous, no-match, invalid and unlisted scans do not claim placement or mutate compartments', function () {
    ['DEMO-AMBIGUOUS-A', 'DEMO-NOMATCH-A', '', '###', 'DEMO-UNLISTED-Z'].forEach(function (code) {
      var state = M.initialState(), before = snapshot(state);
      state = scanToResult(state, code);
      if (state.lastLookupOutcome.outcome === 'unique' || state.scannerDemo.placementShown) throw new Error('failed scan claimed a placement');
      equal(snapshot(state), before);
    });
  });
  test('unsupported container colors open no compartment and preserve all compartment state', function () {
    var fixture = fixtures.cases.find(function (item) { return item.expectedOutcome === 'unsupported-color'; });
    if (!fixture) throw new Error('unsupported-color fixture missing');
    var state = M.initialState(), before = snapshot(state);
    state = scanToResult(state, fixture.demoCode);
    equal(state.scannerDemo.phase, 'unsupported-color');
    equal(state.lastLookupOutcome.outcome, 'unsupported-color');
    if (state.scannerDemo.placementShown) throw new Error('unsupported color was shown as placed');
    equal(snapshot(state), before);
    var loaded = M.finishLoading(load('DEMO-RED'));
    var loadedBefore = snapshot(loaded);
    loaded = scanToResult(loaded, fixture.demoCode);
    equal(loaded.scannerDemo.phase, 'unsupported-color');
    equal(snapshot(loaded), loadedBefore);
  });
  test('busy scan during loading leaves active compartment and loading operation unchanged', function () {
    var loading = load('DEMO-GREEN'), before = snapshot(loading), activeTarget = loading.scannerDemo.targetColor;
    var refused = M.beginDemoScan(loading, 'DEMO-ORANGE');
    equal(snapshot(refused), before); equal(refused.scannerDemo.phase, 'loading'); equal(refused.scannerDemo.targetColor, activeTarget);
  });
  test('demo refill and replacement controls reset only their own finished association', function () {
    var state = M.finishLoading(load('DEMO-RED'));
    state = M.finishLoading(place(scanToResult(state, 'DEMO-BLUE')));
    var before = snapshot(state);
    ['demoRefill', 'demoReplace'].forEach(function (action) {
      var result = M[action](state, 'red');
      equal(result.compartments.red.occupancy, 'empty'); equal(result.compartments.red.boundFixture, null);
      equal(result.compartments.red.simulatedLidState, 'closed'); equal(result.compartments.red.simulatedLockState, 'locked');
      equal(result.compartments.blue, state.compartments.blue);
    });
    var afterFailedScan = scanToResult(state, 'DEMO-NOMATCH-A');
    var resetRed = M.demoRefill(afterFailedScan, 'red');
    equal(resetRed.compartments.blue, state.compartments.blue);
    if (before === snapshot(M.demoRefill(state, 'red'))) throw new Error('refill did not clear its target');
  });
  test('refill and replacement are blocked during loading and do not mutate compartments', function () {
    var loading = load('DEMO-ORANGE'), before = snapshot(loading);
    equal(snapshot(M.demoRefill(loading, 'orange')), before); equal(snapshot(M.demoReplace(loading, 'orange')), before);
  });
  test('individual tabs isolate panels and overall checkboxes compose independently', function () {
    var state = M.initialState();
    equal(M.visibleSubsystems(state), ['subsystem2']);
    state = M.setView(state, 'subsystem2'); equal(M.visibleSubsystems(state), ['subsystem2']);
    state = M.setView(state, 'overall'); equal(M.visibleSubsystems(state), ['subsystem1', 'subsystem2']);
    state = M.setIncluded(state, 'subsystem1', false); equal(M.visibleSubsystems(state), ['subsystem2']);
    state = M.setIncluded(state, 'subsystem2', false); equal(M.visibleSubsystems(state), []);
    state = M.setIncluded(state, 'subsystem1', true); equal(M.visibleSubsystems(state), ['subsystem1']);
  });
  test('view and include controls preserve compartment operation state', function () {
    var state = M.finishLoading(load('DEMO-RED'));
    var next = M.setIncluded(M.setView(state, 'overall'), 'subsystem2', false);
    equal(next.compartments, state.compartments);
  });
  test('input validation rejects non-demo real-looking codes', function () {
    var result = scanToResult(M.initialState(), '5012345678900');
    if (result.lastLookupOutcome.outcome === 'unique') throw new Error('real-looking code must not resolve to demo identity');
    equal(result.compartments, M.initialState().compartments);
  });
  summary.textContent = passed + ' passed, ' + failed + ' failed';
  summary.dataset.failed = String(failed);
}());
