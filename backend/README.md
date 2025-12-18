# Backend — Minimal Prototype

This backend is a lightweight Node prototype that uses only Node core modules and a simple JSON file as the datastore so it can run without installing dependencies.

Run (PowerShell):

```powershell
cd 'e:\oo pupteers\SERVICE WEB\backend'
node index.js
```

 API endpoints (example):
 - `GET /api/health` — health check
 - `GET /api/products` — list products
 - `POST /api/products` — create product (body: { title, vendorId, price, category })
 - `POST /api/orders` — create order (body: { buyer, items: [{productId, qty, price}], couponCode })
 - `GET /api/coupons` — list coupons
 - `POST /api/coupons` — create coupon (admin only)
 - `GET /api/offers` — list offers
 - `GET /api/admin/payouts` — list payouts (admin)
 - `POST /api/admin/commissions/:id/pay` — mark commission paid & create payout (admin)

Simulated payments (development)
- `POST /api/payments/simulate` — body `{ orderId }` will mark an order as paid and mark its commission as `payable` so admin can trigger payouts. This endpoint is for testing only.

Admin endpoints useful for the admin UI:
- `GET /api/admin/orders` — list orders (admin only)

Stripe Connect integration (optional)
-------------------------------------------------
This project includes an optional Stripe integration scaffold in `backend/stripe/stripe_integration.js`.

Steps to enable (local development):

1. Install dependencies in the backend folder:

```powershell
cd 'e:\oo pupteers\SERVICE WEB\backend'
npm install
```

2. Copy `backend/.env.example` to `backend/.env` and fill in your Stripe keys:
- `STRIPE_SECRET_KEY` (sk_test_...)
- `STRIPE_WEBHOOK_SECRET` (if you plan to receive webhooks locally via Stripe CLI)
- `STRIPE_CLIENT_ID` (for OAuth / Connect)

3. Create Connect accounts for vendors using `createConnectAccount(email)` and create an account link using `createAccountLink(accountId, refreshUrl, returnUrl)` to complete onboarding.

4. To charge an order and route funds to a connected account while taking a platform fee, call `createPaymentIntentForOrder({ orderId, amount, currency, connectedAccountId, applicationFeeAmount })`. `amount` and `applicationFeeAmount` are in cents.

5. For production, use secure secret storage for keys (GitHub Secrets / environment variables) and configure webhook endpoints to mark payments and transfers.

Example (testing using Stripe CLI):

```powershell
# start backend
node index.js
# in another terminal, forward webhooks (requires Stripe CLI installed and logged in)
stripe listen --forward-to localhost:4000/webhooks/stripe
```

Security note: Do not commit real secret keys into the repository. Treat `.env` as local-only and use deployment secrets for production.

API: Stripe helper endpoints (optional)
- `POST /api/stripe/create-account` — create a Stripe Connect account and attach `stripeAccountId` to the vendor for the authenticated user. Body: `{ email }`. Requires Stripe keys or returns an error message.
- `POST /api/stripe/account-link` — create an onboarding link for a Stripe account. Body: `{ accountId, refreshUrl, returnUrl }`.
- `POST /api/stripe/create-payment-intent` — create a payment intent for an order. Body: `{ orderId, connectedAccountId }`. Returns `clientSecret` and `paymentIntentId` if Stripe is configured; otherwise returns a mock secret and message to use simulated payment.
- `POST /webhooks/stripe` — Stripe webhook receiver. Verifies signature using `STRIPE_WEBHOOK_SECRET` and will mark orders paid when `payment_intent.succeeded` events are received.

Testing

A simple test suite is included in `backend/test.js`. It requires a running backend server.

```powershell
# Terminal 1: start backend
cd 'e:\oo pupteers\SERVICE WEB\backend'
node index.js

# Terminal 2: run tests
cd 'e:\oo pupteers\SERVICE WEB\backend'
node test.js
```

The test suite covers:

E2E Demo

An end-to-end demo script (`backend/e2e-demo.js`) walks through a complete marketplace flow: vendor onboarding → product listing → order → payment → payout.

```powershell
# Terminal 1: start backend
cd 'e:\oo pupteers\SERVICE WEB\backend'
node index.js

# Terminal 2: run e2e demo
cd 'e:\oo pupteers\SERVICE WEB\backend'
node e2e-demo.js
# or with verbose output:
VERBOSE=1 node e2e-demo.js
```

The demo creates test users (buyer, vendor, admin), vendor approval, product creation, coupon application, order, payment simulation, and payout, demonstrating the full flow.

Environment note:
- This workspace may not have `node` available on the PATH in the current automation environment. To run the server and tests locally, install Node.js (LTS) and ensure the `node` command is available in PowerShell.

Quick verification (PowerShell):
```powershell
node -v
npm -v
```


 Order creation notes:
 - POST `/api/orders` accepts `{ buyer, items: [{productId, qty, price}], couponCode }`.
 - Coupons are validated for start/end dates and usage limits. `coupon.usedCount` increments on successful use.
 - Commission is calculated on the post-discount total and recorded in `db.commissions`. Use the admin pay endpoint to mark commissions as paid and create payout records.
Auth & vendor flows:
- `POST /api/auth/register` — register user. Body: `{ email, password, role }` (role: `buyer` or `vendor`)
- `POST /api/auth/login` — login user. Body: `{ email, password }` — returns token
- `GET /api/me` — get current user (Authorization: Bearer <token>)
- `POST /api/vendors/apply` — apply to register as vendor (Authorization required)
- `POST /api/admin/vendors/:id/approve` — approve vendor (admin only)

OpenAPI spec is available at `openapi.yaml` and a Prisma schema is in `prisma/schema.prisma` for reference.

Frontend is served from `../frontend`.
