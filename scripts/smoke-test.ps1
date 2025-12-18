<#
smoke-test.ps1
Simple health check and a few API checks against local instance.
Run after starting services. Accepts base URL.
#>

param(
  [string]$BaseUrl = 'http://localhost:4000'
)

function Check([string]$path) {
  $url = "$BaseUrl$path"
  try {
    $res = Invoke-RestMethod -Method Get -Uri $url -TimeoutSec 10
    Write-Host "OK: $url -> $(($res | ConvertTo-Json -Depth 2) -replace '\n',' ' )"
  } catch {
    Write-Error "FAIL: $url -> $($_.Exception.Message)"
  }
}

Write-Host "Running health checks against $BaseUrl"
Check '/api/health'
Check '/api/products'
Check '/api/admin/api-keys'  # requires auth; this may return 401 which is expected

Write-Host "Smoke tests completed (interpret failures based on expected auth)."