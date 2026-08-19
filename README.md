# life-dashboard
Personal dashboard for tracking health, habits, media and life statistics.

## Planned features

- Dashboard
- Daily statistics
- Habit tracker
- Movies
- TV Series
- Games
- Analytics

## Database backup

PostgreSQL must be running and healthy. Create a compressed backup from the repository root:

```powershell
.\scripts\backup.ps1
```

Backups are written to `backups/` and are not tracked by Git. The command validates the archive before copying it from the PostgreSQL container.

To restore a backup, stop the backend first and run:

```powershell
.\scripts\restore.ps1 -BackupFile .\backups\life-dashboard_YYYY-MM-DD_HH-mm-ss.dump
```

Restoring replaces the current development database contents and requires typing `RESTORE` explicitly. Create a fresh backup before applying a new Flyway migration or restoring an older archive.
