# Deployment Guide

This guide covers deploying Service Web Marketplace to various cloud platforms.

## Prerequisites

- Docker image built: `docker build -t myrepo/service-web:latest backend/`
- Image pushed to registry (Docker Hub, ECR, etc.)
- Environment variables configured in your platform's secret manager

## 🚀 Platform-Specific Guides

### 1. Heroku (Easiest)

#### Setup
```bash
# Install Heroku CLI
# Login: heroku login
# Create app: heroku create my-marketplace

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:standard-0 -a my-marketplace

# Set environment variables
heroku config:set -a my-marketplace \
  NODE_ENV=production \
  JWT_SECRET=your-secret-key \
  STRIPE_SECRET_KEY=sk_live_... \
  ADMIN_EMAIL=admin@example.com \
  ADMIN_PASSWORD=secure_password
```

#### Deploy
```bash
# Create Procfile at workspace root:
# web: cd backend && npm install && npm start

git push heroku main
```

#### Verify
```bash
heroku logs -a my-marketplace --tail
heroku open -a my-marketplace
```

---

### 2. AWS ECS/Fargate (Recommended for Scale)

#### Setup ECR Repository
```bash
# Create ECR repo
aws ecr create-repository --repository-name service-web

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Tag & push image
docker tag myrepo/service-web:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/service-web:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/service-web:latest
```

#### Create RDS PostgreSQL Database
```bash
# AWS Console or CLI:
aws rds create-db-instance \
  --db-instance-identifier service-web-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username postgres \
  --allocated-storage 20 \
  --publicly-accessible false

# Update .env with RDS endpoint:
# DATABASE_URL=postgresql://postgres:password@service-web-db.*.rds.amazonaws.com:5432/marketplace
```

#### Create ECS Task Definition
```json
{
  "family": "service-web",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "service-web",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/service-web:latest",
      "portMappings": [{"containerPort": 4000}],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "4000"}
      ],
      "secrets": [
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:account-id:secret:service-web-jwt-secret"
        },
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:account-id:secret:service-web-db-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/service-web",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:4000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

#### Create ECS Service
```bash
# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create Fargate service
aws ecs create-service \
  --cluster default \
  --service-name service-web \
  --task-definition service-web \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-123],securityGroups=[sg-123],assignPublicIp=ENABLED}"
```

---

### 3. Azure App Service (Microsoft Cloud)

#### Prerequisites
```bash
# Install Azure CLI
az login

# Create resource group
az group create -n service-web-rg -l eastus

# Create App Service plan
az appservice plan create \
  --name service-web-plan \
  --resource-group service-web-rg \
  --sku B1 \
  --is-linux
```

#### Deploy Docker Image
```bash
# Option A: From Docker Hub
az webapp create \
  --resource-group service-web-rg \
  --plan service-web-plan \
  --name my-marketplace-app \
  --deployment-container-image-name myrepo/service-web:latest

# Option B: From Azure Container Registry
az acr create --resource-group service-web-rg --name mymarketplaceacr --sku Basic
docker tag service-web:latest mymarketplaceacr.azurecr.io/service-web:latest
docker push mymarketplaceacr.azurecr.io/service-web:latest

az webapp create \
  --resource-group service-web-rg \
  --plan service-web-plan \
  --name my-marketplace-app \
  --deployment-container-image-name mymarketplaceacr.azurecr.io/service-web:latest
```

#### Set Environment Variables
```bash
az webapp config appsettings set \
  --resource-group service-web-rg \
  --name my-marketplace-app \
  --settings \
    NODE_ENV=production \
    PORT=4000 \
    JWT_SECRET="your-secret" \
    STRIPE_SECRET_KEY="sk_live_..." \
    DATABASE_URL="postgresql://..."
```

#### Create Azure Database for PostgreSQL
```bash
az postgres server create \
  --resource-group service-web-rg \
  --name service-web-db \
  --location eastus \
  --admin-user postgres \
  --sku-name B_Gen5_1 \
  --storage-size 51200
```

---

### 4. DigitalOcean App Platform (Simple & Fast)

#### Prepare GitHub Connection
1. Connect DigitalOcean account to GitHub repo
2. Authorize DigitalOcean access

#### Create app.yaml
```yaml
name: service-web
services:
- name: backend
  github:
    repo: your-org/service-web
    branch: main
    build_command: cd backend && npm install
  build:
    dockerfile_path: backend/Dockerfile
  http_port: 4000
  envs:
  - key: NODE_ENV
    value: production
  - key: PORT
    value: "4000"
  - key: JWT_SECRET
    value: ${JWT_SECRET}
  - key: DATABASE_URL
    value: ${DATABASE_URL}
  - key: STRIPE_SECRET_KEY
    value: ${STRIPE_SECRET_KEY}
  health_check:
    http_path: /api/health

databases:
- name: postgres-db
  engine: PG
  production: true
  version: "12"
```

#### Deploy
```bash
# Push app.yaml to repo root
git add app.yaml && git commit -m "Add DigitalOcean app config" && git push

# Or via CLI:
doctl apps create --spec app.yaml
```

---

### 5. Google Cloud Run (Serverless)

#### Build & Push to Container Registry
```bash
# Enable required APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

# Build & push
gcloud builds submit --tag gcr.io/PROJECT_ID/service-web backend/

# Or manually:
docker tag service-web:latest gcr.io/PROJECT_ID/service-web:latest
docker push gcr.io/PROJECT_ID/service-web:latest
```

#### Deploy to Cloud Run
```bash
gcloud run deploy service-web \
  --image gcr.io/PROJECT_ID/service-web:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 4000 \
  --memory 512Mi \
  --set-env-vars NODE_ENV=production,JWT_SECRET=xxx,STRIPE_SECRET_KEY=yyy,DATABASE_URL=zzz
```

#### Create Cloud SQL PostgreSQL
```bash
# Create instance
gcloud sql instances create service-web-db \
  --database-version=POSTGRES_12 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create marketplace --instance=service-web-db

# Create user
gcloud sql users create postgres --instance=service-web-db --password
```

---

## 📦 Generic VPS Deployment (EC2, Linode, DigitalOcean Droplet)

### Prerequisites
- Ubuntu 20.04+ server with public IP
- SSH access

### Setup Steps

#### 1. Install Docker & Docker Compose
```bash
ssh root@your-server-ip

# Update system
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

#### 2. Clone & Configure
```bash
cd /opt
git clone https://github.com/your-org/service-web.git
cd service-web

# Copy environment template & edit
cp backend/.env.example backend/.env
nano backend/.env
# Set: NODE_ENV=production, JWT_SECRET, DATABASE_URL, STRIPE_SECRET_KEY, etc.

# Copy production compose
cp docker-compose.prod.yml docker-compose.yml
```

#### 3. Setup PostgreSQL (Optional)
```bash
# Option A: Use managed database (AWS RDS, DigitalOcean, etc.)
#   → Set DATABASE_URL in .env to remote connection string

# Option B: Local PostgreSQL in Docker
# Add to docker-compose.yml:
#   db:
#     image: postgres:13
#     environment:
#       POSTGRES_PASSWORD: securepass
#       POSTGRES_DB: marketplace
#     volumes:
#       - postgres_data:/var/lib/postgresql/data
#   volumes:
#     postgres_data:
```

#### 4. Start Services
```bash
# Pull latest image
docker-compose pull

# Start (with logs)
docker-compose up -d
docker-compose logs -f backend

# Verify health
curl http://localhost:4000/api/health
```

#### 5. Setup Reverse Proxy (Nginx)
```bash
# Install Nginx
apt-get install -y nginx

# Create config
cat > /etc/nginx/sites-available/service-web << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/service-web /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
```

#### 6. SSL/TLS (Let's Encrypt)
```bash
# Install Certbot
apt-get install -y certbot python3-certbot-nginx

# Get certificate
certbot certonly --nginx -d your-domain.com

# Auto-renew
systemctl enable certbot.timer && systemctl start certbot.timer
```

#### 7. Setup Auto-Restart & Monitoring
```bash
# Create systemd service
cat > /etc/systemd/system/service-web.service << 'EOF'
[Unit]
Description=Service Web Marketplace
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/docker-compose -f /opt/service-web/docker-compose.yml up -d
ExecStop=/usr/local/bin/docker-compose -f /opt/service-web/docker-compose.yml down
RemainAfterExit=yes
WorkingDirectory=/opt/service-web

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable service-web
systemctl start service-web
```

---

## 🤖 Automated CI/CD with GitHub Actions

The repository includes `.github/workflows/ci-publish.yml` which automatically builds, tests, and publishes Docker images to multiple registries. It also includes conditional deployment steps for various cloud platforms.

### How It Works
- On every push to `main` or `master`, the workflow:
  1. Builds the Docker image with multi-platform support (amd64, arm64)
  2. Runs smoke tests (health check + basic API tests)
  3. Conditionally pushes the image to Docker Hub, AWS ECR, Azure ACR, and Google Container Registry
  4. Conditionally deploys to AWS ECS, Azure Web App, Google Cloud Run, Heroku, and DigitalOcean App Platform
  5. Creates a GitHub release/tag

### Repository Secrets Setup

To enable automatic publishing and deployment, configure these repository secrets:

#### Docker Hub
| Secret Name | Value | Example |
|---|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username | `myusername` |
| `DOCKERHUB_TOKEN` | Personal access token from Docker Hub | `dckr_pat_xxxxx` |

**Get token**: [Docker Hub → Account Settings → Security → New Access Token](https://hub.docker.com/settings/security)

#### AWS ECR (Elastic Container Registry)
| Secret Name | Value | Example |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | IAM user access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_ACCOUNT_ID` | Your AWS account ID (12 digits) | `123456789012` |
| `AWS_REGION` | Target region (e.g., us-east-1) | `us-east-1` |
| `ECS_CLUSTER` | ECS cluster name | `my-marketplace-cluster` |
| `ECS_SERVICE` | ECS service name | `service-web` |

**Create IAM user with ECR/ECS permissions**: Use AWS Policy `AmazonEC2ContainerRegistryFullAccess` and `AmazonECS_FullAccess`.

#### Azure Container Registry (ACR) & App Service
| Secret Name | Value | Example |
|---|---|---|
| `AZURE_CLIENT_ID` | Azure AD service principal client ID | `12345678-1234-1234-1234-123456789012` |
| `AZURE_TENANT_ID` | Azure AD tenant ID | `abcdef12-abcd-abcd-abcd-abcdef123456` |
| `AZURE_CLIENT_SECRET` | Service principal client secret | `clientSecretValue123~` |
| `ACR_NAME` | Azure Container Registry name (without `.azurecr.io`) | `mymarketplaceacr` |
| `AZURE_WEBAPP_NAME` | Azure Web App name | `my-marketplace-app` |
| `AZURE_RESOURCE_GROUP` | Azure resource group name | `my-marketplace-rg` |

**Create service principal**:
```bash
az ad sp create-for-rbac --name "service-web-ci" --role contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/{resource-group}
```

#### Google Cloud (GCR & Cloud Run)
| Secret Name | Value | Example |
|---|---|---|
| `GCP_SA_KEY` | Service account JSON key (entire file content as JSON) | `{"type": "service_account", "project_id": "..."}` |
| `GCP_CLOUD_RUN_SERVICE` | Cloud Run service name | `service-web` |
| `GCP_REGION` | GCP region | `us-central1` |

**Create service account**:
```bash
# Create service account
gcloud iam service-accounts create service-web-ci

# Grant roles (Container Registry, Cloud Run)
gcloud projects add-iam-policy-binding {project-id} \
  --member serviceAccount:service-web-ci@{project-id}.iam.gserviceaccount.com \
  --role roles/storage.admin

gcloud projects add-iam-policy-binding {project-id} \
  --member serviceAccount:service-web-ci@{project-id}.iam.gserviceaccount.com \
  --role roles/run.admin

# Create and download key
gcloud iam service-accounts keys create key.json \
  --iam-account=service-web-ci@{project-id}.iam.gserviceaccount.com
```

Then paste the entire `key.json` content as the `GCP_SA_KEY` secret.

#### Heroku
| Secret Name | Value | Example |
|---|---|---|
| `HEROKU_API_KEY` | Heroku API key (account-level) | `12345678-1234-1234-1234-123456789012` |
| `HEROKU_APP_NAME` | Heroku app name | `my-marketplace` |

**Get API key**: [Heroku Account Settings → API Key](https://dashboard.heroku.com/account/applications)

#### DigitalOcean App Platform
| Secret Name | Value | Example |
|---|---|---|
| `DO_API_TOKEN` | DigitalOcean API token | `dop_v1_xxxxx` |
| `DO_APP_ID` | DigitalOcean App ID | `12345678-1234-1234-1234-123456789012` |

**Get API token**: [DigitalOcean API Tokens](https://cloud.digitalocean.com/account/api/tokens)

**Get app ID**: Run `doctl apps list` and copy the app's ID.

### Setting Secrets in GitHub

Go to your repository on GitHub:
1. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Add each secret name and value
3. Secrets are encrypted and only available to GitHub Actions workflows

### Example: Minimal Setup for Docker Hub

To get started quickly, add just these two secrets:
```
DOCKERHUB_USERNAME=your_docker_username
DOCKERHUB_TOKEN=your_docker_hub_token
```

The workflow will build and push to Docker Hub on every push to `main`.

### Example: Full AWS Deployment

To enable automatic ECS deployment:
1. Add AWS secrets (see AWS section above)
2. Create an ECS cluster and service (or use the task definition in docs)
3. Push to `main` → CI builds, tests, pushes to ECR, and updates ECS service

---

## 🔒 Production Checklist

Before going live:

- [ ] **Secrets Management**
  - [ ] Use platform secret manager (AWS Secrets Manager, Azure Key Vault, etc.)
  - [ ] Rotate JWT_SECRET and admin credentials
  - [ ] Never commit `.env` to git

- [ ] **Database**
  - [ ] Migrate from `db.json` to PostgreSQL
  - [ ] Setup automated backups
  - [ ] Enable encryption at rest
  - [ ] Setup read replicas for scale

- [ ] **Networking**
  - [ ] Enable HTTPS/SSL (Let's Encrypt or managed cert)
  - [ ] Configure CORS for allowed origins
  - [ ] Setup WAF (Web Application Firewall)
  - [ ] Enable DDoS protection

- [ ] **Monitoring & Logging**
  - [ ] Setup CloudWatch/Application Insights
  - [ ] Configure error alerting (PagerDuty, Slack)
  - [ ] Enable audit logging
  - [ ] Setup uptime monitoring

- [ ] **Performance**
  - [ ] Enable Redis caching for analytics
  - [ ] Setup CDN for static assets
  - [ ] Configure auto-scaling policies
  - [ ] Load test before launch

- [ ] **Compliance**
  - [ ] Review terms of service
  - [ ] Setup payment compliance (PCI-DSS for Stripe)
  - [ ] Document data retention policies
  - [ ] Add privacy policy & GDPR compliance

---

## 📞 Troubleshooting

### Service won't start
```bash
# Check logs
docker-compose logs backend

# Common issues:
# - Port 4000 in use: kill existing process or use different port
# - Database connection error: verify DATABASE_URL and network access
# - Out of memory: increase memory limit in docker-compose.yml
```

### High CPU/Memory usage
```bash
# Monitor resources
docker stats

# Optimize:
# - Use Redis for caching
# - Enable pagination on list endpoints
# - Add database indexes
# - Horizontal scaling (multiple instances behind load balancer)
```

### Database migration failed
```bash
# Rollback and retry
npm run migrate:rollback
npm run migrate

# Check migration logs
cat logs/migrate.log
```

---

## 📚 Additional Resources

- [Docker Docs](https://docs.docker.com)
- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [PostgreSQL in Production](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Stripe Deployment Checklist](https://stripe.com/docs/keys)
