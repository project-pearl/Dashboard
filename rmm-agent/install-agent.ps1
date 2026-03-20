# RMM Agent PowerShell Installer
# Run as Administrator

param(
    [Parameter(Mandatory=$false)]
    [string]$ServerUrl,

    [Parameter(Mandatory=$false)]
    [string]$ApiKey,

    [Parameter(Mandatory=$false)]
    [string]$InstallPath = "C:\RMM-Agent"
)

Write-Host "RMM Agent Installer" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green

# Check for admin privileges
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script requires administrator privileges. Please run as Administrator."
    Read-Host "Press Enter to exit"
    exit 1
}

# Create installation directory
Write-Host "Creating installation directory: $InstallPath" -ForegroundColor Yellow
if (!(Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
}

# Copy agent files
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$filesToCopy = @("rmm-agent.py", "rmm-service.py", "requirements.txt")

Write-Host "Copying agent files..." -ForegroundColor Yellow
foreach ($file in $filesToCopy) {
    $sourcePath = Join-Path $scriptDir $file
    $destPath = Join-Path $InstallPath $file

    if (Test-Path $sourcePath) {
        Copy-Item $sourcePath $destPath -Force
        Write-Host "  Copied: $file" -ForegroundColor Gray
    } else {
        Write-Warning "Source file not found: $file"
    }
}

# Change to installation directory
Set-Location $InstallPath

# Check Python installation
Write-Host "Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = & python --version 2>&1
    Write-Host "  Found: $pythonVersion" -ForegroundColor Gray
} catch {
    Write-Error "Python not found. Please install Python 3.7+ first."
    Read-Host "Press Enter to exit"
    exit 1
}

# Install Python dependencies
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
try {
    & python -m pip install -r requirements.txt
    Write-Host "  Dependencies installed successfully" -ForegroundColor Gray
} catch {
    Write-Error "Failed to install dependencies. Check your Python installation."
    Read-Host "Press Enter to exit"
    exit 1
}

# Get configuration from user if not provided
if (-not $ServerUrl) {
    $ServerUrl = Read-Host "Enter your Dashboard URL (e.g., https://your-dashboard.vercel.app)"
}

if (-not $ApiKey) {
    $ApiKey = Read-Host "Enter your RMM API Key"
}

# Validate inputs
if (-not $ServerUrl -or -not $ApiKey) {
    Write-Error "Server URL and API Key are required."
    Read-Host "Press Enter to exit"
    exit 1
}

# Create configuration file
Write-Host "Creating configuration file..." -ForegroundColor Yellow
$config = @{
    server_url = $ServerUrl
    api_key = $ApiKey
    poll_interval = 300
    agent_version = "1.0.0"
    endpoints = @{
        heartbeat = "/api/rmm/heartbeat"
        system_data = "/api/rmm/system-data"
        processes = "/api/rmm/processes"
        assets = "/api/rmm/assets"
        alerts = "/api/rmm/alerts"
    }
} | ConvertTo-Json -Depth 3

$config | Out-File -FilePath "rmm-config.json" -Encoding UTF8
Write-Host "  Configuration saved to: rmm-config.json" -ForegroundColor Gray

# Install Windows service
Write-Host "Installing Windows service..." -ForegroundColor Yellow
try {
    & python rmm-service.py install
    Write-Host "  Service installed successfully" -ForegroundColor Gray
} catch {
    Write-Warning "Service installation failed. You may need to install manually."
}

# Start the service
Write-Host "Starting RMM Agent service..." -ForegroundColor Yellow
try {
    Start-Service -Name "RMM Agent"
    Write-Host "  Service started successfully" -ForegroundColor Gray
} catch {
    Write-Warning "Failed to start service. You may need to start manually."
}

# Test connection
Write-Host "Testing connection to server..." -ForegroundColor Yellow
try {
    $testUrl = "$ServerUrl/api/rmm/status"
    $response = Invoke-WebRequest -Uri $testUrl -Method GET -TimeoutSec 10 -UseBasicParsing
    Write-Host "  Server connection: OK" -ForegroundColor Green
} catch {
    Write-Warning "Unable to connect to server. Please check your URL and network connectivity."
}

# Installation complete
Write-Host ""
Write-Host "RMM Agent Installation Complete!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host "Installation Path: $InstallPath"
Write-Host "Configuration: $InstallPath\rmm-config.json"
Write-Host "Logs: $InstallPath\rmm-agent.log"
Write-Host "Service Name: RMM Agent"
Write-Host ""
Write-Host "The agent is now running and will start automatically on boot."
Write-Host ""
Write-Host "Management Commands:"
Write-Host "  View Status: Get-Service 'RMM Agent'"
Write-Host "  Restart: Restart-Service 'RMM Agent'"
Write-Host "  Stop: Stop-Service 'RMM Agent'"
Write-Host "  Uninstall: python rmm-service.py remove"
Write-Host ""

Read-Host "Press Enter to exit"