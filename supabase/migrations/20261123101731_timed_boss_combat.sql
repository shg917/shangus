-- Independent timed boss progression preserves all legacy tower/card/quest data.
begin;
create table private.click_players (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  level integer not null default 1 check(level between 1 and 10),
  cleared integer not null default 0 check(cleared between 0 and 10),
  boss_hp bigint not null default 100000 check(boss_hp >= 0),
  hp bigint not null default 0 check(hp >= 0),
  status text not null default 'ready' check(status in ('ready','active','dead','complete')),
  version bigint not null default 0,
  run_id uuid,
  started_at bigint not null default 0,
  ends_at bigint not null default 0,
  counter_at bigint not null default 0,
  click_count integer not null default 0 check(click_count between 0 and 1800),
  end_reason text
);
create table private.click_rankings (
  kind text not null check(kind in ('year','month','week')),
  period_start date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  cleared integer not null, damage bigint not null,
  achieved_at timestamptz not null default now(),
  primary key(kind,period_start,user_id)
);
create index click_rank_order on private.click_rankings(kind,period_start,cleared desc,damage desc);
create index click_rank_user on private.click_rankings(user_id);
alter table private.click_players enable row level security;
alter table private.click_rankings enable row level security;
revoke all on private.click_players,private.click_rankings from public,anon,authenticated;

-- Save the HP cap in the same transaction as the new card, including back-to-back saves.
create function private.click_apply_card_stats() returns trigger
language plpgsql set search_path='' as $$
begin
  update private.click_players
     set hp=least(hp,(new.stats->>'max_hp')::bigint), version=version+1
   where user_id=new.user_id;
  return new;
end $$;
revoke all on function private.click_apply_card_stats() from public,anon,authenticated;
create trigger click_apply_card_stats after update of stats on public.players
  for each row when (old.stats is distinct from new.stats)
  execute function private.click_apply_card_stats();

create function private.click_now() returns bigint language sql volatile set search_path='' as $$
  select floor(extract(epoch from clock_timestamp())*1000)::bigint
$$;
create function private.click_hp(n integer) returns bigint language sql immutable set search_path='' as $$
  select (array[100000,400000,1200000,3000000,8000000,20000000,50000000,125000000,300000000,750000000]::bigint[])[greatest(1,least(10,n))]
$$;
create function private.click_prepare() returns uuid language plpgsql set search_path='' as $$
declare u uuid:=private.ensure_user(); p private.click_players; t bigint:=private.click_now(); ticks integer; mx bigint;
begin
  perform 1 from public.players where user_id=u for update;
  insert into private.click_players(user_id) values(u) on conflict do nothing;
  select * into p from private.click_players where user_id=u for update;
  if p.status='active' then
    ticks:=greatest(0,floor((least(t,p.ends_at)-p.counter_at)/2000.0)::integer);
    if ticks>0 then
      p.hp:=greatest(0,p.hp-ticks*(12+p.level*4));
      p.counter_at:=p.counter_at+ticks*2000;
      p.version:=p.version+1;
    end if;
    if p.hp=0 or t>=p.ends_at then
      p.status:='dead';
      p.end_reason:=case when p.hp=0 then 'hp' else 'timeout' end;
      p.version:=p.version+1;
    end if;
  end if;
  select (stats->>'max_hp')::bigint into mx from public.players where user_id=u;
  p.hp:=least(p.hp,mx);
  update private.click_players set hp=p.hp,status=p.status,counter_at=p.counter_at,version=p.version,end_reason=p.end_reason where user_id=u;
  return u;
end $$;

create function public.get_click_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.click_prepare(); base jsonb; player jsonb; cleared integer;
begin
  base:=public.get_my_state();
  select (to_jsonb(c)-'user_id')||jsonb_build_object('stats',p.stats,'tickets',p.tickets,'avatar',base->'profile'->>'avatar'),
    c.cleared into player,cleared
  from private.click_players c join public.players p using(user_id) where c.user_id=u;
  return base||jsonb_build_object('player',player,'server_now',private.click_now(),'achievements',
    case when cleared=10 then '[{"label":"첫 보스 격파"},{"label":"10명 전원 격파"}]'::jsonb
    when cleared>0 then '[{"label":"첫 보스 격파"}]'::jsonb else '[]'::jsonb end);
end $$;

create function public.start_click_play(p_kind text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.click_prepare(); p private.click_players; cached jsonb; response jsonb; t bigint:=private.click_now(); balance integer; mx bigint;
begin
  cached:=private.cached(u,p_request_id,'click_start'); if cached is not null then return cached; end if;
  select * into p from private.click_players where user_id=u;
  if p.status in ('active','complete') then raise exception '이미 도전 중이거나 보스를 모두 처치했습니다.'; end if;
  if not exists(select 1 from public.players where user_id=u and card_id is not null) then raise exception '운동 기록을 먼저 저장해 주세요.'; end if;
  if p_kind='daily' then
    if exists(select 1 from private.daily_plays where user_id=u and day=private.today()) then raise exception '오늘 기본 플레이를 이미 사용했습니다.'; end if;
    insert into private.daily_plays(user_id,day) values(u,private.today());
  elsif p_kind='ticket' then
    select tickets into balance from public.players where user_id=u;
    if balance<1 then raise exception '부활권이 부족합니다.'; end if;
    update public.players set tickets=tickets-1 where user_id=u;
    insert into private.item_ledger(user_id,delta,reason,request_id) values(u,-1,'revive',p_request_id);
  else raise exception '잘못된 플레이 요청입니다.'; end if;
  select (stats->>'max_hp')::bigint into mx from public.players where user_id=u;
  update private.click_players set hp=mx,status='active',run_id=gen_random_uuid(),started_at=t,ends_at=t+60000,
    counter_at=t,click_count=0,end_reason=null,version=version+1 where user_id=u returning to_jsonb(click_players)-'user_id' into response;
  insert into private.requests values(u,p_request_id,'click_start',response,now());
  return response;
end $$;

create function public.click_boss(p_request_id uuid,p_run_id uuid,p_total_clicks integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.click_prepare(); p private.click_players; stats jsonb; cached jsonb; response jsonb; t bigint:=private.click_now();
  delta integer; hit integer; crits integer:=0; total bigint:=0; remaining bigint; effective bigint:=0; kills integer:=0; damage bigint; rank_kind text;
begin
  cached:=private.cached(u,p_request_id,'click_attack'); if cached is not null then return cached; end if;
  select * into p from private.click_players where user_id=u;
  if p_run_id is null or p_run_id is distinct from p.run_id then raise exception '종료되었거나 다른 도전의 요청입니다.'; end if;
  if p_total_clicks is null or p_total_clicks<0 or p_total_clicks>1800 then raise exception '잘못된 클릭 수입니다.'; end if;
  delta:=p_total_clicks-p.click_count;
  select x.stats into stats from public.players x where user_id=u;
  if delta>0 and p.status='active' then
    if p_total_clicks>((greatest(0,t-p.started_at)/1000.0)+1)*30 then raise exception '허용 범위를 초과한 클릭 요청입니다.'; end if;
    for hit in 1..(delta*(stats->>'hits')::integer) loop
      if random()*100<(stats->>'crit')::numeric then crits:=crits+1; end if;
    end loop;
    total:=(delta*(stats->>'hits')::integer-crits)*(stats->>'power')::bigint+crits*round((stats->>'power')::numeric*1.5)::bigint;
    remaining:=total;
    loop
      exit when remaining<p.boss_hp;
      remaining:=remaining-p.boss_hp; kills:=kills+1; p.cleared:=p.level;
      if p.level=10 then p.boss_hp:=0; p.status:='complete'; p.end_reason:='complete'; exit; end if;
      p.level:=p.level+1; p.boss_hp:=private.click_hp(p.level);
    end loop;
    effective:=case when p.status='complete' then total-remaining else total end;
    if p.status<>'complete' then p.boss_hp:=p.boss_hp-remaining; end if;
    p.click_count:=p_total_clicks; p.version:=p.version+1;
    update private.click_players set level=p.level,cleared=p.cleared,boss_hp=p.boss_hp,status=p.status,click_count=p.click_count,
      version=p.version,end_reason=p.end_reason where user_id=u;
    damage:=case when p.status='complete' then 0 else private.click_hp(p.level)-p.boss_hp end;
    foreach rank_kind in array array['year','month','week'] loop
      insert into private.click_rankings(kind,period_start,user_id,cleared,damage)
      values(rank_kind,private.period(rank_kind),u,p.cleared,damage)
      on conflict(kind,period_start,user_id) do update set cleared=excluded.cleared,damage=excluded.damage,achieved_at=excluded.achieved_at
      where (excluded.cleared,excluded.damage)>(click_rankings.cleared,click_rankings.damage);
    end loop;
  end if;
  response:=jsonb_build_object('player',public.get_click_state()->'player','total',total,'effective',effective,'criticals',crits,'kills',kills,'counter',0);
  insert into private.requests values(u,p_request_id,'click_attack',response,now());
  return response;
end $$;

create function public.get_click_rankings(p_kind text,p_limit integer default 100) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare start_date date:=private.period(p_kind); result jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
    select dense_rank() over(order by r.cleared desc,r.damage desc) as rank,p.nickname,p.avatar,r.cleared,r.damage,r.achieved_at,r.user_id=auth.uid() as is_me
    from private.click_rankings r join public.profiles p on p.id=r.user_id
    where r.kind=p_kind and r.period_start=start_date
    order by r.cleared desc,r.damage desc,r.achieved_at,r.user_id limit greatest(1,least(coalesce(p_limit,100),100))
  ) x;
  return result;
end $$;

revoke all on function private.click_now(),private.click_hp(integer),private.click_prepare() from public,anon,authenticated;
revoke all on function public.get_click_state(),public.start_click_play(text,uuid),public.click_boss(uuid,uuid,integer),public.get_click_rankings(text,integer) from public,anon,authenticated;
grant execute on function public.get_click_state(),public.start_click_play(text,uuid),public.click_boss(uuid,uuid,integer) to authenticated;
grant execute on function public.get_click_rankings(text,integer) to anon,authenticated;
commit;
