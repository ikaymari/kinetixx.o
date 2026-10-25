const COOKIE_NAME = 'kinetix-admin-session';
const REGISTRATION_EVENTS = new Set(['PE Days', 'College Days', 'Seminar', 'Workshop', 'Officiating']);
const REGISTRATION_CATEGORIES = new Set(['Participant', 'Player', 'Audience', 'Volunteer']);

function json(data, status = 200, headers = {}) {
  return new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function productKey(productId, flavor) {
  if (typeof productId !== 'string') return null;
  if (productId.toLowerCase() === 'soya-pop') {
    const value = typeof flavor === 'string' ? flavor.toLowerCase() : 'original';
    const canonical = { original: 'Original', banana: 'Banana', cereal: 'Cereal' }[value];
    return canonical ? { id: 'soya-pop', flavor: canonical } : null;
  }
  if (productId.toLowerCase() === 'nutflix' && flavor == null) {
    return { id: 'nutflix', flavor: '' };
  }
  return null;
}

function productIdFromPath(value) {
  const separator = value.indexOf(':');
  return separator < 0
    ? productKey(value, null)
    : productKey(value.slice(0, separator), value.slice(separator + 1));
}

function cookieValue(request, name) {
  const cookies = request.headers.get('Cookie') || '';
  for (const part of cookies.split(';')) {
    const separator = part.indexOf('=');
    if (separator >= 0 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function adminSession(request, env) {
  const token = cookieValue(request, COOKIE_NAME);
  if (!token) return false;
  const tokenHash = await sha256(token);
  const session = await env.DB.prepare(
    'SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND expires_at > ?'
  ).bind(tokenHash, Math.floor(Date.now() / 1000)).first();
  return Boolean(session);
}

function validAdminMutation(request) {
  return request.headers.get('X-Kinetix-Admin') === 'true' &&
    request.headers.get('Origin') === new URL(request.url).origin;
}

function normalizeOrderItem(item) {
  if (!item || typeof item !== 'object' || typeof item.productId !== 'string' ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000000) {
    return null;
  }
  const key = productKey(item.productId, item.flavor);
  return key ? { ...key, quantity: item.quantity } : null;
}

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 &&
    /^\S+@\S+\.\S+$/.test(value);
}

function validOrderCustomer(customer) {
  return customer && typeof customer === 'object' &&
    typeof customer.name === 'string' && customer.name.trim().length > 0 && customer.name.trim().length <= 120 &&
    typeof customer.phone === 'string' && customer.phone.trim().length <= 40 &&
    /^[0-9+\-\s()]{7,}$/.test(customer.phone.trim()) &&
    validEmail(customer.email?.trim()) &&
    typeof customer.place === 'string' && customer.place.trim().length > 0 && customer.place.trim().length <= 300;
}

function validRegistration(body) {
  if (typeof body?.name !== 'string' || !body.name.trim() || body.name.trim().length > 120) {
    return 'Enter a name of 1 to 120 characters.';
  }
  if (!validEmail(body.email?.trim())) return 'Enter a valid email address.';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!phone || phone.length > 40 || !/^[0-9+\-() ]+$/.test(phone) || (phone.match(/\d/g) || []).length < 7) {
    return 'Enter a valid contact number with at least 7 digits.';
  }
  if (body.school != null && (typeof body.school !== 'string' || body.school.trim().length > 160)) {
    return 'School or organization must be 160 characters or fewer.';
  }
  if (!REGISTRATION_EVENTS.has(body.event)) return 'Choose a valid event.';
  if (!REGISTRATION_CATEGORIES.has(body.category)) return 'Choose a valid category.';
  return null;
}

function validAnnouncement(body) {
  if (typeof body?.title !== 'string' || !body.title.trim() || body.title.trim().length > 120) {
    return 'Enter an announcement title of 1 to 120 characters.';
  }
  if (typeof body.body !== 'string' || !body.body.trim() || body.body.trim().length > 2000) {
    return 'Enter announcement text of 1 to 2,000 characters.';
  }
  if (typeof body.published !== 'boolean') return 'Choose whether the announcement is published.';
  return null;
}

async function cartSnapshot(db) {
  const result = await db.prepare(
    'SELECT product_id, name, quantity, flavor FROM cart_items ORDER BY rowid'
  ).all();
  const items = result.results.map(item => ({
    productId: item.product_id,
    name: item.name,
    quantity: item.quantity,
    flavor: item.flavor || null
  }));
  return { items, totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0) };
}

async function getProducts(db) {
  const result = await db.prepare(
    'SELECT id, name, price, stock, flavor FROM products ORDER BY CASE id WHEN \'soya-pop\' THEN 0 ELSE 1 END, flavor'
  ).all();
  return result.results.map(product => ({
    id: product.id,
    name: product.name,
    price: product.price,
    stock: product.stock,
    flavor: product.flavor || null
  }));
}

function makeRegistrationCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'KNX-REG-' + Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}

async function handle(request, env) {
  if (!env.DB) return error('The Kinetix database is not configured.', 503);
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();
  const db = env.DB;

  if (path === '/api/cart' && method === 'GET') return json(await cartSnapshot(db));

  if (path === '/api/cart/items' && method === 'POST') {
    const body = await readJson(request);
    if (!body) return error('A valid JSON request is required.');
    const key = productKey(body.productId, body.flavor);
    if (!key) return error('Choose a valid product and flavor.');
    const product = await db.prepare(
      'SELECT name FROM products WHERE id = ? AND flavor = ?'
    ).bind(key.id, key.flavor).first();
    if (!product) return error('Choose a valid product.');
    const name = key.flavor ? `${product.name} - ${key.flavor}` : product.name;
    await db.prepare(
      `INSERT INTO cart_items (product_id, flavor, name, quantity) VALUES (?, ?, ?, 1)
       ON CONFLICT(product_id, flavor) DO UPDATE SET quantity = quantity + 1, name = excluded.name`
    ).bind(key.id, key.flavor, name).run();
    return json(await cartSnapshot(db));
  }

  const decrementMatch = path.match(/^\/api\/cart\/items\/(.+)\/decrement$/);
  if (decrementMatch && method === 'POST') {
    const rawKey = decodeURIComponent(decrementMatch[1]);
    const key = productIdFromPath(rawKey);
    if (!key) return error('Choose a valid cart item.');
    await db.batch([
      db.prepare(
        'DELETE FROM cart_items WHERE product_id = ? AND flavor = ? AND quantity = 1'
      ).bind(key.id, key.flavor),
      db.prepare(
        `UPDATE cart_items SET quantity = quantity - 1
         WHERE product_id = ? AND flavor = ? AND quantity > 1`
      ).bind(key.id, key.flavor)
    ]);
    return json(await cartSnapshot(db));
  }

  if (path === '/api/cart' && method === 'DELETE') {
    await db.prepare('DELETE FROM cart_items').run();
    return new Response(null, { status: 204 });
  }

  const removeMatch = path.match(/^\/api\/cart\/items\/(.+)$/);
  if (removeMatch && method === 'DELETE') {
    const key = productIdFromPath(decodeURIComponent(removeMatch[1]));
    if (!key) return error('Choose a valid cart item.');
    await db.prepare('DELETE FROM cart_items WHERE product_id = ? AND flavor = ?')
      .bind(key.id, key.flavor).run();
    return json(await cartSnapshot(db));
  }

  if (path === '/api/products' && method === 'GET') return json(await getProducts(db));

  if (path === '/api/orders/reserve' && method === 'POST') {
    const body = await readJson(request);
    if (!body) return error('A valid JSON request is required.');
    if (typeof body.orderNumber !== 'string' || !body.orderNumber.trim() ||
        body.orderNumber.length > 100 || !Array.isArray(body.items) ||
        body.items.length < 1 || body.items.length > 100) {
      return error('Include an order number and at least one valid product.');
    }
    if (!body.order || typeof body.order !== 'object') {
      return error('Submit the billing details with the order.');
    }

    const requested = body.items.map(normalizeOrderItem);
    if (requested.some(item => !item)) {
      return error('Order items must include a valid product and flavor with quantities between 1 and 1,000,000.');
    }
    const requestedTotals = new Map();
    for (const item of requested) {
      const key = `${item.id}:${item.flavor}`;
      const total = (requestedTotals.get(key) || 0) + item.quantity;
      if (total > 1000000) return error('The requested quantity for a product flavor is too large.');
      requestedTotals.set(key, total);
    }

    const checkout = body.order;
    if (!validOrderCustomer(checkout.customer)) {
      return error('Enter a valid name, contact number, email, and pick-up/delivery place.');
    }
    if (!['Cash on pick-up', 'GCash'].includes(checkout.payment) ||
        (checkout.notes != null && (typeof checkout.notes !== 'string' || checkout.notes.length > 1000)) ||
        !Array.isArray(checkout.items) || checkout.items.length < 1 || checkout.items.length > 100) {
      return error('The billing details or order items are invalid.');
    }
    const submitted = checkout.items.map(normalizeOrderItem);
    if (submitted.some(item => !item)) return error('An order contains an invalid item or flavor.');
    const submittedTotals = new Map();
    for (const item of submitted) {
      const key = `${item.id}:${item.flavor}`;
      submittedTotals.set(key, (submittedTotals.get(key) || 0) + item.quantity);
    }
    if (requestedTotals.size !== submittedTotals.size ||
        [...requestedTotals].some(([key, quantity]) => submittedTotals.get(key) !== quantity)) {
      return error('The order summary does not match the reserved quantities.');
    }

    const existing = await db.prepare('SELECT order_json FROM orders WHERE order_number = ?')
      .bind(body.orderNumber).first();
    if (existing) {
      return json({ reserved: true, alreadyProcessed: true, order: JSON.parse(existing.order_json) });
    }

    const products = await getProducts(db);
    const productMap = new Map(products.map(product => [`${product.id}:${product.flavor || ''}`, product]));
    const orderLines = [];
    let total = 0;
    for (const item of submitted) {
      const product = productMap.get(`${item.id}:${item.flavor}`);
      if (!product) return error('An order contains an unknown product.');
      const price = Math.round(Number(product.price) * 100) / 100;
      const lineTotal = price * item.quantity;
      orderLines.push({
        productId: product.id,
        name: product.flavor ? `${product.name} - ${product.flavor}` : product.name,
        ...(product.flavor ? { flavor: product.flavor } : { flavor: null }),
        quantity: item.quantity,
        price,
        total: lineTotal
      });
      total += lineTotal;
    }
    const customerOrder = {
      orderNumber: body.orderNumber,
      createdAt: new Date().toISOString(),
      customer: {
        name: checkout.customer.name.trim(),
        phone: checkout.customer.phone.trim(),
        email: checkout.customer.email.trim(),
        place: checkout.customer.place.trim()
      },
      payment: checkout.payment,
      notes: typeof checkout.notes === 'string' && checkout.notes.trim() ? checkout.notes.trim() : null,
      items: orderLines,
      total
    };

    const statements = [
      db.prepare('INSERT INTO orders (order_number, created_at, order_json) VALUES (?, ?, ?)')
        .bind(body.orderNumber, customerOrder.createdAt, JSON.stringify(customerOrder)),
      ...requested.map(item => db.prepare(
        'INSERT INTO order_reservations (order_number, product_id, flavor, quantity) VALUES (?, ?, ?, ?)'
      ).bind(body.orderNumber, item.id, item.flavor, item.quantity))
    ];
    try {
      await db.batch(statements);
    } catch (cause) {
      const savedOrder = await db.prepare('SELECT order_json FROM orders WHERE order_number = ?')
        .bind(body.orderNumber).first();
      if (savedOrder) {
        return json({ reserved: true, alreadyProcessed: true, order: JSON.parse(savedOrder.order_json) });
      }
      const currentProducts = await getProducts(db);
      for (const [key, quantity] of requestedTotals) {
        const product = productMap.get(key);
        const current = currentProducts.find(item => `${item.id}:${item.flavor || ''}` === key);
        if (!current) return error('An order contains an unknown product.');
        if (current.stock < quantity) {
          return json({
            error: `Only ${current.stock} ${product.name}${product.flavor ? ` ${product.flavor}` : ''} item(s) are currently available.`
          }, 409);
        }
      }
      throw cause;
    }
    return json({ reserved: true, alreadyProcessed: false, order: customerOrder });
  }

  if (path === '/api/announcements' && method === 'GET') {
    const result = await db.prepare(
      'SELECT id, title, body, published, created_at FROM announcements WHERE published = 1 ORDER BY created_at DESC'
    ).all();
    return json(result.results.map(item => ({
      id: item.id,
      title: item.title,
      body: item.body,
      published: Boolean(item.published),
      createdAt: item.created_at
    })));
  }

  if (path === '/api/visits' && method === 'POST') {
    await db.prepare(
      `INSERT INTO settings (key, value) VALUES ('visitor_count', 1)
       ON CONFLICT(key) DO UPDATE SET value = value + 1`
    ).run();
    return new Response(null, { status: 204 });
  }

  if (path === '/api/admin/login' && method === 'POST') {
    const body = await readJson(request);
    if (!body) return error('A valid JSON request is required.');
    if (!env.KINETIX_ADMIN_USERNAME || !env.KINETIX_ADMIN_PASSWORD) {
      return error('Admin login is not configured. Set KINETIX_ADMIN_USERNAME and KINETIX_ADMIN_PASSWORD in Cloudflare.', 503);
    }
    const submittedUsername = await sha256(typeof body.username === 'string' ? body.username : '');
    const configuredUsername = await sha256(env.KINETIX_ADMIN_USERNAME);
    const submittedPassword = await sha256(typeof body.password === 'string' ? body.password : '');
    const configuredPassword = await sha256(env.KINETIX_ADMIN_PASSWORD);
    if (submittedUsername !== configuredUsername || submittedPassword !== configuredPassword) {
      return error('The username or password is incorrect.', 401);
    }
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = base64Url(tokenBytes);
    const expiresAt = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
    const tokenHash = await sha256(token);
    await db.batch([
      db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(Math.floor(Date.now() / 1000)),
      db.prepare('INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)').bind(tokenHash, expiresAt)
    ]);
    return json({ authenticated: true }, 200, {
      'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${new Date(expiresAt * 1000).toUTCString()}`
    });
  }

  if (path === '/api/admin/session' && method === 'GET') {
    return await adminSession(request, env) ? json({ authenticated: true }) : error('Admin login required.', 401);
  }

  if (path === '/api/admin/logout' && method === 'POST') {
    if (!validAdminMutation(request)) return error('Invalid request. Include the admin request header.', 400);
    const token = cookieValue(request, COOKIE_NAME);
    if (token) {
      await db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sha256(token)).run();
    }
    return json({ authenticated: false }, 200, {
      'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    });
  }

  const adminRoutes = path.startsWith('/api/admin/');
  if (adminRoutes && !(await adminSession(request, env))) return error('Admin login required.', 401);
  if (adminRoutes && method !== 'GET' && !validAdminMutation(request)) {
    return error('Invalid request. Include the admin request header.', 400);
  }

  if (path === '/api/admin/visitors' && method === 'GET') {
    const result = await db.prepare("SELECT value FROM settings WHERE key = 'visitor_count'").first();
    return json({ count: result?.value || 0 });
  }

  if (path === '/api/admin/orders' && method === 'GET') {
    const result = await db.prepare('SELECT order_json FROM orders ORDER BY created_at DESC').all();
    return json(result.results.map(item => JSON.parse(item.order_json)));
  }

  if (path === '/api/admin/registrations' && method === 'GET') {
    const result = await db.prepare(
      'SELECT code, created_at, name, email, phone, school, event, category FROM registrations ORDER BY created_at DESC'
    ).all();
    return json(result.results.map(item => ({
      code: item.code,
      createdAt: item.created_at,
      name: item.name,
      email: item.email,
      phone: item.phone,
      school: item.school,
      event: item.event,
      category: item.category
    })));
  }

  if (path === '/api/registrations' && method === 'POST') {
    const body = await readJson(request);
    if (!body) return error('A valid JSON request is required.');
    const validationError = validRegistration(body);
    if (validationError) return error(validationError);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const registration = {
        code: makeRegistrationCode(),
        createdAt: new Date().toISOString(),
        name: body.name.trim(),
        email: body.email.trim(),
        phone: body.phone.trim(),
        school: typeof body.school === 'string' ? body.school.trim() : '',
        event: body.event,
        category: body.category
      };
      const result = await db.prepare(
        'INSERT OR IGNORE INTO registrations (code, created_at, name, email, phone, school, event, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(registration.code, registration.createdAt, registration.name, registration.email, registration.phone,
        registration.school, registration.event, registration.category).run();
      if (result.meta.changes) return json(registration, 201);
    }
    return error('A registration code could not be generated. Please try again.', 503);
  }

  const productAdminMatch = path.match(/^\/api\/admin\/products\/([^/]+)$/);
  if (productAdminMatch && method === 'PUT') {
    const body = await readJson(request);
    if (!body) return error('A valid JSON request is required.');
    if (!Number.isInteger(body.stock) || body.stock < 0 || body.stock > 1000000 ||
        typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0 || body.price > 1000000) {
      return error('Stock and price must be between 0 and 1,000,000.');
    }
    const key = productKey(decodeURIComponent(productAdminMatch[1]), body.flavor);
    if (!key) return error('Choose a valid product and flavor.');
    const existing = await db.prepare('SELECT id FROM products WHERE id = ? AND flavor = ?')
      .bind(key.id, key.flavor).first();
    if (!existing) return error('Product not found.', 404);
    await db.prepare('UPDATE products SET stock = CASE WHEN flavor = ? THEN ? ELSE stock END, price = ? WHERE id = ?')
      .bind(key.flavor, body.stock, Math.round(body.price * 100) / 100, key.id).run();
    const product = (await getProducts(db)).find(item => item.id === key.id && (item.flavor || '') === key.flavor);
    return json(product);
  }

  if (path === '/api/admin/announcements' && method === 'GET') {
    const result = await db.prepare(
      'SELECT id, title, body, published, created_at FROM announcements ORDER BY created_at DESC'
    ).all();
    return json(result.results.map(item => ({
      id: item.id,
      title: item.title,
      body: item.body,
      published: Boolean(item.published),
      createdAt: item.created_at
    })));
  }

  if (path === '/api/admin/announcements' && method === 'POST') {
    const body = await readJson(request);
    if (!body) return error('A valid JSON request is required.');
    const validationError = validAnnouncement(body);
    if (validationError) return error(validationError);
    const announcement = {
      id: crypto.randomUUID().replaceAll('-', ''),
      title: body.title.trim(),
      body: body.body.trim(),
      published: body.published,
      createdAt: new Date().toISOString()
    };
    await db.prepare(
      'INSERT INTO announcements (id, title, body, published, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(announcement.id, announcement.title, announcement.body, announcement.published ? 1 : 0, announcement.createdAt).run();
    return json(announcement, 201, { Location: `/api/admin/announcements/${announcement.id}` });
  }

  const announcementMatch = path.match(/^\/api\/admin\/announcements\/([^/]+)$/);
  if (announcementMatch && (method === 'PUT' || method === 'DELETE')) {
    const id = decodeURIComponent(announcementMatch[1]);
    if (method === 'DELETE') {
      const result = await db.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run();
      return result.meta.changes ? new Response(null, { status: 204 }) : error('Announcement not found.', 404);
    }
    const body = await readJson(request);
    if (!body) return error('A valid JSON request is required.');
    const validationError = validAnnouncement(body);
    if (validationError) return error(validationError);
    const result = await db.prepare(
      'UPDATE announcements SET title = ?, body = ?, published = ? WHERE id = ?'
    ).bind(body.title.trim(), body.body.trim(), body.published ? 1 : 0, id).run();
    if (!result.meta.changes) return error('Announcement not found.', 404);
    const announcement = await db.prepare(
      'SELECT id, title, body, published, created_at FROM announcements WHERE id = ?'
    ).bind(id).first();
    return json({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      published: Boolean(announcement.published),
      createdAt: announcement.created_at
    });
  }

  return error('Not found.', 404);
}

export async function onRequest(context) {
  try {
    return await handle(context.request, context.env);
  } catch (cause) {
    console.error('Kinetix API request failed:', cause);
    return error('The request could not be completed. Check the API logs for details.', 500);
  }
}
