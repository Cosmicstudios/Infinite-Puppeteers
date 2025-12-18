# ✅ Heroku Deployment Checklist - Action Items

**Estimated Time:** 15 minutes  
**Goal:** Get your app live on Heroku with automatic deployments

---

## 📋 Checklist

### Phase 1: Create Heroku App (2 minutes)
- [ ] Go to [dashboard.heroku.com](https://dashboard.heroku.com)
- [ ] Click: **New → Create new app**
- [ ] Enter name: **my-service-web-marketplace** (or your choice)
- [ ] Select region: **United States**
- [ ] Click: **Create app**
- [ ] **Note the URL** (you'll see it at the top)

### Phase 2: Get API Key (1 minute)
- [ ] In Heroku Dashboard, click your **profile icon** (top right)
- [ ] Click: **Account settings**
- [ ] Scroll to: **API Key**
- [ ] Click: **Reveal**
- [ ] **Copy entire key** (keep this safe!)

### Phase 3: Configure GitHub Secrets (2 minutes)
- [ ] Go to your GitHub repository (or create one now)
- [ ] Click: **Settings**
- [ ] In sidebar: **Secrets and variables → Actions**
- [ ] Click: **New repository secret**
- [ ] **Secret 1:**
  - Name: `HEROKU_API_KEY`
  - Value: (paste your API key)
  - Click: **Add secret**
- [ ] **Secret 2:**
  - Name: `HEROKU_APP_NAME`
  - Value: `my-service-web-marketplace`
  - Click: **Add secret**

### Phase 4: Initialize Git & Push (5 minutes)
- [ ] Open PowerShell in project directory: `cd 'e:\oo pupteers\SERVICE WEB'`
- [ ] Run:
  ```powershell
  git remote add origin https://github.com/YOUR_USERNAME/service-web.git
  git branch -M main
  git push -u origin main
  ```
  *(Replace `YOUR_USERNAME` with your actual GitHub username)*

### Phase 5: Monitor Deployment (5 minutes)
- [ ] Go to your GitHub repo
- [ ] Click: **Actions** tab
- [ ] Watch the workflow run (green checkmark = success)
- [ ] Takes 2-5 minutes for deployment

### Phase 6: Test Live App (2 minutes)
- [ ] Once green checkmark appears, go to:
  ```
  https://my-service-web-marketplace.herokuapp.com/api/health
  ```
- [ ] Should see: `{"status":"ok"}`
- [ ] 🎉 **You're live!**

---

## 🔑 Required Secrets (Verify All Set)

Before pushing, confirm GitHub has these:

```
✓ HEROKU_API_KEY     = (your 40+ character API key)
✓ HEROKU_APP_NAME    = my-service-web-marketplace
```

**To verify:**
1. Go to GitHub repo Settings
2. Secrets and variables → Actions
3. Should see both secrets listed ✓

---

## 🌐 Your Live App URLs

Once deployed:

```
Web Interface:    https://my-service-web-marketplace.herokuapp.com
Health Check:     https://my-service-web-marketplace.herokuapp.com/api/health
API Base:         https://my-service-web-marketplace.herokuapp.com/api
```

---

## 🎯 What Happens Automatically

When you push to GitHub:

1. ✅ GitHub Actions workflow triggers
2. ✅ Docker image builds
3. ✅ Tests run
4. ✅ Image pushed to Heroku
5. ✅ Heroku deploys new version
6. ✅ App restarts with new code
7. ✅ Live in 2-5 minutes

**Zero manual deployment steps!**

---

## 💡 Demo Accounts (Already in App)

Login with these credentials:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@example.com` | `admin` |
| Vendor | `vendor@example.com` | `vendor` |
| Buyer | `buyer@example.com` | `buyer` |

⚠️ **Change these immediately for production!**

---

## ❌ Common Issues

### "Deployment failed" in GitHub Actions
- ✓ Check both secrets are set (HEROKU_API_KEY, HEROKU_APP_NAME)
- ✓ Verify API key is valid (hasn't expired)
- ✓ Check GitHub Actions logs for specific error

### "App won't start / 503 error"
- ✓ Check Heroku logs: `heroku logs --tail -a my-service-web-marketplace`
- ✓ Wait 5 minutes (Heroku needs startup time)
- ✓ Restart dyno: `heroku restart -a my-service-web-marketplace`

### "Port error / Can't connect"
- ✓ App should use `PORT=process.env.PORT || 4000`
- ✓ Heroku assigns PORT automatically (shouldn't hard-code 4000)

---

## 📊 Next Steps After Deployment

### View Logs
```powershell
heroku logs --tail -a my-service-web-marketplace
```

### Check App Status
```powershell
heroku ps -a my-service-web-marketplace
```

### Future Deployments
```powershell
# Just push to GitHub - auto-deploys!
git add .
git commit -m "Your changes"
git push origin main
# → GitHub Actions builds & deploys automatically
```

---

## ✨ Summary

**You're 15 minutes away from a live, auto-deploying production app!**

1. Create Heroku app (2 min)
2. Get API key (1 min)
3. Add GitHub secrets (2 min)
4. Push code (5 min)
5. Watch deployment (5 min)

**Total: ~15 minutes to production** ✓

---

**Need help?** See `HEROKU_FAST_TRACK.md` for detailed steps with screenshots and troubleshooting.
