#!/usr/bin/env python3
"""
Simple Backup Suite Launcher - Windows Compatible
Fixed version without Unicode characters that cause encoding issues
"""

import os
import sys
import tkinter as tk
from tkinter import ttk, messagebox
import subprocess

class SimpleBackupLauncher:
    def __init__(self):
        self.setup_gui()

    def setup_gui(self):
        """Setup simple launcher GUI"""
        self.root = tk.Tk()
        self.root.title("Backup Tools Launcher")
        self.root.geometry("600x400")

        # Main frame
        main_frame = ttk.Frame(self.root, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Title
        title_label = ttk.Label(main_frame, text="Backup Tools Launcher",
                               font=("Arial", 16, "bold"))
        title_label.pack(pady=(0, 30))

        # Basic Backup Tool
        basic_frame = ttk.LabelFrame(main_frame, text="Basic Backup Tool", padding="15")
        basic_frame.pack(fill=tk.X, pady=(0, 15))

        ttk.Label(basic_frame, text="Simple backup with drag-and-drop interface",
                 font=("Arial", 10)).pack(anchor=tk.W, pady=(0, 10))

        ttk.Button(basic_frame, text="Launch Basic Backup Tool",
                  command=self.launch_basic).pack(anchor=tk.W)

        # Advanced Backup Tool
        advanced_frame = ttk.LabelFrame(main_frame, text="Advanced Backup with Scheduling", padding="15")
        advanced_frame.pack(fill=tk.X, pady=(0, 15))

        ttk.Label(advanced_frame, text="Professional backup with automation and scheduling",
                 font=("Arial", 10)).pack(anchor=tk.W, pady=(0, 10))

        ttk.Button(advanced_frame, text="Launch Advanced Backup Tool",
                  command=self.launch_advanced).pack(anchor=tk.W)

        # Reports Tool
        reports_frame = ttk.LabelFrame(main_frame, text="Backup Reports & Analytics", padding="15")
        reports_frame.pack(fill=tk.X, pady=(0, 15))

        ttk.Label(reports_frame, text="Generate reports and analyze backup performance",
                 font=("Arial", 10)).pack(anchor=tk.W, pady=(0, 10))

        ttk.Button(reports_frame, text="Launch Report Generator",
                  command=self.launch_reports).pack(anchor=tk.W)

        # Status
        self.status_var = tk.StringVar(value="Ready - Choose a backup tool to launch")
        ttk.Label(main_frame, textvariable=self.status_var,
                 font=("Arial", 9), foreground="blue").pack(pady=(20, 0))

    def launch_basic(self):
        """Launch basic backup tool"""
        try:
            subprocess.Popen([sys.executable, "backup-tool.py", "--gui"],
                           creationflags=subprocess.CREATE_NO_WINDOW)
            self.status_var.set("Basic Backup Tool launched successfully")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to launch Basic Backup Tool: {str(e)}")

    def launch_advanced(self):
        """Launch advanced backup tool"""
        try:
            subprocess.Popen([sys.executable, "backup-scheduler.py", "--gui"],
                           creationflags=subprocess.CREATE_NO_WINDOW)
            self.status_var.set("Advanced Backup Tool launched successfully")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to launch Advanced Backup Tool: {str(e)}")

    def launch_reports(self):
        """Launch reports tool"""
        try:
            subprocess.Popen([sys.executable, "backup-reports.py", "--gui"],
                           creationflags=subprocess.CREATE_NO_WINDOW)
            self.status_var.set("Report Generator launched successfully")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to launch Report Generator: {str(e)}")

    def run(self):
        """Start the launcher"""
        self.root.mainloop()

if __name__ == "__main__":
    # Set console encoding for Windows
    if sys.platform == "win32":
        try:
            import codecs
            sys.stdout = codecs.getwriter("utf-8")(sys.stdout.buffer)
            sys.stderr = codecs.getwriter("utf-8")(sys.stderr.buffer)
        except:
            pass  # Fallback if encoding setup fails

    app = SimpleBackupLauncher()
    app.run()