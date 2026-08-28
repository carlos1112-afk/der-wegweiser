#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Repariert die Pi Agent CLI Bash-Shell und startet Pi neu.
.DESCRIPTION
  1. Prüft, ob Git Bash (via scoop) installiert ist.
  2. Prüft ~/.pi/agent/settings.json auf shellPath.
  3. Setzt shellPath korrekt, falls er fehlt.
  4. Startet Pi in einem neuen Terminal.
#>

$ErrorActionPreference = "Stop"
$settingsFile = "$env:USERPROFILE\.pi\agent\settings.json"
$gitBash = "$env:USERPROFILE\scoop\apps\git\current\usr\bin\bash.exe"

function Test-GitBash {
  if (Test-Path $gitBash) {
    Write-Host "✅ Git Bash gefunden: $gitBash" -ForegroundColor Green
    return $true
  }
  $altGitBash = "$env:USERPROFILE\scoop\apps\git\current\bin\bash.exe"
  if (Test-Path $altGitBash) {
    Write-Host "✅ Git Bash (compat) gefunden: $altGitBash" -ForegroundColor Green
    $script:gitBash = $altGitBash
    return $true
  }
  Write-Host "❌ Git Bash nicht gefunden. Versuche Scoop-Installation..." -ForegroundColor Red
  if (Get-Command scoop -ErrorAction SilentlyContinue) {
    & scoop install git
    if (Test-Path $gitBash) {
      return $true
    }
  }
  Write-Host "❌ Konnte Git Bash nicht installieren. Bitte manuell installieren von https://git-scm.com/download/win" -ForegroundColor Red
  exit 1
}

function Repair-ShellPath {
  $settings = @{}
  if (Test-Path $settingsFile) {
    $settings = Get-Content $settingsFile -Raw | ConvertFrom-Json -AsHashtable
  }

  $current = $settings['shellPath']
  if ($current -and (Test-Path $current)) {
    Write-Host "✅ shellPath bereits korrekt: $current" -ForegroundColor Green
    return
  }

  Write-Host "🛠️  Repariere shellPath in $settingsFile" -ForegroundColor Yellow
  $settings['shellPath'] = $gitBash.Replace('\', '\\')

  $dir = Split-Path $settingsFile
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }

  $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsFile -Encoding UTF8
  Write-Host "✅ shellPath gesetzt: $gitBash" -ForegroundColor Green
}

function Start-PiFresh {
  Write-Host "🚀 Starte Pi neu..." -ForegroundColor Cyan
  $piCmd = "$env:USERPROFILE\scoop\persist\nodejs\bin\pi.cmd"
  if (-not (Test-Path $piCmd)) {
    $piCmd = "pi"
  }
  Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "& '$piCmd'" -WorkingDirectory "$env:USERPROFILE\PROJEKTE\DER WEGWEISER"
}

# ─── Main ─────────────────────────────────────────────────────────────────────
Write-Host "`n🔧 Pi Bash Shell Repair`n" -ForegroundColor Cyan
Test-GitBash
Repair-ShellPath
Start-PiFresh
Write-Host "`n✅ Reparatur abgeschlossen. Pi wurde in einem neuen Fenster gestartet." -ForegroundColor Green
Write-Host "   Teste Bash mit: echo hello`n"
