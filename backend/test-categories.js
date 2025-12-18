#!/usr/bin/env node
/**
 * Enhanced test suite for marketplace API
 * Tests category-based commissions, niches, bulk import, and E2E flows
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
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.log(`✗ ${name}: ${err.message}`);
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runTests() {
  console.log('\n==== MARKETPLACE API TEST SUITE ====\n');

  // Setup: register and login admin
  console.log('[Setup] Registering admin user...');
  await request('POST', '/api/auth/register', { email: 'admin_test@test.com', password: 'pass123', role: 'admin' });
  
  console.log('[Setup] Logging in as admin...');
  const loginRes = await request('POST', '/api/auth/login', { email: 'admin_test@test.com', password: 'pass123' });
  adminToken = loginRes.data.token;
  assert(adminToken, 'Admin token should be set');

  // === Category Tests ===
  console.log('\n[Categories & Niches]\n');

  await test('List categories', async () => {
    const res = await request('GET', '/api/categories');
    assert(res.status === 200, 'Should return 200');
    assert(Array.isArray(res.data), 'Should return array');
    assert(res.data.length >= 10, 'Should have at least 10 seeded categories');
  });

  await test('Get category by ID', async () => {
    const res = await request('GET', '/api/categories/electronics');
    assert(res.status === 200, 'Should return 200');
    assert(res.data.id === 'electronics', 'Should return correct category');
    assert(typeof res.data.commissionRate === 'number', 'Should have commission rate');
  });

  await test('Get niches for category', async () => {
    const res = await request('GET', '/api/categories/electronics/niches');
    assert(res.status === 200, 'Should return 200');
    assert(Array.isArray(res.data), 'Should return array of niches');
    assert(res.data.length > 0, 'Should have niches for electronics');
  });

  await test('List all niches', async () => {
    const res = await request('GET', '/api/niches');
    assert(res.status === 200, 'Should return 200');
    assert(Array.isArray(res.data), 'Should return array');
    assert(res.data.length >= 100, 'Should have 100+ niches');
  });

  // === Admin Category Operations ===
  console.log('\n[Admin Category Operations]\n');

  let testCatId = 'testcat_' + Date.now();
  await test('Create category (admin)', async () => {
    const res = await request('POST', '/api/admin/categories', {
      id: testCatId,
      name: 'Test Category',
      description: 'For testing',
      icon: '🧪',
      commissionRate: 0.15
    }, adminToken);
    assert(res.status === 201, 'Should return 201');
    assert(res.data.id === testCatId, 'Should return created category');
  });

  await test('Update category (admin)', async () => {
    const res = await request('PUT', `/api/admin/categories/${testCatId}`, {
      name: 'Updated Test Category',
      commissionRate: 0.18
    }, adminToken);
    assert(res.status === 200, 'Should return 200');
    assert(res.data.name === 'Updated Test Category', 'Should update name');
    assert(res.data.commissionRate === 0.18, 'Should update commission rate');
  });

  let testNicheId = 'testniche_' + Date.now();
  await test('Create niche under category (admin)', async () => {
    const res = await request('POST', `/api/admin/categories/${testCatId}/niches`, {
      id: testNicheId,
      name: 'Test Niche'
    }, adminToken);
    assert(res.status === 201, 'Should return 201');
    assert(res.data.categoryId === testCatId, 'Should link to category');
  });

  await test('Update niche (admin)', async () => {
    const res = await request('PUT', `/api/admin/niches/${testNicheId}`, {
      name: 'Updated Test Niche'
    }, adminToken);
    assert(res.status === 200, 'Should return 200');
    assert(res.data.name === 'Updated Test Niche', 'Should update name');
  });

  // === Bulk Import ===
  console.log('\n[Bulk Import]\n');

  await test('Bulk import categories and niches', async () => {
    const importData = {
      categories: [
        {
          id: 'bulk_test1',
          name: 'Bulk Test 1',
          description: 'Imported category 1',
          commissionRate: 0.12,
          niches: [
            { id: 'bn1_1', name: 'Bulk Niche 1-1' },
            { id: 'bn1_2', name: 'Bulk Niche 1-2' }
          ]
        },
        {
          id: 'bulk_test2',
          name: 'Bulk Test 2',
          commissionRate: 0.14,
          niches: [
            { id: 'bn2_1', name: 'Bulk Niche 2-1' }
          ]
        }
      ]
    };
    const res = await request('POST', '/api/admin/categories/bulk/import', importData, adminToken);
    assert(res.status === 200, 'Should return 200');
    assert(res.data.imported.categories >= 2, 'Should import at least 2 categories');
    assert(res.data.imported.niches >= 3, 'Should import at least 3 niches');
  });

  // === Products with Categories ===
  console.log('\n[Products with Categories]\n');

  // Register vendor for product tests
  console.log('[Setup] Registering vendor for product tests...');
  const vendorReg = await request('POST', '/api/auth/register', { email: 'vendor_test@test.com', password: 'pass123', role: 'vendor' });
  const vendorToken = vendorReg.data.token;
  
  // Apply as vendor
  const vendorApply = await request('POST', '/api/vendors/apply', { businessName: 'Test Vendor' }, vendorToken);
  const vendorId = vendorApply.data.id;

  let testProductId = 'testprod_' + Date.now();
  await test('Create product with category', async () => {
    const res = await request('POST', '/api/products', {
      title: 'Test Product',
      price: 99.99,
      categoryId: 'electronics',
      nicheId: 'smartphones'
    }, vendorToken);
    assert(res.status === 201, 'Should return 201');
    assert(res.data.categoryId === 'electronics', 'Should save category');
    testProductId = res.data.id;
  });

  // === Commission Calculation Tests ===
  console.log('\n[Category-Based Commission Calculation]\n');

  await test('Order with single product uses category commission rate', async () => {
    const res = await request('POST', '/api/orders', {
      buyer: 'test_buyer',
      items: [
        { productId: 'p_1', qty: 1, price: 499.99 } // Demo Smartphone X in Electronics (0.1 commission)
      ]
    });
    assert(res.status === 201, 'Should create order');
    // Commission = 499.99 * 0.1 = 49.999 ≈ 50.00
    assert(Math.abs(res.data.commissionAmount - 50.00) < 0.1, 'Should calculate commission based on electronics rate (0.1)');
  });

  await test('Order with multiple products calculates weighted commission', async () => {
    const res = await request('POST', '/api/orders', {
      buyer: 'test_buyer',
      items: [
        { productId: 'p_1', qty: 1, price: 499.99 }, // Electronics: 0.1
        { productId: 'p_2', qty: 1, price: 19.99 }   // Fashion: 0.12
      ]
    });
    assert(res.status === 201, 'Should create order');
    // Commission = (499.99 * 0.1) + (19.99 * 0.12) = 50.00 + 2.40 = 52.40
    assert(Math.abs(res.data.commissionAmount - 52.40) < 0.1, 'Should calculate weighted commission');
  });

  await test('Order with coupon distributes discount proportionally', async () => {
    // Create a test coupon
    const couponRes = await request('POST', '/api/coupons', {
      code: 'TEST10',
      discountType: 'percentage',
      amount: 10
    }, adminToken);
    
    const orderRes = await request('POST', '/api/orders', {
      buyer: 'test_buyer',
      items: [
        { productId: 'p_1', qty: 1, price: 499.99 }
      ],
      couponCode: 'TEST10'
    });
    assert(orderRes.status === 201, 'Should create order with coupon');
    // Subtotal: 499.99, Discount: 50.00, Total: 449.99
    // Commission: 449.99 * 0.1 = 45.00
    assert(Math.abs(orderRes.data.discount - 50.00) < 0.1, 'Should apply 10% discount');
    assert(Math.abs(orderRes.data.commissionAmount - 45.00) < 0.1, 'Should calculate commission on discounted total');
  });

  // === Filter Tests ===
  console.log('\n[Product Filtering]\n');

  await test('Filter products by category', async () => {
    const res = await request('GET', '/api/products?category=electronics');
    assert(res.status === 200, 'Should return 200');
    assert(Array.isArray(res.data), 'Should return array');
    res.data.forEach(p => {
      assert(p.categoryId === 'electronics', 'All products should be in electronics category');
    });
  });

  await test('Filter products by niche', async () => {
    const res = await request('GET', '/api/products?category=electronics&niche=smartphones');
    assert(res.status === 200, 'Should return 200');
    assert(Array.isArray(res.data), 'Should return array');
    res.data.forEach(p => {
      assert(p.nicheId === 'smartphones', 'All products should be in smartphones niche');
    });
  });

  // === Summary ===
  console.log('\n==== TEST SUMMARY ====\n');
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);
  console.log(`Total:  ${testsPassed + testsFailed}\n`);

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
