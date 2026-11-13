-- Add covering indexes identified by the hosted project's performance advisor.
begin;
create index if not exists battle_events_card_id_idx on private.battle_events(card_id);
create index if not exists rankings_user_id_idx on private.rankings(user_id);
create index if not exists achievements_code_idx on public.achievements(code);
create index if not exists measurement_entries_code_idx on public.measurement_entries(code);
create index if not exists players_card_id_idx on public.players(card_id);
commit;
