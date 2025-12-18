<#
Create a Cloudflare DNS CNAME record for `www.<domain>` pointing to the provided target (e.g., Heroku DNS target).

Usage:
  $env:CLOUDFLARE_API_TOKEN = '<token>'
  .\cloudflare-add-www-cname.ps1 -Domain 'infinit3.cc' -Target 'example.herokuapp.com'

Notes:
 - The script requires a Cloudflare API token with `Zone.Zone:Read` and `Zone.DNS:Edit` for the zone.
 - The script creates `www.<domain>` CNAME (DNS-only, proxied=false).
#>

param(
    [Parameter(Mandatory=$true)][string]$Domain,
    [Parameter(Mandatory=$true)][string]$Target
)

if (-not $env:CLOUDFLARE_API_TOKEN) {
    Write-Error 'Set CLOUDFLARE_API_TOKEN environment variable before running.'
    exit 1
}

$token = $env:CLOUDFLARE_API_TOKEN.Trim()
# Trim accidental enclosing angle brackets like <token>
if ($token.StartsWith('<') -and $token.EndsWith('>')) { $token = $token.Trim('<','>') }

# Normalize target: trim whitespace and accidental angle brackets
$Target = $Target.Trim()
if ($Target.StartsWith('<') -and $Target.EndsWith('>')) { $Target = $Target.Trim('<','>') }

function Invoke-CFApi {
    param($method, $path, $body)
    $uri = "https://api.cloudflare.com/client/v4$path"
    $headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
    if ($body) { return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -Body ($body | ConvertTo-Json -Depth 6) }
    return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers
}

try {
    Write-Host "Finding zone for $Domain"
    $zoneResp = Invoke-CFApi -method Get -path "/zones?name=$Domain"
    if (-not $zoneResp.success -or $zoneResp.result.Count -eq 0) { Write-Error 'Zone not found or permission denied.'; exit 1 }
    $zoneId = $zoneResp.result[0].id
    Write-Host "Zone ID: $zoneId"

    $recordName = "www.$Domain"
    $body = @{ type = 'CNAME'; name = $recordName; content = $Target; ttl = 1; proxied = $false }

    Write-Host "Creating CNAME: $recordName -> $Target"
    $create = Invoke-CFApi -method Post -path "/zones/$zoneId/dns_records" -body $body
    if ($create.success) {
        Write-Host 'CNAME created successfully.'
    } else {
        Write-Error "Failed to create record: $($create.errors | ConvertTo-Json -Depth 6)"
        Write-Error "Full response: $($create | ConvertTo-Json -Depth 6)"
        exit 1
    }

} catch {
    $err = $_
    Write-Error 'Cloudflare API request failed.'
    if ($err.Exception) { Write-Error "Exception: $($err.Exception.Message)" }
    try {
        if ($err.Exception.Response -and $err.Exception.Response.GetResponseStream()) {
            $sr = New-Object System.IO.StreamReader($err.Exception.Response.GetResponseStream())
            $body = $sr.ReadToEnd(); $sr.Close(); Write-Error "Response body: $body"
        }
    } catch { }
    exit 1
}

Write-Host 'Waiting a few seconds and verifying DNS resolution (local)'
Start-Sleep -Seconds 5
try {
    Resolve-DnsName -Name $recordName -Type CNAME -ErrorAction Stop | Select-Object Name, Type, @{Name='Data';Expression={$_.CName}}
} catch {
    Write-Warning 'Local DNS query did not resolve immediately. Allow propagation and check again.'
}

Write-Host 'Done.'
