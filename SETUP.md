# Setup & Testing Guide

## Installation

### Option A: Docker (Recommended, no Node.js install needed)

```powershell
cd 'e:\oo pupteers\SERVICE WEB'
docker compose up --build
```

Once running, open `http://localhost:4000` in your browser.

### Option B: Local Node.js

1. Install Node.js LTS:
   ```powershell
   # Using winget (Windows 10/11 with Package Manager enabled)
   winget install --id OpenJS.NodeJS.LTS -e
   
   # Or download from https://nodejs.org/en/download/
   ```

2. Start the backend:
   ```powershell
   Push-Location 'e:\oo pupteers\SERVICE WEB\backend'
   node index.js
   Pop-Location
   ```

The server will start on `http://localhost:4000`.

## Quick Verification

Once the server is running, test these endpoints in PowerShell:

### 1. Health Check
```powershell
Invoke-RestMethod http://localhost:4000/api/health
```
Expected: `200 OK`

### 2. List Categories
```powershell
Invoke-RestMethod http://localhost:4000/api/categories
```
Expected: Array of 10 categories (electronics, fashion, home, etc.)

### 3. List Niches for a Category
```powershell
Invoke-RestMethod http://localhost:4000/api/categories/electronics/niches
```
Expected: Array of 10 electronics niches (smartphones, laptops, etc.)

### 4. List All Products (with demo products)
```powershell
Invoke-RestMethod http://localhost:4000/api/products
```
Expected: Array with 2 demo products (Demo Smartphone X, Eco Cotton T-Shirt)

### 5. Filter Products by Category
```powershell
Invoke-RestMethod 'http://localhost:4000/api/products?category=electronics'
```
Expected: 1 product (Demo Smartphone X)

### 6. Filter Products by Niche
```powershell
Invoke-RestMethod 'http://localhost:4000/api/products?category=electronics&niche=smartphones'
```
Expected: 1 product (Demo Smartphone X)

## Admin Operations (Require Auth Token)

### Get Admin Token
```powershell
$loginBody = @{ email = 'admin@example.com'; password = 'admin' } | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri http://localhost:4000/api/auth/login -Method Post -Body $loginBody -ContentType 'application/json'
$token = $loginRes.token
Write-Host "Token: $token"
```

### Create a New Category
```powershell
$catBody = @{ 
  id = 'hometech'
  name = 'Home Technology'
  description = 'Smart home devices and automation'
  icon = '🏠'
  commissionRate = 0.15
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:4000/api/admin/categories `
  -Method Post `
  -Body $catBody `
  -ContentType 'application/json' `
  -Headers @{ Authorization = "Bearer $token" }
```

### Create a Niche under Electronics
```powershell
$nicheBody = @{ 
  id = 'smartwatches'
  name = 'Smartwatches & Fitness Trackers'
  description = 'Wearable fitness and health devices'
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:4000/api/admin/categories/electronics/niches `
  -Method Post `
  -Body $nicheBody `
  -ContentType 'application/json' `
  -Headers @{ Authorization = "Bearer $token" }
```

### Update a Category Commission Rate
```powershell
$updateBody = @{ 
  commissionRate = 0.18
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:4000/api/admin/categories/electronics `
  -Method Put `
  -Body $updateBody `
  -ContentType 'application/json' `
  -Headers @{ Authorization = "Bearer $token" }
```

## Frontend URLs

- **Main Demo**: `http://localhost:4000`
  - Browse products by category/niche using the sidebar
  - Create demo orders with optional coupon codes
  - Test payment intent creation

- **Admin Console**: `http://localhost:4000/admin.html`
  - Approve vendors
  - View orders and commissions
  - Trigger payouts

- **Admin Categories**: `http://localhost:4000/admin-categories.html`
  - Create/update/delete categories
  - Manage niches per category
  - Adjust commission rates

## Database & Persistence

- **Development**: Uses `backend/db.json` (file-based, auto-persisted)
- **Production**: Use `backend/prisma/schema.prisma` to migrate to PostgreSQL

  ```powershell
  npm install @prisma/client
  npx prisma migrate dev --name init
  ```

## Seed Data

The `backend/db.json` includes:
- **10 Categories**: Electronics, Fashion, Home, Beauty, Sports, Services, Food, Books, Toys, Automotive
- **100+ Niches**: Organized under each category (e.g., Smartphones, Laptops, T-Shirts, Furniture, etc.)
- **Demo Users**: admin@example.com, vendor@example.com, buyer@example.com
- **Demo Vendor**: Demo Gadgets Ltd. (status: active)
- **Demo Products**: Demo Smartphone X ($499.99, Electronics/Smartphones), Eco Cotton T-Shirt ($19.99, Fashion/Men's Clothing)

## Customization

### Add Custom Categories & Niches

Use the admin UI at `http://localhost:4000/admin-categories.html` or POST directly:

```powershell
# Add your custom categories using the admin endpoints
# See ENDPOINTS.js for full endpoint reference
```

### Adjust Commission Rates

Edit `backend/db.json` → `config.categoryCommissionRates` for default rates per category, or update via admin API.

### Customize Frontend

- **Marketplace UI**: Edit `frontend/app.js` and `frontend/index.html`
- **Admin Dashboard**: Edit `frontend/admin.js` and `frontend/admin.html`
- **Categories Admin**: Edit `frontend/admin-categories.js` and `frontend/admin-categories.html`

## Next Steps

1. Run the server (Docker or local Node)
2. Test the endpoints above
3. Explore the frontend at `http://localhost:4000`
4. Use admin console to create/approve vendors
5. Create products as a vendor
6. Test orders with coupons
7. Simulate payments and review commissions

For full API documentation, see `backend/openapi.yaml` (OpenAPI 3.0 spec).

---

If you encounter issues or want to add more features (e.g., real Stripe integration, PostgreSQL migration, analytics), let me know!
