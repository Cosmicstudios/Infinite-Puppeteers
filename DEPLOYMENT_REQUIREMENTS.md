# 📋 Deployment Requirements Checklist

Choose your deployment platform and follow the requirements.

---

## 🎯 Quick Overview

**Minimum to get started:**
- Git repository initialized ✓ (auto-all-windows.ps1 does this)
- GitHub account (free) ✓
- Docker image built ✓ (auto-all-windows.ps1 does this)
- Platform account (varies by platform)
- Repository secrets configured (5-10 minutes)

---

## 🌐 Platform-Specific Requirements

### 1️⃣ **Docker Hub** (Simplest)
**Setup Time:** 5 minutes | **Cost:** $0 (public repos)

**Prerequisites:**
- [ ] Docker Hub account (free at [hub.docker.com](https://hub.docker.com))
- [ ] GitHub account
- [ ] Docker image built locally (or via CI/CD)

**Repository Secrets Needed:**
```
DOCKERHUB_USERNAME    = your-docker-username
DOCKERHUB_TOKEN       = personal access token
```

**Getting the token:**
1. Log in to Docker Hub
2. Go to: Account Settings → Security → New Access Token
3. Copy token to GitHub secret

**Result:** Image pushed to Docker Hub; manual container management

---

### 2️⃣ **Heroku** (Easiest Full Deployment)
**Setup Time:** 15 minutes | **Cost:** ~$7/month

**Prerequisites:**
- [ ] Heroku account (free at [heroku.com](https://heroku.com))
- [ ] GitHub account
- [ ] Heroku app created: `heroku create my-marketplace`
- [ ] PostgreSQL add-on (optional but recommended)

**Repository Secrets Needed:**
```
HEROKU_API_KEY        = account API key
HEROKU_APP_NAME       = my-marketplace
```

**Getting API key:**
1. Log in to Heroku
2. Go to: Account Settings → API Key
3. Copy to GitHub secret

**Database Setup (Optional):**
```bash
heroku addons:create heroku-postgresql:standard-0 -a my-marketplace
heroku config:get DATABASE_URL -a my-marketplace
# Add to your app's environment
```

**Result:** Auto-deploy on push, built-in scaling

---

### 3️⃣ **AWS ECS/Fargate** (Most Control)
**Setup Time:** 1-2 hours | **Cost:** $50-200/month

**Prerequisites:**
- [ ] AWS account (free tier available at [aws.amazon.com](https://aws.amazon.com))
- [ ] IAM user with permissions:
  - ECR (Elastic Container Registry)
  - ECS (Elastic Container Service)
  - CloudWatch (logging)
  - Optional: RDS (database)
- [ ] GitHub account

**Create IAM User:**
```bash
# AWS Console → IAM → Users → Create user
# Attach policies:
#  - AmazonEC2ContainerRegistryFullAccess
#  - AmazonECS_FullAccess
```

**Repository Secrets Needed:**
```
AWS_ACCESS_KEY_ID         = IAM user access key
AWS_SECRET_ACCESS_KEY     = IAM user secret key
AWS_ACCOUNT_ID           = 123456789012 (12-digit number)
AWS_REGION               = us-east-1 (or your region)
ECS_CLUSTER              = my-marketplace-cluster
ECS_SERVICE              = service-web
```

**Infrastructure to Create:**
1. ECR repository: `service-web`
2. RDS database (optional): PostgreSQL 13+
3. ECS cluster: `my-marketplace-cluster`
4. ECS service: `service-web` (Fargate)
5. Application Load Balancer (for public access)

**Database Setup (Optional):**
```bash
# AWS Console → RDS → Create database
# Engine: PostgreSQL
# Size: db.t3.micro (free tier)
# Get connection string: postgresql://user:pass@endpoint:5432/dbname
```

**Result:** Enterprise-grade deployment, auto-scaling, load balancing

---

### 4️⃣ **Azure App Service** (Microsoft Ecosystem)
**Setup Time:** 1 hour | **Cost:** $50-100/month

**Prerequisites:**
- [ ] Azure account (free tier available at [azure.microsoft.com](https://azure.microsoft.com))
- [ ] Resource Group created
- [ ] Service Principal created (for CI/CD)
- [ ] Container Registry created
- [ ] App Service created
- [ ] GitHub account

**Create Service Principal:**
```bash
az ad sp create-for-rbac --name "service-web-ci" --role contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/{resource-group}
```

**Repository Secrets Needed:**
```
AZURE_CLIENT_ID           = service principal client ID
AZURE_TENANT_ID          = your tenant ID
AZURE_CLIENT_SECRET      = service principal secret
ACR_NAME                 = mymarketplaceacr
AZURE_WEBAPP_NAME        = my-marketplace-app
AZURE_RESOURCE_GROUP     = my-rg
```

**Infrastructure to Create:**
1. Container Registry (ACR): `mymarketplaceacr`
2. App Service Plan: Linux, B1 or higher
3. App Service: `my-marketplace-app`
4. Azure Database for PostgreSQL (optional)

**Result:** Integrated with Microsoft ecosystem, auto-deploy, scaling

---

### 5️⃣ **Google Cloud Run** (Serverless)
**Setup Time:** 45 minutes | **Cost:** $0-30/month (pay per invocation)

**Prerequisites:**
- [ ] Google Cloud account (free tier available at [cloud.google.com](https://cloud.google.com))
- [ ] Project created
- [ ] Service Account created
- [ ] GitHub account

**Create Service Account & Key:**
```bash
# Google Cloud Console:
# 1. Go to: IAM & Admin → Service Accounts → Create Service Account
# 2. Grant roles:
#    - Container Registry Service Agent
#    - Cloud Run Admin
# 3. Create key → Download as JSON
```

**Repository Secrets Needed:**
```
GCP_SA_KEY               = entire service account JSON (as text)
GCP_CLOUD_RUN_SERVICE   = service-web
GCP_REGION              = us-central1
```

**Infrastructure to Create:**
1. Cloud Storage bucket (for deployment)
2. Cloud SQL (PostgreSQL, optional)

**Result:** Serverless, minimal ops, auto-scaling

---

### 6️⃣ **DigitalOcean App Platform** (Balanced)
**Setup Time:** 30 minutes | **Cost:** $15-50/month

**Prerequisites:**
- [ ] DigitalOcean account (free credits available at [digitalocean.com](https://digitalocean.com))
- [ ] API token generated
- [ ] App created in App Platform
- [ ] GitHub account

**Create API Token:**
1. Log in to DigitalOcean
2. Go to: API → Tokens → Generate New Token
3. Copy to GitHub secret

**Repository Secrets Needed:**
```
DO_API_TOKEN             = DigitalOcean API token
DO_APP_ID                = app-id-from-app-platform
```

**Infrastructure to Create:**
1. App Platform app
2. Container Registry (free with DigitalOcean)
3. Managed PostgreSQL (optional): $15/month

**Result:** Simple deployment, good middle ground

---

### 7️⃣ **Generic VPS** (Full Control)
**Setup Time:** 2 hours | **Cost:** $5-20/month

**Supported Providers:**
- AWS EC2
- DigitalOcean Droplet
- Linode
- Vultr
- Any Linux server with SSH access

**Prerequisites:**
- [ ] VPS created (Ubuntu 20.04 or 22.04)
- [ ] SSH access configured
- [ ] Domain name (optional but recommended)
- [ ] SSL certificate (free via Let's Encrypt)
- [ ] GitHub account

**VPS Requirements:**
```
OS:              Ubuntu 20.04+ (minimum 1GB RAM, 20GB storage)
Docker:          Installed via script or manually
Docker Compose:  Installed via script or manually
Nginx:           For reverse proxy & SSL
PostgreSQL:      Optional (can use managed service)
```

**Repository Secrets Needed:**
```
SSH_HOST         = your-vps-ip or domain
SSH_USER         = ubuntu (or your SSH user)
SSH_KEY          = private SSH key (multiline)
SSH_PORT         = 22 (or custom port)
```

**Infrastructure to Create:**
1. VPS instance
2. Security group/firewall rules
3. Domain name (optional)
4. SSL certificate (free)
5. PostgreSQL database (on VPS or managed)

**Result:** Full control, manual scaling

---

## ✅ Universal Requirements (All Platforms)

Regardless of platform, you need:

- [ ] **Git repository initialized** ✓ (auto-all-windows.ps1 does this)
- [ ] **Code committed to GitHub** (one push)
- [ ] **GitHub account** (free at github.com)
- [ ] **Docker image built** ✓ (auto-all-windows.ps1 does this)
- [ ] **Environment variables configured:**
  ```
  PORT=4000
  NODE_ENV=production
  JWT_SECRET=your-secure-key
  ADMIN_EMAIL=admin@example.com
  ADMIN_PASSWORD=strong-password
  ```

---

## 🔧 Pre-Deployment Checklist

Before deploying to ANY platform:

- [ ] Read `NEXT_STEPS.md` (action guide)
- [ ] Read platform-specific section in `DEPLOYMENT.md`
- [ ] Create platform account (free tier available for most)
- [ ] Create service account / API credentials
- [ ] Add repository secrets to GitHub
- [ ] Run `auto-all-windows.ps1` locally first (validate it works)
- [ ] Push code to GitHub
- [ ] Monitor first deployment in platform console

---

## 📊 Platform Comparison Matrix

| Feature | Docker Hub | Heroku | AWS ECS | Azure | GCP Run | DigitalOcean | VPS |
|---------|-----------|--------|---------|-------|---------|--------------|-----|
| **Setup Time** | 5 min | 15 min | 1-2 hrs | 1 hr | 45 min | 30 min | 2 hrs |
| **Monthly Cost** | $0 | $7 | $50-200 | $50-100 | $0-30 | $15-50 | $5-20 |
| **Auto-Deploy** | No | Yes | Yes | Yes | Yes | Yes | Yes |
| **Auto-Scale** | Manual | Yes | Yes | Yes | Yes | Manual | Manual |
| **Database Included** | No | Yes | No | No | No | Optional | Manual |
| **Ops Complexity** | Low | Very Low | High | Medium | Low | Medium | High |
| **Best For** | Learning | Small apps | Enterprise | Microsoft shops | Serverless | Balanced | Full control |

---

## 🎯 Recommended Path by Use Case

### **"I just want to try it"**
→ **Docker Hub** (5 minutes)
- Build locally with auto-all-windows.ps1
- Push to Docker Hub
- Run manually or with Docker Compose

### **"I want automatic deployment"**
→ **Heroku** (15 minutes)
- Simplest full deployment
- Auto-scales
- Managed database

### **"I need enterprise-grade"**
→ **AWS ECS** (1-2 hours)
- Full control
- Load balancing
- Horizontal scaling
- Managed database (RDS)

### **"I want balanced simplicity"**
→ **DigitalOcean App Platform** (30 minutes)
- Simple UI
- Managed container registry
- Auto-deploy
- Good pricing

### **"I have full control requirements"**
→ **VPS** (2 hours)
- Your own server
- Full customization
- Lowest cost possible

---

## 🚀 Fastest Path to Production

**Total time: 30 minutes**

1. Run: `.\scripts\auto-all-windows.ps1` (10 min)
2. Create Heroku account (free, 2 min)
3. Add Heroku secrets to GitHub (3 min)
4. Push to GitHub (1 min)
5. Watch automatic deployment (5 min)

**Result:** Production app live with auto-deploy! ✓

---

## 📞 Troubleshooting Requirements

If something is missing, check:

1. **"Command not found (git/docker/node)"**
   → Run: `.\scripts\install-prereqs.ps1` as Administrator

2. **"Can't push to GitHub"**
   → Run: `gh auth login`

3. **"Deployment failed"**
   → Check GitHub Actions logs (Actions tab in repo)
   → Verify all required secrets are set

4. **"Port 4000 already in use"**
   → Change `PORT` in `.env`
   → Or: `netstat -ano | findstr :4000` and kill the process

5. **"Docker image won't build"**
   → Check `backend/Dockerfile` exists
   → Run: `docker build -f backend/Dockerfile -t test backend/`

---

## ✨ Summary

**Minimum requirements to deploy:**
1. GitHub account (free)
2. Platform account (varies, many free tiers)
3. Repository secrets configured (5-10 min)
4. Code pushed to GitHub (1 min)
5. Run platform's deploy command (automatic via CI/CD)

**That's it!** The automation handles the rest. ✓

See `DEPLOYMENT.md` for detailed platform guides and `NEXT_STEPS.md` for step-by-step instructions.
