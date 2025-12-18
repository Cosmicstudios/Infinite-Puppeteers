<#
Push local workspace to GitHub, set required GitHub secrets via `gh`, and trigger the `ci-publish.yml` workflow.

Usage (preferred): set the following env vars before running:
  $env:GITHUB_TOKEN (or use `gh auth login` beforehand)
  $env:HEROKU_API_KEY
  $env:HEROKU_APP_NAME
  $env:CLOUDFLARE_API_TOKEN

Then run:
  .\gh-push-and-setup-secrets.ps1 -RepoOwner 'Cosmicstudios' -RepoName 'Infinite-Puppeteers'

The script will prompt for missing values.
#>

param(
    [string]$RepoOwner = 'Cosmicstudios',
    [string]$RepoName = 'Infinite-Puppeteers',
    [string]$Branch = 'main'
)

function Ensure-Command { param($name) if (Get-Command $name -ErrorAction SilentlyContinue) { return $true } return $false }

# Detect git and gh availability; do not hard-fail here — print instructions instead
$gitInstalled = Ensure-Command git
if (-not $gitInstalled) { Write-Warning "git not found. Git-related steps will be skipped; install git and re-run to push automatically." }
$ghInstalled = Ensure-Command gh
if (-not $ghInstalled) { Write-Warning "gh (GitHub CLI) not found. Secret setup and workflow trigger will be printed as instructions." }

$repoPath = (Get-Location).Path
Write-Host "Working in: $repoPath"

if ($gitInstalled) {
    # Git init and push
    if (-not (Test-Path -Path (Join-Path $repoPath '.git'))) { git init }
    git add -A
    try { git commit -m 'chore: initial upload' } catch { Write-Host 'No changes to commit or commit failed.' }
    $remote = "https://github.com/$RepoOwner/$RepoName.git"
    try { git remote add origin $remote 2>$null } catch {}
    git branch -M $Branch
    git push -u origin $Branch
} else {
    Write-Warning 'Skipping git push because git is not installed. To push manually once git is installed, run:'
    Write-Host "git remote add origin https://github.com/$RepoOwner/$RepoName.git"
    Write-Host "git push -u origin $Branch"
}

# Set GitHub secrets using gh (read from env or prompt)
function Set-GHSecretIfPresent($name, $envVar) {
    $value = (Get-Item -Path "Env:\$envVar" -ErrorAction SilentlyContinue).Value
    $plain = $null
    if (-not $value) {
        $secure = Read-Host -AsSecureString "Enter value for $name (leave empty to skip)"
        if ($secure) {
            $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
            try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
        }
    } else {
        $plain = $value.Trim()
        if ($plain.StartsWith('<') -and $plain.EndsWith('>')) { $plain = $plain.Trim('<','>') }
    }
    if ([string]::IsNullOrEmpty($plain)) { Write-Host "Skipping $name (empty)"; return }
    if ($ghInstalled) {
        gh secret set $name --body $plain --repo "$RepoOwner/$RepoName"
    } else {
        Write-Warning "gh CLI not found. Please set the secret '$name' in the GitHub repository $RepoOwner/$RepoName manually or install gh and re-run this script."
        Write-Host "Secret value (copy this to set in GitHub UI):`n$plain`n"
    }
}

Set-GHSecretIfPresent -name 'HEROKU_API_KEY' -envVar 'HEROKU_API_KEY'
Set-GHSecretIfPresent -name 'HEROKU_APP_NAME' -envVar 'HEROKU_APP_NAME'
Set-GHSecretIfPresent -name 'CLOUDFLARE_API_TOKEN' -envVar 'CLOUDFLARE_API_TOKEN'

# Trigger workflow dispatch if available
Write-Host 'Triggering GitHub Actions workflow ci-publish.yml (if present)'
if ($ghInstalled) {
    gh workflow run ci-publish.yml --repo "$RepoOwner/$RepoName" --ref $Branch
} else {
    Write-Warning "gh CLI not found; cannot trigger workflow. After pushing, trigger the workflow from the GitHub Actions UI or install gh and run: gh workflow run ci-publish.yml --repo $RepoOwner/$RepoName --ref $Branch"
}

Write-Host 'Done. Monitor Actions in GitHub or run `gh run list --repo $RepoOwner/$RepoName`.'
