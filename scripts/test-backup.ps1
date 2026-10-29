[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
. (Join-Path $PSScriptRoot 'backup-common.ps1')
$testParent = Join-Path $repoRoot 'backend\target'
$work = New-BackupWorkDirectory $testParent
$token = [guid]::NewGuid().ToString('N').Substring(0, 12)
$sourceDatabase = "life_dashboard_backup_test_${token}_source"
$targetDatabase = "life_dashboard_backup_test_${token}_target"
$containerArchive = "/tmp/life-dashboard-backup-test-$token.dump"
$containerScript = "/tmp/life-dashboard-backup-test-$token.sh"
$containerId = $null
$createdDatabases = @()
$sourceCovers = Join-Path $work 'source covers'
$targetCovers = Join-Path $work 'custom destination covers'
$dumpPath = Join-Path $work 'database.dump'
$archivePath = Join-Path $work 'complete.zip'

function Invoke-BackupTestSql([string]$Database, [string]$Sql) {
    $output = $Sql | & docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" -qAt' sh $Database
    if ($LASTEXITCODE -ne 0) { throw "Test SQL failed in $Database." }
    return ($output -join "`n").Trim()
}

function Save-BackupTestDump {
    & docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$1" --format=custom --file="$2"' sh $sourceDatabase $containerArchive
    if ($LASTEXITCODE -ne 0) { throw 'Could not create test dump.' }
    & docker cp "${containerId}:${containerArchive}" $dumpPath
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy test dump.' }
}

function Invoke-BackupTestRestore([string]$DumpFile) {
    & docker cp $DumpFile "${containerId}:${containerArchive}"
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy restore fixture.' }
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & docker compose exec -T -e "POSTGRES_DB=$targetDatabase" postgres sh $containerScript $containerArchive 2>&1
        $restoreExit = $LASTEXITCODE
    }
    finally { $ErrorActionPreference = $previousPreference }
    if ($restoreExit -ne 0) { throw "Database restore failed: $($output | Out-String)" }
}

function Get-BackupTestCovers([string]$Directory) {
    if (-not (Test-Path -LiteralPath $Directory)) { return '<absent>' }
    return ((Get-ChildItem -LiteralPath $Directory -File -Force | Sort-Object Name | ForEach-Object {
        $_.Name + ':' + (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    }) -join "`n")
}

function Set-BackupTestZipEntry([string]$Archive, [string]$Name, [string]$Content) {
    $zip = [IO.Compression.ZipFile]::Open($Archive, [IO.Compression.ZipArchiveMode]::Update)
    try {
        $old = $zip.GetEntry($Name)
        if ($old) { $old.Delete() }
        $entry = $zip.CreateEntry($Name)
        $writer = New-Object IO.StreamWriter($entry.Open(), (New-Object Text.UTF8Encoding($false)))
        try { $writer.Write($Content) } finally { $writer.Dispose() }
    } finally { $zip.Dispose() }
}

function Assert-BackupTestFailure([scriptblock]$Action, [string]$MessagePattern = '*') {
    $failed = $false
    try { & $Action | Out-Null }
    catch {
        $failed = $true
        if ($_.Exception.Message -notlike $MessagePattern) { throw }
    }
    if (-not $failed) { throw 'Expected backup/restore to fail.' }
}

$schemaSql = @'
CREATE TABLE a_cover_reference(id integer PRIMARY KEY, filename text NOT NULL);
CREATE TABLE z_restore_failure(id integer PRIMARY KEY);
'@
$snapshotSql = @'
SELECT jsonb_build_object('rows', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM a_cover_reference t),
                         'table', 'a_cover_reference'::regclass::oid,
                         'last_table', 'z_restore_failure'::regclass::oid);
'@

Push-Location $repoRoot
try {
    foreach ($database in @($sourceDatabase, $targetDatabase)) {
        if ($database -notmatch '^life_dashboard_backup_test_[a-f0-9]{12}_(source|target)$') { throw 'Unexpected test database name.' }
    }
    $containerId = (& docker compose ps -q postgres).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) { throw 'PostgreSQL is not running.' }
    & docker cp (Join-Path $PSScriptRoot 'postgres\restore.sh') "${containerId}:${containerScript}"
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy restore script.' }
    foreach ($database in @($sourceDatabase, $targetDatabase)) {
        & docker compose exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" "$1"' sh $database
        if ($LASTEXITCODE -ne 0) { throw "Could not create $database." }
        $createdDatabases += $database
        Invoke-BackupTestSql $database $schemaSql | Out-Null
    }
    Invoke-BackupTestSql $sourceDatabase "INSERT INTO a_cover_reference VALUES (1,'first.jpg');" | Out-Null
    Invoke-BackupTestSql $targetDatabase "INSERT INTO a_cover_reference VALUES (2,'old.jpg');" | Out-Null
    New-Item -ItemType Directory -Path $sourceCovers, $targetCovers | Out-Null
    [IO.File]::WriteAllBytes((Join-Path $sourceCovers 'first.jpg'), [byte[]](255,216,255,1,2,3))
    [IO.File]::WriteAllBytes((Join-Path $sourceCovers 'cover [2].png'), [byte[]](137,80,78,71,4,5,6))
    [IO.File]::WriteAllBytes((Join-Path $targetCovers 'old.jpg'), [byte[]](255,216,255,9))
    Save-BackupTestDump
    New-CompleteBackupArchive -DumpFile $dumpPath -CoversDirectory $sourceCovers -Destination $archivePath -ReferencedCovers @('first.jpg')
    Restore-BackupArchive $archivePath $targetCovers { param($dump) Invoke-BackupTestRestore $dump }
    if ((Get-BackupTestCovers $sourceCovers) -cne (Get-BackupTestCovers $targetCovers) -or
        (Invoke-BackupTestSql $targetDatabase "SELECT filename FROM a_cover_reference;") -cne 'first.jpg') {
        throw 'Complete restore did not reproduce database references and cover bytes.'
    }
    Write-Host 'PASS: database and every cover are restored together, including names with spaces/brackets.'

    Invoke-BackupTestSql $targetDatabase @'
UPDATE a_cover_reference SET filename='current.jpg';
CREATE FUNCTION reject_backup_test_table() RETURNS event_trigger LANGUAGE plpgsql AS $$
DECLARE command record;
BEGIN
    FOR command IN SELECT * FROM pg_event_trigger_ddl_commands() LOOP
        IF command.object_type='table' AND command.object_identity='public.z_restore_failure' THEN
            RAISE EXCEPTION 'Intentional complete backup restore failure';
        END IF;
    END LOOP;
END;
$$;
CREATE EVENT TRIGGER reject_backup_test ON ddl_command_end WHEN TAG IN ('CREATE TABLE')
    EXECUTE FUNCTION reject_backup_test_table();
'@ | Out-Null
    [IO.File]::WriteAllBytes((Join-Path $targetCovers 'current.jpg'), [byte[]](255,216,255,77))
    $beforeCovers = Get-BackupTestCovers $targetCovers
    $beforeDatabase = Invoke-BackupTestSql $targetDatabase $snapshotSql
    Assert-BackupTestFailure {
        Restore-BackupArchive $archivePath $targetCovers { param($dump) Invoke-BackupTestRestore $dump }
    } '*Intentional complete backup restore failure*'
    if ((Get-BackupTestCovers $targetCovers) -cne $beforeCovers -or
        (Invoke-BackupTestSql $targetDatabase $snapshotSql) -cne $beforeDatabase) { throw 'Failed database restore changed covers or database.' }
    Write-Host 'PASS: failure after replacing tables rolls back the database and restores the previous cover directory.'

    $state = [pscustomobject]@{ DatabaseCalls = 0 }
    $mustNotRestore = { param($dump) $state.DatabaseCalls++; throw 'Unexpected database restore.' }
    $corrupt = Join-Path $work 'corrupt.zip'
    Copy-Item -LiteralPath $archivePath -Destination $corrupt
    Set-BackupTestZipEntry $corrupt 'book-covers/first.jpg' 'changed bytes'
    Assert-BackupTestFailure { Restore-BackupArchive $corrupt $targetCovers $mustNotRestore } '*checksum mismatch*'
    if ($state.DatabaseCalls -ne 0 -or (Get-BackupTestCovers $targetCovers) -cne $beforeCovers) { throw 'Checksum failure changed data.' }
    Write-Host 'PASS: checksum mismatch is rejected before changing covers or invoking database restore.'

    $corruptDatabase = Join-Path $work 'corrupt-database.zip'
    Copy-Item -LiteralPath $archivePath -Destination $corruptDatabase
    Set-BackupTestZipEntry $corruptDatabase 'database.dump' 'changed database bytes'
    Assert-BackupTestFailure { Restore-BackupArchive $corruptDatabase $targetCovers $mustNotRestore } '*checksum mismatch*'
    if ($state.DatabaseCalls -ne 0 -or (Get-BackupTestCovers $targetCovers) -cne $beforeCovers) { throw 'Database checksum failure changed data.' }
    Write-Host 'PASS: database checksum mismatch is rejected before changing files or the database.'

    $missing = Join-Path $work 'missing.zip'
    Copy-Item -LiteralPath $archivePath -Destination $missing
    $zip = [IO.Compression.ZipFile]::Open($missing, [IO.Compression.ZipArchiveMode]::Update)
    try { $zip.GetEntry('book-covers/first.jpg').Delete() } finally { $zip.Dispose() }
    Assert-BackupTestFailure { Restore-BackupArchive $missing $targetCovers $mustNotRestore } '*file is missing*'
    $unsafe = Join-Path $work 'unsafe.zip'
    Copy-Item -LiteralPath $archivePath -Destination $unsafe
    Set-BackupTestZipEntry $unsafe '../escaped.txt' 'must not be extracted'
    Assert-BackupTestFailure { Restore-BackupArchive $unsafe $targetCovers $mustNotRestore } '*unexpected files*'
    if ($state.DatabaseCalls -ne 0 -or (Get-BackupTestCovers $targetCovers) -cne $beforeCovers -or
        (Test-Path -LiteralPath (Join-Path $work 'escaped.txt'))) { throw 'Invalid archive changed files.' }
    Write-Host 'PASS: missing files and unexpected archive paths are rejected without changes.'

    Assert-BackupTestFailure {
        New-CompleteBackupArchive -DumpFile $dumpPath -CoversDirectory $sourceCovers -Destination (Join-Path $work 'must-not-exist.zip') -ReferencedCovers @('missing.jpg')
    } '*referenced by the database is missing*'
    if (Test-Path -LiteralPath (Join-Path $work 'must-not-exist.zip')) { throw 'Incomplete backup was published.' }
    Write-Host 'PASS: a missing referenced cover prevents creating an incomplete backup.'

    $absentCovers = Join-Path $work 'absent covers'
    Assert-BackupTestFailure {
        Restore-BackupArchive $archivePath $absentCovers { param($dump) throw 'Simulated restore failure.' }
    } '*Simulated restore failure*'
    if (Test-Path -LiteralPath $absentCovers) { throw 'Failure created covers where no directory previously existed.' }
    Write-Host 'PASS: rollback preserves an originally absent covers directory.'

    Invoke-BackupTestSql $targetDatabase 'DROP EVENT TRIGGER reject_backup_test; DROP FUNCTION reject_backup_test_table();' | Out-Null
    Restore-BackupArchive $dumpPath $targetCovers { param($dump) Invoke-BackupTestRestore $dump }
    if ((Get-BackupTestCovers $targetCovers) -cne $beforeCovers) { throw 'Legacy restore changed cover files.' }
    Write-Host 'PASS: legacy database-only archives leave existing cover files untouched.'

    Invoke-BackupTestSql $sourceDatabase 'DELETE FROM a_cover_reference;' | Out-Null
    Save-BackupTestDump
    $emptyArchive = Join-Path $work 'empty.zip'
    New-CompleteBackupArchive -DumpFile $dumpPath -CoversDirectory $absentCovers -Destination $emptyArchive
    Restore-BackupArchive $emptyArchive $targetCovers { param($dump) Invoke-BackupTestRestore $dump }
    if (-not (Test-Path -LiteralPath $targetCovers -PathType Container) -or (Get-BackupTestCovers $targetCovers) -cne '' -or
        (Invoke-BackupTestSql $targetDatabase 'SELECT COUNT(*) FROM a_cover_reference;') -ne '0') { throw 'Empty covers backup was not restored correctly.' }
    Write-Host 'PASS: archives without local covers restore an empty directory and matching database.'

    Assert-BackupTestFailure { Remove-BackupWorkDirectory $sourceCovers $work } '*unexpected backup workspace*'
    if (-not (Test-Path -LiteralPath (Join-Path $sourceCovers 'first.jpg'))) { throw 'Unexpected directory was removed.' }
    Assert-BackupTestFailure { Get-BookCoversDirectory $repoRoot $repoRoot } '*must not*'
    Write-Host 'PASS: cleanup and covers paths cannot target an unrelated directory or project root.'

    $settingsRoot = Join-Path $work 'settings project'
    New-Item -ItemType Directory -Path (Join-Path $settingsRoot 'backend') -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $settingsRoot '.env'), "BOOK_COVERS_DIRECTORY=../custom covers`n")
    $oldCoverSetting = [Environment]::GetEnvironmentVariable('BOOK_COVERS_DIRECTORY')
    try {
        [Environment]::SetEnvironmentVariable('BOOK_COVERS_DIRECTORY', $null)
        if ((Get-BookCoversDirectory $settingsRoot '') -ne (Join-Path $settingsRoot 'custom covers')) { throw 'Relative covers setting was resolved incorrectly.' }
        [Environment]::SetEnvironmentVariable('BOOK_COVERS_DIRECTORY', '../environment covers')
        if ((Get-BookCoversDirectory $settingsRoot '') -ne (Join-Path $settingsRoot 'environment covers')) { throw 'Environment covers setting was ignored.' }
        if ((Get-BookCoversDirectory $settingsRoot $sourceCovers) -ne $sourceCovers) { throw 'Explicit covers setting was ignored.' }
        $exclusive = [IO.File]::Open((Join-Path $settingsRoot '.env'), [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        $exclusive.Dispose()
    } finally { [Environment]::SetEnvironmentVariable('BOOK_COVERS_DIRECTORY', $oldCoverSetting) }
    Write-Host 'PASS: explicit, environment and .env covers settings use the same backend-relative paths.'
}
finally {
    try {
        foreach ($database in $createdDatabases) {
            & docker compose exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$1"' sh $database
            if ($LASTEXITCODE -ne 0) { Write-Warning "Could not clean up test database $database." }
        }
        if ($containerId) { & docker compose exec -T postgres rm -f -- $containerArchive $containerScript | Out-Null }
        Remove-BackupWorkDirectory $work $testParent
    }
    finally { Pop-Location }
}
