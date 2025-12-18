# 🚀 Heroku Deployment - Fast Track (30 minutes)

**Status:** Heroku account created ✓  
**Next:** Deploy your app in 4 steps

---

## 📋 Steps 1-4: Complete Deployment

### STEP 1: Create Heroku App (2 minutes)

**Option A: Using Heroku CLI (Recommended)**
```powershell
# Make sure you're logged in to Heroku
heroku auth:login

# Create your app (choose a unique name)
heroku create my-service-web-marketplace

# Note the URL displayed (e.g., https://my-service-web-marketplace.herokuapp.com)
```

**Option B: Using Heroku Web Dashboard**
1. Log in to [dashboard.heroku.com](https://dashboard.heroku.com)
2. Click: **New → Create new app**
3. Enter app name: `my-service-web-marketplace` (must be unique)
4. Select region: **United States**
5. Click: **Create app**

**Note:** Replace `my-service-web-marketplace` with your chosen name.

---

### STEP 2: Get Your Heroku API Key (1 minute)

1. Log in to [Heroku Dashboard](https://dashboard.heroku.com)
2. Click your **profile icon** (top right)
3. Click **Account settings**
4. Scroll to: **API Key**
5. Click: **Reveal**
6. **Copy** the entire key (it's long)

**Keep it ready for Step 3.**

---

### STEP 3: Add GitHub Repository Secrets (2 minutes)

1. Go to your GitHub repository
2. Click: **Settings**
3. In left sidebar, click: **Secrets and variables → Actions**
4. Click: **New repository secret**

**Add Secret #1:**
- Name: `HEROKU_API_KEY`
- Value: (paste the API key from Step 2)
- Click: **Add secret**

**Add Secret #2:**
- Name: `HEROKU_APP_NAME`
- Value: `my-service-web-marketplace` (the name from Step 1)
- Click: **Add secret**

✅ Both secrets now configured.

---

### STEP 4: Push Code to GitHub & Deploy (5 minutes)

Make sure you're in your project directory, then:

```powershell
cd 'e:\oo pupteers\SERVICE WEB'

# Initialize git if not already done (auto-all-windows.ps1 does this)
git init
git add .
git commit -m "Initial commit: Service Web marketplace with Heroku deployment"

# Add GitHub remote (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/service-web.git
git branch -M main
git push -u origin main
```

**What happens automatically:**
1. Push triggers GitHub Actions workflow
2. Docker image is built
3. Tests run
4. **CI/CD attempts to deploy to Heroku**
5. App goes live at: `https://my-service-web-marketplace.herokuapp.com`

⏱️ **Takes 3-5 minutes total**

---

## ✅ Verification (5 minutes)

### Check Deployment Progress

**Method 1: GitHub Actions**
1. Go to your GitHub repo
2. Click: **Actions** tab
3. Watch the workflow run (should take 2-5 minutes)
4. Look for green checkmark ✅ = success

**Method 2: Heroku Dashboard**
1. Go to [dashboard.heroku.com](https://dashboard.heroku.com)
2. Click your app: `my-service-web-marketplace`
3. Click: **Activity** tab
4. Watch deployment progress
5. When complete, green status = success

---

## 🌐 Access Your Live App

Once deployment succeeds:

```
https://my-service-web-marketplace.herokuapp.com
```

Or use Heroku CLI:
```powershell
heroku open -a my-service-web-marketplace
```

**Test the API:**
```powershell
curl https://my-service-web-marketplace.herokuapp.com/api/health
# Should return: {"status":"ok"}
```

---

## 🔐 Default Demo Accounts

Your app includes seeded demo data:

| Account | Email | Password |
|---------|-------|----------|
| Admin | `admin@example.com` | `admin` |
| Vendor | `vendor@example.com` | `vendor` |
| Buyer | `buyer@example.com` | `buyer` |

⚠️ **IMPORTANT:** Change admin password immediately in production!

---

## 📊 Heroku Dyno (Server) Management

### View Current Status
```powershell
heroku ps -a my-service-web-marketplace
```

### Scale Up (for more traffic)
```powershell
# Standard 1X (recommended): $25/month
heroku dyno:type Standard-1X -a my-service-web-marketplace

# Free tier (sleeps after 30 min): $0/month
heroku dyno:type free -a my-service-web-marketplace
```

### Check Logs
```powershell
heroku logs --tail -a my-service-web-marketplace
```

---

## 🗄️ Database Setup (Optional but Recommended)

**Add PostgreSQL database:**

```powershell
# Create database (standard-0: $50/month)
heroku addons:create heroku-postgresql:standard-0 -a my-service-web-marketplace

# Or free tier:
heroku addons:create heroku-postgresql:hobby-dev -a my-service-web-marketplace

# Get connection string
heroku config:get DATABASE_URL -a my-service-web-marketplace
```

**Configure your app to use it:**
1. Add to your app's environment: `DATABASE_URL` (Heroku sets this automatically)
2. Run migrations (if needed):
   ```powershell
   heroku run "npm run migrate" -a my-service-web-marketplace
   ```

---

## 🎯 Common Issues & Fixes

### "App won't start / keeps crashing"
```powershell
# Check logs
heroku logs --tail -a my-service-web-marketplace

# Redeploy
git push heroku main
```

### "Deployment stuck or timeout"
- Check GitHub Actions logs (Actions tab)
- Verify both secrets are set correctly
- Try rerunning the workflow (Actions → Re-run all jobs)

### "Can't access app / 404 error"
- Wait 5 minutes after deployment (Heroku needs time to initialize)
- Check app is running: `heroku ps -a my-service-web-marketplace`
- Check logs: `heroku logs --tail -a my-service-web-marketplace`

### "Port issues"
- Heroku assigns PORT automatically
- App should use: `PORT=process.env.PORT || 4000`
- Check in `backend/index.js` line 1: `const PORT = process.env.PORT || 4000;`

---

## 📈 Monitoring & Scaling

### View Metrics
```powershell
heroku metrics -a my-service-web-marketplace
```

### Enable Auto-scaling (Professional)
```powershell
# Only available on Professional dyno
heroku features:enable autoscaling -a my-service-web-marketplace
```

### View Resource Usage
```powershell
heroku apps:info -a my-service-web-marketplace
```

---

## 🚀 Next Deployments

After initial deployment, every time you push to GitHub:

```powershell
git add .
git commit -m "Feature: your changes"
git push origin main
# → GitHub Actions automatically builds and deploys!
```

**No additional commands needed!** ✓

---

## ✨ What You Now Have

✅ Live production app at: `https://my-service-web-marketplace.herokuapp.com`  
✅ Automatic deployments on push  
✅ Managed database (optional)  
✅ Auto-scaling ready  
✅ Logs and monitoring  
✅ Rollback capability  

---

## 📋 Quick Checklist

- [ ] Heroku account created ✓
- [ ] Heroku app created
- [ ] Heroku API key obtained
- [ ] GitHub secrets configured (HEROKU_API_KEY, HEROKU_APP_NAME)
- [ ] Code pushed to GitHub
- [ ] GitHub Actions workflow passed
- [ ] App live at Heroku URL
- [ ] Tested health endpoint
- [ ] Changed admin password (for production)

---

## 💡 Tip: Keep It Updated

Your CI/CD pipeline is now live. To deploy new features:

```powershell
# Make changes
# ... edit files ...

# Commit and push
git add .
git commit -m "Feature: description"
git push origin main

# Watch it deploy automatically in GitHub Actions!
```

---

**⏱️ Estimated Total Time: 15-20 minutes**  
**🎉 Result: Production app live with auto-deployments!**

Need help? Check the logs or see `DEPLOYMENT.md` for more details.
