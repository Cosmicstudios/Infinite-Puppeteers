#!/usr/bin/env node
// End-to-End Demo Script for Marketplace Prototype
// Usage: node e2e-demo.js [baseUrl] (default: http://localhost:4000)
// Demonstrates a complete flow: vendor onboarding → product listing → order → payment → payout

const http = require('http');

const BASE_URL = process.argv[2] || 'http://localhost:4000';
const VERBOSE = process.env.VERBOSE === '1';

let scenariosPassed = 0;
let scenariosFailed = 0;

function log(msg) {
  console.log(`[E2E] ${msg}`);
}

function logVerbose(msg) {
  if (VERBOSE) log(`  ${msg}`);
}

async function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const opts = {
      hostname: url.hostname,
      port: url.port || 4000,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: null, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function scenario(name, fn) {
  try {
    log(`\n➤ ${name}`);
    await fn();
    scenariosPassed++;
    log(`  ✓ Passed`);
  } catch (err) {
    scenariosFailed++;
    log(`  ✗ Failed: ${err.message}`);
  }
}

async function runE2E() {
  log(`\n========================================`);
  log(`Marketplace E2E Demo`);
  log(`Base URL: ${BASE_URL}`);
  log(`========================================\n`);

  const timestamp = Date.now();
  const state = {};

  // Scenario 1: Health check
  await scenario('1. Health check', async () => {
    const res = await request('GET', '/api/health');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body || !res.body.ok) throw new Error('Health check failed');
  });

  // Scenario 2: Register buyer
  await scenario('2. Register buyer', async () => {
    const res = await request('POST', '/api/auth/register', {
      email: `buyer_${timestamp}@example.com`,
      password: 'BuyerPass123!',
      role: 'buyer'
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    state.buyerToken = res.body.token;
    state.buyerEmail = res.body.email;
    logVerbose(`Buyer token: ${state.buyerToken.substring(0, 20)}...`);
  });

  // Scenario 3: Register vendor
  await scenario('3. Register vendor', async () => {
    const res = await request('POST', '/api/auth/register', {
      email: `vendor_${timestamp}@example.com`,
      password: 'VendorPass123!',
      role: 'vendor'
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    state.vendorToken = res.body.token;
    state.vendorId = res.body.id;
    state.vendorEmail = res.body.email;
    logVerbose(`Vendor token: ${state.vendorToken.substring(0, 20)}...`);
  });

  // Scenario 4: Register admin
  await scenario('4. Register admin', async () => {
    const res = await request('POST', '/api/auth/register', {
      email: `admin_${timestamp}@example.com`,
      password: 'AdminPass123!',
      role: 'admin'
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    state.adminToken = res.body.token;
    logVerbose(`Admin token: ${state.adminToken.substring(0, 20)}...`);
  });

  // Scenario 5: Vendor applies
  await scenario('5. Vendor applies for marketplace', async () => {
    const res = await request('POST', '/api/vendors/apply', {
      businessName: `Test Vendor ${timestamp}`
    }, { Authorization: `Bearer ${state.vendorToken}` });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    state.vendorAccountId = res.body.id;
    logVerbose(`Vendor account ID: ${state.vendorAccountId}`);
  });

  // Scenario 6: Admin approves vendor
  await scenario('6. Admin approves vendor', async () => {
    const res = await request('POST', `/api/admin/vendors/${state.vendorAccountId}/approve`, {}, {
      Authorization: `Bearer ${state.adminToken}`
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.body.status !== 'active') throw new Error('Vendor not active');
  });

  // Scenario 7: Vendor creates product
  await scenario('7. Vendor creates product', async () => {
    const res = await request('POST', '/api/products', {
      title: 'Premium Widget',
      price: 49.99,
      vendorId: state.vendorAccountId,
      category: 'electronics'
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    state.productId = res.body.id;
    state.productPrice = res.body.price;
    logVerbose(`Product ID: ${state.productId}, Price: $${state.productPrice}`);
  });

  // Scenario 8: Buyer views products
  await scenario('8. Buyer views products', async () => {
    const res = await request('GET', '/api/products');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body)) throw new Error('Products not an array');
    const product = res.body.find(p => p.id === state.productId);
    if (!product) throw new Error('Product not in list');
    logVerbose(`Found product: ${product.title}`);
  });

  // Scenario 9: Admin creates coupon
  await scenario('9. Admin creates coupon', async () => {
    const res = await request('POST', '/api/coupons', {
      code: `DEMO${timestamp}`,
      discountType: 'percentage',
      amount: 10
    }, { Authorization: `Bearer ${state.adminToken}` });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    state.couponCode = res.body.code;
    logVerbose(`Coupon code: ${state.couponCode}, 10% off`);
  });

  // Scenario 10: Buyer creates order with coupon
  await scenario('10. Buyer creates order with coupon', async () => {
    const res = await request('POST', '/api/orders', {
      buyer: state.buyerEmail,
      items: [{ productId: state.productId, qty: 1, price: state.productPrice }],
      couponCode: state.couponCode
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    state.orderId = res.body.id;
    state.orderSubtotal = res.body.subtotal;
    state.orderDiscount = res.body.discount;
    state.orderTotal = res.body.total;
    state.commissionAmount = res.body.commissionAmount;
    logVerbose(`Order ID: ${state.orderId}`);
    logVerbose(`  Subtotal: $${state.orderSubtotal}`);
    logVerbose(`  Discount: -$${state.orderDiscount}`);
    logVerbose(`  Total: $${state.orderTotal}`);
    logVerbose(`  Commission (10%): $${state.commissionAmount}`);
  });

  // Scenario 11: Verify commission was recorded
  await scenario('11. Verify commission recorded', async () => {
    const res = await request('GET', '/api/admin/commissions', null, {
      Authorization: `Bearer ${state.adminToken}`
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const comm = res.body.find(c => c.orderId === state.orderId);
    if (!comm) throw new Error('Commission not found');
    if (comm.status !== 'pending') throw new Error('Commission not pending');
    state.commissionId = comm.id;
    logVerbose(`Commission ID: ${state.commissionId}, Status: ${comm.status}`);
  });

  // Scenario 12: Buyer initiates payment
  await scenario('12. Buyer initiates payment', async () => {
    const res = await request('POST', '/api/stripe/create-payment-intent', {
      orderId: state.orderId
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    state.paymentIntentId = res.body.paymentIntentId;
    logVerbose(`Payment intent ID: ${state.paymentIntentId}`);
    logVerbose(`  (In production, use clientSecret with Stripe Elements)`);
  });

  // Scenario 13: Simulate payment success
  await scenario('13. Simulate payment completion', async () => {
    const res = await request('POST', '/api/payments/simulate', {
      orderId: state.orderId
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.body.order.paymentStatus !== 'paid') throw new Error('Order not marked paid');
    logVerbose(`Order payment status: ${res.body.order.paymentStatus}`);
  });

  // Scenario 14: Commission marked payable
  await scenario('14. Verify commission marked payable', async () => {
    const res = await request('GET', '/api/admin/commissions', null, {
      Authorization: `Bearer ${state.adminToken}`
    });
    const comm = res.body.find(c => c.id === state.commissionId);
    if (!comm || comm.status !== 'payable') throw new Error('Commission not payable');
    logVerbose(`Commission status: ${comm.status}`);
  });

  // Scenario 15: Admin processes payout
  await scenario('15. Admin processes vendor payout', async () => {
    const res = await request('POST', `/api/admin/commissions/${state.commissionId}/pay`, {}, {
      Authorization: `Bearer ${state.adminToken}`
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.body.commission.status !== 'paid') throw new Error('Commission not paid');
    state.payoutId = res.body.payout?.id;
    logVerbose(`Commission status: ${res.body.commission.status}`);
    logVerbose(`Payout ID: ${state.payoutId}`);
  });

  // Scenario 16: Verify payout recorded
  await scenario('16. Verify payout recorded', async () => {
    const res = await request('GET', '/api/admin/payouts', null, {
      Authorization: `Bearer ${state.adminToken}`
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const payout = res.body.find(p => p.id === state.payoutId);
    if (!payout) throw new Error('Payout not found');
    logVerbose(`Payout amount: $${payout.amount}`);
    logVerbose(`Payout status: ${payout.status}`);
  });

  // Final summary
  log(`\n========================================`);
  log(`E2E Demo Complete`);
  log(`Scenarios Passed: ${scenariosPassed}`);
  log(`Scenarios Failed: ${scenariosFailed}`);
  log(`========================================\n`);

  process.exit(scenariosFailed > 0 ? 1 : 0);
}

runE2E().catch(err => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
