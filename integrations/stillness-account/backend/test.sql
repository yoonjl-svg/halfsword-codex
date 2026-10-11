-- Run after schema.sql as a trusted migration owner in a disposable project.
-- No external services or pgTAP extension required. All fixtures roll back.
begin;

insert into auth.users (id) values
  ('8a576e05-ad16-47bd-83dc-090521eb9aa1'),
  ('8a576e05-ad16-47bd-83dc-090521eb9bb2');

create function pg_temp.assert_true(result boolean, label text)
returns void language plpgsql as $$
begin
  if result is not true then raise exception 'FAILED: %', label; end if;
end;
$$;

create function pg_temp.expect_error(statement text, expected_state text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise;
  end;
  raise exception 'FAILED: expected SQLSTATE % for %', expected_state, statement;
end;
$$;

-- Catalog checks catch permission regressions even before exercising RLS.
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.player_profiles', 'INSERT'), 'no direct INSERT');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.player_profiles', 'UPDATE'), 'no direct UPDATE');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.player_profiles', 'DELETE'), 'no direct DELETE');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.player_profiles', 'TRUNCATE'), 'no TRUNCATE');
select pg_temp.assert_true(not has_table_privilege('anon', 'public.player_profiles', 'SELECT'), 'no unauthenticated SELECT');
select pg_temp.assert_true(
  (select count(*) = 2 from pg_proc
   where oid in ('public.save_player_profile(text,bigint,text,jsonb)'::regprocedure,
                 'public.delete_player_profile(text)'::regprocedure)
     and prosecdef and proconfig @> array['search_path=""']),
  'write RPCs use SECURITY DEFINER with empty search_path'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '8a576e05-ad16-47bd-83dc-090521eb9aa1', true);
select set_config('request.jwt.claims', '{"sub":"8a576e05-ad16-47bd-83dc-090521eb9aa1","role":"authenticated","is_anonymous":true}', true);
select pg_temp.assert_true(
  public.save_player_profile('fixture-game', 0, '게스트 A', '{"sound":true,"difficulty":"normal","skill":"0.7"}') ->> 'revision' = '1',
  'anonymous Auth user A creates revision 1'
);
select pg_temp.assert_true(
  public.save_player_profile('fixture-game', 1, 'Player A', '{"sound":false,"moveMode":"tilt","skill":"1"}') ->> 'revision' = '2',
  'CAS updates revision 2'
);
select pg_temp.assert_true(
  (select schema_version = 1 and updated_at is not null and display_name = 'Player A'
   from public.player_profiles where app_id = 'fixture-game'), 'server fields and saved name'
);
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 0, 'Overwrite', '{}')$q$, 'PT409');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 1, 'Stale', '{}')$q$, 'PT409');
select pg_temp.expect_error($q$select public.save_player_profile('missing-game', 1, 'Missing', '{}')$q$, 'PT409');
select pg_temp.assert_true(
  public.save_player_profile('fixture-fork', 0, 'Fork', '{}') ->> 'revision' = '1',
  'same user, independent app namespace'
);

-- Invalid payloads must fail before writes and leave revision 2 intact.
select pg_temp.expect_error($q$select public.save_player_profile('../bad', 0, 'Name', '{}')$q$, 'PT400');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', -1, 'Name', '{}')$q$, 'PT400');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', null, 'Name', '{}')$q$, 'PT400');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 9007199254740991, 'Name', '{}')$q$, 'PT400');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 2, '', '{}')$q$, 'PT400');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 2, ' padded ', '{}')$q$, 'PT400');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 2, repeat('a',25), '{}')$q$, 'PT400');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 2, E'bad\nname', '{}')$q$, 'PT400');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 2, 'Name', null)$q$, 'PT400');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 2, 'Name', '[]')$q$, 'PT400');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 2, 'Name', '{"sound":"true"}')$q$, 'PT400');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 2, 'Name', '{"sound":null}')$q$, 'PT400');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 2, 'Name', '{"skill":0.7}')$q$, 'PT400');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 2, 'Name', '{"difficulty":"god"}')$q$, 'PT400');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 2, 'Name', '{"score":999}')$q$, 'PT400');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 2, 'Name', '{"user_id":"8a576e05-ad16-47bd-83dc-090521eb9bb2"}')$q$, 'PT400');
select pg_temp.assert_true(
  (select revision = 2 and display_name = 'Player A' from public.player_profiles where app_id = 'fixture-game'),
  'rejected saves leave row untouched'
);
select pg_temp.expect_error($q$update public.player_profiles set revision = 999$q$, '42501');
select pg_temp.expect_error($q$delete from public.player_profiles$q$, '42501');
select pg_temp.expect_error($q$insert into public.player_profiles (app_id,user_id,display_name,settings,revision) values ('bypass','8a576e05-ad16-47bd-83dc-090521eb9aa1','Bypass','{}',1)$q$, '42501');

-- User B cannot read, update, or delete A's save by guessing app ID/revision.
select set_config('request.jwt.claim.sub', '8a576e05-ad16-47bd-83dc-090521eb9bb2', true);
select set_config('request.jwt.claims', '{"sub":"8a576e05-ad16-47bd-83dc-090521eb9bb2","role":"authenticated","is_anonymous":false}', true);
select pg_temp.assert_true((select count(*) = 0 from public.player_profiles), 'B sees no A rows');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 2, 'Intruder', '{}')$q$, 'PT409');
select pg_temp.assert_true(public.delete_player_profile('fixture-game') = false, 'B cannot delete A save');
select pg_temp.assert_true(
  public.save_player_profile('fixture-game', 0, 'Player B', '{"pixel":false,"blood":true,"invertTilt":false,"guardNames":true,"trail":false,"fpsCap":true}') ->> 'revision' = '1',
  'B owns independent row and remaining known booleans validate'
);
select pg_temp.assert_true((select count(*) = 1 from public.player_profiles), 'B sees only B row');

select set_config('request.jwt.claim.sub', '8a576e05-ad16-47bd-83dc-090521eb9aa1', true);
select set_config('request.jwt.claims', '{"sub":"8a576e05-ad16-47bd-83dc-090521eb9aa1","role":"authenticated"}', true);
select pg_temp.assert_true((select count(*) = 2 from public.player_profiles), 'A sees two own app rows');
select pg_temp.assert_true(public.delete_player_profile('fixture-game'), 'A deletes own save');
select pg_temp.assert_true(not public.delete_player_profile('fixture-game'), 'delete is idempotent');
select pg_temp.assert_true((select count(*) = 1 from public.player_profiles), 'fork survives other app deletion');

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
select pg_temp.assert_true((select count(*) = 0 from public.player_profiles), 'missing UID sees no rows');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 0, 'Nobody', '{}')$q$, 'PT401');
select pg_temp.expect_error($q$select public.delete_player_profile('fixture-game')$q$, 'PT401');
set local role anon;
select pg_temp.expect_error($q$select * from public.player_profiles$q$, '42501');
select pg_temp.expect_error($q$select public.save_player_profile('fixture-game', 0, 'Nobody', '{}')$q$, '42501');
select pg_temp.expect_error($q$select public.delete_player_profile('fixture-game')$q$, '42501');

reset role;
select pg_temp.assert_true(
  exists(select 1 from auth.users where id = '8a576e05-ad16-47bd-83dc-090521eb9aa1'),
  'delete save keeps Auth user'
);
select pg_temp.assert_true(
  (select display_name = 'Player B' from public.player_profiles
   where app_id = 'fixture-game' and user_id = '8a576e05-ad16-47bd-83dc-090521eb9bb2'),
  'A deletion leaves B save untouched'
);
delete from auth.users where id = '8a576e05-ad16-47bd-83dc-090521eb9aa1';
select pg_temp.assert_true(
  not exists(select 1 from public.player_profiles where user_id = '8a576e05-ad16-47bd-83dc-090521eb9aa1'),
  'trusted Auth user deletion cascades remaining saves'
);
rollback;
