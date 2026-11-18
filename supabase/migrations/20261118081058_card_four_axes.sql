-- Four-axis game calibration v2. Prior cards and battle snapshots remain versioned.
begin;
alter table public.metric_definitions
  add column min_value numeric not null default 1,
  add column zero_value numeric not null default 0,
  add column is_active boolean not null default true;
update public.metric_definitions set is_active=false where code='plank';
insert into public.metric_definitions(code,label,unit,axis,reference_value,max_value,is_lift,rules_version,min_value,zero_value,is_active)
 values('ohp','O.H.P · 오버헤드 프레스','kg','strength',1.1,250,true,'v2',0.5,0,true)
 on conflict(code) do update set label=excluded.label,reference_value=excluded.reference_value,max_value=excluded.max_value,
 is_lift=excluded.is_lift,rules_version='v2',min_value=excluded.min_value,zero_value=excluded.zero_value,is_active=true;
insert into public.metric_definitions(code,label,unit,axis,reference_value,max_value,is_lift,rules_version,min_value,zero_value,is_active)
 values('bench','B.P · 벤치프레스','kg','strength',1.7,500,true,'v2',0.5,0,true)
 on conflict(code) do update set label=excluded.label,reference_value=excluded.reference_value,max_value=excluded.max_value,
 is_lift=excluded.is_lift,rules_version='v2',min_value=excluded.min_value,zero_value=excluded.zero_value,is_active=true;
insert into public.metric_definitions(code,label,unit,axis,reference_value,max_value,is_lift,rules_version,min_value,zero_value,is_active)
 values('dead','D.L · 데드리프트','kg','strength',2.8,650,true,'v2',0.5,0,true)
 on conflict(code) do update set label=excluded.label,reference_value=excluded.reference_value,max_value=excluded.max_value,
 is_lift=excluded.is_lift,rules_version='v2',min_value=excluded.min_value,zero_value=excluded.zero_value,is_active=true;
insert into public.metric_definitions(code,label,unit,axis,reference_value,max_value,is_lift,rules_version,min_value,zero_value,is_active)
 values('squat','SQ · 스쿼트','kg','strength',2.5,600,true,'v2',0.5,0,true)
 on conflict(code) do update set label=excluded.label,reference_value=excluded.reference_value,max_value=excluded.max_value,
 is_lift=excluded.is_lift,rules_version='v2',min_value=excluded.min_value,zero_value=excluded.zero_value,is_active=true;
insert into public.metric_definitions(code,label,unit,axis,reference_value,max_value,is_lift,rules_version,min_value,zero_value,is_active)
 values('pushup','푸시업','회','endurance',60,500,false,'v2',1,0,true)
 on conflict(code) do update set label=excluded.label,reference_value=excluded.reference_value,max_value=excluded.max_value,
 is_lift=excluded.is_lift,rules_version='v2',min_value=excluded.min_value,zero_value=excluded.zero_value,is_active=true;
insert into public.metric_definitions(code,label,unit,axis,reference_value,max_value,is_lift,rules_version,min_value,zero_value,is_active)
 values('pullup','풀업','회','endurance',20,200,false,'v2',1,0,true)
 on conflict(code) do update set label=excluded.label,reference_value=excluded.reference_value,max_value=excluded.max_value,
 is_lift=excluded.is_lift,rules_version='v2',min_value=excluded.min_value,zero_value=excluded.zero_value,is_active=true;
insert into public.metric_definitions(code,label,unit,axis,reference_value,max_value,is_lift,rules_version,min_value,zero_value,is_active)
 values('situp','싯업','회','endurance',60,150,false,'v2',1,0,true)
 on conflict(code) do update set label=excluded.label,reference_value=excluded.reference_value,max_value=excluded.max_value,
 is_lift=excluded.is_lift,rules_version='v2',min_value=excluded.min_value,zero_value=excluded.zero_value,is_active=true;
insert into public.metric_definitions(code,label,unit,axis,reference_value,max_value,is_lift,rules_version,min_value,zero_value,is_active)
 values('jump','제자리 멀리뛰기','cm','agility',280,450,false,'v2',1,150,true)
 on conflict(code) do update set label=excluded.label,reference_value=excluded.reference_value,max_value=excluded.max_value,
 is_lift=excluded.is_lift,rules_version='v2',min_value=excluded.min_value,zero_value=excluded.zero_value,is_active=true;
insert into public.metric_definitions(code,label,unit,axis,reference_value,max_value,is_lift,rules_version,min_value,zero_value,is_active)
 values('vertical','서전트 점프','cm','agility',75,180,false,'v2',1,20,true)
 on conflict(code) do update set label=excluded.label,reference_value=excluded.reference_value,max_value=excluded.max_value,
 is_lift=excluded.is_lift,rules_version='v2',min_value=excluded.min_value,zero_value=excluded.zero_value,is_active=true;
insert into public.metric_definitions(code,label,unit,axis,reference_value,max_value,is_lift,rules_version,min_value,zero_value,is_active)
 values('run3k','3KM','초','cardio',600,7200,false,'v2',360,1260,true)
 on conflict(code) do update set label=excluded.label,reference_value=excluded.reference_value,max_value=excluded.max_value,
 is_lift=excluded.is_lift,rules_version='v2',min_value=excluded.min_value,zero_value=excluded.zero_value,is_active=true;
insert into public.metric_definitions(code,label,unit,axis,reference_value,max_value,is_lift,rules_version,min_value,zero_value,is_active)
 values('run5k','5KM','초','cardio',1080,10800,false,'v2',600,2100,true)
 on conflict(code) do update set label=excluded.label,reference_value=excluded.reference_value,max_value=excluded.max_value,
 is_lift=excluded.is_lift,rules_version='v2',min_value=excluded.min_value,zero_value=excluded.zero_value,is_active=true;
insert into public.metric_definitions(code,label,unit,axis,reference_value,max_value,is_lift,rules_version,min_value,zero_value,is_active)
 values('run10k','10KM','초','cardio',2280,21600,false,'v2',1200,4800,true)
 on conflict(code) do update set label=excluded.label,reference_value=excluded.reference_value,max_value=excluded.max_value,
 is_lift=excluded.is_lift,rules_version='v2',min_value=excluded.min_value,zero_value=excluded.zero_value,is_active=true;
insert into public.metric_definitions(code,label,unit,axis,reference_value,max_value,is_lift,rules_version,min_value,zero_value,is_active)
 values('half','하프 마라톤','초','cardio',5400,43200,false,'v2',2700,10800,true)
 on conflict(code) do update set label=excluded.label,reference_value=excluded.reference_value,max_value=excluded.max_value,
 is_lift=excluded.is_lift,rules_version='v2',min_value=excluded.min_value,zero_value=excluded.zero_value,is_active=true;
insert into public.metric_definitions(code,label,unit,axis,reference_value,max_value,is_lift,rules_version,min_value,zero_value,is_active)
 values('full','풀 마라톤','초','cardio',11400,86400,false,'v2',6000,21600,true)
 on conflict(code) do update set label=excluded.label,reference_value=excluded.reference_value,max_value=excluded.max_value,
 is_lift=excluded.is_lift,rules_version='v2',min_value=excluded.min_value,zero_value=excluded.zero_value,is_active=true;
create or replace function private.calculate(p_input jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare w numeric; sx text; e jsonb; m public.metric_definitions; v numeric; n numeric; score numeric; entry_scores jsonb:='{}';
 axes jsonb:='{"strength":null,"endurance":null,"agility":null,"cardio":null}';
 seen text[]:='{}'; cls text:='unclassified'; best numeric:=-1; a text; k text; s numeric; en numeric; ag numeric; ca numeric;
begin
 w:=(p_input->>'body_weight')::numeric; sx:=p_input->>'reference_sex';
 if w is null or w<25 or w>300 or w::text='NaN' or sx is null or sx not in ('m','f') then raise exception '체중 또는 계산 기준을 확인해 주세요.'; end if;
 if jsonb_typeof(p_input->'entries') is distinct from 'array' then raise exception '종목을 입력해 주세요.'; end if;
 if jsonb_array_length(p_input->'entries') not between 1 and 14 then raise exception '종목을 한 개 이상 입력해 주세요.'; end if;
 for e in select value from jsonb_array_elements(p_input->'entries') loop
   select * into m from public.metric_definitions where code=e->>'code';
   if not found or not m.is_active or m.code=any(seen) then raise exception '종목이 올바르지 않거나 중복되었습니다.'; end if;
   seen:=array_append(seen,m.code); v:=(e->>'value')::numeric; n:=coalesce((e->>'reps')::numeric,1);
   if v is null or v<m.min_value or v>m.max_value or (not m.is_lift and v<>trunc(v)) or v::text='NaN' or n<1 or n>12 or n<>trunc(n) or n::text='NaN' or (not m.is_lift and n<>1) then raise exception '종목 값 또는 반복 횟수 범위를 확인해 주세요.'; end if;
   if m.is_lift then score:=v*(case when n=1 then 1 else 1+n/30 end)/w/(m.reference_value*(case when sx='f' then .62 else 1 end))*100;
   elsif m.axis='cardio' then score:=(m.zero_value-v)/(m.zero_value-m.reference_value)*100;
   
   else score:=(v-m.zero_value)/(m.reference_value-m.zero_value)*100; end if;
   score:=round(greatest(0,least(100,score)),1);
   entry_scores:=jsonb_set(entry_scores,array[m.code],to_jsonb(score));
   axes:=jsonb_set(axes,array[m.axis],to_jsonb(greatest(coalesce((axes->>m.axis)::numeric,0),round(greatest(0,least(100,score)),1))));
 end loop;
 foreach k in array array['strength','agility','stamina'] loop
   if k='stamina' then score:=greatest(coalesce((axes->>'endurance')::numeric,-1),coalesce((axes->>'cardio')::numeric,-1)); else score:=(axes->>k)::numeric; end if;
   if score>best then cls:=k; best:=score; end if;
 end loop;
 s:=coalesce((axes->>'strength')::numeric,0); en:=coalesce((axes->>'endurance')::numeric,0); ag:=coalesce((axes->>'agility')::numeric,0); ca:=coalesce((axes->>'cardio')::numeric,0);
 return jsonb_build_object('axes',axes,'entry_scores',entry_scores,'class',cls,'version','v2','measured',cardinality(seen),'stats',jsonb_build_object('power',round(15+s*6),'hits',1+floor(998*power(en/100,3)),'crit',round(ag*.5,1),'max_hp',round(180+ca*12)));
end $$;


alter table public.cards alter column rules_version set default 'v2';
create or replace function public.save_measurement(p_input jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 update public.players set stats=result->'stats',rules_version=result->>'version',hp=least(hp,(result->'stats'->>'max_hp')::bigint),card_id=cid,version=version+1,updated_at=now() where user_id=u;
 select to_jsonb(c)-'user_id'-'measurement_id' into response from public.cards c where id=cid;
 insert into private.requests values(u,p_request_id,'record',response,now()); return response;
end $$;


revoke all on function private.calculate(jsonb) from public,anon,authenticated;
commit;
