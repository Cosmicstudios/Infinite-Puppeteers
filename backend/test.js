// Simple test suite for backend (no external test framework required)
// Usage: node test.js
// Tests auth, products, orders, coupons, commissions

const http = require('http');

const BASE_URL = 'http://localhost:4000';
let testsPassed = 0;
let testsFailed = 0;

function logTest(name, passed, details = '') {
  if (passed) {
    console.log(`✓ ${name}`);
    testsPassed++;
  } else {
    console.log(`✗ ${name} ${details}`);
    testsFailed++;
  }
}

async function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const opts = { hostname: url.hostname, port: url.port || 4000, path: url.pathname + url.search, method, headers: { 'Content-Type': 'application/json', ...headers } };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: { raw: data } });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('Starting tests...\n');

  // Test health check
  const health = await request('GET', '/api/health');
  logTest('Health check', health.status === 200 && health.body.ok);

  // Test registration
  const registerRes = await request('POST', '/api/auth/register', { email: 'test@example.com', password: 'Password123!', role: 'buyer' });
  logTest('Register user', registerRes.status === 201, registerRes.status !== 201 ? `status: ${registerRes.status}` : '');
  const token = registerRes.body.token;

  // Test login
  const loginRes = await request('POST', '/api/auth/login', { email: 'test@example.com', password: 'Password123!' });
  logTest('Login user', loginRes.status === 200, loginRes.status !== 200 ? `status: ${loginRes.status}` : '');

  // Test /me endpoint
  const meRes = await request('GET', '/api/me', null, { Authorization: `Bearer ${token}` });
  logTest('Get authenticated user', meRes.status === 200 && meRes.body.id, meRes.status !== 200 ? `status: ${meRes.status}` : '');

  // Test product creation
  const prodRes = await request('POST', '/api/products', { title: 'Test Product', price: 29.99, category: 'test' });
  logTest('Create product', prodRes.status === 201, prodRes.status !== 201 ? `status: ${prodRes.status}` : '');
  const productId = prodRes.body.id;

  // Test product listing
  const prodListRes = await request('GET', '/api/products');
  logTest('List products', prodListRes.status === 200 && Array.isArray(prodListRes.body), '');

  // Test order creation
  const orderRes = await request('POST', '/api/orders', { buyer: 'testbuyer', items: [{ productId, qty: 1, price: 29.99 }] });
  logTest('Create order', orderRes.status === 201, orderRes.status !== 201 ? `status: ${orderRes.status}` : '');
  const orderId = orderRes.body.id;
  logTest('Order has commission', orderRes.body.commissionAmount && orderRes.body.commissionAmount > 0, '');

  // Test order with coupon (invalid)
  const orderWithBadCouponRes = await request('POST', '/api/orders', { buyer: 'testbuyer', items: [{ productId, qty: 1, price: 29.99 }], couponCode: 'BADCODE' });
  logTest('Reject invalid coupon', orderWithBadCouponRes.status === 400, '');

  // Test coupon creation (requires admin)
  const adminRegRes = await request('POST', '/api/auth/register', { email: 'admin@example.com', password: 'Password123!', role: 'admin' });
  const adminToken = adminRegRes.body.token;
  const couponRes = await request('POST', '/api/coupons', { code: 'TEST10', discountType: 'percentage', amount: 10 }, { Authorization: `Bearer ${adminToken}` });
  logTest('Create coupon (admin)', couponRes.status === 201, couponRes.status !== 201 ? `status: ${couponRes.status}` : '');

  // Test order with valid coupon
  const orderWithCouponRes = await request('POST', '/api/orders', { buyer: 'testbuyer', items: [{ productId, qty: 1, price: 29.99 }], couponCode: 'TEST10' });
  logTest('Apply coupon to order', orderWithCouponRes.status === 201 && orderWithCouponRes.body.discount > 0, '');

  // Test vendor application
  const vendorRes = await request('POST', '/api/vendors/apply', { businessName: 'Test Vendor' }, { Authorization: `Bearer ${token}` });
  logTest('Apply as vendor', vendorRes.status === 201, vendorRes.status !== 201 ? `status: ${vendorRes.status}` : '');
  const vendorId = vendorRes.body.id;

  // Test vendor approval (admin)
  const approveRes = await request('POST', `/api/admin/vendors/${vendorId}/approve`, {}, { Authorization: `Bearer ${adminToken}` });
  logTest('Approve vendor (admin)', approveRes.status === 200 && approveRes.body.status === 'active', '');

  // Test simulated payment
  const payRes = await request('POST', '/api/payments/simulate', { orderId });
  logTest('Simulate payment', payRes.status === 200 && payRes.body.order.paymentStatus === 'paid', '');

  // Test commission listing
  const commRes = await request('GET', '/api/admin/commissions', null, { Authorization: `Bearer ${adminToken}` });
  logTest('List commissions (admin)', commRes.status === 200 && Array.isArray(commRes.body), '');

  // Test commission payout
  const commId = commRes.body.find(c => c.orderId === orderId)?.id;
  if (commId) {
    const payoutRes = await request('POST', `/api/admin/commissions/${commId}/pay`, {}, { Authorization: `Bearer ${adminToken}` });
    logTest('Mark commission paid (admin)', payoutRes.status === 200, '');
  } else {
    logTest('Mark commission paid (admin)', false, 'commission not found');
  }

  console.log(`\nTests completed: ${testsPassed} passed, ${testsFailed} failed`);
  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
