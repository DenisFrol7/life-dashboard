[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [string]$BookCoversDirectory
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
. (Join-Path $PSScriptRoot 'backup-common.ps1')
$backupPath = (Resolve-Path -LiteralPath $BackupFile).Path
$completeBackup = [IO.Path]::GetExtension($backupPath) -ieq '.zip'
$coversDirectory = if ($completeBackup) { Get-BookCoversDirectory $repoRoot $BookCoversDirectory } else { $null }
$restoreToken = [guid]::NewGuid().ToString('N')
$containerTempPath = "/tmp/life-dashboard-restore-$restoreToken.dump"
$containerScriptPath = "/tmp/life-dashboard-restore-$restoreToken.sh"
$restoreScript = Join-Path $PSScriptRoot 'postgres\restore.sh'
$containerId = $null

Assert-BackupBackendStopped $repoRoot

Write-Warning 'Restore will replace the current Life Dashboard database contents.'
if ($completeBackup) { Write-Warning "Local book covers will also be replaced in: $coversDirectory" }
else { Write-Warning 'Legacy database-only backup: local book cover files will not be restored or changed.' }
$confirmation = Read-Host 'Type RESTORE to continue'
if ($confirmation -cne 'RESTORE') {
    Write-Host 'Restore cancelled.'
    exit 0
}

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

    & docker cp $restoreScript "${containerId}:${containerScriptPath}"
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy the restore script into the PostgreSQL container.' }

    $restoreDatabase = {
        param([string]$DumpFile)
        & docker cp $DumpFile "${containerId}:${containerTempPath}"
        if ($LASTEXITCODE -ne 0) { throw 'Could not copy the backup into the PostgreSQL container.' }
        & docker compose exec -T postgres sh $containerScriptPath $containerTempPath
        if ($LASTEXITCODE -ne 0) { throw 'Database restore failed.' }
    }
    Restore-BackupArchive -ArchiveFile $backupPath -CoversDirectory $coversDirectory -RestoreDatabase $restoreDatabase

    Write-Host "Database restored from: $backupPath"
    if ($completeBackup) { Write-Host 'Local book covers restored from the same archive.' }
    Write-Host 'Start the backend and verify the application.'
}
finally {
    if ($containerId) {
        & docker compose exec -T postgres rm -f -- $containerTempPath $containerScriptPath 2>$null | Out-Null
    }
    Pop-Location
}
