<#
End-to-end finalizer: reconnect repo to GitHub, set secrets, trigger CI or perform local deploy,
add Heroku domain, create Cloudflare CNAME, and validate health.

Usage (recommended):
  cd 'e:\oo pupteers\SERVICE WEB'
  $env:HEROKU_API_KEY = '<heroku_key>'
  $env:HEROKU_APP_NAME = '<heroku_app>'
  $env:CLOUDFLARE_API_TOKEN = '<cf_token>'
  .\scripts\finalize-auto-continue.ps1 -RepoOwner 'Cosmicstudios' -RepoName 'Infinite-Puppeteers' -Domain 'infinit3.cc' -UseCI

Flags:
  -UseCI : attempt to trigger GitHub Actions after pushing (requires `gh`)
  -SkipCI : perform a local Heroku container deploy instead (requires `docker` and `heroku` CLI)
  -InstallTools : try to install `git` and `gh` via winget if missing (Windows only)

This script orchestrates existing helper scripts in the `scripts/` folder.
#>

param(
    [string]$RepoOwner = 'Cosmicstudios',
    [string]$RepoName = 'Infinite-Puppeteers',
    [Parameter(Mandatory=$true)][string]$Domain,
    [switch]$UseCI,
    [switch]$SkipCI,
    [switch]$InstallTools
)

function HasCmd($name) { return $null -ne (Get-Command $name -ErrorAction SilentlyContinue) }

Write-Host 'Finalizer starting...'

# Optionally install tools
if ($InstallTools) {
    if (-not (HasCmd winget)) { Write-Warning 'winget not available; cannot auto-install tools.' } else {
        if (-not (HasCmd git)) { Write-Host 'Installing git via winget...' ; winget install --id Git.Git -e --source winget }
        if (-not (HasCmd gh)) { Write-Host 'Installing GitHub CLI via winget...' ; winget install --id GitHub.cli -e --source winget }
    }
}

# Ensure git repo and push
if (-not (HasCmd git)) { Write-Warning 'git not found; please install git and re-run or use -InstallTools.' }
else {
    if (-not (Test-Path .git)) { Write-Host 'Initializing git repository...' ; git init }
    git add -A
    try { git commit -m 'chore: finalize project upload' } catch { Write-Host 'No new changes to commit.' }
    $remoteUrl = "https://github.com/$RepoOwner/$RepoName.git"
    try { git remote add origin $remoteUrl 2>$null } catch {}
    Write-Host "Pushing to $remoteUrl..."
    try { git branch -M main; git push -u origin main } catch { Write-Warning 'git push failed. Ensure authentication (PAT) is set or push manually.' }
}

# Setup GitHub secrets (uses gh if available)
if (HasCmd gh) {
    Write-Host 'Setting GitHub secrets via gh...'
    if ($env:HEROKU_API_KEY) { gh secret set HEROKU_API_KEY --body $env:HEROKU_API_KEY --repo "$RepoOwner/$RepoName" }
    if ($env:HEROKU_APP_NAME) { gh secret set HEROKU_APP_NAME --body $env:HEROKU_APP_NAME --repo "$RepoOwner/$RepoName" }
    if ($env:CLOUDFLARE_API_TOKEN) { gh secret set CLOUDFLARE_API_TOKEN --body $env:CLOUDFLARE_API_TOKEN --repo "$RepoOwner/$RepoName" }
} else {
    Write-Warning 'gh not installed; secrets not set. Use the GitHub repo settings to add HEROKU_API_KEY, HEROKU_APP_NAME, CLOUDFLARE_API_TOKEN.'
}

if ($UseCI) {
    if (-not (HasCmd gh)) { Write-Warning 'Cannot trigger CI because gh is not installed.' }
    else {
        Write-Host 'Triggering CI workflow ci-publish.yml'
        gh workflow run ci-publish.yml --repo "$RepoOwner/$RepoName" --ref main
    }
}

# If skipping CI, perform local Heroku container deploy
if ($SkipCI) {
    if (-not (HasCmd docker) -or -not (HasCmd heroku)) { Write-Warning 'docker or heroku CLI missing; cannot do local deploy.' }
    else {
        Write-Host 'Running local Heroku container deploy...'
        & .\scripts\heroku-deploy-local.ps1 -Domain $Domain -ProvisionPostgres
    }
}

# Ensure Heroku domain is added and Cloudflare CNAME created
if (-not $env:HEROKU_API_KEY -or -not $env:HEROKU_APP_NAME) { Write-Warning 'HEROKU_API_KEY or HEROKU_APP_NAME not set; cannot add domain automatically.' }
else {
    Write-Host 'Adding domain to Heroku and creating Cloudflare CNAME (if token present)'
    & .\scripts\auto-continue-heroku-cloudflare.ps1 -Domain $Domain -TailLogs
}

Write-Host 'Finalizer finished. Check output above for errors.'
