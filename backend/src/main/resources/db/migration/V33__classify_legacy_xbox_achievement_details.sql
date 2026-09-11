UPDATE xbox_game_progress progress
SET achievement_details_status = 'LEGACY_NOT_SUPPORTED'
FROM user_game_library library, gaming_platforms platform
WHERE progress.library_entry_id = library.id
  AND library.platform_id = platform.id
  AND platform.code IN ('XBOX_360', 'ORIGINAL_XBOX')
  AND progress.achievement_details_status = 'NOT_SYNCHRONIZED';
