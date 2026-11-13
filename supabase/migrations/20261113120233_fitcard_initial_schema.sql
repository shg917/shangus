-- FitCard v1. Run once in Supabase SQL Editor on a NEW project.
-- All game mutations are authoritative transactions. No service key in the web.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '나의 FitCard' check (char_length(nickname) between 1 and 20),
  avatar text not null default 'a' check (avatar in ('a','b')),
  created_at timestamptz not null default now()
);
create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body_weight numeric not null check (body_weight between 25 and 300),
  reference_sex text not null check(reference_sex in ('m','f')),
  source text not null default 'self_reported' check(source='self_reported'),
  created_at timestamptz not null default now()
);
create table public.metric_definitions (
  code text primary key, label text not null, unit text not null, axis text not null,
  reference_value numeric not null check(reference_value>0), max_value numeric not null check(max_value>0),
  is_lift boolean not null, rules_version text not null default 'v1'
);
insert into public.metric_definitions(code,label,unit,axis,reference_value,max_value,is_lift) values
 ('ohp','오버헤드 프레스','kg','strength',1.1,250,true),
 ('bench','벤치프레스','kg','strength',1.7,500,true),
 ('squat','스쿼트','kg','strength',2.5,600,true),
 ('dead','데드리프트','kg','strength',2.8,650,true),
 ('pushup','푸시업','회','endurance',60,500,false),
 ('jump','제자리멀리뛰기','cm','agility',280,450,false),
 ('run5k','5km 달리기','초','cardio',1080,10800,false),
 ('plank','플랭크','초','core',240,3600,false);
create table public.measurement_entries (
  measurement_id uuid not null references public.measurements(id) on delete cascade,
  code text not null references public.metric_definitions(code), value numeric not null check(value>0),
  reps integer not null default 1 check(reps between 1 and 12), primary key(measurement_id,code)
);
create table public.cards (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  measurement_id uuid not null unique references public.measurements(id) on delete cascade,
  input jsonb not null, result jsonb not null, rules_version text not null default 'v1',
  created_at timestamptz not null default now()
);
create index cards_user_created on public.cards(user_id,created_at desc);
create index measurements_user_created on public.measurements(user_id,created_at desc);
create table public.players (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  level integer not null default 1 check(level between 1 and 9999),
  boss_hp bigint not null default 6 check(boss_hp>=0), hp bigint not null default 0 check(hp>=0),
  status text not null default 'ready' check(status in ('ready','active','dead','complete')),
  cleared integer not null default 0 check(cleared between 0 and 9999),
  tickets integer not null default 0 check(tickets>=0),
  stats jsonb not null default '{"power":15,"hits":1,"crit":0,"max_hp":180}',
  card_id uuid references public.cards(id), version bigint not null default 0,
  rules_version text not null default 'v1', updated_at timestamptz not null default now()
);
create table private.requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null, action text not null, response jsonb not null,
  created_at timestamptz not null default now(), primary key(user_id,request_id)
);
create table private.daily_plays (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null, created_at timestamptz not null default now(), primary key(user_id,day)
);
create table private.quest_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null, kind text not null check(kind in ('login','workout')),
  created_at timestamptz not null default now(), primary key(user_id,day,kind)
);
create table private.item_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null, reason text not null, request_id uuid not null, created_at timestamptz not null default now()
);
create index ledger_user_created on private.item_ledger(user_id,created_at desc);
create table private.battle_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null, card_id uuid references public.cards(id),
  total_damage bigint not null, effective_damage bigint not null, criticals integer not null,
  from_level integer not null, to_level integer not null, boss_hp bigint not null, player_hp bigint not null,
  rules_version text not null, created_at timestamptz not null default now(), unique(user_id,request_id)
);
create index battle_user_created on private.battle_events(user_id,created_at desc);
create table private.rankings (
  kind text not null check(kind in ('year','month','week')), period_start date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  cleared integer not null, damage bigint not null, achieved_at timestamptz not null default now(),
  rules_version text not null default 'v1', primary key(kind,period_start,user_id)
);
create index ranking_order on private.rankings(kind,period_start,cleared desc,damage desc);
create table public.achievement_definitions (code text primary key,label text not null,required_level integer not null);
insert into public.achievement_definitions values ('first','첫 보스 격파',1),('hundred','백 층 돌파',100),('thousand','천 층의 주인',1000),('summit','9,999층 정복',9999);
create table public.achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null references public.achievement_definitions(code), achieved_at timestamptz not null default now(), primary key(user_id,code)
);

create function private.today() returns date language sql stable set search_path='' as $$ select (now() at time zone 'Asia/Seoul')::date $$;
create function private.period(p_kind text) returns date language plpgsql stable set search_path='' as $$
begin
 if p_kind not in ('year','month','week') or p_kind is null then raise exception '잘못된 랭킹 기간입니다.'; end if;
 return date_trunc(p_kind,now() at time zone 'Asia/Seoul')::date;
end $$;
create function private.hp_at(p_level integer) returns bigint language sql immutable set search_path='' as $$
 select round(6 + p_level*.45 + power(greatest(0,p_level-55)::numeric,1.27)*.075 + power(greatest(0,p_level-450)::numeric,1.6)*.013)::bigint
$$;
create function private.retaliation(p_level integer) returns bigint language sql immutable set search_path='' as $$
 select round(12+4*sqrt(p_level::numeric)+greatest(0,p_level-120)*.16)::bigint
$$;
create function private.ensure_user() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception '로그인이 필요합니다.'; end if;
 insert into public.profiles(id) values(u) on conflict do nothing;
 insert into public.players(user_id,boss_hp) values(u,private.hp_at(1)) on conflict do nothing;
 return u;
end $$;
create function private.cached(u uuid,r uuid,a text) returns jsonb language plpgsql set search_path='' as $$
declare x private.requests;
begin
 if r is null then raise exception '요청 ID가 필요합니다.'; end if;
 select * into x from private.requests where user_id=u and request_id=r;
 if found and x.action<>a then raise exception '다른 요청에 사용된 ID입니다.'; end if;
 return x.response;
end $$;

create function private.calculate(p_input jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare w numeric; sx text; e jsonb; m public.metric_definitions; v numeric; n numeric; score numeric;
 axes jsonb:='{"strength":null,"endurance":null,"agility":null,"cardio":null,"core":null}';
 seen text[]:='{}'; cls text:='unclassified'; best numeric:=-1; a text; k text; s numeric; en numeric; ag numeric; ca numeric;
begin
 w:=(p_input->>'body_weight')::numeric; sx:=p_input->>'reference_sex';
 if w is null or w<25 or w>300 or w::text='NaN' or sx is null or sx not in ('m','f') then raise exception '체중 또는 계산 기준을 확인해 주세요.'; end if;
 if jsonb_typeof(p_input->'entries') is distinct from 'array' then raise exception '종목을 입력해 주세요.'; end if;
 if jsonb_array_length(p_input->'entries') not between 1 and 8 then raise exception '종목을 한 개 이상 입력해 주세요.'; end if;
 for e in select value from jsonb_array_elements(p_input->'entries') loop
   select * into m from public.metric_definitions where code=e->>'code';
   if not found or m.code=any(seen) then raise exception '종목이 올바르지 않거나 중복되었습니다.'; end if;
   seen:=array_append(seen,m.code); v:=(e->>'value')::numeric; n:=coalesce((e->>'reps')::numeric,1);
   if v is null or v<=0 or v>m.max_value or v::text='NaN' or n<1 or n>12 or n<>trunc(n) or n::text='NaN' or (not m.is_lift and n<>1) or (m.code='run5k' and v<600) then raise exception '종목 값 또는 반복 횟수 범위를 확인해 주세요.'; end if;
   if m.is_lift then score:=v*(case when n=1 then 1 else 1+n/30 end)/w/(m.reference_value*(case when sx='f' then .62 else 1 end))*100;
   elsif m.code='jump' then score:=(v-150)/130*100;
   elsif m.code='run5k' then score:=(2100-v)/1020*100;
   else score:=v/m.reference_value*100; end if;
   axes:=jsonb_set(axes,array[m.axis],to_jsonb(greatest(coalesce((axes->>m.axis)::numeric,0),round(greatest(0,least(100,score)),1))));
 end loop;
 foreach k in array array['strength','agility','stamina'] loop
   if k='stamina' then score:=greatest(coalesce((axes->>'endurance')::numeric,-1),coalesce((axes->>'cardio')::numeric,-1)); else score:=(axes->>k)::numeric; end if;
   if score>best then cls:=k; best:=score; end if;
 end loop;
 s:=coalesce((axes->>'strength')::numeric,0); en:=coalesce((axes->>'endurance')::numeric,0); ag:=coalesce((axes->>'agility')::numeric,0); ca:=coalesce((axes->>'cardio')::numeric,0);
 return jsonb_build_object('axes',axes,'class',cls,'version','v1','measured',cardinality(seen),'stats',jsonb_build_object('power',round(15+s*6),'hits',1+floor(998*power(en/100,3)),'crit',round(ag*.5,1),'max_hp',round(180+ca*12)));
end $$;

create function public.get_my_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.ensure_user(); result jsonb;
begin
 select jsonb_build_object(
 'profile',(select to_jsonb(p)-'id' from public.profiles p where id=u),
 'player',(select (to_jsonb(p)-'user_id')||jsonb_build_object('avatar',(select avatar from public.profiles where id=u)) from public.players p where user_id=u),
 'card',(select to_jsonb(c)-'user_id'-'measurement_id' from public.cards c where user_id=u order by created_at desc,id desc limit 1),
 'cards',coalesce((select jsonb_agg(x) from (select c.id,c.input,c.result,c.created_at from public.cards c where c.user_id=u order by c.created_at desc limit 20) x),'[]'::jsonb),
 'daily_available',not exists(select 1 from private.daily_plays where user_id=u and day=private.today()),
 'claimed',coalesce((select jsonb_agg(kind) from private.quest_claims where user_id=u and day=private.today()),'[]'::jsonb),
 'has_workout',exists(select 1 from public.measurements where user_id=u and (created_at at time zone 'Asia/Seoul')::date=private.today()),
 'achievements',coalesce((select jsonb_agg(jsonb_build_object('code',a.code,'label',d.label,'achieved_at',a.achieved_at)) from public.achievements a join public.achievement_definitions d using(code) where a.user_id=u),'[]'::jsonb)
 ) into result;
 return result;
end $$;

create function public.save_measurement(p_input jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.ensure_user(); cached jsonb; result jsonb; mid uuid; cid uuid; response jsonb; e jsonb;
begin
 perform 1 from public.players where user_id=u for update;
 cached:=private.cached(u,p_request_id,'record'); if cached is not null then return cached; end if;
 result:=private.calculate(p_input);
 insert into public.measurements(user_id,body_weight,reference_sex) values(u,(p_input->>'body_weight')::numeric,p_input->>'reference_sex') returning id into mid;
 for e in select value from jsonb_array_elements(p_input->'entries') loop
   insert into public.measurement_entries values(mid,e->>'code',(e->>'value')::numeric,coalesce((e->>'reps')::integer,1));
 end loop;
 insert into public.cards(user_id,measurement_id,input,result) values(u,mid,p_input,result) returning id into cid;
 update public.players set stats=result->'stats',hp=least(hp,(result->'stats'->>'max_hp')::bigint),card_id=cid,version=version+1,updated_at=now() where user_id=u;
 select to_jsonb(c)-'user_id'-'measurement_id' into response from public.cards c where id=cid;
 insert into private.requests values(u,p_request_id,'record',response,now()); return response;
end $$;

create function public.start_play(p_kind text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.ensure_user(); p public.players; cached jsonb; response jsonb;
begin
 select * into p from public.players where user_id=u for update;
 cached:=private.cached(u,p_request_id,'start'); if cached is not null then return cached; end if;
 if p.status in ('active','complete') then raise exception '이미 플레이 중이거나 탑을 완료했습니다.'; end if;
 if p.card_id is null then raise exception '운동 기록을 먼저 저장해 주세요.'; end if;
 if p_kind='daily' then
   if exists(select 1 from private.daily_plays where user_id=u and day=private.today()) then raise exception '오늘 기본 플레이를 이미 사용했습니다.'; end if;
   insert into private.daily_plays(user_id,day) values(u,private.today());
 elsif p_kind='ticket' then
   if p.tickets<1 then raise exception '부활권이 부족합니다.'; end if;
   update public.players set tickets=tickets-1 where user_id=u;
   insert into private.item_ledger(user_id,delta,reason,request_id) values(u,-1,'revive',p_request_id);
 else raise exception '잘못된 플레이 요청입니다.'; end if;
 update public.players set status='active',hp=(stats->>'max_hp')::bigint,version=version+1,updated_at=now() where user_id=u returning to_jsonb(players)-'user_id' into response;
 insert into private.requests values(u,p_request_id,'start',response,now()); return response;
end $$;

create function public.claim_quest(p_kind text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.ensure_user(); cached jsonb; response jsonb;
begin
 perform 1 from public.players where user_id=u for update;
 cached:=private.cached(u,p_request_id,'claim'); if cached is not null then return cached; end if;
 if p_kind is null or p_kind not in ('login','workout') then raise exception '잘못된 퀘스트입니다.'; end if;
 if exists(select 1 from private.quest_claims where user_id=u and day=private.today() and kind=p_kind) then raise exception '이미 받은 보상입니다.'; end if;
 if p_kind='workout' and not exists(select 1 from public.measurements where user_id=u and (created_at at time zone 'Asia/Seoul')::date=private.today()) then raise exception '오늘 운동 기록을 먼저 저장해 주세요.'; end if;
 insert into private.quest_claims(user_id,day,kind) values(u,private.today(),p_kind);
 insert into private.item_ledger(user_id,delta,reason,request_id) values(u,1,p_kind,p_request_id);
 update public.players set tickets=tickets+1 where user_id=u returning jsonb_build_object('tickets',tickets) into response;
 insert into private.requests values(u,p_request_id,'claim',response,now()); return response;
end $$;

create function public.attack_boss(p_request_id uuid,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.ensure_user(); p public.players; cached jsonb; response jsonb; total bigint; remaining bigint;
 effective bigint; crits integer:=0; kills integer:=0; counter bigint; i integer; old_level integer; damage bigint; k text;
begin
 select * into p from public.players where user_id=u for update;
 cached:=private.cached(u,p_request_id,'attack'); if cached is not null then return cached; end if;
 if p_expected_version is distinct from p.version then raise exception '다른 화면에서 상태가 변경되었습니다. 새로고침 후 다시 시도해 주세요.'; end if;
 if p.status<>'active' or p.hp<=0 then raise exception '플레이를 시작하거나 부활해 주세요.'; end if;
 -- Technical burst protection, not a daily attack allowance.
 if exists(select 1 from private.battle_events where user_id=u and created_at>clock_timestamp()-interval '750 milliseconds') then raise exception '공격 처리 중입니다. 잠시 후 다시 시도해 주세요.'; end if;
 old_level:=p.level;
 for i in 1..(p.stats->>'hits')::integer loop
   if random()*100<(p.stats->>'crit')::numeric then crits:=crits+1; end if;
 end loop;
 total:=((p.stats->>'hits')::integer-crits)*(p.stats->>'power')::bigint+crits*round((p.stats->>'power')::numeric*1.5)::bigint;
 remaining:=total;
 loop
   exit when remaining<p.boss_hp;
   remaining:=remaining-p.boss_hp; kills:=kills+1; p.cleared:=p.level;
   if p.level=9999 then p.boss_hp:=0; p.status:='complete'; exit; end if;
   p.level:=p.level+1; p.boss_hp:=private.hp_at(p.level);
 end loop;
 effective:=total;
 if p.status='complete' then effective:=total-remaining; counter:=0;
 else p.boss_hp:=p.boss_hp-remaining; counter:=private.retaliation(p.level); end if;
 p.hp:=greatest(0,p.hp-counter);
 if p.hp=0 and p.status<>'complete' then p.status:='dead'; end if;
 update public.players set level=p.level,boss_hp=p.boss_hp,hp=p.hp,status=p.status,cleared=p.cleared,version=version+1,updated_at=now() where user_id=u;
 insert into private.battle_events(user_id,request_id,card_id,total_damage,effective_damage,criticals,from_level,to_level,boss_hp,player_hp,rules_version)
 values(u,p_request_id,p.card_id,total,effective,crits,old_level,p.level,p.boss_hp,p.hp,p.rules_version);
 damage:=case when p.status='complete' then 0 else private.hp_at(p.level)-p.boss_hp end;
 foreach k in array array['year','month','week'] loop
   insert into private.rankings(kind,period_start,user_id,cleared,damage) values(k,private.period(k),u,p.cleared,damage)
   on conflict(kind,period_start,user_id) do update set cleared=excluded.cleared,damage=excluded.damage,achieved_at=excluded.achieved_at
   where (excluded.cleared,excluded.damage)>(rankings.cleared,rankings.damage);
 end loop;
 insert into public.achievements(user_id,code) select u,code from public.achievement_definitions where required_level<=p.cleared on conflict do nothing;
 select jsonb_build_object('player',to_jsonb(x)-'user_id','total',total,'effective',effective,'criticals',crits,'kills',kills,'counter',counter) into response from public.players x where user_id=u;
 insert into private.requests values(u,p_request_id,'attack',response,now()); return response;
end $$;

create function public.set_profile(p_nickname text,p_avatar text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.ensure_user();
begin
 if p_nickname is null or char_length(trim(p_nickname)) not between 1 and 20 or p_avatar is null or p_avatar not in ('a','b') then raise exception '닉네임 또는 아바타를 확인해 주세요.'; end if;
 update public.profiles set nickname=trim(p_nickname),avatar=p_avatar where id=u;
end $$;

create function public.get_rankings(p_kind text,p_limit integer default 100) returns jsonb language plpgsql security definer set search_path='' as $$
declare start_date date:=private.period(p_kind); result jsonb;
begin
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
  select dense_rank() over(order by r.cleared desc,r.damage desc) as rank,p.nickname,p.avatar,r.cleared,r.damage,r.achieved_at,
    r.user_id=auth.uid() as is_me
  from private.rankings r join public.profiles p on p.id=r.user_id
  where r.kind=p_kind and r.period_start=start_date and r.rules_version='v1'
  order by r.cleared desc,r.damage desc,r.achieved_at,r.user_id limit greatest(1,least(coalesce(p_limit,100),100))
 ) x;
 return result;
end $$;

-- RLS plus grants. Clients cannot update even their own combat balances.
alter table public.profiles enable row level security;
alter table public.measurements enable row level security;
alter table public.measurement_entries enable row level security;
alter table public.metric_definitions enable row level security;
alter table public.cards enable row level security;
alter table public.players enable row level security;
alter table public.achievement_definitions enable row level security;
alter table public.achievements enable row level security;
revoke all on public.profiles,public.measurements,public.measurement_entries,public.metric_definitions,public.cards,public.players,public.achievement_definitions,public.achievements from anon,authenticated;
grant select on public.profiles,public.measurements,public.measurement_entries,public.cards,public.players,public.achievements to authenticated;
grant select on public.metric_definitions,public.achievement_definitions to anon,authenticated;
create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy own_measurements on public.measurements for select to authenticated using(user_id=(select auth.uid()));
create policy own_entries on public.measurement_entries for select to authenticated using(exists(select 1 from public.measurements m where m.id=measurement_id and m.user_id=(select auth.uid())));
create policy own_cards on public.cards for select to authenticated using(user_id=(select auth.uid()));
create policy own_player on public.players for select to authenticated using(user_id=(select auth.uid()));
create policy own_achievements on public.achievements for select to authenticated using(user_id=(select auth.uid()));
create policy public_metrics on public.metric_definitions for select to anon,authenticated using(true);
create policy public_achievement_definitions on public.achievement_definitions for select to anon,authenticated using(true);
revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.get_my_state(),public.save_measurement(jsonb,uuid),public.start_play(text,uuid),public.claim_quest(text,uuid),public.attack_boss(uuid,bigint),public.set_profile(text,text),public.get_rankings(text,integer) from public,anon,authenticated;
grant execute on function public.get_my_state(),public.save_measurement(jsonb,uuid),public.start_play(text,uuid),public.claim_quest(text,uuid),public.attack_boss(uuid,bigint),public.set_profile(text,text) to authenticated;
grant execute on function public.get_rankings(text,integer) to anon,authenticated;
commit;
