<#
Installer + runner for auto-continue orchestrator.

This script will:
- Check for `git` and `gh`.
- Offer to install them via `winget` if missing.
- Run `auto-continue-heroku-cloudflare.ps1` with provided Domain and flags.

Run example (PowerShell elevated recommended):
  cd 'e:\oo pupteers\SERVICE WEB'
  $env:HEROKU_API_KEY = '<your_key>'
  $env:HEROKU_APP_NAME = '<your_app>'
  $env:CLOUDFLARE_API_TOKEN = '<your_token>'
  .\scripts\install-and-run-auto-continue.ps1 -Domain 'infinit3.cc' -WaitForCI -TailLogs
#>

param(
    [Parameter(Mandatory=$true)][string]$Domain,
    [switch]$WaitForCI,
    [switch]$UseLocalDeploy,
    [switch]$TailLogs
)

function Has-Command($name) { return $null -ne (Get-Command $name -ErrorAction SilentlyContinue) }

Write-Host 'Checking required CLIs...'
$needGit = -not (Has-Command git)
$needGh = -not (Has-Command gh)

if ($needGit -or $needGh) {
    Write-Host 'Some required tools are missing:'
    if ($needGit) { Write-Host '- git (missing)' }
    if ($needGh) { Write-Host '- gh (GitHub CLI) (missing)' }

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Warning 'winget not available. Please install missing tools manually (git, gh) and re-run this script.'
        exit 1
    }

    $install = Read-Host "Install missing tools via winget now? (Y/n)"
    if ($install -eq '' -or $install.ToLower().StartsWith('y')) {
        if ($needGit) {
            Write-Host 'Installing Git via winget...'
            winget install --id Git.Git -e --source winget
        }
        if ($needGh) {
            Write-Host 'Installing GitHub CLI (gh) via winget...'
            winget install --id GitHub.cli -e --source winget
        }
    } else {
        Write-Warning 'Skipping automated install. Install git and gh manually and re-run.'
        exit 1
    }
}

Write-Host 'Re-checking tools...'
if (-not (Has-Command git)) { Write-Error 'git still not found after install attempt. Aborting.'; exit 1 }
if (-not (Has-Command gh)) { Write-Warning 'gh still not found after install attempt. Script can continue but will print manual secret setup instructions.' }

Write-Host 'Running orchestrator...'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$cmd = "& \"$scriptDir\\auto-continue-heroku-cloudflare.ps1\" -Domain '$Domain'"
if ($WaitForCI) { $cmd += ' -WaitForCI' }
if ($UseLocalDeploy) { $cmd += ' -UseLocalDeploy' }
if ($TailLogs) { $cmd += ' -TailLogs' }

Invoke-Expression $cmd
