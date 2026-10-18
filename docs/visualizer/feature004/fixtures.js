(function (root) {
  'use strict';
  var fixtures = {
    schemaVersion: 1,
    sourceLabel: 'Fictional local demo fixtures — not NDC data or medication identification',
    cases: [
      {
        caseId: 'unique-red',
        demoCode: 'DEMO-RED',
        expectedOutcome: 'unique',
        targetColor: 'red',
        demoLabel: 'Red compartment fixture',
        candidates: [{ candidateId: 'fixture-red', fictionalDisplayName: 'DEMO ONLY — NOT MEDICATION: Red Example' }]
      },
      {
        caseId: 'unique-blue',
        demoCode: 'DEMO-BLUE',
        expectedOutcome: 'unique',
        targetColor: 'blue',
        demoLabel: 'Blue compartment fixture',
        candidates: [{ candidateId: 'fixture-blue', fictionalDisplayName: 'DEMO ONLY — NOT MEDICATION: Blue Example' }]
      },
      {
        caseId: 'unique-green',
        demoCode: 'DEMO-GREEN',
        expectedOutcome: 'unique',
        targetColor: 'green',
        demoLabel: 'Green compartment fixture',
        candidates: [{ candidateId: 'fixture-green', fictionalDisplayName: 'DEMO ONLY — NOT MEDICATION: Green Example' }]
      },
      {
        caseId: 'unique-orange',
        demoCode: 'DEMO-ORANGE',
        expectedOutcome: 'unique',
        targetColor: 'orange',
        demoLabel: 'Orange compartment fixture',
        candidates: [{ candidateId: 'fixture-orange', fictionalDisplayName: 'DEMO ONLY — NOT MEDICATION: Orange Example' }]
      },
      {
        caseId: 'unsupported-violet',
        demoCode: 'DEMO-VIOLET',
        expectedOutcome: 'unsupported-color',
        targetColor: null,
        demoLabel: 'Unsupported color · no compartment target',
        candidates: [{ candidateId: 'fixture-violet', fictionalDisplayName: 'DEMO ONLY — NOT MEDICATION: Unmapped Color Example' }]
      },
      {
        caseId: 'ambiguous-a',
        demoCode: 'DEMO-AMBIGUOUS-A',
        expectedOutcome: 'ambiguous',
        demoLabel: 'Ambiguous fictional result',
        candidates: [
          { candidateId: 'candidate-a', fictionalDisplayName: 'DEMO ONLY — NOT MEDICATION: Candidate Alpha' },
          { candidateId: 'candidate-b', fictionalDisplayName: 'DEMO ONLY — NOT MEDICATION: Candidate Beta' }
        ]
      },
      {
        caseId: 'no-match-a',
        demoCode: 'DEMO-NOMATCH-A',
        expectedOutcome: 'no-match',
        demoLabel: 'Valid-format code with no fixture match',
        candidates: []
      },
      {
        caseId: 'invalid-a',
        demoCode: '###',
        expectedOutcome: 'invalid',
        demoLabel: 'Malformed input example',
        candidates: []
      }
    ]
  };
  fixtures.cases.forEach(function (entry) {
    Object.freeze(entry.candidates);
    entry.candidates.forEach(Object.freeze);
    Object.freeze(entry);
  });
  Object.freeze(fixtures.cases);
  root.FEATURE004_FIXTURES = Object.freeze(fixtures);
}(typeof window !== 'undefined' ? window : this));
