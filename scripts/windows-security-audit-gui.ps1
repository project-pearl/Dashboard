Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendScript = Join-Path $PSScriptRoot 'windows-security-audit.ps1'
$outputDir = Join-Path $repoRoot 'security-audit'
$actionsPath = Join-Path $outputDir 'latest-actions.json'
$errorPath = Join-Path $outputDir 'latest-error.json'
$logoPath = Join-Path $PSScriptRoot 'dmh-logo.png'

# ── Brand Colors ──────────────────────────────────────────────────────
$brandNavy      = [System.Drawing.Color]::FromArgb(10, 36, 99)
$brandNavyLight = [System.Drawing.Color]::FromArgb(18, 52, 126)
$brandGold      = [System.Drawing.Color]::FromArgb(212, 175, 55)
$brandGoldLight = [System.Drawing.Color]::FromArgb(235, 206, 110)
$brandWhite     = [System.Drawing.Color]::White
$brandGray      = [System.Drawing.Color]::FromArgb(240, 242, 245)
$brandDarkText  = [System.Drawing.Color]::FromArgb(30, 30, 30)
$riskRed        = [System.Drawing.Color]::FromArgb(200, 50, 50)
$riskOrange     = [System.Drawing.Color]::FromArgb(210, 130, 30)
$riskGreen      = [System.Drawing.Color]::FromArgb(40, 160, 60)

$appVersion = '1.0.0'

# ── Helper Functions ──────────────────────────────────────────────────

function Ensure-Dir {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -Path $Path -ItemType Directory | Out-Null
  }
}

function Invoke-Backend {
  param(
    [string[]]$ArgsList,
    [switch]$RequireAdmin
  )
  # Pass as a single string — array form causes Start-Process to mangle embedded quotes
  $argString = "-NoProfile -ExecutionPolicy Bypass -File `"$backendScript`" " + ($ArgsList -join ' ')
  if ($RequireAdmin) {
    $p = Start-Process -FilePath 'powershell.exe' -ArgumentList $argString -WorkingDirectory $repoRoot -Verb RunAs -Wait -PassThru
    return $p.ExitCode
  }
  $p = Start-Process -FilePath 'powershell.exe' -ArgumentList $argString -WorkingDirectory $repoRoot -Wait -PassThru
  return $p.ExitCode
}

function Load-Actions {
  if (-not (Test-Path -LiteralPath $actionsPath)) { return @() }
  $raw = Get-Content -LiteralPath $actionsPath -Raw
  if (-not $raw) { return @() }
  $json = $raw | ConvertFrom-Json
  return @($json)
}

function Load-LatestErrorMessage {
  if (-not (Test-Path -LiteralPath $errorPath)) { return $null }
  try {
    $raw = Get-Content -LiteralPath $errorPath -Raw
    if (-not $raw) { return $null }
    $obj = $raw | ConvertFrom-Json
    return [string]$obj.message
  } catch {
    return $null
  }
}

function Refresh-Grid {
  param([System.Windows.Forms.DataGridView]$Grid, [System.Windows.Forms.Label]$Status)
  $Grid.Rows.Clear()
  $actions = @(Load-Actions)
  foreach ($a in $actions) {
    $idx = $Grid.Rows.Add($false, [string]$a.id, [string]$a.risk, [string]$a.title, [string]$a.detail, [string]$a.kind)
    $null = $idx
  }
  $count = $actions.Count
  if ($count -eq 0) {
    $Status.Text = 'No pending actions. Run a scan to check your system.'
  } else {
    $Status.Text = "$count remediation action(s) found"
  }
}

function Get-CheckedActionIds {
  param([System.Windows.Forms.DataGridView]$Grid)
  $ids = @()
  foreach ($row in $Grid.Rows) {
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

function New-StyledButton {
  param(
    [string]$Text,
    [int]$X,
    [int]$Y,
    [int]$Width = 150,
    [int]$Height = 36,
    [System.Drawing.Color]$BackColor = $brandNavy,
    [System.Drawing.Color]$ForeColor = $brandWhite,
    [switch]$IsPrimary
  )
  $btn = New-Object System.Windows.Forms.Button
  $btn.Text = $Text
  $btn.Size = New-Object System.Drawing.Size($Width, $Height)
  $btn.Location = New-Object System.Drawing.Point($X, $Y)
  $btn.FlatStyle = 'Flat'
  $btn.FlatAppearance.BorderSize = 0
  $btn.BackColor = if ($IsPrimary) { $brandGold } else { $BackColor }
  $btn.ForeColor = if ($IsPrimary) { $brandNavy } else { $ForeColor }
  $btn.Font = New-Object System.Drawing.Font('Segoe UI', 9.5, [System.Drawing.FontStyle]::Bold)
  $btn.Cursor = [System.Windows.Forms.Cursors]::Hand

  $hoverBack = if ($IsPrimary) { $brandGoldLight } else { $brandNavyLight }
  $normalBack = $btn.BackColor
  $btn.Add_MouseEnter({ $this.BackColor = $hoverBack })
  $btn.Add_MouseLeave({ $this.BackColor = $normalBack })

  return $btn
}

Ensure-Dir -Path $outputDir

# ── Main Form ─────────────────────────────────────────────────────────

$form = New-Object System.Windows.Forms.Form
$form.Text = 'DMH Security Audit'
$form.Size = New-Object System.Drawing.Size(1200, 750)
$form.StartPosition = 'CenterScreen'
$form.BackColor = $brandGray
$form.MinimumSize = New-Object System.Drawing.Size(900, 550)
$form.FormBorderStyle = 'Sizable'

# Load logo image into memory (avoids file-lock issues with FromFile)
$script:logoImage = $null
if (Test-Path -LiteralPath $logoPath) {
  try {
    $bytes = [System.IO.File]::ReadAllBytes($logoPath)
    $ms = New-Object System.IO.MemoryStream(,$bytes)
    $script:logoImage = [System.Drawing.Image]::FromStream($ms)
  } catch { }
}

# Set window icon from logo
if ($script:logoImage) {
  try {
    $iconBmp = New-Object System.Drawing.Bitmap($script:logoImage, 32, 32)
    $form.Icon = [System.Drawing.Icon]::FromHandle($iconBmp.GetHicon())
  } catch { }
}

# ── Header Banner ─────────────────────────────────────────────────────

$headerPanel = New-Object System.Windows.Forms.Panel
$headerPanel.Dock = 'Top'
$headerPanel.Height = 80
$headerPanel.BackColor = $brandNavy

# Logo image
if ($script:logoImage) {
  $logoPic = New-Object System.Windows.Forms.PictureBox
  $logoPic.Location = New-Object System.Drawing.Point(16, 8)
  $logoPic.Size = New-Object System.Drawing.Size(200, 64)
  $logoPic.SizeMode = 'Zoom'
  $logoPic.BackColor = $brandNavy
  $logoPic.Image = $script:logoImage
  $headerPanel.Controls.Add($logoPic)
}

$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = 'Security Audit & Remediation'
$titleLabel.Font = New-Object System.Drawing.Font('Segoe UI', 18, [System.Drawing.FontStyle]::Bold)
$titleLabel.ForeColor = $brandGold
$titleLabel.BackColor = $brandNavy
$titleLabel.Location = New-Object System.Drawing.Point(230, 12)
$titleLabel.AutoSize = $true
$headerPanel.Controls.Add($titleLabel)

$subtitleLabel = New-Object System.Windows.Forms.Label
$subtitleLabel.Text = 'Persistence & Threat Detection for Windows Endpoints'
$subtitleLabel.Font = New-Object System.Drawing.Font('Segoe UI', 9.5)
$subtitleLabel.ForeColor = [System.Drawing.Color]::FromArgb(180, 195, 220)
$subtitleLabel.BackColor = [System.Drawing.Color]::Transparent
$subtitleLabel.Location = New-Object System.Drawing.Point(232, 48)
$subtitleLabel.AutoSize = $true
$headerPanel.Controls.Add($subtitleLabel)

$versionLabel = New-Object System.Windows.Forms.Label
$versionLabel.Text = "v$appVersion"
$versionLabel.Font = New-Object System.Drawing.Font('Segoe UI', 8)
$versionLabel.ForeColor = [System.Drawing.Color]::FromArgb(120, 140, 170)
$versionLabel.BackColor = [System.Drawing.Color]::Transparent
$versionLabel.Anchor = 'Top, Right'
$versionLabel.Location = New-Object System.Drawing.Point(1130, 58)
$versionLabel.AutoSize = $true
$headerPanel.Controls.Add($versionLabel)

$form.Controls.Add($headerPanel)

# ── Defender Status Bar ───────────────────────────────────────────────

$defenderBar = New-Object System.Windows.Forms.Panel
$defenderBar.Dock = 'Top'
$defenderBar.Height = 32
$defenderBar.BackColor = [System.Drawing.Color]::FromArgb(225, 235, 248)

$shieldChar = [char]0x26E8  # shield unicode
$defenderIcon = New-Object System.Windows.Forms.Label
$defenderIcon.Text = '🛡'
$defenderIcon.Font = New-Object System.Drawing.Font('Segoe UI Emoji', 11)
$defenderIcon.Location = New-Object System.Drawing.Point(14, 3)
$defenderIcon.AutoSize = $true
$defenderIcon.BackColor = [System.Drawing.Color]::Transparent
$defenderBar.Controls.Add($defenderIcon)

$defenderStatus = New-Object System.Windows.Forms.Label
$defenderStatus.Text = "Windows Defender: $(Get-DefenderStatusText)"
$defenderStatus.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$defenderStatus.ForeColor = [System.Drawing.Color]::FromArgb(50, 60, 80)
$defenderStatus.BackColor = [System.Drawing.Color]::Transparent
$defenderStatus.Location = New-Object System.Drawing.Point(38, 7)
$defenderStatus.AutoSize = $true
$defenderBar.Controls.Add($defenderStatus)

$form.Controls.Add($defenderBar)

# ── Toolbar ───────────────────────────────────────────────────────────

$toolbar = New-Object System.Windows.Forms.Panel
$toolbar.Dock = 'Top'
$toolbar.Height = 56
$toolbar.BackColor = $brandWhite
$toolbar.Padding = New-Object System.Windows.Forms.Padding(16, 10, 16, 10)

$btnScan = New-StyledButton -Text '⟳  Run Scan' -X 16 -Y 10 -Width 140 -IsPrimary
$toolbar.Controls.Add($btnScan)

$btnRefresh = New-StyledButton -Text '↻  Refresh' -X 168 -Y 10 -Width 120
$toolbar.Controls.Add($btnRefresh)

$btnResolve = New-StyledButton -Text '✓  Resolve Selected' -X 300 -Y 10 -Width 170
$btnResolve.BackColor = [System.Drawing.Color]::FromArgb(160, 50, 50)
$normalResolveBack = $btnResolve.BackColor
$btnResolve.Add_MouseEnter({ $this.BackColor = [System.Drawing.Color]::FromArgb(190, 60, 60) })
$btnResolve.Add_MouseLeave({ $this.BackColor = $normalResolveBack })
$toolbar.Controls.Add($btnResolve)

$noteLabel = New-Object System.Windows.Forms.Label
$noteLabel.Text = 'Remediation creates a restore point before making changes. UAC elevation is requested when needed.'
$noteLabel.Font = New-Object System.Drawing.Font('Segoe UI', 8.25, [System.Drawing.FontStyle]::Italic)
$noteLabel.ForeColor = [System.Drawing.Color]::FromArgb(120, 120, 130)
$noteLabel.Location = New-Object System.Drawing.Point(490, 18)
$noteLabel.AutoSize = $true
$toolbar.Controls.Add($noteLabel)

$form.Controls.Add($toolbar)

# ── Separator ─────────────────────────────────────────────────────────

$sep = New-Object System.Windows.Forms.Panel
$sep.Dock = 'Top'
$sep.Height = 2
$sep.BackColor = [System.Drawing.Color]::FromArgb(200, 210, 225)
$form.Controls.Add($sep)

# ── Status Bar (Bottom) ──────────────────────────────────────────────

$statusBar = New-Object System.Windows.Forms.Panel
$statusBar.Dock = 'Bottom'
$statusBar.Height = 30
$statusBar.BackColor = $brandNavy

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = 'Ready'
$statusLabel.Font = New-Object System.Drawing.Font('Segoe UI', 8.5)
$statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(180, 195, 220)
$statusLabel.BackColor = [System.Drawing.Color]::Transparent
$statusLabel.Location = New-Object System.Drawing.Point(14, 6)
$statusLabel.AutoSize = $true
$statusBar.Controls.Add($statusLabel)

$copyrightLabel = New-Object System.Windows.Forms.Label
$copyrightLabel.Text = "© $(Get-Date -Format 'yyyy') DMH Computers, Inc. — When you can't afford to be down!"
$copyrightLabel.Font = New-Object System.Drawing.Font('Segoe UI', 7.5)
$copyrightLabel.ForeColor = [System.Drawing.Color]::FromArgb(100, 120, 155)
$copyrightLabel.BackColor = [System.Drawing.Color]::Transparent
$copyrightLabel.Anchor = 'Bottom, Right'
$copyrightLabel.Location = New-Object System.Drawing.Point(870, 8)
$copyrightLabel.AutoSize = $true
$statusBar.Controls.Add($copyrightLabel)

$form.Controls.Add($statusBar)

# ── Data Grid ─────────────────────────────────────────────────────────

$grid = New-Object System.Windows.Forms.DataGridView
$grid.Dock = 'Fill'
$grid.AllowUserToAddRows = $false
$grid.AllowUserToDeleteRows = $false
$grid.ReadOnly = $false
$grid.SelectionMode = 'FullRowSelect'
$grid.MultiSelect = $true
$grid.AutoSizeColumnsMode = 'Fill'
$grid.RowHeadersVisible = $false
$grid.BorderStyle = 'None'
$grid.CellBorderStyle = 'SingleHorizontal'
$grid.BackgroundColor = $brandWhite
$grid.GridColor = [System.Drawing.Color]::FromArgb(225, 230, 240)
$grid.DefaultCellStyle.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$grid.DefaultCellStyle.SelectionBackColor = [System.Drawing.Color]::FromArgb(220, 232, 252)
$grid.DefaultCellStyle.SelectionForeColor = $brandDarkText
$grid.DefaultCellStyle.Padding = New-Object System.Windows.Forms.Padding(4, 3, 4, 3)
$grid.RowTemplate.Height = 30
$grid.EnableHeadersVisualStyles = $false
$grid.ColumnHeadersDefaultCellStyle.BackColor = $brandNavy
$grid.ColumnHeadersDefaultCellStyle.ForeColor = $brandWhite
$grid.ColumnHeadersDefaultCellStyle.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
$grid.ColumnHeadersDefaultCellStyle.Padding = New-Object System.Windows.Forms.Padding(4, 0, 4, 0)
$grid.ColumnHeadersHeight = 34
$grid.ColumnHeadersHeightSizeMode = 'DisableResizing'
$grid.Padding = New-Object System.Windows.Forms.Padding(16, 4, 16, 4)

[void]$grid.Columns.Add((New-Object System.Windows.Forms.DataGridViewCheckBoxColumn -Property @{ Name = 'Select'; HeaderText = ''; FillWeight = 5 }))
[void]$grid.Columns.Add('Id', 'ID')
[void]$grid.Columns.Add('Risk', 'Risk')
[void]$grid.Columns.Add('Title', 'Finding')
[void]$grid.Columns.Add('Detail', 'Details')
[void]$grid.Columns.Add('Kind', 'Action Type')
$grid.Columns['Id'].FillWeight = 8
$grid.Columns['Risk'].FillWeight = 8
$grid.Columns['Title'].FillWeight = 25
$grid.Columns['Detail'].FillWeight = 42
$grid.Columns['Kind'].FillWeight = 12

# Color-code risk column
$grid.Add_CellFormatting({
  param($sender, $e)
  if ($e.ColumnIndex -eq 2 -and $e.RowIndex -ge 0) {
    $val = [string]$e.Value
    switch ($val) {
      'caution' {
        $e.CellStyle.ForeColor = $riskOrange
        $e.CellStyle.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
      }
      'safe' {
        $e.CellStyle.ForeColor = $riskGreen
        $e.CellStyle.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
      }
      default {
        $e.CellStyle.ForeColor = $riskRed
        $e.CellStyle.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
      }
    }
  }
})

# Alternate row coloring
$grid.AlternatingRowsDefaultCellStyle.BackColor = [System.Drawing.Color]::FromArgb(246, 248, 252)

$form.Controls.Add($grid)

# ── Button Event Handlers ─────────────────────────────────────────────

$btnScan.Add_Click({
  try {
    $statusLabel.Text = 'Scanning system for persistence threats...'
    $defenderStatus.Text = "Windows Defender: $(Get-DefenderStatusText)"
    $form.Cursor = [System.Windows.Forms.Cursors]::WaitCursor
    $form.Refresh()
    $exitCode = Invoke-Backend -ArgsList @('-Mode', 'scan', '-OutputDir', "`"$outputDir`"")
    $form.Cursor = [System.Windows.Forms.Cursors]::Default
    if ($exitCode -eq 0) {
      Refresh-Grid -Grid $grid -Status $statusLabel
      $defenderStatus.Text = "Windows Defender: $(Get-DefenderStatusText)"
      [System.Windows.Forms.MessageBox]::Show(
        'System scan completed successfully.',
        'DMH Security Audit',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
      ) | Out-Null
    } else {
      $statusLabel.Text = "Scan failed (exit code $exitCode)"
      [System.Windows.Forms.MessageBox]::Show(
        "Scan exited with code $exitCode. Check logs for details.",
        'DMH Security Audit',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
      ) | Out-Null
    }
  } catch {
    $form.Cursor = [System.Windows.Forms.Cursors]::Default
    $statusLabel.Text = 'Scan failed'
    [System.Windows.Forms.MessageBox]::Show(
      $_.Exception.Message,
      'DMH Security Audit',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  }
})

$btnRefresh.Add_Click({
  try {
    Refresh-Grid -Grid $grid -Status $statusLabel
    $defenderStatus.Text = "Windows Defender: $(Get-DefenderStatusText)"
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
    $ids = @(Get-CheckedActionIds -Grid $grid)
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
      "You are about to remediate $($ids.Count) selected action(s).`n`nA system restore point will be created before changes are applied.`n`nContinue?",
      'DMH Security Audit — Confirm Remediation',
      [System.Windows.Forms.MessageBoxButtons]::YesNo,
      [System.Windows.Forms.MessageBoxIcon]::Question
    )
    if ($confirm -ne [System.Windows.Forms.DialogResult]::Yes) { return }

    $statusLabel.Text = 'Applying remediations...'
    $form.Cursor = [System.Windows.Forms.Cursors]::WaitCursor
    $form.Refresh()
    $idsArg = $ids -join ','
    $exitCode = Invoke-Backend -ArgsList @('-Mode', 'resolve', '-OutputDir', "`"$outputDir`"", '-ResolveIds', $idsArg, '-AssumeYes', '-AllowNoRestorePoint') -RequireAdmin
    $form.Cursor = [System.Windows.Forms.Cursors]::Default
    if ($exitCode -eq 0) {
      $statusLabel.Text = 'Remediation completed successfully'
      [System.Windows.Forms.MessageBox]::Show(
        "All selected remediations were applied.`n`nDetailed results saved to the security-audit folder.",
        'DMH Security Audit',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
      ) | Out-Null
      Refresh-Grid -Grid $grid -Status $statusLabel
    } else {
      $statusLabel.Text = "Remediation failed (exit code $exitCode)"
      $detail = Load-LatestErrorMessage
      if (-not $detail) {
        $detail = 'If UAC was declined, run Resolve Selected again and approve elevation.'
      }
      [System.Windows.Forms.MessageBox]::Show(
        "Remediation failed with exit code $exitCode.`n`n$detail",
        'DMH Security Audit',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
      ) | Out-Null
    }
  } catch {
    $form.Cursor = [System.Windows.Forms.Cursors]::Default
    $statusLabel.Text = 'Remediation failed'
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
  $defenderStatus.Text = "Windows Defender: $(Get-DefenderStatusText)"
})
$timer.Start()

# ── Launch ────────────────────────────────────────────────────────────

Refresh-Grid -Grid $grid -Status $statusLabel
[void]$form.ShowDialog()
