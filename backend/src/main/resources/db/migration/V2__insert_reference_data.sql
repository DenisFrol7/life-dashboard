INSERT INTO gaming_platforms (code, name) VALUES
    ('PC', 'PC'),
    ('ORIGINAL_XBOX', 'Original Xbox'),
    ('XBOX_360', 'Xbox 360'),
    ('XBOX_ONE', 'Xbox One'),
    ('XBOX_SERIES', 'Xbox Series X|S');

INSERT INTO game_sources (code, name, source_type) VALUES
    ('STEAM', 'Steam', 'DIGITAL_STORE'),
    ('EPIC_GAMES_STORE', 'Epic Games Store', 'DIGITAL_STORE'),
    ('EA_APP', 'EA App', 'DIGITAL_STORE'),
    ('UBISOFT_CONNECT', 'Ubisoft Connect', 'DIGITAL_STORE'),
    ('BATTLE_NET', 'Battle.net', 'DIGITAL_STORE'),
    ('XBOX_STORE', 'Xbox Store', 'DIGITAL_STORE'),
    ('DISC', 'Disc', 'PHYSICAL'),
    ('GAME_PASS', 'Game Pass', 'SUBSCRIPTION');
