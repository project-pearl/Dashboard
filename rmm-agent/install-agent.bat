@echo off
echo Installing RMM Agent...

:: Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo This script requires administrator privileges.
    echo Please run as administrator.
    pause
    exit /b 1
)

:: Create agent directory
mkdir "C:\RMM-Agent" 2>nul
cd /d "C:\RMM-Agent"

:: Copy files
copy "%~dp0rmm-agent.py" "rmm-agent.py"
copy "%~dp0requirements.txt" "requirements.txt"
copy "%~dp0rmm-service.py" "rmm-service.py"

:: Install Python dependencies
echo Installing Python dependencies...
python -m pip install -r requirements.txt

:: Prompt for configuration
echo.
echo RMM Agent Configuration
echo ======================
set /p SERVER_URL="Enter your Dashboard URL (e.g., https://your-dashboard.vercel.app): "
set /p API_KEY="Enter your RMM API Key: "

:: Create configuration file
echo {> rmm-config.json
echo   "server_url": "%SERVER_URL%",>> rmm-config.json
echo   "api_key": "%API_KEY%",>> rmm-config.json
echo   "poll_interval": 300,>> rmm-config.json
echo   "agent_version": "1.0.0",>> rmm-config.json
echo   "endpoints": {>> rmm-config.json
echo     "heartbeat": "/api/rmm/heartbeat",>> rmm-config.json
echo     "system_data": "/api/rmm/system-data",>> rmm-config.json
echo     "processes": "/api/rmm/processes",>> rmm-config.json
echo     "assets": "/api/rmm/assets",>> rmm-config.json
echo     "alerts": "/api/rmm/alerts">> rmm-config.json
echo   }>> rmm-config.json
echo }>> rmm-config.json

:: Install as Windows service
echo Installing Windows service...
python rmm-service.py install

:: Start the service
echo Starting RMM Agent service...
net start "RMM Agent"

echo.
echo RMM Agent installation complete!
echo Service is running and will start automatically on boot.
echo.
echo Configuration file: C:\RMM-Agent\rmm-config.json
echo Logs location: C:\RMM-Agent\rmm-agent.log
echo.
echo To uninstall: python rmm-service.py remove
echo To restart: net stop "RMM Agent" && net start "RMM Agent"
echo.
pause