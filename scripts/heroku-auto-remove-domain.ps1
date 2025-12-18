<#
Automatically remove domain entries matching a given domain from all Heroku apps
in the account accessible by `HEROKU_API_KEY`.

USE WITH CAUTION: this will DELETE domain records from Heroku apps without prompting.
Set `HEROKU_API_KEY` in your environment before running.

Usage:
  $env:HEROKU_API_KEY = '<token>'
  .\heroku-auto-remove-domain.ps1 -Domain 'infinit3.cc'
#>

param(
    [Parameter(Mandatory=$true)][string]$Domain
)

if (-not $env:HEROKU_API_KEY) { Write-Error 'Set HEROKU_API_KEY environment variable and re-run.'; exit 1 }
$token = $env:HEROKU_API_KEY.Trim()
if ($token.StartsWith('<') -and $token.EndsWith('>')) { $token = $token.Trim('<','>') }

$headers = @{ Authorization = "Bearer $token"; Accept = 'application/vnd.heroku+json; version=3'; 'Content-Type' = 'application/json' }

Write-Host "Fetching Heroku apps..."
try { $apps = Invoke-RestMethod -Uri 'https://api.heroku.com/apps' -Headers $headers } catch { Write-Error "Failed to list Heroku apps: $_"; exit 1 }

$removed = @()
foreach ($app in $apps) {
    try {
        $domains = Invoke-RestMethod -Uri "https://api.heroku.com/apps/$($app.name)/domains" -Headers $headers
        foreach ($d in $domains) {
            if ($d.hostname -like "*$Domain*") {
                Write-Host "Removing $($d.hostname) from app $($app.name) (id: $($d.id))..."
                try {
                    Invoke-RestMethod -Method Delete -Uri "https://api.heroku.com/apps/$($app.name)/domains/$($d.id)" -Headers $headers
                    $removed += [PSCustomObject]@{ App = $app.name; Hostname = $d.hostname; DomainId = $d.id }
                    Write-Host "Removed $($d.hostname) from $($app.name)" -ForegroundColor Green
                } catch {
                    Write-Error "Failed to remove $($d.hostname) from $($app.name): $_"
                }
            }
        }
    } catch {
        Write-Warning "Could not list domains for app $($app.name): $_"
    }
}

Write-Host 'Summary of removals:'
if ($removed.Count -eq 0) { Write-Host 'No matching domains found/removed.' } else { $removed | Format-Table }

Write-Host 'Done.'
