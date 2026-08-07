ALTER TABLE user_content
    DROP CONSTRAINT user_content_status_check;

ALTER TABLE user_content
    ADD CONSTRAINT user_content_status_check
        CHECK (status IN ('NOT_STARTED', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'DROPPED'));
