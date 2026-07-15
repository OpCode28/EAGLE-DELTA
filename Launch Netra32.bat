@echo off
title Netra32 Launcher
echo ==========================================
echo       NETRA32 PORTABLE SYSTEM BOOT
echo ==========================================
echo [1/3] Launching Backend Telemetry Server...

:: Resolve path relative to the script's current directory
cd /d "%~dp0backend"
start "Netra32 Backend Server" /min node server.js

echo [2/3] Waiting for AI Engine initialization...
timeout /t 4 /nobreak >nul

echo [3/3] Launching Electron Dashboard...
cd /d "%~dp0frontend"
call npm run electron

echo ==========================================
echo       SHUTTING DOWN NETRA32 SERVICES
echo ==========================================
echo Cleaning up background server and freeing ports...
taskkill /f /im node.exe

echo All services cleanly shut down.
timeout /t 2 >nul
exit
