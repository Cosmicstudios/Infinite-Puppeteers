#!/usr/bin/env node
/**
 * Endpoint Registry & Smoke Test Generator
 * Run this locally to see all available endpoints and get curl/PowerShell commands
 */

const endpoints = [
  // Health & Auth
  { method: 'GET', path: '/api/health', desc: 'Health check', auth: false, body: null },
  { method: 'POST', path: '/api/auth/register', desc: 'Register user (buyer/vendor/admin)', auth: false, body: { email: 'user@test.com', password: 'pass123', role: 'buyer' } },
  { method: 'POST', path: '/api/auth/login', desc: 'Login and get token', auth: false, body: { email: 'admin@example.com', password: 'admin' } },
  { method: 'GET', path: '/api/me', desc: 'Get current user info', auth: true, body: null },

  // Categories & Niches (Read)
  { method: 'GET', path: '/api/categories', desc: 'List all categories', auth: false, body: null },
  { method: 'GET', path: '/api/categories/electronics', desc: 'Get category by ID', auth: false, body: null },
  { method: 'GET', path: '/api/categories/electronics/niches', desc: 'Get niches for a category', auth: false, body: null },
  { method: 'GET', path: '/api/niches', desc: 'List all niches', auth: false, body: null },
  { method: 'GET', path: '/api/niches/smartphones', desc: 'Get niche by ID', auth: false, body: null },

  // Categories & Niches (Admin)
  { method: 'POST', path: '/api/admin/categories', desc: 'Create category (admin)', auth: true, body: { id: 'newcat', name: 'New Category', commissionRate: 0.1 } },
  { method: 'PUT', path: '/api/admin/categories/electronics', desc: 'Update category (admin)', auth: true, body: { name: 'Electronics Updated', commissionRate: 0.11 } },
  { method: 'DELETE', path: '/api/admin/categories/electronics', desc: 'Delete category (admin)', auth: true, body: null },
  { method: 'POST', path: '/api/admin/categories/fashion/niches', desc: 'Create niche (admin)', auth: true, body: { id: 'newniche', name: 'New Niche' } },
  { method: 'PUT', path: '/api/admin/niches/smartphones', desc: 'Update niche (admin)', auth: true, body: { name: 'Phones & Accessories' } },
  { method: 'DELETE', path: '/api/admin/niches/smartphones', desc: 'Delete niche (admin)', auth: true, body: null },

  // Products
  { method: 'GET', path: '/api/products', desc: 'List products (supports ?category=X&niche=Y)', auth: false, body: null },
  { method: 'POST', path: '/api/products', desc: 'Create product (vendor)', auth: true, body: { title: 'New Product', price: 99.99, categoryId: 'electronics', nicheId: 'smartphones' } },
  { method: 'PUT', path: '/api/products/p_1', desc: 'Update product (vendor)', auth: true, body: { title: 'Updated Product', price: 89.99 } },
  { method: 'DELETE', path: '/api/products/p_1', desc: 'Delete product (vendor)', auth: true, body: null },

  // Vendors
  { method: 'GET', path: '/api/vendors', desc: 'List vendors', auth: false, body: null },
  { method: 'GET', path: '/api/vendors/v_demo', desc: 'Get vendor and their products', auth: false, body: null },
  { method: 'POST', path: '/api/vendors/apply', desc: 'Apply as vendor', auth: true, body: { businessName: 'My Business' } },
  { method: 'POST', path: '/api/admin/vendors/v_demo/approve', desc: 'Approve vendor (admin)', auth: true, body: null },

  // Orders & Payments
  { method: 'POST', path: '/api/orders', desc: 'Create order', auth: false, body: { buyer: 'demo', items: [{ productId: 'p_1', qty: 1, price: 499.99 }] } },
  { method: 'GET', path: '/api/admin/orders', desc: 'List orders (admin)', auth: true, body: null },
  { method: 'POST', path: '/api/stripe/create-payment-intent', desc: 'Create payment intent', auth: false, body: { orderId: 'order_id_here' } },

  // Coupons
  { method: 'GET', path: '/api/coupons', desc: 'List coupons', auth: false, body: null },
  { method: 'POST', path: '/api/coupons', desc: 'Create coupon (admin)', auth: true, body: { code: 'SAVE10', discountType: 'percentage', amount: 10 } },

  // Commissions & Payouts
  { method: 'GET', path: '/api/admin/commissions', desc: 'List commissions (admin)', auth: true, body: null },
  { method: 'POST', path: '/api/admin/commissions/{id}/pay', desc: 'Mark commission as paid (admin)', auth: true, body: null },
  { method: 'GET', path: '/api/admin/payouts', desc: 'List payouts (admin)', auth: true, body: null },
];

console.log('\n==== MARKETPLACE API ENDPOINT REFERENCE ====\n');
console.log(`Total endpoints: ${endpoints.length}\n`);

// Group by category
const grouped = {};
endpoints.forEach(e => {
  const cat = e.path.split('/')[2];
  if (!grouped[cat]) grouped[cat] = [];
  grouped[cat].push(e);
});

Object.keys(grouped).sort().forEach(cat => {
  console.log(`\n[${cat.toUpperCase()}]\n`);
  grouped[cat].forEach(e => {
    const auth = e.auth ? ' [AUTH REQUIRED]' : '';
    console.log(`  ${e.method.padEnd(6)} ${e.path.padEnd(50)} ${e.desc}${auth}`);
  });
});

console.log('\n\n==== QUICK CURL/POWERSHELL COMMANDS ====\n');

console.log('Health check (no auth):');
console.log('  curl http://localhost:4000/api/health\n');
console.log('  PowerShell: Invoke-RestMethod http://localhost:4000/api/health\n');

console.log('List categories:');
console.log('  curl http://localhost:4000/api/categories\n');
console.log('  PowerShell: Invoke-RestMethod http://localhost:4000/api/categories\n');

console.log('List products (all):');
console.log('  curl http://localhost:4000/api/products\n');

console.log('Filter products by category (electronics):');
console.log('  curl "http://localhost:4000/api/products?category=electronics"\n');

console.log('Create category (requires admin token):');
console.log('  curl -X POST http://localhost:4000/api/admin/categories \\');
console.log('    -H "Content-Type: application/json" \\');
console.log('    -H "Authorization: Bearer <ADMIN_TOKEN>" \\');
console.log('    -d \'{"id":"test","name":"Test Category","commissionRate":0.1}\'\n');

console.log('\n==== DEMO ACCOUNTS (SEEDED IN DB) ====\n');
console.log('Admin:  admin@example.com (password: not stored, for demo only)');
console.log('Vendor: vendor@example.com');
console.log('Buyer:  buyer@example.com\n');

console.log('To get a token, POST to /api/auth/login with email & password.\n');

console.log('==== RUNNING BACKEND ====\n');
console.log('Option 1: Docker (no Node install needed)');
console.log('  cd "e:\\oo pupteers\\SERVICE WEB"');
console.log('  docker compose up --build\n');

console.log('Option 2: Node.js (install Node LTS first)');
console.log('  Push-Location "e:\\oo pupteers\\SERVICE WEB\\backend"');
console.log('  node index.js');
console.log('  Pop-Location\n');

console.log('Then open http://localhost:4000 in your browser.\n');
