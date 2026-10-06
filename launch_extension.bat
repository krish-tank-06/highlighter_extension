@echo off
setlocal
set "CHROME_EXE="

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not defined CHROME_EXE (
    echo Google Chrome was not found. Install Chrome or load the src folder manually at chrome://extensions.
    pause
    exit /b 1
)

set "EXTENSION_DIR=%~dp0src"
set "PROFILE_DIR=%TEMP%\MultiHighlight-Chrome-Profile"
echo Opening Chrome with Multi Highlight in its own test profile...
start "" "%CHROME_EXE%" --user-data-dir="%PROFILE_DIR%" --no-first-run --no-default-browser-check --load-extension="%EXTENSION_DIR%" "https://en.wikipedia.org/wiki/Web_browser"
endlocal
