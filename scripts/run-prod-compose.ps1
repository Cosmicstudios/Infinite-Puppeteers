<#
run-prod-compose.ps1
Starts the production docker-compose configuration.
Usage: `.

















Write-Host "Services started. Use docker compose ps to inspect."iex $cmdWrite-Host "> $cmd"$cmd = "$composeCmd -f docker-compose.yml -f docker-compose.prod.yml up -d"Write-Host "Starting production compose (no volumes)..."$composeCmd = if (Get-Command 'docker' -ErrorAction SilentlyContinue) { 'docker compose' } else { 'docker-compose' }# Prefer `docker compose` (v2) but support `docker-compose` as fallback# Use docker compose with override}  exit 1  Write-Error "Docker CLI not found. Install Docker Desktop first."if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {#>un-prod-compose.ps1`