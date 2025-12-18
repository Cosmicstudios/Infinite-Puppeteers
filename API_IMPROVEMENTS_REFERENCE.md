# Quick API Reference - Category Improvements

## Analytics API

### Get All Category Analytics
```bash
GET /api/admin/analytics/categories
Headers: Authorization: Bearer <ADMIN_TOKEN>

Response: {
  "electronics": {
    "categoryId": "electronics",
    "categoryName": "Electronics & Technology",
    "products": 5,
    "orders": 12,
    "totalRevenue": 4299.99,
    "totalCommission": 429.99,
    "avgOrderValue": 358.33,
    "avgCommission": 35.83,
    "commissionRate": "10%"
  },
  ...
}
```

### Get Orders for Category
```bash
GET /api/admin/analytics/categories/{categoryId}/orders
Headers: Authorization: Bearer <ADMIN_TOKEN>

Response: {
  "category": "Electronics & Technology",
  "orderCount": 12,
  "orders": [
    {
      "orderId": "1733927451234",
      "buyer": "customer@example.com",
      "subtotal": 499.99,
      "commission": 49.99,
      "discount": 0,
      "total": 499.99,
      "itemCount": 1,
      "createdAt": "2025-12-11T12:00:00.000Z"
    },
    ...
  ]
}
```

## Discount Rules API

### List All Discount Rules (Admin)
```bash
GET /api/admin/discount-rules
Headers: Authorization: Bearer <ADMIN_TOKEN>

Response: [
  {
    "id": "rule_1733927451234",
    "name": "Electronics Holiday Sale",
    "categoryId": "electronics",
    "discountPercent": 15,
    "maxDiscount": 100,
    "active": true,
    "startAt": "2025-12-01T00:00:00.000Z",
    "endAt": "2025-12-31T23:59:59.999Z"
  },
  ...
]
```

### Create Discount Rule (Admin)
```bash
POST /api/admin/discount-rules
Headers: 
  Authorization: Bearer <ADMIN_TOKEN>
  Content-Type: application/json

Body: {
  "name": "Electronics Holiday Sale",
  "categoryId": "electronics",
  "discountPercent": 15,
  "maxDiscount": 100,              // optional
  "active": true,                  // optional, default: true
  "startAt": "2025-12-01T00:00:00.000Z",  // optional
  "endAt": "2025-12-31T23:59:59.999Z"     // optional
}

Response: {
  "id": "rule_1733927451234",
  "name": "Electronics Holiday Sale",
  "categoryId": "electronics",
  "discountPercent": 15,
  "maxDiscount": 100,
  "active": true,
  "startAt": "2025-12-01T00:00:00.000Z",
  "endAt": "2025-12-31T23:59:59.999Z"
}
```

### Update Discount Rule (Admin)
```bash
PUT /api/admin/discount-rules/{ruleId}
Headers: 
  Authorization: Bearer <ADMIN_TOKEN>
  Content-Type: application/json

Body: {
  "name": "Updated name",          // optional
  "discountPercent": 20,           // optional
  "maxDiscount": 150,              // optional
  "active": false,                 // optional
  "startAt": "...",                // optional
  "endAt": "..."                   // optional
}

Response: (Updated rule object)
```

### Delete Discount Rule (Admin)
```bash
DELETE /api/admin/discount-rules/{ruleId}
Headers: Authorization: Bearer <ADMIN_TOKEN>

Response: { "ok": true }
```

### Get Active Rules for Category (Public)
```bash
GET /api/discount-rules/category/{categoryId}

Response: [
  {
    "id": "rule_1733927451234",
    "name": "Electronics Holiday Sale",
    "categoryId": "electronics",
    "discountPercent": 15,
    "maxDiscount": 100,
    "active": true,
    "startAt": "2025-12-01T00:00:00.000Z",
    "endAt": "2025-12-31T23:59:59.999Z"
  },
  ...
]
```

**Note:** Public endpoint returns only:
- Rules with `active: true`
- Rules where `startAt <= now`
- Rules where `endAt` is null or `endAt > now`

## PowerShell Examples

### Get Admin Token
```powershell
$token = (Invoke-RestMethod -Uri "http://localhost:4000/api/auth/login" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"email":"admin@example.com","password":"admin"}').token

Write-Host "Token: $token"
```

### Get Category Analytics
```powershell
$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json"
}

$analytics = Invoke-RestMethod -Uri "http://localhost:4000/api/admin/analytics/categories" `
  -Method GET `
  -Headers $headers

$analytics | ConvertTo-Json | Write-Host
```

### Create Discount Rule
```powershell
$rule = @{
  name = "Winter Fashion Sale"
  categoryId = "fashion"
  discountPercent = 20
  maxDiscount = 100
  active = $true
} | ConvertTo-Json

$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json"
}

$response = Invoke-RestMethod -Uri "http://localhost:4000/api/admin/discount-rules" `
  -Method POST `
  -Headers $headers `
  -Body $rule

$response | ConvertTo-Json | Write-Host
```

### Update Discount Rule
```powershell
$ruleId = "rule_1733927451234"

$update = @{
  discountPercent = 25
  maxDiscount = 150
  active = $false
} | ConvertTo-Json

$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json"
}

$response = Invoke-RestMethod -Uri "http://localhost:4000/api/admin/discount-rules/$ruleId" `
  -Method PUT `
  -Headers $headers `
  -Body $update

$response | ConvertTo-Json | Write-Host
```

### Delete Discount Rule
```powershell
$ruleId = "rule_1733927451234"

$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json"
}

$response = Invoke-RestMethod -Uri "http://localhost:4000/api/admin/discount-rules/$ruleId" `
  -Method DELETE `
  -Headers $headers

$response | ConvertTo-Json | Write-Host
```

### Get Active Rules for Category (Public)
```powershell
$rules = Invoke-RestMethod -Uri "http://localhost:4000/api/discount-rules/category/electronics" `
  -Method GET

$rules | ConvertTo-Json | Write-Host
```

### Get Category-Specific Orders
```powershell
$categoryId = "electronics"

$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json"
}

$response = Invoke-RestMethod -Uri "http://localhost:4000/api/admin/analytics/categories/$categoryId/orders" `
  -Method GET `
  -Headers $headers

$response | ConvertTo-Json | Write-Host
```

## cURL Examples

### Get Admin Token
```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin"}' | \
  jq -r '.token')

echo "Token: $TOKEN"
```

### Get Category Analytics
```bash
curl -s http://localhost:4000/api/admin/analytics/categories \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Create Discount Rule
```bash
curl -s -X POST http://localhost:4000/api/admin/discount-rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Winter Fashion Sale",
    "categoryId": "fashion",
    "discountPercent": 20,
    "maxDiscount": 100,
    "active": true
  }' | jq
```

### Update Discount Rule
```bash
RULE_ID="rule_1733927451234"

curl -s -X PUT http://localhost:4000/api/admin/discount-rules/$RULE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "discountPercent": 25,
    "active": false
  }' | jq
```

### Delete Discount Rule
```bash
RULE_ID="rule_1733927451234"

curl -s -X DELETE http://localhost:4000/api/admin/discount-rules/$RULE_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Get Active Rules for Category
```bash
curl -s http://localhost:4000/api/discount-rules/category/electronics | jq
```

### Get Category Orders
```bash
curl -s http://localhost:4000/api/admin/analytics/categories/electronics/orders \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Status Codes

| Code | Meaning | Common Scenarios |
|------|---------|------------------|
| 200 | Success | GET/PUT successful |
| 201 | Created | POST successful |
| 204 | No Content | DELETE successful |
| 400 | Bad Request | Missing required fields |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | User lacks permission (not admin) |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Backend issue |

## Error Responses

### Unauthorized (Missing Admin Token)
```json
{
  "status": 401,
  "error": "unauthorized"
}
```

### Forbidden (Not Admin)
```json
{
  "status": 403,
  "error": "forbidden"
}
```

### Bad Request (Missing Fields)
```json
{
  "status": 400,
  "error": "missing_required_fields"
}
```

### Not Found
```json
{
  "status": 404,
  "error": "rule_not_found"
}
```

## Testing Endpoints

Run the full test suite:
```bash
npm run test:improvements
```

This validates:
- ✅ All analytics endpoints
- ✅ All discount rule CRUD operations
- ✅ Rule filtering (active, future, expired)
- ✅ Authorization checks
- ✅ Error handling

---

For more details, see `IMPROVEMENTS_SUMMARY.md`
