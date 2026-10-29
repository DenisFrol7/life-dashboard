[CmdletBinding()]
param(
    [string]$BackupDirectory = (Join-Path $PSScriptRoot '..\backups'),
    [string]$BookCoversDirectory
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
. (Join-Path $PSScriptRoot 'backup-common.ps1')
Assert-BackupBackendStopped $repoRoot
$coversDirectory = Get-BookCoversDirectory $repoRoot $BookCoversDirectory
$backupDirectoryPath = [System.IO.Path]::GetFullPath($BackupDirectory)
$timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss-fff'
$fileName = "life-dashboard_$timestamp.zip"
$backupPath = Join-Path $backupDirectoryPath $fileName
$containerTempPath = '/tmp/life-dashboard-backup-' + [guid]::NewGuid().ToString('N') + '.dump'
$containerId = $null
$workDirectory = $null

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
    $workDirectory = New-BackupWorkDirectory $backupDirectoryPath
    $dumpPath = Join-Path $workDirectory 'database.dump'

    $coverQuery = "SELECT substring(cover_url FROM length('/api/books/covers/') + 1) FROM content_items WHERE item_type = 'BOOK' AND cover_url LIKE '/api/books/covers/%';"
    $referencedCovers = @($coverQuery | & docker compose exec -T postgres sh -c `
        'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAt')
    if ($LASTEXITCODE -ne 0) { throw 'Could not read book cover references.' }

    & docker compose exec -T postgres sh -c `
        'test -n "$POSTGRES_USER" && test -n "$POSTGRES_DB" && pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --file="$1" && pg_restore --list "$1" >/dev/null' `
        sh $containerTempPath
    if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }

    & docker cp "${containerId}:${containerTempPath}" $dumpPath
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy the backup from the PostgreSQL container.' }

    $partialPath = Join-Path $workDirectory 'backup.zip'
    New-CompleteBackupArchive -DumpFile $dumpPath -CoversDirectory $coversDirectory -Destination $partialPath -ReferencedCovers $referencedCovers
    $validationDirectory = Join-Path $workDirectory 'validation'
    Expand-CompleteBackupArchive $partialPath $validationDirectory | Out-Null
    Move-Item -LiteralPath $partialPath -Destination $backupPath
    $backup = Get-Item -LiteralPath $backupPath
    if ($backup.Length -eq 0) { throw 'The created backup is empty.' }

    Write-Host "Backup created: $($backup.FullName)"
    Write-Host "Size: $([Math]::Round($backup.Length / 1MB, 2)) MB"
    Write-Host "Includes: PostgreSQL dump, local book covers and SHA-256 manifest."
}
finally {
    if ($containerId) {
        & docker compose exec -T postgres rm -f -- $containerTempPath 2>$null | Out-Null
    }
    if ($workDirectory) {
        try { Remove-BackupWorkDirectory $workDirectory $backupDirectoryPath }
        catch { Write-Warning "Could not remove backup staging files: $workDirectory" }
    }
    Pop-Location
}
