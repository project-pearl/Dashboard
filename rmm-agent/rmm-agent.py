#!/usr/bin/env python3
"""
RMM Agent - Lightweight client for endpoint monitoring
Replaces ATERA functionality with custom solution
"""

import json
import time
import requests
import platform
import psutil
import socket
import subprocess
import os
import sys
from datetime import datetime, timezone
import hashlib
import winreg
import wmi
from typing import Dict, List, Any, Optional

class RMMAgent:
    def __init__(self, config_file: str = "rmm-config.json"):
        """Initialize RMM agent with configuration"""
        self.config = self.load_config(config_file)
        self.endpoint_id = self.get_endpoint_id()
        self.wmi_conn = wmi.WMI()

    def load_config(self, config_file: str) -> Dict[str, Any]:
        """Load agent configuration"""
        default_config = {
            "server_url": "https://your-dashboard.vercel.app",
            "api_key": "",
            "poll_interval": 300,  # 5 minutes
            "agent_version": "1.0.0",
            "endpoints": {
                "heartbeat": "/api/rmm/heartbeat",
                "system_data": "/api/rmm/system-data",
                "processes": "/api/rmm/processes",
                "assets": "/api/rmm/assets",
                "alerts": "/api/rmm/alerts"
            }
        }

        try:
            with open(config_file, 'r') as f:
                user_config = json.load(f)
                default_config.update(user_config)
        except FileNotFoundError:
            # Create default config file
            with open(config_file, 'w') as f:
                json.dump(default_config, f, indent=2)
            print(f"Created default config file: {config_file}")
            print("Please edit the config file with your server URL and API key")

        return default_config

    def get_endpoint_id(self) -> str:
        """Generate unique endpoint ID based on hardware"""
        # Use MAC address + hostname for unique ID
        try:
            import uuid
            mac = uuid.UUID(int=uuid.getnode()).hex[-12:]
        except:
            mac = 'unknown'

        hostname = socket.gethostname()
        unique_string = f"{mac}-{hostname}"
        return hashlib.sha256(unique_string.encode()).hexdigest()[:16]

    def collect_system_data(self) -> Dict[str, Any]:
        """Collect comprehensive system metrics"""
        try:
            # CPU Information
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            cpu_freq = psutil.cpu_freq()

            # Memory Information
            memory = psutil.virtual_memory()
            swap = psutil.swap_memory()

            # Disk Information
            disks = []
            for partition in psutil.disk_partitions():
                try:
                    disk_usage = psutil.disk_usage(partition.mountpoint)
                    disks.append({
                        "device": partition.device,
                        "mountpoint": partition.mountpoint,
                        "fstype": partition.fstype,
                        "total_gb": round(disk_usage.total / (1024**3), 2),
                        "used_gb": round(disk_usage.used / (1024**3), 2),
                        "free_gb": round(disk_usage.free / (1024**3), 2),
                        "percent_used": round((disk_usage.used / disk_usage.total) * 100, 2)
                    })
                except PermissionError:
                    continue

            # Network Information
            network_io = psutil.net_io_counters()
            network_interfaces = []
            for interface, addresses in psutil.net_if_addrs().items():
                for addr in addresses:
                    if addr.family == socket.AF_INET:  # IPv4
                        network_interfaces.append({
                            "interface": interface,
                            "ip_address": addr.address,
                            "netmask": addr.netmask
                        })

            # System Information
            boot_time = datetime.fromtimestamp(psutil.boot_time(), tz=timezone.utc)

            return {
                "endpoint_id": self.endpoint_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "hostname": socket.gethostname(),
                "platform": {
                    "system": platform.system(),
                    "release": platform.release(),
                    "version": platform.version(),
                    "architecture": platform.architecture()[0],
                    "processor": platform.processor()
                },
                "cpu": {
                    "percent": cpu_percent,
                    "count": cpu_count,
                    "frequency_mhz": cpu_freq.current if cpu_freq else None
                },
                "memory": {
                    "total_gb": round(memory.total / (1024**3), 2),
                    "available_gb": round(memory.available / (1024**3), 2),
                    "used_gb": round(memory.used / (1024**3), 2),
                    "percent": memory.percent
                },
                "swap": {
                    "total_gb": round(swap.total / (1024**3), 2),
                    "used_gb": round(swap.used / (1024**3), 2),
                    "percent": swap.percent
                },
                "disks": disks,
                "network": {
                    "bytes_sent": network_io.bytes_sent,
                    "bytes_recv": network_io.bytes_recv,
                    "packets_sent": network_io.packets_sent,
                    "packets_recv": network_io.packets_recv,
                    "interfaces": network_interfaces
                },
                "uptime_hours": round((datetime.now(timezone.utc) - boot_time).total_seconds() / 3600, 2),
                "boot_time": boot_time.isoformat()
            }
        except Exception as e:
            print(f"Error collecting system data: {e}")
            return {"error": str(e)}

    def collect_process_data(self) -> List[Dict[str, Any]]:
        """Collect running process information"""
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'create_time']):
            try:
                proc_info = proc.info
                processes.append({
                    "pid": proc_info['pid'],
                    "name": proc_info['name'],
                    "cpu_percent": round(proc_info['cpu_percent'] or 0, 2),
                    "memory_percent": round(proc_info['memory_percent'] or 0, 2),
                    "created": datetime.fromtimestamp(proc_info['create_time'], tz=timezone.utc).isoformat()
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        return sorted(processes, key=lambda x: x['memory_percent'], reverse=True)[:50]  # Top 50 by memory

    def collect_asset_data(self) -> Dict[str, Any]:
        """Collect hardware and software asset information"""
        try:
            assets = {
                "endpoint_id": self.endpoint_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "hardware": {},
                "software": []
            }

            # Hardware via WMI (Windows)
            if platform.system() == "Windows":
                try:
                    # System information
                    for system in self.wmi_conn.Win32_ComputerSystem():
                        assets["hardware"]["system"] = {
                            "manufacturer": system.Manufacturer,
                            "model": system.Model,
                            "total_memory_gb": round(int(system.TotalPhysicalMemory) / (1024**3), 2) if system.TotalPhysicalMemory else None
                        }

                    # CPU information
                    for cpu in self.wmi_conn.Win32_Processor():
                        assets["hardware"]["cpu"] = {
                            "name": cpu.Name,
                            "manufacturer": cpu.Manufacturer,
                            "cores": cpu.NumberOfCores,
                            "threads": cpu.NumberOfLogicalProcessors,
                            "max_speed_ghz": round(cpu.MaxClockSpeed / 1000, 2) if cpu.MaxClockSpeed else None
                        }
                        break  # Take first CPU

                    # Installed software
                    software_list = []
                    try:
                        # Check both 32-bit and 64-bit registry locations
                        registry_paths = [
                            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
                            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall")
                        ]

                        for hkey, path in registry_paths:
                            try:
                                with winreg.OpenKey(hkey, path) as key:
                                    for i in range(winreg.QueryInfoKey(key)[0]):
                                        try:
                                            subkey_name = winreg.EnumKey(key, i)
                                            with winreg.OpenKey(key, subkey_name) as subkey:
                                                try:
                                                    name = winreg.QueryValueEx(subkey, "DisplayName")[0]
                                                    version = "Unknown"
                                                    publisher = "Unknown"

                                                    try:
                                                        version = winreg.QueryValueEx(subkey, "DisplayVersion")[0]
                                                    except FileNotFoundError:
                                                        pass

                                                    try:
                                                        publisher = winreg.QueryValueEx(subkey, "Publisher")[0]
                                                    except FileNotFoundError:
                                                        pass

                                                    software_list.append({
                                                        "name": name,
                                                        "version": version,
                                                        "publisher": publisher
                                                    })
                                                except FileNotFoundError:
                                                    continue
                                        except OSError:
                                            continue
                            except OSError:
                                continue

                        assets["software"] = sorted(software_list, key=lambda x: x['name'])

                    except Exception as e:
                        print(f"Error collecting software inventory: {e}")
                        assets["software"] = []
                except Exception as e:
                    print(f"Error collecting hardware info: {e}")

            return assets

        except Exception as e:
            print(f"Error collecting asset data: {e}")
            return {"error": str(e)}

    def check_security_status(self) -> Dict[str, Any]:
        """Check security-related status (Windows Defender, Updates, etc.)"""
        security_status = {
            "endpoint_id": self.endpoint_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "antivirus": {"status": "unknown"},
            "windows_updates": {"status": "unknown"},
            "firewall": {"status": "unknown"}
        }

        if platform.system() == "Windows":
            try:
                # Check Windows Defender status
                try:
                    defender_result = subprocess.run([
                        "powershell", "-Command",
                        "Get-MpComputerStatus | ConvertTo-Json"
                    ], capture_output=True, text=True, timeout=30)

                    if defender_result.returncode == 0 and defender_result.stdout.strip():
                        defender_data = json.loads(defender_result.stdout)
                        security_status["antivirus"] = {
                            "status": "enabled" if defender_data.get("RealTimeProtectionEnabled") else "disabled",
                            "product": "Windows Defender",
                            "last_scan": defender_data.get("QuickScanStartTime"),
                            "signatures_updated": defender_data.get("AntivirusSignatureLastUpdated")
                        }
                except Exception as e:
                    print(f"Error checking Windows Defender: {e}")

                # Check Windows Update status
                try:
                    update_result = subprocess.run([
                        "powershell", "-Command",
                        "Get-WindowsUpdate | ConvertTo-Json"
                    ], capture_output=True, text=True, timeout=60)

                    if update_result.returncode == 0 and update_result.stdout.strip():
                        try:
                            update_data = json.loads(update_result.stdout)
                            if isinstance(update_data, list):
                                pending_count = len(update_data)
                            elif update_data:
                                pending_count = 1
                            else:
                                pending_count = 0

                            security_status["windows_updates"] = {
                                "status": "updates_available" if pending_count > 0 else "up_to_date",
                                "pending_count": pending_count
                            }
                        except json.JSONDecodeError:
                            security_status["windows_updates"]["status"] = "up_to_date"
                except Exception as e:
                    print(f"Error checking Windows Updates: {e}")

            except Exception as e:
                print(f"Error checking security status: {e}")

        return security_status

    def send_data(self, endpoint: str, data: Dict[str, Any]) -> bool:
        """Send data to RMM server"""
        try:
            url = f"{self.config['server_url']}{endpoint}"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.config['api_key']}",
                "User-Agent": f"RMM-Agent/{self.config['agent_version']}"
            }

            response = requests.post(url, json=data, headers=headers, timeout=30)
            response.raise_for_status()

            print(f"Successfully sent data to {endpoint}")
            return True

        except requests.exceptions.RequestException as e:
            print(f"Error sending data to {endpoint}: {e}")
            return False

    def send_heartbeat(self) -> bool:
        """Send heartbeat to confirm agent is alive"""
        heartbeat_data = {
            "endpoint_id": self.endpoint_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "agent_version": self.config["agent_version"],
            "hostname": socket.gethostname()
        }

        return self.send_data(self.config["endpoints"]["heartbeat"], heartbeat_data)

    def run_collection_cycle(self):
        """Run a complete data collection cycle"""
        print(f"Starting collection cycle for endpoint {self.endpoint_id}")

        # Send heartbeat
        self.send_heartbeat()

        # Collect and send system data
        system_data = self.collect_system_data()
        if "error" not in system_data:
            self.send_data(self.config["endpoints"]["system_data"], system_data)

        # Collect and send process data
        process_data = {
            "endpoint_id": self.endpoint_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "processes": self.collect_process_data()
        }
        self.send_data(self.config["endpoints"]["processes"], process_data)

        print("Collection cycle completed")

    def run_asset_collection(self):
        """Run asset inventory collection (less frequent)"""
        print("Starting asset inventory collection")

        asset_data = self.collect_asset_data()
        if "error" not in asset_data:
            self.send_data(self.config["endpoints"]["assets"], asset_data)

        security_data = self.check_security_status()
        self.send_data(self.config["endpoints"]["alerts"], security_data)

        print("Asset inventory completed")

    def run(self):
        """Main agent loop"""
        print(f"RMM Agent starting - Endpoint ID: {self.endpoint_id}")
        print(f"Server: {self.config['server_url']}")
        print(f"Poll interval: {self.config['poll_interval']} seconds")

        cycle_count = 0

        while True:
            try:
                # Regular collection every poll interval
                self.run_collection_cycle()

                # Asset collection every 12 cycles (1 hour if 5min intervals)
                if cycle_count % 12 == 0:
                    self.run_asset_collection()

                cycle_count += 1
                time.sleep(self.config["poll_interval"])

            except KeyboardInterrupt:
                print("\nAgent stopped by user")
                break
            except Exception as e:
                print(f"Error in agent loop: {e}")
                time.sleep(60)  # Wait 1 minute before retrying

def main():
    """Main entry point"""
    if len(sys.argv) > 1:
        config_file = sys.argv[1]
    else:
        config_file = "rmm-config.json"

    agent = RMMAgent(config_file)
    agent.run()

if __name__ == "__main__":
    main()