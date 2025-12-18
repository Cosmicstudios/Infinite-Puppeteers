<#
Run the finalizer and capture full console output to a timestamped log file.

Usage:
  cd 'e:\oo pupteers\SERVICE WEB'
  $env:HEROKU_API_KEY = '<heroku_key>'
  $env:HEROKU_APP_NAME = '<heroku_app>'
  $env:CLOUDFLARE_API_TOKEN = '<cf_token>'
  .\scripts\run-finalizer-and-log.ps1 -UseCI -InstallTools

This will run `finalize-auto-continue.ps1` with the same flags and save stdout+stderr.
#>

param(
    [switch]$UseCI,
    [switch]$SkipCI,
    [switch]$InstallTools
)

$timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$log = "finalizer_run_$timestamp.log"
Write-Host "Logging finalizer output to $log"

$argsList = @()
if ($UseCI) { $argsList += '-UseCI' }
if ($SkipCI) { $argsList += '-SkipCI' }
if ($InstallTools) { $argsList += '-InstallTools' }

$script = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'finalize-auto-continue.ps1'

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'powershell'
$psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$script`" $($argsList -join ' ')"
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
$proc.Start() | Out-Null

$out = $proc.StandardOutput.ReadToEnd()
$err = $proc.StandardError.ReadToEnd()
$proc.WaitForExit()

Set-Content -Path $log -Value $out -Encoding UTF8
Add-Content -Path $log -Value "`n--- STDERR ---`n" -Encoding UTF8
Add-Content -Path $log -Value $err -Encoding UTF8

Write-Host "Finalizer finished with exit code $($proc.ExitCode). Log saved: $log"
if ($proc.ExitCode -ne 0) { Write-Host 'Paste the log file content here and I will analyze.' }
