ALTER TABLE user_game_library
    ADD COLUMN xbox_title_id bigint;

CREATE INDEX idx_user_game_library_xbox_title_id
    ON user_game_library(xbox_title_id)
    WHERE xbox_title_id IS NOT NULL;

ALTER TABLE game_playthroughs
    DROP CONSTRAINT chk_game_playthroughs_completion_source;

ALTER TABLE game_playthroughs
    ADD CONSTRAINT chk_game_playthroughs_completion_source
        CHECK (completion_source IN ('MANUAL', 'STEAM_ACHIEVEMENTS', 'XBOX_ACHIEVEMENTS'));

CREATE UNIQUE INDEX uq_game_playthroughs_xbox_achievements
    ON game_playthroughs(library_entry_id)
    WHERE completion_source = 'XBOX_ACHIEVEMENTS';
