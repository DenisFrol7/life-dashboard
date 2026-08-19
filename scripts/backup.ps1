[CmdletBinding()]
param(
    [string]$BackupDirectory = (Join-Path $PSScriptRoot '..\backups')
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backupDirectoryPath = [System.IO.Path]::GetFullPath($BackupDirectory)
$timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$fileName = "life-dashboard_$timestamp.dump"
$backupPath = Join-Path $backupDirectoryPath $fileName
$containerTempPath = "/tmp/$fileName"
$containerId = $null

Push-Location $repoRoot
try {
    $containerId = (& docker compose ps -q postgres).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) {
        throw 'PostgreSQL is not running. Start it with: docker compose start'
    }

    $health = (& docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' $containerId).Trim()
    if ($LASTEXITCODE -ne 0 -or $health -ne 'healthy') {
        throw "PostgreSQL is not healthy (current status: $health)."
    }

    New-Item -ItemType Directory -Path $backupDirectoryPath -Force | Out-Null

    & docker compose exec -T postgres sh -c `
        'test -n "$POSTGRES_USER" && test -n "$POSTGRES_DB" && pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --file="$1" && pg_restore --list "$1" >/dev/null' `
        sh $containerTempPath
    if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }

    & docker cp "${containerId}:${containerTempPath}" $backupPath
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy the backup from the PostgreSQL container.' }

    $backup = Get-Item -LiteralPath $backupPath
    if ($backup.Length -eq 0) { throw 'The created backup is empty.' }

    Write-Host "Backup created: $($backup.FullName)"
    Write-Host "Size: $([Math]::Round($backup.Length / 1MB, 2)) MB"
}
finally {
    if ($containerId) {
        & docker compose exec -T postgres rm -f -- $containerTempPath 2>$null | Out-Null
    }
    Pop-Location
}
