@echo off
title Netra32 Installer
echo ==========================================
echo       NETRA32 DEPENDENCY INSTALLER
echo ==========================================
echo [1/4] Installing Python AI Engine dependencies...
pip install numpy scipy

echo.
echo [2/4] Installing Backend Node.js dependencies...
cd /d "%~dp0backend"
call npm install

echo.
echo [3/4] Installing Frontend Node.js dependencies...
cd /d "%~dp0frontend"
call npm install

echo.
echo [4/4] Building Frontend UI Bundle...
call npm run build

echo.
echo ==========================================
echo       INSTALLATION COMPLETED SUCCESSFULLY!
echo ==========================================
echo You can now double-click "Launch Netra32.bat" to start the app.
echo.
pause
exit
