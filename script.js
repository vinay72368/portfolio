const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

// Theme
const saved = (() => { try { return localStorage.getItem('theme'); } catch { return null; } })();
if (saved) root.dataset.theme = saved;
else if (matchMedia('(prefers-color-scheme: light)').matches) root.dataset.theme = 'light';
$('#theme').addEventListener('click', () => {
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch {}
});
$('#year').textContent = new Date().getFullYear();

// Phone menu: opens the section links, closes again after a choice
const menuBtn = $('#menu'), navBar = $('.nav');
if (menuBtn) {
  const setMenu = open => {
    navBar.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menuBtn.firstElementChild.className = open ? 'bi bi-x-lg' : 'bi bi-list';
  };
  menuBtn.addEventListener('click', () => setMenu(!navBar.classList.contains('open')));
  navBar.addEventListener('click', e => { if (e.target.closest('nav a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
}

// Count-up stats
$$('[data-count]').forEach(el => {
  if (reduce) return;
  const end = +el.dataset.count, pre = el.dataset.prefix || '', suf = el.dataset.suffix || '', dec = +(el.dataset.decimals || 0);
  const t0 = performance.now();
  const tick = now => {
    const p = Math.min((now - t0) / 1600, 1);
    el.textContent = pre + (end * (1 - Math.pow(1 - p, 3))).toFixed(dec) + suf;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

// Typing effect
const phrases = [
  'Building cloud-native apps on SAP BTP',
  'Designing 100+ CAP OData & REST services',
  'Modeling CDS entities on SAP HANA Cloud',
  'Securing APIs with XSUAA, OAuth2 & JWT',
  'Streaming events with Event Mesh & Kafka',
];
const typed = $('#typed');
if (!typed) { /* page has no typing line */ }
else if (reduce) typed.textContent = phrases[0];
else {
  let pi = 0, ci = 0, del = false;
  (function type() {
    const text = phrases[pi];
    typed.textContent = text.slice(0, ci);
    if (!del && ci === text.length) { del = true; return setTimeout(type, 1500); }
    if (del && ci === 0) { del = false; pi = (pi + 1) % phrases.length; }
    ci += del ? -1 : 1;
    setTimeout(type, del ? 25 : 55);
  })();
}

// Scroll reveal (auto-tags elements, staggers siblings)
const targets = $$('.title, .about p, .card, .job, .stats li, .hero .lead, .hero .cta, .tags span, #contact .btn');
targets.forEach(el => el.classList.add('reveal'));
if (reduce) targets.forEach(el => el.classList.add('in'));
else {
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    const sibs = [...e.target.parentElement.children].filter(c => c.classList.contains('reveal'));
    e.target.style.transitionDelay = Math.min(sibs.indexOf(e.target), 10) * 70 + 'ms';
    e.target.classList.add('in');
    io.unobserve(e.target);
  }), { threshold: 0.15 });
  targets.forEach(el => io.observe(el));
}

// Scroll progress, active nav link, timeline line
const bar = $('.progress'), links = $$('.nav nav a[href^="#"]'), secs = links.map(a => $(a.hash));
addEventListener('scroll', () => {
  const h = root.scrollHeight - innerHeight;
  bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`;
  let cur = -1;
  secs.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * 0.4) cur = i; });
  links.forEach((a, i) => a.classList.toggle('active', i === cur));
}, { passive: true });

// Brand logos (Devicon, via jsDelivr) in front of the skills that have one; chips without a logo stay text-only.
(() => {
  const base = 'https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/';
  const logos = {
    'Java 8/11/21': 'java', 'JavaScript (ES6+)': 'javascript', 'Spring Boot': 'spring', 'Spring Security': 'spring',
    'Spring Data JPA / Hibernate': 'hibernate', 'Apache Kafka': 'apachekafka', 'Docker': 'docker', 'PostgreSQL': 'postgresql',
    'Git': 'git', 'Jenkins': 'jenkins', 'GitLab CI': 'gitlab', 'Maven': 'maven', 'SonarQube': 'sonarqube', 'Postman': 'postman',
  };
  document.querySelectorAll('.sk .tags span').forEach(chip => {
    const name = logos[chip.textContent.trim()];
    if (!name) return;
    const img = new Image();
    img.src = `${base}${name}/${name}-original.svg`; img.alt = ''; img.loading = 'lazy';
    img.onerror = () => img.remove();
    chip.prepend(img);
  });
})();

// Contact: the form opens the visitor's email app with the message filled in; the copy button copies the address.
(() => {
  const form = document.getElementById('contact-form');
  if (form) form.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(form), name = f.get('name').toString().trim(), email = f.get('email').toString().trim(), msg = f.get('message').toString().trim();
    const subject = encodeURIComponent('Portfolio enquiry from ' + name);
    const body = encodeURIComponent(msg + '\n\n' + name + '\n' + email);
    location.href = 'mailto:jujarayvinay1210@gmail.com?subject=' + subject + '&body=' + body;
  });
  const copy = document.getElementById('copy-email');
  if (copy) copy.addEventListener('click', async () => {
    const label = copy.querySelector('span'), old = label.textContent;
    try { await navigator.clipboard.writeText(copy.dataset.email); label.textContent = 'Copied'; }
    catch { label.textContent = copy.dataset.email; }
    setTimeout(() => { label.textContent = old; }, 1600);
  });
})();

