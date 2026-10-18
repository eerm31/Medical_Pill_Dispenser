(function (root) {
  'use strict';
  var FIXTURES = root.FEATURE004_FIXTURES;
  var VIEW_IDS = ['subsystem1', 'subsystem2', 'overall'];
  var COMPARTMENTS = [
    { id: 'red', label: 'Red compartment', color: 'red' },
    { id: 'blue', label: 'Blue compartment', color: 'blue' },
    { id: 'green', label: 'Green compartment', color: 'green' },
    { id: 'orange', label: 'Orange compartment', color: 'orange' }
  ];
  var CODE_PATTERN = /^DEMO-[A-Z0-9-]{1,40}$/;
  var ACTIVE_PHASES = ['reading', 'resolving', 'result', 'placing', 'loading'];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function copyState(state) { return clone(state); }
  function hasCompartment(state, id) { return Object.prototype.hasOwnProperty.call(state.compartments, id); }
  function active(state) { return ACTIVE_PHASES.indexOf(state.scannerDemo.phase) >= 0; }
  function byColor(color) {
    return COMPARTMENTS.find(function (item) { return item.color === color; });
  }
  function emptyCompartment(item) {
    return {
      compartmentId: item.id,
      label: item.label,
      color: item.color,
      occupancy: 'empty',
      boundFixture: null,
      simulatedLidState: 'closed',
      simulatedLockState: 'locked'
    };
  }
  function initialState() {
    var compartments = {};
    COMPARTMENTS.forEach(function (item) { compartments[item.id] = emptyCompartment(item); });
    return {
      selectedView: 'subsystem2',
      includeSubsystem1: true,
      includeSubsystem2: true,
      scannerDemo: {
        phase: 'ready', demoCode: '', targetColor: null, targetCompartmentId: null,
        fixture: null, placementShown: false
      },
      lastLookupOutcome: { outcome: 'not-scanned', message: 'No demo container scanned yet.', candidates: [] },
      compartments: compartments
    };
  }
  function setView(state, view) {
    if (VIEW_IDS.indexOf(view) < 0) throw new Error('Unknown subsystem view.');
    var next = copyState(state); next.selectedView = view; return next;
  }
  function setIncluded(state, subsystem, included) {
    if (subsystem !== 'subsystem1' && subsystem !== 'subsystem2') throw new Error('Unknown subsystem composition option.');
    var next = copyState(state);
    next[subsystem === 'subsystem1' ? 'includeSubsystem1' : 'includeSubsystem2'] = Boolean(included);
    return next;
  }
  function visibleSubsystems(state) {
    if (state.selectedView === 'subsystem1') return ['subsystem1'];
    if (state.selectedView === 'subsystem2') return ['subsystem2'];
    var visible = [];
    if (state.includeSubsystem1) visible.push('subsystem1');
    if (state.includeSubsystem2) visible.push('subsystem2');
    return visible;
  }
  function resolveCode(rawCode) {
    var code = String(rawCode == null ? '' : rawCode).trim().toUpperCase();
    if (!CODE_PATTERN.test(code)) return { outcome: 'invalid', code: code, entry: null };
    var entry = FIXTURES.cases.find(function (item) { return item.demoCode === code; });
    if (!entry || entry.expectedOutcome === 'no-match') return { outcome: 'no-match', code: code, entry: null };
    if (entry.expectedOutcome === 'unsupported-color') return { outcome: 'unsupported-color', code: code, entry: entry };
    if (entry.expectedOutcome !== 'unique' || entry.candidates.length !== 1 || !entry.targetColor) {
      return { outcome: 'ambiguous', code: code, entry: entry };
    }
    return { outcome: 'unique', code: code, entry: entry };
  }
  function beginDemoScan(state, rawCode) {
    var next = copyState(state);
    if (active(state)) {
      next.lastLookupOutcome = { outcome: 'busy', message: 'Finish the current demo loading step before scanning another container.', candidates: [] };
      return next;
    }
    var code = String(rawCode == null ? '' : rawCode).trim().toUpperCase();
    next.scannerDemo = { phase: 'reading', demoCode: code, targetColor: null, targetCompartmentId: null, fixture: null, placementShown: false };
    next.lastLookupOutcome = { outcome: 'reading', code: code, message: 'Reading the fictional container barcode. No compartment state has changed.', candidates: [] };
    return next;
  }
  function advanceDemoScan(state) {
    if (state.scannerDemo.phase !== 'reading') throw new Error('A demo scan must be reading before local lookup begins.');
    var next = copyState(state);
    next.scannerDemo.phase = 'resolving';
    next.lastLookupOutcome = { outcome: 'resolving', code: next.scannerDemo.demoCode, message: 'Checking only the fictional local fixture table. No compartment state has changed.', candidates: [] };
    return next;
  }
  function completeDemoScan(state) {
    if (state.scannerDemo.phase !== 'resolving') throw new Error('A demo scan must resolve before it can complete.');
    var next = copyState(state);
    var resolved = resolveCode(next.scannerDemo.demoCode);
    next.scannerDemo.phase = resolved.outcome;
    next.lastLookupOutcome = {
      outcome: resolved.outcome,
      code: resolved.code,
      message: '',
      candidates: resolved.entry ? resolved.entry.candidates.map(function (candidate) { return candidate.fictionalDisplayName; }) : []
    };
    if (resolved.outcome === 'invalid') {
      next.lastLookupOutcome.message = 'Invalid fictional demo code. No compartment changed or container placed.';
      return next;
    }
    if (resolved.outcome === 'no-match') {
      next.lastLookupOutcome.message = 'No fictional local fixture matched. No compartment changed or container placed.';
      return next;
    }
    if (resolved.outcome === 'unsupported-color') {
      next.lastLookupOutcome.message = 'This fictional container color has no matching compartment. No compartment opened or changed.';
      return next;
    }
    if (resolved.outcome === 'ambiguous') {
      next.lastLookupOutcome.message = 'Multiple fictional candidates matched. No compartment changed or container placed.';
      return next;
    }
    var target = byColor(resolved.entry.targetColor);
    if (!target || !hasCompartment(next, target.id)) throw new Error('Fixture target color is not configured.');
    next.scannerDemo.targetColor = target.color;
    next.scannerDemo.targetCompartmentId = target.id;
    next.scannerDemo.fixture = resolved.entry;
    var compartment = next.compartments[target.id];
    var available = compartment.occupancy === 'empty' && !compartment.boundFixture &&
      compartment.simulatedLidState === 'closed' && compartment.simulatedLockState === 'locked';
    if (!available) {
      next.scannerDemo.phase = 'unavailable';
      next.scannerDemo.targetCompartmentId = null;
      next.lastLookupOutcome.outcome = 'unavailable';
      next.lastLookupOutcome.message = 'The matching ' + target.color + ' compartment is unavailable. No placement or compartment change occurred.';
      return next;
    }
    next.scannerDemo.phase = 'result';
    next.lastLookupOutcome.message = 'Fictional fixture matched to the available ' + target.color + ' compartment. Placement will follow; no compartment state has changed yet.';
    return next;
  }
  function beginPlacement(state) {
    if (state.scannerDemo.phase !== 'result' || state.lastLookupOutcome.outcome !== 'unique') {
      throw new Error('Only a successful unique result for an available target can begin placement.');
    }
    var next = copyState(state);
    next.scannerDemo.phase = 'placing';
    next.scannerDemo.placementShown = true;
    next.lastLookupOutcome = {
      outcome: 'placing', code: next.scannerDemo.demoCode,
      message: 'Showing the fictional container being placed into its same-color compartment; compartment state is unchanged until placement completes.',
      candidates: next.lastLookupOutcome.candidates
    };
    return next;
  }
  function completePlacement(state) {
    if (state.scannerDemo.phase !== 'placing') throw new Error('Container placement must be in progress before it can complete.');
    var next = copyState(state);
    var id = next.scannerDemo.targetCompartmentId;
    var compartment = next.compartments[id];
    var fixture = next.scannerDemo.fixture;
    var available = compartment && compartment.color === next.scannerDemo.targetColor &&
      compartment.occupancy === 'empty' && !compartment.boundFixture &&
      compartment.simulatedLidState === 'closed' && compartment.simulatedLockState === 'locked';
    if (!available) {
      next.scannerDemo.phase = 'unavailable';
      next.scannerDemo.targetCompartmentId = null;
      next.lastLookupOutcome = { outcome: 'unavailable', message: 'The mapped compartment became unavailable before placement completed. No compartment changed.', candidates: [] };
      return next;
    }
    var candidate = fixture.candidates[0];
    compartment.boundFixture = {
      fixtureId: fixture.caseId,
      candidateId: candidate.candidateId,
      demoCode: fixture.demoCode,
      fictionalDisplayName: candidate.fictionalDisplayName,
      sourceLabel: FIXTURES.sourceLabel
    };
    compartment.occupancy = 'loading';
    compartment.simulatedLidState = 'open';
    compartment.simulatedLockState = 'unlocked';
    next.scannerDemo.phase = 'loading';
    next.lastLookupOutcome = {
      outcome: 'loading', code: fixture.demoCode,
      message: 'Placement complete. ' + compartment.label + ' is open and unlocked for simulated loading only.',
      candidates: [candidate.fictionalDisplayName]
    };
    return next;
  }
  function finishLoading(state) {
    if (state.scannerDemo.phase !== 'loading') return copyState(state);
    var next = copyState(state);
    var compartment = next.compartments[next.scannerDemo.targetCompartmentId];
    compartment.occupancy = 'occupied';
    compartment.simulatedLidState = 'closed';
    compartment.simulatedLockState = 'locked';
    next.lastLookupOutcome = { outcome: 'loaded', message: compartment.label + ' marked loaded; its simulated lid is closed and locked. Fixture association retained.', candidates: [] };
    next.scannerDemo = { phase: 'ready', demoCode: '', targetColor: null, targetCompartmentId: null, fixture: null, placementShown: false };
    return next;
  }
  function resetCompartment(state, id, action) {
    if (!hasCompartment(state, id)) throw new Error('Unknown compartment.');
    var next = copyState(state);
    var compartment = next.compartments[id];
    if (active(state) || compartment.occupancy !== 'occupied' || !compartment.boundFixture) {
      next.lastLookupOutcome = { outcome: 'blocked', message: 'Demo refill/replacement is available only for an associated compartment after loading is finished.', candidates: [] };
      return next;
    }
    var definition = COMPARTMENTS.find(function (item) { return item.id === id; });
    next.compartments[id] = emptyCompartment(definition);
    next.lastLookupOutcome = { outcome: 'reset', message: action + ' demo state for ' + definition.label + '; now empty, unassociated, closed, and locked.', candidates: [] };
    return next;
  }
  function demoRefill(state, id) { return resetCompartment(state, id, 'Demo refill'); }
  function demoReplace(state, id) { return resetCompartment(state, id, 'Demo replacement'); }

  root.Feature004Model = Object.freeze({
    compartmentDefinitions: Object.freeze(COMPARTMENTS.map(function (item) { return Object.freeze({ id: item.id, label: item.label, color: item.color }); })),
    initialState: initialState,
    setView: setView,
    setIncluded: setIncluded,
    visibleSubsystems: visibleSubsystems,
    beginDemoScan: beginDemoScan,
    advanceDemoScan: advanceDemoScan,
    completeDemoScan: completeDemoScan,
    beginPlacement: beginPlacement,
    completePlacement: completePlacement,
    finishLoading: finishLoading,
    demoRefill: demoRefill,
    demoReplace: demoReplace
  });
}(typeof window !== 'undefined' ? window : this));
