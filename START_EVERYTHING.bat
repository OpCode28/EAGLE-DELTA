@echo off
REM EAGLE-Δ System Starter for Windows
echo ========================================
echo   Starting EAGLE-Δ System...
echo ========================================

echo [1/3] Checking dependencies...
if not exist "backend\node_modules" (
    echo Warning: backend\node_modules not found, please run 'cd backend; npm install' first
)
if not exist "frontend\node_modules" (
    echo Warning: frontend\node_modules not found, please run 'cd frontend; npm install' first
)
if not exist "frontend\dist" (
    echo Warning: frontend\dist not found, please run 'cd frontend; npm run build' first
)

echo.
echo [2/3] Initializing database...
cd backend
node -e "require('./config/database.js').initSchema();"
cd ..

echo.
echo [3/3] Starting Electron App (backend + frontend)...
echo.
echo ========================================
echo   EAGLE-Δ is starting!
echo   Backend: http://localhost:4032
echo ========================================
echo.

npm start
