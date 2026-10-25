$ErrorActionPreference = 'Stop'

$serverScript = Join-Path $PSScriptRoot 'kinetix\start-server.ps1'
& $serverScript
