ALTER TABLE books
    ADD COLUMN duration_minutes integer CHECK (duration_minutes > 0);

ALTER TABLE book_progress
    ADD COLUMN current_minute integer NOT NULL DEFAULT 0 CHECK (current_minute >= 0);

ALTER TABLE reading_sessions
    ADD COLUMN listened_minutes integer NOT NULL DEFAULT 0 CHECK (listened_minutes >= 0);

ALTER TABLE books ADD CONSTRAINT books_progress_measure_check CHECK (
    (book_format = 'AUDIOBOOK' AND duration_minutes IS NOT NULL AND page_count IS NULL) OR
    (book_format IN ('PAPER', 'EBOOK') AND page_count IS NOT NULL AND duration_minutes IS NULL)
);
