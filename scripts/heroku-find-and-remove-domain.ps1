<#
Find which Heroku app(s) own a domain and optionally remove the domain.

Usage:
  $env:HEROKU_API_KEY = '<token>'
  .\heroku-find-and-remove-domain.ps1 -Domain 'infinit3.cc'

This will list any apps in the account that have a domain matching the provided value
and will prompt to remove selected domain entries.
#>

param(
    [Parameter(Mandatory=$true)][string]$Domain
)

if (-not $env:HEROKU_API_KEY) { Write-Error 'Set HEROKU_API_KEY environment variable and re-run.'; exit 1 }
$token = $env:HEROKU_API_KEY.Trim()
if ($token.StartsWith('<') -and $token.EndsWith('>')) { $token = $token.Trim('<','>') }

$headers = @{ Authorization = "Bearer $token"; Accept = 'application/vnd.heroku+json; version=3'; 'Content-Type' = 'application/json' }

Write-Host "Fetching list of apps from Heroku..."
try {
    $apps = Invoke-RestMethod -Uri 'https://api.heroku.com/apps' -Headers $headers
} catch {
    Write-Error "Failed to list Heroku apps: $_"; exit 1
}

$matches = @()
foreach ($app in $apps) {
    try {
        $domains = Invoke-RestMethod -Uri "https://api.heroku.com/apps/$($app.name)/domains" -Headers $headers
        foreach ($d in $domains) {
            if ($d.hostname -like "*$Domain*") {
                $matches += [PSCustomObject]@{
                    App = $app.name
                    DomainId = $d.id
                    Hostname = $d.hostname
                    DnsTarget = $d.dns_target
                }
            }
        }
    } catch {
        # ignore per-app errors
    }
}

if ($matches.Count -eq 0) {
    Write-Host "No Heroku app in your account appears to own '$Domain'."
    exit 0
}

Write-Host "Found domain entries:" -ForegroundColor Cyan
[int]$i = 0
foreach ($m in $matches) {
    $i++; Write-Host "[$i] App: $($m.App)  Hostname: $($m.Hostname)  DomainId: $($m.DomainId)  DnsTarget: $($m.DnsTarget)"
}

$choice = Read-Host 'Enter the numbers to remove (comma separated), or ENTER to cancel'
if ([string]::IsNullOrWhiteSpace($choice)) { Write-Host 'No changes made.'; exit 0 }

$indices = $choice -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^[0-9]+$' } | ForEach-Object { [int]$_ }
foreach ($idx in $indices) {
    if ($idx -le 0 -or $idx -gt $matches.Count) { Write-Warning "Skipping invalid index: $idx"; continue }
    $entry = $matches[$idx - 1]
    Write-Host "Removing domain $($entry.Hostname) from app $($entry.App) (id: $($entry.DomainId))..."
    try {
        $delUri = "https://api.heroku.com/apps/$($entry.App)/domains/$($entry.DomainId)"
        Invoke-RestMethod -Method Delete -Uri $delUri -Headers $headers
        Write-Host "Removed domain $($entry.Hostname) from $($entry.App)" -ForegroundColor Green
    } catch {
        Write-Error "Failed to remove domain: $_"
    }
}

Write-Host 'Done.'
