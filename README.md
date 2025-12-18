# Service Web Marketplace

A production-ready commission-based affiliate marketplace platform with vendor integration, product management, analytics, and Stripe Connect support.

> **👉 First time here?** Start with [INDEX.md](./INDEX.md) for a navigation guide, or jump to [NEXT_STEPS.md](./NEXT_STEPS.md) to get started immediately.

## ✨ Features

- **Multi-vendor marketplace** — Vendors register, manage products, track commissions
- **25+ category taxonomy** — Pre-configured categories + niches; easily extensible
- **API-first vendor integration** — Connect via API key, website, or UI
- **Category-weighted commissions** — Flexible commission rates per category
- **Bulk product import** — Single or batch uploads (CSV/JSON)
- **Admin analytics** — Real-time category metrics, order tracking
- **Discount rules** — Time-limited, category-based promotions
- **API key management** — Hashed keys, audit trail, label organization
- **Coupon system** — Time-limited, usage-tracked discounts
- **Stripe Connect** — Vendor payouts via Stripe (optional)
- **Audit logging** — Complete history of all operations
- **Docker ready** — Production-grade Dockerfile + compose
- **OpenAPI spec** — Full Swagger documentation
- **CI/CD** — GitHub Actions with parallel tests

## 🚀 Quick Start

### Option 1: Automated Setup (Windows, Recommended)
The easiest way to get everything running is to use the master automation script:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
cd 'e:\oo pupteers\SERVICE WEB'
.\scripts\auto-all-windows.ps1
```

This script will:
- Install prerequisites (Git, Node.js, Docker, GitHub CLI)
- Initialize git repository
- Build Docker image
- Start production services
- Run smoke tests

See [NEXT_STEPS.md](./NEXT_STEPS.md) and [scripts/README_FOR_SCRIPTS.md](./scripts/README_FOR_SCRIPTS.md) for more details.

### Option 2: Docker (Recommended for MacOS/Linux)
```bash
docker-compose up --build
# Backend runs at http://localhost:4000
```

### Option 3: Local Node.js
```bash
cd backend
npm install
npm start
# Backend runs at http://localhost:4000
```

## 📁 Project Structure

```
service-web/
├── backend/
│   ├── index.js                 # Main server & API
│   ├── db.json                  # Development data
│   ├── openapi.yaml             # API specification
│   ├── Dockerfile               # Production image
│   ├── package.json
│   └── test-*.js                # Test suites
├── frontend/
│   ├── index.html               # Marketplace UI
│   ├── admin-api-keys.html      # API key management
│   ├── admin-analytics.html     # Analytics dashboard
│   ├── store.html               # Vendor storefront
│   └── embed-demo.html          # Embed preview
├── docker-compose.yml
├── docker-compose.prod.yml
└── .github/workflows/ci.yml     # CI/CD
```

## 🔑 Core Features

### 1. Multi-Vendor Onboarding
- User registers → Applies as vendor → Admin approves
- Once active, vendor can upload products

### 2. Product Management
- **Single upload:** `POST /api/products` (with JWT or API key)
- **Bulk import:** `POST /api/vendor/products/bulk` (supports 100+ items)
- **API key auth:** Use `x-api-key` header for headless integration

### 3. Commission System
- **Per-category rates** (8–20% configurable)
- **Applied post-discount** to order total
- **Audit trail** in `db.json` > `auditLogs`

### 4. Admin Tools
- **Analytics dashboard** — category metrics, order drill-down
- **API key manager** — view, generate, revoke, label vendor keys
- **Discount rules** — create category-based promotions
- **Audit logs** — view all operations with timestamps

### 5. External Integration
- **Provider connect** — Register external vendors via API
- **Embed snippet** — Generate `<iframe>` for vendor storefront
- **Webhook ready** — Stripe webhook handler included

## 📊 API Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login, get JWT token |
| GET | `/api/products` | List products |
| POST | `/api/products` | Create product |
| POST | `/api/vendor/products/bulk` | Bulk import |
| POST | `/api/vendors/apply` | Apply as vendor |
| POST | `/api/vendors/:id/generate-api-key` | Generate API key |
| POST | `/api/vendors/:id/revoke-api-key` | Revoke API key |
| GET | `/api/admin/api-keys` | View all API keys (admin) |
| POST | `/api/orders` | Create order |
| GET | `/api/admin/analytics/categories` | Category metrics (admin) |
| GET | `/api/admin/discount-rules` | View discount rules (admin) |

**Full spec:** `backend/openapi.yaml` (OpenAPI 3.0 / Swagger)

## 🧪 Testing

```bash
# All tests
npm test

# Specific suites
npm run test:vendor-products    # Vendor, API key, product tests
npm run test:improvements       # Analytics & discount rules
npm run test:categories         # Category & niche tests
npm run e2e                     # Full end-to-end demo
```

Tests run automatically on push to `main` or `master` via GitHub Actions.

## ⚙️ Configuration

### Environment Variables
```bash
cp backend/.env.example backend/.env
# Edit .env with your values
```

**Key variables:**
- `PORT` — Server port (default: 4000)
- `NODE_ENV` — `development` or `production`
- `STRIPE_SECRET_KEY` — Stripe integration (optional)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — Initial admin credentials

### Database
- **Dev:** File-based `db.json` (included)
- **Prod:** PostgreSQL + Prisma (schema in `backend/prisma/schema.prisma`)

## 🌐 Deployment

### Automated Deployment (GitHub Actions)
Once you push to GitHub with repository secrets configured, the CI/CD pipeline will automatically:
- Build and test your Docker image
- Push to your configured registries (Docker Hub, AWS ECR, Azure ACR, Google Container Registry)
- Deploy to your platform (AWS ECS, Azure Web App, Google Cloud Run, Heroku, DigitalOcean)

**Configuration:** See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed secret setup instructions.

### Manual Deployment

#### Docker Build & Push
```bash
docker build -t myrepo/service-web:latest backend/
docker push myrepo/service-web:latest
```

#### Heroku
```bash
git push heroku main
```

#### AWS (ECS/Fargate), Azure App Service, DigitalOcean
See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive guides.

## 🔒 Security

**Before deploying to production:**
- [ ] Change default admin password in `.env`
- [ ] Use HTTPS (SSL/TLS)
- [ ] Store secrets in secure vault (not in git)
- [ ] Enable rate limiting
- [ ] Migrate to PostgreSQL (from JSON file)
- [ ] Set up monitoring & logs
- [ ] Review API auth scopes
- [ ] Enable CORS for trusted origins only

## 📚 Documentation

- **Quick Start & Next Steps:** [NEXT_STEPS.md](./NEXT_STEPS.md) ⭐ **Start here!**
- **Automation Scripts:** [scripts/README_FOR_SCRIPTS.md](./scripts/README_FOR_SCRIPTS.md)
- **API Spec:** `backend/openapi.yaml` (Swagger/OpenAPI 3.0)
- **Deployment:** [DEPLOYMENT.md](./DEPLOYMENT.md) (AWS, Azure, Heroku, GCP, etc.)
- **Development:** [DEVELOPMENT.md](./DEVELOPMENT.md) (local setup, architecture)
- **Contributing:** [CONTRIBUTING.md](./CONTRIBUTING.md) (guidelines)
- **Project Status:** [PROJECT_COMPLETION.md](./PROJECT_COMPLETION.md) (features & completion checklist)

## 📦 Demo Accounts

Seeded in `backend/db.json`:
- **Admin:** `admin@example.com` / `admin`
- **Vendor:** `vendor@example.com` / `vendor`
- **Buyer:** `buyer@example.com` / `buyer`

Change these immediately in production!

## 🚧 Roadmap

- PostgreSQL migration
- Redis caching for analytics
- Real-time notifications (WebSocket)
- Vendor dashboard (React)
- Automated payouts
- Multi-currency support
- Tax integration

---

**Built with ❤️ for a scalable, vendor-friendly marketplace.**

# Minimal Node.js Express API for SERVICE WEB

This is a minimal Express.js app exposing a health endpoint for deployment and CI/CD testing.

## Usage

- `npm install`
- `npm start`
- Health endpoint: http://localhost:3000/api/health

## Deployment
- Push to GitHub: triggers Actions workflow
- Heroku: deploy via container or buildpack
- Cloudflare: CNAME www.infinit3.cc to Heroku DNS target

---

## Stack
- Node.js 20+
- Express 4.x

---

## Project Structure

- `src/server.js` — main API server
- `package.json` — dependencies and scripts
- `.github/workflows/deploy.yml` — CI/CD workflow