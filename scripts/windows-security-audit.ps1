[CmdletBinding()]
param(
  [ValidateSet('scan', 'resolve')]
  [string]$Mode = 'scan',
  [string]$OutputDir = '.\security-audit',
  [string[]]$ResolveIds = @(),
  [switch]$InteractiveSelect,
  [switch]$SkipDefenderQuickScan,
  [switch]$AssumeYes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-IsAdmin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}

function New-ActionId {
  param([int]$Index)
  return ('A{0:d4}' -f $Index)
}

function Ensure-Dir {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -Path $Path -ItemType Directory | Out-Null
  }
}

function Get-DefenderSummary {
  try {
    $st = Get-MpComputerStatus
    [pscustomobject]@{
      realTimeProtection = $st.RealTimeProtectionEnabled
      amServiceEnabled = $st.AMServiceEnabled
      antispywareEnabled = $st.AntispywareEnabled
      antivirusEnabled = $st.AntivirusEnabled
      quickScanAgeDays = $st.QuickScanAge
      fullScanAgeDays = $st.FullScanAge
      sigAgeDays = $st.AntivirusSignatureAge
      engineVersion = $st.AMEngineVersion
    }
  } catch {
    [pscustomobject]@{
      error = $_.Exception.Message
    }
  }
}

function Get-StartupFolderEntries {
  $paths = @(
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup",
    "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Startup"
  )
  $items = @()
  foreach ($p in $paths) {
    if (Test-Path -LiteralPath $p) {
      Get-ChildItem -LiteralPath $p -File -ErrorAction SilentlyContinue | ForEach-Object {
        $items += [pscustomobject]@{
          source = 'startup-folder'
          location = $p
          name = $_.Name
          path = $_.FullName
        }
      }
    }
  }
  return $items
}

function Get-RunKeyEntries {
  $keySpecs = @(
    @{ Hive = 'HKCU'; Path = 'Software\Microsoft\Windows\CurrentVersion\Run' },
    @{ Hive = 'HKCU'; Path = 'Software\Microsoft\Windows\CurrentVersion\RunOnce' },
    @{ Hive = 'HKLM'; Path = 'Software\Microsoft\Windows\CurrentVersion\Run' },
    @{ Hive = 'HKLM'; Path = 'Software\Microsoft\Windows\CurrentVersion\RunOnce' }
  )

  $items = @()
  foreach ($spec in $keySpecs) {
    $full = "$($spec.Hive):\$($spec.Path)"
    try {
      $props = Get-ItemProperty -LiteralPath $full -ErrorAction Stop
      foreach ($prop in $props.PSObject.Properties) {
        if ($prop.Name -in @('PSPath', 'PSParentPath', 'PSChildName', 'PSDrive', 'PSProvider')) { continue }
        if (-not $prop.Value) { continue }
        $items += [pscustomobject]@{
          source = 'run-key'
          hive = $spec.Hive
          keyPath = $spec.Path
          name = $prop.Name
          command = [string]$prop.Value
        }
      }
    } catch {
      continue
    }
  }
  return $items
}

function Get-NonMicrosoftTasks {
  $items = @()
  Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskPath -notlike '\Microsoft\*' } | ForEach-Object {
    $task = $_
    foreach ($a in $task.Actions) {
      $exec = [string]$a.Execute
      if (-not $exec) { continue }
      $items += [pscustomobject]@{
        source = 'scheduled-task'
        taskName = $task.TaskName
        taskPath = $task.TaskPath
        state = [string]$task.State
        execute = $exec
        arguments = [string]$a.Arguments
      }
    }
  }
  return $items
}

function Test-SuspiciousPath {
  param([string]$PathText)
  if (-not $PathText) { return $false }
  $p = $PathText.ToLowerInvariant()
  return ($p -match '\\appdata\\' -or $p -match '\\temp\\' -or $p -match '\\users\\public\\' -or $p -match '\\programdata\\')
}

function New-RestorePoint {
  param([string]$Description)
  if (-not (Test-IsAdmin)) {
    throw 'Restore point creation requires running PowerShell as Administrator.'
  }
  Enable-ComputerRestore -Drive 'C:\' | Out-Null
  Checkpoint-Computer -Description $Description -RestorePointType 'MODIFY_SETTINGS' | Out-Null
}

function Select-ActionsInteractive {
  param([object[]]$Actions)
  if (-not $Actions -or $Actions.Count -eq 0) { return @() }
  try {
    $selected = $Actions | Select-Object id, risk, title, detail, kind | Out-GridView -Title 'Select remediations and click OK' -PassThru
    return @($selected | ForEach-Object { $_.id })
  } catch {
    Write-Warning 'Out-GridView unavailable; falling back to provided -ResolveIds.'
    return @()
  }
}

Ensure-Dir -Path $OutputDir
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'

if ($Mode -eq 'scan') {
  $findings = @()
  $actions = @()
  $actionIndex = 0

  $defender = Get-DefenderSummary
  $findings += [pscustomobject]@{
    id = 'F-DEFENDER'
    severity = if ($defender.error) { 'high' } elseif (-not $defender.realTimeProtection) { 'high' } else { 'info' }
    title = 'Windows Defender status'
    detail = if ($defender.error) { $defender.error } else { "RTP=$($defender.realTimeProtection), SigAgeDays=$($defender.sigAgeDays), QuickScanAgeDays=$($defender.quickScanAgeDays)" }
    data = $defender
  }

  if (-not $SkipDefenderQuickScan) {
    try {
      Start-MpScan -ScanType QuickScan | Out-Null
      $findings += [pscustomobject]@{
        id = 'F-DEFENDER-SCAN'
        severity = 'info'
        title = 'Defender quick scan started'
        detail = 'Quick scan launched in background.'
      }
    } catch {
      $findings += [pscustomobject]@{
        id = 'F-DEFENDER-SCAN'
        severity = 'medium'
        title = 'Unable to start Defender quick scan'
        detail = $_.Exception.Message
      }
    }
  }

  $runEntries = Get-RunKeyEntries
  foreach ($r in $runEntries) {
    if (Test-SuspiciousPath -PathText $r.command) {
      $findings += [pscustomobject]@{
        id = "F-RUN-$($r.hive)-$($r.name)"
        severity = 'medium'
        title = "Suspicious autorun value: $($r.name)"
        detail = "$($r.hive):\$($r.keyPath) -> $($r.command)"
      }
      $actionIndex++
      $actions += [pscustomobject]@{
        id = (New-ActionId -Index $actionIndex)
        kind = 'remove-run'
        risk = 'caution'
        title = "Remove autorun value '$($r.name)'"
        detail = "$($r.hive):\$($r.keyPath)"
        payload = @{
          hive = $r.hive
          keyPath = $r.keyPath
          name = $r.name
        }
      }
    }
  }

  $startup = Get-StartupFolderEntries
  foreach ($s in $startup) {
    if (Test-SuspiciousPath -PathText $s.path) {
      $findings += [pscustomobject]@{
        id = "F-STARTUP-$($s.name)"
        severity = 'medium'
        title = "Suspicious startup file: $($s.name)"
        detail = $s.path
      }
      $actionIndex++
      $actions += [pscustomobject]@{
        id = (New-ActionId -Index $actionIndex)
        kind = 'quarantine-file'
        risk = 'safe'
        title = "Quarantine startup file '$($s.name)'"
        detail = $s.path
        payload = @{
          path = $s.path
        }
      }
    }
  }

  $tasks = Get-NonMicrosoftTasks
  foreach ($t in $tasks) {
    if (Test-SuspiciousPath -PathText $t.execute) {
      $findings += [pscustomobject]@{
        id = "F-TASK-$($t.taskName)"
        severity = 'medium'
        title = "Suspicious scheduled task: $($t.taskName)"
        detail = "$($t.taskPath)$($t.taskName) -> $($t.execute) $($t.arguments)"
      }
      $actionIndex++
      $actions += [pscustomobject]@{
        id = (New-ActionId -Index $actionIndex)
        kind = 'disable-task'
        risk = 'safe'
        title = "Disable scheduled task '$($t.taskName)'"
        detail = $t.taskPath
        payload = @{
          taskName = $t.taskName
          taskPath = $t.taskPath
        }
      }
    }
  }

  $listeners = @()
  try {
    $listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
      $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
      [pscustomobject]@{
        localAddress = $_.LocalAddress
        localPort = $_.LocalPort
        processId = $_.OwningProcess
        processName = if ($p) { $p.ProcessName } else { 'unknown' }
      }
    }
  } catch {
    $listeners = @()
  }

  $result = [pscustomobject]@{
    generatedAt = (Get-Date).ToString('o')
    hostname = $env:COMPUTERNAME
    user = "$env:USERDOMAIN\$env:USERNAME"
    isAdmin = (Test-IsAdmin)
    findings = $findings
    actions = $actions
    listeners = $listeners
  }

  $reportPath = Join-Path $OutputDir ("scan-$timestamp.json")
  $actionsPath = Join-Path $OutputDir 'latest-actions.json'
  $latestPath = Join-Path $OutputDir 'latest-scan.json'

  $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding UTF8
  $actions | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $actionsPath -Encoding UTF8
  $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $latestPath -Encoding UTF8

  Write-Host "Scan complete: $reportPath"
  Write-Host "Pending actions: $($actions.Count) (saved to $actionsPath)"
  exit 0
}

if ($Mode -eq 'resolve') {
  $actionsPath = Join-Path $OutputDir 'latest-actions.json'
  if (-not (Test-Path -LiteralPath $actionsPath)) {
    throw "No actions file found at $actionsPath. Run scan mode first."
  }

  $allActions = Get-Content -LiteralPath $actionsPath -Raw | ConvertFrom-Json
  $allActions = @($allActions)
  if ($allActions.Count -eq 0) {
    Write-Host 'No pending actions.'
    exit 0
  }

  $selectedIds = @()
  if ($InteractiveSelect) {
    $selectedIds = Select-ActionsInteractive -Actions $allActions
  }
  if ($ResolveIds.Count -gt 0) {
    $selectedIds += $ResolveIds
  }
  $selectedIds = @($selectedIds | Select-Object -Unique)
  if ($selectedIds.Count -eq 0) {
    throw 'No actions selected. Provide -ResolveIds or use -InteractiveSelect.'
  }

  $selected = @($allActions | Where-Object { $selectedIds -contains $_.id })
  if ($selected.Count -eq 0) {
    throw 'Selected action IDs were not found in latest-actions.json.'
  }

  Write-Host "Selected actions: $($selected.Count)"
  $selected | ForEach-Object { Write-Host " - $($_.id): $($_.title)" }

  if (-not $AssumeYes) {
    $confirmation = Read-Host 'Type YES to create restore point and execute selected remediations'
    if ($confirmation -ne 'YES') {
      throw 'Aborted by user.'
    }
  }

  try {
    New-RestorePoint -Description "Pre-Security-Remediation-$timestamp"
    Write-Host 'Restore point created.'
  } catch {
    throw "Restore point failed. Remediation aborted. $($_.Exception.Message)"
  }

  $quarantineDir = Join-Path $OutputDir 'quarantine'
  Ensure-Dir -Path $quarantineDir
  $execLog = @()

  foreach ($a in $selected) {
    $status = 'success'
    $message = 'ok'
    try {
      switch ($a.kind) {
        'disable-task' {
          Disable-ScheduledTask -TaskName $a.payload.taskName -TaskPath $a.payload.taskPath -ErrorAction Stop | Out-Null
        }
        'remove-run' {
          $key = "$($a.payload.hive):\$($a.payload.keyPath)"
          Remove-ItemProperty -LiteralPath $key -Name $a.payload.name -ErrorAction Stop
        }
        'quarantine-file' {
          $src = [string]$a.payload.path
          if (-not (Test-Path -LiteralPath $src)) { throw "File not found: $src" }
          $dest = Join-Path $quarantineDir ("$timestamp-" + [IO.Path]::GetFileName($src))
          Move-Item -LiteralPath $src -Destination $dest -Force
        }
        default {
          throw "Unsupported action kind: $($a.kind)"
        }
      }
    } catch {
      $status = 'failed'
      $message = $_.Exception.Message
    }

    $execLog += [pscustomobject]@{
      id = $a.id
      title = $a.title
      kind = $a.kind
      status = $status
      message = $message
      executedAt = (Get-Date).ToString('o')
    }
  }

  $resolvePath = Join-Path $OutputDir ("resolve-$timestamp.json")
  $execLog | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resolvePath -Encoding UTF8
  Write-Host "Resolution complete. Log: $resolvePath"
  exit 0
}
