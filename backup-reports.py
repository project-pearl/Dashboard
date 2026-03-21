#!/usr/bin/env python3
"""
Advanced Backup Reporting System
Generates comprehensive reports from backup logs and metadata
"""

import os
import json
import sqlite3
import matplotlib.pyplot as plt
import pandas as pd
from datetime import datetime, timedelta
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import webbrowser
from pathlib import Path
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import plotly.express as px

class BackupReportGenerator:
    def __init__(self, backup_root=None):
        self.backup_root = backup_root
        self.db_file = "backup_reports.db"
        self.init_database()

    def init_database(self):
        """Initialize SQLite database for report data"""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()

            # Create tables
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS backup_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    date TEXT NOT NULL,
                    type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    total_files INTEGER DEFAULT 0,
                    total_size INTEGER DEFAULT 0,
                    duration_seconds INTEGER DEFAULT 0,
                    source_folders TEXT,
                    destination TEXT,
                    files_copied INTEGER DEFAULT 0,
                    files_skipped INTEGER DEFAULT 0,
                    errors INTEGER DEFAULT 0
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS backup_files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER,
                    file_path TEXT,
                    file_size INTEGER,
                    modification_time REAL,
                    backup_time TEXT,
                    status TEXT,
                    FOREIGN KEY (session_id) REFERENCES backup_sessions (id)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS system_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT,
                    cpu_percent REAL,
                    memory_percent REAL,
                    disk_free_gb REAL,
                    backup_speed_mbps REAL,
                    session_id INTEGER,
                    FOREIGN KEY (session_id) REFERENCES backup_sessions (id)
                )
            """)

            conn.commit()
            conn.close()

        except Exception as e:
            print(f"Error initializing database: {e}")

    def scan_backup_directory(self):
        """Scan backup directory and import data into database"""
        if not self.backup_root or not os.path.exists(self.backup_root):
            return False

        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        try:
            print(f"Scanning backup directory: {self.backup_root}")

            # Get all backup folders
            backup_folders = [f for f in os.listdir(self.backup_root) if f.startswith("backup_")]

            for folder_name in backup_folders:
                folder_path = os.path.join(self.backup_root, folder_name)
                metadata_file = os.path.join(folder_path, "backup_metadata.json")

                if os.path.exists(metadata_file):
                    with open(metadata_file, 'r') as f:
                        metadata = json.load(f)

                    # Check if session already exists
                    cursor.execute("SELECT id FROM backup_sessions WHERE timestamp = ?", (metadata["timestamp"],))
                    if cursor.fetchone():
                        continue  # Already imported

                    # Parse timestamp
                    timestamp = metadata["timestamp"]
                    date_obj = datetime.strptime(timestamp, "%Y%m%d_%H%M%S")
                    date_str = date_obj.strftime("%Y-%m-%d")

                    # Insert session record
                    cursor.execute("""
                        INSERT INTO backup_sessions
                        (timestamp, date, type, status, total_files, total_size, duration_seconds,
                         source_folders, destination, files_copied, files_skipped)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        timestamp, date_str, metadata.get("type", "unknown"), "completed",
                        metadata.get("total_files", 0), metadata.get("total_size", 0),
                        metadata.get("duration_seconds", 0),
                        json.dumps(metadata.get("source_folders", [])), folder_path,
                        metadata.get("files_copied", 0), metadata.get("files_skipped", 0)
                    ))

                    session_id = cursor.lastrowid

                    # Import file details from manifests
                    self.import_file_details(folder_path, session_id, cursor)

            conn.commit()
            print(f"Imported data from {len(backup_folders)} backup sessions")
            return True

        except Exception as e:
            print(f"Error scanning backup directory: {e}")
            return False
        finally:
            conn.close()

    def import_file_details(self, folder_path, session_id, cursor):
        """Import individual file details from backup manifests"""
        try:
            # Look for manifest files in source folders
            for item in os.listdir(folder_path):
                item_path = os.path.join(folder_path, item)
                if os.path.isdir(item_path):
                    manifest_file = os.path.join(item_path, ".backup_manifest.json")
                    if os.path.exists(manifest_file):
                        with open(manifest_file, 'r') as f:
                            manifest = json.load(f)

                        for rel_path, file_info in manifest.items():
                            cursor.execute("""
                                INSERT INTO backup_files
                                (session_id, file_path, file_size, modification_time, backup_time, status)
                                VALUES (?, ?, ?, ?, ?, ?)
                            """, (
                                session_id, rel_path, file_info.get("size", 0),
                                file_info.get("modified", 0), datetime.now().isoformat(), "backed_up"
                            ))

        except Exception as e:
            print(f"Error importing file details: {e}")

    def generate_summary_report(self):
        """Generate comprehensive summary report"""
        conn = sqlite3.connect(self.db_file)

        try:
            # Basic statistics
            stats = {
                "total_sessions": 0,
                "successful_sessions": 0,
                "total_files_backed_up": 0,
                "total_size_backed_up": 0,
                "average_session_duration": 0,
                "latest_backup": None,
                "oldest_backup": None,
                "backup_frequency": {},
                "backup_size_trend": [],
                "file_type_breakdown": {},
                "largest_files": [],
                "most_frequently_changed": []
            }

            # Get session statistics
            df_sessions = pd.read_sql_query("SELECT * FROM backup_sessions ORDER BY timestamp", conn)

            if not df_sessions.empty:
                stats["total_sessions"] = len(df_sessions)
                stats["successful_sessions"] = len(df_sessions[df_sessions["status"] == "completed"])
                stats["total_files_backed_up"] = df_sessions["total_files"].sum()
                stats["total_size_backed_up"] = df_sessions["total_size"].sum()
                stats["average_session_duration"] = df_sessions["duration_seconds"].mean()
                stats["latest_backup"] = df_sessions["timestamp"].max()
                stats["oldest_backup"] = df_sessions["timestamp"].min()

                # Backup frequency by day of week
                df_sessions["datetime"] = pd.to_datetime(df_sessions["timestamp"], format="%Y%m%d_%H%M%S")
                df_sessions["day_of_week"] = df_sessions["datetime"].dt.day_name()
                stats["backup_frequency"] = df_sessions["day_of_week"].value_counts().to_dict()

                # Size trend over time
                stats["backup_size_trend"] = df_sessions[["date", "total_size"]].to_dict("records")

            # Get file statistics
            df_files = pd.read_sql_query("""
                SELECT bf.*, bs.timestamp as session_timestamp
                FROM backup_files bf
                JOIN backup_sessions bs ON bf.session_id = bs.id
            """, conn)

            if not df_files.empty:
                # File type breakdown
                df_files["extension"] = df_files["file_path"].str.extract(r'\.([^.]+)$')[0].str.lower()
                extension_counts = df_files["extension"].value_counts().head(10)
                stats["file_type_breakdown"] = extension_counts.to_dict()

                # Largest files
                largest_files = df_files.nlargest(10, "file_size")[["file_path", "file_size"]].to_dict("records")
                stats["largest_files"] = largest_files

                # Most frequently changed files
                file_change_counts = df_files["file_path"].value_counts().head(10)
                stats["most_frequently_changed"] = file_change_counts.to_dict()

            return stats

        except Exception as e:
            print(f"Error generating summary report: {e}")
            return {}
        finally:
            conn.close()

    def generate_performance_report(self):
        """Generate backup performance analysis"""
        conn = sqlite3.connect(self.db_file)

        try:
            performance_data = {
                "backup_speed_over_time": [],
                "duration_by_size": [],
                "efficiency_metrics": {},
                "peak_performance_times": {},
                "bottleneck_analysis": {}
            }

            # Get session data
            df_sessions = pd.read_sql_query("""
                SELECT *,
                       CAST(total_size AS FLOAT) / (duration_seconds + 1) / (1024*1024) as speed_mbps,
                       CAST(files_copied AS FLOAT) / (total_files + 1) as efficiency_ratio
                FROM backup_sessions
                WHERE duration_seconds > 0 AND total_size > 0
                ORDER BY timestamp
            """, conn)

            if not df_sessions.empty:
                # Speed over time
                df_sessions["datetime"] = pd.to_datetime(df_sessions["timestamp"], format="%Y%m%d_%H%M%S")
                speed_data = df_sessions[["datetime", "speed_mbps"]].to_dict("records")
                performance_data["backup_speed_over_time"] = speed_data

                # Duration vs size relationship
                duration_size_data = df_sessions[["total_size", "duration_seconds"]].to_dict("records")
                performance_data["duration_by_size"] = duration_size_data

                # Efficiency metrics
                performance_data["efficiency_metrics"] = {
                    "average_speed_mbps": df_sessions["speed_mbps"].mean(),
                    "max_speed_mbps": df_sessions["speed_mbps"].max(),
                    "min_speed_mbps": df_sessions["speed_mbps"].min(),
                    "average_efficiency": df_sessions["efficiency_ratio"].mean(),
                    "total_data_transferred_gb": df_sessions["total_size"].sum() / (1024**3)
                }

                # Peak performance times
                df_sessions["hour"] = df_sessions["datetime"].dt.hour
                hourly_speed = df_sessions.groupby("hour")["speed_mbps"].mean()
                performance_data["peak_performance_times"] = hourly_speed.to_dict()

            return performance_data

        except Exception as e:
            print(f"Error generating performance report: {e}")
            return {}
        finally:
            conn.close()

    def generate_html_report(self, output_file="backup_report.html"):
        """Generate comprehensive HTML report with charts"""
        try:
            # Get data
            summary_stats = self.generate_summary_report()
            performance_data = self.generate_performance_report()

            # Create HTML report
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Backup System Report</title>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }}
        .header {{ background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
        .section {{ background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .stat-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }}
        .stat-card {{ background: #3498db; color: white; padding: 15px; border-radius: 8px; text-align: center; }}
        .stat-value {{ font-size: 2em; font-weight: bold; }}
        .stat-label {{ font-size: 0.9em; opacity: 0.8; }}
        .chart-container {{ width: 100%; height: 400px; margin: 20px 0; }}
        .table {{ width: 100%; border-collapse: collapse; }}
        .table th, .table td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        .table th {{ background-color: #f2f2f2; }}
        .success {{ color: #27ae60; }}
        .warning {{ color: #f39c12; }}
        .error {{ color: #e74c3c; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Backup System Report</h1>
        <p>Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
    </div>

    <div class="section">
        <h2>📈 Executive Summary</h2>
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-value">{summary_stats.get('total_sessions', 0)}</div>
                <div class="stat-label">Total Backup Sessions</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{summary_stats.get('total_files_backed_up', 0):,}</div>
                <div class="stat-label">Files Backed Up</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{summary_stats.get('total_size_backed_up', 0) / (1024**3):.1f} GB</div>
                <div class="stat-label">Data Transferred</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{summary_stats.get('average_session_duration', 0):.0f}s</div>
                <div class="stat-label">Avg Session Duration</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>📅 Backup Frequency Analysis</h2>
        <div id="frequency-chart" class="chart-container"></div>
    </div>

    <div class="section">
        <h2>📊 Backup Size Trend</h2>
        <div id="size-trend-chart" class="chart-container"></div>
    </div>

    <div class="section">
        <h2>🚀 Performance Metrics</h2>
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-value">{performance_data.get('efficiency_metrics', {}).get('average_speed_mbps', 0):.1f} MB/s</div>
                <div class="stat-label">Average Speed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{performance_data.get('efficiency_metrics', {}).get('max_speed_mbps', 0):.1f} MB/s</div>
                <div class="stat-label">Peak Speed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{performance_data.get('efficiency_metrics', {}).get('average_efficiency', 0):.1%}</div>
                <div class="stat-label">Backup Efficiency</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{performance_data.get('efficiency_metrics', {}).get('total_data_transferred_gb', 0):.1f} GB</div>
                <div class="stat-label">Total Data</div>
            </div>
        </div>
        <div id="speed-chart" class="chart-container"></div>
    </div>

    <div class="section">
        <h2>📁 File Type Analysis</h2>
        <div id="filetype-chart" class="chart-container"></div>
        <table class="table">
            <thead>
                <tr><th>File Type</th><th>Count</th><th>Percentage</th></tr>
            </thead>
            <tbody>
    """

            # Add file type breakdown to HTML
            file_types = summary_stats.get('file_type_breakdown', {})
            total_files = sum(file_types.values()) if file_types else 1

            for ext, count in list(file_types.items())[:10]:
                percentage = (count / total_files) * 100
                html_content += f"<tr><td>.{ext}</td><td>{count:,}</td><td>{percentage:.1f}%</td></tr>"

            html_content += """
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>📋 Largest Files</h2>
        <table class="table">
            <thead>
                <tr><th>File Path</th><th>Size</th></tr>
            </thead>
            <tbody>
    """

            # Add largest files to HTML
            for file_info in summary_stats.get('largest_files', [])[:10]:
                file_path = file_info.get('file_path', '')
                file_size = file_info.get('file_size', 0)
                size_mb = file_size / (1024 * 1024)
                html_content += f"<tr><td>{file_path}</td><td>{size_mb:.1f} MB</td></tr>"

            html_content += """
            </tbody>
        </table>
    </div>

    <script>
        // Backup frequency chart
        const frequencyData = """ + json.dumps(list(summary_stats.get('backup_frequency', {}).items())) + """;
        const frequencyTrace = {
            x: frequencyData.map(d => d[0]),
            y: frequencyData.map(d => d[1]),
            type: 'bar',
            marker: {color: '#3498db'}
        };
        Plotly.newPlot('frequency-chart', [frequencyTrace], {
            title: 'Backup Sessions by Day of Week',
            xaxis: {title: 'Day of Week'},
            yaxis: {title: 'Number of Backups'}
        });

        // Backup size trend chart
        const sizeData = """ + json.dumps(summary_stats.get('backup_size_trend', [])) + """;
        const sizeTrace = {
            x: sizeData.map(d => d.date),
            y: sizeData.map(d => d.total_size / (1024*1024*1024)),
            type: 'scatter',
            mode: 'lines+markers',
            line: {color: '#e74c3c'},
            marker: {size: 8}
        };
        Plotly.newPlot('size-trend-chart', [sizeTrace], {
            title: 'Backup Size Over Time',
            xaxis: {title: 'Date'},
            yaxis: {title: 'Size (GB)'}
        });

        // Performance speed chart
        const speedData = """ + json.dumps(performance_data.get('backup_speed_over_time', [])) + """;
        const speedTrace = {
            x: speedData.map(d => d.datetime),
            y: speedData.map(d => d.speed_mbps),
            type: 'scatter',
            mode: 'lines+markers',
            line: {color: '#27ae60'},
            marker: {size: 6}
        };
        Plotly.newPlot('speed-chart', [speedTrace], {
            title: 'Backup Speed Over Time',
            xaxis: {title: 'Date'},
            yaxis: {title: 'Speed (MB/s)'}
        });

        // File type pie chart
        const fileTypeData = """ + json.dumps(list(summary_stats.get('file_type_breakdown', {}).items())[:10]) + """;
        const fileTypeTrace = {
            labels: fileTypeData.map(d => '.' + d[0]),
            values: fileTypeData.map(d => d[1]),
            type: 'pie',
            hole: 0.4
        };
        Plotly.newPlot('filetype-chart', [fileTypeTrace], {
            title: 'File Types Distribution'
        });
    </script>
</body>
</html>
            """

            # Save HTML report
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(html_content)

            print(f"HTML report generated: {output_file}")
            return output_file

        except Exception as e:
            print(f"Error generating HTML report: {e}")
            return None

    def generate_csv_reports(self, output_dir="backup_reports"):
        """Generate CSV reports for data analysis"""
        try:
            os.makedirs(output_dir, exist_ok=True)
            conn = sqlite3.connect(self.db_file)

            # Export session data
            df_sessions = pd.read_sql_query("SELECT * FROM backup_sessions ORDER BY timestamp DESC", conn)
            sessions_file = os.path.join(output_dir, "backup_sessions.csv")
            df_sessions.to_csv(sessions_file, index=False)

            # Export file data
            df_files = pd.read_sql_query("""
                SELECT bf.*, bs.timestamp as session_timestamp, bs.type as backup_type
                FROM backup_files bf
                JOIN backup_sessions bs ON bf.session_id = bs.id
                ORDER BY bf.backup_time DESC
            """, conn)
            files_file = os.path.join(output_dir, "backup_files.csv")
            df_files.to_csv(files_file, index=False)

            # Generate summary statistics CSV
            summary_stats = self.generate_summary_report()
            summary_file = os.path.join(output_dir, "backup_summary.csv")

            summary_df = pd.DataFrame([
                ["Total Sessions", summary_stats.get("total_sessions", 0)],
                ["Successful Sessions", summary_stats.get("successful_sessions", 0)],
                ["Total Files", summary_stats.get("total_files_backed_up", 0)],
                ["Total Size (GB)", summary_stats.get("total_size_backed_up", 0) / (1024**3)],
                ["Average Duration (seconds)", summary_stats.get("average_session_duration", 0)],
                ["Latest Backup", summary_stats.get("latest_backup", "N/A")],
                ["Oldest Backup", summary_stats.get("oldest_backup", "N/A")]
            ], columns=["Metric", "Value"])

            summary_df.to_csv(summary_file, index=False)

            conn.close()

            print(f"CSV reports generated in: {output_dir}")
            return output_dir

        except Exception as e:
            print(f"Error generating CSV reports: {e}")
            return None

    def generate_health_report(self):
        """Generate backup system health assessment"""
        try:
            health_report = {
                "overall_status": "Unknown",
                "backup_consistency": "Unknown",
                "recent_activity": "Unknown",
                "storage_health": "Unknown",
                "recommendations": [],
                "alerts": [],
                "scores": {
                    "reliability": 0,
                    "performance": 0,
                    "consistency": 0,
                    "overall": 0
                }
            }

            conn = sqlite3.connect(self.db_file)

            # Get recent backup data
            recent_sessions = pd.read_sql_query("""
                SELECT * FROM backup_sessions
                WHERE date >= date('now', '-30 days')
                ORDER BY timestamp DESC
            """, conn)

            if recent_sessions.empty:
                health_report["overall_status"] = "Critical"
                health_report["recent_activity"] = "No recent backups"
                health_report["alerts"].append("No backups found in the last 30 days")
                health_report["recommendations"].append("Check backup configuration and schedule")
                conn.close()
                return health_report

            # Analyze backup consistency
            success_rate = len(recent_sessions[recent_sessions["status"] == "completed"]) / len(recent_sessions)

            if success_rate >= 0.95:
                health_report["backup_consistency"] = "Excellent"
                health_report["scores"]["reliability"] = 95
            elif success_rate >= 0.8:
                health_report["backup_consistency"] = "Good"
                health_report["scores"]["reliability"] = 80
            elif success_rate >= 0.6:
                health_report["backup_consistency"] = "Fair"
                health_report["scores"]["reliability"] = 60
                health_report["recommendations"].append("Investigate backup failures")
            else:
                health_report["backup_consistency"] = "Poor"
                health_report["scores"]["reliability"] = 40
                health_report["alerts"].append(f"Low backup success rate: {success_rate:.1%}")

            # Analyze recent activity
            days_since_last = (datetime.now() - pd.to_datetime(recent_sessions.iloc[0]["timestamp"], format="%Y%m%d_%H%M%S")).days

            if days_since_last <= 1:
                health_report["recent_activity"] = "Active"
            elif days_since_last <= 7:
                health_report["recent_activity"] = "Recent"
            elif days_since_last <= 14:
                health_report["recent_activity"] = "Stale"
                health_report["recommendations"].append("Consider more frequent backups")
            else:
                health_report["recent_activity"] = "Inactive"
                health_report["alerts"].append(f"Last backup was {days_since_last} days ago")

            # Analyze performance trends
            if len(recent_sessions) >= 3:
                recent_speeds = recent_sessions["total_size"] / (recent_sessions["duration_seconds"] + 1) / (1024*1024)
                avg_speed = recent_speeds.mean()

                if avg_speed >= 50:  # 50 MB/s
                    health_report["scores"]["performance"] = 90
                elif avg_speed >= 10:  # 10 MB/s
                    health_report["scores"]["performance"] = 70
                elif avg_speed >= 5:   # 5 MB/s
                    health_report["scores"]["performance"] = 50
                else:
                    health_report["scores"]["performance"] = 30
                    health_report["recommendations"].append("Backup performance is slow - check storage and network")

            # Analyze backup size consistency
            size_variation = recent_sessions["total_size"].std() / recent_sessions["total_size"].mean()
            if size_variation < 0.2:
                health_report["scores"]["consistency"] = 90
            elif size_variation < 0.5:
                health_report["scores"]["consistency"] = 70
            else:
                health_report["scores"]["consistency"] = 50
                health_report["recommendations"].append("Backup sizes vary significantly - review data sources")

            # Calculate overall score
            health_report["scores"]["overall"] = (
                health_report["scores"]["reliability"] * 0.4 +
                health_report["scores"]["performance"] * 0.3 +
                health_report["scores"]["consistency"] * 0.3
            )

            # Determine overall status
            if health_report["scores"]["overall"] >= 85:
                health_report["overall_status"] = "Excellent"
            elif health_report["scores"]["overall"] >= 70:
                health_report["overall_status"] = "Good"
            elif health_report["scores"]["overall"] >= 50:
                health_report["overall_status"] = "Fair"
            else:
                health_report["overall_status"] = "Poor"

            conn.close()
            return health_report

        except Exception as e:
            print(f"Error generating health report: {e}")
            return {"overall_status": "Error", "alerts": [f"Health check failed: {e}"]}

# GUI for Report Generation
class BackupReportGUI:
    def __init__(self):
        self.report_generator = None
        self.setup_gui()

    def setup_gui(self):
        """Setup the report generation GUI"""
        self.root = tk.Tk()
        self.root.title("Backup Report Generator")
        self.root.geometry("700x600")

        # Main frame
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Header
        header_frame = ttk.Frame(main_frame)
        header_frame.pack(fill=tk.X, pady=(0, 20))

        ttk.Label(header_frame, text="📊 Backup Report Generator", font=("Arial", 16, "bold")).pack()
        ttk.Label(header_frame, text="Generate comprehensive reports from your backup data",
                 font=("Arial", 10)).pack()

        # Backup directory selection
        dir_frame = ttk.LabelFrame(main_frame, text="Backup Directory", padding="10")
        dir_frame.pack(fill=tk.X, pady=(0, 10))

        self.backup_dir_var = tk.StringVar()
        dir_entry_frame = ttk.Frame(dir_frame)
        dir_entry_frame.pack(fill=tk.X)

        ttk.Entry(dir_entry_frame, textvariable=self.backup_dir_var, width=60).pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Button(dir_entry_frame, text="Browse", command=self.select_backup_directory).pack(side=tk.RIGHT, padx=(5, 0))

        ttk.Button(dir_frame, text="Scan Directory", command=self.scan_directory).pack(pady=(10, 0))

        # Report options
        options_frame = ttk.LabelFrame(main_frame, text="Report Options", padding="10")
        options_frame.pack(fill=tk.X, pady=(0, 10))

        self.html_report_var = tk.BooleanVar(value=True)
        self.csv_reports_var = tk.BooleanVar(value=False)
        self.health_report_var = tk.BooleanVar(value=True)

        ttk.Checkbutton(options_frame, text="Generate HTML Report (recommended)",
                       variable=self.html_report_var).pack(anchor=tk.W)
        ttk.Checkbutton(options_frame, text="Generate CSV Data Export",
                       variable=self.csv_reports_var).pack(anchor=tk.W)
        ttk.Checkbutton(options_frame, text="Include Health Assessment",
                       variable=self.health_report_var).pack(anchor=tk.W)

        # Generation controls
        generate_frame = ttk.LabelFrame(main_frame, text="Generate Reports", padding="10")
        generate_frame.pack(fill=tk.X, pady=(0, 10))

        button_frame = ttk.Frame(generate_frame)
        button_frame.pack(fill=tk.X)

        self.generate_btn = ttk.Button(button_frame, text="Generate Reports",
                                     command=self.generate_reports)
        self.generate_btn.pack(side=tk.LEFT, padx=(0, 10))

        ttk.Button(button_frame, text="Quick Health Check",
                  command=self.quick_health_check).pack(side=tk.LEFT)

        # Progress and status
        self.status_var = tk.StringVar(value="Ready to generate reports...")
        ttk.Label(generate_frame, textvariable=self.status_var).pack(pady=(10, 5))

        self.progress_bar = ttk.Progressbar(generate_frame, mode='indeterminate')
        self.progress_bar.pack(fill=tk.X, pady=(0, 10))

        # Results area
        results_frame = ttk.LabelFrame(main_frame, text="Generated Reports", padding="10")
        results_frame.pack(fill=tk.BOTH, expand=True)

        # Create text widget for results
        self.results_text = tk.Text(results_frame, height=15, wrap=tk.WORD, state=tk.DISABLED)
        results_scrollbar = ttk.Scrollbar(results_frame, orient="vertical", command=self.results_text.yview)
        self.results_text.configure(yscrollcommand=results_scrollbar.set)

        self.results_text.pack(side="left", fill="both", expand=True)
        results_scrollbar.pack(side="right", fill="y")

    def select_backup_directory(self):
        """Select backup directory"""
        directory = filedialog.askdirectory(title="Select Backup Directory")
        if directory:
            self.backup_dir_var.set(directory)

    def scan_directory(self):
        """Scan backup directory for data"""
        backup_dir = self.backup_dir_var.get()
        if not backup_dir:
            messagebox.showerror("Error", "Please select a backup directory first")
            return

        if not os.path.exists(backup_dir):
            messagebox.showerror("Error", "Selected directory does not exist")
            return

        try:
            self.status_var.set("Scanning backup directory...")
            self.progress_bar.start()

            self.report_generator = BackupReportGenerator(backup_dir)

            # Run scan in thread
            def scan_thread():
                success = self.report_generator.scan_backup_directory()

                self.root.after(0, lambda: self.scan_complete(success))

            import threading
            threading.Thread(target=scan_thread, daemon=True).start()

        except Exception as e:
            messagebox.showerror("Error", f"Failed to scan directory: {str(e)}")
            self.progress_bar.stop()

    def scan_complete(self, success):
        """Called when scan is complete"""
        self.progress_bar.stop()

        if success:
            self.status_var.set("Directory scanned successfully!")
            self.update_results("✅ Backup directory scanned successfully\n")
            self.generate_btn.config(state="normal")
        else:
            self.status_var.set("Failed to scan directory")
            messagebox.showerror("Error", "Failed to scan backup directory")

    def generate_reports(self):
        """Generate selected reports"""
        if not self.report_generator:
            messagebox.showerror("Error", "Please scan a backup directory first")
            return

        try:
            self.status_var.set("Generating reports...")
            self.progress_bar.start()

            def generate_thread():
                results = []

                # Generate HTML report
                if self.html_report_var.get():
                    html_file = self.report_generator.generate_html_report()
                    if html_file:
                        results.append(f"✅ HTML Report: {html_file}")
                    else:
                        results.append("❌ Failed to generate HTML report")

                # Generate CSV reports
                if self.csv_reports_var.get():
                    csv_dir = self.report_generator.generate_csv_reports()
                    if csv_dir:
                        results.append(f"✅ CSV Reports: {csv_dir}/")
                    else:
                        results.append("❌ Failed to generate CSV reports")

                # Generate health report
                if self.health_report_var.get():
                    health_data = self.report_generator.generate_health_report()
                    results.append(f"✅ Health Check: {health_data.get('overall_status', 'Unknown')}")

                self.root.after(0, lambda: self.generation_complete(results, health_data if self.health_report_var.get() else None))

            import threading
            threading.Thread(target=generate_thread, daemon=True).start()

        except Exception as e:
            messagebox.showerror("Error", f"Failed to generate reports: {str(e)}")
            self.progress_bar.stop()

    def generation_complete(self, results, health_data=None):
        """Called when report generation is complete"""
        self.progress_bar.stop()
        self.status_var.set("Reports generated successfully!")

        # Update results display
        for result in results:
            self.update_results(result + "\n")

        if health_data:
            self.update_results("\n📋 HEALTH ASSESSMENT:\n")
            self.update_results(f"Overall Status: {health_data.get('overall_status', 'Unknown')}\n")
            self.update_results(f"Backup Consistency: {health_data.get('backup_consistency', 'Unknown')}\n")
            self.update_results(f"Recent Activity: {health_data.get('recent_activity', 'Unknown')}\n")

            if health_data.get('alerts'):
                self.update_results("\n⚠️ ALERTS:\n")
                for alert in health_data['alerts']:
                    self.update_results(f"  • {alert}\n")

            if health_data.get('recommendations'):
                self.update_results("\n💡 RECOMMENDATIONS:\n")
                for rec in health_data['recommendations']:
                    self.update_results(f"  • {rec}\n")

        # Offer to open HTML report
        if self.html_report_var.get() and "backup_report.html" in results[0]:
            if messagebox.askyesno("Open Report", "Would you like to open the HTML report in your browser?"):
                self.open_html_report()

    def quick_health_check(self):
        """Perform quick health check"""
        if not self.report_generator:
            messagebox.showerror("Error", "Please scan a backup directory first")
            return

        try:
            self.status_var.set("Performing health check...")

            health_data = self.report_generator.generate_health_report()

            self.status_var.set("Health check complete")

            # Show health summary
            summary = f"""
BACKUP SYSTEM HEALTH CHECK

Overall Status: {health_data.get('overall_status', 'Unknown')}
Reliability Score: {health_data.get('scores', {}).get('reliability', 0)}%
Performance Score: {health_data.get('scores', {}).get('performance', 0)}%
Consistency Score: {health_data.get('scores', {}).get('consistency', 0)}%

Backup Consistency: {health_data.get('backup_consistency', 'Unknown')}
Recent Activity: {health_data.get('recent_activity', 'Unknown')}
"""

            if health_data.get('alerts'):
                summary += "\nALERTS:\n"
                for alert in health_data['alerts']:
                    summary += f"  • {alert}\n"

            messagebox.showinfo("Health Check Results", summary)

        except Exception as e:
            messagebox.showerror("Error", f"Health check failed: {str(e)}")

    def update_results(self, text):
        """Update results text widget"""
        self.results_text.config(state=tk.NORMAL)
        self.results_text.insert(tk.END, text)
        self.results_text.see(tk.END)
        self.results_text.config(state=tk.DISABLED)
        self.root.update_idletasks()

    def open_html_report(self):
        """Open HTML report in browser"""
        try:
            html_file = os.path.abspath("backup_report.html")
            webbrowser.open(f"file://{html_file}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to open report: {str(e)}")

    def run(self):
        """Start the GUI"""
        self.root.mainloop()

def main():
    """Main function"""
    import argparse

    parser = argparse.ArgumentParser(description="Backup Report Generator")
    parser.add_argument("--gui", action="store_true", help="Launch GUI interface")
    parser.add_argument("--backup-dir", "-d", help="Backup directory to analyze")
    parser.add_argument("--html", action="store_true", help="Generate HTML report")
    parser.add_argument("--csv", action="store_true", help="Generate CSV reports")
    parser.add_argument("--health", action="store_true", help="Generate health report")
    parser.add_argument("--scan", action="store_true", help="Scan backup directory first")

    args = parser.parse_args()

    if args.gui or len(os.sys.argv) == 1:
        # Launch GUI
        app = BackupReportGUI()
        app.run()
    else:
        # CLI mode
        if not args.backup_dir:
            print("Error: --backup-dir is required for CLI mode")
            return

        generator = BackupReportGenerator(args.backup_dir)

        if args.scan:
            print("Scanning backup directory...")
            if generator.scan_backup_directory():
                print("✅ Scan completed successfully")
            else:
                print("❌ Scan failed")
                return

        if args.html:
            print("Generating HTML report...")
            html_file = generator.generate_html_report()
            if html_file:
                print(f"✅ HTML report generated: {html_file}")
            else:
                print("❌ Failed to generate HTML report")

        if args.csv:
            print("Generating CSV reports...")
            csv_dir = generator.generate_csv_reports()
            if csv_dir:
                print(f"✅ CSV reports generated: {csv_dir}")
            else:
                print("❌ Failed to generate CSV reports")

        if args.health:
            print("Generating health report...")
            health_data = generator.generate_health_report()
            print(f"Overall Status: {health_data.get('overall_status', 'Unknown')}")
            print(f"Backup Consistency: {health_data.get('backup_consistency', 'Unknown')}")

if __name__ == "__main__":
    main()