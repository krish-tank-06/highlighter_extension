@echo off
echo Starting Google Chrome with Multi Highlight Extension...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --load-extension="%~dp0src" "https://en.wikipedia.org/wiki/Web_browser"
exit
