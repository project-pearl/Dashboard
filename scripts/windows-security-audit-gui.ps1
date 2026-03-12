Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Continue'

# ── Path Detection ────────────────────────────────────────────────────
$script:backendScript = Join-Path $PSScriptRoot 'windows-security-audit.ps1'
if (Test-Path (Join-Path $PSScriptRoot 'security-audit')) {
  $script:repoRoot = $PSScriptRoot
} elseif ((Split-Path -Leaf $PSScriptRoot) -eq 'scripts') {
  $script:repoRoot = Split-Path -Parent $PSScriptRoot
} else {
  $script:repoRoot = $PSScriptRoot
}
$script:outputDir   = Join-Path $script:repoRoot 'security-audit'
$script:actionsPath = Join-Path $script:outputDir 'latest-actions.json'
$script:errorPath   = Join-Path $script:outputDir 'latest-error.json'
$script:scanPath    = Join-Path $script:outputDir 'latest-scan.json'
$script:logoPath    = Join-Path $PSScriptRoot 'dmh-logo.png'
$script:guiLogPath  = Join-Path $script:outputDir 'gui-log.txt'

# ── Brand Palette ─────────────────────────────────────────────────────
$script:Navy        = [System.Drawing.Color]::FromArgb(10, 36, 99)
$script:NavyLight   = [System.Drawing.Color]::FromArgb(22, 56, 130)
$script:NavyDark    = [System.Drawing.Color]::FromArgb(6, 22, 66)
$script:Gold        = [System.Drawing.Color]::FromArgb(212, 175, 55)
$script:GoldLight   = [System.Drawing.Color]::FromArgb(235, 206, 110)
$script:GoldPale    = [System.Drawing.Color]::FromArgb(255, 248, 220)
$script:White       = [System.Drawing.Color]::White
$script:GrayBg      = [System.Drawing.Color]::FromArgb(243, 245, 249)
$script:GrayBorder  = [System.Drawing.Color]::FromArgb(205, 215, 230)
$script:DarkText    = [System.Drawing.Color]::FromArgb(30, 35, 45)
$script:MutedText   = [System.Drawing.Color]::FromArgb(110, 120, 140)
$script:RiskHigh    = [System.Drawing.Color]::FromArgb(185, 40, 40)
$script:RiskMed     = [System.Drawing.Color]::FromArgb(195, 120, 15)
$script:RiskSafe    = [System.Drawing.Color]::FromArgb(30, 145, 55)
$script:InfoBlue    = [System.Drawing.Color]::FromArgb(215, 228, 248)
$script:InfoBlueTxt = [System.Drawing.Color]::FromArgb(40, 55, 85)

$script:AppVersion  = '1.0.0'
$script:AppTitle    = 'DMH Security Audit'

# ── Helpers ───────────────────────────────────────────────────────────

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
  param([string[]]$ArgsList, [switch]$RequireAdmin)
  Ensure-Dir -Path $script:outputDir
  $stdoutLog = Join-Path $script:outputDir 'backend-stdout.txt'
  $stderrLog = Join-Path $script:outputDir 'backend-stderr.txt'
  $argString = "-NoProfile -ExecutionPolicy Bypass -File `"$($script:backendScript)`" " + ($ArgsList -join ' ')
  Write-GuiLog "Invoke-Backend: $argString"
  if ($RequireAdmin) {
    $p = Start-Process powershell.exe -ArgumentList $argString -WorkingDirectory $script:repoRoot -Verb RunAs -Wait -PassThru
    Write-GuiLog "Backend (RunAs) exit: $($p.ExitCode)"
    return $p.ExitCode
  }
  $p = Start-Process powershell.exe -ArgumentList $argString -WorkingDirectory $script:repoRoot -Wait -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
  Write-GuiLog "Backend exit: $($p.ExitCode)"
  if ($p.ExitCode -ne 0 -and (Test-Path $stderrLog)) {
    $t = Get-Content $stderrLog -Raw -ErrorAction SilentlyContinue
    if ($t) { Write-GuiLog "stderr: $t" }
  }
  return $p.ExitCode
}

function Load-Actions {
  if (-not (Test-Path -LiteralPath $script:actionsPath)) { return @() }
  $raw = Get-Content -LiteralPath $script:actionsPath -Raw -ErrorAction SilentlyContinue
  if (-not $raw) { return @() }
  return @($raw | ConvertFrom-Json)
}

function Load-LatestErrorMessage {
  if (-not (Test-Path -LiteralPath $script:errorPath)) { return $null }
  try {
    $raw = Get-Content -LiteralPath $script:errorPath -Raw
    if (-not $raw) { return $null }
    return [string]($raw | ConvertFrom-Json).message
  } catch { return $null }
}

function Get-ScanSummary {
  if (-not (Test-Path -LiteralPath $script:scanPath)) { return $null }
  try {
    $raw = Get-Content -LiteralPath $script:scanPath -Raw -ErrorAction SilentlyContinue
    if (-not $raw) { return $null }
    return ($raw | ConvertFrom-Json)
  } catch { return $null }
}

function Update-SummaryBar {
  $scan = Get-ScanSummary
  if (-not $scan) {
    $script:summaryLabel.Text = '  No scan data yet. Click Run Scan to analyze this system.'
    $script:summaryLabel.ForeColor = $script:MutedText
    return
  }
  $ts = try { ([datetime]$scan.generatedAt).ToString('MMM d, yyyy  h:mm tt') } catch { 'Unknown' }
  $host_ = try { [string]$scan.hostname } catch { $env:COMPUTERNAME }
  $fc = try { @($scan.findings).Count } catch { 0 }
  $ac = try { @($scan.actions).Count } catch { 0 }
  $lc = try { @($scan.listeners).Count } catch { 0 }
  $script:summaryLabel.Text = "  Last scan: $ts   |   Host: $host_   |   Findings: $fc   |   Actions: $ac   |   Listening ports: $lc"
  $script:summaryLabel.ForeColor = $script:InfoBlueTxt
}

function Refresh-Grid {
  $script:grid.Rows.Clear()
  $actions = @(Load-Actions)
  foreach ($a in $actions) {
    [void]$script:grid.Rows.Add($false, [string]$a.id, [string]$a.risk, [string]$a.title, [string]$a.detail, [string]$a.kind)
  }
  $count = $actions.Count
  if ($count -eq 0) {
    $script:statusLabel.Text = '  No pending actions  -  Run a scan to check your system'
  } else {
    $script:statusLabel.Text = "  $count remediation action(s) available"
  }
  Update-SummaryBar
  Update-SelectAllState
}

function Get-CheckedActionIds {
  $ids = @()
  foreach ($row in $script:grid.Rows) {
    if ($row.IsNewRow) { continue }
    if ($null -ne $row.Cells[0].Value -and [bool]$row.Cells[0].Value) {
      $ids += [string]$row.Cells[1].Value
    }
  }
  return @($ids | Select-Object -Unique)
}

function Set-AllChecked {
  param([bool]$Checked)
  foreach ($row in $script:grid.Rows) {
    if (-not $row.IsNewRow) { $row.Cells[0].Value = $Checked }
  }
  $script:grid.RefreshEdit()
  Update-SelectAllState
}

function Update-SelectAllState {
  $total = $script:grid.Rows.Count
  if ($total -eq 0) {
    $script:btnSelectAll.Text = 'Select All'
    $script:btnSelectAll.Enabled = $false
    return
  }
  $script:btnSelectAll.Enabled = $true
  $checked = 0
  foreach ($row in $script:grid.Rows) {
    if (-not $row.IsNewRow -and $null -ne $row.Cells[0].Value -and [bool]$row.Cells[0].Value) { $checked++ }
  }
  if ($checked -eq $total) {
    $script:btnSelectAll.Text = 'Deselect All'
  } else {
    $script:btnSelectAll.Text = 'Select All'
  }
}

function Get-DefenderStatusText {
  try {
    $s = Get-MpComputerStatus
    if ($s.QuickScanInProgress) { return 'Quick Scan in progress' }
    if ($s.FullScanInProgress) { return 'Full Scan in progress' }
    $age = if ($null -ne $s.QuickScanAge) { [string]$s.QuickScanAge } else { 'n/a' }
    $rtp = if ($s.RealTimeProtectionEnabled) { 'ON' } else { 'OFF' }
    return "Real-Time Protection: $rtp   |   Last Quick Scan: $age day(s) ago"
  } catch { return 'Status unavailable' }
}

function New-Button {
  param([string]$Text, [int]$X, [int]$Y, [int]$W = 140, [int]$H = 34,
        [System.Drawing.Color]$BG, [System.Drawing.Color]$FG,
        [System.Drawing.Color]$Border = [System.Drawing.Color]::Empty)
  $b = New-Object System.Windows.Forms.Button
  $b.Text = $Text
  $b.Location = New-Object System.Drawing.Point($X, $Y)
  $b.Size = New-Object System.Drawing.Size($W, $H)
  $b.FlatStyle = 'Flat'
  $b.FlatAppearance.BorderSize = if ($Border -ne [System.Drawing.Color]::Empty) { 1 } else { 0 }
  if ($Border -ne [System.Drawing.Color]::Empty) { $b.FlatAppearance.BorderColor = $Border }
  $b.BackColor = $BG
  $b.ForeColor = $FG
  $b.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 9)
  $b.Cursor = [System.Windows.Forms.Cursors]::Hand
  return $b
}

# ── Init ──────────────────────────────────────────────────────────────

Ensure-Dir -Path $script:outputDir
Write-GuiLog '--- GUI starting ---'

# ── Form ──────────────────────────────────────────────────────────────

$script:form = New-Object System.Windows.Forms.Form
$script:form.Text = $script:AppTitle
$script:form.Size = New-Object System.Drawing.Size(1240, 780)
$script:form.MinimumSize = New-Object System.Drawing.Size(960, 560)
$script:form.StartPosition = 'CenterScreen'
$script:form.BackColor = $script:GrayBg
$script:form.SuspendLayout()

# Window icon
$script:logoImage = $null
if (Test-Path -LiteralPath $script:logoPath) {
  try {
    $bytes = [System.IO.File]::ReadAllBytes($script:logoPath)
    $ms = New-Object System.IO.MemoryStream(,$bytes)
    $script:logoImage = [System.Drawing.Image]::FromStream($ms)
    Write-GuiLog "Logo loaded: $($script:logoImage.Width)x$($script:logoImage.Height)"
  } catch { Write-GuiLog "Logo failed: $($_.Exception.Message)" }
}
if ($script:logoImage) {
  try {
    $ico = New-Object System.Drawing.Bitmap($script:logoImage, 32, 32)
    $script:form.Icon = [System.Drawing.Icon]::FromHandle($ico.GetHicon())
  } catch { }
}

# =====================================================================
#  HEADER
# =====================================================================

$headerPanel = New-Object System.Windows.Forms.Panel
$headerPanel.Dock = 'Top'
$headerPanel.Height = 82
$headerPanel.BackColor = $script:Navy

# Gold accent stripe at bottom of header
$headerPanel.Add_Paint({
  param($s, $e)
  $g = $e.Graphics
  $rect = New-Object System.Drawing.Rectangle(0, ($s.Height - 3), $s.Width, 3)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $script:Gold, $script:GoldLight, [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal)
  $g.FillRectangle($brush, $rect)
  $brush.Dispose()
})

if ($script:logoImage) {
  $logoPic = New-Object System.Windows.Forms.PictureBox
  $logoPic.Location = New-Object System.Drawing.Point(20, 9)
  $logoPic.Size = New-Object System.Drawing.Size(195, 62)
  $logoPic.SizeMode = 'Zoom'
  $logoPic.BackColor = $script:Navy
  $logoPic.Image = $script:logoImage
  $headerPanel.Controls.Add($logoPic)
}

$lbl = New-Object System.Windows.Forms.Label
$lbl.Text = 'Security Audit & Remediation'
$lbl.Font = New-Object System.Drawing.Font('Segoe UI', 17, [System.Drawing.FontStyle]::Bold)
$lbl.ForeColor = $script:Gold
$lbl.BackColor = $script:Navy
$lbl.Location = New-Object System.Drawing.Point(228, 10)
$lbl.AutoSize = $true
$headerPanel.Controls.Add($lbl)

$lbl2 = New-Object System.Windows.Forms.Label
$lbl2.Text = 'Persistence & Threat Detection for Windows Endpoints'
$lbl2.Font = New-Object System.Drawing.Font('Segoe UI', 9.5)
$lbl2.ForeColor = [System.Drawing.Color]::FromArgb(165, 185, 215)
$lbl2.BackColor = $script:Navy
$lbl2.Location = New-Object System.Drawing.Point(230, 46)
$lbl2.AutoSize = $true
$headerPanel.Controls.Add($lbl2)

$vlbl = New-Object System.Windows.Forms.Label
$vlbl.Text = "v$($script:AppVersion)"
$vlbl.Font = New-Object System.Drawing.Font('Segoe UI', 8)
$vlbl.ForeColor = [System.Drawing.Color]::FromArgb(100, 125, 165)
$vlbl.BackColor = $script:Navy
$vlbl.Anchor = 'Top, Right'
$vlbl.Location = New-Object System.Drawing.Point(1170, 58)
$vlbl.AutoSize = $true
$headerPanel.Controls.Add($vlbl)

# =====================================================================
#  DEFENDER BAR
# =====================================================================

$defBar = New-Object System.Windows.Forms.Panel
$defBar.Dock = 'Top'
$defBar.Height = 30
$defBar.BackColor = $script:InfoBlue

$defLbl = New-Object System.Windows.Forms.Label
$defLbl.Text = '  Windows Defender'
$defLbl.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 8.5)
$defLbl.ForeColor = $script:InfoBlueTxt
$defLbl.BackColor = $script:InfoBlue
$defLbl.Location = New-Object System.Drawing.Point(8, 6)
$defLbl.AutoSize = $true
$defBar.Controls.Add($defLbl)

$script:defenderStatus = New-Object System.Windows.Forms.Label
$script:defenderStatus.Text = Get-DefenderStatusText
$script:defenderStatus.Font = New-Object System.Drawing.Font('Segoe UI', 8.5)
$script:defenderStatus.ForeColor = $script:InfoBlueTxt
$script:defenderStatus.BackColor = $script:InfoBlue
$script:defenderStatus.Location = New-Object System.Drawing.Point(148, 6)
$script:defenderStatus.AutoSize = $true
$defBar.Controls.Add($script:defenderStatus)

# =====================================================================
#  TOOLBAR
# =====================================================================

$toolbar = New-Object System.Windows.Forms.Panel
$toolbar.Dock = 'Top'
$toolbar.Height = 52
$toolbar.BackColor = $script:White

# Bottom border on toolbar
$toolbar.Add_Paint({
  param($s, $e)
  $pen = New-Object System.Drawing.Pen($script:GrayBorder, 1)
  $e.Graphics.DrawLine($pen, 0, ($s.Height - 1), $s.Width, ($s.Height - 1))
  $pen.Dispose()
})

$x = 18
$btnScan = New-Button -Text 'Run Scan' -X $x -Y 9 -W 130 -H 34 -BG $script:Gold -FG $script:NavyDark
$btnScan.Font = New-Object System.Drawing.Font('Segoe UI', 9.5, [System.Drawing.FontStyle]::Bold)
$toolbar.Controls.Add($btnScan)
$x += 142

$btnRefresh = New-Button -Text 'Refresh' -X $x -Y 9 -W 100 -H 34 -BG $script:White -FG $script:Navy -Border $script:GrayBorder
$toolbar.Controls.Add($btnRefresh)
$x += 112

$script:btnSelectAll = New-Button -Text 'Select All' -X $x -Y 9 -W 110 -H 34 -BG $script:White -FG $script:Navy -Border $script:GrayBorder
$toolbar.Controls.Add($script:btnSelectAll)
$x += 122

$btnResolve = New-Button -Text 'Resolve Selected' -X $x -Y 9 -W 150 -H 34 -BG $script:RiskHigh -FG $script:White
$toolbar.Controls.Add($btnResolve)
$x += 164

$noteLbl = New-Object System.Windows.Forms.Label
$noteLbl.Text = 'Remediation creates a restore point. UAC elevation is requested when needed.'
$noteLbl.Font = New-Object System.Drawing.Font('Segoe UI', 8, [System.Drawing.FontStyle]::Italic)
$noteLbl.ForeColor = $script:MutedText
$noteLbl.Location = New-Object System.Drawing.Point($x, 17)
$noteLbl.AutoSize = $true
$toolbar.Controls.Add($noteLbl)

# =====================================================================
#  SUMMARY BAR
# =====================================================================

$summaryBar = New-Object System.Windows.Forms.Panel
$summaryBar.Dock = 'Top'
$summaryBar.Height = 28
$summaryBar.BackColor = $script:GoldPale

$script:summaryLabel = New-Object System.Windows.Forms.Label
$script:summaryLabel.Text = '  No scan data yet. Click Run Scan to analyze this system.'
$script:summaryLabel.Font = New-Object System.Drawing.Font('Segoe UI', 8.5)
$script:summaryLabel.ForeColor = $script:MutedText
$script:summaryLabel.BackColor = $script:GoldPale
$script:summaryLabel.Location = New-Object System.Drawing.Point(4, 5)
$script:summaryLabel.AutoSize = $true
$summaryBar.Controls.Add($script:summaryLabel)

# =====================================================================
#  STATUS BAR (bottom)
# =====================================================================

$statusBar = New-Object System.Windows.Forms.Panel
$statusBar.Dock = 'Bottom'
$statusBar.Height = 28
$statusBar.BackColor = $script:NavyDark

$script:statusLabel = New-Object System.Windows.Forms.Label
$script:statusLabel.Text = '  Ready'
$script:statusLabel.Font = New-Object System.Drawing.Font('Segoe UI', 8)
$script:statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(160, 178, 210)
$script:statusLabel.BackColor = $script:NavyDark
$script:statusLabel.Location = New-Object System.Drawing.Point(8, 5)
$script:statusLabel.AutoSize = $true
$statusBar.Controls.Add($script:statusLabel)

$yr = Get-Date -Format 'yyyy'
$crLbl = New-Object System.Windows.Forms.Label
$crLbl.Text = "Copyright $yr DMH Computers, Inc.  All rights reserved."
$crLbl.Font = New-Object System.Drawing.Font('Segoe UI', 7.5)
$crLbl.ForeColor = [System.Drawing.Color]::FromArgb(80, 100, 140)
$crLbl.BackColor = $script:NavyDark
$crLbl.Anchor = 'Bottom, Right'
$crLbl.Location = New-Object System.Drawing.Point(920, 6)
$crLbl.AutoSize = $true
$statusBar.Controls.Add($crLbl)

# =====================================================================
#  DATA GRID
# =====================================================================

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
$script:grid.BackgroundColor = $script:White
$script:grid.GridColor = [System.Drawing.Color]::FromArgb(230, 235, 245)
$script:grid.RowTemplate.Height = 32
$script:grid.EnableHeadersVisualStyles = $false
$script:grid.ColumnHeadersHeight = 36
$script:grid.ColumnHeadersHeightSizeMode = 'DisableResizing'
$script:grid.AlternatingRowsDefaultCellStyle.BackColor = [System.Drawing.Color]::FromArgb(248, 249, 253)

# Cell style
$cs = $script:grid.DefaultCellStyle
$cs.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$cs.ForeColor = $script:DarkText
$cs.SelectionBackColor = [System.Drawing.Color]::FromArgb(215, 228, 250)
$cs.SelectionForeColor = $script:DarkText
$cs.Padding = New-Object System.Windows.Forms.Padding(6, 4, 6, 4)

# Header style
$hs = $script:grid.ColumnHeadersDefaultCellStyle
$hs.BackColor = $script:Navy
$hs.ForeColor = $script:White
$hs.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 9)
$hs.Padding = New-Object System.Windows.Forms.Padding(6, 0, 6, 0)

# Columns
[void]$script:grid.Columns.Add((New-Object System.Windows.Forms.DataGridViewCheckBoxColumn -Property @{
  Name = 'Select'; HeaderText = ''; FillWeight = 4; Resizable = 'False'
}))
[void]$script:grid.Columns.Add('Id', 'ID')
[void]$script:grid.Columns.Add('Risk', 'RISK')
[void]$script:grid.Columns.Add('Title', 'FINDING')
[void]$script:grid.Columns.Add('Detail', 'DETAILS')
[void]$script:grid.Columns.Add('Kind', 'ACTION TYPE')
$script:grid.Columns['Id'].FillWeight = 7
$script:grid.Columns['Risk'].FillWeight = 8
$script:grid.Columns['Title'].FillWeight = 24
$script:grid.Columns['Detail'].FillWeight = 44
$script:grid.Columns['Kind'].FillWeight = 13

# Risk column color-coding
$script:grid.Add_CellFormatting({
  param($s, $e)
  try {
    if ($e.ColumnIndex -eq 2 -and $e.RowIndex -ge 0) {
      $bf = New-Object System.Drawing.Font('Segoe UI Semibold', 8.5)
      switch ([string]$e.Value) {
        'caution' { $e.CellStyle.ForeColor = [System.Drawing.Color]::FromArgb(195, 120, 15); $e.CellStyle.Font = $bf }
        'safe'    { $e.CellStyle.ForeColor = [System.Drawing.Color]::FromArgb(30, 145, 55);  $e.CellStyle.Font = $bf }
        default   { $e.CellStyle.ForeColor = [System.Drawing.Color]::FromArgb(185, 40, 40);  $e.CellStyle.Font = $bf }
      }
    }
  } catch { }
})

# Update Select All state when checkboxes change
$script:grid.Add_CellValueChanged({
  param($s, $e)
  try { if ($e.ColumnIndex -eq 0) { Update-SelectAllState } } catch { }
})
$script:grid.Add_CurrentCellDirtyStateChanged({
  try {
    if ($script:grid.IsCurrentCellDirty) { $script:grid.CommitEdit('CurrentCellChange') }
  } catch { }
})

# =====================================================================
#  DOCK ORDER  (last added = topmost)
# =====================================================================

$script:form.Controls.Add($script:grid)
$script:form.Controls.Add($statusBar)
$script:form.Controls.Add($summaryBar)
$script:form.Controls.Add($toolbar)
$script:form.Controls.Add($defBar)
$script:form.Controls.Add($headerPanel)
$script:form.ResumeLayout($false)

# =====================================================================
#  EVENT HANDLERS
# =====================================================================

$btnScan.Add_Click({
  try {
    Write-GuiLog 'Scan clicked'
    $script:statusLabel.Text = '  Scanning system for persistence threats...'
    $script:defenderStatus.Text = Get-DefenderStatusText
    $script:form.Cursor = [System.Windows.Forms.Cursors]::WaitCursor
    $script:form.Refresh()

    $ec = Invoke-Backend -ArgsList @('-Mode', 'scan', '-OutputDir', "`"$($script:outputDir)`"")
    $script:form.Cursor = [System.Windows.Forms.Cursors]::Default
    Write-GuiLog "Scan exit: $ec"

    if ($ec -eq 0) {
      Refresh-Grid
      $script:defenderStatus.Text = Get-DefenderStatusText
      [System.Windows.Forms.MessageBox]::Show('System scan completed successfully.', $script:AppTitle, 'OK', 'Information') | Out-Null
    } else {
      $errDetail = ''
      $el = Join-Path $script:outputDir 'backend-stderr.txt'
      if (Test-Path $el) { $errDetail = Get-Content $el -Raw -ErrorAction SilentlyContinue }
      $script:statusLabel.Text = "  Scan failed (exit code $ec)"
      $msg = "Scan exited with code $ec."
      if ($errDetail) { $msg += "`n`n$errDetail" }
      [System.Windows.Forms.MessageBox]::Show($msg, $script:AppTitle, 'OK', 'Error') | Out-Null
    }
  } catch {
    $script:form.Cursor = [System.Windows.Forms.Cursors]::Default
    $script:statusLabel.Text = '  Scan failed'
    Write-GuiLog "Scan exception: $($_.Exception.Message)"
    [System.Windows.Forms.MessageBox]::Show("Error: $($_.Exception.Message)", $script:AppTitle, 'OK', 'Error') | Out-Null
  }
})

$btnRefresh.Add_Click({
  try {
    Refresh-Grid
    $script:defenderStatus.Text = Get-DefenderStatusText
  } catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, $script:AppTitle, 'OK', 'Error') | Out-Null
  }
})

$script:btnSelectAll.Add_Click({
  try {
    $allChecked = $true
    foreach ($row in $script:grid.Rows) {
      if (-not $row.IsNewRow -and ($null -eq $row.Cells[0].Value -or -not [bool]$row.Cells[0].Value)) {
        $allChecked = $false; break
      }
    }
    Set-AllChecked -Checked (-not $allChecked)
  } catch { }
})

$btnResolve.Add_Click({
  try {
    $ids = @(Get-CheckedActionIds)
    if ($ids.Count -eq 0) {
      [System.Windows.Forms.MessageBox]::Show(
        'Select at least one action to resolve by checking the boxes in the grid.',
        $script:AppTitle, 'OK', 'Warning') | Out-Null
      return
    }
    $confirm = [System.Windows.Forms.MessageBox]::Show(
      "Remediate $($ids.Count) selected action(s)?`n`nA system restore point will be created before changes are applied.",
      "$($script:AppTitle) - Confirm", 'YesNo', 'Question')
    if ($confirm -ne 'Yes') { return }

    Write-GuiLog "Resolve IDs: $($ids -join ',')"
    $script:statusLabel.Text = '  Applying remediations...'
    $script:form.Cursor = [System.Windows.Forms.Cursors]::WaitCursor
    $script:form.Refresh()
    $idsArg = $ids -join ','
    $ec = Invoke-Backend -ArgsList @('-Mode', 'resolve', '-OutputDir', "`"$($script:outputDir)`"", '-ResolveIds', $idsArg, '-AssumeYes', '-AllowNoRestorePoint') -RequireAdmin
    $script:form.Cursor = [System.Windows.Forms.Cursors]::Default

    if ($ec -eq 0) {
      $script:statusLabel.Text = '  Remediation completed successfully'
      [System.Windows.Forms.MessageBox]::Show(
        'Selected remediations applied. See security-audit folder for results.',
        $script:AppTitle, 'OK', 'Information') | Out-Null
      Refresh-Grid
    } else {
      $script:statusLabel.Text = "  Remediation failed (exit code $ec)"
      $d = Load-LatestErrorMessage
      if (-not $d) { $d = 'If UAC was declined, try again and approve elevation.' }
      [System.Windows.Forms.MessageBox]::Show("Remediation failed (exit $ec).`n`n$d", $script:AppTitle, 'OK', 'Error') | Out-Null
    }
  } catch {
    $script:form.Cursor = [System.Windows.Forms.Cursors]::Default
    $script:statusLabel.Text = '  Remediation failed'
    Write-GuiLog "Resolve exception: $($_.Exception.Message)"
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, $script:AppTitle, 'OK', 'Error') | Out-Null
  }
})

# Defender refresh timer
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$timer.Add_Tick({ try { $script:defenderStatus.Text = Get-DefenderStatusText } catch { } })
$timer.Start()

# ── Launch ────────────────────────────────────────────────────────────
Write-GuiLog 'Loading grid...'
Refresh-Grid
Write-GuiLog 'Showing form...'
[void]$script:form.ShowDialog()
Write-GuiLog '--- GUI closed ---'
