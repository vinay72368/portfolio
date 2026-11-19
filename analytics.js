// Visit statistics via GoatCounter (privacy-friendly: no cookies, no personal data, dashboard is private to the account owner).
// 1) Create a free account at https://www.goatcounter.com/signup and choose a site code, e.g. "vinayj".
// 2) Put that code below. Until then nothing is loaded and nothing is tracked.
// 3) To keep your own visits out of the numbers, open the site once on each of your devices with #toggle-goatcounter at the end of the address.
(() => {
  const CODE = 'vinayj';
  if (!CODE || /^(localhost|127\.|\[::1\])/.test(location.hostname)) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = 'https://' + CODE + '.goatcounter.com/count';
  document.head.appendChild(s);
})();
