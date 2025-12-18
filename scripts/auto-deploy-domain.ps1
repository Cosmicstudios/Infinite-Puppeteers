<#
auto-deploy-domain.ps1

Automates these tasks (run locally on Windows PowerShell):
  1. Add `www.<domain>` to a Heroku app via the Heroku Platform API
  2. Create DNS CNAME records in Cloudflare (DNS-only) pointing to Heroku's DNS target
  3. Optionally provision Heroku Postgres (hobby-dev)
  4. Poll DNS + Heroku health endpoint until the site responds

Prerequisites (install locally):
  - PowerShell 5.1+ (Windows)
  - Set environment variables: `HEROKU_API_KEY`, `HEROKU_APP_NAME`, `CLOUDFLARE_API_TOKEN`
  - (Optional) `GITHUB_TOKEN` if you want to trigger workflows afterwards

Usage example:
  # Set env vars first (do NOT paste secrets into shared chat)
  $env:HEROKU_API_KEY = '...'
  $env:HEROKU_APP_NAME = 'my-service-web-marketplace'
  $env:CLOUDFLARE_API_TOKEN = '...'

  # Run the script (defaults to infinit3.cc)
  .\scripts\auto-deploy-domain.ps1

  # Or pass domain explicitly and provision Postgres
  .\scripts\auto-deploy-domain.ps1 -Domain 'infinit3.cc' -ProvisionPostgres

#>

param(
  [string]$Domain = 'infinit3.cc',
  [string]$HerokuApp = $env:HEROKU_APP_NAME,
  [string]$HerokuApiKey = $env:HEROKU_API_KEY,
  [string]$CloudflareToken = $env:CLOUDFLARE_API_TOKEN,
  [switch]$ProvisionPostgres = $false,
  [int]$PollSeconds = 5,
  [int]$MaxPollAttempts = 80
)

$ErrorActionPreference = 'Stop'

function Assert-Var([string]$name, [string]$value) {
  if (-not $value) { Write-Error "$name is required. Set it in the environment or pass as a parameter."; exit 1 }
}

Assert-Var 'HEROKU_API_KEY (or -HerokuApiKey)' $HerokuApiKey
Assert-Var 'HEROKU_APP_NAME (or -HerokuApp)' $HerokuApp
Assert-Var 'CLOUDFLARE_API_TOKEN (or -CloudflareToken)' $CloudflareToken

Write-Host "Domain: $Domain" -ForegroundColor Cyan
Write-Host "Heroku app: $HerokuApp" -ForegroundColor Cyan

# ---------------------------
# 1) Add domain to Heroku
# ---------------------------
Write-Host "Adding domain www.$Domain to Heroku app $HerokuApp..." -ForegroundColor Green

$herokuHeaders = @{
  "Accept" = "application/vnd.heroku+json; version=3"
  "Authorization" = "Bearer $HerokuApiKey"
  "Content-Type" = "application/json"
}

$body = @{ hostname = "www.$Domain" } | ConvertTo-Json
try {
  $resp = Invoke-RestMethod -Uri "https://api.heroku.com/apps/$HerokuApp/domains" -Method Post -Headers $herokuHeaders -Body $body -ErrorAction Stop
} catch {
  Write-Error "Failed to add domain to Heroku: $($_.Exception.Message)"
  exit 1
}

# Heroku returns either `cname` or `sni_endpoint`/`dns_target` depending on stack
$dnsTarget = $resp.cname
if (-not $dnsTarget) { $dnsTarget = $resp.sni_endpoint }
if (-not $dnsTarget) { $dnsTarget = $resp.dns_target }
if (-not $dnsTarget) { Write-Error "Could not determine Heroku DNS target from response: $($resp | ConvertTo-Json -Depth 4)"; exit 1 }

Write-Host "Heroku DNS target: $dnsTarget" -ForegroundColor Yellow

# ---------------------------
# 2) Configure Cloudflare DNS
# ---------------------------
Write-Host "Configuring Cloudflare DNS for zone: $Domain" -ForegroundColor Green

$cfHeaders = @{ 'Authorization' = "Bearer $CloudflareToken"; 'Content-Type' = 'application/json' }

try {
  $zoneResp = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones?name=$Domain" -Method Get -Headers $cfHeaders -ErrorAction Stop
} catch {
  Write-Error "Failed to query Cloudflare zones: $($_.Exception.Message)"; exit 1
}

if (-not $zoneResp.success -or -not $zoneResp.result -or $zoneResp.result.Count -lt 1) {
  Write-Error "Could not find Cloudflare zone for $Domain. Make sure the domain is added to Cloudflare and DNS is active. Response: $($zoneResp | ConvertTo-Json -Depth 2)"; exit 1
}

$zoneId = $zoneResp.result[0].id
Write-Host "Cloudflare zone id: $zoneId" -ForegroundColor Yellow

# Create 'www' CNAME record -> Heroku DNS target
$cnameBody = @{ type = 'CNAME'; name = 'www'; content = $dnsTarget; ttl = 120; proxied = $false } | ConvertTo-Json
try {
  $createResp = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records" -Method Post -Headers $cfHeaders -Body $cnameBody -ErrorAction Stop
  if (-not $createResp.success) { Write-Error "Cloudflare CNAME creation failed: $($createResp | ConvertTo-Json -Depth 2)"; exit 1 }
  Write-Host "Created CNAME www -> $dnsTarget" -ForegroundColor Green
} catch {
  Write-Error "Failed to create Cloudflare CNAME for www: $($_.Exception.Message)"; exit 1
}

# Attempt to create apex record via CNAME flattening (Cloudflare supports CNAME flattening for apex)
Write-Host "Attempting to create apex CNAME (Cloudflare will flatten automatically)." -ForegroundColor Cyan
try {
  $apexBody = @{ type = 'CNAME'; name = $Domain; content = $dnsTarget; ttl = 120; proxied = $false } | ConvertTo-Json
  $apexResp = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records" -Method Post -Headers $cfHeaders -Body $apexBody -ErrorAction Stop
  if ($apexResp.success) { Write-Host "Created apex CNAME $Domain -> $dnsTarget" -ForegroundColor Green }
} catch {
  Write-Warning "Could not create apex CNAME automatically. You can add an ALIAS/ANAME or use Cloudflare's dashboard to set up apex flattening. Error: $($_.Exception.Message)"
}

# ---------------------------
# 3) Optionally provision Heroku Postgres
# ---------------------------
if ($ProvisionPostgres) {
  Write-Host "Provisioning Heroku Postgres (hobby-dev)..." -ForegroundColor Green
  $addonBody = @{ plan = 'heroku-postgresql:hobby-dev' } | ConvertTo-Json
  try {
    $addonResp = Invoke-RestMethod -Uri "https://api.heroku.com/apps/$HerokuApp/addons" -Method Post -Headers $herokuHeaders -Body $addonBody -ErrorAction Stop
    Write-Host "Heroku addon creation requested. Response: $($addonResp | ConvertTo-Json -Depth 2)" -ForegroundColor Yellow
    Write-Host "Note: provisioning may take a short while. Heroku will set DATABASE_URL in app config when ready." -ForegroundColor Cyan
  } catch {
    Write-Warning "Failed to provision Heroku Postgres: $($_.Exception.Message)";
  }
}

# ---------------------------
# 4) Poll DNS + Heroku health
# ---------------------------
Write-Host "Polling DNS and Heroku health for https://www.$Domain/api/health ..." -ForegroundColor Green

$healthUrl = "https://www.$Domain/api/health"
$attempt = 0
while ($attempt -lt $MaxPollAttempts) {
  $attempt++
  try {
    # Resolve DNS for www
    $dns = Resolve-DnsName -Name "www.$Domain" -ErrorAction SilentlyContinue
    if ($dns) { Write-Host "DNS resolves: $($dns[0].NameHost)" -ForegroundColor DarkGreen } else { Write-Host "DNS not yet resolving (attempt $attempt)" -ForegroundColor Yellow }

    # Try HTTPS health check
    try {
      $resp = Invoke-RestMethod -Uri $healthUrl -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
      if ($resp -ne $null) {
        Write-Host "Health check OK: $($resp | ConvertTo-Json -Depth 2)" -ForegroundColor Green
        break
      }
    } catch {
      Write-Host "Health check not ready (attempt $attempt): $($_.Exception.Message)" -ForegroundColor Yellow
    }
  } catch {
    Write-Host "Polling error: $($_.Exception.Message)" -ForegroundColor Red
  }
  Start-Sleep -Seconds $PollSeconds
}

if ($attempt -ge $MaxPollAttempts) { Write-Warning "Polling reached max attempts. If DNS/SSL is still provisioning, wait a few more minutes and re-run this script or check Heroku Dashboard/Cloudflare." }

Write-Host "Finished. Manual checks / next steps:" -ForegroundColor Cyan
Write-Host " - Heroku Dashboard → Settings → Domains: confirm www.$Domain is listed and ACM shows 'OK'" -ForegroundColor Cyan
Write-Host " - GitHub Actions: ensure repository secrets HEROKU_API_KEY and HEROKU_APP_NAME exist (you already added them)" -ForegroundColor Cyan
Write-Host " - If you provisioned Postgres, verify DATABASE_URL in Heroku config and adapt your app to use Postgres instead of file-based DB" -ForegroundColor Cyan
Write-Host " - If you want, trigger CI workflow (push to main or use gh workflow run)." -ForegroundColor Cyan

Write-Host "Script complete." -ForegroundColor Green
