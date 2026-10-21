@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Smart Link Workspace - installing (first run takes a few minutes)...
call npm install
if errorlevel 1 (
  echo.
  echo npm install failed. Please make sure Node.js 18+ is installed: https://nodejs.org
  pause
  exit /b 1
)
start "" http://localhost:5173
call npm run dev
pause
