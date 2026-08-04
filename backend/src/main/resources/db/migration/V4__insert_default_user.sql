INSERT INTO users (id, username, display_name, email, timezone)
VALUES (1, 'owner', 'Life Dashboard Owner', NULL, 'Europe/Moscow');

SELECT setval(
    pg_get_serial_sequence('users', 'id'),
    (SELECT MAX(id) FROM users)
);
