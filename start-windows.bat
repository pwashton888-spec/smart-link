@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "package.json" (
  echo.
  echo [!] Project files not found. Please EXTRACT the zip first:
  echo     Right-click smart-link-ready.zip ^> Extract All ^> Extract,
  echo     then run start-windows.bat from the extracted smart-link folder.
  echo.
  pause
  exit /b 1
)
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
