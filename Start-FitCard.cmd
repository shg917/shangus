@echo off
cd /d "%~dp0"
where pnpm >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 and pnpm 11.25.0 before running FitCard.
  pause
  exit /b 1
)
if not exist node_modules\.bin\vite.cmd (
  call pnpm install --frozen-lockfile
  if errorlevel 1 exit /b 1
)
call pnpm dev --port 4175 --strictPort
pause
