@echo off
title Backup Tools Launcher
cls

echo.
echo ============================================
echo      BACKUP TOOLS LAUNCHER
echo ============================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python from https://python.org
    echo.
    pause
    exit /b 1
)

echo Python detected - Starting backup tools launcher...
echo.

REM Launch the simple launcher (no Unicode issues)
python launch-backup-simple.py

echo.
echo Backup Tools Launcher closed
pause