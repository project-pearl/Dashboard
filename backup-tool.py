#!/usr/bin/env python3
"""
Simple Backup Tool
A lightweight backup utility with GUI and CLI support
"""

import os
import shutil
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import argparse
import hashlib
import json
import threading
from datetime import datetime
from pathlib import Path

class BackupTool:
    def __init__(self):
        self.config_file = "backup_config.json"
        self.log_file = "backup_log.txt"
        self.load_config()

    def load_config(self):
        """Load backup configuration from file"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    self.config = json.load(f)
            else:
                self.config = {
                    "source_folders": [],
                    "backup_destination": "",
                    "incremental": True,
                    "exclude_patterns": [".tmp", ".log", "__pycache__", ".git"]
                }
        except Exception as e:
            print(f"Error loading config: {e}")
            self.config = {}

    def save_config(self):
        """Save backup configuration to file"""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            print(f"Error saving config: {e}")

    def log_message(self, message):
        """Log messages to file and print to console"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {message}"
        print(log_entry)

        try:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(log_entry + "\n")
        except Exception as e:
            print(f"Error writing to log: {e}")

    def get_file_hash(self, file_path):
        """Calculate MD5 hash of a file"""
        hash_md5 = hashlib.md5()
        try:
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except Exception as e:
            self.log_message(f"Error calculating hash for {file_path}: {e}")
            return None

    def should_exclude_file(self, file_path):
        """Check if file should be excluded based on patterns"""
        file_name = os.path.basename(file_path)
        for pattern in self.config.get("exclude_patterns", []):
            if pattern in file_name or file_path.endswith(pattern):
                return True
        return False

    def copy_file_with_progress(self, src, dst, progress_callback=None):
        """Copy file with progress tracking"""
        try:
            os.makedirs(os.path.dirname(dst), exist_ok=True)

            # Copy file
            shutil.copy2(src, dst)

            if progress_callback:
                progress_callback(src)

            return True
        except Exception as e:
            self.log_message(f"Error copying {src} to {dst}: {e}")
            return False

    def backup_folder(self, source_folder, backup_root, progress_callback=None):
        """Backup a single folder"""
        if not os.path.exists(source_folder):
            self.log_message(f"Source folder does not exist: {source_folder}")
            return False

        folder_name = os.path.basename(source_folder)
        backup_folder = os.path.join(backup_root, folder_name)

        # Create backup manifest for incremental backups
        manifest_file = os.path.join(backup_folder, ".backup_manifest.json")
        manifest = {}

        if self.config.get("incremental", True) and os.path.exists(manifest_file):
            try:
                with open(manifest_file, 'r') as f:
                    manifest = json.load(f)
            except:
                manifest = {}

        new_manifest = {}
        files_copied = 0
        files_skipped = 0

        # Walk through source folder
        for root, dirs, files in os.walk(source_folder):
            for file in files:
                src_file = os.path.join(root, file)

                if self.should_exclude_file(src_file):
                    continue

                # Calculate relative path
                rel_path = os.path.relpath(src_file, source_folder)
                dst_file = os.path.join(backup_folder, rel_path)

                # Check if file needs to be backed up
                current_hash = self.get_file_hash(src_file)
                if current_hash is None:
                    continue

                new_manifest[rel_path] = {
                    "hash": current_hash,
                    "modified": os.path.getmtime(src_file),
                    "size": os.path.getsize(src_file)
                }

                # Skip if file hasn't changed (incremental backup)
                if (self.config.get("incremental", True) and
                    rel_path in manifest and
                    manifest[rel_path].get("hash") == current_hash):
                    files_skipped += 1
                    continue

                # Copy the file
                if self.copy_file_with_progress(src_file, dst_file, progress_callback):
                    files_copied += 1

        # Save new manifest
        try:
            os.makedirs(backup_folder, exist_ok=True)
            with open(manifest_file, 'w') as f:
                json.dump(new_manifest, f, indent=2)
        except Exception as e:
            self.log_message(f"Error saving manifest: {e}")

        self.log_message(f"Backup completed for {folder_name}: {files_copied} files copied, {files_skipped} files skipped")
        return True

    def run_backup(self, progress_callback=None):
        """Run the complete backup process"""
        if not self.config.get("backup_destination"):
            self.log_message("No backup destination configured")
            return False

        if not self.config.get("source_folders"):
            self.log_message("No source folders configured")
            return False

        backup_root = self.config["backup_destination"]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_session_folder = os.path.join(backup_root, f"backup_{timestamp}")

        self.log_message(f"Starting backup to: {backup_session_folder}")

        try:
            os.makedirs(backup_session_folder, exist_ok=True)

            for source_folder in self.config["source_folders"]:
                self.log_message(f"Backing up: {source_folder}")
                self.backup_folder(source_folder, backup_session_folder, progress_callback)

            self.log_message("Backup completed successfully!")
            return True

        except Exception as e:
            self.log_message(f"Backup failed: {e}")
            return False

class BackupGUI:
    def __init__(self):
        self.backup_tool = BackupTool()
        self.setup_gui()

    def setup_gui(self):
        """Setup the GUI interface"""
        self.root = tk.Tk()
        self.root.title("Simple Backup Tool")
        self.root.geometry("600x500")

        # Main frame
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Source folders section
        ttk.Label(main_frame, text="Source Folders:", font=("Arial", 10, "bold")).grid(row=0, column=0, sticky=tk.W, pady=(0, 5))

        # Source folders listbox
        self.source_listbox = tk.Listbox(main_frame, height=6)
        self.source_listbox.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 5))

        # Source folder buttons
        source_btn_frame = ttk.Frame(main_frame)
        source_btn_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        ttk.Button(source_btn_frame, text="Add Folder", command=self.add_source_folder).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(source_btn_frame, text="Remove Selected", command=self.remove_source_folder).pack(side=tk.LEFT)

        # Backup destination
        ttk.Label(main_frame, text="Backup Destination:", font=("Arial", 10, "bold")).grid(row=3, column=0, sticky=tk.W, pady=(10, 5))

        self.dest_var = tk.StringVar(value=self.backup_tool.config.get("backup_destination", ""))
        dest_frame = ttk.Frame(main_frame)
        dest_frame.grid(row=4, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        ttk.Entry(dest_frame, textvariable=self.dest_var, width=50).pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Button(dest_frame, text="Browse", command=self.select_destination).pack(side=tk.RIGHT, padx=(5, 0))

        # Options
        options_frame = ttk.LabelFrame(main_frame, text="Options", padding="5")
        options_frame.grid(row=5, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        self.incremental_var = tk.BooleanVar(value=self.backup_tool.config.get("incremental", True))
        ttk.Checkbutton(options_frame, text="Incremental backup (only copy changed files)",
                       variable=self.incremental_var).pack(anchor=tk.W)

        # Progress bar
        self.progress_var = tk.StringVar(value="Ready to backup...")
        ttk.Label(main_frame, textvariable=self.progress_var).grid(row=6, column=0, columnspan=2, sticky=tk.W, pady=(0, 5))

        self.progress_bar = ttk.Progressbar(main_frame, mode='indeterminate')
        self.progress_bar.grid(row=7, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        # Backup button
        self.backup_btn = ttk.Button(main_frame, text="Start Backup", command=self.start_backup)
        self.backup_btn.grid(row=8, column=0, columnspan=2, pady=10)

        # Load existing configuration
        self.load_gui_config()

        # Configure grid weights
        main_frame.columnconfigure(0, weight=1)
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)

    def load_gui_config(self):
        """Load configuration into GUI elements"""
        # Load source folders
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

    def progress_callback(self, file_path):
        """Update progress during backup"""
        self.progress_var.set(f"Backing up: {os.path.basename(file_path)}")
        self.root.update_idletasks()

    def backup_thread(self):
        """Run backup in separate thread"""
        try:
            # Update config from GUI
            self.backup_tool.config["backup_destination"] = self.dest_var.get()
            self.backup_tool.config["incremental"] = self.incremental_var.get()
            self.backup_tool.save_config()

            # Start progress animation
            self.progress_bar.start()
            self.backup_btn.config(state="disabled")

            # Run backup
            success = self.backup_tool.run_backup(self.progress_callback)

            # Update UI
            if success:
                self.progress_var.set("Backup completed successfully!")
                messagebox.showinfo("Success", "Backup completed successfully!")
            else:
                self.progress_var.set("Backup failed - check log for details")
                messagebox.showerror("Error", "Backup failed. Check the log file for details.")

        except Exception as e:
            self.progress_var.set(f"Error: {str(e)}")
            messagebox.showerror("Error", f"Backup failed: {str(e)}")

        finally:
            self.progress_bar.stop()
            self.backup_btn.config(state="normal")

    def start_backup(self):
        """Start the backup process"""
        if not self.dest_var.get():
            messagebox.showerror("Error", "Please select a backup destination")
            return

        if not self.backup_tool.config.get("source_folders"):
            messagebox.showerror("Error", "Please add at least one source folder")
            return

        # Run backup in separate thread to prevent GUI freezing
        backup_thread = threading.Thread(target=self.backup_thread)
        backup_thread.daemon = True
        backup_thread.start()

    def run(self):
        """Start the GUI"""
        self.root.mainloop()

def main():
    """Main function with CLI argument parsing"""
    parser = argparse.ArgumentParser(description="Simple Backup Tool")
    parser.add_argument("--gui", action="store_true", help="Launch GUI interface")
    parser.add_argument("--source", "-s", action="append", help="Source folder to backup")
    parser.add_argument("--destination", "-d", help="Backup destination folder")
    parser.add_argument("--incremental", action="store_true", help="Use incremental backup")
    parser.add_argument("--config", help="Config file path")

    args = parser.parse_args()

    if args.gui or len(os.sys.argv) == 1:
        # Launch GUI
        app = BackupGUI()
        app.run()
    else:
        # CLI mode
        backup_tool = BackupTool()

        if args.source:
            backup_tool.config["source_folders"] = args.source

        if args.destination:
            backup_tool.config["backup_destination"] = args.destination

        if args.incremental:
            backup_tool.config["incremental"] = True

        backup_tool.save_config()

        if backup_tool.run_backup():
            print("Backup completed successfully!")
        else:
            print("Backup failed!")
            exit(1)

if __name__ == "__main__":
    main()