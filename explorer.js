(() => {
  const FILES = window.PROJECT_FILES;
  const $ = (s, c = document) => c.querySelector(s);
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ---------- What each file is about ---------- */
  const NOTES = {
    'app/webapp/manifest.json': 'The UI5 app descriptor: the OData V4 data source and model, the routes (products, orders, order detail), i18n and the minimum UI5 version. UI5 reads this to wire the whole app together.',
    'app/webapp/index.html': 'Bootstraps OpenUI5 from the CDN with the Horizon theme and starts the component.',
    'app/webapp/Component.js': 'The UI5 component: loads the manifest and starts the router.',
    'app/webapp/view/App.view.xml': 'The root view, just an App control that holds the pages the router shows.',
    'app/webapp/view/Products.view.xml': 'The storefront. The table binds directly to the OData entity set /Products, so sorting, filtering and paging are done by the CAP service. The footer shows the basket with a live total.',
    'app/webapp/controller/Products.controller.js': 'Search adds a server-side $filter, the "Low stock" toggle calls the CAP function lowStockProducts(), and Checkout calls the placeOrder action. The basket preview uses the same discount tiers as the Java code, but the server always recalculates.',
    'app/webapp/view/Checkout.fragment.xml': 'The checkout dialog: pick a customer, review the basket and the discount, place the order.',
    'app/webapp/view/Orders.view.xml': 'The order list, reading /Orders with $expand=customer so each row can show the customer name.',
    'app/webapp/controller/Orders.controller.js': 'Navigation to an order, and the colour of each status.',
    'app/webapp/view/OrderDetail.view.xml': 'One order with its lines ($expand=product) and a Cancel button that is only shown while the order has not shipped.',
    'app/webapp/controller/OrderDetail.controller.js': 'Calls the order actions cancelOrder, markOrderPaid and shipOrder through one helper. If the order is in the wrong status, or the user lacks the role, the server answers 409 or 403 and the error is shown in a dialog.',
    'app/webapp/view/Sales.view.xml': 'The sales page for operators: three KPI numbers from salesSummary() and a top-products list from topProducts(limit).',
    'app/webapp/controller/Sales.controller.js': 'Calls the two CAP functions with bindContext. Customers get a 403, which is shown as a message.',
    'app/webapp/i18n/i18n.properties': 'All UI texts in one place, ready for translation.',
    'app/webapp/css/style.css': 'Small style tweaks on top of the SAP Horizon theme.',
    'db/schema.cds': 'The domain model: Products, Customers, Orders and OrderItems. Orders own their items through a Composition, so deleting an order deletes its lines. cuid and managed add the UUID key and the createdAt/modifiedAt fields for free.',
    'db/data/demo.shop-Products.csv': 'Seed data. CAP loads any CSV named <namespace>-<Entity>.csv into the in-memory database on startup. This is the catalogue the playground and the shop preview use too.',
    'db/data/demo.shop-Customers.csv': 'Seed customers.',
    'db/data/demo.shop-Orders.csv': 'Seed orders. Subtotal, discount and total follow the pricing rules in PricingCalculator.',
    'db/data/demo.shop-OrderItems.csv': 'Seed order lines. order_ID and product_ID are the foreign keys generated from the associations in the model.',
    'srv/shop-service.cds': 'The service layer: projections on the database model, who may do what (@restrict), and the custom operations. Actions change data (placeOrder, cancelOrder, markOrderPaid, shipOrder, restockProduct) and functions only read it (lowStockProducts, salesSummary, topProducts). The operator tools are limited to Admin with @requires. CAP turns this one file into a full OData V4 API.',
    'srv/src/main/java/demo/shop/Application.java': 'Entry point. CAP Java is just Spring Boot, so this is a normal @SpringBootApplication.',
    'srv/src/main/java/demo/shop/handlers/ShopServiceHandler.java': 'The only custom Java in the project. placeOrder checks stock, prices the basket, saves the order and lines, and reduces stock in one transaction. cancelOrder restores stock. markOrderPaid and shipOrder move an order through NEW, PAID, SHIPPED and refuse anything out of order. restockProduct adds stock, and salesSummary and topProducts aggregate the orders. Everything else (CRUD, paging, $filter, $expand) is CAP.',
    'srv/src/main/java/demo/shop/handlers/PricingCalculator.java': 'The volume-discount rule, kept free of CAP and Spring so it can be unit tested in milliseconds. The playground runs a JavaScript port of this class.',
    'srv/src/main/resources/application.yaml': 'Profiles. Locally: H2 and mocked users (customer and admin). On BTP the "cloud" profile uses XSUAA, and HANA Cloud comes from the bound service.',
    'srv/src/test/java/demo/shop/handlers/PricingCalculatorTest.java': 'Plain JUnit tests for the discount tiers and their boundaries.',
    'srv/src/test/java/demo/shop/ShopServiceTest.java': 'End-to-end tests with MockMvc: 401 for anonymous users, 403 when a customer tries to delete, 400 for a negative price, 409 for too little stock, and a priced order.',
    'srv/pom.xml': 'The Java module. The cds-maven-plugin compiles the CDS model and generates the typed cds.gen.* interfaces the handler imports, and the UI5 app is packaged into the jar. The cloud profile swaps H2 for HANA.',
    'pom.xml': 'Parent POM: pins CAP Java and Spring Boot versions through BOMs.',
    'package.json': 'Node side of CAP: the CDS compiler (@sap/cds) used at build time.',
    'xs-security.json': 'XSUAA configuration: the Customer and Admin scopes and role templates that @restrict refers to.',
    'mta.yaml': 'Deployment descriptor for Cloud Foundry: the Java app (with the UI), the HANA HDI container, and the XSUAA instance.',
    'README.md': 'How to run, test and deploy it, with curl examples.',
  };
  const ORDER = Object.keys(NOTES).filter(p => p in FILES);
  Object.keys(FILES).forEach(p => { if (!ORDER.includes(p)) ORDER.push(p); });

  /* ---------- Syntax highlighting ---------- */
  const KEYWORDS = {
    cds: 'namespace|using|entity|type|service|action|function|returns|many|Composition|Association|of|to|on|as|projection|key|enum|default|from|event',
    java: 'package|import|public|private|protected|class|record|final|static|void|return|if|throw|new|for|implements|extends|interface|throws|var|try|catch|null|true|false|int|long',
    yaml: 'true|false|null',
    xml: '', json: 'true|false|null', md: '', csv: '',
  };
  const lang = p => ({ cds: 'cds', java: 'java', yaml: 'yaml', yml: 'yaml', xml: 'xml', json: 'json', md: 'md', csv: 'csv' }[p.split('.').pop()] || 'md');

  function highlight(text, l) {
    if (l === 'md' || l === 'csv') return esc(text);
    const comment = l === 'yaml' ? '#[^\\n]*' : l === 'xml' ? '&lt;!--[\\s\\S]*?--&gt;' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
    const parts = [
      `(?<c>${comment})`,
      `(?<s>"(?:[^"\\\\\\n]|\\\\.)*"|'[^'\\n]*')`,
      l === 'cds' || l === 'java' ? `(?<a>@[\\w.]+)` : null,
      KEYWORDS[l] ? `(?<k>\\b(?:${KEYWORDS[l]})\\b)` : null,
      `(?<n>\\b\\d+(?:\\.\\d+)?\\b)`,
    ].filter(Boolean);
    // Escape first so the comment pattern for XML matches the escaped form.
    return esc(text).replace(new RegExp(parts.join('|'), 'g'), (m, ...args) => {
      const g = args[args.length - 1];
      const cls = Object.keys(g).find(k => g[k] !== undefined);
      return `<span class="tk-${cls}">${m}</span>`;
    });
  }

  /* ---------- File tree + viewer ---------- */
  const tree = $('#tree'), code = $('#code'), pathEl = $('#file-path'), noteEl = $('#file-note');
  let current = null;

  function buildTree() {
    const root = {};
    ORDER.forEach(p => {
      let node = root;
      p.split('/').forEach((seg, i, arr) => { node = node[seg] = node[seg] || (i === arr.length - 1 ? p : {}); });
    });
    const render = (node, name) => {
      const items = Object.entries(node).map(([k, v]) => typeof v === 'string'
        ? `<li><button data-path="${v}">${k}</button></li>`
        : `<li>${render(v, k)}</li>`).join('');
      return (name ? `<span class="dir">${name}/</span>` : '') + `<ul>${items}</ul>`;
    };
    tree.innerHTML = render(root, '');
  }

  function open(p) {
    if (!(p in FILES)) return;
    current = p;
    pathEl.textContent = p;
    noteEl.textContent = NOTES[p] || '';
    noteEl.hidden = !NOTES[p];
    const lines = highlight(FILES[p].replace(/\n$/, ''), lang(p)).split('\n');
    code.innerHTML = lines.map((l, i) => `<span class="ln">${i + 1}</span>${l}`).join('\n');
    code.parentElement.scrollTop = 0;
    tree.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.path === p));
  }
  window.openProjectFile = (p, scroll) => {
    open(p);
    if (scroll) $('#explore').scrollIntoView({ behavior: 'smooth' });
  };

  buildTree();
  tree.addEventListener('click', e => { const b = e.target.closest('button'); if (b) open(b.dataset.path); });
  $('#copy').addEventListener('click', async e => {
    try { await navigator.clipboard.writeText(FILES[current]); e.target.textContent = 'Copied'; }
    catch { e.target.textContent = 'Press Ctrl+C'; }
    setTimeout(() => { e.target.textContent = 'Copy'; }, 1400);
  });
  open('db/schema.cds');

  /* ---------- Request flow ---------- */
  const STEPS = [
    { t: 'UI5 storefront', s: 'Browser', file: 'app/webapp/view/Products.view.xml',
      d: 'The shopper opens the shop. The table is bound to <code>/Products</code> on the OData V4 model, so UI5 sends <code>GET /odata/v4/shop/Products?$orderby=name</code> with the user\'s credentials (a JWT on BTP, basic auth locally). The URL path comes from <code>@path</code> in <code>shop-service.cds</code>.' },
    { t: 'Spring Security', s: 'Who are you?', file: 'srv/src/main/resources/application.yaml',
      d: 'The request is authenticated. On BTP the XSUAA token is validated and its scopes become CAP roles. Locally, the mocked users in <code>application.yaml</code> (customer and admin) play that part. No valid user means <code>401</code>.' },
    { t: 'OData adapter', s: 'URL to query', file: 'srv/pom.xml',
      d: '<code>cds-adapter-odata-v4</code> parses the URL. <code>$filter</code>, <code>$select</code>, <code>$expand</code>, <code>$top</code> become a CQN query. You write none of this code.' },
    { t: 'Service + handlers', s: 'Rules', file: 'srv/src/main/java/demo/shop/handlers/ShopServiceHandler.java',
      d: '<code>@restrict</code> is checked first (a customer who tries to DELETE a product gets <code>403</code>). Then your handlers run: <code>placeOrder</code> checks stock (<code>409</code> if too little), prices the basket with <code>PricingCalculator</code> and saves the order.' },
    { t: 'PersistenceService', s: 'CQN to SQL', file: 'db/schema.cds',
      d: 'The CQN query is turned into SQL for the active database, using the model in <code>schema.cds</code> to map names and types. H2 locally, SAP HANA Cloud on BTP, same code.' },
    { t: 'SAP HANA Cloud', s: 'Data', file: 'mta.yaml',
      d: 'Tables and views were created from the CDS model by the HDI deployer defined in <code>mta.yaml</code>. The rows travel back up the same path and are serialised as OData JSON.' },
  ];
  const nodes = $('#flow-nodes'), detail = $('#flow-detail'), playBtn = $('#flow-play');
  nodes.innerHTML = STEPS.map((s, i) => `<li><button data-i="${i}"><b>${s.t}</b><span>${s.s}</span></button></li>`).join('');
  let timer = null;

  function show(i) {
    [...nodes.children].forEach((li, k) => { li.classList.toggle('on', k === i); li.classList.toggle('done', k < i); });
    const s = STEPS[i];
    detail.innerHTML = `<h4>${i + 1}. ${s.t}</h4><p>${s.d}</p><button class="btn small" data-file="${s.file}">Open ${s.file.split('/').pop()} →</button>`;
  }
  function stop() { clearInterval(timer); timer = null; playBtn.textContent = '▶ Play request'; }
  function play() {
    if (timer) return stop();
    let i = 0; show(0); playBtn.textContent = '❚❚ Pause';
    timer = setInterval(() => {
      i++;
      if (i >= STEPS.length) { stop(); [...nodes.children].forEach(li => li.classList.add('done')); return; }
      show(i);
    }, 2200);
  }
  playBtn.addEventListener('click', play);
  nodes.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { stop(); show(+b.dataset.i); } });
  detail.addEventListener('click', e => { const b = e.target.closest('[data-file]'); if (b) window.openProjectFile(b.dataset.file, true); });
  show(0);

  /* ---------- API playground ---------- */
  const sim = CapSim.create({
    products: FILES['db/data/demo.shop-Products.csv'], customers: FILES['db/data/demo.shop-Customers.csv'],
    orders: FILES['db/data/demo.shop-Orders.csv'], orderItems: FILES['db/data/demo.shop-OrderItems.csv'],
  });
  window.projectSim = sim;   // shared with the UI preview, so both panels see the same data
  const B = '/odata/v4/shop/', PRIYA = '1994eedc-fff6-4478-933a-8c34683b40b6';
  const HEADPHONES = 'f391e075-fb77-42d0-bf65-384e2165177a', NOTEBOOKS = '77fe68b0-06bf-4b7c-b0bd-1138b09e91cd';
  const HUB = 'dda6a13c-0c4b-4c2a-8ab0-3de16d128040', O_NEW = '34fcea77-7772-455c-b118-ba67e5b19830', O_SHIPPED = '0ad7c429-612f-44f1-adc8-e2af22c07670';
  const PRESETS = [
    { n: 'List products', d: 'Plain read', u: 'Products', user: 'customer' },
    { n: 'Filter, select, sort', d: '$filter $select $orderby', u: "Products?$filter=category eq 'Electronics' and price lt 100&$select=name,price,stock&$orderby=price desc", user: 'customer' },
    { n: 'Orders with lines', d: '$expand items and customer', u: 'Orders?$expand=items,customer&$orderby=orderedOn desc', user: 'customer' },
    { n: 'Running low', d: 'Custom function', u: 'lowStockProducts(threshold=5)', user: 'customer' },
    { n: 'Place an order', d: 'Action: stock check + 5% discount', m: 'POST', u: 'placeOrder', b: { customerID: PRIYA, items: [{ productID: HEADPHONES, quantity: 1 }, { productID: NOTEBOOKS, quantity: 4 }] }, user: 'customer' },
    { n: 'Not enough stock', d: 'Server says 409', m: 'POST', u: 'placeOrder', b: { customerID: PRIYA, items: [{ productID: HUB, quantity: 9 }] }, user: 'customer' },
    { n: 'Empty basket', d: 'Validation says 400', m: 'POST', u: 'placeOrder', b: { customerID: PRIYA, items: [] }, user: 'customer' },
    { n: 'Cancel a new order', d: 'Stock goes back up', m: 'POST', u: 'cancelOrder', b: { orderID: O_NEW }, user: 'customer' },
    { n: 'Cancel a shipped order', d: 'Rule says 409', m: 'POST', u: 'cancelOrder', b: { orderID: O_SHIPPED }, user: 'customer' },
    { n: 'Mark an order as paid', d: 'Admin action: NEW to PAID', m: 'POST', u: 'markOrderPaid', b: { orderID: O_NEW }, user: 'admin' },
    { n: 'Ship an unpaid order', d: 'Lifecycle rule says 409', m: 'POST', u: 'shipOrder', b: { orderID: O_NEW }, user: 'admin' },
    { n: 'Restock a product', d: 'Admin action: +25 in stock', m: 'POST', u: 'restockProduct', b: { productID: HUB, quantity: 25 }, user: 'admin' },
    { n: 'Sales summary', d: 'Admin function', u: 'salesSummary()', user: 'admin' },
    { n: 'Top products', d: 'Admin function with a parameter', u: 'topProducts(limit=3)', user: 'admin' },
    { n: 'Sales as customer', d: '@requires says 403', u: 'salesSummary()', user: 'customer' },
    { n: 'Delete as customer', d: '@restrict says 403', m: 'DELETE', u: `Products(${HEADPHONES})`, user: 'customer' },
    { n: 'Negative price as admin', d: '@Before handler says 400', m: 'POST', u: 'Products', b: { name: 'Broken', price: -5, stock: 1 }, user: 'admin' },
    { n: 'Not logged in', d: '401', u: 'Products', user: 'anonymous' },
  ];
  const el = { user: $('#pg-user'), method: $('#pg-method'), url: $('#pg-url'), body: $('#pg-body'), auth: $('#pg-auth'),
    status: $('#pg-status'), time: $('#pg-time'), res: $('#pg-res'), presets: $('#presets') };

  el.presets.innerHTML = PRESETS.map((p, i) => `<button data-i="${i}"><b>${p.n}</b><span>${p.d}</span></button>`).join('');

  function authLine() {
    el.auth.textContent = el.user.value === 'anonymous'
      ? 'No Authorization header is sent.'
      : `Authorization: Basic ${btoa(el.user.value + ':secret')}`;
  }
  function load(i) {
    const p = PRESETS[i];
    el.user.value = p.user; el.method.value = p.m || 'GET'; el.url.value = B + p.u;
    el.body.value = p.b ? JSON.stringify(p.b, null, 2) : '';
    [...el.presets.children].forEach((b, k) => b.classList.toggle('sel', k === i));
    authLine();
  }
  function send() {
    let body = null;
    if (el.body.value.trim() && el.method.value !== 'GET') {
      try { body = JSON.parse(el.body.value); }
      catch { return render({ status: 400, body: { error: { code: '400', message: 'Request body is not valid JSON' } } }, 0); }
    }
    const t0 = performance.now();
    let out;
    try { out = sim.handle({ method: el.method.value, url: el.url.value.trim(), body, user: el.user.value }); }
    catch (e) { out = { status: 400, body: { error: { code: '400', message: e.message } } }; }
    render(out, performance.now() - t0);
  }
  function render(out, ms) {
    const ok = out.status < 300;
    el.status.textContent = `${out.status} ${{ 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed' }[out.status] || ''}`;
    el.status.className = 'badge ' + (ok ? 'ok' : 'err');
    el.time.textContent = `${ms.toFixed(1)} ms (simulated)`;
    el.res.innerHTML = out.body === null ? '<span class="tk-c">(empty response)</span>'
      : highlight(JSON.stringify(out.body, null, 2), 'json');
    el.res.classList.remove('flash'); void el.res.offsetWidth; el.res.classList.add('flash');
    const panel = el.res.closest('.req');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  el.presets.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { load(+b.dataset.i); send(); } });
  el.user.addEventListener('change', authLine);
  $('#pg-send').addEventListener('click', send);
  el.url.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  $('#pg-reset').addEventListener('click', () => { sim.reset(); el.status.textContent = 'Data reset'; el.status.className = 'badge ok'; });
  load(0);
})();
