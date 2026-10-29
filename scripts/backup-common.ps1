Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-BackupSetting([string]$RepoRoot, [string]$Name, [string]$Default) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if (-not [string]::IsNullOrWhiteSpace($value)) { return $value }
    $envFile = Join-Path $RepoRoot '.env'
    if (Test-Path -LiteralPath $envFile) {
        foreach ($line in [IO.File]::ReadAllLines($envFile)) {
            if ($line -match ('^\s*' + [regex]::Escape($Name) + '\s*=\s*(.*)$')) { return $Matches[1].Trim() }
        }
    }
    return $Default
}

function Get-BookCoversDirectory([string]$RepoRoot, [string]$Override) {
    $configured = $Override
    if ([string]::IsNullOrWhiteSpace($configured)) {
        $configured = Get-BackupSetting $RepoRoot 'BOOK_COVERS_DIRECTORY' '../data/uploads/book-covers'
    }
    if (-not [IO.Path]::IsPathRooted($configured)) { $configured = Join-Path (Join-Path $RepoRoot 'backend') $configured }
    $resolved = [IO.Path]::GetFullPath($configured).TrimEnd([char[]]'\/')
    $projectPath = [IO.Path]::GetFullPath($RepoRoot).TrimEnd([char[]]'\/')
    if ([string]::IsNullOrEmpty($resolved) -or $resolved -eq [IO.Path]::GetPathRoot($resolved).TrimEnd([char[]]'\/') -or
        $projectPath -eq $resolved -or $projectPath.StartsWith($resolved + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Book covers directory must not be a drive root or contain the project directory.'
    }
    return $resolved
}

function Assert-BackupBackendStopped([string]$RepoRoot) {
    $portValue = Get-BackupSetting $RepoRoot 'SERVER_PORT' '8080'
    $port = 0
    if (-not [int]::TryParse($portValue, [ref]$port) -or $port -lt 1 -or $port -gt 65535) { throw 'Invalid SERVER_PORT.' }
    $client = New-Object Net.Sockets.TcpClient
    try {
        $connection = $client.BeginConnect('127.0.0.1', $port, $null, $null)
        if ($connection.AsyncWaitHandle.WaitOne(500) -and $client.Connected) {
            throw "Backend is running on port $port. Stop it before backing up or restoring the database and covers."
        }
    }
    finally { $client.Close() }
}

function Assert-CoverFilename([string]$Name) {
    if ([string]::IsNullOrWhiteSpace($Name) -or $Name.IndexOfAny([IO.Path]::GetInvalidFileNameChars()) -ge 0 -or
        $Name.Contains('/') -or $Name.Contains('\') -or $Name -match '[. ]$' -or
        $Name -match '^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)') {
        throw "Invalid cover filename: $Name"
    }
}

function Assert-FlatCoversDirectory([string]$Directory) {
    if (-not (Test-Path -LiteralPath $Directory)) { return }
    $folder = Get-Item -LiteralPath $Directory -Force
    if (-not $folder.PSIsContainer -or ($folder.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Book covers directory must be a regular directory.'
    }
    foreach ($item in Get-ChildItem -LiteralPath $Directory -Force) {
        if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Book covers directory must contain only regular files.'
        }
        Assert-CoverFilename $item.Name
    }
}

function Remove-BackupWorkDirectory([string]$Directory, [string]$Parent) {
    $absolute = [IO.Path]::GetFullPath($Directory)
    $expectedParent = [IO.Path]::GetFullPath($Parent).TrimEnd([char[]]'\/')
    if ([IO.Path]::GetDirectoryName($absolute) -ne $expectedParent -or
        [IO.Path]::GetFileName($absolute) -notmatch '^\.life-dashboard-(backup|covers)-(work|previous)-[a-f0-9]{32}$') {
        throw 'Refusing to remove an unexpected backup workspace.'
    }
    if (Test-Path -LiteralPath $absolute) {
        if ((Get-Item -LiteralPath $absolute -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw 'Refusing to remove a linked backup workspace.'
        }
        Remove-Item -LiteralPath $absolute -Recurse -Force
    }
}

function New-BackupWorkDirectory([string]$Parent) {
    $path = Join-Path ([IO.Path]::GetFullPath($Parent)) ('.life-dashboard-backup-work-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $path -Force | Out-Null
    return $path
}

function New-CompleteBackupArchive {
    param([string]$DumpFile, [string]$CoversDirectory, [string]$Destination, [string[]]$ReferencedCovers = @())
    Assert-FlatCoversDirectory $CoversDirectory
    if (-not (Test-Path -LiteralPath $DumpFile -PathType Leaf) -or (Get-Item -LiteralPath $DumpFile).Length -eq 0) {
        throw 'Database dump is missing or empty.'
    }
    foreach ($name in $ReferencedCovers) {
        Assert-CoverFilename $name
        if (-not (Test-Path -LiteralPath (Join-Path $CoversDirectory $name) -PathType Leaf)) {
            throw "A cover referenced by the database is missing: $name"
        }
    }
    $files = @()
    if (Test-Path -LiteralPath $CoversDirectory) { $files = @(Get-ChildItem -LiteralPath $CoversDirectory -File -Force | Sort-Object Name) }
    $manifest = [ordered]@{
        formatVersion = 1
        createdAt = [DateTimeOffset]::UtcNow.ToString('o')
        database = @{ file = 'database.dump'; sha256 = (Get-FileHash -LiteralPath $DumpFile -Algorithm SHA256).Hash }
        bookCovers = @($files | ForEach-Object { @{ file = 'book-covers/' + $_.Name; sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash } })
    }
    $zip = [IO.Compression.ZipFile]::Open($Destination, [IO.Compression.ZipArchiveMode]::Create)
    try {
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $DumpFile, 'database.dump') | Out-Null
        foreach ($file in $files) {
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, ('book-covers/' + $file.Name)) | Out-Null
        }
        $entry = $zip.CreateEntry('manifest.json')
        $writer = New-Object IO.StreamWriter($entry.Open(), (New-Object Text.UTF8Encoding($false)))
        try { $writer.Write(($manifest | ConvertTo-Json -Depth 6)) }
        finally { $writer.Dispose() }
    }
    finally { $zip.Dispose() }
}

function Expand-CompleteBackupArchive([string]$ArchiveFile, [string]$WorkDirectory) {
    $zip = [IO.Compression.ZipFile]::OpenRead($ArchiveFile)
    try {
        $entries = @{}
        foreach ($entry in $zip.Entries) {
            if ($entries.ContainsKey($entry.FullName)) { throw 'Archive contains duplicate filenames.' }
            $entries[$entry.FullName] = $entry
        }
        $manifestEntry = $entries['manifest.json']
        if ($null -eq $manifestEntry) { throw 'Backup manifest is missing.' }
        $reader = New-Object IO.StreamReader($manifestEntry.Open())
        try { $manifest = $reader.ReadToEnd() | ConvertFrom-Json }
        finally { $reader.Dispose() }
        if ($manifest.formatVersion -ne 1 -or $manifest.database.file -cne 'database.dump' -or
            $manifest.bookCovers -isnot [Array]) { throw 'Unsupported backup format.' }
        $expected = @($manifest.database) + @($manifest.bookCovers)
        $seen = @{}
        foreach ($file in $expected) {
            if ($file.file -cne 'database.dump') {
                if ($file.file -cnotmatch '^book-covers/([^/\\]+)$') { throw 'Invalid cover archive path.' }
                Assert-CoverFilename $Matches[1]
            }
            if ($seen.ContainsKey($file.file) -or $file.sha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'Invalid backup manifest.' }
            $seen[$file.file] = $true
            if (-not $entries.ContainsKey($file.file)) { throw "Backup file is missing: $($file.file)" }
        }
        if ($entries.Count -ne $expected.Count + 1) { throw 'Backup contains unexpected files.' }
        $coverStage = Join-Path $WorkDirectory 'book-covers'
        New-Item -ItemType Directory -Path $coverStage -Force | Out-Null
        foreach ($file in $expected) {
            $destination = if ($file.file -ceq 'database.dump') { Join-Path $WorkDirectory 'database.dump' }
                else { Join-Path $coverStage ($file.file.Substring('book-covers/'.Length)) }
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entries[$file.file], $destination, $false)
            if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ine $file.sha256) {
                throw "Backup checksum mismatch: $($file.file)"
            }
        }
        return [pscustomobject]@{ DumpFile = (Join-Path $WorkDirectory 'database.dump'); CoversDirectory = $coverStage }
    }
    finally { $zip.Dispose() }
}

function Restore-CompleteBackupArchive {
    param([string]$ArchiveFile, [string]$CoversDirectory, [scriptblock]$RestoreDatabase)
    Assert-FlatCoversDirectory $CoversDirectory
    $target = [IO.Path]::GetFullPath($CoversDirectory).TrimEnd([char[]]'\/')
    $parent = [IO.Path]::GetDirectoryName($target)
    $work = New-BackupWorkDirectory $parent
    $previous = Join-Path $parent ('.life-dashboard-covers-previous-' + [guid]::NewGuid().ToString('N'))
    $oldMoved = $false
    $newMoved = $false
    $databaseRestored = $false
    try {
        $expanded = Expand-CompleteBackupArchive $ArchiveFile $work
        # All moves stay in the configured covers parent; no archive path controls the target.
        if ([IO.Path]::GetDirectoryName($previous) -ne $parent -or [IO.Path]::GetDirectoryName($work) -ne $parent) {
            throw 'Unexpected covers staging directory.'
        }
        if (Test-Path -LiteralPath $target) {
            Move-Item -LiteralPath $target -Destination $previous
            $oldMoved = $true
        }
        Move-Item -LiteralPath $expanded.CoversDirectory -Destination $target
        $newMoved = $true
        & $RestoreDatabase $expanded.DumpFile
        $databaseRestored = $true
    }
    catch {
        $restoreError = $_
        try {
            if ($newMoved) { Move-Item -LiteralPath $target -Destination (Join-Path $work 'book-covers') }
            if ($oldMoved) { Move-Item -LiteralPath $previous -Destination $target; $oldMoved = $false }
        }
        catch { throw "Restore failed and cover rollback failed. Original covers are preserved at: $previous. $($_.Exception.Message)" }
        throw $restoreError
    }
    finally {
        try { Remove-BackupWorkDirectory $work $parent }
        catch { Write-Warning "Could not remove backup staging files: $work" }
        if ($databaseRestored -and $oldMoved) {
            try { Remove-BackupWorkDirectory $previous $parent }
            catch { Write-Warning "Restore succeeded; old covers could not be removed: $previous" }
        }
    }
}

function Restore-BackupArchive {
    param([string]$ArchiveFile, [string]$CoversDirectory, [scriptblock]$RestoreDatabase)
    if ([IO.Path]::GetExtension($ArchiveFile) -ieq '.zip') {
        Restore-CompleteBackupArchive -ArchiveFile $ArchiveFile -CoversDirectory $CoversDirectory -RestoreDatabase $RestoreDatabase
    } else { & $RestoreDatabase $ArchiveFile }
}
