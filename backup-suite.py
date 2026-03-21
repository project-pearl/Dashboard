#!/usr/bin/env python3
"""
Complete Backup Suite Launcher
Unified interface for all backup tools: basic backup, advanced scheduling, and reporting
"""

import os
import sys
import tkinter as tk
from tkinter import ttk, messagebox
import subprocess
import threading
from pathlib import Path

class BackupSuiteLauncher:
    def __init__(self):
        self.setup_gui()

    def setup_gui(self):
        """Setup the main launcher GUI"""
        self.root = tk.Tk()
        self.root.title("🛡️ Complete Backup Suite")
        self.root.geometry("800x600")
        self.root.configure(bg='#f0f0f0')

        # Create main container
        main_frame = ttk.Frame(self.root, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Header
        header_frame = ttk.Frame(main_frame)
        header_frame.pack(fill=tk.X, pady=(0, 30))

        title_label = ttk.Label(header_frame, text="🛡️ Complete Backup Suite",
                              font=("Arial", 20, "bold"))
        title_label.pack()

        subtitle_label = ttk.Label(header_frame,
                                 text="Professional backup solution with scheduling, monitoring, and reporting",
                                 font=("Arial", 12))
        subtitle_label.pack(pady=(5, 0))

        # Create notebook for different sections
        notebook = ttk.Notebook(main_frame)
        notebook.pack(fill=tk.BOTH, expand=True)

        # Tools tab
        self.setup_tools_tab(notebook)

        # Quick Start tab
        self.setup_quickstart_tab(notebook)

        # System Info tab
        self.setup_system_tab(notebook)

        # Help tab
        self.setup_help_tab(notebook)

    def setup_tools_tab(self, notebook):
        """Setup tools selection tab"""
        tools_frame = ttk.Frame(notebook, padding="20")
        notebook.add(tools_frame, text="🔧 Tools")

        # Basic Backup Tool
        basic_frame = ttk.LabelFrame(tools_frame, text="Basic Backup Tool", padding="15")
        basic_frame.pack(fill=tk.X, pady=(0, 15))

        ttk.Label(basic_frame, text="Simple, user-friendly backup with GUI interface",
                 font=("Arial", 10)).pack(anchor=tk.W, pady=(0, 10))

        features_basic = [
            "✓ Easy drag-and-drop interface",
            "✓ Incremental backups",
            "✓ Multiple source folders",
            "✓ Progress tracking",
            "✓ Perfect for beginners"
        ]

        for feature in features_basic:
            ttk.Label(basic_frame, text=feature, font=("Arial", 9)).pack(anchor=tk.W)

        button_frame_basic = ttk.Frame(basic_frame)
        button_frame_basic.pack(fill=tk.X, pady=(10, 0))

        ttk.Button(button_frame_basic, text="Launch Basic Backup Tool",
                  command=self.launch_basic_backup).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(button_frame_basic, text="View Documentation",
                  command=self.open_basic_docs).pack(side=tk.LEFT)

        # Advanced Backup Tool
        advanced_frame = ttk.LabelFrame(tools_frame, text="Advanced Backup with Scheduling", padding="15")
        advanced_frame.pack(fill=tk.X, pady=(0, 15))

        ttk.Label(advanced_frame, text="Professional backup solution with automation and intelligent features",
                 font=("Arial", 10)).pack(anchor=tk.W, pady=(0, 10))

        features_advanced = [
            "✓ Automated scheduling (daily, weekly, monthly)",
            "✓ Smart conditions (battery, CPU, disk space)",
            "✓ Email notifications",
            "✓ Bandwidth limiting",
            "✓ Retention policies",
            "✓ System health monitoring"
        ]

        for feature in features_advanced:
            ttk.Label(advanced_frame, text=feature, font=("Arial", 9)).pack(anchor=tk.W)

        button_frame_advanced = ttk.Frame(advanced_frame)
        button_frame_advanced.pack(fill=tk.X, pady=(10, 0))

        ttk.Button(button_frame_advanced, text="Launch Advanced Backup Tool",
                  command=self.launch_advanced_backup).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(button_frame_advanced, text="Command Line Help",
                  command=self.show_cli_help).pack(side=tk.LEFT)

        # Reporting Tool
        reporting_frame = ttk.LabelFrame(tools_frame, text="Backup Reports & Analytics", padding="15")
        reporting_frame.pack(fill=tk.X, pady=(0, 15))

        ttk.Label(reporting_frame, text="Comprehensive analysis and reporting of backup performance",
                 font=("Arial", 10)).pack(anchor=tk.W, pady=(0, 10))

        features_reporting = [
            "✓ Interactive HTML reports with charts",
            "✓ CSV data exports for analysis",
            "✓ System health assessments",
            "✓ Performance trend analysis",
            "✓ File type breakdowns",
            "✓ Storage usage tracking"
        ]

        for feature in features_reporting:
            ttk.Label(reporting_frame, text=feature, font=("Arial", 9)).pack(anchor=tk.W)

        button_frame_reporting = ttk.Frame(reporting_frame)
        button_frame_reporting.pack(fill=tk.X, pady=(10, 0))

        ttk.Button(button_frame_reporting, text="Launch Report Generator",
                  command=self.launch_reports).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(button_frame_reporting, text="View Sample Report",
                  command=self.view_sample_report).pack(side=tk.LEFT)

    def setup_quickstart_tab(self, notebook):
        """Setup quick start guide tab"""
        quickstart_frame = ttk.Frame(notebook, padding="20")
        notebook.add(quickstart_frame, text="🚀 Quick Start")

        # Create scrollable frame
        canvas = tk.Canvas(quickstart_frame)
        scrollbar = ttk.Scrollbar(quickstart_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Quick start content
        content = [
            ("🎯 Choose Your Path", "bold"),
            ("", ""),
            ("For beginners or simple backups:", "normal"),
            ("1. Click 'Launch Basic Backup Tool'", "normal"),
            ("2. Add your folders (Documents, Pictures, etc.)", "normal"),
            ("3. Choose backup destination (external drive)", "normal"),
            ("4. Click 'Start Backup'", "normal"),
            ("", ""),
            ("For automated, professional backups:", "normal"),
            ("1. Click 'Launch Advanced Backup Tool'", "normal"),
            ("2. Configure source folders and destination", "normal"),
            ("3. Set up schedules (daily/weekly/monthly)", "normal"),
            ("4. Configure email notifications", "normal"),
            ("5. Start internal scheduler or setup system scheduler", "normal"),
            ("", ""),
            ("📊 Monitoring & Reports", "bold"),
            ("", ""),
            ("After running backups:", "normal"),
            ("1. Click 'Launch Report Generator'", "normal"),
            ("2. Select your backup directory", "normal"),
            ("3. Click 'Scan Directory'", "normal"),
            ("4. Generate HTML report with charts", "normal"),
            ("5. Review health assessment and recommendations", "normal"),
            ("", ""),
            ("💡 Pro Tips", "bold"),
            ("", ""),
            ("• Use incremental backups for speed", "normal"),
            ("• Set up weekly full backups for reliability", "normal"),
            ("• Monitor backup health regularly", "normal"),
            ("• Keep backups on separate drive/location", "normal"),
            ("• Test restore procedures periodically", "normal"),
            ("• Use email notifications for failures", "normal"),
            ("", ""),
            ("🔧 Troubleshooting", "bold"),
            ("", ""),
            ("Common issues and solutions:", "normal"),
            ("• 'Permission denied' → Run as administrator", "normal"),
            ("• 'Slow backups' → Check bandwidth limit settings", "normal"),
            ("• 'Missing files' → Check exclude patterns", "normal"),
            ("• 'Scheduler not working' → Check system task scheduler", "normal"),
            ("• 'Email not sending' → Verify SMTP settings", "normal"),
        ]

        for text, style in content:
            if style == "bold":
                label = ttk.Label(scrollable_frame, text=text, font=("Arial", 12, "bold"))
            elif text == "":
                label = ttk.Label(scrollable_frame, text=" ")
            else:
                label = ttk.Label(scrollable_frame, text=text, font=("Arial", 10))
            label.pack(anchor=tk.W, pady=1)

    def setup_system_tab(self, notebook):
        """Setup system information tab"""
        system_frame = ttk.Frame(notebook, padding="20")
        notebook.add(system_frame, text="💻 System Info")

        # System requirements
        req_frame = ttk.LabelFrame(system_frame, text="System Requirements", padding="15")
        req_frame.pack(fill=tk.X, pady=(0, 15))

        requirements = [
            "✓ Python 3.6 or higher",
            "✓ Windows 10/11, macOS, or Linux",
            "✓ 50MB free space for application",
            "✓ Additional space for backups",
            "✓ Network connection (for email notifications)",
            "✓ Administrator privileges (for system scheduling)"
        ]

        for req in requirements:
            ttk.Label(req_frame, text=req, font=("Arial", 10)).pack(anchor=tk.W)

        # Installation status
        status_frame = ttk.LabelFrame(system_frame, text="Installation Status", padding="15")
        status_frame.pack(fill=tk.X, pady=(0, 15))

        self.status_text = tk.Text(status_frame, height=8, wrap=tk.WORD, font=("Consolas", 9))
        status_scrollbar = ttk.Scrollbar(status_frame, orient="vertical", command=self.status_text.yview)
        self.status_text.configure(yscrollcommand=status_scrollbar.set)

        self.status_text.pack(side="left", fill="both", expand=True)
        status_scrollbar.pack(side="right", fill="y")

        # Control buttons
        control_frame = ttk.Frame(system_frame)
        control_frame.pack(fill=tk.X, pady=(10, 0))

        ttk.Button(control_frame, text="Check System Status",
                  command=self.check_system_status).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(control_frame, text="Install Dependencies",
                  command=self.install_dependencies).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(control_frame, text="Open Installation Folder",
                  command=self.open_install_folder).pack(side=tk.LEFT)

        # Check status on startup
        self.root.after(1000, self.check_system_status)

    def setup_help_tab(self, notebook):
        """Setup help and documentation tab"""
        help_frame = ttk.Frame(notebook, padding="20")
        notebook.add(help_frame, text="❓ Help")

        # Documentation links
        docs_frame = ttk.LabelFrame(help_frame, text="Documentation", padding="15")
        docs_frame.pack(fill=tk.X, pady=(0, 15))

        doc_items = [
            ("📖 User Manual", "Complete guide with examples", self.open_user_manual),
            ("🔧 API Reference", "Command-line options and configuration", self.open_api_docs),
            ("💡 Examples", "Common backup scenarios and solutions", self.open_examples),
            ("❓ FAQ", "Frequently asked questions", self.open_faq),
            ("🐛 Troubleshooting", "Common issues and solutions", self.open_troubleshooting)
        ]

        for title, desc, command in doc_items:
            item_frame = ttk.Frame(docs_frame)
            item_frame.pack(fill=tk.X, pady=2)

            ttk.Label(item_frame, text=title, font=("Arial", 10, "bold")).pack(anchor=tk.W)
            ttk.Label(item_frame, text=desc, font=("Arial", 9)).pack(anchor=tk.W)
            ttk.Button(item_frame, text="Open", command=command).pack(anchor=tk.W, pady=(2, 5))

        # Support information
        support_frame = ttk.LabelFrame(help_frame, text="Support", padding="15")
        support_frame.pack(fill=tk.X, pady=(0, 15))

        support_info = [
            "📧 Contact: Support available through documentation",
            "🌐 Updates: Check for latest versions regularly",
            "🔒 Security: Keep backups encrypted and secure",
            "💾 Best Practices: Regular testing and monitoring"
        ]

        for info in support_info:
            ttk.Label(support_frame, text=info, font=("Arial", 10)).pack(anchor=tk.W, pady=2)

        # About
        about_frame = ttk.LabelFrame(help_frame, text="About", padding="15")
        about_frame.pack(fill=tk.X)

        about_text = """
Complete Backup Suite v2.0
Professional backup solution with scheduling and reporting

Features:
• Simple and advanced backup tools
• Automated scheduling with smart conditions
• Comprehensive reporting and analytics
• Cross-platform compatibility
• Professional-grade reliability

Created for robust, automated data protection.
        """.strip()

        ttk.Label(about_frame, text=about_text, font=("Arial", 9), justify=tk.LEFT).pack(anchor=tk.W)

    def launch_basic_backup(self):
        """Launch the basic backup tool"""
        try:
            subprocess.Popen([sys.executable, "backup-tool.py", "--gui"])
            self.show_status("✅ Basic Backup Tool launched")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to launch Basic Backup Tool:\n{str(e)}")

    def launch_advanced_backup(self):
        """Launch the advanced backup tool"""
        try:
            subprocess.Popen([sys.executable, "backup-scheduler.py", "--gui"])
            self.show_status("✅ Advanced Backup Tool launched")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to launch Advanced Backup Tool:\n{str(e)}")

    def launch_reports(self):
        """Launch the reporting tool"""
        try:
            subprocess.Popen([sys.executable, "backup-reports.py", "--gui"])
            self.show_status("✅ Report Generator launched")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to launch Report Generator:\n{str(e)}")

    def show_cli_help(self):
        """Show command line help"""
        help_text = """
Command Line Usage:

Basic Backup:
python backup-tool.py --source "C:\\Documents" --destination "E:\\Backup"
python backup-tool.py --gui

Advanced Backup:
python backup-scheduler.py --source "C:\\Documents" --destination "E:\\Backup" --type full
python backup-scheduler.py --start-scheduler
python backup-scheduler.py --setup-scheduler

Reports:
python backup-reports.py --backup-dir "E:\\Backup" --html --health
python backup-reports.py --gui

Options:
--gui                Launch GUI interface
--source/-s         Source folder to backup
--destination/-d    Backup destination
--type/-t          Backup type (incremental/full)
--scheduled        Running as scheduled task
--start-scheduler  Start internal scheduler
--setup-scheduler  Setup system scheduler
--html            Generate HTML report
--csv             Generate CSV reports
--health          Generate health report
        """

        # Create help window
        help_window = tk.Toplevel(self.root)
        help_window.title("Command Line Help")
        help_window.geometry("600x500")

        text_widget = tk.Text(help_window, wrap=tk.WORD, font=("Consolas", 10))
        scrollbar = ttk.Scrollbar(help_window, orient="vertical", command=text_widget.yview)
        text_widget.configure(yscrollcommand=scrollbar.set)

        text_widget.pack(side="left", fill="both", expand=True, padx=10, pady=10)
        scrollbar.pack(side="right", fill="y", pady=10)

        text_widget.insert(1.0, help_text)
        text_widget.config(state=tk.DISABLED)

    def check_system_status(self):
        """Check system status and dependencies"""
        def check_thread():
            status_lines = []
            status_lines.append("🔍 Checking system status...\n")

            # Check Python version
            python_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
            status_lines.append(f"✅ Python version: {python_version}")

            # Check required files
            required_files = [
                "backup-tool.py",
                "backup-scheduler.py",
                "backup-reports.py",
                "requirements.txt",
                "backup-README.md"
            ]

            for file in required_files:
                if os.path.exists(file):
                    status_lines.append(f"✅ {file} found")
                else:
                    status_lines.append(f"❌ {file} missing")

            # Check Python dependencies
            try:
                import schedule
                status_lines.append("✅ schedule module available")
            except ImportError:
                status_lines.append("⚠️ schedule module missing (pip install schedule)")

            try:
                import psutil
                status_lines.append("✅ psutil module available")
            except ImportError:
                status_lines.append("⚠️ psutil module missing (pip install psutil)")

            try:
                import pandas
                status_lines.append("✅ pandas module available")
            except ImportError:
                status_lines.append("⚠️ pandas module missing (pip install pandas)")

            try:
                import matplotlib
                status_lines.append("✅ matplotlib module available")
            except ImportError:
                status_lines.append("⚠️ matplotlib module missing (pip install matplotlib)")

            try:
                import plotly
                status_lines.append("✅ plotly module available")
            except ImportError:
                status_lines.append("⚠️ plotly module missing (pip install plotly)")

            # Check disk space
            try:
                import shutil
                total, used, free = shutil.disk_usage(".")
                free_gb = free / (1024**3)
                status_lines.append(f"✅ Disk space: {free_gb:.1f} GB free")
            except:
                status_lines.append("⚠️ Could not check disk space")

            status_lines.append(f"\n📍 Installation directory: {os.path.abspath('.')}")
            status_lines.append(f"📅 Check completed: {os.sys.platform}")

            # Update GUI
            self.root.after(0, lambda: self.update_status_display("\n".join(status_lines)))

        threading.Thread(target=check_thread, daemon=True).start()

    def update_status_display(self, text):
        """Update status display"""
        self.status_text.delete(1.0, tk.END)
        self.status_text.insert(1.0, text)

    def install_dependencies(self):
        """Install required Python dependencies"""
        def install_thread():
            try:
                self.root.after(0, lambda: self.show_status("📦 Installing dependencies..."))

                # Install using pip
                result = subprocess.run([
                    sys.executable, "-m", "pip", "install", "-r", "requirements.txt"
                ], capture_output=True, text=True)

                if result.returncode == 0:
                    self.root.after(0, lambda: self.show_status("✅ Dependencies installed successfully"))
                    self.root.after(0, lambda: messagebox.showinfo("Success", "Dependencies installed successfully!"))
                else:
                    error_msg = result.stderr or result.stdout
                    self.root.after(0, lambda: messagebox.showerror("Error", f"Installation failed:\n{error_msg}"))

            except Exception as e:
                self.root.after(0, lambda: messagebox.showerror("Error", f"Installation failed:\n{str(e)}"))

            # Refresh status check
            self.root.after(1000, self.check_system_status)

        threading.Thread(target=install_thread, daemon=True).start()

    def open_install_folder(self):
        """Open installation folder"""
        try:
            install_dir = os.path.abspath(".")
            if sys.platform == "win32":
                os.startfile(install_dir)
            elif sys.platform == "darwin":
                subprocess.run(["open", install_dir])
            else:
                subprocess.run(["xdg-open", install_dir])
        except Exception as e:
            messagebox.showerror("Error", f"Failed to open folder:\n{str(e)}")

    def show_status(self, message):
        """Show status message"""
        print(message)  # For debugging

    # Documentation methods (placeholder implementations)
    def open_basic_docs(self):
        """Open basic backup documentation"""
        try:
            doc_file = os.path.abspath("backup-README.md")
            if os.path.exists(doc_file):
                if sys.platform == "win32":
                    os.startfile(doc_file)
                else:
                    subprocess.run(["open" if sys.platform == "darwin" else "xdg-open", doc_file])
            else:
                messagebox.showinfo("Info", "Documentation file not found. Please check the installation.")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to open documentation:\n{str(e)}")

    def view_sample_report(self):
        """Show sample report information"""
        sample_info = """
Sample Backup Report Features:

📊 Executive Dashboard
• Total backup sessions and success rate
• Data volume and transfer speed metrics
• Storage efficiency and trends

📈 Performance Analytics
• Backup speed over time
• Duration vs. data size analysis
• Peak performance identification

📁 File Analysis
• File type distribution charts
• Largest files identification
• Most frequently changed files

🏥 Health Assessment
• System condition scoring
• Backup consistency evaluation
• Automated recommendations

💾 Retention Tracking
• Backup history visualization
• Storage usage trends
• Cleanup recommendations

All reports include interactive charts,
exportable data, and professional styling.
        """

        messagebox.showinfo("Sample Report Features", sample_info)

    def open_user_manual(self):
        """Open user manual"""
        self.open_basic_docs()

    def open_api_docs(self):
        """Open API documentation"""
        self.show_cli_help()

    def open_examples(self):
        """Show examples"""
        examples = """
Common Backup Examples:

1. Personal Files Backup:
   • Documents, Pictures, Desktop
   • Daily incremental, Weekly full
   • External USB drive destination

2. Project Development Backup:
   • Source code repositories
   • Database backups
   • Hourly incremental backups

3. Small Business Backup:
   • Customer data, financial records
   • Automated email notifications
   • Network drive with retention policy

4. System Administrator:
   • Multiple server configurations
   • Performance monitoring
   • Detailed reporting and alerts

Use the appropriate tool based on your complexity needs.
        """
        messagebox.showinfo("Backup Examples", examples)

    def open_faq(self):
        """Show FAQ"""
        faq = """
Frequently Asked Questions:

Q: Which tool should I use?
A: Basic tool for simple needs, Advanced for automation and monitoring.

Q: How often should I backup?
A: Daily incremental + weekly full is recommended for most users.

Q: Can I backup to network drives?
A: Yes, both tools support local and network destinations.

Q: What if my backup fails?
A: Check the logs, verify permissions, and ensure adequate disk space.

Q: How do I restore files?
A: Navigate to backup folder and copy files back manually.

Q: Is scheduling reliable?
A: Yes, but test your schedule and monitor with email notifications.

Q: Can I exclude certain files?
A: Yes, configure exclude patterns in advanced settings.
        """
        messagebox.showinfo("FAQ", faq)

    def open_troubleshooting(self):
        """Show troubleshooting guide"""
        troubleshooting = """
Troubleshooting Common Issues:

🔧 Permission Denied Errors:
• Run as Administrator (Windows) or sudo (Linux/Mac)
• Check destination folder permissions
• Ensure source files are not locked

💾 Slow Backup Performance:
• Check bandwidth limit settings
• Use incremental instead of full backups
• Verify disk speed and available space

📧 Email Notifications Not Working:
• Verify SMTP server settings
• Check username/password
• Test with Gmail: smtp.gmail.com:587

⏰ Scheduler Not Running:
• Verify system scheduler permissions
• Check internal scheduler status
• Review log files for errors

📁 Missing Files in Backup:
• Check exclude patterns
• Verify source folder paths
• Review backup manifest files

🖥️ High CPU/Memory Usage:
• Adjust backup conditions
• Limit concurrent operations
• Schedule during off-peak hours
        """
        messagebox.showinfo("Troubleshooting", troubleshooting)

    def run(self):
        """Start the launcher"""
        self.root.mainloop()

def main():
    """Main function"""
    app = BackupSuiteLauncher()
    app.run()

if __name__ == "__main__":
    main()