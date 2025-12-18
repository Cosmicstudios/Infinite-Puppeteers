# Category Improvements - Architecture & Workflows

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MARKETPLACE PLATFORM v2.0                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐      ┌──────────────────┐                │
│  │  ADMIN DASHBOARDS│      │   PUBLIC API     │                │
│  ├──────────────────┤      ├──────────────────┤                │
│  │ Analytics        │      │ GET /categories  │                │
│  │ Discount Rules   │      │ GET /products    │                │
│  │ Category Mgmt    │      │ POST /orders     │                │
│  │ (admin-*.html)   │      │ (public routes)  │                │
│  └────────┬─────────┘      └────────┬─────────┘                │
│           │                         │                           │
│           └─────────────┬───────────┘                           │
│                         │                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         NODE.JS BACKEND (index.js - 732 lines)           │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ ANALYTICS ENGINE                                     │ │  │
│  │  ├─────────────────────────────────────────────────────┤ │  │
│  │  │ • Aggregate orders by category                      │ │  │
│  │  │ • Calculate revenue per category                    │ │  │
│  │  │ • Compute commission per category                   │ │  │
│  │  │ • Track product counts                              │ │  │
│  │  │ • Calculate averages (AOV, avg commission)          │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ DISCOUNT RULES ENGINE                               │ │  │
│  │  ├─────────────────────────────────────────────────────┤ │  │
│  │  │ • Create/update/delete discount rules               │ │  │
│  │  │ • Category-specific rule application                │ │  │
│  │  │ • Time-based rule validation (start/end)            │ │  │
│  │  │ • Active status filtering                           │ │  │
│  │  │ • Public endpoint for active rules                  │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ CATEGORY MANAGEMENT                                 │ │  │
│  │  ├─────────────────────────────────────────────────────┤ │  │
│  │  │ • CRUD operations on categories                     │ │  │
│  │  │ • Niche management                                  │ │  │
│  │  │ • Commission rate configuration                     │ │  │
│  │  │ • Bulk import (categories + niches)                 │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ COMMISSION CALCULATION                              │ │  │
│  │  ├─────────────────────────────────────────────────────┤ │  │
│  │  │ • Per-product category lookup                       │ │  │
│  │  │ • Apply category-specific commission rate           │ │  │
│  │  │ • Handle multi-category orders                      │ │  │
│  │  │ • Apply coupon discounts proportionally             │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│           │                                                     │
│           └────────────────────┬────────────────────┘           │
│                                │                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        JSON DATABASE (db.json - File-based)              │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                           │  │
│  │  • users                 • products                      │  │
│  │  • vendors               • orders                        │  │
│  │  • categories (10)       • commissions                   │  │
│  │  • niches (100+)         • coupons                       │  │
│  │  • discountRules (3+)    • payouts                       │  │
│  │                                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Analytics Workflow

```
┌────────────────┐
│ Admin User     │
│ Opens Dashboard│
└────────┬───────┘
         │
         │ 1. Load Analytics
         │    (GET /api/admin/analytics/categories)
         │
    ┌────▼──────┐      ┌──────────────────┐
    │  Backend   │      │  Database        │
    │  processes │───▶│ Loads:           │
    │  request   │      │ • Orders         │
    └────┬───────┘      │ • Products       │
         │               │ • Categories     │
         │               └──────────────────┘
         │
         │ 2. Calculate Metrics
         │
    ┌────▼──────────────────────┐
    │ For each category:         │
    │ • Count products           │
    │ • Sum order subtotals      │
    │ • Sum commissions          │
    │ • Calculate averages       │
    └────┬─────────────────────┘
         │
         │ 3. Return Analytics
         │
    ┌────▼──────────────────────────────┐
    │ Response:                          │
    │ {                                  │
    │   "electronics": {                 │
    │     "products": 5,                 │
    │     "orders": 12,                  │
    │     "totalRevenue": $4299.99,      │
    │     "totalCommission": $429.99,    │
    │     "avgOrderValue": $358.33,      │
    │     "avgCommission": $35.83        │
    │   }                                │
    │ }                                  │
    └────┬──────────────────────────────┘
         │
         │ 4. Render Dashboard
         │
    ┌────▼──────────────────────┐
    │ Admin sees:                │
    │ • Summary cards            │
    │ • Performance table        │
    │ • Category details         │
    │ • View Orders button       │
    └────────────────────────────┘
```

## Discount Rules Workflow

### Creating a Rule

```
┌────────────────┐
│ Admin User     │
│ Opens Manager  │
└────────┬───────┘
         │
         │ 1. Load Rules
         │    (GET /api/admin/discount-rules)
         │
    ┌────▼──────┐      ┌──────────────────┐
    │  Backend   │      │  Database        │
    │  fetches   │───▶│ discountRules[]  │
    │  all rules │      │                  │
    └────┬───────┘      └──────────────────┘
         │
         │ 2. Fill Create Form
         │
    ┌────▼──────────────────────────────┐
    │ Admin enters:                      │
    │ • Rule name                        │
    │ • Category (dropdown)              │
    │ • Discount %                       │
    │ • Max discount ($)                 │
    │ • Active (yes/no)                  │
    │ • Start date                       │
    │ • End date                         │
    └────┬──────────────────────────────┘
         │
         │ 3. Submit Rule
         │    (POST /api/admin/discount-rules)
         │
    ┌────▼──────┐      ┌──────────────────────────┐
    │  Backend   │      │  Save to Database:       │
    │  validates │───▶│ discountRules[] +=       │
    │  & saves   │      │ {id, name, category,     │
    └────┬───────┘      │  discount%, maxDiscount, │
         │               │  active, startAt, endAt} │
         │               └──────────────────────────┘
         │
         │ 4. Refresh Dashboard
         │    (GET /api/admin/discount-rules)
         │
    ┌────▼──────────────────────┐
    │ Admin sees new rule in:    │
    │ • Rule cards               │
    │ • Can edit/delete          │
    └────────────────────────────┘
```

### Using a Rule (Public)

```
┌──────────────┐
│ Customer     │
│ Browses      │
│ Fashion items│
└────────┬─────┘
         │
         │ 1. Get active rules
         │    (GET /api/discount-rules/category/fashion)
         │
    ┌────▼──────┐      ┌────────────────────────────┐
    │  Backend   │      │  Filter discountRules:     │
    │  filters   │───▶│ • Where categoryId == fashion
    │  rules     │      │ • Where active == true     │
    └────┬───────┘      │ • Where startAt <= now     │
         │               │ • Where endAt > now        │
         │               └────────────────────────────┘
         │
         │ 2. Return active rules
         │
    ┌────▼──────────────────────────────┐
    │ Response (example):                │
    │ [                                  │
    │   {                                │
    │     "id": "rule_fashion_20",       │
    │     "name": "Winter Sale",         │
    │     "categoryId": "fashion",       │
    │     "discountPercent": 20,         │
    │     "maxDiscount": 100             │
    │   }                                │
    │ ]                                  │
    └────┬──────────────────────────────┘
         │
         │ 3. (Future) Auto-apply rule
         │
    ┌────▼──────────────────────────┐
    │ When creating order:           │
    │ • Check applicable rules       │
    │ • Apply best rule              │
    │ • Adjust total price           │
    │ • Recalculate commission       │
    └────────────────────────────────┘
```

## Rule Validation Timeline

```
Created Rule: 2025-12-01 to 2025-12-31

Jan 01, 2025          Dec 01, 2025       Dec 31, 2025       Jan 01, 2026
    │                    │                   │                   │
    ├─────────────────┬──────────────────┬───┼─────────────────┤
    │                 │                  │   │                 │
    │              START               ACTIVE              END
    │                 │                  │   │
    │           (not active yet)    (ACTIVE)  │ (expired)
    │                 │                  │   │
    │         Returns from API          │   │
    │         (inactive rules)      Returns  │ (not returned)
    │                              (ACTIVE)  │
    │                              rules     │
    │                                        │
    └────────────────────────────────────────┴─────────────────┘

Query Timing:
• Before start:   Returns []           (rule not yet active)
• During period:  Returns [rule]       (rule is active)
• After end:      Returns []           (rule has expired)
• manual disable: Returns []           (active: false)
```

## Database Schema - Discount Rules

```
discountRules: [
  {
    id: string             // Generated: rule_<timestamp>
    name: string           // "Winter Fashion Sale"
    categoryId: string     // Reference to category
    discountPercent: number // 5 to 100
    maxDiscount: number    // Optional max amount in $
    active: boolean        // Can be toggled without deletion
    startAt: ISO string    // Rule becomes active
    endAt: ISO string      // Rule expires (optional)
  },
  ...
]

Commission Rates by Category:
electronics: 10%
fashion: 12%
home: 10%
beauty: 15%
sports: 10%
services: 20%
food: 8%
books: 15%
toys: 12%
automotive: 10%
```

## API Call Flow - Complete Example

```
1. ADMIN WORKFLOW
   └─ Login
      └─ GET /api/auth/login
         └─ Receive token

   └─ View Analytics
      └─ GET /api/admin/analytics/categories
         └─ Receive category metrics

   └─ View Category Orders
      └─ GET /api/admin/analytics/categories/electronics/orders
         └─ Receive order list

   └─ Create Rule
      └─ POST /api/admin/discount-rules
         └─ Body: {name, categoryId, discountPercent, ...}
         └─ Receive created rule

   └─ Update Rule
      └─ PUT /api/admin/discount-rules/{ruleId}
         └─ Body: {discountPercent: 25, ...}
         └─ Receive updated rule

   └─ Delete Rule
      └─ DELETE /api/admin/discount-rules/{ruleId}
         └─ Receive {ok: true}

2. CUSTOMER WORKFLOW
   └─ Browse Products
      └─ GET /api/products?category=fashion
         └─ Receive products

   └─ Check Discounts (Frontend)
      └─ GET /api/discount-rules/category/fashion
         └─ Receive active rules
         └─ Display in UI

   └─ Create Order
      └─ POST /api/orders
         └─ Body: {buyer, items, couponCode}
         └─ (Future: apply best rule)
         └─ Receive order with commission
```

## Response Time Expectations

```
Operation                          Time      Notes
─────────────────────────────────────────────────────────
GET /api/categories                 <10ms    Simple list
GET /api/admin/analytics/categories  20-50ms  Loops orders
GET /api/admin/analytics/.../orders  15-40ms  Filters orders
GET /api/admin/discount-rules        <10ms    Simple list
POST /api/admin/discount-rules       <10ms    Insert + save
PUT /api/admin/discount-rules/{id}   <10ms    Update + save
DELETE /api/admin/discount-rules/{id} <10ms   Remove + save
GET /api/discount-rules/category/{id} <10ms   Filter rules
POST /api/orders                     20-30ms  Commission calc
```

---

## Deployment Topology

```
┌──────────────────────────────────────────┐
│         PRODUCTION DEPLOYMENT             │
└──────────────────────────────────────────┘
          │
          ├─── Browser / Admin App
          │    ├─ admin-analytics.html
          │    └─ admin-discount-rules.html
          │
          ├─── Node.js Backend (Port 4000)
          │    ├─ Analytics Engine
          │    ├─ Discount Rules Engine
          │    ├─ Category Manager
          │    └─ Commission Calculator
          │
          ├─── Database
          │    ├─ File-based (db.json) - Dev
          │    └─ PostgreSQL - Prod (Prisma)
          │
          └─── (Future) Cache Layer
               ├─ Redis for rule caching
               └─ TTL: 5 minutes
```

---

## Integration Points (Next Phase)

```
Current System:
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Categories  │────▶│  Analytics   │────▶│   Reports    │
│  & Niches    │     │   Engine     │     │   (Admin)    │
└──────────────┘     └──────────────┘     └──────────────┘

Plus Discount Rules:
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Discount    │────▶│   Orders     │────▶│ Auto-Apply   │
│   Rules      │     │  (Future)    │     │   Rules      │
└──────────────┘     └──────────────┘     └──────────────┘

Potential Extensions:
├─ Rule Usage Analytics
├─ Rule Performance Dashboard
├─ Predictive Rule Recommendations
├─ A/B Testing Framework
└─ Customer Segment Rules
```

---

This diagram provides a complete picture of how the category improvements integrate with the existing system and are ready for future enhancements.
