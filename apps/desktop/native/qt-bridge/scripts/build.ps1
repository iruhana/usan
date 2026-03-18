param(
  [string]$QtRoot = 'C:\Qt\6.10.2\mingw_64',
  [string]$Configuration = 'Release',
  [string]$Generator = 'MinGW Makefiles'
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$buildDir = Join-Path $projectRoot 'build'
$qt6Dir = Join-Path $QtRoot 'lib\cmake\Qt6'
$cmakeCandidates = @(
  (Get-Command cmake.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
  'C:\Qt\Tools\CMake_64\bin\cmake.exe'
)
$mingwBinCandidates = @(
  'C:\Qt\Tools\mingw1310_64\bin'
)

if (-not (Test-Path $QtRoot)) {
  throw "Qt root not found: $QtRoot"
}

$cmakeExe = $cmakeCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $cmakeExe) {
  throw 'cmake.exe not found. Install Qt CMake tools or add cmake.exe to PATH.'
}

$mingwBin = $mingwBinCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($mingwBin) {
  $env:PATH = "$mingwBin;$(Split-Path $cmakeExe -Parent);$env:PATH"
}

if (-not (Test-Path $qt6Dir)) {
  throw "Qt6_DIR not found: $qt6Dir"
}

Remove-Item (Join-Path $buildDir 'CMakeCache.txt') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $buildDir 'CMakeFiles') -Recurse -Force -ErrorAction SilentlyContinue

$mingwMake = if ($mingwBin) { Join-Path $mingwBin 'mingw32-make.exe' } else { $null }
$mingwCxx = if ($mingwBin) { Join-Path $mingwBin 'g++.exe' } else { $null }

& $cmakeExe -S $projectRoot -B $buildDir -G $Generator `
  "-DCMAKE_BUILD_TYPE=$Configuration" `
  "-DCMAKE_PREFIX_PATH=$QtRoot" `
  "-DQt6_DIR=$qt6Dir" `
  "-DCMAKE_MAKE_PROGRAM=$mingwMake" `
  "-DCMAKE_CXX_COMPILER=$mingwCxx"

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& $cmakeExe --build $buildDir --config $Configuration
exit $LASTEXITCODE
