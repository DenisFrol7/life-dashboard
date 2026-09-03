alter table user_game_library
    add column steam_app_id bigint;

create index ix_user_game_library_steam_app_id
    on user_game_library (steam_app_id)
    where steam_app_id is not null;
