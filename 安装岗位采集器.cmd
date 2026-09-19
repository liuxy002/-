@echo off
setlocal
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" (
  echo Microsoft Edge was not found.
  pause
  exit /b 1
)
start "" "%EDGE%" "edge://extensions/"
start "" "%~dp0browser-extension"
echo.
echo Edge Extensions page and the browser-extension folder were opened.
echo 1. Turn on Developer mode.
echo 2. Click Load unpacked.
echo 3. Select the browser-extension folder.
pause
