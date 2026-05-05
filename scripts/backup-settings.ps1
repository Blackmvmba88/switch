param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

$settingsPath = Join-Path $Root "settings.json"
if (-not (Test-Path -LiteralPath $settingsPath)) {
    throw "settings.json no existe en: $settingsPath"
}

$backupDir = Join-Path $Root "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $backupDir ("settings-{0}.json" -f $stamp)

Copy-Item -LiteralPath $settingsPath -Destination $backupPath -Force
Write-Host ("Backup creado: {0}" -f $backupPath)

