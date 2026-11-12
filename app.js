// Portfolio behaviour: theme, menu, network hero, reveal, count-up, word reveal, tabs, project stack, logos, contact form.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// ---- theme (same storage key as the project page) ----
(() => {
  let saved = null; try { saved = localStorage.getItem('theme'); } catch {}
  root.dataset.theme = saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next; try { localStorage.setItem('theme', next); } catch {}
    document.dispatchEvent(new Event('themechange'));
  }));
})();

// ---- phone menu ----
(() => {
  const btn = $('#burger'), menu = $('#menu');
  if (!btn || !menu) return;
  const set = open => {
    menu.classList.toggle('open', open); document.body.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', open); btn.querySelector('i').className = open ? 'bi bi-x-lg' : 'bi bi-list';
  };
  btn.addEventListener('click', () => set(!menu.classList.contains('open')));
  $$('a', menu).forEach(a => a.addEventListener('click', () => set(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
})();

// ---- header Résumé button: hidden on the landing screen, shown everywhere else ----
(() => {
  const hero = $('.hero'), btn = $('#nav-resume'); if (!hero || !btn) return;
  let raf = 0;
  const upd = () => { raf = 0; const at = scrollY < hero.offsetHeight * 0.55; document.body.classList.toggle('at-top', at); btn.inert = at; };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true }); addEventListener('resize', upd); upd();
})();

// ---- active nav link + scroll progress ----
(() => {
  const links = $$('.nav a.l'), bar = $('.bar');
  const secs = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-40% 0px -55% 0px' });
  secs.forEach(s => io.observe(s));
  let raf = 0;
  const upd = () => { raf = 0; const h = root.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? clamp(scrollY / h) : 0})`; };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true }); upd();
})();

// ---- reveal on scroll, count-up ----
(() => {
  const count = el => {
    const to = parseFloat(el.dataset.count), d = +(el.dataset.decimals || 0), pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
    if (reduced) { el.textContent = pre + to.toFixed(d) + suf; return; }
    const t0 = performance.now(), dur = 1400;
    const tick = t => { const k = Math.min(1, (t - t0) / dur), v = to * (1 - Math.pow(1 - k, 4)); el.textContent = pre + v.toFixed(d) + suf; if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  $$('.rv').forEach(el => { const sib = [...el.parentElement.children].filter(x => x.classList.contains('rv')); el.style.setProperty('--rd', (sib.indexOf(el) * .08) + 's'); });
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); $$('[data-count]', e.target).forEach(count); if (e.target.matches('[data-count]')) count(e.target); io.unobserve(e.target);
  }), { threshold: .14 });
  $$('.rv').forEach(el => io.observe(el));
})();

// ---- statement: words light up as you scroll ----
(() => {
  const el = $('.statement'); if (!el) return;
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label', words.join(' '));
  el.innerHTML = words.map(w => `<span class="wd" aria-hidden="true">${w}</span>`).join(' ');
  const spans = $$('.wd', el);
  if (reduced) { spans.forEach(s => s.classList.add('on')); return; }
  let raf = 0;
  const upd = () => {
    raf = 0; const r = el.getBoundingClientRect();
    const p = clamp((innerHeight * .82 - r.top) / (r.height + innerHeight * .25));
    const n = Math.round(p * spans.length * 1.06);
    spans.forEach((s, i) => s.classList.toggle('on', i < n));
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true }); addEventListener('resize', upd); upd();
})();

// ---- spotlight glow that follows the pointer on glass cards ----
(() => {
  if (!matchMedia('(hover: hover)').matches) return;
  $$('.spot').forEach(el => el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect(); el.style.setProperty('--x', (e.clientX - r.left) + 'px'); el.style.setProperty('--y', (e.clientY - r.top) + 'px');
  }, { passive: true }));
})();

// ---- experience tabs ----
(() => {
  const tabs = $$('[role="tab"]'); if (!tabs.length) return;
  const show = t => tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; $('#' + x.getAttribute('aria-controls')).hidden = !on; });
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t));
    t.addEventListener('keydown', e => {
      const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (k) { e.preventDefault(); const n = tabs[(i + k + tabs.length) % tabs.length]; n.focus(); show(n); }
    });
  });
  show(tabs[0]);
})();

// ---- project panels: earlier ones step back as the next one slides over ----
(() => {
  const cards = $$('.pcard'); if (cards.length < 2 || reduced) return;
  let raf = 0;
  const upd = () => {
    raf = 0;
    const stacked = getComputedStyle(cards[0]).position === 'sticky';
    cards.forEach((c, i) => {
      if (!stacked || !cards[i + 1]) { c.style.setProperty('--s', 1); c.style.setProperty('--dim', 0); return; }
      const nt = cards[i + 1].getBoundingClientRect().top, ct = c.getBoundingClientRect().top;
      const k = clamp(1 - (nt - ct) / (c.offsetHeight + 40));
      c.style.setProperty('--s', (1 - k * .05).toFixed(4)); c.style.setProperty('--dim', (k * .55).toFixed(3));
    });
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true }); addEventListener('resize', upd); upd();
})();

// ---- brand logos (Devicon, via jsDelivr) on the skills that have one ----
(() => {
  const base = 'https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/';
  const logos = { 'Java 8/11/21': 'java', 'JavaScript (ES6+)': 'javascript', 'Spring Boot': 'spring', 'Spring Security': 'spring', 'Spring Data JPA / Hibernate': 'hibernate',
    'Apache Kafka': 'apachekafka', 'Docker': 'docker', 'PostgreSQL': 'postgresql', 'Git': 'git', 'Jenkins': 'jenkins', 'GitLab CI': 'gitlab', 'Maven': 'maven', 'SonarQube': 'sonarqube', 'Postman': 'postman' };
  $$('.sk .tags span').forEach(chip => {
    const n = logos[chip.textContent.trim()]; if (!n) return;
    const img = new Image(); img.src = `${base}${n}/${n}-original.svg`; img.alt = ''; img.width = img.height = 16; img.loading = 'lazy';
    img.onerror = () => img.remove(); chip.prepend(img);
  });
})();

// ---- contact form opens the visitor's email app; copy button copies the address ----
(() => {
  const form = $('#contact-form');
  if (form) form.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(form), name = f.get('name').toString().trim(), email = f.get('email').toString().trim(), msg = f.get('message').toString().trim();
    location.href = 'mailto:jujarayvinay1210@gmail.com?subject=' + encodeURIComponent('Portfolio enquiry from ' + name) + '&body=' + encodeURIComponent(msg + '\n\n' + name + '\n' + email);
  });
  const copy = $('#copy-email');
  if (copy) copy.addEventListener('click', async () => {
    const label = $('span', copy), old = label.textContent;
    try { await navigator.clipboard.writeText(copy.dataset.email); label.textContent = 'Copied'; } catch { label.textContent = copy.dataset.email; }
    setTimeout(() => { label.textContent = old; }, 1600);
  });
  $('#year').textContent = new Date().getFullYear();
})();

// ---- certificate lightbox ----
(() => {
  const lb = $('#lb'); if (!lb || !lb.showModal) return;
  $$('[data-cert]').forEach(b => b.addEventListener('click', () => lb.showModal()));
  $$('[data-lb-close]', lb).forEach(b => b.addEventListener('click', () => lb.close()));
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
})();
