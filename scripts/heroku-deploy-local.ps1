<#
heroku-deploy-local.ps1

Usage (PowerShell, run from repo root):

# Set env vars first (do NOT paste secrets into chat)
# Example (run these in your shell before running the script):
#    $env:HEROKU_API_KEY = '...'
#    $env:HEROKU_APP_NAME = 'my-service-web-marketplace'
#    $env:CLOUDFLARE_API_TOKEN = '...'

# Then run:
#    .\scripts\heroku-deploy-local.ps1 -ProvisionPostgres -Domain 'infinit3.cc'

This script will:
  - Check required CLIs (docker, heroku)
  - Login to Heroku container registry
  - Build backend Docker image and push to Heroku registry
  - Release image to Heroku
  - Optionally provision Heroku Postgres
  - Optionally call scripts/auto-deploy-domain.ps1 to add domain & Cloudflare records
  - Tail Heroku logs and poll health endpoint

Note: run locally. Do not place secrets in this script.
#>

param(
  [switch]$ProvisionPostgres = $false,
  [string]$Domain = '',
  [int]$PollIntervalSec = 5,
  [int]$PollMax = 60
)

$ErrorActionPreference = 'Stop'

function Assert-Env([string]$name) {
  if (-not (Get-Variable -Name env:$name -Scope Global -ErrorAction SilentlyContinue)) {
    Write-Error "Environment variable $name is not set. Export it before running the script."; exit 1
  }
}

Assert-Env 'HEROKU_API_KEY'
Assert-Env 'HEROKU_APP_NAME'

$HerokuApiKey = $env:HEROKU_API_KEY
$HerokuApp = $env:HEROKU_APP_NAME

Write-Host "Heroku app: $HerokuApp" -ForegroundColor Cyan

# Check CLIs
foreach ($cmd in @('docker','heroku')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Error "$cmd not found on PATH. Install it and retry."; exit 1
  }
}

Write-Host "Logging in to Heroku Container Registry..." -ForegroundColor Green
try {
  heroku container:login 2>&1 | ForEach-Object { Write-Host $_ }
} catch {
  Write-Error "heroku container login failed: $($_.Exception.Message)"; exit 1
}

$imageTag = "registry.heroku.com/$HerokuApp/web:latest"
Write-Host "Building Docker image for backend..." -ForegroundColor Green
docker build -f backend/Dockerfile -t $imageTag backend/
if ($LASTEXITCODE -ne 0) { Write-Error "Docker build failed"; exit 1 }

Write-Host "Pushing image to Heroku registry..." -ForegroundColor Green
docker push $imageTag
if ($LASTEXITCODE -ne 0) { Write-Error "Docker push failed"; exit 1 }

Write-Host "Releasing image on Heroku..." -ForegroundColor Green
try {
  heroku container:release web -a $HerokuApp 2>&1 | ForEach-Object { Write-Host $_ }
} catch {
  Write-Error "heroku release failed: $($_.Exception.Message)"; exit 1
}

if ($ProvisionPostgres) {
  Write-Host "Provisioning Heroku Postgres (hobby-dev)" -ForegroundColor Green
  try {
    heroku addons:create heroku-postgresql:hobby-dev -a $HerokuApp 2>&1 | ForEach-Object { Write-Host $_ }
  } catch {
    Write-Warning "Provisioning Postgres failed or already exists: $($_.Exception.Message)"
  }
}

if ($Domain) {
  $autoScript = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'auto-deploy-domain.ps1'
  if (Test-Path $autoScript) {
    Write-Host "Running domain automation for $Domain" -ForegroundColor Green
    & $autoScript -Domain $Domain -HerokuApiKey $HerokuApiKey -HerokuApp $HerokuApp -CloudflareToken $env:CLOUDFLARE_API_TOKEN
  } else {
    Write-Warning "Domain script not found: $autoScript";
  }
}

Write-Host "Tailing Heroku logs (press Ctrl+C to stop)..." -ForegroundColor Cyan
Start-Process -NoNewWindow -FilePath 'heroku' -ArgumentList "logs --tail -a $HerokuApp"

# Poll health endpoint
if ($Domain) {
  $healthUrl = "https://www.$Domain/api/health"
} else {
  $healthUrl = "https://$HerokuApp.herokuapp.com/api/health"
}

Write-Host "Polling health endpoint: $healthUrl" -ForegroundColor Cyan
$attempt = 0
while ($attempt -lt $PollMax) {
  $attempt++
  try {
    $resp = Invoke-RestMethod -Uri $healthUrl -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    Write-Host "Health OK: $($resp | ConvertTo-Json -Depth 2)" -ForegroundColor Green
    break
  } catch {
    Write-Host "Health check not ready (attempt $attempt): $($_.Exception.Message)" -ForegroundColor Yellow
    Start-Sleep -Seconds $PollIntervalSec
  }
}

if ($attempt -ge $PollMax) { Write-Warning "Health check did not become healthy after $($PollMax * $PollIntervalSec) seconds." }

Write-Host "Deployment script finished. Check Heroku dashboard and logs for details." -ForegroundColor Cyan
