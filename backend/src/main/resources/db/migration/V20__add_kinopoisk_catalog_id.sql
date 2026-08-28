ALTER TABLE content_items ADD COLUMN kinopoisk_film_id bigint;
CREATE UNIQUE INDEX uq_content_items_kinopoisk_film_id
    ON content_items (kinopoisk_film_id) WHERE kinopoisk_film_id IS NOT NULL;
