ALTER TABLE content_items ADD COLUMN shikimori_id BIGINT;
CREATE UNIQUE INDEX ux_content_items_shikimori_id
    ON content_items (shikimori_id) WHERE shikimori_id IS NOT NULL;
