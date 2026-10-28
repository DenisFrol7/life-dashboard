ALTER TABLE book_progress ADD COLUMN user_id bigint, ADD COLUMN book_id bigint;

UPDATE book_progress progress
SET user_id = library.user_id, book_id = book.id
FROM user_content library JOIN books book ON book.content_id = library.content_id
WHERE progress.user_content_id = library.id;

ALTER TABLE book_progress
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN book_id SET NOT NULL,
    ADD CONSTRAINT book_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    ADD CONSTRAINT book_progress_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    ADD CONSTRAINT book_progress_user_book_key UNIQUE (user_id, book_id),
    DROP COLUMN user_content_id;

CREATE INDEX idx_book_progress_book_id ON book_progress(book_id);

ALTER TABLE reading_sessions ADD COLUMN user_id bigint, ADD COLUMN book_id bigint;

UPDATE reading_sessions session
SET user_id = library.user_id, book_id = book.id
FROM user_content library JOIN books book ON book.content_id = library.content_id
WHERE session.user_content_id = library.id;

ALTER TABLE reading_sessions
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN book_id SET NOT NULL,
    ADD CONSTRAINT reading_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    ADD CONSTRAINT reading_sessions_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    DROP COLUMN user_content_id;

CREATE INDEX idx_reading_sessions_user_book_started ON reading_sessions(user_id, book_id, started_at DESC);
CREATE INDEX idx_reading_sessions_user_started ON reading_sessions(user_id, started_at);
CREATE INDEX idx_reading_sessions_book_id ON reading_sessions(book_id);
