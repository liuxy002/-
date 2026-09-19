$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root '.qiuzhao-server.pid'
$stopped = $false

if (Test-Path -LiteralPath $pidFile) {
  $serverPid = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
  $process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $serverPid -Force
    $stopped = $true
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

if ($stopped) {
  Write-Host 'The application has been stopped.' -ForegroundColor Green
} else {
  Write-Host 'The application is not running.'
}
