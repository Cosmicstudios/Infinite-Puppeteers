<#
Verify local git remote and check GitHub repo accessibility.

Usage:
  .\scripts\verify-github-push-status.ps1

This checks for a git remote named 'origin' and, if `gh` is available, attempts to view the repo.
#>

function HasCmd($n){ $null -ne (Get-Command $n -ErrorAction SilentlyContinue) }

if (-not (Test-Path .git)) { Write-Warning 'No local git repository detected in this folder.' }
else {
    try { $url = git remote get-url origin 2>$null; Write-Host "origin -> $url" } catch { Write-Warning 'No origin remote set.' }
}

if (HasCmd gh) {
    Write-Host 'gh CLI detected; attempting to view repository details (requires auth)'
    try { gh repo view --web } catch { Write-Warning 'gh repo view failed; ensure you are authenticated (gh auth login).' }
} else { Write-Host 'gh not installed; install or use GitHub web UI to verify repo and Actions.' }

Write-Host 'If git push failed earlier, push manually: git push -u origin main'
