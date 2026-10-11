-- Disposable local database only. Trusted clock helpers and all fixtures roll back.
begin;
insert into auth.users (id) values
  ('8a576e05-ad16-47bd-83dc-090521eb9aa1'), ('8a576e05-ad16-47bd-83dc-090521eb9bb2');
insert into public.growth_policies (app_id) values ('production-disabled');
insert into public.growth_policies (app_id, enabled) values ('fixture-other-app', true);

create function pg_temp.assert_true(result boolean, label text) returns void language plpgsql as $$
begin if result is not true then raise exception 'FAILED: %', label; end if; end;
$$;
create function pg_temp.expect_error(statement text, expected_state text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then if sqlstate = expected_state then return; end if; raise; end;
  raise exception 'FAILED: expected SQLSTATE % for %', expected_state, statement;
end;
$$;
create function pg_temp.age_round(ticket uuid, age interval) returns void
language sql security definer as $$
  update public.growth_rounds set started_at = pg_catalog.clock_timestamp() - age where round_id = ticket
$$;
create function pg_temp.win_rounds(amount integer) returns void language plpgsql as $$
declare ticket uuid;
begin
  for n in 1..amount loop
    ticket := (public.growth_begin_round('halfsword-codex-growth-trial', pg_catalog.gen_random_uuid()) ->> 'round_id')::uuid;
    perform pg_temp.age_round(ticket, interval '4 seconds');
    perform public.growth_finish_round('halfsword-codex-growth-trial', ticket, true);
  end loop;
end;
$$;

select pg_temp.assert_true(not enabled, 'new economies disabled by default') from public.growth_policies where app_id = 'production-disabled';
select pg_temp.assert_true(
  not has_table_privilege('authenticated', t, 'INSERT') and not has_table_privilege('authenticated', t, 'UPDATE')
  and not has_table_privilege('authenticated', t, 'DELETE') and not has_table_privilege('authenticated', t, 'TRUNCATE')
  and not has_table_privilege('anon', t, 'SELECT'), 'all client writes and anon reads forbidden: ' || t)
from unnest(array['public.growth_policies','public.growth_catalog','public.growth_players','public.growth_rounds','public.growth_requests']) t;
select pg_temp.assert_true(
  prosecdef and proconfig @> array['search_path=""'], 'secured function: ' || proname)
from pg_proc where pronamespace = 'public'::regnamespace and proname like 'growth_%';
select pg_temp.assert_true(not has_function_privilege('authenticated', f, 'EXECUTE'), 'private helper: ' || f)
from unnest(array['public.growth_require(text)','public.growth_lock_player(text)','public.growth_change(text,uuid,text,jsonb)']) f;

set local role authenticated;
select set_config('request.jwt.claim.sub', '8a576e05-ad16-47bd-83dc-090521eb9aa1', true);
select pg_temp.assert_true(public.growth_snapshot('halfsword-codex-growth-trial') =
  '{"wins":0,"coins":0,"points":0,"characters":{"player":{"strength":0}},"inventory":[],"equipped":null,"revision":0,"rules":{"winCoins":10,"milestone":3,"pointsPerMilestone":1,"strengthStep":0.02,"strengthCap":5},"catalog":[{"id":"wayfarer_seal","name":"여행자의 인장","price":30}]}'::jsonb,
  'exact initial public contract and temporary trial rules');
select pg_temp.assert_true((select count(*) = 0 from public.growth_players), 'snapshot does not create state');
select pg_temp.expect_error($q$select public.growth_snapshot('production-disabled')$q$, 'PT403');
select pg_temp.expect_error($q$select public.growth_snapshot('halfsword-codex')$q$, 'PT403');
select pg_temp.expect_error($q$select public.growth_snapshot('../invalid')$q$, 'PT400');
select pg_temp.expect_error($q$select public.growth_snapshot(null)$q$, 'PT400');
select pg_temp.expect_error($q$select public.growth_begin_round('halfsword-codex-growth-trial',null)$q$, 'PT400');
select pg_temp.expect_error($q$select public.growth_purchase('halfsword-codex-growth-trial','10000000-0000-0000-0000-000000000030','wayfarer_seal')$q$, 'PT409');
select pg_temp.assert_true((select count(*) = 0 from public.growth_players), 'failed affordability rolls back initial state too');
select pg_temp.expect_error($q$update public.growth_policies set win_coins = 999$q$, '42501');
select pg_temp.expect_error($q$update public.growth_catalog set price = 0$q$, '42501');
select pg_temp.expect_error($q$insert into public.growth_players(app_id,user_id,coins) values('halfsword-codex-growth-trial','8a576e05-ad16-47bd-83dc-090521eb9aa1',999)$q$, '42501');
select pg_temp.expect_error($q$select public.growth_change('halfsword-codex-growth-trial','10000000-0000-0000-0000-000000000001','begin','{}')$q$, '42501');

select set_config('test.round', public.growth_begin_round('halfsword-codex-growth-trial','10000000-0000-0000-0000-000000000001')->>'round_id',true);
select pg_temp.assert_true(public.growth_begin_round('halfsword-codex-growth-trial','10000000-0000-0000-0000-000000000001')->>'round_id' = current_setting('test.round'), 'begin retry returns same ticket');
select pg_temp.assert_true((select count(*) = 1 from public.growth_rounds), 'begin retry creates no extra round');
select pg_temp.expect_error($q$select public.growth_equip('halfsword-codex-growth-trial','10000000-0000-0000-0000-000000000001',null)$q$, 'PT409');
select pg_temp.expect_error($q$select public.growth_finish_round('halfsword-codex-growth-trial',current_setting('test.round')::uuid,true)$q$, 'PT425');
select pg_temp.expect_error($q$select public.growth_finish_round('halfsword-codex-growth-trial',current_setting('test.round')::uuid,null)$q$, 'PT400');
select pg_temp.age_round(current_setting('test.round')::uuid, interval '4 seconds');

-- B cannot see A's private ledger or finish A's ticket.
select set_config('request.jwt.claim.sub', '8a576e05-ad16-47bd-83dc-090521eb9bb2', true);
select pg_temp.assert_true((select count(*) = 0 from public.growth_players), 'B cannot read A player');
select pg_temp.assert_true((select count(*) = 0 from public.growth_rounds), 'B cannot read A rounds');
select pg_temp.assert_true((select count(*) = 0 from public.growth_requests), 'B cannot read A request payloads');
select pg_temp.expect_error($q$select public.growth_finish_round('halfsword-codex-growth-trial',current_setting('test.round')::uuid,true)$q$, 'PT404');
select pg_temp.assert_true(public.growth_snapshot('halfsword-codex-growth-trial')->>'wins' = '0', 'B independent economy');
select set_config('request.jwt.claim.sub', '8a576e05-ad16-47bd-83dc-090521eb9aa1', true);
select pg_temp.expect_error($q$select public.growth_finish_round('fixture-other-app',current_setting('test.round')::uuid,true)$q$, 'PT404');
select pg_temp.assert_true(public.growth_finish_round('halfsword-codex-growth-trial',current_setting('test.round')::uuid,true) @> '{"wins":1,"coins":10,"points":0,"revision":1}', 'win awarded exactly by policy');
select pg_temp.assert_true(public.growth_finish_round('halfsword-codex-growth-trial',current_setting('test.round')::uuid,true) @> '{"wins":1,"coins":10,"points":0,"revision":1}', 'same round replay gives no second reward');
select pg_temp.expect_error($q$select public.growth_finish_round('halfsword-codex-growth-trial',current_setting('test.round')::uuid,false)$q$, 'PT409');
select set_config('test.completed', current_setting('test.round'), true);
select set_config('test.round', public.growth_begin_round('halfsword-codex-growth-trial',pg_catalog.gen_random_uuid())->>'round_id',true);
select pg_temp.assert_true(public.growth_finish_round('halfsword-codex-growth-trial',current_setting('test.completed')::uuid,true) @> '{"wins":1,"coins":10,"revision":1}', 'lost completed response can replay after next round begins');
select pg_temp.assert_true((select status = 'active' from public.growth_rounds where round_id = current_setting('test.round')::uuid), 'old completed replay preserves new active round');
select pg_temp.age_round(current_setting('test.round')::uuid, interval '4 seconds');
select pg_temp.assert_true(public.growth_finish_round('halfsword-codex-growth-trial',current_setting('test.round')::uuid,false) @> '{"wins":1,"coins":10,"points":0,"revision":2}', 'loss finalizes with no reward');
select pg_temp.expect_error($q$select public.growth_finish_round('halfsword-codex-growth-trial',current_setting('test.round')::uuid,true)$q$, 'PT409');

select set_config('test.abandoned', public.growth_begin_round('halfsword-codex-growth-trial',pg_catalog.gen_random_uuid())->>'round_id',true);
select set_config('test.round', public.growth_begin_round('halfsword-codex-growth-trial',pg_catalog.gen_random_uuid())->>'round_id',true);
select pg_temp.age_round(current_setting('test.abandoned')::uuid, interval '4 seconds');
select pg_temp.expect_error($q$select public.growth_finish_round('halfsword-codex-growth-trial',current_setting('test.abandoned')::uuid,true)$q$, 'PT409');
select pg_temp.age_round(current_setting('test.round')::uuid, interval '25 hours');
select pg_temp.expect_error($q$select public.growth_finish_round('halfsword-codex-growth-trial',current_setting('test.round')::uuid,true)$q$, 'PT410');
select pg_temp.assert_true(public.growth_snapshot('halfsword-codex-growth-trial') @> '{"wins":1,"coins":10,"points":0}', 'abandoned and expired rounds reward nothing');
select pg_temp.win_rounds(2);
select pg_temp.assert_true(public.growth_snapshot('halfsword-codex-growth-trial') @> '{"wins":3,"coins":30,"points":1}', 'third win grants one point');
select pg_temp.expect_error($q$select public.growth_purchase('halfsword-codex-growth-trial',pg_catalog.gen_random_uuid(),'unknown')$q$, 'PT400');
select pg_temp.expect_error($q$select public.growth_purchase('halfsword-codex-growth-trial',pg_catalog.gen_random_uuid(),null)$q$, 'PT400');
select pg_temp.expect_error($q$select public.growth_equip('halfsword-codex-growth-trial',pg_catalog.gen_random_uuid(),'wayfarer_seal')$q$, 'PT409');
select pg_temp.assert_true(public.growth_purchase('halfsword-codex-growth-trial','10000000-0000-0000-0000-000000000030','wayfarer_seal') @> '{"coins":0,"inventory":["wayfarer_seal"],"revision":5}', 'previously unaffordable UUID succeeds after funds arrive');
select pg_temp.assert_true(public.growth_purchase('halfsword-codex-growth-trial','10000000-0000-0000-0000-000000000030','wayfarer_seal') @> '{"coins":0,"inventory":["wayfarer_seal"],"revision":5}', 'purchase retry costs once');
select pg_temp.expect_error($q$select public.growth_purchase('halfsword-codex-growth-trial','10000000-0000-0000-0000-000000000030','other')$q$, 'PT409');
select pg_temp.expect_error($q$select public.growth_purchase('halfsword-codex-growth-trial',pg_catalog.gen_random_uuid(),'wayfarer_seal')$q$, 'PT409');
select pg_temp.assert_true(public.growth_equip('halfsword-codex-growth-trial','10000000-0000-0000-0000-000000000040','wayfarer_seal') @> '{"equipped":"wayfarer_seal","coins":0,"revision":6}', 'equip owned cosmetic');
select pg_temp.assert_true(public.growth_equip('halfsword-codex-growth-trial','10000000-0000-0000-0000-000000000040','wayfarer_seal')->>'revision' = '6', 'equip retry unchanged');
select pg_temp.expect_error($q$select public.growth_equip('halfsword-codex-growth-trial','10000000-0000-0000-0000-000000000040',null)$q$, 'PT409');
select pg_temp.assert_true(public.growth_equip('halfsword-codex-growth-trial',pg_catalog.gen_random_uuid(),null)->'equipped' = 'null'::jsonb, 'nullable item unequips');
select pg_temp.expect_error($q$select public.growth_allocate('halfsword-codex-growth-trial',pg_catalog.gen_random_uuid(),'other','strength')$q$, 'PT400');
select pg_temp.expect_error($q$select public.growth_allocate('halfsword-codex-growth-trial',pg_catalog.gen_random_uuid(),'player','coins')$q$, 'PT400');
select pg_temp.assert_true(public.growth_allocate('halfsword-codex-growth-trial','10000000-0000-0000-0000-000000000050','player','strength') @> '{"points":0,"characters":{"player":{"strength":1}},"revision":8}', 'point buys one strength level');
select pg_temp.assert_true(public.growth_allocate('halfsword-codex-growth-trial','10000000-0000-0000-0000-000000000050','player','strength')->>'revision' = '8', 'allocation retry spends once');
select pg_temp.expect_error($q$select public.growth_allocate('halfsword-codex-growth-trial','10000000-0000-0000-0000-000000000050','player','other')$q$, 'PT409');
select pg_temp.expect_error($q$select public.growth_allocate('halfsword-codex-growth-trial',pg_catalog.gen_random_uuid(),'player','strength')$q$, 'PT409');

select pg_temp.win_rounds(15);
select pg_temp.assert_true(public.growth_snapshot('halfsword-codex-growth-trial') @> '{"wins":18,"coins":150,"points":5}', 'milestone accrual uses lifetime wins');
select public.growth_allocate('halfsword-codex-growth-trial',pg_catalog.gen_random_uuid(),'player','strength') from generate_series(1,4);
select pg_temp.expect_error($q$select public.growth_allocate('halfsword-codex-growth-trial',pg_catalog.gen_random_uuid(),'player','strength')$q$, 'PT409');
select pg_temp.assert_true(public.growth_snapshot('halfsword-codex-growth-trial') @> '{"points":1,"characters":{"player":{"strength":5}}}', 'strength cap five keeps unspent point');
select pg_temp.assert_true(public.growth_snapshot('fixture-other-app') @> '{"wins":0,"coins":0,"points":0,"inventory":[]}', 'app economies stay isolated');
select pg_temp.expect_error($q$update public.growth_players set coins = 999$q$, '42501');
select pg_temp.expect_error($q$delete from public.growth_requests$q$, '42501');
select pg_temp.expect_error($q$update public.growth_rounds set started_at = now() - interval '4 seconds'$q$, '42501');

-- Revoking direct privileges is not the only read boundary: exercise actual RLS.
reset role;
select pg_temp.assert_true((select coins = 150 from public.growth_players where user_id = '8a576e05-ad16-47bd-83dc-090521eb9aa1' and app_id = 'halfsword-codex-growth-trial'), 'rejections leave final balance intact');
set local role authenticated;
select set_config('request.jwt.claim.sub', '8a576e05-ad16-47bd-83dc-090521eb9bb2', true);
select pg_temp.assert_true((select count(*) = 0 from public.growth_players), 'B still sees no A economy after all mutations');
select public.growth_begin_round('halfsword-codex-growth-trial','10000000-0000-0000-0000-000000000001');
select pg_temp.assert_true((select count(*) = 1 from public.growth_players), 'same UUID is scoped to B own UID');
select pg_temp.assert_true((select count(*) = 1 from public.growth_rounds), 'B sees only B round');
select pg_temp.assert_true((select count(*) = 1 from public.growth_requests), 'B sees only B request');
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true((select count(*) = 0 from public.growth_players), 'no UID reveals no private state');
select pg_temp.expect_error($q$select public.growth_snapshot('halfsword-codex-growth-trial')$q$, 'PT401');
select pg_temp.expect_error($q$select public.growth_begin_round('halfsword-codex-growth-trial',pg_catalog.gen_random_uuid())$q$, 'PT401');
set local role anon;
select pg_temp.expect_error($q$select public.growth_snapshot('halfsword-codex-growth-trial')$q$, '42501');
select pg_temp.expect_error($q$select public.growth_purchase('halfsword-codex-growth-trial',pg_catalog.gen_random_uuid(),'wayfarer_seal')$q$, '42501');
select pg_temp.expect_error($q$select * from public.growth_players$q$, '42501');
reset role;
delete from auth.users where id = '8a576e05-ad16-47bd-83dc-090521eb9aa1';
select pg_temp.assert_true(not exists(select 1 from public.growth_players where user_id = '8a576e05-ad16-47bd-83dc-090521eb9aa1'), 'trusted Auth deletion cascades state');
select pg_temp.assert_true(not exists(select 1 from public.growth_requests where user_id = '8a576e05-ad16-47bd-83dc-090521eb9aa1'), 'trusted Auth deletion cascades request ledger');
select pg_temp.assert_true(not exists(select 1 from public.growth_rounds where user_id = '8a576e05-ad16-47bd-83dc-090521eb9aa1'), 'trusted Auth deletion cascades rounds');
select pg_temp.assert_true((select count(*) = 1 from public.growth_players), 'B survives deletion of A');
rollback;
