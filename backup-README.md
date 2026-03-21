# Simple Backup Tool

A lightweight, cross-platform backup utility with both GUI and command-line interfaces.

## Features

- **Easy-to-use GUI** with drag-and-drop simplicity
- **Incremental backups** - only copies changed files
- **Multiple source folders** support
- **Automatic file exclusions** (temp files, logs, etc.)
- **Progress tracking** and detailed logging
- **Cross-platform** (Windows, Mac, Linux)
- **Command-line interface** for automation

## Quick Start

### Windows (GUI)
1. Double-click `run-backup.bat`
2. Add your source folders (Documents, Photos, etc.)
3. Select backup destination (external drive, network folder)
4. Click "Start Backup"

### Command Line Usage

```bash
# GUI mode
python backup-tool.py --gui

# CLI mode - backup specific folders
python backup-tool.py -s "C:\Users\Doug\Documents" -s "C:\Users\Doug\Pictures" -d "E:\Backups"

# Incremental backup
python backup-tool.py -s "/home/user/documents" -d "/backup/drive" --incremental
```

## How It Works

### Incremental Backups
- First run: Copies all files
- Subsequent runs: Only copies new/changed files
- Uses MD5 hashing to detect changes
- Saves time and storage space

### File Organization
```
Backup Destination/
├── backup_20260321_143022/
│   ├── Documents/
│   ├── Pictures/
│   └── Projects/
├── backup_20260322_090515/
└── backup_log.txt
```

### Excluded Files
Automatically skips:
- `.tmp` files
- `.log` files
- `__pycache__` folders
- `.git` repositories

## Configuration

Settings are automatically saved to `backup_config.json`:

```json
{
  "source_folders": [
    "C:\\Users\\Doug\\Documents",
    "C:\\Users\\Doug\\Pictures"
  ],
  "backup_destination": "E:\\Backups",
  "incremental": true,
  "exclude_patterns": [".tmp", ".log", "__pycache__", ".git"]
}
```

## Examples

### Personal Backup Setup
1. **Source Folders:**
   - Documents
   - Pictures
   - Desktop
   - Downloads

2. **Destination:** External USB drive or network storage

3. **Schedule:** Run weekly or use Task Scheduler

### Project Backup
```bash
# Backup development projects
python backup-tool.py \
  -s "/projects/website" \
  -s "/projects/app" \
  -d "/backups/projects" \
  --incremental
```

### System Backup
```bash
# Backup user profile
python backup-tool.py \
  -s "C:\Users\%USERNAME%" \
  -d "\\network-nas\backups\%COMPUTERNAME%" \
  --incremental
```

## Automation

### Windows Task Scheduler
1. Create Basic Task
2. Action: Start Program
3. Program: `python`
4. Arguments: `backup-tool.py -s "C:\Important" -d "E:\Backup"`

### Linux/Mac Crontab
```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/backup && python backup-tool.py -s "/home/user/documents" -d "/backup/drive"
```

## Logging

All backup operations are logged to `backup_log.txt`:

```
[2026-03-21 14:30:22] Starting backup to: E:\Backups\backup_20260321_143022
[2026-03-21 14:30:23] Backing up: C:\Users\Doug\Documents
[2026-03-21 14:30:45] Backup completed for Documents: 234 files copied, 1,450 files skipped
[2026-03-21 14:30:46] Backup completed successfully!
```

## Troubleshooting

### Common Issues

**"No module named tkinter"**
- Install tkinter: `sudo apt-get install python3-tk` (Linux)
- Use CLI mode: `python backup-tool.py --help`

**Permission Denied**
- Run as Administrator (Windows)
- Use `sudo` (Linux/Mac)
- Check destination folder permissions

**Backup Slow**
- Enable incremental backup
- Exclude large temp files
- Use local destination for initial backup

### Performance Tips

1. **First Backup:** May take hours for large datasets
2. **Incremental:** Usually completes in minutes
3. **Network Drives:** Slower than local storage
4. **Exclusions:** Add patterns for large temporary files

## Security Notes

- Backups are **not encrypted** by default
- Consider encrypting backup destination drive
- Test restore process regularly
- Keep multiple backup generations

## Requirements

- Python 3.6 or higher
- tkinter (usually included with Python)
- Windows/Mac/Linux compatible

## License

Free to use and modify for personal and commercial purposes.