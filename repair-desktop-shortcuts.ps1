$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$launcher = Join-Path $projectRoot 'launch-desktop.ps1'
$icon = Join-Path $projectRoot 'public\motion-arcade-game-thunder.ico'
$powershell = Join-Path $PSHOME 'powershell.exe'
$desktop = [Environment]::GetFolderPath('Desktop')
$startMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Motion Arcade'
$logDirectory = Join-Path $env:LOCALAPPDATA 'Motion Arcade'
$logFile = Join-Path $logDirectory 'shortcut-recovery.log'

function Write-RecoveryLog {
  param([string]$Message)

  New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
  Add-Content -LiteralPath $logFile -Value "$(Get-Date -Format o) $Message"
}

function Ensure-Shortcut {
  param([Parameter(Mandatory)][string]$Path)

  $directory = Split-Path -Parent $Path
  New-Item -ItemType Directory -Path $directory -Force | Out-Null

  $shortcut = $shell.CreateShortcut($Path)
  $expectedArguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""
  if (
    -not (Test-Path -LiteralPath $Path) -or
    $shortcut.TargetPath -ne $powershell -or
    $shortcut.Arguments -ne $expectedArguments -or
    $shortcut.IconLocation -ne "$icon,0" -or
    $shortcut.WorkingDirectory -ne $projectRoot
  ) {
    $shortcut.TargetPath = $powershell
    $shortcut.Arguments = $expectedArguments
    $shortcut.WorkingDirectory = $projectRoot
    $shortcut.IconLocation = "$icon,0"
    $shortcut.Description = 'Launch Motion Arcade with the pixel dinosaur logo'
    $shortcut.Save()
    Write-RecoveryLog "Restored shortcut: $Path"
  }
}

try {
  foreach ($requiredPath in @($launcher, $icon)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
      throw "Required Motion Arcade launcher file is missing: $requiredPath"
    }
  }

  $shell = New-Object -ComObject WScript.Shell
  Ensure-Shortcut -Path (Join-Path $desktop 'Motion Arcade.lnk')
  Ensure-Shortcut -Path (Join-Path $startMenu 'Motion Arcade.lnk')
} catch {
  Write-RecoveryLog "Shortcut recovery failed: $($_.Exception.Message)"
  throw
}
