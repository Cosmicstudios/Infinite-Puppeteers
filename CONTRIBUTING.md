# Contributing to Service Web Marketplace

Thank you for your interest in contributing to Service Web Marketplace! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please read and adhere to our Code of Conduct:

- Be respectful and inclusive
- Welcome people of all backgrounds and experience levels
- Focus on constructive feedback
- Report inappropriate behavior to maintainers

## Getting Started

### Prerequisites

- Node.js 18+ ([download](https://nodejs.org/))
- Docker & Docker Compose (optional, for local development)
- Git

### Local Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/service-web.git
   cd service-web
   ```

3. **Install dependencies**
   ```bash
   cd backend
   npm install
   cd ..
   ```

4. **Setup environment**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env if needed (defaults work for local dev)
   ```

5. **Start the server**
   ```bash
   # Option A: Direct Node.js
   cd backend && npm start
   
   # Option B: Docker Compose
   docker-compose up --build
   ```

6. **Verify it's running**
   ```bash
   curl http://localhost:4000/api/health
   # Should return: {"status":"ok"}
   ```

## Development Workflow

### 1. Create a Branch

Use a descriptive branch name:

```bash
git checkout -b feature/api-key-ui-improvements
# or
git checkout -b fix/commission-calculation-bug
# or
git checkout -b docs/deployment-guide-aws
```

### 2. Make Your Changes

- Keep commits atomic and well-described
- Write meaningful commit messages:
  ```bash
  git commit -m "feat: add API key expiration support"
  git commit -m "fix: correct commission calculation for mixed categories"
  git commit -m "docs: update Heroku deployment guide"
  ```

- Test your changes locally before pushing

### 3. Test Your Code

#### Run Unit/E2E Tests
```bash
cd backend
npm test                      # Run all tests
npm run test:vendor-products  # Run specific suite
npm run test:improvements
npm run test:categories
npm run e2e                   # Full end-to-end demo
```

#### Manual Testing

Use Postman, curl, or the included test files:

```bash
# Example: Test vendor product upload
curl -X POST http://localhost:4000/api/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Product","price":99.99,"categoryId":"electronics"}'
```

### 4. Push Your Branch

```bash
git push origin feature/api-key-ui-improvements
```

### 5. Create a Pull Request

On GitHub:

1. Click "Compare & pull request"
2. Write a clear title and description
3. Reference related issues (e.g., "Fixes #123")
4. Wait for CI/CD to pass (GitHub Actions)
5. Request review from maintainers

## Pull Request Guidelines

### PR Title Format

Use conventional commit style:

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `refactor:` — Code refactoring
- `test:` — Test improvements
- `chore:` — Build, CI/CD, dependencies

Examples:

```
feat: add vendor product expiration
fix: correct discount rule calculation
docs: update deployment guide for Azure
test: add E2E tests for bulk product import
```

### PR Description Template

```markdown
## Description
Brief summary of changes.

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Documentation
- [ ] Breaking change

## Related Issue
Fixes #123

## Testing
Describe how you tested this:
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

## Code Style & Standards

### Backend (Node.js)

- **Indentation:** 2 spaces
- **Semicolons:** Required
- **Naming:** camelCase for variables/functions, PascalCase for classes
- **Async/await:** Preferred over callbacks

```javascript
// Good ✅
async function createProduct(req, res) {
  const { name, price } = req.body;
  const product = await db.products.create({ name, price });
  res.json(product);
}

// Avoid ❌
function createProduct(req, res, callback) {
  var name = req.body.name
  db.products.create(name, (err, product) => {
    res.json(product)
  })
}
```

### Error Handling

```javascript
// Good ✅
try {
  const vendor = await db.getVendor(id);
  if (!vendor) return res.status(404).json({ error: 'Not found' });
  res.json(vendor);
} catch (err) {
  console.error('Error fetching vendor:', err);
  res.status(500).json({ error: 'Server error' });
}
```

### API Endpoints

- Use RESTful conventions (GET, POST, PUT, DELETE)
- Return JSON with consistent schema
- Include proper HTTP status codes (200, 201, 400, 401, 404, 500)

```javascript
// Good ✅
app.post('/api/products', authenticate, (req, res) => {
  try {
    const product = { id: uuid(), ...req.body };
    db.products.push(product);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

### Comments & Documentation

Add JSDoc comments for complex functions:

```javascript
/**
 * Calculate commission for a category
 * @param {number} amount - Order total before discount
 * @param {string} categoryId - Product category
 * @param {number} discountAmount - Discount applied
 * @returns {number} Commission amount
 */
function calculateCommission(amount, categoryId, discountAmount) {
  const rate = db.categoryCommissionRates[categoryId] || 0.1;
  return (amount - discountAmount) * rate;
}
```

### Frontend (HTML/JavaScript)

- Use semantic HTML5
- Vanilla JavaScript (no framework required)
- ES6+ syntax (async/await, const/let, arrow functions)
- Keep functions focused and small

## Reporting Bugs

Before creating an issue, check if it's already reported:

1. Search existing issues
2. Include reproduction steps
3. Attach logs/screenshots if applicable

**Bug Report Template:**

```markdown
## Description
Brief description of the bug.

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- Node version: 
- Docker version:
- OS:

## Logs
```
Paste relevant logs here
```
```

## Requesting Features

**Feature Request Template:**

```markdown
## Description
Clear description of the feature.

## Motivation
Why is this needed?

## Example Usage
How would this be used?

## Alternatives
Any alternative approaches?
```

## Project Structure Reference

```
service-web/
├── backend/
│   ├── index.js              # Main server (all routes & business logic)
│   ├── db.json               # Development database
│   ├── package.json
│   ├── openapi.yaml          # API specification
│   ├── Dockerfile
│   ├── .env.example
│   ├── prisma/
│   │   └── schema.prisma    # PostgreSQL schema (for migration)
│   └── test-*.js             # Test suites
├── frontend/
│   ├── index.html            # Marketplace UI
│   ├── admin-*.html          # Admin UIs
│   ├── store.html
│   └── embed-demo.html
├── README.md
├── DEPLOYMENT.md
├── CONTRIBUTING.md (this file)
└── LICENSE
```

## Architecture Notes

### Backend (`index.js`)

The single-file server includes:

1. **Authentication** — JWT tokens (HS256 HMAC)
2. **API Routes** — All endpoints in one file
3. **Database** — File-based `db.json` (dev) / PostgreSQL (prod)
4. **Commission Logic** — Per-category weighted rates
5. **Audit Logging** — Track key operations

Key objects in `db`:

- `users` — Admin/vendor/buyer accounts
- `vendors` — Vendor profiles with API keys
- `products` — Vendor products
- `orders` — Customer orders
- `categories` — 25+ marketplace categories
- `auditLogs` — Complete operation history

### Common Tasks

#### Adding a New API Endpoint

1. Add route handler in `backend/index.js`
2. Include authentication if needed
3. Add audit log entry if it's a key operation
4. Update `backend/openapi.yaml`
5. Add test case in relevant `test-*.js`

Example:

```javascript
app.post('/api/products/:id/deactivate', authenticate, (req, res) => {
  try {
    const product = db.products.find(p => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    
    product.active = false;
    
    db.auditLogs.push({
      timestamp: new Date().toISOString(),
      action: 'product.deactivate',
      userId: req.user.id,
      resourceId: product.id,
      details: { name: product.name }
    });
    
    saveDB();
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

#### Adding a New Category

Edit `backend/db.json` and add to `categories` array:

```json
{
  "id": "new-category",
  "name": "New Category Name",
  "description": "Description",
  "commissionRate": 0.15,
  "icon": "icon-name"
}
```

Then add commission rate to `config.categoryCommissionRates`.

#### Running Tests

```bash
cd backend
npm test              # All tests (runs all suites)
npm run test:vendor-products
npm run test:improvements
npm run test:categories
npm run e2e          # Full demo walkthrough
```

## Release Process

Maintainers follow semantic versioning (MAJOR.MINOR.PATCH):

1. Update version in `backend/package.json`
2. Update `CHANGELOG.md` (if exists)
3. Tag release: `git tag v1.0.0`
4. Push tags: `git push origin --tags`
5. Create GitHub Release with notes

## Getting Help

- **Issues:** [GitHub Issues](https://github.com/your-org/service-web/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/service-web/discussions)
- **Documentation:** See `README.md` and `DEPLOYMENT.md`

## Recognition

Contributors are recognized in:

- GitHub contributors graph
- Release notes (if applicable)
- Project documentation

Thank you for making Service Web Marketplace better! 🎉
