#!/usr/bin/env python3
"""
Advanced Backup Tool with Scheduling and Smart Logic
Enhanced version with automated scheduling, retention policies, and intelligent backup decisions
"""

import os
import shutil
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import schedule
import time
import threading
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import argparse
import hashlib
import json
import psutil
from datetime import datetime, timedelta
from pathlib import Path
import subprocess
import platform

class AdvancedBackupTool:
    def __init__(self):
        self.config_file = "advanced_backup_config.json"
        self.log_file = "backup_log.txt"
        self.scheduler_thread = None
        self.scheduler_running = False
        self.load_config()

    def load_config(self):
        """Load advanced backup configuration from file"""
        default_config = {
            "source_folders": [],
            "backup_destination": "",
            "schedules": {
                "daily": {"enabled": False, "time": "02:00", "type": "incremental"},
                "weekly": {"enabled": False, "day": "sunday", "time": "03:00", "type": "full"},
                "monthly": {"enabled": False, "day": 1, "time": "04:00", "type": "full"}
            },
            "retention": {
                "keep_daily": 7,
                "keep_weekly": 4,
                "keep_monthly": 12,
                "auto_cleanup": True
            },
            "conditions": {
                "min_free_space_gb": 10,
                "max_backup_size_gb": 100,
                "only_if_changes": True,
                "skip_if_battery": True,
                "max_cpu_percent": 80
            },
            "notifications": {
                "email_enabled": False,
                "email_smtp": "smtp.gmail.com",
                "email_port": 587,
                "email_user": "",
                "email_password": "",
                "email_to": "",
                "notify_on_success": False,
                "notify_on_failure": True
            },
            "exclude_patterns": [".tmp", ".log", "__pycache__", ".git", "node_modules", "*.iso"],
            "bandwidth_limit_mbps": 0,  # 0 = unlimited
            "verify_backups": True
        }

        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    loaded_config = json.load(f)
                    # Merge with defaults to handle new settings
                    self.config = {**default_config, **loaded_config}
            else:
                self.config = default_config
        except Exception as e:
            print(f"Error loading config: {e}")
            self.config = default_config

    def save_config(self):
        """Save backup configuration to file"""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            print(f"Error saving config: {e}")

    def log_message(self, message, level="INFO"):
        """Enhanced logging with levels"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] [{level}] {message}"
        print(log_entry)

        try:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(log_entry + "\n")
        except Exception as e:
            print(f"Error writing to log: {e}")

    def check_system_conditions(self):
        """Check if system conditions are suitable for backup"""
        conditions = self.config.get("conditions", {})

        # Check free space
        min_space = conditions.get("min_free_space_gb", 10) * 1024 * 1024 * 1024
        if self.config.get("backup_destination"):
            try:
                free_space = shutil.disk_usage(self.config["backup_destination"]).free
                if free_space < min_space:
                    self.log_message(f"Insufficient free space: {free_space/1024**3:.1f}GB < {min_space/1024**3:.1f}GB", "WARNING")
                    return False
            except Exception as e:
                self.log_message(f"Error checking disk space: {e}", "ERROR")
                return False

        # Check battery status (skip backup if on battery and configured to do so)
        if conditions.get("skip_if_battery", True):
            try:
                battery = psutil.sensors_battery()
                if battery and not battery.power_plugged:
                    self.log_message("Skipping backup: running on battery", "INFO")
                    return False
            except:
                pass  # Battery info not available on some systems

        # Check CPU usage
        max_cpu = conditions.get("max_cpu_percent", 80)
        current_cpu = psutil.cpu_percent(interval=1)
        if current_cpu > max_cpu:
            self.log_message(f"High CPU usage: {current_cpu}% > {max_cpu}%", "WARNING")
            return False

        return True

    def has_changes_since_last_backup(self):
        """Check if there have been changes since last backup"""
        if not self.config.get("conditions", {}).get("only_if_changes", True):
            return True

        try:
            # Simple check: compare modification times
            last_backup_file = os.path.join(os.path.dirname(self.config_file), ".last_backup_check")

            if not os.path.exists(last_backup_file):
                return True

            last_check = os.path.getmtime(last_backup_file)

            for folder in self.config.get("source_folders", []):
                if not os.path.exists(folder):
                    continue

                for root, dirs, files in os.walk(folder):
                    for file in files[:50]:  # Check first 50 files for performance
                        file_path = os.path.join(root, file)
                        if os.path.getmtime(file_path) > last_check:
                            # Update check file
                            with open(last_backup_file, 'w') as f:
                                f.write(str(time.time()))
                            return True

            return False

        except Exception as e:
            self.log_message(f"Error checking for changes: {e}", "WARNING")
            return True  # Assume changes if we can't check

    def cleanup_old_backups(self):
        """Clean up old backups based on retention policy"""
        if not self.config.get("retention", {}).get("auto_cleanup", True):
            return

        try:
            backup_root = self.config.get("backup_destination")
            if not backup_root or not os.path.exists(backup_root):
                return

            retention = self.config.get("retention", {})
            keep_daily = retention.get("keep_daily", 7)
            keep_weekly = retention.get("keep_weekly", 4)
            keep_monthly = retention.get("keep_monthly", 12)

            # Get all backup folders
            backup_folders = []
            for item in os.listdir(backup_root):
                if item.startswith("backup_"):
                    try:
                        # Parse timestamp from folder name
                        timestamp_str = item.replace("backup_", "")
                        timestamp = datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
                        backup_folders.append((timestamp, os.path.join(backup_root, item)))
                    except ValueError:
                        continue

            backup_folders.sort(reverse=True)  # Newest first

            # Categorize backups
            now = datetime.now()
            daily_cutoff = now - timedelta(days=keep_daily)
            weekly_cutoff = now - timedelta(weeks=keep_weekly)
            monthly_cutoff = now - timedelta(days=keep_monthly * 30)

            folders_to_delete = []
            weekly_kept = {}
            monthly_kept = {}

            for timestamp, folder_path in backup_folders:
                if timestamp > daily_cutoff:
                    continue  # Keep all recent daily backups

                elif timestamp > weekly_cutoff:
                    # Keep one per week
                    week_key = timestamp.strftime("%Y-%W")
                    if week_key not in weekly_kept:
                        weekly_kept[week_key] = folder_path
                        continue
                    else:
                        folders_to_delete.append(folder_path)

                elif timestamp > monthly_cutoff:
                    # Keep one per month
                    month_key = timestamp.strftime("%Y-%m")
                    if month_key not in monthly_kept:
                        monthly_kept[month_key] = folder_path
                        continue
                    else:
                        folders_to_delete.append(folder_path)

                else:
                    # Too old, delete
                    folders_to_delete.append(folder_path)

            # Delete old backups
            for folder_path in folders_to_delete:
                try:
                    self.log_message(f"Deleting old backup: {os.path.basename(folder_path)}")
                    shutil.rmtree(folder_path)
                except Exception as e:
                    self.log_message(f"Error deleting {folder_path}: {e}", "ERROR")

            if folders_to_delete:
                self.log_message(f"Cleaned up {len(folders_to_delete)} old backups")

        except Exception as e:
            self.log_message(f"Error during cleanup: {e}", "ERROR")

    def send_notification(self, subject, message, is_error=False):
        """Send email notification if configured"""
        notification_config = self.config.get("notifications", {})

        if not notification_config.get("email_enabled", False):
            return

        if is_error and not notification_config.get("notify_on_failure", True):
            return

        if not is_error and not notification_config.get("notify_on_success", False):
            return

        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = notification_config.get("email_user", "")
            msg['To'] = notification_config.get("email_to", "")
            msg['Subject'] = f"Backup Notification: {subject}"

            # Add timestamp and system info
            full_message = f"""
{message}

Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Computer: {platform.node()}
System: {platform.system()} {platform.release()}
"""
            msg.attach(MIMEText(full_message, 'plain'))

            # Send email
            server = smtplib.SMTP(notification_config.get("email_smtp", "smtp.gmail.com"),
                                notification_config.get("email_port", 587))
            server.starttls()
            server.login(notification_config["email_user"], notification_config["email_password"])
            server.send_message(msg)
            server.quit()

            self.log_message(f"Notification sent: {subject}")

        except Exception as e:
            self.log_message(f"Error sending notification: {e}", "ERROR")

    def verify_backup(self, backup_path):
        """Verify backup integrity by spot-checking files"""
        if not self.config.get("verify_backups", True):
            return True

        try:
            self.log_message("Verifying backup integrity...")

            # Count total files
            total_files = 0
            for root, dirs, files in os.walk(backup_path):
                total_files += len(files)

            if total_files == 0:
                self.log_message("Backup verification failed: no files found", "ERROR")
                return False

            # Spot check up to 10 files
            check_count = min(10, total_files)
            checked = 0

            for root, dirs, files in os.walk(backup_path):
                for file in files:
                    if checked >= check_count:
                        break

                    file_path = os.path.join(root, file)
                    if os.path.getsize(file_path) > 0:  # Simple check - file has content
                        checked += 1

                if checked >= check_count:
                    break

            self.log_message(f"Backup verification passed: checked {checked} files")
            return True

        except Exception as e:
            self.log_message(f"Backup verification error: {e}", "ERROR")
            return False

    def run_backup(self, backup_type="incremental", progress_callback=None):
        """Enhanced backup with type support and conditions"""

        # Check system conditions
        if not self.check_system_conditions():
            self.log_message("Backup skipped due to system conditions", "WARNING")
            return False

        # Check for changes if configured
        if backup_type == "incremental" and not self.has_changes_since_last_backup():
            self.log_message("No changes detected since last backup", "INFO")
            return True

        try:
            backup_root = self.config["backup_destination"]
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_session_folder = os.path.join(backup_root, f"backup_{timestamp}")

            self.log_message(f"Starting {backup_type} backup to: {backup_session_folder}")

            os.makedirs(backup_session_folder, exist_ok=True)

            # Store backup metadata
            metadata = {
                "timestamp": timestamp,
                "type": backup_type,
                "source_folders": self.config["source_folders"],
                "total_files": 0,
                "total_size": 0,
                "duration_seconds": 0
            }

            start_time = time.time()

            for source_folder in self.config["source_folders"]:
                if os.path.exists(source_folder):
                    folder_result = self.backup_folder(source_folder, backup_session_folder,
                                                    backup_type, progress_callback)
                    metadata["total_files"] += folder_result.get("files_copied", 0)
                    metadata["total_size"] += folder_result.get("bytes_copied", 0)

            metadata["duration_seconds"] = int(time.time() - start_time)

            # Save metadata
            with open(os.path.join(backup_session_folder, "backup_metadata.json"), 'w') as f:
                json.dump(metadata, f, indent=2)

            # Verify backup
            if not self.verify_backup(backup_session_folder):
                self.send_notification("Backup Verification Failed",
                                     f"Backup completed but verification failed for {backup_session_folder}", True)
                return False

            # Clean up old backups
            self.cleanup_old_backups()

            # Success notification
            success_msg = f"""
Backup completed successfully!

Type: {backup_type.title()}
Files: {metadata['total_files']:,}
Size: {metadata['total_size'] / 1024**3:.2f} GB
Duration: {metadata['duration_seconds']} seconds
Location: {backup_session_folder}
"""

            self.log_message(f"Backup completed successfully! {metadata['total_files']} files, {metadata['total_size'] / 1024**3:.2f} GB")
            self.send_notification("Backup Completed", success_msg, False)

            return True

        except Exception as e:
            error_msg = f"Backup failed: {str(e)}"
            self.log_message(error_msg, "ERROR")
            self.send_notification("Backup Failed", error_msg, True)
            return False

    def backup_folder(self, source_folder, backup_root, backup_type="incremental", progress_callback=None):
        """Enhanced folder backup with type support"""
        folder_name = os.path.basename(source_folder)
        backup_folder = os.path.join(backup_root, folder_name)

        # For full backups, ignore previous manifests
        if backup_type == "full":
            manifest = {}
        else:
            # Load manifest for incremental
            manifest_file = os.path.join(backup_folder, ".backup_manifest.json")
            manifest = {}
            if os.path.exists(manifest_file):
                try:
                    with open(manifest_file, 'r') as f:
                        manifest = json.load(f)
                except:
                    manifest = {}

        new_manifest = {}
        files_copied = 0
        files_skipped = 0
        bytes_copied = 0

        # Walk through source folder with bandwidth limiting
        for root, dirs, files in os.walk(source_folder):
            for file in files:
                src_file = os.path.join(root, file)

                if self.should_exclude_file(src_file):
                    continue

                rel_path = os.path.relpath(src_file, source_folder)
                dst_file = os.path.join(backup_folder, rel_path)

                try:
                    file_stat = os.stat(src_file)
                    current_hash = self.get_file_hash(src_file) if file_stat.st_size < 100*1024*1024 else "large_file"

                    new_manifest[rel_path] = {
                        "hash": current_hash,
                        "modified": file_stat.st_mtime,
                        "size": file_stat.st_size
                    }

                    # Skip if file hasn't changed (incremental only)
                    if (backup_type == "incremental" and rel_path in manifest and
                        manifest[rel_path].get("hash") == current_hash and
                        manifest[rel_path].get("modified") == file_stat.st_mtime):
                        files_skipped += 1
                        continue

                    # Copy the file with bandwidth limiting
                    if self.copy_file_with_bandwidth_limit(src_file, dst_file, progress_callback):
                        files_copied += 1
                        bytes_copied += file_stat.st_size

                except Exception as e:
                    self.log_message(f"Error processing {src_file}: {e}", "WARNING")

        # Save new manifest
        try:
            os.makedirs(backup_folder, exist_ok=True)
            manifest_file = os.path.join(backup_folder, ".backup_manifest.json")
            with open(manifest_file, 'w') as f:
                json.dump(new_manifest, f, indent=2)
        except Exception as e:
            self.log_message(f"Error saving manifest: {e}", "WARNING")

        self.log_message(f"Folder {folder_name}: {files_copied} copied, {files_skipped} skipped")

        return {
            "files_copied": files_copied,
            "files_skipped": files_skipped,
            "bytes_copied": bytes_copied
        }

    def copy_file_with_bandwidth_limit(self, src, dst, progress_callback=None):
        """Copy file with bandwidth limiting"""
        try:
            os.makedirs(os.path.dirname(dst), exist_ok=True)

            bandwidth_limit = self.config.get("bandwidth_limit_mbps", 0)

            if bandwidth_limit > 0:
                # Copy with bandwidth limiting
                bytes_per_second = bandwidth_limit * 1024 * 1024
                chunk_size = min(64*1024, bytes_per_second // 10)  # 10 chunks per second max

                with open(src, 'rb') as src_file, open(dst, 'wb') as dst_file:
                    start_time = time.time()
                    total_bytes = 0

                    while True:
                        chunk = src_file.read(chunk_size)
                        if not chunk:
                            break

                        dst_file.write(chunk)
                        total_bytes += len(chunk)

                        # Throttle if needed
                        elapsed = time.time() - start_time
                        expected_time = total_bytes / bytes_per_second
                        if elapsed < expected_time:
                            time.sleep(expected_time - elapsed)

                # Preserve file metadata
                shutil.copystat(src, dst)
            else:
                # Copy without bandwidth limiting
                shutil.copy2(src, dst)

            if progress_callback:
                progress_callback(src)

            return True

        except Exception as e:
            self.log_message(f"Error copying {src}: {e}", "WARNING")
            return False

    def get_file_hash(self, file_path):
        """Calculate MD5 hash of a file"""
        hash_md5 = hashlib.md5()
        try:
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except Exception as e:
            return None

    def should_exclude_file(self, file_path):
        """Check if file should be excluded"""
        file_name = os.path.basename(file_path).lower()
        file_path_lower = file_path.lower()

        for pattern in self.config.get("exclude_patterns", []):
            pattern = pattern.lower()
            if pattern.startswith("*"):
                if file_name.endswith(pattern[1:]):
                    return True
            elif pattern in file_name or pattern in file_path_lower:
                return True
        return False

    def setup_system_scheduler(self, schedule_config):
        """Setup OS-level scheduling"""
        try:
            system = platform.system().lower()

            if system == "windows":
                return self.setup_windows_scheduler(schedule_config)
            elif system in ["linux", "darwin"]:  # Linux or macOS
                return self.setup_unix_scheduler(schedule_config)
            else:
                self.log_message(f"System scheduling not supported for {system}", "WARNING")
                return False

        except Exception as e:
            self.log_message(f"Error setting up system scheduler: {e}", "ERROR")
            return False

    def setup_windows_scheduler(self, schedule_config):
        """Setup Windows Task Scheduler"""
        try:
            script_path = os.path.abspath(__file__)

            for schedule_name, config in schedule_config.items():
                if not config.get("enabled", False):
                    continue

                task_name = f"AdvancedBackup_{schedule_name}"

                # Create task command
                if schedule_name == "daily":
                    schedule_args = f'/sc daily /st {config["time"]}'
                elif schedule_name == "weekly":
                    day_map = {"monday": "MON", "tuesday": "TUE", "wednesday": "WED",
                             "thursday": "THU", "friday": "FRI", "saturday": "SAT", "sunday": "SUN"}
                    day = day_map.get(config.get("day", "sunday").lower(), "SUN")
                    schedule_args = f'/sc weekly /d {day} /st {config["time"]}'
                elif schedule_name == "monthly":
                    day = config.get("day", 1)
                    schedule_args = f'/sc monthly /d {day} /st {config["time"]}'

                cmd = f'schtasks /create /tn "{task_name}" /tr "python \\"{script_path}\\" --scheduled --type {config["type"]}" {schedule_args} /f'

                result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                if result.returncode == 0:
                    self.log_message(f"Created Windows scheduled task: {task_name}")
                else:
                    self.log_message(f"Error creating task {task_name}: {result.stderr}", "ERROR")

            return True

        except Exception as e:
            self.log_message(f"Error setting up Windows scheduler: {e}", "ERROR")
            return False

    def setup_unix_scheduler(self, schedule_config):
        """Setup Unix/Linux crontab"""
        try:
            script_path = os.path.abspath(__file__)
            cron_entries = []

            for schedule_name, config in schedule_config.items():
                if not config.get("enabled", False):
                    continue

                time_parts = config["time"].split(":")
                hour, minute = int(time_parts[0]), int(time_parts[1])

                if schedule_name == "daily":
                    cron_time = f"{minute} {hour} * * *"
                elif schedule_name == "weekly":
                    day_map = {"sunday": 0, "monday": 1, "tuesday": 2, "wednesday": 3,
                             "thursday": 4, "friday": 5, "saturday": 6}
                    day = day_map.get(config.get("day", "sunday").lower(), 0)
                    cron_time = f"{minute} {hour} * * {day}"
                elif schedule_name == "monthly":
                    day = config.get("day", 1)
                    cron_time = f"{minute} {hour} {day} * *"

                cron_entry = f'{cron_time} cd "{os.path.dirname(script_path)}" && python "{script_path}" --scheduled --type {config["type"]} >> backup_scheduler.log 2>&1'
                cron_entries.append(f"# Advanced Backup - {schedule_name}")
                cron_entries.append(cron_entry)

            if cron_entries:
                # Add to crontab
                cron_content = "\n".join(cron_entries) + "\n"

                # Get existing crontab
                try:
                    result = subprocess.run(["crontab", "-l"], capture_output=True, text=True)
                    existing_cron = result.stdout if result.returncode == 0 else ""
                except:
                    existing_cron = ""

                # Remove old backup entries
                lines = existing_cron.split("\n")
                filtered_lines = [line for line in lines if "Advanced Backup" not in line and script_path not in line]

                # Add new entries
                new_cron = "\n".join(filtered_lines).strip() + "\n" + cron_content

                # Install new crontab
                process = subprocess.Popen(["crontab", "-"], stdin=subprocess.PIPE, text=True)
                process.communicate(input=new_cron)

                if process.returncode == 0:
                    self.log_message("Updated crontab with backup schedules")
                    return True
                else:
                    self.log_message("Error updating crontab", "ERROR")
                    return False

            return True

        except Exception as e:
            self.log_message(f"Error setting up Unix scheduler: {e}", "ERROR")
            return False

    def start_scheduler(self):
        """Start the internal Python scheduler"""
        if self.scheduler_running:
            return

        self.scheduler_running = True

        # Clear existing jobs
        schedule.clear()

        # Setup schedules
        schedules = self.config.get("schedules", {})

        for schedule_name, config in schedules.items():
            if not config.get("enabled", False):
                continue

            backup_type = config.get("type", "incremental")

            if schedule_name == "daily":
                schedule.every().day.at(config["time"]).do(self.run_backup, backup_type)
                self.log_message(f"Scheduled daily {backup_type} backup at {config['time']}")

            elif schedule_name == "weekly":
                day = config.get("day", "sunday").lower()
                time_str = config["time"]
                getattr(schedule.every(), day).at(time_str).do(self.run_backup, backup_type)
                self.log_message(f"Scheduled weekly {backup_type} backup on {day} at {time_str}")

            elif schedule_name == "monthly":
                # Monthly scheduling is approximate with daily check
                def monthly_backup():
                    today = datetime.now()
                    if today.day == config.get("day", 1):
                        self.run_backup(backup_type)

                schedule.every().day.at(config["time"]).do(monthly_backup)
                self.log_message(f"Scheduled monthly {backup_type} backup on day {config.get('day', 1)} at {config['time']}")

        # Start scheduler thread
        def scheduler_loop():
            while self.scheduler_running:
                schedule.run_pending()
                time.sleep(60)  # Check every minute

        self.scheduler_thread = threading.Thread(target=scheduler_loop, daemon=True)
        self.scheduler_thread.start()

        self.log_message("Internal scheduler started")

    def stop_scheduler(self):
        """Stop the internal scheduler"""
        self.scheduler_running = False
        if self.scheduler_thread:
            self.scheduler_thread.join(timeout=5)
        schedule.clear()
        self.log_message("Internal scheduler stopped")

# Enhanced GUI with scheduling interface
class AdvancedBackupGUI:
    def __init__(self):
        self.backup_tool = AdvancedBackupTool()
        self.setup_gui()

    def setup_gui(self):
        """Setup the advanced GUI interface"""
        self.root = tk.Tk()
        self.root.title("Advanced Backup Tool with Scheduling")
        self.root.geometry("800x700")

        # Create notebook for tabs
        notebook = ttk.Notebook(self.root)
        notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Basic backup tab
        self.setup_basic_tab(notebook)

        # Scheduling tab
        self.setup_schedule_tab(notebook)

        # Settings tab
        self.setup_settings_tab(notebook)

        # Status tab
        self.setup_status_tab(notebook)

    def setup_basic_tab(self, notebook):
        """Setup basic backup interface tab"""
        basic_frame = ttk.Frame(notebook, padding="10")
        notebook.add(basic_frame, text="Basic Backup")

        # Source folders section
        ttk.Label(basic_frame, text="Source Folders:", font=("Arial", 10, "bold")).grid(row=0, column=0, sticky=tk.W, pady=(0, 5))

        self.source_listbox = tk.Listbox(basic_frame, height=6)
        self.source_listbox.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 5))

        source_btn_frame = ttk.Frame(basic_frame)
        source_btn_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        ttk.Button(source_btn_frame, text="Add Folder", command=self.add_source_folder).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(source_btn_frame, text="Remove Selected", command=self.remove_source_folder).pack(side=tk.LEFT)

        # Backup destination
        ttk.Label(basic_frame, text="Backup Destination:", font=("Arial", 10, "bold")).grid(row=3, column=0, sticky=tk.W, pady=(10, 5))

        self.dest_var = tk.StringVar(value=self.backup_tool.config.get("backup_destination", ""))
        dest_frame = ttk.Frame(basic_frame)
        dest_frame.grid(row=4, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        ttk.Entry(dest_frame, textvariable=self.dest_var, width=50).pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Button(dest_frame, text="Browse", command=self.select_destination).pack(side=tk.RIGHT, padx=(5, 0))

        # Backup type selection
        backup_type_frame = ttk.LabelFrame(basic_frame, text="Backup Type", padding="5")
        backup_type_frame.grid(row=5, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        self.backup_type_var = tk.StringVar(value="incremental")
        ttk.Radiobutton(backup_type_frame, text="Incremental (faster, only changed files)",
                       variable=self.backup_type_var, value="incremental").pack(anchor=tk.W)
        ttk.Radiobutton(backup_type_frame, text="Full (complete copy of all files)",
                       variable=self.backup_type_var, value="full").pack(anchor=tk.W)

        # Progress and control
        self.progress_var = tk.StringVar(value="Ready to backup...")
        ttk.Label(basic_frame, textvariable=self.progress_var).grid(row=6, column=0, columnspan=2, sticky=tk.W, pady=(0, 5))

        self.progress_bar = ttk.Progressbar(basic_frame, mode='indeterminate')
        self.progress_bar.grid(row=7, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        button_frame = ttk.Frame(basic_frame)
        button_frame.grid(row=8, column=0, columnspan=2, pady=10)

        self.backup_btn = ttk.Button(button_frame, text="Start Backup Now", command=self.start_manual_backup)
        self.backup_btn.pack(side=tk.LEFT, padx=(0, 10))

        ttk.Button(button_frame, text="Test System Conditions", command=self.test_conditions).pack(side=tk.LEFT)

        # Load configuration
        self.load_basic_config()

        # Configure grid weights
        basic_frame.columnconfigure(0, weight=1)

    def setup_schedule_tab(self, notebook):
        """Setup scheduling interface tab"""
        schedule_frame = ttk.Frame(notebook, padding="10")
        notebook.add(schedule_frame, text="Scheduling")

        # Internal scheduler controls
        scheduler_frame = ttk.LabelFrame(schedule_frame, text="Internal Scheduler", padding="5")
        scheduler_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        self.scheduler_status_var = tk.StringVar(value="Stopped")
        ttk.Label(scheduler_frame, text="Status:").grid(row=0, column=0, sticky=tk.W)
        ttk.Label(scheduler_frame, textvariable=self.scheduler_status_var).grid(row=0, column=1, sticky=tk.W, padx=(5, 0))

        scheduler_btn_frame = ttk.Frame(scheduler_frame)
        scheduler_btn_frame.grid(row=1, column=0, columnspan=2, pady=(5, 0))

        ttk.Button(scheduler_btn_frame, text="Start Internal Scheduler", command=self.start_internal_scheduler).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(scheduler_btn_frame, text="Stop Internal Scheduler", command=self.stop_internal_scheduler).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(scheduler_btn_frame, text="Setup System Scheduler", command=self.setup_system_scheduler).pack(side=tk.LEFT)

        # Schedule configuration
        schedule_config_frame = ttk.LabelFrame(schedule_frame, text="Schedule Configuration", padding="5")
        schedule_config_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        # Daily schedule
        daily_frame = ttk.LabelFrame(schedule_config_frame, text="Daily Backup", padding="5")
        daily_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 5))

        self.daily_enabled_var = tk.BooleanVar(value=self.backup_tool.config.get("schedules", {}).get("daily", {}).get("enabled", False))
        ttk.Checkbutton(daily_frame, text="Enable daily backup", variable=self.daily_enabled_var).grid(row=0, column=0, sticky=tk.W)

        ttk.Label(daily_frame, text="Time:").grid(row=1, column=0, sticky=tk.W)
        self.daily_time_var = tk.StringVar(value=self.backup_tool.config.get("schedules", {}).get("daily", {}).get("time", "02:00"))
        ttk.Entry(daily_frame, textvariable=self.daily_time_var, width=10).grid(row=1, column=1, sticky=tk.W, padx=(5, 0))

        ttk.Label(daily_frame, text="Type:").grid(row=1, column=2, sticky=tk.W, padx=(10, 0))
        self.daily_type_var = tk.StringVar(value=self.backup_tool.config.get("schedules", {}).get("daily", {}).get("type", "incremental"))
        daily_type_combo = ttk.Combobox(daily_frame, textvariable=self.daily_type_var, values=["incremental", "full"], width=12)
        daily_type_combo.grid(row=1, column=3, sticky=tk.W, padx=(5, 0))

        # Weekly schedule
        weekly_frame = ttk.LabelFrame(schedule_config_frame, text="Weekly Backup", padding="5")
        weekly_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 5))

        self.weekly_enabled_var = tk.BooleanVar(value=self.backup_tool.config.get("schedules", {}).get("weekly", {}).get("enabled", False))
        ttk.Checkbutton(weekly_frame, text="Enable weekly backup", variable=self.weekly_enabled_var).grid(row=0, column=0, sticky=tk.W)

        ttk.Label(weekly_frame, text="Day:").grid(row=1, column=0, sticky=tk.W)
        self.weekly_day_var = tk.StringVar(value=self.backup_tool.config.get("schedules", {}).get("weekly", {}).get("day", "sunday"))
        weekly_day_combo = ttk.Combobox(weekly_frame, textvariable=self.weekly_day_var,
                                      values=["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"], width=12)
        weekly_day_combo.grid(row=1, column=1, sticky=tk.W, padx=(5, 0))

        ttk.Label(weekly_frame, text="Time:").grid(row=1, column=2, sticky=tk.W, padx=(10, 0))
        self.weekly_time_var = tk.StringVar(value=self.backup_tool.config.get("schedules", {}).get("weekly", {}).get("time", "03:00"))
        ttk.Entry(weekly_frame, textvariable=self.weekly_time_var, width=10).grid(row=1, column=3, sticky=tk.W, padx=(5, 0))

        ttk.Label(weekly_frame, text="Type:").grid(row=1, column=4, sticky=tk.W, padx=(10, 0))
        self.weekly_type_var = tk.StringVar(value=self.backup_tool.config.get("schedules", {}).get("weekly", {}).get("type", "full"))
        weekly_type_combo = ttk.Combobox(weekly_frame, textvariable=self.weekly_type_var, values=["incremental", "full"], width=12)
        weekly_type_combo.grid(row=1, column=5, sticky=tk.W, padx=(5, 0))

        # Monthly schedule
        monthly_frame = ttk.LabelFrame(schedule_config_frame, text="Monthly Backup", padding="5")
        monthly_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 5))

        self.monthly_enabled_var = tk.BooleanVar(value=self.backup_tool.config.get("schedules", {}).get("monthly", {}).get("enabled", False))
        ttk.Checkbutton(monthly_frame, text="Enable monthly backup", variable=self.monthly_enabled_var).grid(row=0, column=0, sticky=tk.W)

        ttk.Label(monthly_frame, text="Day of month:").grid(row=1, column=0, sticky=tk.W)
        self.monthly_day_var = tk.IntVar(value=self.backup_tool.config.get("schedules", {}).get("monthly", {}).get("day", 1))
        ttk.Spinbox(monthly_frame, from_=1, to=28, textvariable=self.monthly_day_var, width=8).grid(row=1, column=1, sticky=tk.W, padx=(5, 0))

        ttk.Label(monthly_frame, text="Time:").grid(row=1, column=2, sticky=tk.W, padx=(10, 0))
        self.monthly_time_var = tk.StringVar(value=self.backup_tool.config.get("schedules", {}).get("monthly", {}).get("time", "04:00"))
        ttk.Entry(monthly_frame, textvariable=self.monthly_time_var, width=10).grid(row=1, column=3, sticky=tk.W, padx=(5, 0))

        ttk.Label(monthly_frame, text="Type:").grid(row=1, column=4, sticky=tk.W, padx=(10, 0))
        self.monthly_type_var = tk.StringVar(value=self.backup_tool.config.get("schedules", {}).get("monthly", {}).get("type", "full"))
        monthly_type_combo = ttk.Combobox(monthly_frame, textvariable=self.monthly_type_var, values=["incremental", "full"], width=12)
        monthly_type_combo.grid(row=1, column=5, sticky=tk.W, padx=(5, 0))

        # Save schedule button
        ttk.Button(schedule_frame, text="Save Schedule Configuration", command=self.save_schedule_config).grid(row=2, column=0, columnspan=2, pady=10)

    def setup_settings_tab(self, notebook):
        """Setup advanced settings tab"""
        settings_frame = ttk.Frame(notebook, padding="10")
        notebook.add(settings_frame, text="Advanced Settings")

        # Create scrollable frame
        canvas = tk.Canvas(settings_frame)
        scrollbar = ttk.Scrollbar(settings_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)

        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.bind('<Configure>', lambda e: canvas.configure(scrollregion=canvas.bbox("all")))

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Retention settings
        retention_frame = ttk.LabelFrame(scrollable_frame, text="Backup Retention", padding="5")
        retention_frame.pack(fill=tk.X, pady=(0, 10))

        retention_config = self.backup_tool.config.get("retention", {})

        ttk.Label(retention_frame, text="Keep daily backups for (days):").grid(row=0, column=0, sticky=tk.W)
        self.keep_daily_var = tk.IntVar(value=retention_config.get("keep_daily", 7))
        ttk.Spinbox(retention_frame, from_=1, to=365, textvariable=self.keep_daily_var, width=10).grid(row=0, column=1, sticky=tk.W, padx=(5, 0))

        ttk.Label(retention_frame, text="Keep weekly backups for (weeks):").grid(row=1, column=0, sticky=tk.W)
        self.keep_weekly_var = tk.IntVar(value=retention_config.get("keep_weekly", 4))
        ttk.Spinbox(retention_frame, from_=1, to=52, textvariable=self.keep_weekly_var, width=10).grid(row=1, column=1, sticky=tk.W, padx=(5, 0))

        ttk.Label(retention_frame, text="Keep monthly backups for (months):").grid(row=2, column=0, sticky=tk.W)
        self.keep_monthly_var = tk.IntVar(value=retention_config.get("keep_monthly", 12))
        ttk.Spinbox(retention_frame, from_=1, to=120, textvariable=self.keep_monthly_var, width=10).grid(row=2, column=1, sticky=tk.W, padx=(5, 0))

        self.auto_cleanup_var = tk.BooleanVar(value=retention_config.get("auto_cleanup", True))
        ttk.Checkbutton(retention_frame, text="Automatically clean up old backups", variable=self.auto_cleanup_var).grid(row=3, column=0, columnspan=2, sticky=tk.W)

        # Conditions settings
        conditions_frame = ttk.LabelFrame(scrollable_frame, text="Backup Conditions", padding="5")
        conditions_frame.pack(fill=tk.X, pady=(0, 10))

        conditions_config = self.backup_tool.config.get("conditions", {})

        ttk.Label(conditions_frame, text="Minimum free space (GB):").grid(row=0, column=0, sticky=tk.W)
        self.min_free_space_var = tk.IntVar(value=conditions_config.get("min_free_space_gb", 10))
        ttk.Spinbox(conditions_frame, from_=1, to=1000, textvariable=self.min_free_space_var, width=10).grid(row=0, column=1, sticky=tk.W, padx=(5, 0))

        ttk.Label(conditions_frame, text="Maximum CPU usage (%):").grid(row=1, column=0, sticky=tk.W)
        self.max_cpu_var = tk.IntVar(value=conditions_config.get("max_cpu_percent", 80))
        ttk.Spinbox(conditions_frame, from_=10, to=100, textvariable=self.max_cpu_var, width=10).grid(row=1, column=1, sticky=tk.W, padx=(5, 0))

        self.only_if_changes_var = tk.BooleanVar(value=conditions_config.get("only_if_changes", True))
        ttk.Checkbutton(conditions_frame, text="Only backup if changes detected", variable=self.only_if_changes_var).grid(row=2, column=0, columnspan=2, sticky=tk.W)

        self.skip_if_battery_var = tk.BooleanVar(value=conditions_config.get("skip_if_battery", True))
        ttk.Checkbutton(conditions_frame, text="Skip backup when on battery", variable=self.skip_if_battery_var).grid(row=3, column=0, columnspan=2, sticky=tk.W)

        # Bandwidth settings
        bandwidth_frame = ttk.LabelFrame(scrollable_frame, text="Performance", padding="5")
        bandwidth_frame.pack(fill=tk.X, pady=(0, 10))

        ttk.Label(bandwidth_frame, text="Bandwidth limit (Mbps, 0=unlimited):").grid(row=0, column=0, sticky=tk.W)
        self.bandwidth_limit_var = tk.IntVar(value=self.backup_tool.config.get("bandwidth_limit_mbps", 0))
        ttk.Spinbox(bandwidth_frame, from_=0, to=1000, textvariable=self.bandwidth_limit_var, width=10).grid(row=0, column=1, sticky=tk.W, padx=(5, 0))

        self.verify_backups_var = tk.BooleanVar(value=self.backup_tool.config.get("verify_backups", True))
        ttk.Checkbutton(bandwidth_frame, text="Verify backup integrity", variable=self.verify_backups_var).grid(row=1, column=0, columnspan=2, sticky=tk.W)

        # Notification settings
        notification_frame = ttk.LabelFrame(scrollable_frame, text="Email Notifications", padding="5")
        notification_frame.pack(fill=tk.X, pady=(0, 10))

        notification_config = self.backup_tool.config.get("notifications", {})

        self.email_enabled_var = tk.BooleanVar(value=notification_config.get("email_enabled", False))
        ttk.Checkbutton(notification_frame, text="Enable email notifications", variable=self.email_enabled_var).grid(row=0, column=0, columnspan=2, sticky=tk.W)

        ttk.Label(notification_frame, text="SMTP Server:").grid(row=1, column=0, sticky=tk.W)
        self.email_smtp_var = tk.StringVar(value=notification_config.get("email_smtp", "smtp.gmail.com"))
        ttk.Entry(notification_frame, textvariable=self.email_smtp_var, width=25).grid(row=1, column=1, sticky=tk.W, padx=(5, 0))

        ttk.Label(notification_frame, text="Port:").grid(row=2, column=0, sticky=tk.W)
        self.email_port_var = tk.IntVar(value=notification_config.get("email_port", 587))
        ttk.Spinbox(notification_frame, from_=1, to=65535, textvariable=self.email_port_var, width=10).grid(row=2, column=1, sticky=tk.W, padx=(5, 0))

        ttk.Label(notification_frame, text="Username:").grid(row=3, column=0, sticky=tk.W)
        self.email_user_var = tk.StringVar(value=notification_config.get("email_user", ""))
        ttk.Entry(notification_frame, textvariable=self.email_user_var, width=25).grid(row=3, column=1, sticky=tk.W, padx=(5, 0))

        ttk.Label(notification_frame, text="Password:").grid(row=4, column=0, sticky=tk.W)
        self.email_password_var = tk.StringVar(value=notification_config.get("email_password", ""))
        ttk.Entry(notification_frame, textvariable=self.email_password_var, width=25, show="*").grid(row=4, column=1, sticky=tk.W, padx=(5, 0))

        ttk.Label(notification_frame, text="Send to:").grid(row=5, column=0, sticky=tk.W)
        self.email_to_var = tk.StringVar(value=notification_config.get("email_to", ""))
        ttk.Entry(notification_frame, textvariable=self.email_to_var, width=25).grid(row=5, column=1, sticky=tk.W, padx=(5, 0))

        self.notify_success_var = tk.BooleanVar(value=notification_config.get("notify_on_success", False))
        ttk.Checkbutton(notification_frame, text="Notify on successful backup", variable=self.notify_success_var).grid(row=6, column=0, columnspan=2, sticky=tk.W)

        self.notify_failure_var = tk.BooleanVar(value=notification_config.get("notify_on_failure", True))
        ttk.Checkbutton(notification_frame, text="Notify on backup failure", variable=self.notify_failure_var).grid(row=7, column=0, columnspan=2, sticky=tk.W)

        # Save settings button
        ttk.Button(scrollable_frame, text="Save All Settings", command=self.save_all_settings).pack(pady=20)

    def setup_status_tab(self, notebook):
        """Setup status and logs tab"""
        status_frame = ttk.Frame(notebook, padding="10")
        notebook.add(status_frame, text="Status & Logs")

        # Backup history
        history_frame = ttk.LabelFrame(status_frame, text="Recent Backups", padding="5")
        history_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        # Create treeview for backup history
        columns = ("Date", "Type", "Files", "Size", "Duration", "Status")
        self.history_tree = ttk.Treeview(history_frame, columns=columns, show="tree headings", height=8)

        for col in columns:
            self.history_tree.heading(col, text=col)
            self.history_tree.column(col, width=100)

        # Add scrollbar to treeview
        tree_scrollbar = ttk.Scrollbar(history_frame, orient="vertical", command=self.history_tree.yview)
        self.history_tree.configure(yscrollcommand=tree_scrollbar.set)

        self.history_tree.pack(side="left", fill="both", expand=True)
        tree_scrollbar.pack(side="right", fill="y")

        # Log viewer
        log_frame = ttk.LabelFrame(status_frame, text="Recent Log Entries", padding="5")
        log_frame.pack(fill=tk.BOTH, expand=True)

        # Text widget for logs
        self.log_text = tk.Text(log_frame, height=10, wrap=tk.WORD)
        log_scrollbar_y = ttk.Scrollbar(log_frame, orient="vertical", command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=log_scrollbar_y.set)

        self.log_text.pack(side="left", fill="both", expand=True)
        log_scrollbar_y.pack(side="right", fill="y")

        # Control buttons
        control_frame = ttk.Frame(status_frame)
        control_frame.pack(fill=tk.X, pady=(10, 0))

        ttk.Button(control_frame, text="Refresh Status", command=self.refresh_status).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(control_frame, text="Clear Logs", command=self.clear_logs).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(control_frame, text="Open Log File", command=self.open_log_file).pack(side=tk.LEFT)

        # Load initial status
        self.refresh_status()

    def load_basic_config(self):
        """Load configuration into basic tab"""
        for folder in self.backup_tool.config.get("source_folders", []):
            self.source_listbox.insert(tk.END, folder)

    def add_source_folder(self):
        """Add a source folder"""
        folder = filedialog.askdirectory(title="Select Source Folder")
        if folder and folder not in self.backup_tool.config.get("source_folders", []):
            self.source_listbox.insert(tk.END, folder)
            if "source_folders" not in self.backup_tool.config:
                self.backup_tool.config["source_folders"] = []
            self.backup_tool.config["source_folders"].append(folder)
            self.backup_tool.save_config()

    def remove_source_folder(self):
        """Remove selected source folder"""
        selection = self.source_listbox.curselection()
        if selection:
            index = selection[0]
            folder = self.source_listbox.get(index)
            self.source_listbox.delete(index)
            if folder in self.backup_tool.config.get("source_folders", []):
                self.backup_tool.config["source_folders"].remove(folder)
                self.backup_tool.save_config()

    def select_destination(self):
        """Select backup destination"""
        folder = filedialog.askdirectory(title="Select Backup Destination")
        if folder:
            self.dest_var.set(folder)
            self.backup_tool.config["backup_destination"] = folder
            self.backup_tool.save_config()

    def start_manual_backup(self):
        """Start manual backup"""
        if not self.dest_var.get():
            messagebox.showerror("Error", "Please select a backup destination")
            return

        if not self.backup_tool.config.get("source_folders"):
            messagebox.showerror("Error", "Please add at least one source folder")
            return

        # Update config
        self.backup_tool.config["backup_destination"] = self.dest_var.get()
        self.backup_tool.save_config()

        def backup_thread():
            try:
                self.progress_bar.start()
                self.backup_btn.config(state="disabled")
                self.progress_var.set("Starting backup...")

                backup_type = self.backup_type_var.get()
                success = self.backup_tool.run_backup(backup_type, self.progress_callback)

                if success:
                    self.progress_var.set("Backup completed successfully!")
                    messagebox.showinfo("Success", "Backup completed successfully!")
                else:
                    self.progress_var.set("Backup failed - check logs")
                    messagebox.showerror("Error", "Backup failed. Check the logs for details.")

            except Exception as e:
                self.progress_var.set(f"Error: {str(e)}")
                messagebox.showerror("Error", f"Backup failed: {str(e)}")

            finally:
                self.progress_bar.stop()
                self.backup_btn.config(state="normal")
                self.refresh_status()

        threading.Thread(target=backup_thread, daemon=True).start()

    def progress_callback(self, file_path):
        """Update progress during backup"""
        self.progress_var.set(f"Backing up: {os.path.basename(file_path)}")
        self.root.update_idletasks()

    def test_conditions(self):
        """Test system conditions"""
        if self.backup_tool.check_system_conditions():
            messagebox.showinfo("System Check", "✓ All system conditions are suitable for backup")
        else:
            messagebox.showwarning("System Check", "⚠ Some system conditions are not optimal for backup. Check the logs for details.")

    def start_internal_scheduler(self):
        """Start the internal scheduler"""
        try:
            self.backup_tool.start_scheduler()
            self.scheduler_status_var.set("Running")
            messagebox.showinfo("Scheduler", "Internal scheduler started successfully")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to start scheduler: {str(e)}")

    def stop_internal_scheduler(self):
        """Stop the internal scheduler"""
        try:
            self.backup_tool.stop_scheduler()
            self.scheduler_status_var.set("Stopped")
            messagebox.showinfo("Scheduler", "Internal scheduler stopped")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to stop scheduler: {str(e)}")

    def setup_system_scheduler(self):
        """Setup OS-level scheduler"""
        self.save_schedule_config()  # Save current config first

        schedules = self.backup_tool.config.get("schedules", {})
        enabled_schedules = {k: v for k, v in schedules.items() if v.get("enabled", False)}

        if not enabled_schedules:
            messagebox.showwarning("Warning", "No schedules are enabled. Please enable at least one schedule first.")
            return

        try:
            if self.backup_tool.setup_system_scheduler(enabled_schedules):
                messagebox.showinfo("Success", "System scheduler setup completed. Backups will run automatically according to your schedule.")
            else:
                messagebox.showerror("Error", "Failed to setup system scheduler. Check the logs for details.")
        except Exception as e:
            messagebox.showerror("Error", f"Error setting up system scheduler: {str(e)}")

    def save_schedule_config(self):
        """Save schedule configuration"""
        try:
            schedules = {
                "daily": {
                    "enabled": self.daily_enabled_var.get(),
                    "time": self.daily_time_var.get(),
                    "type": self.daily_type_var.get()
                },
                "weekly": {
                    "enabled": self.weekly_enabled_var.get(),
                    "day": self.weekly_day_var.get(),
                    "time": self.weekly_time_var.get(),
                    "type": self.weekly_type_var.get()
                },
                "monthly": {
                    "enabled": self.monthly_enabled_var.get(),
                    "day": self.monthly_day_var.get(),
                    "time": self.monthly_time_var.get(),
                    "type": self.monthly_type_var.get()
                }
            }

            self.backup_tool.config["schedules"] = schedules
            self.backup_tool.save_config()
            messagebox.showinfo("Success", "Schedule configuration saved")

        except Exception as e:
            messagebox.showerror("Error", f"Failed to save schedule configuration: {str(e)}")

    def save_all_settings(self):
        """Save all advanced settings"""
        try:
            # Update retention settings
            self.backup_tool.config["retention"] = {
                "keep_daily": self.keep_daily_var.get(),
                "keep_weekly": self.keep_weekly_var.get(),
                "keep_monthly": self.keep_monthly_var.get(),
                "auto_cleanup": self.auto_cleanup_var.get()
            }

            # Update conditions
            self.backup_tool.config["conditions"] = {
                "min_free_space_gb": self.min_free_space_var.get(),
                "max_cpu_percent": self.max_cpu_var.get(),
                "only_if_changes": self.only_if_changes_var.get(),
                "skip_if_battery": self.skip_if_battery_var.get()
            }

            # Update performance settings
            self.backup_tool.config["bandwidth_limit_mbps"] = self.bandwidth_limit_var.get()
            self.backup_tool.config["verify_backups"] = self.verify_backups_var.get()

            # Update notification settings
            self.backup_tool.config["notifications"] = {
                "email_enabled": self.email_enabled_var.get(),
                "email_smtp": self.email_smtp_var.get(),
                "email_port": self.email_port_var.get(),
                "email_user": self.email_user_var.get(),
                "email_password": self.email_password_var.get(),
                "email_to": self.email_to_var.get(),
                "notify_on_success": self.notify_success_var.get(),
                "notify_on_failure": self.notify_failure_var.get()
            }

            self.backup_tool.save_config()
            messagebox.showinfo("Success", "All settings saved successfully")

        except Exception as e:
            messagebox.showerror("Error", f"Failed to save settings: {str(e)}")

    def refresh_status(self):
        """Refresh status information"""
        try:
            # Clear existing items
            for item in self.history_tree.get_children():
                self.history_tree.delete(item)

            # Load backup history
            backup_root = self.backup_tool.config.get("backup_destination")
            if backup_root and os.path.exists(backup_root):
                backup_folders = []
                for item in os.listdir(backup_root):
                    if item.startswith("backup_"):
                        backup_path = os.path.join(backup_root, item)
                        metadata_file = os.path.join(backup_path, "backup_metadata.json")

                        if os.path.exists(metadata_file):
                            try:
                                with open(metadata_file, 'r') as f:
                                    metadata = json.load(f)

                                # Format data for display
                                timestamp = datetime.strptime(metadata["timestamp"], "%Y%m%d_%H%M%S")
                                date_str = timestamp.strftime("%Y-%m-%d %H:%M")
                                backup_type = metadata.get("type", "unknown").title()
                                files = f"{metadata.get('total_files', 0):,}"
                                size = f"{metadata.get('total_size', 0) / 1024**3:.2f} GB"
                                duration = f"{metadata.get('duration_seconds', 0)} sec"
                                status = "✓ Success"

                                backup_folders.append((timestamp, date_str, backup_type, files, size, duration, status))

                            except Exception as e:
                                # Fallback for folders without metadata
                                try:
                                    timestamp = datetime.strptime(item.replace("backup_", ""), "%Y%m%d_%H%M%S")
                                    date_str = timestamp.strftime("%Y-%m-%d %H:%M")
                                    backup_folders.append((timestamp, date_str, "Unknown", "?", "?", "?", "? No metadata"))
                                except:
                                    continue

                # Sort by timestamp (newest first) and add to tree
                backup_folders.sort(reverse=True)
                for timestamp, date_str, backup_type, files, size, duration, status in backup_folders[:20]:  # Show last 20
                    self.history_tree.insert("", "end", values=(date_str, backup_type, files, size, duration, status))

            # Load recent log entries
            self.log_text.delete(1.0, tk.END)
            if os.path.exists(self.backup_tool.log_file):
                try:
                    with open(self.backup_tool.log_file, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        # Show last 50 lines
                        recent_lines = lines[-50:] if len(lines) > 50 else lines
                        self.log_text.insert(1.0, ''.join(recent_lines))
                except Exception as e:
                    self.log_text.insert(1.0, f"Error reading log file: {e}")

        except Exception as e:
            messagebox.showerror("Error", f"Failed to refresh status: {str(e)}")

    def clear_logs(self):
        """Clear the log file"""
        try:
            if messagebox.askyesno("Confirm", "Are you sure you want to clear all log entries?"):
                if os.path.exists(self.backup_tool.log_file):
                    os.remove(self.backup_tool.log_file)
                self.log_text.delete(1.0, tk.END)
                messagebox.showinfo("Success", "Log file cleared")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to clear logs: {str(e)}")

    def open_log_file(self):
        """Open the log file in default editor"""
        try:
            if os.path.exists(self.backup_tool.log_file):
                if platform.system() == "Windows":
                    os.startfile(self.backup_tool.log_file)
                elif platform.system() == "Darwin":  # macOS
                    subprocess.run(["open", self.backup_tool.log_file])
                else:  # Linux
                    subprocess.run(["xdg-open", self.backup_tool.log_file])
            else:
                messagebox.showinfo("Info", "Log file doesn't exist yet")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to open log file: {str(e)}")

    def on_closing(self):
        """Handle application closing"""
        if self.backup_tool.scheduler_running:
            if messagebox.askyesno("Confirm", "The scheduler is running. Stop it before closing?"):
                self.backup_tool.stop_scheduler()
        self.root.destroy()

    def run(self):
        """Start the GUI"""
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        self.root.mainloop()

def main():
    """Main function with enhanced CLI argument parsing"""
    parser = argparse.ArgumentParser(description="Advanced Backup Tool with Scheduling")
    parser.add_argument("--gui", action="store_true", help="Launch GUI interface")
    parser.add_argument("--source", "-s", action="append", help="Source folder to backup")
    parser.add_argument("--destination", "-d", help="Backup destination folder")
    parser.add_argument("--type", "-t", choices=["incremental", "full"], default="incremental", help="Backup type")
    parser.add_argument("--scheduled", action="store_true", help="Running as scheduled task")
    parser.add_argument("--start-scheduler", action="store_true", help="Start internal scheduler")
    parser.add_argument("--stop-scheduler", action="store_true", help="Stop internal scheduler")
    parser.add_argument("--setup-scheduler", action="store_true", help="Setup system scheduler")

    args = parser.parse_args()

    if args.gui or len(os.sys.argv) == 1:
        # Launch GUI
        try:
            app = AdvancedBackupGUI()
            app.run()
        except ImportError as e:
            print("GUI not available. Try installing tkinter or use CLI mode.")
            print(f"Error: {e}")
    else:
        # CLI mode
        backup_tool = AdvancedBackupTool()

        if args.source:
            backup_tool.config["source_folders"] = args.source

        if args.destination:
            backup_tool.config["backup_destination"] = args.destination

        backup_tool.save_config()

        if args.start_scheduler:
            backup_tool.start_scheduler()
            print("Internal scheduler started. Press Ctrl+C to stop.")
            try:
                while backup_tool.scheduler_running:
                    time.sleep(60)
            except KeyboardInterrupt:
                backup_tool.stop_scheduler()
                print("Scheduler stopped.")

        elif args.stop_scheduler:
            backup_tool.stop_scheduler()
            print("Scheduler stopped.")

        elif args.setup_scheduler:
            schedules = backup_tool.config.get("schedules", {})
            enabled_schedules = {k: v for k, v in schedules.items() if v.get("enabled", False)}
            if backup_tool.setup_system_scheduler(enabled_schedules):
                print("System scheduler setup completed.")
            else:
                print("Failed to setup system scheduler.")

        else:
            # Run backup
            if backup_tool.run_backup(args.type):
                print("Backup completed successfully!")
            else:
                print("Backup failed!")
                exit(1)

if __name__ == "__main__":
    main()