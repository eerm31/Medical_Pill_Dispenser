(function () {
  'use strict';
  var log = window.Feature005Harness.run();
  var body = document.querySelector('#results tbody');
  log.results.forEach(function (r) {
    var row = document.createElement('tr');
    var verdict = r.verdict || r.status;
    var cls = r.verdict === 'fail' ? 'fail' : 'pass';
    [r.verdict ? r.verdict.toUpperCase() : 'NOT VALIDATED', r.criterion_id, r.step || '', r.observed === undefined ? '' : r.observed, r.threshold === undefined ? '' : r.threshold]
      .forEach(function (text, i) {
        var cell = document.createElement('td');
        cell.textContent = String(text);
        if (i === 0) cell.className = cls;
        row.appendChild(cell);
      });
    row.title = verdict;
    body.appendChild(row);
  });
  document.getElementById('summary').textContent = log.summary.checks + ' checks, ' + log.summary.fail + ' failing. ' + log.disclosure;
  var link = document.getElementById('download');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' }));
}());
