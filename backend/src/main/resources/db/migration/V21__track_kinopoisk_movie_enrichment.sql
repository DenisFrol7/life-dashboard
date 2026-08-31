ALTER TABLE content_items ADD COLUMN kinopoisk_enriched_at timestamptz;

UPDATE content_items
SET kinopoisk_enriched_at = now()
WHERE item_type = 'MOVIE'
  AND kinopoisk_film_id IS NOT NULL
  AND description IS NOT NULL
  AND duration_minutes IS NOT NULL;
