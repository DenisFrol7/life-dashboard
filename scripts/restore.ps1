[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backupPath = (Resolve-Path -LiteralPath $BackupFile).Path
$containerTempPath = '/tmp/life-dashboard-restore.dump'
$containerId = $null

$tcpClient = New-Object System.Net.Sockets.TcpClient
try {
    $connection = $tcpClient.BeginConnect('127.0.0.1', 8080, $null, $null)
    if ($connection.AsyncWaitHandle.WaitOne(500) -and $tcpClient.Connected) {
        throw 'Backend is running on port 8080. Stop it before restoring the database.'
    }
}
finally {
    $tcpClient.Close()
}

Write-Warning 'Restore will replace the current Life Dashboard database contents.'
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

    & docker cp $backupPath "${containerId}:${containerTempPath}"
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy the backup into the PostgreSQL container.' }

    & docker compose exec -T postgres sh -c `
        'test -n "$POSTGRES_USER" && test -n "$POSTGRES_DB" && pg_restore --list "$1" >/dev/null && pg_restore --clean --if-exists --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$1"' `
        sh $containerTempPath
    if ($LASTEXITCODE -ne 0) { throw 'Database restore failed.' }

    Write-Host "Database restored from: $backupPath"
    Write-Host 'Start the backend and verify the application.'
}
finally {
    if ($containerId) {
        & docker compose exec -T postgres rm -f -- $containerTempPath 2>$null | Out-Null
    }
    Pop-Location
}
