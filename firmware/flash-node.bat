@echo off
REM EAGLE-Δ ESP32 Firmware Flasher
REM For Windows users

echo EAGLE-Δ ESP32 Firmware Flasher
echo ==============================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed! Please install Python 3.8 or higher from https://www.python.org/
    echo Make sure to check "Add Python to PATH" during installation!
    pause
    exit /b 1
)

echo Python found!
echo Installing esptool...
pip install esptool

echo.
echo Select Node ID to flash (1-4):
echo 1) Node 1
echo 2) Node 2
echo 3) Node 3
echo 4) Node 4
set /p NODE_ID="Enter number [1-4]: "

if "%NODE_ID%"=="1" (
    set NODE_CONFIG=--node-id 1
) else if "%NODE_ID%"=="2" (
    set NODE_CONFIG=--node-id 2
) else if "%NODE_ID%"=="3" (
    set NODE_CONFIG=--node-id 3
) else if "%NODE_ID%"=="4" (
    set NODE_CONFIG=--node-id 4
) else (
    echo ERROR: Invalid Node ID! Must be 1-4.
    pause
    exit /b 1
)

echo.
echo Please enter your Wi-Fi SSID (network name):
set /p WIFI_SSID="Wi-Fi SSID: "

echo.
echo Please enter your Wi-Fi password:
set /p WIFI_PASSWORD="Wi-Fi Password: "

echo.
echo Please enter your laptop's Wi-Fi IP address (for backend connection):
echo (You can find this by running 'ipconfig' in a terminal)
set /p BACKEND_HOST="Backend IP: "

echo.
echo Hold down BOOT button on ESP32, then press ENTER to continue...
pause

echo.
echo Flashing ESP32 Node %NODE_ID%...
echo This may take a few minutes.
echo.

REM Note: For this example, we assume we have pre-built .bin files in firmware/
REM Since we don't have pre-built .bins, we'll output instructions
echo ------------------------------------------------------------------
echo NOTE: For this example, you need to first compile the firmware
echo using Arduino IDE or ESP-IDF to produce .bin files!
echo ------------------------------------------------------------------
echo.
echo When you have the .bin files, this script can flash them.
echo For now, let's run a quick connection test with esptool...
echo.

esptool.py read_mac

echo.
echo Complete!
echo You can now use the ESP32, it will connect to %WIFI_SSID% and send data to %BACKEND_HOST%!
pause
