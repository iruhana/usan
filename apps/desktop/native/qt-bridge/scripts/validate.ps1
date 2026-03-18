param(
  [string]$QtRoot = 'C:\Qt\6.10.2\mingw_64',
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$buildDir = Join-Path $projectRoot 'build'
$qtBin = Join-Path $QtRoot 'bin'
$mingwBinCandidates = @(
  'C:\Qt\Tools\mingw1310_64\bin'
)
$mingwBin = $mingwBinCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$buildScript = Join-Path $PSScriptRoot 'build.ps1'
$injectorPath = Join-Path $buildDir 'qt-injector.exe'
$dllPath = Join-Path $buildDir 'ubridge-qt.dll'
$widgetsFixturePath = Join-Path $buildDir 'qt-fixture-widgets.exe'
$quickFixturePath = Join-Path $buildDir 'qt-fixture-quick.exe'

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw "Assertion failed: $Message"
  }
}

function Assert-Equal {
  param(
    $Actual,
    $Expected,
    [string]$Message
  )

  if ($Actual -ne $Expected) {
    throw "Assertion failed: $Message`nExpected: $Expected`nActual: $Actual"
  }
}

function Ensure-BuildArtifacts {
  if ($SkipBuild) {
    return
  }

  & powershell -NoProfile -ExecutionPolicy Bypass -File $buildScript -QtRoot $QtRoot
  if ($LASTEXITCODE -ne 0) {
    throw "Qt bridge build failed with exit code $LASTEXITCODE"
  }
}

function Initialize-RuntimePath {
  $runtimePaths = @($qtBin)
  if ($mingwBin) {
    $runtimePaths += $mingwBin
  }

  foreach ($runtimePath in $runtimePaths) {
    if ([string]::IsNullOrWhiteSpace($runtimePath)) {
      continue
    }

    $segments = $env:PATH -split ';'
    if ($segments -notcontains $runtimePath) {
      $env:PATH = "$runtimePath;$env:PATH"
    }
  }
}

function New-FixtureProcess {
  param(
    [string]$ExePath
  )

  if (-not (Test-Path $ExePath)) {
    throw "Fixture executable not found: $ExePath"
  }

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $ExePath
  $startInfo.WorkingDirectory = (Split-Path $ExePath -Parent)
  $startInfo.UseShellExecute = $false
  $startInfo.Environment['PATH'] = $env:PATH
  $process = [System.Diagnostics.Process]::Start($startInfo)
  if ($null -eq $process) {
    throw "Failed to launch fixture: $ExePath"
  }

  Start-Sleep -Milliseconds 1200
  if ($process.HasExited) {
    throw "Fixture exited early: $ExePath"
  }

  return $process
}

function Open-QtPipe {
  param(
    [int]$ProcessId,
    [int]$TimeoutMs = 12000
  )

  $pipeName = "ubridge-qt-$ProcessId"
  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMs)

  while ([DateTime]::UtcNow -lt $deadline) {
    $client = $null
    try {
      $client = [System.IO.Pipes.NamedPipeClientStream]::new(
        '.',
        $pipeName,
        [System.IO.Pipes.PipeDirection]::InOut,
        [System.IO.Pipes.PipeOptions]::None
      )
      $client.Connect(500)

      $utf8 = [System.Text.UTF8Encoding]::new($false)
      $writer = [System.IO.StreamWriter]::new($client, $utf8, 4096, $true)
      $writer.AutoFlush = $true
      $reader = [System.IO.StreamReader]::new($client, $utf8, $false, 4096, $true)

      return @{
        Client = $client
        Reader = $reader
        Writer = $writer
        PipeName = $pipeName
      }
    } catch {
      if ($client) {
        $client.Dispose()
      }
      Start-Sleep -Milliseconds 250
    }
  }

  throw "Timed out waiting for named pipe: \\.\pipe\$pipeName"
}

function Invoke-QtRpc {
  param(
    [hashtable]$Pipe,
    [int]$Id,
    [string]$Method,
    [hashtable]$Params
  )

  $request = @{
    jsonrpc = '2.0'
    id = $Id
    method = $Method
    params = $Params
  } | ConvertTo-Json -Compress -Depth 10

  $Pipe.Writer.WriteLine($request)
  $line = $Pipe.Reader.ReadLine()
  if ([string]::IsNullOrWhiteSpace($line)) {
    throw "No JSON-RPC response for method: $Method"
  }

  $response = $line | ConvertFrom-Json
  if ($response.error) {
    throw "JSON-RPC $Method failed: $($response.error.message)"
  }

  return $response
}

function Start-QtBridgeSession {
  param(
    [System.Diagnostics.Process]$Process
  )

  if (-not (Test-Path $injectorPath)) {
    throw "Injector not found: $injectorPath"
  }
  if (-not (Test-Path $dllPath)) {
    throw "Bridge DLL not found: $dllPath"
  }

  $injectorOutput = (& $injectorPath inject --pid $Process.Id --dll $dllPath 2>&1) | Out-String
  if ($LASTEXITCODE -ne 0) {
    $details = $injectorOutput.Trim()
    if ([string]::IsNullOrWhiteSpace($details)) {
      $details = 'No stderr output captured.'
    }
    throw "qt-injector failed for PID $($Process.Id): $details"
  }

  return Open-QtPipe -ProcessId $Process.Id
}

function Stop-FixtureProcess {
  param(
    [System.Diagnostics.Process]$Process
  )

  if ($null -eq $Process) {
    return
  }

  try {
    if (-not $Process.HasExited) {
      $Process.CloseMainWindow() | Out-Null
      if (-not $Process.WaitForExit(1000)) {
        $Process.Kill($true)
        $Process.WaitForExit()
      }
    }
  } catch {
    if (-not $Process.HasExited) {
      Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
    }
  }
}

function Close-QtPipe {
  param(
    [hashtable]$Pipe
  )

  if ($null -eq $Pipe) {
    return
  }

  foreach ($key in 'Reader', 'Writer', 'Client') {
    if ($Pipe[$key]) {
      $Pipe[$key].Dispose()
    }
  }
}

function Test-WidgetsFixture {
  $process = $null
  $pipe = $null

  try {
    $process = New-FixtureProcess -ExePath $widgetsFixturePath
    $pipe = Start-QtBridgeSession -Process $process
    $id = 1

    $tree = Invoke-QtRpc -Pipe $pipe -Id $id -Method 'getObjectTree' -Params @{ maxDepth = 6 }
    $id++
    $rootNames = @($tree.result.roots | ForEach-Object { $_.objectName })
    Assert-True ($rootNames -contains 'ValidationMainWindow') 'Widgets tree should include ValidationMainWindow root'

    $matches = Invoke-QtRpc -Pipe $pipe -Id $id -Method 'findObject' -Params @{ query = 'confirmButton' }
    $id++
    Assert-True (($matches.result | Measure-Object).Count -ge 1) 'Widgets fixture should expose confirmButton via findObject'

    $statusPath = 'ValidationMainWindow/centralPanel/statusLabel'
    $inputPath = 'ValidationMainWindow/centralPanel/nameInput'
    $buttonPath = 'ValidationMainWindow/centralPanel/confirmButton'

    $statusBefore = Invoke-QtRpc -Pipe $pipe -Id $id -Method 'getProperty' -Params @{
      objectPath = $statusPath
      property = 'text'
    }
    $id++
    Assert-Equal $statusBefore.result 'Idle' 'Widgets statusLabel should start as Idle'

    Invoke-QtRpc -Pipe $pipe -Id $id -Method 'setProperty' -Params @{
      objectPath = $inputPath
      property = 'text'
      value = 'BridgeWidgets'
    } | Out-Null
    $id++

    Invoke-QtRpc -Pipe $pipe -Id $id -Method 'invokeMethod' -Params @{
      objectPath = $buttonPath
      method = 'click'
      args = @()
    } | Out-Null
    $id++

    Start-Sleep -Milliseconds 150
    $statusAfter = Invoke-QtRpc -Pipe $pipe -Id $id -Method 'getProperty' -Params @{
      objectPath = $statusPath
      property = 'text'
    }
    $id++
    Assert-Equal $statusAfter.result 'Confirmed: BridgeWidgets' 'Widgets button click should update the label'

    $screenshot = Invoke-QtRpc -Pipe $pipe -Id $id -Method 'screenshot' -Params @{
      objectPath = 'ValidationMainWindow'
    }
    $decoded = [Convert]::FromBase64String([string]$screenshot.result)
    Assert-True ($decoded.Length -gt 1000) 'Widgets screenshot should produce a PNG payload'

    return @{
      fixture = 'widgets'
      pid = $process.Id
      pipe = $pipe.PipeName
      screenshotBytes = $decoded.Length
    }
  } finally {
    Close-QtPipe -Pipe $pipe
    Stop-FixtureProcess -Process $process
  }
}

function Test-QuickFixture {
  $process = $null
  $pipe = $null

  try {
    $process = New-FixtureProcess -ExePath $quickFixturePath
    $pipe = Start-QtBridgeSession -Process $process
    $id = 101

    $tree = Invoke-QtRpc -Pipe $pipe -Id $id -Method 'getObjectTree' -Params @{ maxDepth = 6 }
    $id++
    $rootNames = @($tree.result.roots | ForEach-Object { $_.objectName })
    Assert-True ($rootNames -contains 'quickValidationWindow') 'Quick tree should include quickValidationWindow root'

    $matches = Invoke-QtRpc -Pipe $pipe -Id $id -Method 'findObject' -Params @{ query = 'messageInput' }
    $id++
    Assert-True (($matches.result | Measure-Object).Count -ge 1) 'Quick fixture should expose messageInput via findObject'

    $controllerPath = 'quickValidationWindow/validationController'

    $statusBefore = Invoke-QtRpc -Pipe $pipe -Id $id -Method 'getProperty' -Params @{
      objectPath = $controllerPath
      property = 'statusText'
    }
    $id++
    Assert-Equal $statusBefore.result 'Idle' 'Quick controller should start as Idle'

    Invoke-QtRpc -Pipe $pipe -Id $id -Method 'setProperty' -Params @{
      objectPath = $controllerPath
      property = 'message'
      value = 'BridgeQuick'
    } | Out-Null
    $id++

    Invoke-QtRpc -Pipe $pipe -Id $id -Method 'invokeMethod' -Params @{
      objectPath = $controllerPath
      method = 'applyMessage'
      args = @()
    } | Out-Null
    $id++

    Start-Sleep -Milliseconds 150
    $statusAfter = Invoke-QtRpc -Pipe $pipe -Id $id -Method 'getProperty' -Params @{
      objectPath = $controllerPath
      property = 'statusText'
    }
    $id++
    Assert-Equal $statusAfter.result 'Quick: BridgeQuick' 'Quick controller should update after applyMessage()'

    $screenshot = Invoke-QtRpc -Pipe $pipe -Id $id -Method 'screenshot' -Params @{
      objectPath = 'quickValidationWindow'
    }
    $decoded = [Convert]::FromBase64String([string]$screenshot.result)
    Assert-True ($decoded.Length -gt 1000) 'Quick screenshot should produce a PNG payload'

    return @{
      fixture = 'quick'
      pid = $process.Id
      pipe = $pipe.PipeName
      screenshotBytes = $decoded.Length
    }
  } finally {
    Close-QtPipe -Pipe $pipe
    Stop-FixtureProcess -Process $process
  }
}

Initialize-RuntimePath
Ensure-BuildArtifacts

Assert-True (Test-Path $qtBin) "Qt bin directory not found: $qtBin"
Assert-True (Test-Path $injectorPath) "Injector not found: $injectorPath"
Assert-True (Test-Path $dllPath) "Bridge DLL not found: $dllPath"
Assert-True (Test-Path $widgetsFixturePath) "Widgets fixture not found: $widgetsFixturePath"
Assert-True (Test-Path $quickFixturePath) "Quick fixture not found: $quickFixturePath"

$results = @(
  Test-WidgetsFixture
  Test-QuickFixture
)

$summary = @{
  validatedAt = [DateTime]::UtcNow.ToString('o')
  qtRoot = $QtRoot
  buildDir = $buildDir
  results = $results
}

$summary | ConvertTo-Json -Depth 10
