#!/usr/bin/env node
// Basic tests for vendor registration, API key generation, and product uploads
const http = require('http');
const BASE_URL = 'http://localhost:4000';
let testsPassed = 0; let testsFailed = 0;

async function request(method, path, body = null, token = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const options = { hostname: url.hostname, port: url.port || 80, path: url.pathname + url.search, method, headers };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { const parsed = data ? JSON.parse(data) : {}; resolve({ status: res.statusCode, data: parsed }); }
        catch (e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
async function test(name, fn) { try { await fn(); testsPassed++; console.log('✓', name); } catch (e) { testsFailed++; console.log('✗', name, e.message); } }

async function run() {
  console.log('Vendor/Product integration tests');
  const ts = Date.now();
  const adminEmail = `admin_test_${ts}@example.com`;
  const adminPass = 'adminpass';
  const vendorEmail = `vendor_test_${ts}@example.com`;
  const vendorPass = 'vendorpass';
  let adminToken = null; let vendorToken = null; let vendorId = null; let apiKey = null;

  await test('Register admin user', async () => {
    const r = await request('POST', '/api/auth/register', { email: adminEmail, password: adminPass, role: 'admin' });
    assert(r.status === 201, 'Failed to register admin');
  });

  await test('Login admin', async () => {
    const r = await request('POST', '/api/auth/login', { email: adminEmail, password: adminPass });
    assert(r.status === 200 && r.data.token, 'Admin login failed'); adminToken = r.data.token;
  });

  await test('Register vendor user', async () => {
    const r = await request('POST', '/api/auth/register', { email: vendorEmail, password: vendorPass, role: 'vendor' });
    assert(r.status === 201, 'Vendor registration failed');
  });

  await test('Login vendor', async () => {
    const r = await request('POST', '/api/auth/login', { email: vendorEmail, password: vendorPass });
    assert(r.status === 200 && r.data.token, 'Vendor login failed'); vendorToken = r.data.token;
  });

  await test('Vendor apply creates vendor record', async () => {
    const r = await request('POST', '/api/vendors/apply', { businessName: 'Integration Test Shop' }, vendorToken);
    assert(r.status === 201 && r.data.id, 'Vendor apply failed'); vendorId = r.data.id;
  });

  await test('Admin approves vendor', async () => {
    const r = await request('POST', `/api/admin/vendors/${vendorId}/approve`, null, adminToken);
    assert(r.status === 200 && r.data.status === 'active', 'Vendor approval failed');
  });

  await test('Vendor generates API key', async () => {
    const r = await request('POST', `/api/vendors/${vendorId}/generate-api-key`, null, vendorToken);
    assert(r.status === 200 && r.data.apiKey, 'Generate API key failed'); apiKey = r.data.apiKey;
  });

  await test('Upload product with API key', async () => {
    const prod = { title: 'API Product', description: 'Uploaded via API key', price: 9.99, categoryId: 'others' };
    const r = await request('POST', '/api/products', prod, null, { 'x-api-key': apiKey });
    assert(r.status === 201 && r.data.id, 'Product upload via API key failed');
  });

  await test('Bulk upload products with API key', async () => {
    const payload = { products: [ { title: 'Bulk 1', price: 1.5 }, { title: 'Bulk 2', price: 2.5 } ] };
    const r = await request('POST', '/api/vendor/products/bulk', payload, null, { 'x-api-key': apiKey });
    assert(r.status === 201 && r.data.addedCount === 2, 'Bulk upload failed');
  });

  await test('Vendor endpoint lists uploaded products', async () => {
    const r = await request('GET', `/api/vendors/${vendorId}`);
    assert(r.status === 200 && Array.isArray(r.data.products), 'Vendor products listing failed');
    assert(r.data.products.length >= 3, 'Expected at least 3 products');
  });

  await test('Revoke API key', async () => {
    const r = await request('POST', `/api/vendors/${vendorId}/revoke-api-key`, null, vendorToken);
    assert(r.status === 200, 'Revoke API key failed');
  });

  await test('API key no longer works', async () => {
    const prod = { title: 'Should Fail', price: 3.3 };
    const r = await request('POST', '/api/products', prod, null, { 'x-api-key': apiKey });
    assert(r.status === 403 || r.status === 401, 'API key should be revoked');
  });

  console.log(`\nResults: ${testsPassed} passed, ${testsFailed} failed`);
  process.exit(testsFailed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Test error', e); process.exit(1); });
