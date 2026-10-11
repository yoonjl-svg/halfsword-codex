-- Optional growth trial migration. Apply once as a trusted migration owner.
-- Independent of player_profiles/schema.sql; no production economy is enabled.
begin;

create table public.growth_policies (
  app_id text primary key check (app_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  enabled boolean not null default false,
  win_coins integer not null default 10 check (win_coins between 0 and 10000),
  milestone integer not null default 3 check (milestone between 1 and 1000),
  points_per_milestone integer not null default 1 check (points_per_milestone between 0 and 100),
  strength_step numeric not null default 0.02 check (strength_step between 0 and 0.1),
  strength_cap integer not null default 5 check (strength_cap between 0 and 5),
  round_min_seconds integer not null default 3 check (round_min_seconds >= 0),
  round_max_seconds integer not null default 86400 check (round_max_seconds > round_min_seconds)
);
create table public.growth_catalog (
  app_id text not null references public.growth_policies(app_id) on delete cascade,
  item_id text not null check (item_id ~ '^[a-z0-9_]{1,64}$'),
  name text not null check (pg_catalog.char_length(name) between 1 and 80),
  price integer not null check (price between 0 and 1000000),
  kind text not null default 'cosmetic_badge' check (kind = 'cosmetic_badge'),
  enabled boolean not null default false,
  primary key (app_id, item_id)
);
create table public.growth_players (
  app_id text not null references public.growth_policies(app_id),
  user_id uuid not null references auth.users(id) on delete cascade,
  wins bigint not null default 0 check (wins between 0 and 9007199254740991),
  coins bigint not null default 0 check (coins between 0 and 9007199254740991),
  points bigint not null default 0 check (points between 0 and 9007199254740991),
  strength integer not null default 0 check (strength between 0 and 5),
  inventory text[] not null default '{}',
  equipped text,
  revision bigint not null default 0 check (revision between 0 and 9007199254740991),
  primary key (app_id, user_id),
  check (equipped is null or equipped = any(inventory))
);
create table public.growth_rounds (
  app_id text not null,
  user_id uuid not null,
  round_id uuid not null default pg_catalog.gen_random_uuid(),
  started_at timestamptz not null default pg_catalog.clock_timestamp(),
  finished_at timestamptz,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  win boolean,
  primary key (app_id, user_id, round_id),
  foreign key (app_id, user_id) references public.growth_players on delete cascade,
  check ((status = 'completed') = (win is not null and finished_at is not null))
);
create unique index growth_one_active_round on public.growth_rounds (app_id, user_id) where status = 'active';
create table public.growth_requests (
  app_id text not null,
  user_id uuid not null,
  request_id uuid not null,
  operation text not null check (operation in ('begin', 'purchase', 'allocate', 'equip')),
  -- Canonical JSON equality is the payload fingerprint; no hash collisions.
  payload jsonb not null check (pg_catalog.jsonb_typeof(payload) = 'object'),
  response jsonb not null,
  primary key (app_id, user_id, request_id),
  foreign key (app_id, user_id) references public.growth_players on delete cascade
);

alter table public.growth_policies enable row level security;
alter table public.growth_catalog enable row level security;
alter table public.growth_players enable row level security;
alter table public.growth_rounds enable row level security;
alter table public.growth_requests enable row level security;
create policy growth_policy_read on public.growth_policies for select to authenticated using (true);
create policy growth_catalog_read on public.growth_catalog for select to authenticated using (true);
create policy growth_player_read_own on public.growth_players for select to authenticated using (user_id = (select auth.uid()));
create policy growth_round_read_own on public.growth_rounds for select to authenticated using (user_id = (select auth.uid()));
create policy growth_request_read_own on public.growth_requests for select to authenticated using (user_id = (select auth.uid()));
revoke all on table public.growth_policies, public.growth_catalog, public.growth_players,
  public.growth_rounds, public.growth_requests from public, anon, authenticated;
grant select on table public.growth_policies, public.growth_catalog, public.growth_players,
  public.growth_rounds, public.growth_requests to authenticated;

insert into public.growth_policies (app_id, enabled) values ('halfsword-codex-growth-trial', true);
insert into public.growth_catalog (app_id, item_id, name, price, enabled)
  values ('halfsword-codex-growth-trial', 'wayfarer_seal', '여행자의 인장', 30, true);

create function public.growth_require(p_app_id text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise sqlstate 'PT401' using message = 'Sign in to use growth.'; end if;
  if p_app_id is null or p_app_id !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then
    raise sqlstate 'PT400' using message = 'Invalid app ID.';
  end if;
  if not exists (select 1 from public.growth_policies where app_id = p_app_id and enabled) then
    raise sqlstate 'PT403' using message = 'Growth is disabled for this app.';
  end if;
  return caller;
end;
$$;

create function public.growth_snapshot(p_app_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare caller uuid := public.growth_require(p_app_id); result jsonb;
begin
  select pg_catalog.jsonb_build_object(
    'wins', coalesce(s.wins, 0), 'coins', coalesce(s.coins, 0), 'points', coalesce(s.points, 0),
    'characters', pg_catalog.jsonb_build_object('player', pg_catalog.jsonb_build_object('strength', coalesce(s.strength, 0))),
    'inventory', coalesce(pg_catalog.to_jsonb(s.inventory), '[]'::jsonb), 'equipped', s.equipped,
    'revision', coalesce(s.revision, 0),
    'rules', pg_catalog.jsonb_build_object('winCoins', p.win_coins, 'milestone', p.milestone,
      'pointsPerMilestone', p.points_per_milestone, 'strengthStep', p.strength_step, 'strengthCap', p.strength_cap),
    'catalog', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', c.item_id, 'name', c.name, 'price', c.price) order by c.item_id), '[]'::jsonb)
      from public.growth_catalog c where c.app_id = p.app_id and c.enabled)
  ) into result from public.growth_policies p
    left join public.growth_players s on s.app_id = p.app_id and s.user_id = caller
    where p.app_id = p_app_id;
  return result;
end;
$$;

-- Private helper: every mutation takes this same row lock before reading money,
-- points, inventory, requests or rounds. PostgreSQL keeps the lock to commit.
create function public.growth_lock_player(p_app_id text) returns public.growth_players
language plpgsql security definer set search_path = '' as $$
declare caller uuid := public.growth_require(p_app_id); state public.growth_players;
begin
  insert into public.growth_players (app_id, user_id) values (p_app_id, caller)
    on conflict (app_id, user_id) do nothing;
  select * into strict state from public.growth_players
    where app_id = p_app_id and user_id = caller for update;
  return state;
end;
$$;

-- Only fixed public wrappers below may call this private dispatcher.
create function public.growth_change(p_app_id text, p_request_id uuid, p_operation text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  state public.growth_players;
  prior public.growth_requests;
  rules public.growth_policies;
  item public.growth_catalog;
  requested_item text := p_payload ->> 'item';
  ticket uuid;
  result jsonb;
begin
  if p_request_id is null then raise sqlstate 'PT400' using message = 'A request UUID is required.'; end if;
  state := public.growth_lock_player(p_app_id);
  select * into prior from public.growth_requests
    where app_id = p_app_id and user_id = state.user_id and request_id = p_request_id;
  if found then
    if prior.operation <> p_operation or prior.payload <> p_payload then
      raise sqlstate 'PT409' using message = 'Request UUID already used with a different payload.';
    end if;
    if p_operation = 'begin' then return prior.response; end if;
    return public.growth_snapshot(p_app_id);
  end if;
  select * into strict rules from public.growth_policies where app_id = p_app_id;
  case p_operation
    when 'begin' then
      -- Beginning a replacement round abandons the previous round without reward.
      update public.growth_rounds set status = 'abandoned'
        where app_id = p_app_id and user_id = state.user_id and status = 'active';
      insert into public.growth_rounds (app_id, user_id) values (p_app_id, state.user_id)
        returning round_id into ticket;
      result := pg_catalog.jsonb_build_object('round_id', ticket);
    when 'purchase' then
      select * into item from public.growth_catalog
        where app_id = p_app_id and item_id = requested_item and enabled;
      if not found then raise sqlstate 'PT400' using message = 'Unknown or unavailable shop item.'; end if;
      if requested_item = any(state.inventory) then raise sqlstate 'PT409' using message = 'Item already owned.'; end if;
      if state.coins < item.price then raise sqlstate 'PT409' using message = 'Not enough coins.'; end if;
      update public.growth_players set coins = coins - item.price, inventory = pg_catalog.array_append(inventory, requested_item), revision = revision + 1
        where app_id = p_app_id and user_id = state.user_id;
    when 'allocate' then
      if (p_payload ->> 'character') is distinct from 'player' or (p_payload ->> 'stat') is distinct from 'strength' then
        raise sqlstate 'PT400' using message = 'Unknown character or stat.';
      end if;
      if state.points < 1 then raise sqlstate 'PT409' using message = 'Not enough stat points.'; end if;
      if state.strength >= rules.strength_cap then raise sqlstate 'PT409' using message = 'Strength cap reached.'; end if;
      update public.growth_players set points = points - 1, strength = strength + 1, revision = revision + 1
        where app_id = p_app_id and user_id = state.user_id;
    when 'equip' then
      if requested_item is not null and not (requested_item = any(state.inventory)) then
        raise sqlstate 'PT409' using message = 'Item is not owned.';
      end if;
      update public.growth_players set equipped = requested_item, revision = revision + 1
        where app_id = p_app_id and user_id = state.user_id;
    else raise sqlstate 'PT400' using message = 'Unknown operation.';
  end case;
  if p_operation <> 'begin' then result := public.growth_snapshot(p_app_id); end if;
  insert into public.growth_requests (app_id, user_id, request_id, operation, payload, response)
    values (p_app_id, state.user_id, p_request_id, p_operation, p_payload, result);
  return result;
end;
$$;

create function public.growth_begin_round(p_app_id text, p_request_id uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select public.growth_change(p_app_id, p_request_id, 'begin', '{}'::jsonb)
$$;
create function public.growth_purchase(p_app_id text, p_request_id uuid, p_item_id text) returns jsonb
language sql security definer set search_path = '' as $$
  select public.growth_change(p_app_id, p_request_id, 'purchase', pg_catalog.jsonb_build_object('item', p_item_id))
$$;
create function public.growth_allocate(p_app_id text, p_request_id uuid, p_character_id text, p_stat text) returns jsonb
language sql security definer set search_path = '' as $$
  select public.growth_change(p_app_id, p_request_id, 'allocate', pg_catalog.jsonb_build_object('character', p_character_id, 'stat', p_stat))
$$;
create function public.growth_equip(p_app_id text, p_request_id uuid, p_item_id text) returns jsonb
language sql security definer set search_path = '' as $$
  select public.growth_change(p_app_id, p_request_id, 'equip', pg_catalog.jsonb_build_object('item', p_item_id))
$$;

create function public.growth_finish_round(p_app_id text, p_round_id uuid, p_win boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  state public.growth_players;
  round public.growth_rounds;
  rules public.growth_policies;
  age_seconds numeric;
begin
  if p_round_id is null or p_win is null then raise sqlstate 'PT400' using message = 'Round and result are required.'; end if;
  state := public.growth_lock_player(p_app_id);
  select * into round from public.growth_rounds
    where app_id = p_app_id and user_id = state.user_id and round_id = p_round_id;
  if not found then raise sqlstate 'PT404' using message = 'Round not found for this account and app.'; end if;
  if round.status = 'completed' then
    if round.win <> p_win then raise sqlstate 'PT409' using message = 'Round already has a different result.'; end if;
    return public.growth_snapshot(p_app_id);
  end if;
  if round.status <> 'active' then raise sqlstate 'PT409' using message = 'Round was abandoned.'; end if;
  select * into strict rules from public.growth_policies where app_id = p_app_id;
  age_seconds := extract(epoch from pg_catalog.clock_timestamp() - round.started_at);
  if age_seconds < rules.round_min_seconds then raise sqlstate 'PT425' using message = 'Round finished too soon; retry this result shortly.'; end if;
  if age_seconds > rules.round_max_seconds then raise sqlstate 'PT410' using message = 'Round expired.'; end if;
  update public.growth_rounds set status = 'completed', win = p_win, finished_at = pg_catalog.clock_timestamp()
    where app_id = p_app_id and user_id = state.user_id and round_id = p_round_id;
  update public.growth_players set
    wins = wins + case when p_win then 1 else 0 end,
    coins = coins + case when p_win then rules.win_coins else 0 end,
    points = points + case when p_win and (wins + 1) % rules.milestone = 0 then rules.points_per_milestone else 0 end,
    revision = revision + 1
    where app_id = p_app_id and user_id = state.user_id;
  return public.growth_snapshot(p_app_id);
end;
$$;

revoke all on function public.growth_require(text), public.growth_lock_player(text),
  public.growth_change(text,uuid,text,jsonb), public.growth_snapshot(text),
  public.growth_begin_round(text,uuid), public.growth_finish_round(text,uuid,boolean),
  public.growth_purchase(text,uuid,text), public.growth_allocate(text,uuid,text,text),
  public.growth_equip(text,uuid,text) from public, anon, authenticated;
grant execute on function public.growth_snapshot(text), public.growth_begin_round(text,uuid),
  public.growth_finish_round(text,uuid,boolean), public.growth_purchase(text,uuid,text),
  public.growth_allocate(text,uuid,text,text), public.growth_equip(text,uuid,text) to authenticated;

commit;
