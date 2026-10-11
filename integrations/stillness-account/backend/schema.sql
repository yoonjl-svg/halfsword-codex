-- Apply once, as the Supabase project's trusted SQL migration owner.
-- A fresh install intentionally fails if these names already exist.
begin;

create function public.player_settings_valid(p_settings jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item record;
begin
  if p_settings is null or pg_catalog.jsonb_typeof(p_settings) <> 'object'
     or pg_catalog.octet_length(p_settings::text) > 2048 then
    return false;
  end if;
  for item in select key, value from pg_catalog.jsonb_each(p_settings) loop
    case
      when item.key in ('pixel', 'blood', 'sound', 'invertTilt', 'guardNames', 'trail', 'fpsCap') then
        if pg_catalog.jsonb_typeof(item.value) <> 'boolean' then return false; end if;
      when item.key = 'difficulty' then
        if item.value not in ('"easy"'::jsonb, '"normal"'::jsonb, '"hard"'::jsonb) then return false; end if;
      when item.key = 'moveMode' then
        if item.value not in ('"stick"'::jsonb, '"tilt"'::jsonb) then return false; end if;
      when item.key = 'skill' then
        if item.value not in ('"0"'::jsonb, '"0.4"'::jsonb, '"0.7"'::jsonb, '"1"'::jsonb) then return false; end if;
      else
        return false;
    end case;
  end loop;
  return true;
end;
$$;

create table public.player_profiles (
  app_id text not null check (app_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (
    pg_catalog.char_length(display_name) between 1 and 24
    and pg_catalog.btrim(display_name) = display_name
    and display_name !~ '[[:cntrl:]]'
  ),
  settings jsonb not null check (public.player_settings_valid(settings)),
  schema_version integer not null default 1 check (schema_version = 1),
  revision bigint not null check (revision between 1 and 9007199254740991),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (app_id, user_id)
);

alter table public.player_profiles enable row level security;
create policy player_profiles_read_own on public.player_profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

-- There is no direct write grant or write policy: every client save goes
-- through the revision check, including Supabase anonymous Auth users.
revoke all on table public.player_profiles from public, anon, authenticated;
grant select on table public.player_profiles to authenticated;

create function public.save_player_profile(
  p_app_id text,
  p_expected_revision bigint,
  p_display_name text,
  p_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  saved public.player_profiles;
begin
  if caller_id is null then
    raise sqlstate 'PT401' using message = 'Sign in before saving.';
  end if;
  if p_app_id is null or p_app_id !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
     or p_expected_revision is null
     or p_expected_revision < 0 or p_expected_revision >= 9007199254740991
     or p_display_name is null
     or pg_catalog.char_length(p_display_name) not between 1 and 24
     or pg_catalog.btrim(p_display_name) <> p_display_name
     or p_display_name ~ '[[:cntrl:]]'
     or not public.player_settings_valid(p_settings) then
    raise sqlstate 'PT400' using message = 'Invalid profile or settings.';
  end if;

  if p_expected_revision = 0 then
    insert into public.player_profiles (app_id, user_id, display_name, settings, revision)
      values (p_app_id, caller_id, p_display_name, p_settings, 1)
      on conflict (app_id, user_id) do nothing
      returning * into saved;
  else
    -- PostgreSQL rechecks this condition after a concurrent writer commits.
    update public.player_profiles as profile
      set display_name = p_display_name,
          settings = p_settings,
          revision = profile.revision + 1,
          updated_at = pg_catalog.clock_timestamp()
      where profile.app_id = p_app_id
        and profile.user_id = caller_id
        and profile.revision = p_expected_revision
      returning profile.* into saved;
  end if;
  if not found then
    raise sqlstate 'PT409' using message = 'The saved profile changed. Load it before saving again.';
  end if;
  return pg_catalog.to_jsonb(saved);
end;
$$;

create function public.delete_player_profile(p_app_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise sqlstate 'PT401' using message = 'Sign in before deleting a save.';
  end if;
  if p_app_id is null or p_app_id !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then
    raise sqlstate 'PT400' using message = 'Invalid app ID.';
  end if;
  delete from public.player_profiles as profile
    where profile.app_id = p_app_id and profile.user_id = caller_id;
  return found;
end;
$$;

-- PostgreSQL otherwise grants new functions EXECUTE to PUBLIC by default.
revoke all on function public.player_settings_valid(jsonb) from public, anon, authenticated;
revoke all on function public.save_player_profile(text, bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.delete_player_profile(text) from public, anon, authenticated;
grant execute on function public.save_player_profile(text, bigint, text, jsonb) to authenticated;
grant execute on function public.delete_player_profile(text) to authenticated;

commit;
