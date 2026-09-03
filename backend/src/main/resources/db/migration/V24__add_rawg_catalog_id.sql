ALTER TABLE content_items
    ADD COLUMN rawg_id bigint,
    ADD COLUMN rawg_slug varchar(300),
    ADD COLUMN rawg_enriched_at timestamptz;

CREATE UNIQUE INDEX ux_content_items_rawg_id
    ON content_items (rawg_id) WHERE rawg_id IS NOT NULL;
