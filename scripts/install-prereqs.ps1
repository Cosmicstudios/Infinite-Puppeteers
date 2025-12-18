<#
install-prereqs.ps1
Installs developer prerequisites on Windows using winget (if available).
Run as Administrator.
#>

param(
  [switch]$InstallVSCommunity
)

function Exec([string]$cmd) {
  Write-Host "> $cmd"
  iex $cmd
}

Write-Host "Checking for winget..."
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Error "winget is not available. Please install App Installer from Microsoft Store or install packages manually."
  exit 1
}

# Update winget sources
Exec "winget source update"

# Packages to install
$packages = @(
  'Git.Git',
  'GitHub.cli',
  'OpenJS.NodeJS.LTS',
  'Docker.DockerDesktop',
  'Microsoft.VisualStudioCode'
)

if ($InstallVSCommunity) {
  $packages += 'Microsoft.VisualStudio.2022.Community'
}

foreach ($pkg in $packages) {
  Write-Host "Installing $pkg..."
  Exec "winget install --id $pkg -e --accept-package-agreements --accept-source-agreements"
}

Write-Host "Done. You may need to sign out/in or reboot for Docker Desktop to become available."