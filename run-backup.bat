@echo off
echo Starting Simple Backup Tool...

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python from https://python.org
    pause
    exit /b 1
)

REM Run the backup tool with GUI
python backup-tool.py --gui

pause