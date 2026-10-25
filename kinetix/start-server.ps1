param(
    [switch]$OpenAdmin
)

$ErrorActionPreference = 'Stop'

function Resolve-DotnetExecutable {
    $command = Get-Command dotnet -ErrorAction SilentlyContinue
    if ($command -and $command.Source) {
        return $command.Source
    }

    $candidateDirectories = @(
        (Join-Path $env:USERPROFILE '.dotnet'),
        (Join-Path ${env:ProgramFiles} 'dotnet'),
        (Join-Path ${env:ProgramFiles(x86)} 'dotnet')
    )

    foreach ($directory in $candidateDirectories | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) {
        $dotnetPath = Join-Path $directory 'dotnet.exe'
        if (Test-Path $dotnetPath) {
            return $dotnetPath
        }
    }

    return $null
}

$dotnetExecutable = Resolve-DotnetExecutable
if (-not $dotnetExecutable) {
    throw 'The .NET SDK could not be found. Install .NET 10 SDK (for example via https://dot.net) and ensure dotnet.exe is on PATH.'
}

$dotnetDirectory = Split-Path -Parent $dotnetExecutable
if (-not (($env:PATH -split ';') -contains $dotnetDirectory)) {
    $env:PATH = "$dotnetDirectory;$env:PATH"
}

$project = Join-Path $PSScriptRoot 'backend\KinetixCart.csproj'
$siteUrl = 'http://127.0.0.1:5087'
$healthUrl = "$siteUrl/health"
$serverProcess = $null

if ([string]::IsNullOrWhiteSpace($env:KINETIX_ADMIN_USERNAME)) {
    $env:KINETIX_ADMIN_USERNAME = 'Admin'
}
if ([string]::IsNullOrWhiteSpace($env:KINETIX_ADMIN_PASSWORD)) {
    $env:KINETIX_ADMIN_PASSWORD = 'kenken'
}

$listener = Get-NetTCPConnection -LocalPort 5087 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    try {
        $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
        if ($health.status -eq 'ok') {
            $listener = $null
        } else {
            throw "Port 5087 is in use by a stale or unhealthy Kinetix backend."
        }
    } catch {
        $owner = $null
        $matchingProcesses = Get-CimInstance Win32_Process -Filter "Name = 'KinetixCart.exe'" -ErrorAction SilentlyContinue | Where-Object {
            $_.CommandLine -match 'KinetixCart\.exe|KinetixCart\.dll'
        }
        if ($matchingProcesses) {
            $owner = $matchingProcesses | Sort-Object ProcessId | Select-Object -First 1
            if ($owner) {
                Stop-Process -Id $owner.ProcessId -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 1000
            }
        }

        $listener = Get-NetTCPConnection -LocalPort 5087 -State Listen -ErrorAction SilentlyContinue
        if ($listener) {
            throw "Port 5087 is already in use by a service that is not the Kinetix backend. Stop the other service or configure a different port."
        }
    }
}

if (-not $listener) {
    $health = $null
    $serverProcess = Start-Process -FilePath $dotnetExecutable `
        -ArgumentList @('run', '--configuration', 'Release', '--project', "`"$project`"", '--urls', $siteUrl) `
        -WorkingDirectory (Split-Path -Parent $PSScriptRoot) `
        -WindowStyle Minimized `
        -PassThru

    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        if ($serverProcess.HasExited) {
            throw "The Kinetix backend stopped during startup (exit code $($serverProcess.ExitCode))."
        }

        try {
            $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
            if ($health.status -eq 'ok') {
                break
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }

    if ($health.status -ne 'ok') {
        Stop-Process -Id $serverProcess.Id
        throw 'The Kinetix backend did not become healthy within 30 seconds.'
    }
}

$pageUrl = if ($OpenAdmin) { "$siteUrl/admin.html" } else { "$siteUrl/index.html" }
Start-Process $pageUrl
Write-Host "Kinetix site and API are running at $siteUrl"
