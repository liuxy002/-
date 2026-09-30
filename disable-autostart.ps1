$ErrorActionPreference = 'SilentlyContinue'
$taskName = 'Qiuzhao Workbench Auto Start'
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host 'Automatic startup has been disabled.' -ForegroundColor Green
