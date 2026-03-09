Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendScript = Join-Path $PSScriptRoot 'windows-security-audit.ps1'
$outputDir = Join-Path $repoRoot 'security-audit'
$actionsPath = Join-Path $outputDir 'latest-actions.json'

function Ensure-Dir {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -Path $Path -ItemType Directory | Out-Null
  }
}

function Invoke-Backend {
  param([string[]]$ArgsList)
  $argLine = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$backendScript`"") + $ArgsList
  $p = Start-Process -FilePath 'powershell.exe' -ArgumentList $argLine -WorkingDirectory $repoRoot -Wait -PassThru
  return $p.ExitCode
}

function Load-Actions {
  if (-not (Test-Path -LiteralPath $actionsPath)) { return @() }
  $raw = Get-Content -LiteralPath $actionsPath -Raw
  if (-not $raw) { return @() }
  $json = $raw | ConvertFrom-Json
  return @($json)
}

function Refresh-Grid {
  param([System.Windows.Forms.DataGridView]$Grid, [System.Windows.Forms.Label]$Status)
  $Grid.Rows.Clear()
  $actions = Load-Actions
  foreach ($a in $actions) {
    $idx = $Grid.Rows.Add($false, [string]$a.id, [string]$a.risk, [string]$a.title, [string]$a.detail, [string]$a.kind)
    $null = $idx
  }
  $Status.Text = "Actions loaded: $($actions.Count)"
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

Ensure-Dir -Path $outputDir

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Windows Security Audit'
$form.Size = New-Object System.Drawing.Size(1150, 680)
$form.StartPosition = 'CenterScreen'
$form.BackColor = [System.Drawing.Color]::FromArgb(245, 248, 252)

$header = New-Object System.Windows.Forms.Label
$header.Text = 'Windows Security Audit and Controlled Remediation'
$header.Font = New-Object System.Drawing.Font('Segoe UI', 13, [System.Drawing.FontStyle]::Bold)
$header.Location = New-Object System.Drawing.Point(16, 14)
$header.AutoSize = $true
$form.Controls.Add($header)

$status = New-Object System.Windows.Forms.Label
$status.Text = 'Ready.'
$status.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$status.Location = New-Object System.Drawing.Point(18, 48)
$status.AutoSize = $true
$form.Controls.Add($status)

$btnScan = New-Object System.Windows.Forms.Button
$btnScan.Text = 'Run Scan'
$btnScan.Size = New-Object System.Drawing.Size(120, 34)
$btnScan.Location = New-Object System.Drawing.Point(18, 78)
$form.Controls.Add($btnScan)

$btnRefresh = New-Object System.Windows.Forms.Button
$btnRefresh.Text = 'Refresh Actions'
$btnRefresh.Size = New-Object System.Drawing.Size(140, 34)
$btnRefresh.Location = New-Object System.Drawing.Point(146, 78)
$form.Controls.Add($btnRefresh)

$btnResolve = New-Object System.Windows.Forms.Button
$btnResolve.Text = 'Resolve Selected'
$btnResolve.Size = New-Object System.Drawing.Size(140, 34)
$btnResolve.Location = New-Object System.Drawing.Point(294, 78)
$form.Controls.Add($btnResolve)

$note = New-Object System.Windows.Forms.Label
$note.Text = 'Remediation requires user click, confirmation, and a successful restore point before any change.'
$note.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Italic)
$note.Location = New-Object System.Drawing.Point(450, 86)
$note.AutoSize = $true
$form.Controls.Add($note)

$grid = New-Object System.Windows.Forms.DataGridView
$grid.Location = New-Object System.Drawing.Point(18, 128)
$grid.Size = New-Object System.Drawing.Size(1096, 490)
$grid.AllowUserToAddRows = $false
$grid.AllowUserToDeleteRows = $false
$grid.ReadOnly = $false
$grid.SelectionMode = 'FullRowSelect'
$grid.MultiSelect = $true
$grid.AutoSizeColumnsMode = 'Fill'
$grid.RowHeadersVisible = $false
$form.Controls.Add($grid)

[void]$grid.Columns.Add((New-Object System.Windows.Forms.DataGridViewCheckBoxColumn -Property @{ Name = 'Select'; HeaderText = 'Run'; FillWeight = 7 }))
[void]$grid.Columns.Add('Id', 'ID')
[void]$grid.Columns.Add('Risk', 'Risk')
[void]$grid.Columns.Add('Title', 'Title')
[void]$grid.Columns.Add('Detail', 'Detail')
[void]$grid.Columns.Add('Kind', 'Kind')
$grid.Columns['Id'].FillWeight = 9
$grid.Columns['Risk'].FillWeight = 8
$grid.Columns['Title'].FillWeight = 25
$grid.Columns['Detail'].FillWeight = 40
$grid.Columns['Kind'].FillWeight = 11

$btnScan.Add_Click({
  try {
    $status.Text = 'Running scan...'
    $form.Refresh()
    $exitCode = Invoke-Backend -ArgsList @('-Mode', 'scan', '-OutputDir', "`"$outputDir`"")
    if ($exitCode -eq 0) {
      Refresh-Grid -Grid $grid -Status $status
      [System.Windows.Forms.MessageBox]::Show('Scan complete.', 'Security Audit', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
    } else {
      $status.Text = "Scan failed (exit $exitCode)."
      [System.Windows.Forms.MessageBox]::Show("Scan failed with exit code $exitCode.", 'Security Audit', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
    }
  } catch {
    $status.Text = 'Scan failed.'
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Security Audit', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
  }
})

$btnRefresh.Add_Click({
  try {
    Refresh-Grid -Grid $grid -Status $status
  } catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Security Audit', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
  }
})

$btnResolve.Add_Click({
  try {
    $ids = Get-CheckedActionIds -Grid $grid
    if ($ids.Count -eq 0) {
      [System.Windows.Forms.MessageBox]::Show('Select at least one action to resolve.', 'Security Audit', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
      return
    }

    $confirm = [System.Windows.Forms.MessageBox]::Show(
      "Resolve $($ids.Count) selected action(s)?`n`nA system restore point will be created first.",
      'Confirm Remediation',
      [System.Windows.Forms.MessageBoxButtons]::YesNo,
      [System.Windows.Forms.MessageBoxIcon]::Question
    )
    if ($confirm -ne [System.Windows.Forms.DialogResult]::Yes) { return }

    $status.Text = 'Applying selected remediations...'
    $form.Refresh()
    $idsArg = $ids -join ','
    $exitCode = Invoke-Backend -ArgsList @('-Mode', 'resolve', '-OutputDir', "`"$outputDir`"", '-ResolveIds', $idsArg, '-AssumeYes')
    if ($exitCode -eq 0) {
      $status.Text = 'Remediation completed.'
      [System.Windows.Forms.MessageBox]::Show('Selected remediations completed. Check security-audit\\resolve-*.json for results.', 'Security Audit', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
      Refresh-Grid -Grid $grid -Status $status
    } else {
      $status.Text = "Remediation failed (exit $exitCode)."
      [System.Windows.Forms.MessageBox]::Show("Remediation failed with exit code $exitCode.`nRun PowerShell as Administrator and try again.", 'Security Audit', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
    }
  } catch {
    $status.Text = 'Remediation failed.'
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Security Audit', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
  }
})

Refresh-Grid -Grid $grid -Status $status
[void]$form.ShowDialog()

