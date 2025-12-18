<#
Verify the Heroku app exists and print its config vars.

Requires: set env `HEROKU_API_KEY` and `HEROKU_APP_NAME` before running.

Usage:
  $env:HEROKU_API_KEY = '<key>'; $env:HEROKU_APP_NAME = '<app-name>'
  .\scripts\verify-heroku-app.ps1
#>

if (-not $env:HEROKU_API_KEY -or -not $env:HEROKU_APP_NAME) {
    Write-Error 'Set HEROKU_API_KEY and HEROKU_APP_NAME environment variables first.'; exit 1
}

$token = $env:HEROKU_API_KEY.Trim()
$app = $env:HEROKU_APP_NAME.Trim()

function Invoke-HerokuApi($method, $path, $body) {
    $uri = "https://api.heroku.com$path"
    $headers = @{ Authorization = "Bearer $token"; Accept = 'application/vnd.heroku+json; version=3' }
    try {
        if ($body) { return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -Body ($body | ConvertTo-Json -Depth 6) -ContentType 'application/json' }
        return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers
    } catch {
        Write-Error "Heroku API request failed: $($_.Exception.Message)"
        try { $resp = $_.Exception.Response; if ($resp) { $sr = New-Object System.IO.StreamReader($resp.GetResponseStream()); $b = $sr.ReadToEnd(); $sr.Close(); Write-Error "Response body: $b" } } catch {}
        exit 2
    }
}

Write-Host "Checking Heroku app: $app"
$info = Invoke-HerokuApi -method Get -path "/apps/$app"
Write-Host 'App info:'; $info | ConvertTo-Json -Depth 4

Write-Host 'Fetching config vars...'
$cfg = Invoke-HerokuApi -method Get -path "/apps/$app/config-vars"
$cfg | ConvertTo-Json -Depth 6

Write-Host 'Done.'
