Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# NOTE: StrictMode removed — causes variable-scope failures in WinForms event handlers
$ErrorActionPreference = 'Continue'

# Detect standalone (scripts in same folder) vs repo layout (scripts/ subfolder)
$script:backendScript = Join-Path $PSScriptRoot 'windows-security-audit.ps1'
if (Test-Path (Join-Path $PSScriptRoot 'security-audit')) {
  # Standalone: output folder is a child of the script directory
  $script:repoRoot = $PSScriptRoot
} elseif ((Split-Path -Leaf $PSScriptRoot) -eq 'scripts') {
  # Repo layout: scripts/ subfolder, output at repo root
  $script:repoRoot = Split-Path -Parent $PSScriptRoot
} else {
  $script:repoRoot = $PSScriptRoot
}
$script:outputDir = Join-Path $script:repoRoot 'security-audit'
$script:actionsPath = Join-Path $script:outputDir 'latest-actions.json'
$script:errorPath = Join-Path $script:outputDir 'latest-error.json'
$script:logoPath = Join-Path $PSScriptRoot 'dmh-logo.png'
$script:guiLogPath = Join-Path $script:outputDir 'gui-log.txt'

# ── Brand Colors ──────────────────────────────────────────────────────
$script:brandNavy      = [System.Drawing.Color]::FromArgb(10, 36, 99)
$script:brandNavyLight = [System.Drawing.Color]::FromArgb(18, 52, 126)
$script:brandGold      = [System.Drawing.Color]::FromArgb(212, 175, 55)
$script:brandGoldLight = [System.Drawing.Color]::FromArgb(235, 206, 110)
$script:brandWhite     = [System.Drawing.Color]::White
$script:brandGray      = [System.Drawing.Color]::FromArgb(240, 242, 245)
$script:brandDarkText  = [System.Drawing.Color]::FromArgb(30, 30, 30)
$script:riskRed        = [System.Drawing.Color]::FromArgb(200, 50, 50)
$script:riskOrange     = [System.Drawing.Color]::FromArgb(210, 130, 30)
$script:riskGreen      = [System.Drawing.Color]::FromArgb(40, 160, 60)

$script:appVersion = '1.0.0'

# ── Helper Functions ──────────────────────────────────────────────────

function Write-GuiLog {
  param([string]$Message)
  try {
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    "$ts  $Message" | Out-File -FilePath $script:guiLogPath -Append -Encoding UTF8
  } catch { }
}

function Ensure-Dir {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -Path $Path -ItemType Directory -Force | Out-Null
  }
}

function Invoke-Backend {
  param(
    [string[]]$ArgsList,
    [switch]$RequireAdmin
  )
  Ensure-Dir -Path $script:outputDir
  $stdoutLog = Join-Path $script:outputDir 'backend-stdout.txt'
  $stderrLog = Join-Path $script:outputDir 'backend-stderr.txt'

  $argString = "-NoProfile -ExecutionPolicy Bypass -File `"$($script:backendScript)`" " + ($ArgsList -join ' ')
  Write-GuiLog "Invoke-Backend: powershell.exe $argString"

  if ($RequireAdmin) {
    # RunAs cannot redirect output
    $p = Start-Process -FilePath 'powershell.exe' -ArgumentList $argString -WorkingDirectory $script:repoRoot -Verb RunAs -Wait -PassThru
    Write-GuiLog "Backend (RunAs) exit: $($p.ExitCode)"
    return $p.ExitCode
  }

  $p = Start-Process -FilePath 'powershell.exe' -ArgumentList $argString -WorkingDirectory $script:repoRoot -Wait -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
  $code = $p.ExitCode
  Write-GuiLog "Backend exit: $code"

  # Log stderr if non-zero
  if ($code -ne 0 -and (Test-Path $stderrLog)) {
    $errText = Get-Content $stderrLog -Raw -ErrorAction SilentlyContinue
    if ($errText) { Write-GuiLog "Backend stderr: $errText" }
  }
  return $code
}

function Load-Actions {
  if (-not (Test-Path -LiteralPath $script:actionsPath)) { return @() }
  $raw = Get-Content -LiteralPath $script:actionsPath -Raw -ErrorAction SilentlyContinue
  if (-not $raw) { return @() }
  $json = $raw | ConvertFrom-Json
  return @($json)
}

function Load-LatestErrorMessage {
  if (-not (Test-Path -LiteralPath $script:errorPath)) { return $null }
  try {
    $raw = Get-Content -LiteralPath $script:errorPath -Raw
    if (-not $raw) { return $null }
    $obj = $raw | ConvertFrom-Json
    return [string]$obj.message
  } catch {
    return $null
  }
}

function Refresh-Grid {
  $script:grid.Rows.Clear()
  $actions = @(Load-Actions)
  foreach ($a in $actions) {
    [void]$script:grid.Rows.Add($false, [string]$a.id, [string]$a.risk, [string]$a.title, [string]$a.detail, [string]$a.kind)
  }
  $count = $actions.Count
  if ($count -eq 0) {
    $script:statusLabel.Text = 'No pending actions. Run a scan to check your system.'
  } else {
    $script:statusLabel.Text = "$count remediation action(s) found"
  }
}

function Get-CheckedActionIds {
  $ids = @()
  foreach ($row in $script:grid.Rows) {
    if ($row.IsNewRow) { continue }
    $checked = $false
    if ($null -ne $row.Cells[0].Value) {
      $checked = [bool]$row.Cells[0].Value
    }
    if ($checked) {
      $ids += [string]$row.Cells[1].Value
    }
  }
  return @($ids | Select-Object -Unique)
}

function Get-DefenderStatusText {
  try {
    $s = Get-MpComputerStatus
    if ($s.QuickScanInProgress) { return 'Quick Scan in progress' }
    if ($s.FullScanInProgress) { return 'Full Scan in progress' }
    $age = if ($null -ne $s.QuickScanAge) { [string]$s.QuickScanAge } else { 'n/a' }
    $rtp = if ($s.RealTimeProtectionEnabled) { 'ON' } else { 'OFF' }
    return "Real-Time Protection: $rtp  |  Last Quick Scan: $age day(s) ago"
  } catch {
    return 'Status unavailable'
  }
}

Ensure-Dir -Path $script:outputDir
Write-GuiLog '--- GUI starting ---'
Write-GuiLog "backendScript: $($script:backendScript)"
Write-GuiLog "outputDir: $($script:outputDir)"
Write-GuiLog "logoPath: $($script:logoPath)  exists=$(Test-Path -LiteralPath $script:logoPath)"

# ── Main Form ─────────────────────────────────────────────────────────

$script:form = New-Object System.Windows.Forms.Form
$script:form.Text = 'DMH Security Audit'
$script:form.Size = New-Object System.Drawing.Size(1200, 750)
$script:form.StartPosition = 'CenterScreen'
$script:form.BackColor = $script:brandGray
$script:form.MinimumSize = New-Object System.Drawing.Size(900, 550)
$script:form.FormBorderStyle = 'Sizable'
$script:form.SuspendLayout()

# Load logo image into memory (avoids file-lock issues with FromFile)
$script:logoImage = $null
if (Test-Path -LiteralPath $script:logoPath) {
  try {
    $bytes = [System.IO.File]::ReadAllBytes($script:logoPath)
    $ms = New-Object System.IO.MemoryStream(,$bytes)
    $script:logoImage = [System.Drawing.Image]::FromStream($ms)
    Write-GuiLog "Logo loaded: $($script:logoImage.Width)x$($script:logoImage.Height)"
  } catch {
    Write-GuiLog "Logo load failed: $($_.Exception.Message)"
  }
}

# Set window icon from logo
if ($script:logoImage) {
  try {
    $iconBmp = New-Object System.Drawing.Bitmap($script:logoImage, 32, 32)
    $script:form.Icon = [System.Drawing.Icon]::FromHandle($iconBmp.GetHicon())
  } catch { }
}

# ── Header Banner ─────────────────────────────────────────────────────

$headerPanel = New-Object System.Windows.Forms.Panel
$headerPanel.Dock = 'Top'
$headerPanel.Height = 80
$headerPanel.BackColor = $script:brandNavy

# Logo image
if ($script:logoImage) {
  $logoPic = New-Object System.Windows.Forms.PictureBox
  $logoPic.Location = New-Object System.Drawing.Point(16, 8)
  $logoPic.Size = New-Object System.Drawing.Size(200, 64)
  $logoPic.SizeMode = 'Zoom'
  $logoPic.BackColor = $script:brandNavy
  $logoPic.Image = $script:logoImage
  $headerPanel.Controls.Add($logoPic)
  Write-GuiLog 'PictureBox added to header'
}

$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = 'Security Audit & Remediation'
$titleLabel.Font = New-Object System.Drawing.Font('Segoe UI', 18, [System.Drawing.FontStyle]::Bold)
$titleLabel.ForeColor = $script:brandGold
$titleLabel.BackColor = $script:brandNavy
$titleLabel.Location = New-Object System.Drawing.Point(230, 12)
$titleLabel.AutoSize = $true
$headerPanel.Controls.Add($titleLabel)

$subtitleLabel = New-Object System.Windows.Forms.Label
$subtitleLabel.Text = 'Persistence & Threat Detection for Windows Endpoints'
$subtitleLabel.Font = New-Object System.Drawing.Font('Segoe UI', 9.5)
$subtitleLabel.ForeColor = [System.Drawing.Color]::FromArgb(180, 195, 220)
$subtitleLabel.BackColor = $script:brandNavy
$subtitleLabel.Location = New-Object System.Drawing.Point(232, 48)
$subtitleLabel.AutoSize = $true
$headerPanel.Controls.Add($subtitleLabel)

$versionLabel = New-Object System.Windows.Forms.Label
$versionLabel.Text = "v$($script:appVersion)"
$versionLabel.Font = New-Object System.Drawing.Font('Segoe UI', 8)
$versionLabel.ForeColor = [System.Drawing.Color]::FromArgb(120, 140, 170)
$versionLabel.BackColor = $script:brandNavy
$versionLabel.Anchor = 'Top, Right'
$versionLabel.Location = New-Object System.Drawing.Point(1130, 58)
$versionLabel.AutoSize = $true
$headerPanel.Controls.Add($versionLabel)

# ── Defender Status Bar ───────────────────────────────────────────────

$defenderBarColor = [System.Drawing.Color]::FromArgb(225, 235, 248)
$defenderBar = New-Object System.Windows.Forms.Panel
$defenderBar.Dock = 'Top'
$defenderBar.Height = 32
$defenderBar.BackColor = $defenderBarColor

$defenderIcon = New-Object System.Windows.Forms.Label
$defenderIcon.Text = 'Defender:'
$defenderIcon.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
$defenderIcon.ForeColor = [System.Drawing.Color]::FromArgb(50, 60, 80)
$defenderIcon.Location = New-Object System.Drawing.Point(14, 7)
$defenderIcon.AutoSize = $true
$defenderIcon.BackColor = $defenderBarColor
$defenderBar.Controls.Add($defenderIcon)

$script:defenderStatus = New-Object System.Windows.Forms.Label
$script:defenderStatus.Text = Get-DefenderStatusText
$script:defenderStatus.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$script:defenderStatus.ForeColor = [System.Drawing.Color]::FromArgb(50, 60, 80)
$script:defenderStatus.BackColor = $defenderBarColor
$script:defenderStatus.Location = New-Object System.Drawing.Point(90, 7)
$script:defenderStatus.AutoSize = $true
$defenderBar.Controls.Add($script:defenderStatus)

# ── Toolbar ───────────────────────────────────────────────────────────

$toolbar = New-Object System.Windows.Forms.Panel
$toolbar.Dock = 'Top'
$toolbar.Height = 56
$toolbar.BackColor = $script:brandWhite

$btnScan = New-Object System.Windows.Forms.Button
$btnScan.Text = 'Run Scan'
$btnScan.Size = New-Object System.Drawing.Size(140, 36)
$btnScan.Location = New-Object System.Drawing.Point(16, 10)
$btnScan.FlatStyle = 'Flat'
$btnScan.FlatAppearance.BorderSize = 0
$btnScan.BackColor = $script:brandGold
$btnScan.ForeColor = $script:brandNavy
$btnScan.Font = New-Object System.Drawing.Font('Segoe UI', 9.5, [System.Drawing.FontStyle]::Bold)
$btnScan.Cursor = [System.Windows.Forms.Cursors]::Hand
$toolbar.Controls.Add($btnScan)

$btnRefresh = New-Object System.Windows.Forms.Button
$btnRefresh.Text = 'Refresh'
$btnRefresh.Size = New-Object System.Drawing.Size(120, 36)
$btnRefresh.Location = New-Object System.Drawing.Point(168, 10)
$btnRefresh.FlatStyle = 'Flat'
$btnRefresh.FlatAppearance.BorderSize = 0
$btnRefresh.BackColor = $script:brandNavy
$btnRefresh.ForeColor = $script:brandWhite
$btnRefresh.Font = New-Object System.Drawing.Font('Segoe UI', 9.5, [System.Drawing.FontStyle]::Bold)
$btnRefresh.Cursor = [System.Windows.Forms.Cursors]::Hand
$toolbar.Controls.Add($btnRefresh)

$btnResolve = New-Object System.Windows.Forms.Button
$btnResolve.Text = 'Resolve Selected'
$btnResolve.Size = New-Object System.Drawing.Size(160, 36)
$btnResolve.Location = New-Object System.Drawing.Point(300, 10)
$btnResolve.FlatStyle = 'Flat'
$btnResolve.FlatAppearance.BorderSize = 0
$btnResolve.BackColor = [System.Drawing.Color]::FromArgb(160, 50, 50)
$btnResolve.ForeColor = $script:brandWhite
$btnResolve.Font = New-Object System.Drawing.Font('Segoe UI', 9.5, [System.Drawing.FontStyle]::Bold)
$btnResolve.Cursor = [System.Windows.Forms.Cursors]::Hand
$toolbar.Controls.Add($btnResolve)

$noteLabel = New-Object System.Windows.Forms.Label
$noteLabel.Text = 'Remediation creates a restore point before making changes. UAC elevation is requested when needed.'
$noteLabel.Font = New-Object System.Drawing.Font('Segoe UI', 8.25, [System.Drawing.FontStyle]::Italic)
$noteLabel.ForeColor = [System.Drawing.Color]::FromArgb(120, 120, 130)
$noteLabel.Location = New-Object System.Drawing.Point(480, 18)
$noteLabel.AutoSize = $true
$toolbar.Controls.Add($noteLabel)

# ── Separator ─────────────────────────────────────────────────────────

$sep = New-Object System.Windows.Forms.Panel
$sep.Dock = 'Top'
$sep.Height = 2
$sep.BackColor = [System.Drawing.Color]::FromArgb(200, 210, 225)

# ── Status Bar (Bottom) ──────────────────────────────────────────────

$statusBar = New-Object System.Windows.Forms.Panel
$statusBar.Dock = 'Bottom'
$statusBar.Height = 30
$statusBar.BackColor = $script:brandNavy

$script:statusLabel = New-Object System.Windows.Forms.Label
$script:statusLabel.Text = 'Ready'
$script:statusLabel.Font = New-Object System.Drawing.Font('Segoe UI', 8.5)
$script:statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(180, 195, 220)
$script:statusLabel.BackColor = $script:brandNavy
$script:statusLabel.Location = New-Object System.Drawing.Point(14, 6)
$script:statusLabel.AutoSize = $true
$statusBar.Controls.Add($script:statusLabel)

$copyrightYear = Get-Date -Format 'yyyy'
$copyrightLabel = New-Object System.Windows.Forms.Label
$copyrightLabel.Text = "Copyright $copyrightYear DMH Computers, Inc."
$copyrightLabel.Font = New-Object System.Drawing.Font('Segoe UI', 7.5)
$copyrightLabel.ForeColor = [System.Drawing.Color]::FromArgb(100, 120, 155)
$copyrightLabel.BackColor = $script:brandNavy
$copyrightLabel.Anchor = 'Bottom, Right'
$copyrightLabel.Location = New-Object System.Drawing.Point(950, 8)
$copyrightLabel.AutoSize = $true
$statusBar.Controls.Add($copyrightLabel)

# ── Data Grid ─────────────────────────────────────────────────────────

$script:grid = New-Object System.Windows.Forms.DataGridView
$script:grid.Dock = 'Fill'
$script:grid.AllowUserToAddRows = $false
$script:grid.AllowUserToDeleteRows = $false
$script:grid.ReadOnly = $false
$script:grid.SelectionMode = 'FullRowSelect'
$script:grid.MultiSelect = $true
$script:grid.AutoSizeColumnsMode = 'Fill'
$script:grid.RowHeadersVisible = $false
$script:grid.BorderStyle = 'None'
$script:grid.CellBorderStyle = 'SingleHorizontal'
$script:grid.BackgroundColor = $script:brandWhite
$script:grid.GridColor = [System.Drawing.Color]::FromArgb(225, 230, 240)
$script:grid.DefaultCellStyle.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$script:grid.DefaultCellStyle.SelectionBackColor = [System.Drawing.Color]::FromArgb(220, 232, 252)
$script:grid.DefaultCellStyle.SelectionForeColor = $script:brandDarkText
$script:grid.DefaultCellStyle.Padding = New-Object System.Windows.Forms.Padding(4, 3, 4, 3)
$script:grid.RowTemplate.Height = 30
$script:grid.EnableHeadersVisualStyles = $false
$script:grid.ColumnHeadersDefaultCellStyle.BackColor = $script:brandNavy
$script:grid.ColumnHeadersDefaultCellStyle.ForeColor = $script:brandWhite
$script:grid.ColumnHeadersDefaultCellStyle.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
$script:grid.ColumnHeadersDefaultCellStyle.Padding = New-Object System.Windows.Forms.Padding(4, 0, 4, 0)
$script:grid.ColumnHeadersHeight = 34
$script:grid.ColumnHeadersHeightSizeMode = 'DisableResizing'
$script:grid.AlternatingRowsDefaultCellStyle.BackColor = [System.Drawing.Color]::FromArgb(246, 248, 252)

[void]$script:grid.Columns.Add((New-Object System.Windows.Forms.DataGridViewCheckBoxColumn -Property @{ Name = 'Select'; HeaderText = ''; FillWeight = 5 }))
[void]$script:grid.Columns.Add('Id', 'ID')
[void]$script:grid.Columns.Add('Risk', 'Risk')
[void]$script:grid.Columns.Add('Title', 'Finding')
[void]$script:grid.Columns.Add('Detail', 'Details')
[void]$script:grid.Columns.Add('Kind', 'Action Type')
$script:grid.Columns['Id'].FillWeight = 8
$script:grid.Columns['Risk'].FillWeight = 8
$script:grid.Columns['Title'].FillWeight = 25
$script:grid.Columns['Detail'].FillWeight = 42
$script:grid.Columns['Kind'].FillWeight = 12

# Color-code risk column
$script:grid.Add_CellFormatting({
  param($s, $e)
  try {
    if ($e.ColumnIndex -eq 2 -and $e.RowIndex -ge 0) {
      $val = [string]$e.Value
      $boldFont = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
      switch ($val) {
        'caution' { $e.CellStyle.ForeColor = [System.Drawing.Color]::FromArgb(210, 130, 30);  $e.CellStyle.Font = $boldFont }
        'safe'    { $e.CellStyle.ForeColor = [System.Drawing.Color]::FromArgb(40, 160, 60);   $e.CellStyle.Font = $boldFont }
        default   { $e.CellStyle.ForeColor = [System.Drawing.Color]::FromArgb(200, 50, 50);   $e.CellStyle.Font = $boldFont }
      }
    }
  } catch { }
})

# ── Add controls in correct dock order ────────────────────────────────
# Add Fill + Bottom first, then Top panels in reverse visual order.
# Last-added Top panel docks outermost (topmost position).
$script:form.Controls.Add($script:grid)
$script:form.Controls.Add($statusBar)
$script:form.Controls.Add($sep)
$script:form.Controls.Add($toolbar)
$script:form.Controls.Add($defenderBar)
$script:form.Controls.Add($headerPanel)

$script:form.ResumeLayout($false)

# ── Button Event Handlers ─────────────────────────────────────────────

$btnScan.Add_Click({
  try {
    Write-GuiLog 'Scan button clicked'
    $script:statusLabel.Text = 'Scanning system for persistence threats...'
    $script:defenderStatus.Text = Get-DefenderStatusText
    $script:form.Cursor = [System.Windows.Forms.Cursors]::WaitCursor
    $script:form.Refresh()

    $exitCode = Invoke-Backend -ArgsList @('-Mode', 'scan', '-OutputDir', "`"$($script:outputDir)`"")

    $script:form.Cursor = [System.Windows.Forms.Cursors]::Default
    Write-GuiLog "Scan completed with exit code: $exitCode"

    if ($exitCode -eq 0) {
      Refresh-Grid
      $script:defenderStatus.Text = Get-DefenderStatusText
      [System.Windows.Forms.MessageBox]::Show(
        'System scan completed successfully.',
        'DMH Security Audit',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
      ) | Out-Null
    } else {
      # Try to read captured stderr for details
      $errDetail = ''
      $stderrLog = Join-Path $script:outputDir 'backend-stderr.txt'
      if (Test-Path $stderrLog) {
        $errDetail = Get-Content $stderrLog -Raw -ErrorAction SilentlyContinue
      }
      $script:statusLabel.Text = "Scan failed (exit code $exitCode)"
      $msg = "Scan exited with code $exitCode."
      if ($errDetail) { $msg += "`n`n$errDetail" }
      [System.Windows.Forms.MessageBox]::Show(
        $msg,
        'DMH Security Audit',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
      ) | Out-Null
    }
  } catch {
    $script:form.Cursor = [System.Windows.Forms.Cursors]::Default
    $script:statusLabel.Text = 'Scan failed'
    Write-GuiLog "Scan exception: $($_.Exception.Message)"
    [System.Windows.Forms.MessageBox]::Show(
      "Scan error: $($_.Exception.Message)",
      'DMH Security Audit',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  }
})

$btnRefresh.Add_Click({
  try {
    Refresh-Grid
    $script:defenderStatus.Text = Get-DefenderStatusText
  } catch {
    [System.Windows.Forms.MessageBox]::Show(
      $_.Exception.Message,
      'DMH Security Audit',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  }
})

$btnResolve.Add_Click({
  try {
    $ids = @(Get-CheckedActionIds)
    if ($ids.Count -eq 0) {
      [System.Windows.Forms.MessageBox]::Show(
        'Select at least one action to resolve by checking the boxes in the grid.',
        'DMH Security Audit',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
      ) | Out-Null
      return
    }

    $confirm = [System.Windows.Forms.MessageBox]::Show(
      "Remediate $($ids.Count) selected action(s)?`n`nA restore point will be created first.",
      'DMH Security Audit - Confirm',
      [System.Windows.Forms.MessageBoxButtons]::YesNo,
      [System.Windows.Forms.MessageBoxIcon]::Question
    )
    if ($confirm -ne [System.Windows.Forms.DialogResult]::Yes) { return }

    Write-GuiLog "Resolve clicked for IDs: $($ids -join ',')"
    $script:statusLabel.Text = 'Applying remediations...'
    $script:form.Cursor = [System.Windows.Forms.Cursors]::WaitCursor
    $script:form.Refresh()
    $idsArg = $ids -join ','
    $exitCode = Invoke-Backend -ArgsList @('-Mode', 'resolve', '-OutputDir', "`"$($script:outputDir)`"", '-ResolveIds', $idsArg, '-AssumeYes', '-AllowNoRestorePoint') -RequireAdmin
    $script:form.Cursor = [System.Windows.Forms.Cursors]::Default

    if ($exitCode -eq 0) {
      $script:statusLabel.Text = 'Remediation completed successfully'
      [System.Windows.Forms.MessageBox]::Show(
        'Selected remediations applied. See security-audit folder for details.',
        'DMH Security Audit',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
      ) | Out-Null
      Refresh-Grid
    } else {
      $script:statusLabel.Text = "Remediation failed (exit code $exitCode)"
      $detail = Load-LatestErrorMessage
      if (-not $detail) { $detail = 'If UAC was declined, try again and approve elevation.' }
      [System.Windows.Forms.MessageBox]::Show(
        "Remediation failed (exit $exitCode).`n`n$detail",
        'DMH Security Audit',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
      ) | Out-Null
    }
  } catch {
    $script:form.Cursor = [System.Windows.Forms.Cursors]::Default
    $script:statusLabel.Text = 'Remediation failed'
    Write-GuiLog "Resolve exception: $($_.Exception.Message)"
    [System.Windows.Forms.MessageBox]::Show(
      $_.Exception.Message,
      'DMH Security Audit',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  }
})

# ── Defender Status Timer ─────────────────────────────────────────────

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$timer.Add_Tick({
  try { $script:defenderStatus.Text = Get-DefenderStatusText } catch { }
})
$timer.Start()

# ── Launch ────────────────────────────────────────────────────────────

Write-GuiLog 'Loading initial grid data...'
Refresh-Grid
Write-GuiLog 'Showing form...'
[void]$script:form.ShowDialog()
Write-GuiLog '--- GUI closed ---'
