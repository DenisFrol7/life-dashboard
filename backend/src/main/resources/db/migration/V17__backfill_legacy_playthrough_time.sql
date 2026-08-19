UPDATE game_playthroughs AS playthrough
SET playtime_minutes = library.legacy_playtime_minutes
FROM user_game_library AS library
WHERE playthrough.library_entry_id = library.id
  AND playthrough.playtime_minutes = 0
  AND library.legacy_playtime_minutes > 0;
