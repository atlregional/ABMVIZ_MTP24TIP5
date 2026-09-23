$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8000
$url = "http://localhost:$port"

Write-Host "Starting ABMVIZ dashboard from $projectRoot" -ForegroundColor Cyan
Write-Host "URL: $url" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Yellow

Set-Location $projectRoot
python -m http.server $port
