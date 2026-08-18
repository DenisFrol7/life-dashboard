ALTER TABLE user_game_library
    ADD COLUMN legacy_playtime_minutes bigint NOT NULL DEFAULT 0;
