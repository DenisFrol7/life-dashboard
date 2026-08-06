ALTER TABLE game_sessions
    ADD COLUMN unlocked_achievements integer NOT NULL DEFAULT 0 CHECK (unlocked_achievements >= 0),
    ADD COLUMN earned_gamerscore integer NOT NULL DEFAULT 0 CHECK (earned_gamerscore >= 0);
