// Live preview of the UI5 storefront in sample-cap-java/app/webapp. It is a Fiori-style replica that talks to the
// same in-browser stand-in service as the API playground, so both panels share one database.
(() => {
  const sim = window.projectSim, root = document.getElementById('uiapp');
  if (!sim || !root) return;

  const BASE = '/odata/v4/shop/';
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = n => Number(n).toFixed(2);
  const state = { user: 'customer', page: 'shop', orderId: null, search: '', lowOnly: false, cart: {}, checkout: false, tour: -1, lastOrder: null, customerId: null, msg: null, apiOpen: false, calls: [], act: 'Opened the app', actId: 0 };

  function call(method, path, body) {
    const out = sim.handle({ method, url: BASE + path, body, user: state.user });
    state.calls.unshift({ m: method, p: decodeURIComponent(path).slice(0, 90), s: out.status, a: state.act, g: state.actId });
    if (state.calls.length > 60) state.calls.length = 60;
    return out;
  }
  const setAct = label => { state.act = label; state.actId++; };
  const fail = out => `${out.status}: ${out.body.error.message}`;
  const stockCls = n => (n < 5 ? 'err' : n < 20 ? 'warn' : 'ok');
  const statusCls = s => ({ PAID: 'ok', SHIPPED: 'ok', NEW: 'warn', CANCELLED: 'err' }[s] || 'neutral');

  // Products currently on offer, by id, so the basket can show names and prices
  const catalogue = () => Object.fromEntries((call('GET', 'Products').body.value || []).map(p => [p.ID, p]));

  function basket() {
    const products = catalogue();
    const lines = Object.entries(state.cart).filter(([id]) => products[id]).map(([id, quantity]) => ({ id, quantity, name: products[id].name, price: products[id].price, stock: products[id].stock }));
    return { lines, ...CapSim.quote(lines), count: lines.reduce((n, l) => n + l.quantity, 0) };
  }

  function tierHint(b) {
    const next = [[100, 5], [200, 10], [500, 15]].find(([from]) => b.subtotal < from);
    return next ? `Add ${money(next[0] - b.subtotal)} more for ${next[1]}% off` : 'Best discount reached';
  }

  function shopPage() {
    const filter = state.search ? `&$filter=contains(name,'${state.search.replace(/'/g, '')}')` : '';
    let rows = call('GET', `Products?$orderby=name${filter}`).body.value || [];
    if (state.lowOnly) {
      const ids = new Set((call('GET', 'lowStockProducts(threshold=5)').body.value || []).map(p => p.ID));
      rows = rows.filter(p => ids.has(p.ID));
    }
    const b = basket();
    return `<div class="shop-grid"><div>
        <div class="toolbar"><h4>Products <small>(${rows.length})</small></h4><span class="grow"></span>
          <input type="search" placeholder="Type to search…" value="${esc(state.search)}" data-act="search" aria-label="Search by name">
          <button class="ui-btn ${state.lowOnly ? 'on' : ''}" data-act="low" aria-pressed="${state.lowOnly}">⚠ Low stock</button></div>
        <table class="ui-table"><thead><tr><th>Product</th><th class="r">Price</th><th class="r">Stock</th><th></th></tr></thead><tbody>
        ${rows.map(p => `<tr><td><b>${esc(p.name)}</b><br><small>${esc(p.sku)} · ${esc(p.category)}</small></td><td class="r">${money(p.price)}</td><td class="r"><span class="chip ${stockCls(p.stock)}">${p.stock}</span></td>
          <td class="r"><span class="actions"><button class="ui-btn" data-act="add" data-id="${p.ID}" ${p.stock < 1 ? 'disabled' : ''}>＋ Add</button>${state.user === 'admin' ? `<button class="ui-btn mini" data-act="restock" data-id="${p.ID}" title="Restock 10 (admin only)" aria-label="Restock 10 (admin only)">⟳ +10</button>` : ''}</span></td></tr>`).join('') || '<tr><td colspan="4" class="empty">No products found</td></tr>'}
        </tbody></table></div>
      <aside class="panel cart" aria-label="Basket"><div class="panel-h">Basket <small>(${b.count})</small></div>
        ${b.lines.length ? `<ul>${b.lines.map(l => `<li><span class="nm">${esc(l.name)}</span>
            <span class="qty"><button class="ui-btn mini" data-act="dec" data-id="${l.id}" aria-label="One less">−</button><b>${l.quantity}</b><button class="ui-btn mini" data-act="add" data-id="${l.id}" aria-label="One more">＋</button></span>
            <span class="lt">${money(l.price * l.quantity)}</span></li>`).join('')}</ul>
          <dl class="sum"><dt>Subtotal</dt><dd>${money(b.subtotal)}</dd>
          <dt>Discount${b.discountPercent ? ` (${b.discountPercent}%)` : ''}</dt><dd>${b.discount ? '−' + money(b.discount) : '0.00'}</dd>
          <dt class="tot">Total</dt><dd class="tot">${money(b.total)} USD</dd></dl>
          <p class="tier">${tierHint(b)}</p>
          <button class="ui-btn emph wide" data-act="checkout">🛒 Checkout</button>` : '<p class="empty">Your basket is empty. Add something from the list.</p>'}
      </aside></div>`;
  }

  function ordersPage() {
    const rows = call('GET', 'Orders?$orderby=orderedOn desc&$expand=customer').body.value || [];
    return `<div class="toolbar"><h4>Orders <small>(${rows.length})</small></h4></div>
      <table class="ui-table"><thead><tr><th>Order</th><th>Ordered on</th><th>Customer</th><th>Status</th><th class="r">Total</th><th></th></tr></thead><tbody>
      ${rows.map(o => `<tr data-act="order" data-id="${o.ID}" tabindex="0"><td><b>${esc(o.orderNo)}</b></td><td>${esc(o.orderedOn)}</td><td>${esc(o.customer.name)}<br><small>${esc(o.customer.city)}</small></td>
        <td><span class="chip ${statusCls(o.status)}">${esc(o.status)}</span></td><td class="r">${money(o.total)} USD</td><td class="nav">›</td></tr>`).join('')}</tbody></table>`;
  }

  function orderPage() {
    const admin = state.user === 'admin';
    const o = (call('GET', `Orders?$filter=ID eq '${state.orderId}'&$expand=items,customer`).body.value || [])[0];
    if (!o) { state.page = 'orders'; return ordersPage(); }
    const products = catalogue();
    return `<div class="toolbar"><button class="ui-btn" data-act="orders" aria-label="Back">‹ Back</button><h4>${esc(o.orderNo)} <small>${esc(o.customer.name)}</small></h4><span class="grow"></span>
        ${admin && o.status === 'NEW' ? '<button class="ui-btn emph" data-act="pay">✔ Mark as paid</button>' : ''}
        ${admin && o.status === 'PAID' ? '<button class="ui-btn emph" data-act="ship">🚚 Ship order</button>' : ''}
        ${['NEW', 'PAID'].includes(o.status) ? '<button class="ui-btn danger" data-act="cancel">✕ Cancel order</button>' : ''}</div>
      <div class="obj"><div><span class="chip ${statusCls(o.status)}">${esc(o.status)}</span>
        <dl><dt>Ordered on</dt><dd>${esc(o.orderedOn)}</dd><dt>City</dt><dd>${esc(o.customer.city)}</dd><dt>Subtotal</dt><dd>${money(o.subtotal)} USD</dd><dt>Discount</dt><dd>${o.discount ? '−' : ''}${money(o.discount)} USD</dd></dl></div>
        <div class="big">${money(o.total)}<small> USD</small></div></div>
      <table class="ui-table"><thead><tr><th>Product</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Line total</th></tr></thead><tbody>
      ${o.items.map(i => `<tr><td>${esc((products[i.product_ID] || {}).name || i.product_ID)}</td><td class="r">${i.quantity}</td><td class="r">${money(i.unitPrice)}</td><td class="r">${money(i.lineTotal)}</td></tr>`).join('')}</tbody></table>`;
  }

  // Calls the Admin-only functions salesSummary() and topProducts(limit)
  function salesPage() {
    const sum = call('GET', 'salesSummary()'), top = call('GET', 'topProducts(limit=3)');
    if (sum.status !== 200) {
      return `<div class="toolbar"><h4>Sales</h4></div><p class="empty">${esc(fail(sum))}. Only admins can see sales figures, so switch the user to <b>admin</b>.</p>`;
    }
    const s = sum.body, list = top.body.value || [], max = Math.max(1, ...list.map(t => t.unitsSold));
    return `<div class="toolbar"><h4>Sales</h4><small>Cancelled orders are not counted</small></div>
      <div class="kpis"><div><b>${s.orders}</b><span>Orders</span></div><div><b>${money(s.revenue)}</b><span>Revenue (USD)</span></div><div><b>${money(s.averageOrder)}</b><span>Average order (USD)</span></div></div>
      <div class="panel"><div class="panel-h">Top products by units sold</div><ul class="bars">
      ${list.map(t => `<li><span>${esc(t.name)}</span><span class="bar"><i style="width:${(t.unitsSold / max) * 100}%"></i></span><b>${t.unitsSold}</b></li>`).join('')}</ul></div>`;
  }

  function checkoutDialog() {
    const b = basket(), customers = call('GET', 'Customers?$orderby=name').body.value || [];
    if (!state.customerId && customers[0]) state.customerId = customers[0].ID;
    return `<div class="dlg-back"><form class="dlg" data-act="place" aria-label="Checkout">
      <h4>Checkout</h4>
      <label>Customer<select name="customer">${customers.map(c => `<option value="${c.ID}" ${c.ID === state.customerId ? 'selected' : ''}>${esc(c.name)} (${esc(c.city)})</option>`).join('')}</select></label>
      <ul class="mini-list">${b.lines.map(l => `<li><span>${l.quantity} × ${esc(l.name)}</span><span>${money(l.price * l.quantity)}</span></li>`).join('')}</ul>
      <dl class="sum"><dt>Subtotal</dt><dd>${money(b.subtotal)}</dd><dt>Discount${b.discountPercent ? ` (${b.discountPercent}%)` : ''}</dt><dd>${b.discount ? '−' : ''}${money(b.discount)}</dd><dt class="tot">Total</dt><dd class="tot">${money(b.total)} USD</dd></dl>
      <p class="muted small">The preview price is only a guide: the server prices the order again.</p>
      <div class="row end"><button type="submit" class="ui-btn emph">Place order</button><button type="button" class="ui-btn" data-act="close">Cancel</button></div></form></div>`;
  }

  /* ---------- Guided tour: highlights real parts of the app and performs the steps for the visitor ---------- */
  const byName = n => Object.values(catalogue()).find(p => p.name.includes(n));
  const firstCustomer = () => (call('GET', 'Customers?$orderby=name').body.value || [])[0];
  const TOUR = [
    { title: 'Choose who you are', sel: 'label select',
      text: 'You start as a CUSTOMER. Later we switch to ADMIN, who has extra rights. The role comes from the login token, so the server decides what is allowed.',
      enter() { sim.reset(); Object.assign(state, { user: 'customer', page: 'shop', cart: {}, checkout: false, orderId: null, search: '', lowOnly: false, msg: null, calls: [], apiOpen: false }); } },
    { title: 'Fill the basket', sel: '.cart',
      text: 'We added two products for you. The discount grows with the basket: 5% from 100, 10% from 200, 15% from 500. This is only a preview, the server prices the order again.',
      enter() { state.cart = { [byName('Headphones').ID]: 1, [byName('Notebooks').ID]: 2 }; } },
    { title: 'Check out', sel: '.dlg',
      text: 'Pick the customer and place the order. The service checks stock, applies the discount and saves the order in one transaction.',
      enter() { state.checkout = true; state.customerId = firstCustomer().ID; } },
    { title: 'The order is saved', sel: 'tr[data-act=order]',
      text: 'The new order is at the top, with a number like SO-1A2B3C4D. Stock went down for the products you bought.',
      enter() {
        const items = Object.entries(state.cart).map(([productID, quantity]) => ({ productID, quantity }));
        const out = call('POST', 'placeOrder', { customerID: state.customerId, items });
        state.lastOrder = out.body.ID;
        Object.assign(state, { cart: {}, checkout: false, page: 'orders', msg: { type: 'success', text: `Order placed. Total: ${money(out.body.total)} USD` } });
      } },
    { title: 'Change the user', sel: 'label select', waitFor: 'admin', cta: 'Switch for me',
      text: 'We opened your order. As a CUSTOMER you can only cancel it. Now change USER to ADMIN yourself with the highlighted menu, or press Switch for me.',
      enter() { Object.assign(state, { page: 'order', orderId: state.lastOrder, user: 'customer', msg: null }); } },
    { title: 'New admin buttons', sel: '[data-act=pay]',
      text: 'As ADMIN, new buttons appear. They are hidden for customers, and the server refuses them with a 403 even if someone calls the API directly (try it in Try the API below).',
      enter() { state.user = 'admin'; } },
    { title: 'Mark as paid, then ship', sel: '[data-act=ship]',
      text: 'The order is now PAID. The next step is SHIP. The steps only work in order: shipping an unpaid order is refused with a 409.',
      enter() { const out = call('POST', 'markOrderPaid', { orderID: state.orderId }); state.msg = out.status === 200 ? { type: 'success', text: 'Order is now PAID' } : { type: 'error', text: fail(out) }; } },
    { title: 'Sales figures', sel: '.kpis',
      text: 'The order is shipped. This page is ADMIN only: it calls two read-only functions, salesSummary() and topProducts().',
      enter() { call('POST', 'shipOrder', { orderID: state.orderId }); Object.assign(state, { page: 'sales', msg: null }); } },
    { title: 'Every step is a real request', sel: '.apibar',
      text: 'Each click sent a request to the service. Open this bar any time to see them. Now explore on your own, or call the API directly below.',
      enter() { state.apiOpen = true; } },
  ];

  const tourLayer = () => {
    if (state.tour < 0) return '';
    const s = TOUR[state.tour], last = state.tour === TOUR.length - 1;
    return `<div class="tour${s.waitFor ? ' pass' : ''}"><div class="tour-spot"></div>
      <div class="tour-card" role="dialog" aria-label="Guided tour">
        <button class="tour-x" data-act="tourend" aria-label="End the tour">✕</button>
        <div class="tour-n">STEP ${state.tour + 1} OF ${TOUR.length}</div>
        <h5>${esc(s.title)}</h5><p>${esc(s.text)}</p>
        <div class="tour-ctl"><button data-act="tourback" ${state.tour === 0 ? 'disabled' : ''}>Back</button>
          <span class="tour-dots">${TOUR.map((_, i) => `<i class="${i === state.tour ? 'on' : ''}"></i>`).join('')}</span>
          <button class="primary" data-act="tournext">${last ? 'Finish' : (s.cta || 'Next')}</button></div></div></div>`;
  };

  // Put the spotlight on the target and the card on the far side of it.
  // On a narrow window the card is a compact sheet at the bottom, and the target is scrolled into the space above it.
  function placeTour() {
    if (state.tour < 0) return;
    const shell = root.querySelector('.shell'), spot = root.querySelector('.tour-spot'), card = root.querySelector('.tour-card');
    const target = root.querySelector(TOUR[state.tour].sel);
    if (!target || !shell) { spot.style.display = 'none'; return; }
    const compact = shell.getBoundingClientRect().width < 640;
    card.classList.toggle('sheet', compact);
    const bar = root.querySelector('.apibar'), barH = bar ? bar.offsetHeight : 0;
    const page = root.querySelector('.ui-page');
    // On a narrow window, leave room below the content so even the last item can be scrolled up above the card
    if (page) page.style.setProperty('--tour-pad', compact ? card.offsetHeight + 24 + 'px' : '0px');
    if (page && page.contains(target)) {
      const pr = page.getBoundingClientRect(), tr = target.getBoundingClientRect();
      page.scrollTop += compact ? tr.top - (pr.top + 10) : (tr.top - pr.top) - (pr.height - tr.height) / 2;
    }
    const sr = shell.getBoundingClientRect(); let tr = target.getBoundingClientRect(); const pad = 6;
    const center = tr.top - sr.top + tr.height / 2;
    const cardAtBottom = compact ? !target.closest('.apibar') : center < sr.height / 2;
    // wide window: put the card on the side of the target that has room, so it never covers what it points at
    const leftFree = tr.left - sr.left, rightFree = sr.right - tr.right, best = Math.max(leftFree, rightFree);
    if (!compact && best >= 260) {
      card.style.width = Math.min(380, best - 28) + 'px'; card.style.translate = '0 0';
      if (rightFree >= leftFree) { card.style.left = 'auto'; card.style.right = '14px'; } else { card.style.left = '14px'; card.style.right = 'auto'; }
    } else { card.style.width = ''; card.style.translate = ''; card.style.left = ''; card.style.right = ''; }
    card.style.top = cardAtBottom ? 'auto' : (compact ? '8px' : '68px');
    card.style.bottom = cardAtBottom ? (compact ? barH + 8 : 56) + 'px' : 'auto';
    // a tall target is highlighted only down to the card, so the highlight never hides behind it
    let top = tr.top, bottom = tr.bottom;
    if (compact) {
      const cr = card.getBoundingClientRect();
      if (cardAtBottom) bottom = Math.min(bottom, cr.top - 6); else top = Math.max(top, cr.bottom + 6);
      if (bottom - top < 30) { top = tr.top; bottom = Math.min(tr.bottom, tr.top + 30); }
    }
    Object.assign(spot.style, { display: 'block', left: tr.left - sr.left - pad + 'px', top: top - sr.top - pad + 'px', width: tr.width + pad * 2 + 'px', height: bottom - top + pad * 2 + 'px' });
  }

  function showTour(i) {
    state.tour = i;
    document.body.classList.add('app-touring');
    for (let k = 0; k <= i; k++) { setAct('Tour step ' + (k + 1) + ': ' + TOUR[k].title); TOUR[k].enter(); }   // replay from the start, so Back always shows a consistent app
    render();
  }
  function startTour() {
    root.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showTour(0);
    root.querySelector('.tour-card [data-act=tournext]')?.focus({ preventScroll: true });
  }
  function endTour() { state.tour = -1; document.body.classList.remove('app-touring'); render(); }
  document.addEventListener('click', e => { if (e.target.closest('[data-tour]')) { e.preventDefault(); startTour(); } });
  addEventListener('resize', placeTour);
  addEventListener('keydown', e => { if (e.key === 'Escape' && state.tour >= 0) endTour(); });

  const BUTTONS = { shop: 'PRODUCTS tab', orders: 'ORDERS tab', sales: 'SALES tab', restock: '⟳ +10 (restock)', pay: 'MARK AS PAID', ship: 'SHIP ORDER',
    order: 'An order row', low: 'LOW STOCK', add: '＋ ADD', dec: '− (one less)', cancel: 'CANCEL ORDER', checkout: 'CHECKOUT' };

  const DESCRIBE = [
    [/^GET lowStockProducts/, 'Asks which products are running low'],
    [/^GET Products\?/, 'Loads the product list'],
    [/^GET Products/, 'Looks up current prices and stock'],
    [/^GET Orders\?\$filter/, 'Loads this order with its lines'],
    [/^GET Orders/, 'Loads the orders'],
    [/^GET Customers/, 'Loads the customers for checkout'],
    [/^POST placeOrder/, 'Places the order: checks stock, applies the discount, saves it'],
    [/^POST cancelOrder/, 'Cancels the order and puts the items back in stock'],
    [/^POST markOrderPaid/, 'Moves the order from NEW to PAID'],
    [/^POST shipOrder/, 'Moves the order from PAID to SHIPPED'],
    [/^POST restockProduct/, 'Adds 10 items to the stock'],
    [/^GET salesSummary/, 'Orders, revenue and average order'],
    [/^GET topProducts/, 'The best sellers'],
  ];
  const describe = c => (DESCRIBE.find(([re]) => re.test(c.m + ' ' + c.p)) || [0, ''])[1];

  // Every request the screen sent to the service, docked at the bottom of the window
  function apiBar() {
    const badge = c => `<span class="badge ${c.s < 300 ? 'ok' : 'err'}">${c.s}</span>`;
    // group by the button that caused the calls (newest first), merging identical repeats
    const groups = [];
    for (const c of state.calls) {
      let g = groups.find(x => x.id === c.g);
      if (!g) groups.push(g = { id: c.g, label: c.a, rows: [] });
      const row = g.rows.find(r => r.m === c.m && r.p === c.p && r.s === c.s);
      if (row) row.n++; else g.rows.push({ ...c, n: 1 });
    }
    groups.forEach(g => g.rows.reverse());          // oldest request first inside a group, like the real order
    const latest = groups[0];
    const main = latest && (latest.rows.find(r => r.m !== 'GET') || latest.rows[0]);
    const more = latest ? latest.rows.length - 1 : 0;
    const head = latest
      ? `<span class="by">You pressed <em>${esc(latest.label)}</em></span><span class="arrow">→</span><code>${main.m} ${esc(main.p)}</code> ${badge(main)}${more ? `<span class="more">+${more} more</span>` : ''}`
      : '<span class="by">Press any button to see the requests it sends</span>';
    return `<div class="apibar ${state.apiOpen ? 'open' : ''}">
      <button class="apibar-h" data-act="apitoggle" aria-expanded="${state.apiOpen}"><b>API CALLS</b>
        <span class="last">${head}</span><i>${state.apiOpen ? '▾' : '▴'}</i></button>
      <div class="apibar-list">${groups.slice(0, 8).map(g => `<section><h6><span>You pressed</span> <em>${esc(g.label)}</em></h6><ol>${g.rows.map(r =>
        `<li><b>${r.m}</b> <code>${esc(r.p)}</code> ${badge(r)}${r.n > 1 ? `<span class="more">×${r.n}</span>` : ''}<span class="why">${esc(describe(r))}</span></li>`).join('')}</ol></section>`).join('')
        || '<p class="none">Nothing yet.</p>'}</div></div>`;
  }

  function render() {
    const active = document.activeElement;
    const keep = active && root.contains(active) && active.matches('[data-act=search]') ? { pos: active.selectionStart } : null;
    if (state.user !== 'admin' && state.page === 'sales') state.page = 'shop';
    const strip = state.msg ? `<div class="strip ${state.msg.type}" role="alert">${esc(state.msg.text)}<button data-act="dismiss" aria-label="Dismiss">✕</button></div>` : '';
    const count = Object.values(state.cart).reduce((n, q) => n + q, 0);
    root.innerHTML = `<div class="shell${state.tour >= 0 ? ' touring' : ''}">
      <div class="shell-bar"><span class="sdot"></span><b>CAP Store</b>
        <button class="tab ${state.page === 'shop' ? 'on' : ''}" data-act="shop">Products${count ? ` <span class="pill">${count}</span>` : ''}</button>
        <button class="tab ${state.page === 'orders' || state.page === 'order' ? 'on' : ''}" data-act="orders">Orders</button>
        ${state.user === 'admin' ? `<button class="tab ${state.page === 'sales' ? 'on' : ''}" data-act="sales">Sales</button>` : ''}
        <button class="tab guide-tab" data-act="tourstart">▶ GUIDED TOUR</button><span class="grow"></span>
        <label>USER <select data-act="user"><option value="customer" ${state.user === 'customer' ? 'selected' : ''}>CUSTOMER (SHOPPER)</option><option value="admin" ${state.user === 'admin' ? 'selected' : ''}>ADMIN (OPERATOR)</option></select></label></div>
      <p class="hint">${state.user === 'admin'
        ? 'You are <b>ADMIN</b>: everything a customer can do, plus restock, mark as paid, ship and sales. Switch to <b>CUSTOMER</b> and those buttons disappear.'
        : 'You are <b>CUSTOMER</b>: browse, fill a basket, check out and cancel orders. Switch to <b>ADMIN</b> to restock, mark orders as paid, ship them and see sales.'}</p>
      <div class="ui-page">${strip}${state.page === 'shop' ? shopPage() : state.page === 'orders' ? ordersPage() : state.page === 'sales' ? salesPage() : orderPage()}</div>${apiBar()}${state.checkout ? checkoutDialog() : ''}${tourLayer()}</div>`;
    if (state.tour >= 0) { placeTour(); requestAnimationFrame(placeTour); }   // now, and once more after layout settles
    if (keep) {
      const box = root.querySelector('[data-act=search]');
      if (box) { box.focus({ preventScroll: true }); box.setSelectionRange(keep.pos, keep.pos); }
    }
  }

  const go = patch => { Object.assign(state, patch); render(); };
  const setQty = (id, delta) => {
    const q = (state.cart[id] || 0) + delta;
    const next = { ...state.cart }; if (q > 0) next[id] = q; else delete next[id];
    return next;
  };

  root.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t || ['SELECT', 'INPUT', 'FORM'].includes(t.tagName)) return;
    if (t.classList.contains('dlg-back') && e.target !== t) return;   // a click inside the dialog must not close it
    if (BUTTONS[t.dataset.act]) setAct(BUTTONS[t.dataset.act]);
    switch (t.dataset.act) {
      case 'shop': go({ page: 'shop', msg: null }); break;
      case 'orders': go({ page: 'orders', msg: null }); break;
      case 'sales': go({ page: 'sales', msg: null }); break;
      case 'restock': {
        const out = call('POST', 'restockProduct', { productID: t.dataset.id, quantity: 10 });
        go({ msg: out.status === 200 ? { type: 'success', text: `Restocked ${out.body.name}: now ${out.body.stock} in stock` } : { type: 'error', text: fail(out) } });
        break;
      }
      case 'pay':
      case 'ship': {
        const out = call('POST', t.dataset.act === 'pay' ? 'markOrderPaid' : 'shipOrder', { orderID: state.orderId });
        go({ msg: out.status === 200 ? { type: 'success', text: `Order is now ${out.body.status}` } : { type: 'error', text: fail(out) } });
        break;
      }
      case 'order': go({ page: 'order', orderId: t.dataset.id, msg: null }); break;
      case 'low': go({ lowOnly: !state.lowOnly }); break;
      case 'dismiss': go({ msg: null }); break;
      case 'tourstart': startTour(); break;
      case 'tournext': state.tour >= TOUR.length - 1 ? endTour() : showTour(state.tour + 1); break;
      case 'tourback': showTour(state.tour - 1); break;
      case 'tourend': endTour(); break;
      case 'apitoggle': { state.apiOpen = !state.apiOpen; const bar = t.closest('.apibar'); bar.classList.toggle('open', state.apiOpen); t.setAttribute('aria-expanded', String(state.apiOpen)); t.querySelector('i').textContent = state.apiOpen ? '▾' : '▴'; break; }
      case 'close': go({ checkout: false }); break;
      case 'checkout': go({ checkout: true, msg: null }); break;
      case 'add': {
        const stock = (catalogue()[t.dataset.id] || {}).stock || 0;
        if ((state.cart[t.dataset.id] || 0) >= stock) return go({ msg: { type: 'error', text: 'No more of this product in stock' } });
        go({ cart: setQty(t.dataset.id, 1), msg: null }); break;
      }
      case 'dec': go({ cart: setQty(t.dataset.id, -1) }); break;
      case 'cancel': {
        const out = call('POST', 'cancelOrder', { orderID: state.orderId });
        go({ msg: out.status === 200 ? { type: 'success', text: 'Order cancelled, items are back in stock' } : { type: 'error', text: fail(out) } });
        break;
      }
    }
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('[data-act=search]')) { clearTimeout(searchTimer); setAct('Search by name'); }
    if (e.key === 'Enter' && e.target.matches('[data-act=search]')) go({ search: e.target.value.trim() });
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-act=order]')) { e.preventDefault(); e.target.click(); }
  });
  let searchTimer = 0;
  root.addEventListener('input', e => {
    if (!e.target.matches('[data-act=search]')) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { setAct('Search by name'); go({ search: e.target.value.trim() }); }, 350);
  });
  root.addEventListener('change', e => {
    if (e.target.matches('[data-act=user]')) {
      setAct('USER menu → ' + e.target.value.toUpperCase());
      go({ user: e.target.value, msg: null });
      if (state.tour >= 0 && TOUR[state.tour].waitFor === state.user) showTour(state.tour + 1);
    }
    if (e.target.name === 'customer') state.customerId = e.target.value;
  });
  root.addEventListener('submit', e => {
    e.preventDefault();
    setAct('PLACE ORDER');
    const items = Object.entries(state.cart).map(([productID, quantity]) => ({ productID, quantity }));
    const out = call('POST', 'placeOrder', { customerID: new FormData(e.target).get('customer'), items });
    if (out.status === 200) go({ cart: {}, checkout: false, page: 'orders', msg: { type: 'success', text: `Order placed. Total: ${money(out.body.total)} USD` } });
    else go({ checkout: false, msg: { type: 'error', text: fail(out) } });
  });

  render();
})();
