$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverPath = Join-Path $root 'server.js'
$url = 'http://127.0.0.1:4173'
$port = 4173

function Find-NodeRuntime {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $candidates = @(
    (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe'),
    (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

  return ($candidates | Select-Object -First 1)
}

function Test-ServiceReady {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect('127.0.0.1', $port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(500)) { return $false }
    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

if (-not (Test-Path -LiteralPath $serverPath)) {
  Write-Host 'server.js was not found. The application files may be incomplete.' -ForegroundColor Red
  exit 1
}

if (Test-ServiceReady) {
  Write-Host 'The application is already running. Opening it now...' -ForegroundColor Green
  if ($env:QIUZHAO_NO_BROWSER -ne '1') { Start-Process $url }
  exit 0
}

$nodePath = Find-NodeRuntime
if (-not $nodePath) {
  Write-Host 'Node.js was not found.' -ForegroundColor Red
  Write-Host 'Please install Node.js, or ask me to switch to a Node-free launcher.'
  exit 1
}

$process = Start-Process -FilePath $nodePath -ArgumentList @($serverPath) -WorkingDirectory $root -WindowStyle Hidden -PassThru

for ($i = 0; $i -lt 40; $i += 1) {
  Start-Sleep -Milliseconds 250
  if (Test-ServiceReady) {
    Write-Host 'The application is running.' -ForegroundColor Green
    if ($env:QIUZHAO_NO_BROWSER -ne '1') { Start-Process $url }
    exit 0
  }
  if ($process.HasExited) { break }
}

if (-not $process.HasExited) {
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
}
Write-Host 'Startup failed: the local service did not become ready in time.' -ForegroundColor Red
exit 1
