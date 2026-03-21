#!/usr/bin/env python3
"""
Test script for the Simple Backup Tool
Creates test files and runs a backup to verify functionality
"""

import os
import tempfile
import shutil
import sys
sys.path.append('.')

# Import the BackupTool class from backup-tool.py
exec(open('backup-tool.py').read())
# Now BackupTool class is available

def create_test_files():
    """Create test source files"""
    test_dir = tempfile.mkdtemp(prefix="backup_test_source_")

    # Create some test files
    with open(os.path.join(test_dir, "test1.txt"), 'w') as f:
        f.write("This is test file 1\n" * 100)

    with open(os.path.join(test_dir, "test2.txt"), 'w') as f:
        f.write("This is test file 2\n" * 50)

    # Create a subdirectory with files
    subdir = os.path.join(test_dir, "subdir")
    os.makedirs(subdir)

    with open(os.path.join(subdir, "nested.txt"), 'w') as f:
        f.write("Nested file content\n" * 25)

    # Create a file that should be excluded
    with open(os.path.join(test_dir, "temp.tmp"), 'w') as f:
        f.write("This should be excluded")

    print(f"Created test source directory: {test_dir}")
    return test_dir

def test_backup():
    """Test the backup functionality"""
    print("Starting backup tool test...")

    # Create test source
    source_dir = create_test_files()

    # Create test destination
    dest_dir = tempfile.mkdtemp(prefix="backup_test_dest_")

    try:
        # Initialize backup tool
        backup_tool = BackupTool()
        backup_tool.config = {
            "source_folders": [source_dir],
            "backup_destination": dest_dir,
            "incremental": True,
            "exclude_patterns": [".tmp", ".log", "__pycache__", ".git"]
        }

        # Run first backup
        print("Running first backup...")
        success1 = backup_tool.run_backup()

        if success1:
            print("✓ First backup completed successfully")
        else:
            print("✗ First backup failed")
            return False

        # Modify a file
        with open(os.path.join(source_dir, "test1.txt"), 'a') as f:
            f.write("Modified content\n")

        # Run incremental backup
        print("Running incremental backup...")
        success2 = backup_tool.run_backup()

        if success2:
            print("✓ Incremental backup completed successfully")
        else:
            print("✗ Incremental backup failed")
            return False

        # Verify backup contents
        backup_folders = [d for d in os.listdir(dest_dir) if d.startswith("backup_")]

        if len(backup_folders) >= 2:
            print(f"✓ Found {len(backup_folders)} backup sessions")

            # Check if files exist in latest backup
            latest_backup = sorted(backup_folders)[-1]
            backup_path = os.path.join(dest_dir, latest_backup)

            source_name = os.path.basename(source_dir)
            backup_source_path = os.path.join(backup_path, source_name)

            if os.path.exists(os.path.join(backup_source_path, "test1.txt")):
                print("✓ Test files found in backup")
            else:
                print("✗ Test files not found in backup")
                return False

            if os.path.exists(os.path.join(backup_source_path, "subdir", "nested.txt")):
                print("✓ Subdirectory structure preserved")
            else:
                print("✗ Subdirectory structure not preserved")
                return False

            if not os.path.exists(os.path.join(backup_source_path, "temp.tmp")):
                print("✓ Excluded files properly filtered")
            else:
                print("✗ Excluded files not filtered")
                return False

        print("All tests passed! ✓")
        return True

    finally:
        # Cleanup
        try:
            shutil.rmtree(source_dir)
            shutil.rmtree(dest_dir)
            print(f"Cleaned up test directories")
        except Exception as e:
            print(f"Error cleaning up: {e}")

if __name__ == "__main__":
    test_backup()