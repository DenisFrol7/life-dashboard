ALTER TABLE xbox_game_progress
    ADD COLUMN achievement_details_status varchar(40) NOT NULL DEFAULT 'NOT_SYNCHRONIZED';

UPDATE xbox_game_progress progress
SET achievement_details_status = 'AVAILABLE'
WHERE EXISTS (
    SELECT 1
    FROM xbox_achievements achievement
    WHERE achievement.progress_id = progress.id
);

ALTER TABLE xbox_game_progress
    ADD CONSTRAINT chk_xbox_achievement_details_status
        CHECK (achievement_details_status IN (
            'NOT_SYNCHRONIZED',
            'AVAILABLE',
            'NO_ACHIEVEMENTS',
            'LEGACY_NOT_SUPPORTED',
            'DETAILS_UNAVAILABLE',
            'POSSIBLE_PC_VERSION',
            'TITLE_PLATFORM_MISMATCH'
        ));
