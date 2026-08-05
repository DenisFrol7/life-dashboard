ALTER TABLE content_items
    ADD COLUMN release_status varchar(20) NOT NULL DEFAULT 'RELEASED';

ALTER TABLE content_items
    ADD CONSTRAINT content_items_release_status_check
        CHECK (release_status IN ('ANNOUNCED', 'ONGOING', 'RELEASED', 'ENDED', 'CANCELLED'));
