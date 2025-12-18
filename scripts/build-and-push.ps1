<#
build-and-push.ps1
Builds production Docker image and (optionally) pushes to a registry.
Usage example:
  .\scripts\build-and-push.ps1 -ImageName myrepo/service-web -Tag latest -Push

You must have Docker installed and be logged in to your registry before pushing.
#>
param(
  [string]$ImageName = 'myrepo/service-web',
  [string]$Tag = 'latest',
  [switch]$Push,
  [string]$Registry = ''
)

function Exec([string]$cmd) {
  Write-Host "> $cmd"
  $proc = Start-Process -FilePath pwsh -ArgumentList "-NoProfile -Command $cmd" -NoNewWindow -Wait -PassThru
  return $proc.ExitCode
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker CLI not found. Please install Docker Desktop and ensure 'docker' is on PATH."
  exit 1
}

$fullTag = if ($Registry -ne '') { "$Registry/$ImageName:$Tag" } else { "$ImageName:$Tag" }

# Build
Write-Host "Building image $fullTag..."
docker build -f backend/Dockerfile -t $fullTag backend/
if ($LASTEXITCODE -ne 0) { Write-Error "Docker build failed."; exit 1 }
Write-Host "Built $fullTag"

if ($Push) {
  if ($Registry -ne '') {
    Write-Host "Pushing $fullTag to registry..."
  } else {
    Write-Host "Pushing $ImageName:$Tag to default docker registry (Docker Hub)"
  }
  docker push $fullTag
  if ($LASTEXITCODE -ne 0) { Write-Error "Docker push failed."; exit 1 }
  Write-Host "Pushed $fullTag"
}

Write-Host "build-and-push completed."