$ErrorActionPreference = 'Stop'

$address = 'http://127.0.0.1:4174/'
$viteCli = Join-Path $PSScriptRoot 'node_modules\vite\bin\vite.js'
$node = (Get-Command node.exe -ErrorAction Stop).Source

try {
  $response = Invoke-WebRequest -Uri $address -UseBasicParsing -TimeoutSec 2
} catch {
  $previewLog = Join-Path $env:TEMP 'motion-arcade-preview.log'
  $previewErrorLog = Join-Path $env:TEMP 'motion-arcade-preview-error.log'
  Start-Process -FilePath $node `
    -ArgumentList @($viteCli, 'preview', '--host', '127.0.0.1', '--port', '4174', '--strictPort') `
    -WorkingDirectory $PSScriptRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $previewLog `
    -RedirectStandardError $previewErrorLog

  $response = $null
  for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
    Start-Sleep -Milliseconds 500
    try {
      $response = Invoke-WebRequest -Uri $address -UseBasicParsing -TimeoutSec 2
      break
    } catch {
      continue
    }
  }
}

if ($null -eq $response -or $response.Content -notmatch '<title>Motion Arcade - Desktop</title>') {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show(
    'Motion Arcade could not start. Try rebuilding it with npm run build.',
    'Motion Arcade',
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Error
  ) | Out-Null
  exit 1
}

$browserPaths = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)
$browser = $browserPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $browser) {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show(
    'Install Microsoft Edge or Google Chrome to open Motion Arcade.',
    'Motion Arcade',
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Error
  ) | Out-Null
  exit 1
}

Start-Process -FilePath $browser -ArgumentList "--app=$address"
