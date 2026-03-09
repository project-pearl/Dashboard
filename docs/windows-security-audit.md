# Windows Security Audit Tool

Script: `scripts/windows-security-audit.ps1`

## What it does
- Scans for suspicious persistence signals:
  - Run / RunOnce registry entries
  - Startup folder entries
  - Non-Microsoft scheduled tasks
- Captures Windows Defender status.
- Optionally starts a Defender quick scan.
- Generates remediation actions.
- Applies selected remediations only after:
  - explicit user confirmation, and
  - successful Windows restore point creation.

## Run scan
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows-security-audit.ps1 -Mode scan
```

Artifacts are written to `.\security-audit\`:
- `latest-scan.json`
- `latest-actions.json`
- timestamped `scan-*.json`

## Run remediation (explicit selection)
Using IDs from `latest-actions.json`:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows-security-audit.ps1 -Mode resolve -ResolveIds A0001,A0002
```

Or interactive click-select (Out-GridView):
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows-security-audit.ps1 -Mode resolve -InteractiveSelect
```

You must type `YES` to proceed. If restore-point creation fails, remediation is aborted.

## GUI mode
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows-security-audit-gui.ps1
```

The GUI supports:
- `Run Scan`
- `Refresh Actions`
- checkbox selection + `Resolve Selected`

`Resolve Selected` requires a click confirmation and then runs remediation with restore-point gating.

## Requirements
- Windows PowerShell / PowerShell 7
- Administrator privileges for restore-point creation and most remediations
- System Protection enabled on `C:`

## Notes
- This is a triage/remediation helper, not a full antivirus replacement.
- Always review `latest-actions.json` before running resolve mode.
