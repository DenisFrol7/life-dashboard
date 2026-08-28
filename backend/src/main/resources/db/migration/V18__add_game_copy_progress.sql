ALTER TABLE user_game_library
    ADD COLUMN status varchar(20) NOT NULL DEFAULT 'NOT_STARTED',
    ADD COLUMN started_at timestamptz,
    ADD COLUMN completed_at timestamptz,
    ADD CONSTRAINT ck_user_game_library_status
        CHECK (status IN ('NOT_STARTED', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'DROPPED')),
    ADD CONSTRAINT ck_user_game_library_dates
        CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at);

-- A recorded completion is unambiguous: it belongs to the copy referenced by the playthrough.
UPDATE user_game_library AS library
SET status = 'COMPLETED',
    completed_at = history.completed_at
FROM (
    SELECT library_entry_id, max(completed_at) AS completed_at
    FROM game_playthroughs
    GROUP BY library_entry_id
) AS history
WHERE history.library_entry_id = library.id;

-- Sessions and imported time identify the copy being played, but not a completion date.
UPDATE user_game_library AS library
SET status = 'IN_PROGRESS',
    started_at = activity.started_at
FROM (
    SELECT library_entry_id, min(started_at) AS started_at
    FROM game_sessions
    GROUP BY library_entry_id
) AS activity
WHERE activity.library_entry_id = library.id
  AND library.status = 'NOT_STARTED';

UPDATE user_game_library
SET status = 'IN_PROGRESS'
WHERE legacy_playtime_minutes > 0
  AND status = 'NOT_STARTED';

-- With one copy only, the old shared progress can be moved without ambiguity.
UPDATE user_game_library AS library
SET status = content.status,
    started_at = content.started_at,
    completed_at = content.completed_at
FROM user_content AS content
WHERE content.id = library.user_content_id
  AND (SELECT count(*) FROM user_game_library sibling
       WHERE sibling.user_content_id = library.user_content_id) = 1
  AND library.status = 'NOT_STARTED';

CREATE INDEX idx_user_game_library_status ON user_game_library(status);
