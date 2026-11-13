@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "FITCARD_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  ) else (
    echo Node.js 20 or newer is required. Install Node.js, then try again.
    pause
    exit /b 1
  )
) else (
  set "FITCARD_NODE=node"
)
echo Open http://127.0.0.1:4173 in your browser.
echo Press Ctrl+C to stop the local server.
"%FITCARD_NODE%" scripts\serve.mjs
pause
