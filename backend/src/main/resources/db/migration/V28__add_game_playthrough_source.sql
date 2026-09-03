ALTER TABLE game_playthroughs
    ADD COLUMN completion_source varchar(30) NOT NULL DEFAULT 'MANUAL',
    ADD CONSTRAINT chk_game_playthroughs_completion_source
        CHECK (completion_source IN ('MANUAL', 'STEAM_ACHIEVEMENTS'));

CREATE UNIQUE INDEX uq_game_playthroughs_steam_achievements
    ON game_playthroughs(library_entry_id)
    WHERE completion_source = 'STEAM_ACHIEVEMENTS';
