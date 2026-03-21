@echo off
title Complete Backup Suite Launcher
color 0A

echo.
echo ===============================================
echo    🛡️  COMPLETE BACKUP SUITE LAUNCHER  🛡️
echo ===============================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Python is not installed or not in PATH
    echo.
    echo Please install Python from https://python.org
    echo Make sure to check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
)

echo ✅ Python detected
echo.

REM Check if backup suite files exist
if not exist "backup-suite.py" (
    echo ❌ ERROR: Backup suite files not found
    echo Please ensure you're running this from the correct directory
    echo.
    pause
    exit /b 1
)

echo ✅ Backup suite files found
echo.

REM Install dependencies if needed
echo 📦 Checking dependencies...
python -c "import schedule, psutil, pandas" >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Installing required dependencies...
    python -m pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        echo You may need to run as Administrator
        echo.
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed successfully
) else (
    echo ✅ Dependencies already available
)

echo.
echo 🚀 Launching Complete Backup Suite...
echo.

REM Launch the main backup suite
python backup-suite.py

if %errorlevel% neq 0 (
    echo.
    echo ❌ Error launching backup suite
    echo.
    pause
)

echo.
echo 👋 Backup Suite closed
pause