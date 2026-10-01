$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$project = Join-Path $root 'templatemo_631_kinetic\backend\KinetixCart.csproj'
$siteUrl = 'http://127.0.0.1:5087'

$portInUse = Get-NetTCPConnection -LocalPort 5087 -ErrorAction SilentlyContinue
if (-not $portInUse) {
    Start-Process -FilePath 'dotnet' -ArgumentList @('run', '--project', $project, '--urls', $siteUrl) -WorkingDirectory $root -WindowStyle Minimized
    Start-Sleep -Seconds 2
}

Start-Process $siteUrl
Write-Host "Kinetix cart backend and site are starting on $siteUrl"
