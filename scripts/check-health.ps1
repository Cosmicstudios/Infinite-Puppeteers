<#
Check a health endpoint (local or remote).

Usage:
  .\scripts\check-health.ps1 -Url 'http://127.0.0.1:4000/api/health'
#>

param([Parameter(Mandatory=$true)][string]$Url)

try {
    $r = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 10
    Write-Host 'OK:'; $r | ConvertTo-Json -Depth 4
} catch {
    Write-Error "Health check failed: $($_.Exception.Message)"
    try { $resp = $_.Exception.Response; if ($resp) { $sr = New-Object System.IO.StreamReader($resp.GetResponseStream()); $b = $sr.ReadToEnd(); $sr.Close(); Write-Error "Response body: $b" } } catch {}
    exit 2
}
