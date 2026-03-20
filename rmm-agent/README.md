# RMM Agent - Client Installation Package

This package contains everything needed to install the RMM monitoring agent on client PCs.

## 📦 Package Contents

- `rmm-agent.py` - Main monitoring agent
- `rmm-service.py` - Windows service wrapper
- `install-agent.bat` - One-click installer
- `requirements.txt` - Python dependencies
- `README.md` - This file

## 🚀 Quick Installation

### **For Client PCs (Windows):**

1. **Copy this folder** to the client PC
2. **Run as Administrator**: `install-agent.bat`
3. **Enter your details** when prompted:
   - Dashboard URL: `https://your-dashboard.vercel.app`
   - API Key: `your-rmm-api-key`

The installer will:
- Install Python dependencies
- Create configuration file
- Install as Windows service
- Start monitoring automatically

## 📊 What It Monitors

### **System Metrics** (every 5 minutes)
- CPU usage and core count
- Memory utilization (RAM + swap)
- Disk usage by drive
- Network I/O statistics
- System uptime

### **Asset Inventory** (every hour)
- Hardware specifications
- Installed software list
- Operating system details
- Network configuration

### **Security Status** (every hour)
- Windows Defender status
- Windows Update status
- Pending updates count

### **Process Monitoring** (every 5 minutes)
- Top 50 processes by memory usage
- CPU and memory per process

## ⚙️ Configuration

Edit `C:\RMM-Agent\rmm-config.json`:

```json
{
  "server_url": "https://your-dashboard.vercel.app",
  "api_key": "your-api-key",
  "poll_interval": 300,
  "agent_version": "1.0.0"
}
```

## 🔧 Management Commands

```cmd
# Check service status
sc query "RMM Agent"

# Restart service
net stop "RMM Agent"
net start "RMM Agent"

# View logs
notepad C:\RMM-Agent\rmm-agent.log

# Uninstall service
cd C:\RMM-Agent
python rmm-service.py remove
```

## 🔍 Troubleshooting

### **Agent Not Appearing in Dashboard:**
1. Check internet connectivity
2. Verify server URL is correct
3. Confirm API key matches server
4. Check Windows Firewall allows outbound HTTPS

### **Service Won't Start:**
1. Run as Administrator: `python rmm-agent.py`
2. Check logs: `C:\RMM-Agent\rmm-agent.log`
3. Verify Python dependencies: `pip install -r requirements.txt`

### **Permission Errors:**
1. Run installer as Administrator
2. Ensure Python has proper permissions
3. Check Windows Defender isn't blocking

## 📁 File Locations

- **Installation**: `C:\RMM-Agent\`
- **Configuration**: `C:\RMM-Agent\rmm-config.json`
- **Logs**: `C:\RMM-Agent\rmm-agent.log`
- **Service Name**: "RMM Agent"

## 🔒 Security

- **Encrypted transport**: All data sent via HTTPS
- **API authentication**: Bearer token validation
- **Unique endpoint ID**: Hardware-based identification
- **Read-only monitoring**: Agent only collects data, no remote execution

## 📋 Requirements

- **OS**: Windows 10/11 (32-bit or 64-bit)
- **Python**: 3.7+ (usually pre-installed)
- **Network**: Outbound HTTPS (port 443)
- **Permissions**: Administrator for installation

## 🆘 Support

If you encounter issues:
1. Check the log file for error details
2. Verify network connectivity to dashboard
3. Ensure API key is correct
4. Contact IT support with log file details

## 📈 Data Usage

The agent sends approximately:
- **5KB per heartbeat** (every 5 minutes)
- **20KB per system report** (every 5 minutes)
- **100KB per asset inventory** (every hour)

**Total**: ~15MB per month per endpoint