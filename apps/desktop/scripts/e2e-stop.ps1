$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $root 'logs'
if (!(Test-Path $logsDir)) {
  Write-Output "No background E2E logs found."
  exit 0
}

$latestPidFile = Get-ChildItem -Path $logsDir -Filter "e2e-*.pid" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $latestPidFile) {
  Write-Output "No E2E PID file found."
  exit 0
}

$procId = Get-Content -Path $latestPidFile.FullName | Select-Object -First 1
$proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
if (-not $proc) {
  Write-Output "E2E process already stopped. pid=$procId"
  exit 0
}

Stop-Process -Id $procId -Force
Write-Output "Stopped E2E process. pid=$procId"
