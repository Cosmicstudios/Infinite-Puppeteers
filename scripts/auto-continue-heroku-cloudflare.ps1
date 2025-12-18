<#
Orchestrator: push repo, set secrets, wait for CI (optional), create Heroku domain, add Cloudflare CNAME, verify health.

Usage example:
  $env:HEROKU_API_KEY='...'
  $env:HEROKU_APP_NAME='my-app'
  $env:CLOUDFLARE_API_TOKEN='...'
  .\auto-continue-heroku-cloudflare.ps1 -Domain 'infinit3.cc' -WaitForCI -TailLogs

Notes:
 - Requires `gh` (GitHub CLI). For Heroku API calls this script uses `HEROKU_API_KEY` env var.
 - Requires `CLOUDFLARE_API_TOKEN` env var for Cloudflare DNS changes.
 - The script calls existing helpers `gh-push-and-setup-secrets.ps1` and `cloudflare-add-www-cname.ps1` in the same folder.
#>

param(
    [Parameter(Mandatory=$true)][string]$Domain,
    [switch]$WaitForCI,
    [switch]$UseLocalDeploy,
    [switch]$TailLogs
)

function Ensure-Command { param($n) if (-not (Get-Command $n -ErrorAction SilentlyContinue)) { Write-Warning "Required command '$n' not found."; return $false } return $true }

# detect gh availability but do not fail hard; we'll fallback where possible
$ghInstalled = $false
if (Get-Command gh -ErrorAction SilentlyContinue) { $ghInstalled = $true } else { Write-Warning 'gh (GitHub CLI) not found; some steps (triggering workflow, querying runs) will be skipped.' }

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "STEP 1: push repo and set GitHub secrets (uses gh)"
& "$scriptDir\gh-push-and-setup-secrets.ps1"
if ($LASTEXITCODE -ne 0) { Write-Warning 'gh push/setup script failed or exited with non-zero code.' }

if ($UseLocalDeploy) {
    Write-Host 'STEP 2: Performing local Heroku deploy using heroku-deploy-local.ps1'
    if (-not (Test-Path "$scriptDir\heroku-deploy-local.ps1")) { Write-Warning 'Local deploy script not found.' } else {
        & "$scriptDir\heroku-deploy-local.ps1" -Domain $Domain -ProvisionPostgres
    }
}

if ($WaitForCI) {
    if (-not $ghInstalled) { Write-Warning 'Skipping WaitForCI because gh is not installed.' } else {
        Write-Host 'STEP 3: Waiting for GitHub Actions workflow run (ci-publish.yml) to complete...'
        $owner = 'Cosmicstudios'; $repo = 'Infinite-Puppeteers'
        $maxWait = 900 # seconds
        $interval = 10
        $waited = 0
        while ($waited -lt $maxWait) {
            try {
                $runs = gh api repos/$owner/$repo/actions/runs --silent | ConvertFrom-Json
                if ($runs.total_count -gt 0) {
                    $latest = $runs.workflow_runs | Sort-Object created_at -Descending | Select-Object -First 1
                    Write-Host "Latest run: $($latest.id) - status:$($latest.status) conclusion:$($latest.conclusion)"
                    if ($latest.status -eq 'completed') { break }
                } else { Write-Host 'No workflow runs found yet.' }
            } catch { Write-Warning 'Failed to query GitHub Actions API via gh.' }
            Start-Sleep -Seconds $interval; $waited += $interval
        }
    }
}

Write-Host 'STEP 4: Ensure Heroku app exists and add domain (Heroku API)'
if (-not $env:HEROKU_API_KEY) { Write-Error 'Set HEROKU_API_KEY environment variable and re-run.'; exit 1 }
if (-not $env:HEROKU_APP_NAME) { Write-Error 'Set HEROKU_APP_NAME environment variable and re-run.'; exit 1 }

# Normalize tokens (trim whitespace and surrounding < > if present)
function Normalize-Token([string]$t) {
    if (-not $t) { return $t }
    $s = $t.Trim()
    if ($s.StartsWith('<') -and $s.EndsWith('>')) { $s = $s.Trim('<','>') }
    return $s
}

$herokuToken = Normalize-Token $env:HEROKU_API_KEY
$herokuApp = Normalize-Token $env:HEROKU_APP_NAME

function Invoke-HerokuApi { param($method,$path,$body)
    $uri = "https://api.heroku.com$path"
    $headers = @{ Authorization = "Bearer $herokuToken"; Accept = 'application/vnd.heroku+json; version=3' }
    if ($body) {
        $headers['Content-Type'] = 'application/json'
        try {
            return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -Body ($body | ConvertTo-Json -Depth 6)
        } catch {
            $err = $_
            $msg = $err.Exception.Message
            $respBody = ''
            try {
                if ($err.Exception.Response -and $err.Exception.Response.GetResponseStream()) {
                    $sr = New-Object System.IO.StreamReader($err.Exception.Response.GetResponseStream())
                    $respBody = $sr.ReadToEnd(); $sr.Close()
                }
            } catch {}
            throw "Heroku API error: $msg`nResponseBody: $respBody"
        }
    }
    try {
        return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers
    } catch {
        $err = $_
        $msg = $err.Exception.Message
        $respBody = ''
        try {
            if ($err.Exception.Response -and $err.Exception.Response.GetResponseStream()) {
                $sr = New-Object System.IO.StreamReader($err.Exception.Response.GetResponseStream())
                $respBody = $sr.ReadToEnd(); $sr.Close()
            }
        } catch {}
        throw "Heroku API error: $msg`nResponseBody: $respBody"
    }
}

# Verify Heroku app exists and print basic info
try {
    $appInfo = Invoke-HerokuApi -method Get -path "/apps/$herokuApp"
    Write-Host "Heroku app found: $($appInfo.name) - region: $($appInfo.region.name) - stack: $($appInfo.stack.name)"
} catch {
    Write-Error "Failed to fetch Heroku app info: $_"
    exit 1
}

try {
    $domains = Invoke-HerokuApi -method Get -path "/apps/$herokuApp/domains"
} catch {
    $err = $_
    Write-Error "Failed to list Heroku domains for app $herokuApp. Check HEROKU_API_KEY and HEROKU_APP_NAME."
    if ($err.Exception) { Write-Error "Exception: $($err.Exception.Message)" }
    try {
        $resp = $err.Exception.Response
        if ($resp -and $resp.GetResponseStream()) {
            $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $body = $sr.ReadToEnd(); $sr.Close(); Write-Error "Response body: $body"
        }
    } catch { }
    exit 1
}

$wwwHost = "www.$Domain"
$existing = $domains | Where-Object { $_.hostname -eq $wwwHost }
if ($existing) {
    Write-Host "Domain $wwwHost already exists on Heroku. DNS target: $($existing.dns_target)"
    $dnsTarget = $existing.dns_target
} else {
    Write-Host "Adding domain $wwwHost to Heroku app $herokuApp"
    try {
        $resp = Invoke-HerokuApi -method Post -path "/apps/$herokuApp/domains" -body @{ hostname = $wwwHost }
        $dnsTarget = $resp.dns_target
        Write-Host "Heroku responded with DNS target: $dnsTarget"
    } catch {
        $err = $_
        Write-Error "Failed to add domain to Heroku."
        if ($err.Exception) { Write-Error "Exception: $($err.Exception.Message)" }
        try {
            $resp = $err.Exception.Response
            if ($resp -and $resp.GetResponseStream()) {
                $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
                $body = $sr.ReadToEnd(); $sr.Close(); Write-Error "Response body: $body"
            }
        } catch { }
        exit 1
    }
}

if (-not $dnsTarget) { Write-Error 'No DNS target returned by Heroku. Cannot create Cloudflare record.'; exit 1 }

if (-not $env:CLOUDFLARE_API_TOKEN) { Write-Warning 'CLOUDFLARE_API_TOKEN not set; skipping Cloudflare record creation.' } else {
    Write-Host "STEP 5: Creating Cloudflare CNAME for $wwwHost -> $dnsTarget"
    & "$scriptDir\cloudflare-add-www-cname.ps1" -Domain $Domain -Target $dnsTarget
}

Write-Host 'STEP 6: Poll DNS and app health'
$maxWait = 600; $interval = 5; $elapsed = 0; $healthy = $false
while ($elapsed -lt $maxWait) {
    try {
        $cname = Resolve-DnsName -Name $wwwHost -Type CNAME -ErrorAction Stop | Select-Object -First 1
        Write-Host "DNS CNAME resolved: $($cname.CName)"
    } catch { Write-Host 'DNS CNAME not resolving yet.' }
    try {
        $h = Invoke-RestMethod -Uri "https://$wwwHost/api/health" -UseBasicParsing -TimeoutSec 10
        if ($null -ne $h) { Write-Host 'Health endpoint responded.'; $healthy = $true; break }
    } catch { Write-Host 'Health check failed (not ready yet).' }
    Start-Sleep -Seconds $interval; $elapsed += $interval
}

if ($healthy) { Write-Host 'Application is healthy at https://'$wwwHost } else { Write-Warning 'Application did not become healthy within the timeout.' }

if ($TailLogs) {
    if (-not (Get-Command heroku -ErrorAction SilentlyContinue)) { Write-Warning 'Heroku CLI not found; cannot tail logs.' } else {
        Write-Host 'Tailing Heroku logs (Ctrl-C to stop)'
        Write-Host "heroku logs --tail -a $herokuApp"
        heroku logs --tail -a $herokuApp
    }
}

Write-Host 'Auto-continue orchestration complete.'
