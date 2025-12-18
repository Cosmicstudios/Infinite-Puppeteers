const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;
const DB_FILE = path.join(__dirname, 'db.json');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

function loadDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    const initial = { users: [], vendors: [], products: [], orders: [], commissions: [], config: { commissionRate: 0.1 } };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();

// ensure audit logs exist
if (!db.auditLogs) db.auditLogs = []; 

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let filepath = decodeURIComponent(req.url);
  if (filepath === '/') filepath = '/index.html';
  const full = path.join(FRONTEND_DIR, filepath);
  if (!full.startsWith(FRONTEND_DIR)) return false;
  if (!fs.existsSync(full)) return false;
  const ext = path.extname(full).slice(1);
  const mime = { html: 'text/html', js: 'application/javascript', css: 'text/css', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' }[ext] || 'application/octet-stream';
  const content = fs.readFileSync(full);
  res.writeHead(200, { 'Content-Type': mime });
  res.end(content);
  return true;
}

// --- Simple auth helpers using Node core crypto (stateless HMAC tokens) ---
const crypto = require('crypto');
function ensureSecret() {
  if (!db.config) db.config = {};
  if (!db.config.__secret) {
    db.config.__secret = crypto.randomBytes(32).toString('hex');
    saveDB(db);
  }
  return db.config.__secret;
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const h = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const secret = ensureSecret();
  const sig = crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${h}.${p}.${sig}`;
}

function verifyToken(token) {
  try {
    const [h, p, sig] = token.split('.');
    const secret = ensureSecret();
    const expected = crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    if (!expected || !sig) return null;
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function getAuthUser(req) {
  const ah = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!ah) return null;
  const parts = ah.split(' ');
  if (parts.length !== 2) return null;
  const token = parts[1];
  const payload = verifyToken(token);
  if (!payload || !payload.id) return null;
  const user = db.users.find(u => u.id === payload.id);
  return user || null;
}

// Allow vendors to authenticate using an API key (for direct product uploads / integrations)
function getVendorByApiKey(req) {
  const key = req.headers['x-api-key'] || req.headers['x-api-Key'] || req.headers['X-Api-Key'];
  if (!key) return null;
  if (!db.vendors) return null;
  // support hashed storage (apiKeyHash) and legacy plaintext (apiKey)
  const hashed = crypto.createHash('sha256').update(key).digest('hex');
  const found = db.vendors.find(v => {
    if (v.apiKeyHash) {
      try {
        return crypto.timingSafeEqual(Buffer.from(v.apiKeyHash, 'hex'), Buffer.from(hashed, 'hex'));
      } catch (e) {
        return false;
      }
    }
    if (v.apiKey) return v.apiKey === key; // legacy
    return false;
  });
  return found || null;
}


const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      // Simple routing
      if (req.method === 'GET' && req.url === '/api/health') {
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === 'GET' && req.url.match(/^\/api\/products/)) {
        const url = new URL(`http://localhost${req.url}`);
        const category = url.searchParams.get('category');
        const niche = url.searchParams.get('niche');
        let filtered = db.products;
        if (category) {
          filtered = filtered.filter(p => p.categoryId === category);
        }
        if (niche) {
          filtered = filtered.filter(p => p.nichId === niche);
        }
        return sendJson(res, 200, filtered);
      }

      // Auth: register
      if (req.method === 'POST' && req.url === '/api/auth/register') {
        const body = await parseBody(req);
        const email = (body.email || '').toLowerCase();
        const password = body.password || '';
        const role = body.role || 'buyer';
        if (!email || !password) return sendJson(res, 400, { error: 'email_password_required' });
        if (db.users.find(u => u.email === email)) return sendJson(res, 409, { error: 'user_exists' });
        const id = 'u_' + Date.now().toString();
        const { salt, hash } = hashPassword(password);
        const user = { id, email, salt, hash, role, createdAt: new Date().toISOString() };
        db.users.push(user);
        saveDB(db);
        const token = signToken({ id: user.id, role: user.role, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 });
        return sendJson(res, 201, { id: user.id, email: user.email, role: user.role, token });
      }

      // Auth: login
      if (req.method === 'POST' && req.url === '/api/auth/login') {
        const body = await parseBody(req);
        const email = (body.email || '').toLowerCase();
        const password = body.password || '';
        const user = db.users.find(u => u.email === email);
        if (!user) return sendJson(res, 401, { error: 'invalid_credentials' });
        const ok = verifyPassword(password, user.salt, user.hash);
        if (!ok) return sendJson(res, 401, { error: 'invalid_credentials' });
        const token = signToken({ id: user.id, role: user.role, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 });
        return sendJson(res, 200, { id: user.id, email: user.email, role: user.role, token });
      }

      // Whoami
      if (req.method === 'GET' && req.url === '/api/me') {
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { error: 'unauthorized' });
        const safe = { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
        return sendJson(res, 200, safe);
      }

      // Categories
      if (req.method === 'GET' && req.url === '/api/categories') {
        return sendJson(res, 200, db.categories || []);
      }

      // Get category by ID with commission rate
      if (req.method === 'GET' && req.url.match(/^\/api\/categories\/[^/]+$/)) {
        const catId = req.url.split('/')[3];
        const category = (db.categories || []).find(c => c.id === catId);
        if (!category) return sendJson(res, 404, { error: 'category_not_found' });
        return sendJson(res, 200, category);
      }

      // Niches
      if (req.method === 'GET' && req.url === '/api/niches') {
        return sendJson(res, 200, db.niches || []);
      }

      // Get niches by category
      if (req.method === 'GET' && req.url.match(/^\/api\/categories\/[^/]+\/niches$/)) {
        const catId = req.url.split('/')[3];
        const niches = (db.niches || []).filter(n => n.categoryId === catId);
        return sendJson(res, 200, niches);
      }

      // Get niche by ID
      if (req.method === 'GET' && req.url.match(/^\/api\/niches\/[^/]+$/)) {
        const nicheId = req.url.split('/')[3];
        const niche = (db.niches || []).find(n => n.id === nicheId);
        if (!niche) return sendJson(res, 404, { error: 'niche_not_found' });
        return sendJson(res, 200, niche);
      }

      // Admin: bulk import categories & niches from JSON
      if (req.method === 'POST' && req.url === '/api/admin/categories/bulk/import') {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const body = await parseBody(req);
        if (!body.categories || !Array.isArray(body.categories)) return sendJson(res, 400, { error: 'invalid_payload' });
        if (!db.categories) db.categories = [];
        if (!db.niches) db.niches = [];
        const imported = { categories: 0, niches: 0 };
        body.categories.forEach(cat => {
          const existing = db.categories.find(c => c.id === cat.id);
          if (!existing) {
            db.categories.push({ id: cat.id, name: cat.name, description: cat.description || '', icon: cat.icon || '', commissionRate: typeof cat.commissionRate === 'number' ? cat.commissionRate : 0.1 });
            imported.categories++;
          }
          if (cat.niches && Array.isArray(cat.niches)) {
            cat.niches.forEach(niche => {
              const existingNiche = db.niches.find(n => n.id === niche.id);
              if (!existingNiche) {
                db.niches.push({ id: niche.id, name: niche.name, description: niche.description || '', categoryId: cat.id });
                imported.niches++;
              }
            });
          }
        });
        saveDB(db);
        return sendJson(res, 200, { ok: true, imported });
      }

      // Admin: create category
      if (req.method === 'POST' && req.url === '/api/admin/categories') {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const body = await parseBody(req);
        const id = (body.id || 'cat_' + Date.now().toString());
        const category = { id, name: body.name || 'Unnamed', description: body.description || '', icon: body.icon || '', commissionRate: typeof body.commissionRate === 'number' ? body.commissionRate : (db.config && db.config.categoryCommissionRates && db.config.categoryCommissionRates[body.id]) || 0.1 };
        if (!db.categories) db.categories = [];
        db.categories.push(category);
        saveDB(db);
        return sendJson(res, 201, category);
      }

      // Admin: update category
      if (req.method === 'PUT' && req.url.match(/^\/api\/admin\/categories\/[^/]+$/)) {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const id = req.url.split('/')[3];
        const category = (db.categories || []).find(c => c.id === id);
        if (!category) return sendJson(res, 404, { error: 'category_not_found' });
        const body = await parseBody(req);
        if (body.name) category.name = body.name;
        if (body.description) category.description = body.description;
        if (body.icon) category.icon = body.icon;
        if (typeof body.commissionRate === 'number') category.commissionRate = body.commissionRate;
        saveDB(db);
        return sendJson(res, 200, category);
      }

      // Admin: delete category
      if (req.method === 'DELETE' && req.url.match(/^\/api\/admin\/categories\/[^/]+$/)) {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const id = req.url.split('/')[3];
        db.categories = (db.categories || []).filter(c => c.id !== id);
        // remove related niches
        db.niches = (db.niches || []).filter(n => n.categoryId !== id);
        // unset categoryId from products
        db.products.forEach(p => { if (p.categoryId === id) p.categoryId = null; });
        saveDB(db);
        return sendJson(res, 200, { ok: true });
      }

      // Admin: create niche under a category
      if (req.method === 'POST' && req.url.match(/^\/api\/admin\/categories\/[^/]+\/niches$/)) {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const catId = req.url.split('/')[3];
        const body = await parseBody(req);
        const id = (body.id || 'n_' + Date.now().toString());
        const niche = { id, name: body.name || 'Unnamed', description: body.description || '', categoryId: catId };
        if (!db.niches) db.niches = [];
        db.niches.push(niche);
        saveDB(db);
        return sendJson(res, 201, niche);
      }

      // Admin: update niche
      if (req.method === 'PUT' && req.url.match(/^\/api\/admin\/niches\/[^/]+$/)) {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const id = req.url.split('/')[3];
        const niche = (db.niches || []).find(n => n.id === id);
        if (!niche) return sendJson(res, 404, { error: 'niche_not_found' });
        const body = await parseBody(req);
        if (body.name) niche.name = body.name;
        if (body.description) niche.description = body.description;
        if (body.categoryId) niche.categoryId = body.categoryId;
        saveDB(db);
        return sendJson(res, 200, niche);
      }

      // Admin: delete niche
      if (req.method === 'DELETE' && req.url.match(/^\/api\/admin\/niches\/[^/]+$/)) {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const id = req.url.split('/')[3];
        db.niches = (db.niches || []).filter(n => n.id !== id);
        db.products.forEach(p => { if (p.nicheId === id) p.nicheId = null; });
        saveDB(db);
        return sendJson(res, 200, { ok: true });
      }

      // Admin: get category analytics
      if (req.method === 'GET' && req.url === '/api/admin/analytics/categories') {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const analytics = {};
        if (!db.categories) db.categories = [];
        db.categories.forEach(cat => {
          const catProducts = db.products.filter(p => p.categoryId === cat.id);
          const catOrders = db.orders.filter(o => o.items.some(it => {
            const prod = db.products.find(p => p.id === it.productId);
            return prod && prod.categoryId === cat.id;
          }));
          const totalRevenue = catOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
          const totalCommission = catOrders.reduce((sum, o) => sum + (o.commissionAmount || 0), 0);
          const avgOrderValue = catOrders.length > 0 ? +(totalRevenue / catOrders.length).toFixed(2) : 0;
          const avgCommission = catOrders.length > 0 ? +(totalCommission / catOrders.length).toFixed(2) : 0;
          analytics[cat.id] = {
            categoryId: cat.id,
            categoryName: cat.name,
            products: catProducts.length,
            orders: catOrders.length,
            totalRevenue: +(totalRevenue).toFixed(2),
            totalCommission: +(totalCommission).toFixed(2),
            avgOrderValue,
            avgCommission,
            commissionRate: cat.commissionRate * 100 + '%'
          };
        });
        return sendJson(res, 200, analytics);
      }

      // Admin: get order analytics by category
      if (req.method === 'GET' && req.url.match(/^\/api\/admin\/analytics\/categories\/[^/]+\/orders$/)) {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const catId = req.url.split('/')[4];
        const category = (db.categories || []).find(c => c.id === catId);
        if (!category) return sendJson(res, 404, { error: 'category_not_found' });
        const orders = db.orders.filter(o => o.items.some(it => {
          const prod = db.products.find(p => p.id === it.productId);
          return prod && prod.categoryId === catId;
        }));
        const details = orders.map(o => ({
          orderId: o.id,
          buyer: o.buyer,
          subtotal: o.subtotal,
          commission: o.commissionAmount,
          discount: o.discount,
          total: o.total,
          createdAt: o.createdAt,
          itemCount: o.items.length
        }));
        return sendJson(res, 200, { category: category.name, orders: details, orderCount: orders.length });
      }

      // Admin: get category-based discount rules
      if (req.method === 'GET' && req.url === '/api/admin/discount-rules') {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const rules = db.discountRules || [];
        const active = rules.map(r => ({
          ...r,
          categoryName: (db.categories || []).find(c => c.id === r.categoryId)?.name
        }));
        return sendJson(res, 200, active);
      }

      // Admin: create discount rule for category
      if (req.method === 'POST' && req.url === '/api/admin/discount-rules') {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const body = await parseBody(req);
        if (!body.categoryId || typeof body.discountPercent !== 'number') {
          return sendJson(res, 400, { error: 'missing_required_fields' });
        }
        const rule = {
          id: 'rule_' + Date.now().toString(),
          name: body.name || 'Discount Rule',
          categoryId: body.categoryId,
          discountPercent: body.discountPercent,
          maxDiscount: body.maxDiscount || null,
          active: body.active !== false,
          startAt: body.startAt || new Date().toISOString(),
          endAt: body.endAt || null
        };
        if (!db.discountRules) db.discountRules = [];
        db.discountRules.push(rule);
        saveDB(db);
        return sendJson(res, 201, rule);
      }

      // Admin: update discount rule
      if (req.method === 'PUT' && req.url.match(/^\/api\/admin\/discount-rules\/[^/]+$/)) {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const ruleId = req.url.split('/')[4];
        const rule = (db.discountRules || []).find(r => r.id === ruleId);
        if (!rule) return sendJson(res, 404, { error: 'rule_not_found' });
        const body = await parseBody(req);
        if (body.name) rule.name = body.name;
        if (body.categoryId) rule.categoryId = body.categoryId;
        if (typeof body.discountPercent === 'number') rule.discountPercent = body.discountPercent;
        if (body.maxDiscount !== undefined) rule.maxDiscount = body.maxDiscount;
        if (typeof body.active === 'boolean') rule.active = body.active;
        if (body.startAt) rule.startAt = body.startAt;
        if (body.endAt) rule.endAt = body.endAt;
        saveDB(db);
        return sendJson(res, 200, rule);
      }

      // Admin: delete discount rule
      if (req.method === 'DELETE' && req.url.match(/^\/api\/admin\/discount-rules\/[^/]+$/)) {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const ruleId = req.url.split('/')[4];
        db.discountRules = (db.discountRules || []).filter(r => r.id !== ruleId);
        saveDB(db);
        return sendJson(res, 200, { ok: true });
      }

      // Public: get active discount rules by category
      if (req.method === 'GET' && req.url.match(/^\/api\/discount-rules\/category\/[^/]+$/)) {
        const catId = req.url.split('/')[4];
        const now = Date.now();
        const rules = (db.discountRules || []).filter(r => {
          if (!r.active || r.categoryId !== catId) return false;
          if (r.startAt && new Date(r.startAt).getTime() > now) return false;
          if (r.endAt && new Date(r.endAt).getTime() < now) return false;
          return true;
        });
        return sendJson(res, 200, rules);
      }

      if (req.method === 'GET' && req.url === '/api/vendors') {
        return sendJson(res, 200, db.vendors);
      }

      // Get vendor by ID and their products
      if (req.method === 'GET' && req.url.match(/^\/api\/vendors\/[^/]+$/)) {
        const parts = req.url.split('/');
        const vid = parts[3];
        const vendor = db.vendors.find(v => v.id === vid);
        if (!vendor) return sendJson(res, 404, { error: 'vendor_not_found' });
        const prods = db.products.filter(p => p.vendorId === vid);
        return sendJson(res, 200, { vendor, products: prods });
      }

      // Vendor apply
      if (req.method === 'POST' && req.url === '/api/vendors/apply') {
        const body = await parseBody(req);
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { error: 'unauthorized' });
        const id = 'v_' + Date.now().toString();
        const vendor = { id, userId: user.id, businessName: body.businessName || user.email, status: 'pending', createdAt: new Date().toISOString(), payoutInfo: body.payoutInfo || null };
        db.vendors.push(vendor);
        saveDB(db);
        return sendJson(res, 201, vendor);
      }

      // Admin: approve vendor
      if (req.method === 'POST' && req.url.startsWith('/api/admin/vendors/') && req.url.endsWith('/approve')) {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const parts = req.url.split('/');
        const vid = parts[3];
        const vendor = db.vendors.find(v => v.id === vid);
        if (!vendor) return sendJson(res, 404, { error: 'not_found' });
        vendor.status = 'active';
        vendor.approvedAt = new Date().toISOString();
        saveDB(db);
        return sendJson(res, 200, vendor);
      }

      if (req.method === 'POST' && req.url === '/api/products') {
        const body = await parseBody(req);
        // support both vendor JWT auth OR vendor API key (x-api-key)
        const apiVendor = getVendorByApiKey(req);
        const user = getAuthUser(req);
        let vendor = null;
        const usedByApiKey = !!apiVendor;
        if (apiVendor) {
          vendor = apiVendor;
        } else {
          if (!user || user.role !== 'vendor') return sendJson(res, 403, { error: 'forbidden' });
          vendor = db.vendors.find(v => v.userId === user.id);
          if (!vendor) return sendJson(res, 400, { error: 'vendor_not_found' });
        }
        const id = Date.now().toString();
        const product = {
          id,
          title: body.title || 'Untitled',
          description: body.description || '',
          vendorId: vendor.id,
          price: body.price || 0,
          categoryId: body.categoryId || null,
          nicheId: body.nicheId || null,
          metadata: body.metadata || null,
          images: body.images || [],
          status: 'active',
          createdAt: new Date().toISOString()
        };
        db.products.push(product);
        // update api key usage metadata and audit log when used via API key
        if (usedByApiKey) {
          try {
            if (!vendor.apiKeyMeta) vendor.apiKeyMeta = {};
            vendor.apiKeyMeta.lastUsed = new Date().toISOString();
            db.auditLogs.push({ id: 'a_' + Date.now().toString(), type: 'apiKey.used', vendorId: vendor.id, action: 'product.create', at: vendor.apiKeyMeta.lastUsed });
          } catch (e) {}
        }
        saveDB(db);
        return sendJson(res, 201, product);
      }

      // Vendor: bulk product import (supports API key authentication for integrations)
      if (req.method === 'POST' && req.url === '/api/vendor/products/bulk') {
        const body = await parseBody(req);
        const apiVendor = getVendorByApiKey(req);
        const user = getAuthUser(req);
        let vendor = null;
        const usedByApiKey = !!apiVendor;
        if (apiVendor) vendor = apiVendor;
        else {
          if (!user || user.role !== 'vendor') return sendJson(res, 403, { error: 'forbidden' });
          vendor = db.vendors.find(v => v.userId === user.id);
          if (!vendor) return sendJson(res, 400, { error: 'vendor_not_found' });
        }
        if (!Array.isArray(body.products)) return sendJson(res, 400, { error: 'invalid_payload' });
        const added = [];
        body.products.forEach(p => {
          const id = Date.now().toString() + '_' + Math.floor(Math.random() * 1000);
          const product = {
            id,
            title: p.title || 'Untitled',
            description: p.description || '',
            vendorId: vendor.id,
            price: p.price || 0,
            categoryId: p.categoryId || null,
            nicheId: p.nicheId || null,
            metadata: p.metadata || null,
            images: p.images || [],
            status: p.status || 'active',
            createdAt: new Date().toISOString()
          };
          db.products.push(product);
          added.push(product);
        });
        // update api key usage metadata and audit log when used via API key
        if (usedByApiKey) {
          try {
            if (!vendor.apiKeyMeta) vendor.apiKeyMeta = {};
            vendor.apiKeyMeta.lastUsed = new Date().toISOString();
            db.auditLogs.push({ id: 'a_' + Date.now().toString(), type: 'apiKey.used', vendorId: vendor.id, action: 'product.bulk', at: vendor.apiKeyMeta.lastUsed, count: added.length });
          } catch (e) {}
        }
        saveDB(db);
        return sendJson(res, 201, { addedCount: added.length, products: added });
      }

      // Allow vendors to generate a developer API key (vendor or admin). Accepts optional { label }
      if (req.method === 'POST' && req.url.match(/^\/api\/vendors\/[^/]+\/generate-api-key$/)) {
        const parts = req.url.split('/');
        const vid = parts[3];
        const user = getAuthUser(req);
        const vendor = db.vendors.find(v => v.id === vid);
        if (!vendor) return sendJson(res, 404, { error: 'vendor_not_found' });
        // Only vendor owner or admin can generate
        if (!(user && (user.role === 'admin' || (user.role === 'vendor' && vendor.userId === user.id)))) return sendJson(res, 403, { error: 'forbidden' });
        const body = await parseBody(req);
        const key = crypto.randomBytes(24).toString('hex');
        // store a sha256 hash of the api key
        vendor.apiKeyHash = crypto.createHash('sha256').update(key).digest('hex');
        if (!vendor.apiKeyMeta) vendor.apiKeyMeta = {};
        const now = new Date().toISOString();
        vendor.apiKeyMeta.label = body && body.label ? body.label : (vendor.apiKeyMeta.label || 'default');
        vendor.apiKeyMeta.createdAt = now;
        vendor.apiKeyMeta.createdBy = user ? user.id : null;
        vendor.apiKeyMeta.revokedAt = null;
        // remove any legacy plaintext field
        if (vendor.apiKey) delete vendor.apiKey;
        // audit log
        db.auditLogs.push({ id: 'a_' + Date.now().toString(), type: 'apiKey.generate', vendorId: vendor.id, by: user ? user.id : null, label: vendor.apiKeyMeta.label, createdAt: now });
        saveDB(db);
        return sendJson(res, 200, { apiKey: key, label: vendor.apiKeyMeta.label });
      }

      // Revoke an API key for a vendor (vendor owner or admin)
      if (req.method === 'POST' && req.url.match(/^\/api\/vendors\/[^/]+\/revoke-api-key$/)) {
        const parts = req.url.split('/');
        const vid = parts[3];
        const user = getAuthUser(req);
        const vendor = db.vendors.find(v => v.id === vid);
        if (!vendor) return sendJson(res, 404, { error: 'vendor_not_found' });
        if (!(user && (user.role === 'admin' || (user.role === 'vendor' && vendor.userId === user.id)))) return sendJson(res, 403, { error: 'forbidden' });
        const now = new Date().toISOString();
        vendor.apiKeyHash = null;
        if (!vendor.apiKeyMeta) vendor.apiKeyMeta = {};
        vendor.apiKeyMeta.revokedAt = now;
        if (vendor.apiKey) delete vendor.apiKey;
        db.auditLogs.push({ id: 'a_' + Date.now().toString(), type: 'apiKey.revoke', vendorId: vendor.id, by: user ? user.id : null, revokedAt: now });
        saveDB(db);
        return sendJson(res, 200, { ok: true });
      }

      // Admin: list API key metadata for vendors
      if (req.method === 'GET' && req.url === '/api/admin/api-keys') {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const list = (db.vendors || []).map(v => ({ id: v.id, businessName: v.businessName || v.website || null, apiKeyMeta: v.apiKeyMeta || null }));
        return sendJson(res, 200, list);
      }

      // Allow updating API key label (vendor owner or admin)
      if (req.method === 'PUT' && req.url.match(/^\/api\/vendors\/[^/]+\/api-key-label$/)) {
        const parts = req.url.split('/');
        const vid = parts[3];
        const user = getAuthUser(req);
        const vendor = db.vendors.find(v => v.id === vid);
        if (!vendor) return sendJson(res, 404, { error: 'vendor_not_found' });
        if (!(user && (user.role === 'admin' || (user.role === 'vendor' && vendor.userId === user.id)))) return sendJson(res, 403, { error: 'forbidden' });
        const body = await parseBody(req);
        if (!vendor.apiKeyMeta) vendor.apiKeyMeta = {};
        const old = vendor.apiKeyMeta.label;
        vendor.apiKeyMeta.label = body.label || vendor.apiKeyMeta.label || 'default';
        db.auditLogs.push({ id: 'a_' + Date.now().toString(), type: 'apiKey.label.update', vendorId: vendor.id, by: user ? user.id : null, oldLabel: old, newLabel: vendor.apiKeyMeta.label, at: new Date().toISOString() });
        saveDB(db);
        return sendJson(res, 200, { ok: true, label: vendor.apiKeyMeta.label });
      }

      // Provider connect: create a vendor from a website or external system and return storefront/embed info
      if (req.method === 'POST' && req.url === '/api/vendors/connect') {
        const body = await parseBody(req);
        // Allow anonymous provider creation but mark as pending unless a user token present
        const user = getAuthUser(req);
        const id = 'v_' + Date.now().toString();
        const vendor = {
          id,
          userId: user ? user.id : null,
          businessName: body.businessName || (body.website || 'External Provider'),
          website: body.website || null,
          status: body.autoActivate ? 'active' : 'pending',
          createdAt: new Date().toISOString(),
          payoutInfo: body.payoutInfo || null,
          storefrontPath: `/store/${id}`
        };
        db.vendors.push(vendor);
        saveDB(db);
        const embedUrl = `/api/embed/${vendor.id}`;
        return sendJson(res, 201, { vendor, storefrontUrl: vendor.storefrontPath, embedUrl });
      }

      // Provide embeddable snippet or metadata for a vendor storefront
      if (req.method === 'GET' && req.url.match(/^\/api\/embed\/[^/]+$/)) {
        const parts = req.url.split('/');
        const vid = parts[3];
        const vendor = db.vendors.find(v => v.id === vid);
        if (!vendor) return sendJson(res, 404, { error: 'vendor_not_found' });
        const storefront = { storefrontUrl: vendor.storefrontPath || `/store/${vendor.id}`, embedSnippet: `<iframe src=\"${vendor.storefrontPath || `/store/${vendor.id}`}\" width=\"800\" height=\"600\"></iframe>` };
        return sendJson(res, 200, storefront);
      }

      // Vendor: update their own product
      if (req.method === 'PUT' && req.url.match(/^\/api\/products\/[^/]+$/)) {
        const user = getAuthUser(req);
        if (!user || user.role !== 'vendor') return sendJson(res, 403, { error: 'forbidden' });
        const parts = req.url.split('/');
        const pid = parts[3];
        const product = db.products.find(p => p.id === pid);
        if (!product) return sendJson(res, 404, { error: 'product_not_found' });
        const vendor = db.vendors.find(v => v.userId === user.id);
        if (!vendor || product.vendorId !== vendor.id) return sendJson(res, 403, { error: 'forbidden' });
        const body = await parseBody(req);
        if (body.title) product.title = body.title;
        if (body.description) product.description = body.description;
        if (typeof body.price === 'number') product.price = body.price;
        if (body.categoryId) product.categoryId = body.categoryId;
        if (body.nicheId) product.nicheId = body.nicheId;
        if (body.status) product.status = body.status;
        saveDB(db);
        return sendJson(res, 200, product);
      }

      // Vendor: delete their own product
      if (req.method === 'DELETE' && req.url.match(/^\/api\/products\/[^/]+$/)) {
        const user = getAuthUser(req);
        if (!user || user.role !== 'vendor') return sendJson(res, 403, { error: 'forbidden' });
        const parts = req.url.split('/');
        const pid = parts[3];
        const idx = db.products.findIndex(p => p.id === pid);
        if (idx === -1) return sendJson(res, 404, { error: 'product_not_found' });
        const product = db.products[idx];
        const vendor = db.vendors.find(v => v.userId === user.id);
        if (!vendor || product.vendorId !== vendor.id) return sendJson(res, 403, { error: 'forbidden' });
        db.products.splice(idx, 1);
        saveDB(db);
        return sendJson(res, 204, null);
      }

      if (req.method === 'POST' && req.url === '/api/orders') {
        const body = await parseBody(req);
        const id = Date.now().toString();
        const items = body.items || [];
        const subtotal = items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0);

        // Handle coupon code if provided
        let discount = 0;
        if (body.couponCode) {
          const code = (body.couponCode || '').toString();
          const coupon = db.coupons.find(c => c.code === code);
          if (!coupon) return sendJson(res, 400, { error: 'invalid_coupon' });
          const now = Date.now();
          if (coupon.startAt && new Date(coupon.startAt).getTime() > now) return sendJson(res, 400, { error: 'coupon_not_started' });
          if (coupon.endAt && new Date(coupon.endAt).getTime() < now) return sendJson(res, 400, { error: 'coupon_expired' });
          if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return sendJson(res, 400, { error: 'coupon_usage_exhausted' });
          if (coupon.discountType === 'percentage') {
            discount = +(subtotal * (coupon.amount / 100)).toFixed(2);
          } else {
            discount = +coupon.amount.toFixed(2);
          }
          // ensure discount doesn't exceed subtotal
          if (discount > subtotal) discount = subtotal;
          // increment usedCount
          coupon.usedCount = (coupon.usedCount || 0) + 1;
        }

        const total = +(subtotal - discount).toFixed(2);
        // Calculate commission based on product categories (weighted by product value)
        let commissionAmount = 0;
        items.forEach(item => {
          const product = db.products.find(p => p.id === item.productId);
          let rate = db.config && db.config.commissionRate ? db.config.commissionRate : 0.1;
          if (product && product.categoryId && db.categories) {
            const cat = db.categories.find(c => c.id === product.categoryId);
            if (cat && typeof cat.commissionRate === 'number') rate = cat.commissionRate;
          }
          const itemTotal = (item.price || 0) * (item.qty || 1);
          const itemDiscount = (discount / subtotal) * itemTotal;
          const itemNetTotal = itemTotal - itemDiscount;
          commissionAmount += itemNetTotal * rate;
        });
        commissionAmount = +commissionAmount.toFixed(2);
        const order = { id, buyer: body.buyer || null, items, subtotal, discount, total, commissionAmount, createdAt: new Date().toISOString() };
        db.orders.push(order);
        db.commissions.push({ id: 'c_' + id, orderId: id, amount: commissionAmount, status: 'pending', createdAt: new Date().toISOString(), vendorId: body.vendorId || null });
        saveDB(db);
        return sendJson(res, 201, order);
      }

      // Coupons: list (public)
      if (req.method === 'GET' && req.url === '/api/coupons') {
        return sendJson(res, 200, db.coupons || []);
      }

      // Create coupon (admin only)
      if (req.method === 'POST' && req.url === '/api/coupons') {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const body = await parseBody(req);
        if (!body.code || !body.discountType || typeof body.amount === 'undefined') return sendJson(res, 400, { error: 'invalid_payload' });
        const id = 'cp_' + Date.now().toString();
        const coupon = { id, code: body.code.toString(), discountType: body.discountType, amount: Number(body.amount), usageLimit: body.usageLimit || null, usedCount: 0, startAt: body.startAt || null, endAt: body.endAt || null, createdAt: new Date().toISOString() };
        db.coupons.push(coupon);
        saveDB(db);
        return sendJson(res, 201, coupon);
      }

      // Offers list
      if (req.method === 'GET' && req.url === '/api/offers') {
        return sendJson(res, 200, db.offers || []);
      }

      // Admin: list payouts
      if (req.method === 'GET' && req.url === '/api/admin/payouts') {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        return sendJson(res, 200, db.payouts || []);
      }

      // Admin: mark commission paid and create a payout record
      if (req.method === 'POST' && req.url.startsWith('/api/admin/commissions/') && req.url.endsWith('/pay')) {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        const parts = req.url.split('/');
        const cid = parts[3];
        const comm = db.commissions.find(c => c.id === cid);
        if (!comm) return sendJson(res, 404, { error: 'not_found' });
        comm.status = 'paid';
        comm.paidAt = new Date().toISOString();
        const payout = { id: 'p_' + Date.now().toString(), vendorId: comm.vendorId || null, commissionId: comm.id, amount: comm.amount, createdAt: new Date().toISOString(), status: 'processed' };
        db.payouts.push(payout);
        saveDB(db);
        return sendJson(res, 200, { commission: comm, payout });
      }

      // Simulate payment for an order (development only)
      if (req.method === 'POST' && req.url === '/api/payments/simulate') {
        const body = await parseBody(req);
        const orderId = body.orderId;
        if (!orderId) return sendJson(res, 400, { error: 'orderId_required' });
        const order = db.orders.find(o => o.id === orderId);
        if (!order) return sendJson(res, 404, { error: 'order_not_found' });
        // mark paid
        order.paymentStatus = 'paid';
        order.status = 'paid';
        order.paidAt = new Date().toISOString();

        // mark related commission as payable
        const comm = db.commissions.find(c => c.orderId === orderId);
        if (comm) {
          comm.status = 'payable';
          comm.payableAt = new Date().toISOString();
        }

        saveDB(db);
        return sendJson(res, 200, { order, commission: comm || null });
      }

      // Stripe Connect helpers (optional). These routes will fail with a clear
      // message if Stripe keys are not configured; they are safe to leave in.
      if (req.method === 'POST' && req.url === '/api/stripe/create-account') {
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { error: 'unauthorized' });
        const body = await parseBody(req);
        const email = body.email || user.email;
        try {
          const stripeHelpers = require('./stripe/stripe_integration');
          const account = await stripeHelpers.createConnectAccount(email);
          // attach to vendor record if exists (or create a vendor record)
          let vendor = db.vendors.find(v => v.userId === user.id);
          if (!vendor) {
            vendor = { id: 'v_' + Date.now().toString(), userId: user.id, businessName: user.email, status: 'pending', createdAt: new Date().toISOString(), payoutInfo: null };
            db.vendors.push(vendor);
          }
          vendor.stripeAccountId = account.id;
          saveDB(db);
          return sendJson(res, 200, { accountId: account.id });
        } catch (err) {
          return sendJson(res, 500, { error: 'stripe_error', message: err.message });
        }
      }

      if (req.method === 'POST' && req.url === '/api/stripe/account-link') {
        const body = await parseBody(req);
        if (!body.accountId) return sendJson(res, 400, { error: 'accountId_required' });
        try {
          const stripeHelpers = require('./stripe/stripe_integration');
          const link = await stripeHelpers.createAccountLink(body.accountId, body.refreshUrl || 'http://localhost:4000/admin.html', body.returnUrl || 'http://localhost:4000/admin.html');
          return sendJson(res, 200, link);
        } catch (err) {
          return sendJson(res, 500, { error: 'stripe_error', message: err.message });
        }
      }

      // Create a payment intent for an order (uses Stripe if keys configured, falls back to mock)
      if (req.method === 'POST' && req.url === '/api/stripe/create-payment-intent') {
        const body = await parseBody(req);
        if (!body.orderId) return sendJson(res, 400, { error: 'orderId_required' });
        const order = db.orders.find(o => o.id === body.orderId);
        if (!order) return sendJson(res, 404, { error: 'order_not_found' });
        const amountCents = Math.round(order.total * 100);
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (stripeKey) {
          try {
            const stripeHelpers = require('./stripe/stripe_integration');
            const pi = await stripeHelpers.createPaymentIntentForOrder({ orderId: order.id, amount: amountCents, currency: 'usd', connectedAccountId: body.connectedAccountId || null, applicationFeeAmount: Math.round((order.total * 0.1) * 100) });
            return sendJson(res, 200, { clientSecret: pi.client_secret, paymentIntentId: pi.id });
          } catch (err) {
            return sendJson(res, 500, { error: 'stripe_error', message: err.message });
          }
        } else {
          return sendJson(res, 200, { clientSecret: 'mock_secret_' + order.id, paymentIntentId: 'mock_pi_' + order.id, message: 'Stripe not configured; use POST /api/payments/simulate' });
        }
      }

      // Webhook endpoint for Stripe. Reads raw body and verifies signature.
      if (req.method === 'POST' && req.url === '/webhooks/stripe') {
        // collect raw body
        const chunks = [];
        for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        const raw = Buffer.concat(chunks);
        const sig = req.headers['stripe-signature'] || req.headers['Stripe-Signature'] || req.headers['stripe_signature'];
        try {
          const stripeHelpers = require('./stripe/stripe_integration');
          const event = await stripeHelpers.handleWebhook(raw, sig);
          // handle a few event types
          if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
            const pi = event.data.object;
            const orderId = pi.metadata && pi.metadata.orderId;
            if (orderId) {
              const order = db.orders.find(o => o.id === orderId);
              if (order) {
                if (event.type === 'payment_intent.succeeded') {
                  order.paymentStatus = 'paid';
                  order.status = 'paid';
                  order.paidAt = new Date().toISOString();
                  const comm = db.commissions.find(c => c.orderId === orderId);
                  if (comm) { comm.status = 'payable'; comm.payableAt = new Date().toISOString(); }
                } else {
                  order.paymentStatus = 'failed';
                  order.status = 'failed';
                }
                saveDB(db);
              }
            }
          }
          // respond 200 to Stripe
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ received: true }));
        } catch (err) {
          console.error('Stripe webhook error', err && err.message);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err && err.message }));
        }
        return;
      }

      if (req.method === 'GET' && req.url === '/api/admin/commissions') {
        return sendJson(res, 200, db.commissions);
      }

      // Admin: list orders
      if (req.method === 'GET' && req.url === '/api/admin/orders') {
        const admin = getAuthUser(req);
        if (!admin || admin.role !== 'admin') return sendJson(res, 403, { error: 'forbidden' });
        return sendJson(res, 200, db.orders || []);
      }

      // Fallback for unknown API route
      return sendJson(res, 404, { error: 'Not Found' });
    }

    // Serve frontend static files
    if (serveStatic(req, res)) return;

    // Not found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (err) {
    console.error('Server error', err);
    sendJson(res, 500, { error: 'server_error' });
  }
});

server.listen(PORT, () => {
  console.log(`Backend server listening on http://localhost:${PORT}`);
});
