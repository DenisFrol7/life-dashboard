alter table content_items
    add column background_url text,
    add column steamgriddb_game_id bigint,
    add column steamgriddb_grid_id bigint;

update content_items
set background_url = cover_url,
    cover_url = null
where item_type = 'GAME'
  and rawg_id is not null
  and background_url is null;

