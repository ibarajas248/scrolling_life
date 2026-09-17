$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:BOT_HOST = '127.0.0.1'
$env:BOT_PORT = '8096'
if (-not $env:BOT_CONTACT) { $env:BOT_CONTACT = 'ivanbarajashurtado@gmail.com' }
if (-not $env:BOT_CHROMIUM_PATH) {
    $installedBrowser = Join-Path $env:LOCALAPPDATA 'ms-playwright/chromium-1223/chrome-win64/chrome.exe'
    if (Test-Path -LiteralPath $installedBrowser) { $env:BOT_CHROMIUM_PATH = $installedBrowser }
}
Write-Host 'Bot local: http://localhost:8080/bot/ (transmision en 127.0.0.1:8096)'
& node (Join-Path $projectRoot 'bot-service/server.mjs')
