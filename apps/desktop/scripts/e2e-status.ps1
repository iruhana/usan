$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $root 'logs'
if (!(Test-Path $logsDir)) {
  Write-Output "No background E2E logs found."
  exit 0
}

$latestPidFile = Get-ChildItem -Path $logsDir -Filter "e2e-*.pid" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$latestLogFile = Get-ChildItem -Path $logsDir -Filter "e2e-*.log" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $latestPidFile) {
  Write-Output "No E2E PID file found."
  if ($latestLogFile) {
    Write-Output "Latest log: $($latestLogFile.FullName)"
  }
  exit 0
}

$procId = Get-Content -Path $latestPidFile.FullName | Select-Object -First 1
$proc = Get-Process -Id $procId -ErrorAction SilentlyContinue

if ($proc) {
  Write-Output "E2E is running. pid=$procId started=$($proc.StartTime.ToString('yyyy-MM-dd HH:mm:ss'))"
} else {
  Write-Output "E2E is not running. last_pid=$procId"
}

if ($latestLogFile) {
  Write-Output "Latest log: $($latestLogFile.FullName)"
}
