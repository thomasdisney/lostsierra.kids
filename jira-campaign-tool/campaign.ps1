# Jira Campaign Update Tool shortcut
# Run the campaign update tool and display output in PowerShell

param(
    [switch]$NoPause
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$pythonOutput = & python campaign_updates.py 2>&1
Write-Host $pythonOutput

if (-not $NoPause) {
    Read-Host "Press Enter to continue"
}
