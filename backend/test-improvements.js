#!/usr/bin/env node
/**
 * Test suite for category improvements:
 * - Category analytics
 * - Discount rules management
 * - Discount rule validation and application
 */

const http = require('http');

const BASE_URL = 'http://localhost:4000';
let testsPassed = 0;
let testsFailed = 0;
let adminToken = null;

async function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    testsPassed++;
    console.log(`✓ ${name}`);
  } catch (err) {
    testsFailed++;
    console.log(`✗ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  Category Improvements Test Suite                       ║');
  console.log('║  - Analytics, Discount Rules, Rule Management           ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Setup: register and login as admin
  await test('Admin login', async () => {
    const resp = await request('POST', '/api/auth/login', {
      email: 'admin@example.com',
      password: 'admin'
    });
    assert(resp.status === 200, 'Expected 200, got ' + resp.status);
    assert(resp.data.token, 'Token not returned');
    adminToken = resp.data.token;
  });

  // Analytics Tests
  console.log('\n--- Category Analytics ---');

  await test('Get category analytics (admin only)', async () => {
    const resp = await request('GET', '/api/admin/analytics/categories', null, adminToken);
    assert(resp.status === 200, 'Expected 200, got ' + resp.status);
    assert(typeof resp.data === 'object', 'Should return object');
  });

  await test('Unauthorized without admin token', async () => {
    const resp = await request('GET', '/api/admin/analytics/categories');
    assert(resp.status === 401, 'Expected 401, got ' + resp.status);
  });

  await test('Analytics includes category details', async () => {
    const resp = await request('GET', '/api/admin/analytics/categories', null, adminToken);
    assert(resp.status === 200, 'Expected 200, got ' + resp.status);
    const catIds = Object.keys(resp.data);
    assert(catIds.length > 0, 'Should have at least one category');
    const electronics = resp.data['electronics'];
    assert(electronics, 'Should have electronics category');
    assert(electronics.categoryId === 'electronics', 'Category ID mismatch');
    assert(electronics.categoryName === 'Electronics & Technology', 'Category name mismatch');
    assert(typeof electronics.products === 'number', 'Should have products count');
    assert(typeof electronics.orders === 'number', 'Should have orders count');
    assert(typeof electronics.totalRevenue === 'number', 'Should have total revenue');
    assert(typeof electronics.totalCommission === 'number', 'Should have total commission');
  });

  await test('Get orders for specific category', async () => {
    const resp = await request('GET', '/api/admin/analytics/categories/electronics/orders', null, adminToken);
    assert(resp.status === 200, 'Expected 200, got ' + resp.status);
    assert(typeof resp.data.orderCount === 'number', 'Should have order count');
    assert(Array.isArray(resp.data.orders), 'Should have orders array');
  });

  await test('Category orders include correct fields', async () => {
    // Create an order first
    const resp1 = await request('POST', '/api/orders', {
      buyer: 'test@example.com',
      items: [
        { productId: 'p_1', qty: 1, price: 499.99 }
      ]
    });
    assert(resp1.status === 201, 'Order creation failed');

    // Now check analytics
    const resp2 = await request('GET', '/api/admin/analytics/categories/electronics/orders', null, adminToken);
    assert(resp2.status === 200, 'Expected 200, got ' + resp2.status);
    assert(resp2.data.orders.length > 0, 'Should have at least one order');
    const order = resp2.data.orders[0];
    assert(order.orderId, 'Should have order ID');
    assert(typeof order.subtotal === 'number', 'Should have subtotal');
    assert(typeof order.commission === 'number', 'Should have commission');
  });

  // Discount Rules Tests
  console.log('\n--- Discount Rules Management ---');

  await test('Get discount rules (initially empty)', async () => {
    const resp = await request('GET', '/api/admin/discount-rules', null, adminToken);
    assert(resp.status === 200, 'Expected 200, got ' + resp.status);
    assert(Array.isArray(resp.data), 'Should return array');
  });

  let createdRuleId = null;

  await test('Create discount rule for category', async () => {
    const resp = await request('POST', '/api/admin/discount-rules', {
      name: 'Electronics Holiday Sale',
      categoryId: 'electronics',
      discountPercent: 15,
      maxDiscount: 100,
      active: true
    }, adminToken);
    assert(resp.status === 201, 'Expected 201, got ' + resp.status);
    assert(resp.data.id, 'Should return rule ID');
    assert(resp.data.name === 'Electronics Holiday Sale', 'Name mismatch');
    assert(resp.data.categoryId === 'electronics', 'Category ID mismatch');
    assert(resp.data.discountPercent === 15, 'Discount percent mismatch');
    createdRuleId = resp.data.id;
  });

  await test('Rule includes start and end dates', async () => {
    const resp = await request('POST', '/api/admin/discount-rules', {
      name: 'Beauty Winter Special',
      categoryId: 'beauty',
      discountPercent: 20,
      active: true
    }, adminToken);
    assert(resp.status === 201, 'Expected 201, got ' + resp.status);
    assert(resp.data.startAt, 'Should have start date');
  });

  await test('Cannot create rule without category', async () => {
    const resp = await request('POST', '/api/admin/discount-rules', {
      name: 'Invalid Rule',
      discountPercent: 10
    }, adminToken);
    assert(resp.status === 400, 'Expected 400, got ' + resp.status);
  });

  await test('Update discount rule', async () => {
    const resp = await request('PUT', `/api/admin/discount-rules/${createdRuleId}`, {
      discountPercent: 25,
      maxDiscount: 150
    }, adminToken);
    assert(resp.status === 200, 'Expected 200, got ' + resp.status);
    assert(resp.data.discountPercent === 25, 'Discount percent should be updated');
    assert(resp.data.maxDiscount === 150, 'Max discount should be updated');
  });

  await test('Deactivate discount rule', async () => {
    const resp = await request('PUT', `/api/admin/discount-rules/${createdRuleId}`, {
      active: false
    }, adminToken);
    assert(resp.status === 200, 'Expected 200, got ' + resp.status);
    assert(resp.data.active === false, 'Rule should be inactive');
  });

  await test('Delete discount rule', async () => {
    const resp = await request('DELETE', `/api/admin/discount-rules/${createdRuleId}`, null, adminToken);
    assert(resp.status === 200, 'Expected 200, got ' + resp.status);
  });

  await test('Verify rule is deleted', async () => {
    const resp = await request('GET', `/api/admin/discount-rules/${createdRuleId}`, null, adminToken);
    // Either 404 or not found in list is acceptable
    assert(resp.status !== 200 || !resp.data, 'Rule should be deleted');
  });

  await test('Get active rules by category', async () => {
    // Create a rule first
    await request('POST', '/api/admin/discount-rules', {
      name: 'Fashion Active Rule',
      categoryId: 'fashion',
      discountPercent: 10,
      active: true
    }, adminToken);

    // Get active rules for fashion
    const resp = await request('GET', '/api/discount-rules/category/fashion');
    assert(resp.status === 200, 'Expected 200, got ' + resp.status);
    assert(Array.isArray(resp.data), 'Should return array');
  });

  await test('Inactive rules not returned by public endpoint', async () => {
    // Create inactive rule
    await request('POST', '/api/admin/discount-rules', {
      name: 'Fashion Inactive Rule',
      categoryId: 'fashion',
      discountPercent: 5,
      active: false
    }, adminToken);

    // Get active rules
    const resp = await request('GET', '/api/discount-rules/category/fashion');
    assert(resp.status === 200, 'Expected 200, got ' + resp.status);
    const inactiveRules = resp.data.filter(r => !r.active);
    assert(inactiveRules.length === 0, 'Inactive rules should not be returned');
  });

  await test('Rules with future startAt not returned', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // 1 day from now
    await request('POST', '/api/admin/discount-rules', {
      name: 'Future Rule',
      categoryId: 'sports',
      discountPercent: 10,
      active: true,
      startAt: futureDate
    }, adminToken);

    const resp = await request('GET', '/api/discount-rules/category/sports');
    assert(resp.status === 200, 'Expected 200, got ' + resp.status);
    const futureRules = resp.data.filter(r => new Date(r.startAt).getTime() > Date.now());
    assert(futureRules.length === 0, 'Future rules should not be returned');
  });

  await test('Expired rules not returned', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
    await request('POST', '/api/admin/discount-rules', {
      name: 'Expired Rule',
      categoryId: 'home',
      discountPercent: 15,
      active: true,
      startAt: '2025-01-01T00:00:00.000Z',
      endAt: pastDate
    }, adminToken);

    const resp = await request('GET', '/api/discount-rules/category/home');
    assert(resp.status === 200, 'Expected 200, got ' + resp.status);
    const expiredRules = resp.data.filter(r => r.endAt && new Date(r.endAt).getTime() < Date.now());
    assert(expiredRules.length === 0, 'Expired rules should not be returned');
  });

  // Results
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log(`║  Results: ${testsPassed} Passed, ${testsFailed} Failed${' '.repeat(22 - String(testsPassed).length - String(testsFailed).length)}║`);
  console.log('╚════════════════════════════════════════════════════════╝\n');

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
