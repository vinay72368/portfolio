// In-browser stand-in for the sample CAP shop service: same seed data, same rules as the Java code.
(function (g) {
  'use strict';
  const BASE = '/odata/v4/shop';
  const NUMERIC = new Set(['price', 'stock', 'quantity', 'unitPrice', 'lineTotal', 'subtotal', 'discount', 'total']);

  class HttpError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }

  function parseCsv(text) {
    const [head, ...rows] = text.trim().split(/\r?\n/);
    const cols = head.split(',');
    return rows.map(line => {
      const v = line.split(',');
      return Object.fromEntries(cols.map((c, i) => [c, NUMERIC.has(c) ? Number(v[i]) : c === 'active' ? v[i] === 'true' : v[i]]));
    });
  }

  // Mirrors PricingCalculator.java, in whole cents so rounding matches BigDecimal HALF_UP exactly.
  function discountPercent(subtotalCents) {
    return subtotalCents >= 50000 ? 15 : subtotalCents >= 20000 ? 10 : subtotalCents >= 10000 ? 5 : 0;
  }
  function quote(lines) {
    const sub = lines.reduce((n, l) => n + Math.round(l.price * 100) * l.quantity, 0);
    const pct = discountPercent(sub);
    const disc = Math.floor((sub * pct + 50) / 100);
    return { subtotal: sub / 100, discountPercent: pct, discount: disc / 100, total: (sub - disc) / 100 };
  }

  const OPS = {
    eq: (a, b) => a === b, ne: (a, b) => a !== b,
    gt: (a, b) => a > b, ge: (a, b) => a >= b, lt: (a, b) => a < b, le: (a, b) => a <= b,
  };

  function parseFilter(expr) {
    return expr.split(/\s+and\s+/i).map(raw => {
      const term = raw.trim();
      let m = term.match(/^contains\((\w+),\s*'([^']*)'\)$/i);
      if (m) return r => String(r[m[1]] ?? '').toLowerCase().includes(m[2].toLowerCase());
      m = term.match(/^(\w+)\s+(eq|ne|gt|ge|lt|le)\s+('([^']*)'|-?[\d.]+|true|false|null)$/i);
      if (!m) throw new HttpError(400, `Unsupported $filter expression: ${term}`);
      const val = m[4] !== undefined ? m[4] : m[3] === 'null' ? null : m[3] === 'true' ? true : m[3] === 'false' ? false : Number(m[3]);
      const op = OPS[m[2].toLowerCase()];
      return r => op(r[m[1]] ?? null, val);
    });
  }

  function create(csv) {
    const seed = () => ({
      Products: parseCsv(csv.products), Customers: parseCsv(csv.customers),
      Orders: parseCsv(csv.orders), OrderItems: parseCsv(csv.orderItems),
    });
    let db = seed();
    const find = (table, id) => db[table].find(r => r.ID === id);
    const itemsOf = id => db.OrderItems.filter(i => i.order_ID === id);

    function query(entity, params) {
      let rows = db[entity].map(r => ({ ...r }));
      if (params.get('$filter')) {
        const tests = parseFilter(params.get('$filter'));
        rows = rows.filter(r => tests.every(t => t(r)));
      }
      if (params.get('$orderby')) {
        const keys = params.get('$orderby').split(',').map(s => s.trim().split(/\s+/));
        rows.sort((a, b) => {
          for (const [f, dir] of keys) {
            if (a[f] === b[f]) continue;
            return (a[f] > b[f] ? 1 : -1) * (dir && dir.toLowerCase() === 'desc' ? -1 : 1);
          }
          return 0;
        });
      }
      const total = rows.length;
      rows = rows.slice(Number(params.get('$skip') || 0));
      if (params.has('$top')) rows = rows.slice(0, Number(params.get('$top')));
      if (params.get('$expand')) {
        params.get('$expand').split(',').map(s => s.trim()).forEach(nav => {
          if (entity !== 'Orders' || !['items', 'customer'].includes(nav)) throw new HttpError(400, `Navigation property '${nav}' not found`);
          rows.forEach(r => {
            if (nav === 'items') r.items = itemsOf(r.ID).map(i => ({ ...i }));
            else r.customer = { ...find('Customers', r.customer_ID) };
          });
        });
      }
      if (params.get('$select')) {
        const keep = params.get('$select').split(',').map(s => s.trim());
        rows = rows.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => keep.includes(k) || k === 'items' || k === 'customer')));
      }
      return { rows, total };
    }

    function placeOrder(body) {
      const items = body && body.items;
      if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'An order needs at least one item');
      if (!find('Customers', body.customerID)) throw new HttpError(404, `Customer ${body.customerID} not found`);
      const lines = [], rows = [], orderId = uuid(), stock = {};
      for (const item of items) {
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) throw new HttpError(400, 'Quantity must be positive');
        const p = find('Products', item.productID);
        if (!p) throw new HttpError(404, `Product ${item.productID} not found`);
        if (!p.active) throw new HttpError(409, `${p.name} is not available`);
        const have = (stock[p.ID] ?? p.stock);
        if (have < qty) throw new HttpError(409, `Only ${have} left of ${p.name}`);
        stock[p.ID] = have - qty;
        lines.push({ price: p.price, quantity: qty });
        rows.push({ ID: uuid(), order_ID: orderId, product_ID: p.ID, quantity: qty, unitPrice: p.price, lineTotal: Math.round(p.price * qty * 100) / 100 });
      }
      const q = quote(lines);
      const order = { ID: orderId, orderNo: 'SO-' + orderId.slice(0, 8).toUpperCase(), customer_ID: body.customerID, orderedOn: new Date().toISOString().slice(0, 10), status: 'NEW', subtotal: q.subtotal, discount: q.discount, total: q.total };
      db.Orders.push(order); db.OrderItems.push(...rows);
      Object.entries(stock).forEach(([id, n]) => { find('Products', id).stock = n; });
      return order;
    }

    function cancelOrder(body) {
      const order = find('Orders', body && body.orderID);
      if (!order) throw new HttpError(404, `Order ${body && body.orderID} not found`);
      if (order.status === 'SHIPPED') throw new HttpError(409, 'Shipped orders cannot be cancelled');
      if (order.status === 'CANCELLED') throw new HttpError(409, 'Order is already cancelled');
      itemsOf(order.ID).forEach(i => { find('Products', i.product_ID).stock += i.quantity; });
      order.status = 'CANCELLED';
      return order;
    }

    function changeStatus(body, from, to, message) {
      const order = find('Orders', body && body.orderID);
      if (!order) throw new HttpError(404, `Order ${body && body.orderID} not found`);
      if (order.status !== from) throw new HttpError(409, message);
      order.status = to;
      return order;
    }

    function restock(body) {
      const qty = Number(body && body.quantity) || 0;
      if (qty <= 0) throw new HttpError(400, 'Quantity must be positive');
      const product = find('Products', body.productID);
      if (!product) throw new HttpError(404, `Product ${body.productID} not found`);
      product.stock += qty;
      return product;
    }

    const liveOrders = () => db.Orders.filter(o => o.status !== 'CANCELLED');

    function salesSummary() {
      const orders = liveOrders();
      const cents = orders.reduce((n, o) => n + Math.round(o.total * 100), 0);
      const average = orders.length ? Math.floor((cents * 2 + orders.length) / (2 * orders.length)) : 0;
      return { orders: orders.length, revenue: cents / 100, averageOrder: average / 100 };
    }

    function topProducts(limit) {
      const live = new Set(liveOrders().map(o => o.ID)), sold = {};
      db.OrderItems.filter(i => live.has(i.order_ID)).forEach(i => { sold[i.product_ID] = (sold[i.product_ID] || 0) + i.quantity; });
      return Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, limit)
        .map(([productID, unitsSold]) => ({ productID, name: find('Products', productID).name, unitsSold }));
    }

    function handle({ method, url, body, user }) {
      try {
        const u = new URL(url, 'http://localhost');
        if (user === 'anonymous') throw new HttpError(401, 'Unauthorized');
        if (!u.pathname.startsWith(BASE + '/')) throw new HttpError(404, 'Service not found');
        const resource = decodeURIComponent(u.pathname.slice(BASE.length + 1));
        const admin = user === 'admin';
        const needAdmin = () => { if (!admin) throw new HttpError(403, 'Forbidden'); };

        let m;
        if ((m = resource.match(/^lowStockProducts\(threshold=(\d+)\)$/))) {
          if (method !== 'GET') throw new HttpError(405, 'Method not allowed');
          const value = db.Products.filter(p => p.stock < Number(m[1])).sort((a, b) => a.stock - b.stock).map(p => ({ ...p }));
          return { status: 200, body: { '@odata.context': '$metadata#Products', value } };
        }
        if ((m = resource.match(/^topProducts\(limit=(\d+)\)$/))) {
          if (method !== 'GET') throw new HttpError(405, 'Method not allowed');
          needAdmin();
          return { status: 200, body: { '@odata.context': '$metadata#Collection(ShopService.TopProduct)', value: topProducts(Number(m[1])) } };
        }
        if (resource === 'salesSummary()' || resource === 'salesSummary') {
          if (method !== 'GET') throw new HttpError(405, 'Method not allowed');
          needAdmin();
          return { status: 200, body: { '@odata.context': '$metadata#ShopService.SalesSummary', ...salesSummary() } };
        }
        if (['markOrderPaid', 'shipOrder', 'restockProduct'].includes(resource)) {
          if (method !== 'POST') throw new HttpError(405, 'Method not allowed');
          needAdmin();
          const result = resource === 'markOrderPaid' ? changeStatus(body, 'NEW', 'PAID', 'Only new orders can be marked as paid')
            : resource === 'shipOrder' ? changeStatus(body, 'PAID', 'SHIPPED', 'Only paid orders can be shipped') : restock(body);
          return { status: 200, body: { '@odata.context': `$metadata#${resource === 'restockProduct' ? 'Products' : 'Orders'}/$entity`, ...result } };
        }
        if (resource === 'placeOrder' || resource === 'cancelOrder') {
          if (method !== 'POST') throw new HttpError(405, 'Method not allowed');
          const order = resource === 'placeOrder' ? placeOrder(body) : cancelOrder(body);
          return { status: 200, body: { '@odata.context': '$metadata#Orders/$entity', ...order } };
        }
        if (!(m = resource.match(/^(Products|Customers|Orders|OrderItems)(?:\(([^)]+)\))?$/))) throw new HttpError(404, `Resource '${resource}' not found`);
        const [, entity, key] = m;

        if (method === 'GET') {
          if (key) {
            const row = find(entity, key);
            if (!row) throw new HttpError(404, `${entity}(${key}) not found`);
            return { status: 200, body: { '@odata.context': `$metadata#${entity}/$entity`, ...row } };
          }
          const { rows, total } = query(entity, u.searchParams);
          const out = { '@odata.context': `$metadata#${entity}` };
          if (u.searchParams.get('$count') === 'true') out['@odata.count'] = total;
          out.value = rows;
          return { status: 200, body: out };
        }

        needAdmin();
        if (method === 'DELETE') {
          if (!key || !find(entity, key)) throw new HttpError(404, `${entity}(${key || ''}) not found`);
          if (entity === 'Orders') db.OrderItems = db.OrderItems.filter(i => i.order_ID !== key);
          db[entity].splice(db[entity].findIndex(r => r.ID === key), 1);
          return { status: 204, body: null };
        }
        if (method === 'POST' && !key && entity === 'Products') {
          const b = body || {};
          if (!b.name) throw new HttpError(400, 'Value of element name is required');
          if (typeof b.price !== 'number' || b.price < 0) throw new HttpError(400, 'Price cannot be negative');
          const row = { ID: uuid(), sku: b.sku || null, name: b.name, category: b.category || null, price: b.price, stock: b.stock ?? 0, active: b.active ?? true };
          db.Products.push(row);
          return { status: 201, body: { '@odata.context': '$metadata#Products/$entity', ...row } };
        }
        throw new HttpError(405, 'Method not allowed');
      } catch (e) {
        if (!(e instanceof HttpError)) throw e;
        return { status: e.status, body: { error: { code: String(e.status), message: e.message } } };
      }
    }

    return { handle, reset() { db = seed(); } };
  }

  function uuid() {
    if (g.crypto && g.crypto.randomUUID) return g.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
  }

  const api = { create, quote };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else g.CapSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
