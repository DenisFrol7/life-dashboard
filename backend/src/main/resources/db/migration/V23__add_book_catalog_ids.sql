ALTER TABLE books ADD COLUMN google_books_id VARCHAR(100);
ALTER TABLE books ADD COLUMN isbn VARCHAR(20);
CREATE UNIQUE INDEX ux_books_google_books_id ON books (google_books_id) WHERE google_books_id IS NOT NULL;
CREATE INDEX ix_books_isbn ON books (isbn) WHERE isbn IS NOT NULL;
