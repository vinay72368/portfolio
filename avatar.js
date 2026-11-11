// Page guide: a compass button that offers a short text tour of the page.
// Pages set window.AVATAR_TOUR = [{ sel, text }]. Each step scrolls to a section and frames it with a spotlight.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tour = window.AVATAR_TOUR || [];
  if (!tour.length) return;

  const store = {
    get: k => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  };

  const root = document.createElement('div');
  root.className = 'av';
  root.innerHTML = `
    <div class="av-bubble" hidden role="status" aria-live="polite">
      <button class="av-x" data-a="close" aria-label="Close the guide">✕</button>
      <p class="av-text"></p>
      <div class="av-actions"></div>
      <div class="av-ctl" hidden>
        <button data-a="prev" aria-label="Previous step">◀</button>
        <button data-a="next" aria-label="Next step">▶</button>
        <button data-a="auto" aria-pressed="false">Autoplay</button>
        <span class="av-count"></span>
      </div>
    </div>
    <button class="av-btn" aria-label="Open the page tour">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.2 5.4-5.4 2.2 2.2-5.4z"/></svg>
    </button>`;
  document.body.appendChild(root);

  const bubble = root.querySelector('.av-bubble'), textEl = root.querySelector('.av-text');
  const actions = root.querySelector('.av-actions'), ctl = root.querySelector('.av-ctl');
  const countEl = root.querySelector('.av-count'), autoBtn = ctl.querySelector('[data-a=auto]');

  let step = -1, auto = false, focusEl = null, autoTimer = 0, spotRaf = 0;

  // Spotlight: a frame that follows the target section while the page scrolls, dimming everything else.
  const spot = document.createElement('div');
  spot.className = 'av-spot'; spot.hidden = true; spot.setAttribute('aria-hidden', 'true');
  document.body.appendChild(spot);
  function trackSpot() {
    cancelAnimationFrame(spotRaf);
    const loop = () => {
      if (!focusEl) { spot.hidden = true; return; }
      const r = focusEl.getBoundingClientRect(), pad = 12, m = 8;
      const top = Math.max(r.top - pad, m), bottom = Math.min(r.bottom + pad, innerHeight - m);
      const left = Math.max(r.left - pad, m), right = Math.min(r.right + pad, innerWidth - m);
      spot.hidden = false;
      if (bottom - top < 40 || right <= left) spot.style.opacity = 0;
      else Object.assign(spot.style, { opacity: 1, top: top + 'px', left: left + 'px', width: right - left + 'px', height: bottom - top + 'px' });
      spotRaf = requestAnimationFrame(loop);
    };
    loop();
  }

  function showMenu(text, replay) {
    stopTour();
    bubble.hidden = false; ctl.hidden = true; actions.hidden = false;
    textEl.textContent = text;
    actions.innerHTML = `<button class="primary" data-a="start">${replay ? 'Replay the tour' : 'Start the tour'}</button>`;
  }

  function goto(i) {
    if (i < 0) return;
    if (i >= tour.length) return showMenu('That was the tour. Click the compass any time to see it again.', true);
    clearTimeout(autoTimer);
    step = i;
    const s = tour[i];
    bubble.hidden = false; actions.hidden = true; ctl.hidden = false;
    countEl.textContent = `${i + 1} / ${tour.length}`;
    textEl.textContent = s.text;
    focusEl = document.querySelector(s.sel);
    if (focusEl) {
      focusEl.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      trackSpot();
    }
    if (auto) {
      // Reading time: about 300 ms per word, at least 4 seconds
      autoTimer = setTimeout(() => goto(i + 1), Math.max(4000, s.text.split(/\s+/).length * 300));
    }
  }

  function stopTour() {
    auto = false; autoBtn.setAttribute('aria-pressed', 'false'); autoBtn.classList.remove('on');
    clearTimeout(autoTimer);
    focusEl = null; spot.hidden = true;
  }

  function closeGuide() { stopTour(); step = -1; bubble.hidden = true; }

  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('av-btn')) {
      return bubble.hidden ? showMenu('Hi! I can show you around this page.') : closeGuide();
    }
    switch (b.dataset.a) {
      case 'start': goto(0); break;
      case 'next': goto(step + 1); break;
      case 'prev': goto(step - 1); break;
      case 'auto':
        auto = !auto; autoBtn.classList.toggle('on', auto); autoBtn.setAttribute('aria-pressed', String(auto));
        if (auto) goto(Math.max(step, 0)); else clearTimeout(autoTimer);
        break;
      case 'close': closeGuide(); break;
    }
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !bubble.hidden) closeGuide(); });

  // Offer the tour once per session
  if (!store.get('av-greeted')) {
    setTimeout(() => {
      if (!bubble.hidden) return;
      showMenu('Hi! I can show you around this page.');
      store.set('av-greeted', '1');
    }, 1800);
  }
})();
