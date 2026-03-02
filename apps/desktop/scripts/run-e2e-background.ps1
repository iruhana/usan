$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $root 'logs'
if (!(Test-Path $logsDir)) {
  New-Item -ItemType Directory -Path $logsDir | Out-Null
}

# Retention policy: keep 20 most recent e2e log/pid files.
$allFiles = Get-ChildItem -Path $logsDir -File -Filter "e2e-*"
if ($allFiles.Count -gt 20) {
  $allFiles | Sort-Object LastWriteTime -Descending | Select-Object -Skip 20 | Remove-Item -Force
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logPath = Join-Path $logsDir "e2e-$timestamp.log"
$pidPath = Join-Path $logsDir "e2e-$timestamp.pid"

$cmd = "cd /d `"$root`" && npm run test:e2e > `"$logPath`" 2>&1"
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $cmd -PassThru -WindowStyle Hidden

Set-Content -Path $pidPath -Value $proc.Id -Encoding UTF8
Write-Output "E2E started in background. pid=$($proc.Id) log=$logPath"
