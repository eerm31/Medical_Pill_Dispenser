/* UI-only helpers: section jump bar, live status chip, orbit-hint dismissal. Reads the DOM; never touches simulation state. */
(function () {
  'use strict';
  var panel = document.getElementById('controlPanel');
  var nav = document.getElementById('panelNav');
  var bar = panel && panel.querySelector('.panel-bar');
  var sections = panel ? [].slice.call(panel.querySelectorAll('.control-section[data-nav]')) : [];
  var pills = [];
  var queued = false;

  function isShown(sec) { return !sec.hidden && getComputedStyle(sec).display !== 'none'; }

  function setActive(index) {
    pills.forEach(function (p, i) {
      var on = i === index;
      p.classList.toggle('active', on);
      if (on) { p.setAttribute('aria-current', 'true'); } else { p.removeAttribute('aria-current'); }
    });
    var cur = pills[index];
    if (cur && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = cur.offsetLeft - (nav.clientWidth - cur.offsetWidth) / 2;
    }
  }

  function spy() {
    var line = (bar ? bar.getBoundingClientRect().bottom : 0) + 24, best = -1;
    sections.forEach(function (sec, i) {
      if (pills[i].hidden) return;
      if (sec.getBoundingClientRect().top <= line) best = i;
    });
    if (best < 0) best = pills.findIndex(function (p) { return !p.hidden; });
    setActive(best);
  }

  function refresh() {
    queued = false;
    if (bar) panel.style.setProperty('--bar-h', bar.offsetHeight + 'px');
    sections.forEach(function (sec, i) { pills[i].hidden = !isShown(sec); });
    spy();
    updateMore();
  }

  function updateMore() {
    nav.classList.toggle('has-more', nav.scrollWidth - nav.clientWidth - nav.scrollLeft > 4);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(refresh);
  }

  function jump(sec, index) {
    if (sec.classList.contains('collapsed')) {
      var head = sec.querySelector('.section-title');
      if (head) head.click();
    }
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(index);
  }

  if (nav && sections.length) {
    sections.forEach(function (sec, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'nav-pill';
      b.textContent = sec.getAttribute('data-nav');
      b.addEventListener('click', function () { jump(sec, i); });
      nav.appendChild(b);
      pills.push(b);
    });
    var watch = new MutationObserver(schedule);
    watch.observe(panel, { attributes: true, attributeFilter: ['hidden'], subtree: true });
    watch.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    panel.addEventListener('scroll', schedule, { passive: true });
    nav.addEventListener('scroll', updateMore, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
  }

  // Mirror the live phase and busy state into the top bar so they stay visible while using any section.
  var phase = document.getElementById('phaseLabel');
  var busy = document.getElementById('busyBadge');
  var chip = document.getElementById('topStatus');
  var topPhase = document.getElementById('topPhase');
  var topBusy = document.getElementById('topBusy');
  if (phase && busy && chip && topPhase && topBusy) {
    var sync = function () {
      topPhase.textContent = phase.textContent;
      topBusy.textContent = busy.textContent;
      chip.classList.toggle('is-busy', !/idle/i.test(busy.textContent));
    };
    var opts = { childList: true, characterData: true, subtree: true };
    new MutationObserver(sync).observe(phase, opts);
    new MutationObserver(sync).observe(busy, opts);
    sync();
  }

  // The orbit hint fades the first time the scene is used.
  var host = document.getElementById('sceneHost');
  var hint = document.getElementById('sceneHint');
  if (host && hint) {
    var dismiss = function () {
      hint.classList.add('dismissed');
      host.removeEventListener('pointerdown', dismiss);
      host.removeEventListener('wheel', dismiss);
    };
    host.addEventListener('pointerdown', dismiss);
    host.addEventListener('wheel', dismiss, { passive: true });
  }
})();
