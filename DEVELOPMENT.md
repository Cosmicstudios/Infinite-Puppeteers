# Development Guide

This guide provides detailed instructions for setting up a local development environment and understanding the codebase architecture.

## Table of Contents

1. [Local Setup](#local-setup)
2. [Project Architecture](#project-architecture)
3. [Key Concepts](#key-concepts)
4. [Common Tasks](#common-tasks)
5. [Debugging](#debugging)
6. [Performance Tips](#performance-tips)

## Local Setup

### Prerequisites

- **Node.js 18+** ([download](https://nodejs.org/))
- **Git** ([download](https://git-scm.com/))
- **Docker & Docker Compose** (optional, for isolated environment)

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/service-web.git
cd service-web
```

### Step 2: Install Dependencies

```bash
cd backend
npm install
cd ..
```

### Step 3: Setup Environment Variables

```bash
cp backend/.env.example backend/.env
```

Default `.env` values work for local development. For custom settings:

```bash
# backend/.env
PORT=4000
NODE_ENV=development
STRIPE_SECRET_KEY=sk_test_... (optional)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin
JWT_SECRET=dev-secret-key-change-in-prod
CORS_ORIGIN=http://localhost:4000
LOG_LEVEL=debug
```

### Step 4: Start the Server

**Option A: Direct Node.js**
```bash
cd backend
npm start
```

**Option B: Docker Compose** (recommended for isolated environment)
```bash
# From workspace root
docker-compose up --build
```

The server should start at `http://localhost:4000`.

### Step 5: Verify Installation

```bash
# Health check
curl http://localhost:4000/api/health
# Should return: {"status":"ok"}

# List products
curl http://localhost:4000/api/products
# Should return a JSON array

# Frontend
# Open browser to http://localhost:4000
```

## Project Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────┐
│         Frontend (HTML/JS)                   │
│  - Marketplace UI (index.html)               │
│  - Admin Dashboards (admin-*.html)           │
│  - Vendor Storefront (store.html)            │
└──────────────────┬──────────────────────────┘
                   │
                   ▼ HTTP/JSON
┌─────────────────────────────────────────────┐
│      Node.js Backend (index.js)              │
│  - REST API routes                          │
│  - Auth (JWT/API Key)                       │
│  - Business logic (orders, commission, etc.)│
│  - Audit logging                            │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│     Database (db.json or PostgreSQL)        │
│  - Users, Vendors, Products                 │
│  - Orders, Commissions, Analytics           │
│  - Audit logs                               │
└─────────────────────────────────────────────┘
```

### Backend Code Structure

The entire backend is a single `index.js` file (~981 lines) organized by functionality:

```
index.js
├── Imports & Constants
├── Database Functions (loadDB, saveDB, initDB)
├── Auth Helpers
│   ├── JWT signing/verification
│   ├── Password hashing (PBKDF2)
│   └── API key hashing (SHA-256)
├── Middleware
│   ├── authenticate (JWT token check)
│   └── parseJSON body parser
├── Routes (grouped by feature)
│   ├── Auth (/api/auth/*)
│   ├── Products (/api/products)
│   ├── Vendors (/api/vendors/*)
│   ├── Orders (/api/orders)
│   ├── Admin (/api/admin/*)
│   ├── Categories (/api/categories)
│   ├── Analytics (/api/analytics)
│   └── Integrations (/api/*)
├── Static File Serving
│   └── Serve frontend HTML files
└── Server Start (createServer, listen)
```

### Data Model

#### Core Objects in `db.json`

```javascript
{
  users: [
    {
      id: string (UUID),
      email: string,
      passwordHash: string (PBKDF2),
      role: 'admin' | 'vendor' | 'buyer',
      createdAt: ISO string
    }
  ],
  
  vendors: [
    {
      id: string (UUID),
      userId: string,
      businessName: string,
      status: 'pending' | 'active' | 'suspended',
      commissionRate: number (0.0-1.0),
      apiKeyHash: string (SHA-256, nullable),
      apiKeyMeta: {
        label: string,
        createdAt: ISO string,
        createdBy: string,
        lastUsed: ISO string,
        revokedAt: ISO string
      }
    }
  ],
  
  products: [
    {
      id: string,
      vendorId: string,
      name: string,
      description: string,
      price: number,
      categoryId: string,
      active: boolean,
      createdAt: ISO string,
      updatedAt: ISO string
    }
  ],
  
  orders: [
    {
      id: string,
      buyerId: string,
      items: Array<{ productId, quantity, price }>,
      total: number,
      status: 'pending' | 'completed' | 'cancelled',
      createdAt: ISO string
    }
  ],
  
  categories: [
    {
      id: string,
      name: string,
      description: string,
      commissionRate: number,
      icon: string
    }
  ],
  
  auditLogs: [
    {
      timestamp: ISO string,
      action: string (e.g., 'api-key.generate'),
      userId: string,
      resourceId: string,
      details: object
    }
  ]
}
```

### Authentication Flow

#### JWT (Vendor/Admin/Buyer)

1. **Register/Login**
   ```javascript
   POST /api/auth/register
   POST /api/auth/login
   // Returns: { token: "jwt-token", user: {...} }
   ```

2. **Use Token**
   ```javascript
   GET /api/products
   Header: "Authorization: Bearer <jwt-token>"
   ```

3. **Verify in Middleware**
   ```javascript
   const authenticate = (req, res, next) => {
     const token = req.headers.authorization?.split(' ')[1];
     if (!token) return res.status(401).json({ error: 'Unauthorized' });
     
     try {
       req.user = jwt.verify(token, JWT_SECRET);
       next();
     } catch {
       res.status(401).json({ error: 'Invalid token' });
     }
   };
   ```

#### API Key (Vendor Product Upload)

1. **Generate API Key**
   ```javascript
   POST /api/vendors/:id/generate-api-key
   Body: { label: "Mobile App" }
   // Returns: { key: "plaintext-key-shown-once", ... }
   ```

2. **Use API Key**
   ```javascript
   POST /api/products
   Header: "x-api-key: <api-key>"
   ```

3. **Verify in Middleware**
   ```javascript
   const apiKey = req.headers['x-api-key'];
   const vendor = db.vendors.find(v => 
     v.apiKeyHash === sha256(apiKey)
   );
   ```

## Key Concepts

### 1. Commission System

**How it works:**

- Each category has a commission rate (8-20%)
- Commission is applied AFTER discounts
- Per-item basis for mixed-category orders

**Example:**

```
Category A rate: 15%
Category B rate: 10%

Order:
- Category A item: $100
- Category B item: $100
- Discount: -$10 (applied proportionally)

Commissions:
- Category A: ($100 - $5.50 discount) × 15% = $14.18
- Category B: ($100 - $4.50 discount) × 10% = $9.55
- Total commission: $23.73
```

**Code location:** `backend/index.js` — search for `calculateCommission()`

### 2. Audit Logging

**What gets logged:**

- API key generation (vendor, label)
- API key revocation
- API key label updates
- Product upload (single & bulk)
- Any administrative changes

**Structure:**

```javascript
{
  timestamp: "2024-01-15T10:30:00Z",
  action: "api-key.generate",      // Standardized action name
  userId: "vendor-123",            // Who performed action
  resourceId: "vendor-456",        // What was affected
  details: {                       // Additional context
    label: "Mobile App",
    ipAddress: "192.168.1.1"
  }
}
```

**How to add logging:**

```javascript
// After any important operation
db.auditLogs.push({
  timestamp: new Date().toISOString(),
  action: 'my-feature.action',
  userId: req.user?.id,
  resourceId: resourceId,
  details: { /* relevant info */ }
});
saveDB();
```

### 3. Category-Weighted Commissions

Categories are pre-configured with commission rates:

```javascript
// From db.json
config: {
  categoryCommissionRates: {
    electronics: 0.20,
    clothing: 0.15,
    home: 0.12,
    sports: 0.10,
    // ... 20+ more categories
  }
}
```

To change rates, edit `db.json` directly or create an admin endpoint.

### 4. Bulk Product Import

The bulk import endpoint accepts CSV or JSON:

```javascript
POST /api/vendor/products/bulk
Header: "x-api-key: <key>" or "Authorization: Bearer <jwt>"
Body: {
  products: [
    { name, description, price, categoryId },
    { ... }
  ]
}
// Returns: { imported: 150, errors: [{ row, error }] }
```

## Common Tasks

### Add a New API Endpoint

1. **Define the route** in `backend/index.js`:

```javascript
app.post('/api/features/:id/activate', authenticate, (req, res) => {
  try {
    // Validate
    if (!req.params.id) {
      return res.status(400).json({ error: 'ID required' });
    }
    
    // Business logic
    const feature = db.features.find(f => f.id === req.params.id);
    if (!feature) return res.status(404).json({ error: 'Not found' });
    
    feature.active = true;
    
    // Log action
    db.auditLogs.push({
      timestamp: new Date().toISOString(),
      action: 'feature.activate',
      userId: req.user.id,
      resourceId: feature.id,
      details: { name: feature.name }
    });
    
    // Persist
    saveDB();
    
    // Respond
    res.json(feature);
  } catch (err) {
    console.error('Error activating feature:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
```

2. **Update OpenAPI spec** (`backend/openapi.yaml`)
3. **Add test case** in `backend/test-*.js`
4. **Test locally**: `curl -X POST http://localhost:4000/api/features/123/activate ...`

### Add a New Category

Edit `backend/db.json`:

```json
{
  "id": "smart-home",
  "name": "Smart Home",
  "description": "IoT and home automation devices",
  "commissionRate": 0.18,
  "icon": "home-automation"
}
```

Then add to `config.categoryCommissionRates`:

```json
"smart-home": 0.18
```

### Create a Test

Create `backend/test-my-feature.js`:

```javascript
#!/usr/bin/env node
const http = require('http');

const baseURL = 'http://localhost:4000';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseURL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data),
            headers: res.headers
          });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('Testing my feature...\n');

  try {
    // Test 1: Create feature
    console.log('✓ Test 1: Create feature');
    const createRes = await makeRequest('POST', '/api/features', {
      name: 'Test Feature',
      description: 'A test feature'
    });
    console.log(`  Status: ${createRes.status}`);
    const featureId = createRes.body.id;

    // Test 2: Activate feature
    console.log('✓ Test 2: Activate feature');
    const activateRes = await makeRequest('POST', `/api/features/${featureId}/activate`);
    console.log(`  Status: ${activateRes.status}`);
    console.log(`  Active: ${activateRes.body.active}`);

    console.log('\n✓ All tests passed!');
  } catch (err) {
    console.error('✗ Test failed:', err.message);
    process.exit(1);
  }
}

// Run tests
runTests();
```

Run it:
```bash
node backend/test-my-feature.js
```

### Debug an Issue

1. **Enable debug logging:**
   ```bash
   # In backend/.env
   LOG_LEVEL=debug
   ```

2. **Add console.log statements:**
   ```javascript
   console.log('DEBUG: Input:', req.body);
   console.log('DEBUG: Found vendor:', vendor);
   ```

3. **Use curl for API testing:**
   ```bash
   curl -v -X POST http://localhost:4000/api/products \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test"}'
   ```

4. **Check server logs:**
   ```bash
   # Direct Node.js
   # Logs appear in terminal
   
   # Docker
   docker-compose logs -f backend
   ```

5. **Check database state:**
   ```bash
   # View db.json
   cat backend/db.json | jq '.orders'
   
   # Or in Node REPL
   node
   > const fs = require('fs');
   > const db = JSON.parse(fs.readFileSync('backend/db.json'));
   > db.vendors.filter(v => v.id === 'vendor-123')
   ```

## Debugging

### Using Node.js Inspector

```bash
# Start with inspector
node --inspect backend/index.js

# In Chrome: chrome://inspect
# In VS Code: Add to .vscode/launch.json:
```

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Backend",
      "program": "${workspaceFolder}/backend/index.js",
      "cwd": "${workspaceFolder}/backend"
    }
  ]
}
```

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Port 4000 already in use` | Another process running on port 4000 | Change PORT in .env or kill process: `lsof -i :4000` |
| `Cannot find module` | Dependency not installed | Run `npm install` in backend/ |
| `JWT verification failed` | Invalid or expired token | Get new token from `/api/auth/login` |
| `API key not valid` | Wrong key or vendor inactive | Check key hash in db.json |
| `CORS error in browser` | Frontend origin not allowed | Update CORS_ORIGIN in .env |

## Performance Tips

### 1. Database Optimization

For development, `db.json` is fine. For production:

```bash
# Migrate to PostgreSQL
npm install @prisma/client
npx prisma init
# Update DATABASE_URL in .env
npx prisma migrate dev
```

### 2. Caching

Add Redis for hot queries:

```bash
docker run -d -p 6379:6379 redis:latest
```

```javascript
const redis = require('redis');
const client = redis.createClient();

// Cache category metrics
app.get('/api/admin/analytics/categories', async (req, res) => {
  const cached = await client.get('category-metrics');
  if (cached) return res.json(JSON.parse(cached));
  
  // Compute metrics
  const metrics = computeCategoryMetrics();
  
  // Cache for 5 minutes
  await client.setEx('category-metrics', 300, JSON.stringify(metrics));
  
  res.json(metrics);
});
```

### 3. Pagination

Add pagination to list endpoints:

```javascript
app.get('/api/products', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const start = (page - 1) * limit;
  
  const total = db.products.length;
  const products = db.products.slice(start, start + limit);
  
  res.json({
    data: products,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});
```

### 4. Database Indexes

When migrating to PostgreSQL, add indexes:

```sql
CREATE INDEX idx_products_vendor_id ON products(vendor_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
```

---

**Questions?** Check the [README](./README.md) or open an issue on GitHub!
