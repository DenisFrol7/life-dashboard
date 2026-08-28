-- Imported time belongs to the only recorded playthrough of this exact copy.
-- Multiple playthroughs stay untouched because their time cannot be distributed safely.
UPDATE game_playthroughs AS playthrough
SET playtime_minutes = library.legacy_playtime_minutes
FROM user_game_library AS library
WHERE playthrough.library_entry_id = library.id
  AND playthrough.playtime_minutes = 0
  AND library.legacy_playtime_minutes > 0
  AND (SELECT count(*)
       FROM game_playthroughs sibling
       WHERE sibling.library_entry_id = library.id) = 1;
