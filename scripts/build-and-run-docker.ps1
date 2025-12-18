<#
Build the backend Docker image and run it locally, then check `/api/health`.

Requires Docker installed and running.

Usage:
  .\scripts\build-and-run-docker.ps1
#>

function HasCmd($n){ $null -ne (Get-Command $n -ErrorAction SilentlyContinue) }
if (-not (HasCmd docker)) { Write-Error 'docker CLI not found. Install Docker Desktop and try again.'; exit 1 }

$image = 'infinit3-backend:local'
Write-Host 'Building image from ./backend (tag: ' $image ')'
docker build -t $image ./backend
if ($LASTEXITCODE -ne 0) { Write-Error 'Docker build failed.'; exit $LASTEXITCODE }

Write-Host 'Stopping any existing container named infinit3-local'
try { docker rm -f infinit3-local } catch {}

Write-Host 'Starting container on port 4000'
docker run -d --name infinit3-local -p 4000:4000 $image
Start-Sleep -Seconds 3

try {
    $resp = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/health' -Method Get -TimeoutSec 5
    Write-Host 'Health response:'; $resp | ConvertTo-Json -Depth 4
} catch {
    Write-Error 'Failed to query local container /api/health. Check container logs:'
    docker logs infinit3-local --tail 200
}

Write-Host 'Stopping and removing local container'
docker rm -f infinit3-local

Write-Host 'Done.'
