Scripts/README

This folder contains PowerShell helper scripts to automate setup, initialization, building, and deployment for the Service Web marketplace.

## Files

- **`auto-all-windows.ps1`** — **Master script** that orchestrates the entire workflow (install, git init, build, compose, test, optionally create GitHub repo). Recommended for new setups.
- `install-prereqs.ps1` — Install Git, GitHub CLI, Node.js LTS, Docker Desktop, VS Code (via winget). Run as Administrator.
- `init-git.ps1` — Initialize local git repo, create initial commit, and optionally create/push GitHub repo using `gh`.
- `build-and-push.ps1` — Build Docker image from `backend/Dockerfile` and optionally push to registry.
- `run-prod-compose.ps1` — Start services with `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`.
- `smoke-test.ps1` — Basic API health checks.

## Quick Start (Recommended: Use Master Script)

The easiest way to set everything up is to run the master script. Open PowerShell **as Administrator** and run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
cd path\to\SERVICE WEB
.\scripts\auto-all-windows.ps1
```

This will:
1. Install all prerequisites (Git, Node.js, Docker Desktop, GitHub CLI)
2. Initialize git repo locally
3. Build Docker image
4. Start production services with docker-compose
5. Run smoke tests to verify everything works

### With GitHub Repository Creation

If you want the script to automatically create a GitHub repository and push your code:

```powershell
.\scripts\auto-all-windows.ps1 -CreateGitHub -GitHubOrg "your-org" -GitHubRepo "service-web"
```

Or for a personal repository (no org):

```powershell
.\scripts\auto-all-windows.ps1 -CreateGitHub
```

## Manual Step-by-Step (Advanced)

If you prefer to run scripts individually:

1. **Install prerequisites** (run as Administrator):

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.\scripts\install-prereqs.ps1
```

2. **Open a new PowerShell** to pick up PATH changes, then **initialize git**:

```powershell
.\scripts\init-git.ps1 -RepoName "service-web" -Visibility public
```

3. **Build image locally** (example):

```powershell
.\scripts\build-and-push.ps1 -ImageName your-dockerhub-username/service-web -Tag v1.0.0
```

4. **Start production compose**:

```powershell
.\scripts\run-prod-compose.ps1
```

5. **Run smoke tests**:

```powershell
.\scripts\smoke-test.ps1 -BaseUrl http://localhost:4000
```

## Skipping Steps

You can skip any step in the master script using switch flags:

```powershell
# Skip prerequisites installation (assuming already installed)
.\scripts\auto-all-windows.ps1 -SkipInstall

# Skip git initialization
.\scripts\auto-all-windows.ps1 -SkipGit

# Skip Docker build
.\scripts\auto-all-windows.ps1 -SkipBuild

# Skip docker-compose startup
.\scripts\auto-all-windows.ps1 -SkipCompose

# Skip smoke tests
.\scripts\auto-all-windows.ps1 -SkipTests

# Combine multiple skips
.\scripts\auto-all-windows.ps1 -SkipInstall -SkipGit
```

## Requirements & Notes

- **Windows 10/11** with PowerShell 5.0+
- **`winget`** must be present (default on Windows 11; Windows 10 requires [App Installer](https://apps.microsoft.com/store/detail/app-installer/9NBLGGH4NNS1))
- **Administrator access** required for `install-prereqs.ps1` (to install via `winget`)
- **Docker Desktop** requires WSL2 or Hyper-V; follow Docker Desktop installer prompts
- **`gh` (GitHub CLI)** needed to create repositories; login with `gh auth login` before using `-CreateGitHub`

## CI/CD & Automated Deployments

Once your code is pushed to GitHub with repository secrets configured, GitHub Actions will automatically:
- Build and test your Docker image on every push to `main` or `master`
- Push images to your configured registries (Docker Hub, AWS ECR, Azure ACR, Google Container Registry)
- Deploy to your configured platforms (AWS ECS, Azure Web App, Google Cloud Run, Heroku, DigitalOcean App Platform)

See `../DEPLOYMENT.md` for detailed secret configuration for each platform.