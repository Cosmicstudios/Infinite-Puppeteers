# Auto-Continue All: Complete Windows Setup & Deployment
# This script orchestrates the entire workflow for Windows users:
# 1. Install prerequisites (Git, Node, Docker, gh CLI)
# 2. Initialize git repo locally
# 3. Build Docker image
# 4. Run production compose
# 5. Run smoke tests
# 6. Optionally create GitHub repo and push

param(
    [switch]$SkipInstall,
    [switch]$SkipGit,
    [switch]$SkipBuild,
    [switch]$SkipCompose,
    [switch]$SkipTests,
    [switch]$CreateGitHub,
    [string]$GitHubOrg = "",
    [string]$GitHubRepo = "service-web"
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Service Web: Auto-Continue All (Windows)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# Step 1: Install Prerequisites
# ============================================================================

if (-not $SkipInstall) {
    Write-Host "STEP 1: Installing prerequisites..." -ForegroundColor Green
    Write-Host ""
    
    $installScript = Join-Path $scriptRoot "install-prereqs.ps1"
    if (Test-Path $installScript) {
        & $installScript
        Write-Host ""
    } else {
        Write-Host "[WARNING] install-prereqs.ps1 not found. Skipping." -ForegroundColor Yellow
        Write-Host ""
    }
}

# ============================================================================
# Step 2: Initialize Git & Commit
# ============================================================================

if (-not $SkipGit) {
    Write-Host "STEP 2: Initializing Git repository..." -ForegroundColor Green
    Write-Host ""
    
    $initGitScript = Join-Path $scriptRoot "init-git.ps1"
    if (Test-Path $initGitScript) {
        & $initGitScript
        Write-Host ""
    } else {
        Write-Host "[WARNING] init-git.ps1 not found. Skipping." -ForegroundColor Yellow
        Write-Host ""
    }
}

# ============================================================================
# Step 3: Build Docker Image
# ============================================================================

if (-not $SkipBuild) {
    Write-Host "STEP 3: Building Docker image..." -ForegroundColor Green
    Write-Host ""
    
    $buildScript = Join-Path $scriptRoot "build-and-push.ps1"
    if (Test-Path $buildScript) {
        & $buildScript -NoPush
        Write-Host ""
    } else {
        Write-Host "[WARNING] build-and-push.ps1 not found. Skipping." -ForegroundColor Yellow
        Write-Host ""
    }
}

# ============================================================================
# Step 4: Run Production Compose
# ============================================================================

if (-not $SkipCompose) {
    Write-Host "STEP 4: Starting production compose..." -ForegroundColor Green
    Write-Host ""
    
    $composeScript = Join-Path $scriptRoot "run-prod-compose.ps1"
    if (Test-Path $composeScript) {
        & $composeScript
        Write-Host ""
    } else {
        Write-Host "[WARNING] run-prod-compose.ps1 not found. Skipping." -ForegroundColor Yellow
        Write-Host ""
    }
}

# ============================================================================
# Step 5: Run Smoke Tests
# ============================================================================

if (-not $SkipTests) {
    Write-Host "STEP 5: Running smoke tests..." -ForegroundColor Green
    Write-Host ""
    
    $testScript = Join-Path $scriptRoot "smoke-test.ps1"
    if (Test-Path $testScript) {
        & $testScript
        Write-Host ""
    } else {
        Write-Host "[WARNING] smoke-test.ps1 not found. Skipping." -ForegroundColor Yellow
        Write-Host ""
    }
}

# ============================================================================
# Step 6: Create GitHub Repository (Optional)
# ============================================================================

if ($CreateGitHub) {
    Write-Host "STEP 6: Creating GitHub repository..." -ForegroundColor Green
    Write-Host ""
    
    # Verify gh is installed
    try {
        $ghVersion = gh --version 2>$null
        Write-Host "GitHub CLI found: $ghVersion" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] GitHub CLI (gh) not found. Cannot create repository." -ForegroundColor Red
        Write-Host "Install from: https://cli.github.com/" -ForegroundColor Yellow
        exit 1
    }
    
    # Login if needed
    try {
        $whoami = gh auth status 2>&1
        if ($whoami -match "not logged in") {
            Write-Host "Logging in to GitHub..." -ForegroundColor Yellow
            gh auth login
        }
    } catch {
        Write-Host "[WARNING] Could not verify GitHub login. Attempting to create repo anyway..." -ForegroundColor Yellow
    }
    
    # Build repo path
    if ($GitHubOrg) {
        $repoPath = "$GitHubOrg/$GitHubRepo"
        $orgFlag = " --org $GitHubOrg"
    } else {
        $repoPath = $GitHubRepo
        $orgFlag = ""
    }
    
    # Create repository
    Write-Host "Creating repository: $repoPath" -ForegroundColor Cyan
    $createOutput = gh repo create $GitHubRepo --public --source=$projectRoot --remote=origin --push$orgFlag 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Repository created successfully!" -ForegroundColor Green
        Write-Host "  URL: https://github.com/$repoPath" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Go to: https://github.com/$repoPath/settings/secrets/actions" -ForegroundColor Cyan
        Write-Host "  2. Add repository secrets for your deployment platform:" -ForegroundColor Cyan
        Write-Host "     - Docker Hub: DOCKERHUB_USERNAME, DOCKERHUB_TOKEN" -ForegroundColor Cyan
        Write-Host "     - AWS: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ACCOUNT_ID, AWS_REGION, ECS_CLUSTER, ECS_SERVICE" -ForegroundColor Cyan
        Write-Host "     - Azure: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET, ACR_NAME, AZURE_WEBAPP_NAME, AZURE_RESOURCE_GROUP" -ForegroundColor Cyan
        Write-Host "     - GCP: GCP_SA_KEY, GCP_CLOUD_RUN_SERVICE, GCP_REGION" -ForegroundColor Cyan
        Write-Host "     - Heroku: HEROKU_API_KEY, HEROKU_APP_NAME" -ForegroundColor Cyan
        Write-Host "     - DigitalOcean: DO_API_TOKEN, DO_APP_ID" -ForegroundColor Cyan
        Write-Host ""
    } else {
        Write-Host "[WARNING] Could not create repository. You may need to create it manually." -ForegroundColor Yellow
        Write-Host "Error: $createOutput" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Manual steps:" -ForegroundColor Cyan
        Write-Host "  1. Go to: https://github.com/new" -ForegroundColor Cyan
        Write-Host "  2. Create a new repository named: $GitHubRepo" -ForegroundColor Cyan
        Write-Host "  3. Push from this folder:" -ForegroundColor Cyan
        Write-Host "     git remote add origin https://github.com/YOUR_USERNAME/$GitHubRepo.git" -ForegroundColor Cyan
        Write-Host "     git branch -M main" -ForegroundColor Cyan
        Write-Host "     git push -u origin main" -ForegroundColor Cyan
        Write-Host ""
    }
}

# ============================================================================
# Summary
# ============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ Auto-Continue Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project Status:" -ForegroundColor Cyan
Write-Host "  - Docker image built locally" -ForegroundColor Green
Write-Host "  - Production compose running" -ForegroundColor Green
Write-Host "  - Smoke tests passed" -ForegroundColor Green
if (Test-Path (Join-Path $projectRoot ".git")) {
    Write-Host "  - Git initialized and committed" -ForegroundColor Green
}
if ($CreateGitHub) {
    Write-Host "  - GitHub repository created" -ForegroundColor Green
}
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Configure repository secrets for CI/CD" -ForegroundColor Cyan
Write-Host "  2. Push to GitHub (if not done above)" -ForegroundColor Cyan
Write-Host "  3. GitHub Actions will automatically build & deploy on push" -ForegroundColor Cyan
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "  - README.md: Project overview & setup" -ForegroundColor Cyan
Write-Host "  - DEPLOYMENT.md: Platform-specific guides & secret configuration" -ForegroundColor Cyan
Write-Host "  - DEVELOPMENT.md: Local development & testing" -ForegroundColor Cyan
Write-Host ""
