-- Admin dashboard: auth/RBAC, audit log, settings, and the write paths the
-- public-facing app doesn't need (public.amasas_query/ai_query stay read-only).
--
-- Design notes (see README "管理画面" section for the human-facing version):
--
-- 1. Only `public` is confirmed exposed to PostgREST in this project (every
--    existing table/RPC the app talks to lives there; amasas/ai/knowledge are
--    reached only through public.amasas_query/ai_query). So all admin.* access
--    goes through NEW functions defined in `public`, never direct REST calls
--    to `admin.*` or `knowledge.*` tables. The three existing amasas_chat_*
--    tables already live in `public`, so those get plain RLS SELECT policies
--    and are read directly.
--
-- 2. admin.current_role() is SECURITY DEFINER so it can look up the caller's
--    own admin_users row without recursing through admin_users' own RLS.
--    Every other admin.* function re-checks it internally — that check, not
--    the UI, is the real permission boundary.
--
-- 3. Additive only: no existing table, policy, or function is altered/dropped.

create schema if not exists "admin";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table "admin"."admin_users" (
  "id" uuid primary key references auth.users (id) on delete cascade,
  "email" text not null unique,
  "display_name" text,
  "role" text not null default 'viewer' check (role in ('owner', 'admin', 'editor', 'viewer')),
  "is_active" boolean not null default true,
  "created_at" timestamptz not null default now(),
  "created_by" uuid references "admin"."admin_users" (id),
  "last_login_at" timestamptz
);

create table "admin"."admin_audit_log" (
  "id" bigint generated always as identity primary key,
  "actor_id" uuid references "admin"."admin_users" (id),
  "actor_email" text,
  "action" text not null,
  "target" text,
  "details" jsonb,
  "created_at" timestamptz not null default now()
);
create index "idx_admin_audit_log_created" on "admin"."admin_audit_log" ("created_at" desc);

create table "admin"."admin_settings" (
  "key" text primary key,
  "value" jsonb not null,
  "updated_at" timestamptz not null default now(),
  "updated_by" uuid references "admin"."admin_users" (id)
);

-- RLS enabled with NO client-facing policies: every read/write of admin.* goes
-- through the SECURITY DEFINER functions below, which do their own role
-- checks. This is defense-in-depth in case the schema is ever exposed to
-- PostgREST directly (mirrors the "RLS on, zero policies" pattern already
-- used for amasas_chat_* in 0001_chat_logging.sql).
alter table "admin"."admin_users" enable row level security;
alter table "admin"."admin_audit_log" enable row level security;
alter table "admin"."admin_settings" enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Caller's role, or null if not a known/active admin. SECURITY DEFINER so it
-- bypasses admin_users' own (policy-less) RLS instead of recursing into it.
create or replace function "admin"."current_role"()
returns text
language sql
stable
security definer
set search_path = "admin", pg_temp
as $$
  select role from "admin"."admin_users" where id = auth.uid() and is_active = true;
$$;

-- Extracts whichever known primary-key column is present in a row's jsonb
-- representation, for readable audit-log "target" strings.
create or replace function "admin"."extract_pk"(row_json jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    row_json ->> 'id', row_json ->> 'path_key', row_json ->> 'asset_key',
    row_json ->> 'measure_key', row_json ->> 'entry_key', row_json ->> 'source_key',
    row_json ->> 'frame', row_json ->> 'pillar_no', row_json ->> 'fact_key'
  );
$$;

-- Generic audit trigger: records who changed what row in which table. Runs on
-- the knowledge.* content tables and admin.admin_users — attached below.
create or replace function "admin"."log_audit"()
returns trigger
language plpgsql
security definer
set search_path = "admin", pg_temp
as $$
declare
  actor_email_ text;
  row_json jsonb;
  details jsonb;
begin
  select email into actor_email_ from "admin"."admin_users" where id = auth.uid();

  if tg_op = 'DELETE' then
    row_json := to_jsonb(old);
    details := jsonb_build_object('old', row_json);
  elsif tg_op = 'INSERT' then
    row_json := to_jsonb(new);
    details := jsonb_build_object('new', row_json);
  else
    row_json := to_jsonb(new);
    details := jsonb_build_object('old', to_jsonb(old), 'new', row_json);
  end if;

  insert into "admin"."admin_audit_log" (actor_id, actor_email, action, target, details)
  values (
    auth.uid(),
    actor_email_,
    tg_table_schema || '.' || tg_table_name || '.' || lower(tg_op),
    tg_table_schema || '.' || tg_table_name || ':' || coalesce("admin"."extract_pk"(row_json), '?'),
    details
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Bumps updated_at (+ updated_by where present) before writes.
create or replace function "admin"."bump_updated_at"()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function "admin"."bump_settings_meta"()
returns trigger
language plpgsql
security definer
set search_path = "admin", pg_temp
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists "trg_settings_meta" on "admin"."admin_settings";
create trigger "trg_settings_meta"
  before insert or update on "admin"."admin_settings"
  for each row execute function "admin"."bump_settings_meta"();

drop trigger if exists "trg_audit_admin_users" on "admin"."admin_users";
create trigger "trg_audit_admin_users"
  after insert or update or delete on "admin"."admin_users"
  for each row execute function "admin"."log_audit"();

-- Audit + updated_at triggers on the 8 knowledge.* content tables (additive;
-- these tables and their read-only policies already exist from 0003).
do $$
declare
  t text;
begin
  foreach t in array array[
    'involvement_paths', 'map_assets', 'measures', 'reading_playbook',
    'source_registry', 'strategy_frames', 'strategy_pillars', 'town_facts'
  ]
  loop
    execute format('drop trigger if exists trg_audit_%1$s on knowledge.%1$I', t);
    execute format(
      'create trigger trg_audit_%1$s after insert or update or delete on knowledge.%1$I for each row execute function admin.log_audit()',
      t
    );
  end loop;
end $$;

drop trigger if exists "trg_map_assets_updated_at" on "knowledge"."map_assets";
create trigger "trg_map_assets_updated_at"
  before update on "knowledge"."map_assets"
  for each row execute function "admin"."bump_updated_at"();

drop trigger if exists "trg_town_facts_updated_at" on "knowledge"."town_facts";
create trigger "trg_town_facts_updated_at"
  before update on "knowledge"."town_facts"
  for each row execute function "admin"."bump_updated_at"();

-- ---------------------------------------------------------------------------
-- RLS additions on the EXISTING public chat-log tables (public schema really
-- is exposed to PostgREST, unlike admin/knowledge). Additive: anon's total
-- lack of access, set in 0001, is untouched — these only grant `authenticated`.
-- ---------------------------------------------------------------------------

create policy "admin_can_read_sessions" on "public"."amasas_chat_sessions"
  for select to authenticated
  using ("admin"."current_role"() is not null);

create policy "admin_can_read_messages" on "public"."amasas_chat_messages"
  for select to authenticated
  using ("admin"."current_role"() is not null);

create policy "admin_can_read_feedback" on "public"."amasas_chat_feedback"
  for select to authenticated
  using ("admin"."current_role"() is not null);

-- ---------------------------------------------------------------------------
-- Public RPCs (the actual admin API surface, called directly from the browser
-- with the signed-in admin's own access token — no service-role key involved
-- except in api/admin/invite.js, which creates the auth.users row itself).
-- ---------------------------------------------------------------------------

-- Who am I, permission-wise. Also stamps last_login_at. Called on every
-- admin page load.
create or replace function "public"."admin_whoami"()
returns jsonb
language plpgsql
security definer
set search_path = "admin", pg_temp
as $$
declare
  result jsonb;
begin
  update "admin"."admin_users" set last_login_at = now()
    where id = auth.uid() and is_active = true;
  select to_jsonb(u) into result from "admin"."admin_users" u
    where u.id = auth.uid() and u.is_active = true;
  return result;
end;
$$;

create or replace function "public"."admin_list_users"()
returns jsonb
language plpgsql
stable
security definer
set search_path = "admin", pg_temp
as $$
begin
  if "admin"."current_role"() not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce(
    (select jsonb_agg(to_jsonb(u) order by u.created_at) from "admin"."admin_users" u),
    '[]'::jsonb
  );
end;
$$;

-- Role/active-flag changes. owner: unrestricted. admin: may only touch
-- editor/viewer rows, and may never grant owner/admin (no self- or
-- peer-escalation via a compromised admin account).
create or replace function "public"."admin_set_user"(target_id uuid, new_role text, new_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = "admin", pg_temp
as $$
declare
  caller_role text := "admin"."current_role"();
  target_role text;
  result jsonb;
begin
  if caller_role is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if new_role not in ('owner', 'admin', 'editor', 'viewer') then
    raise exception 'invalid role: %', new_role;
  end if;

  select role into target_role from "admin"."admin_users" where id = target_id;
  if target_role is null then
    raise exception 'user not found';
  end if;

  if caller_role = 'admin' and (target_role in ('owner', 'admin') or new_role in ('owner', 'admin')) then
    raise exception 'forbidden' using errcode = '42501';
  elsif caller_role in ('editor', 'viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update "admin"."admin_users" set role = new_role, is_active = new_active
    where id = target_id
    returning to_jsonb("admin_users".*) into result;

  return result;
end;
$$;

-- Registers a just-invited admin's profile row. Called by api/admin/invite.js
-- right after it creates the auth.users account (service-role, server-side) —
-- kept as a SECURITY DEFINER RPC rather than a raw service-role insert so the
-- same owner/admin escalation rules above apply to invites too.
create or replace function "public"."admin_register_user"(new_id uuid, new_email text, new_role text, new_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = "admin", pg_temp
as $$
declare
  caller_role text := "admin"."current_role"();
  result jsonb;
begin
  if new_role not in ('owner', 'admin', 'editor', 'viewer') then
    raise exception 'invalid role: %', new_role;
  end if;
  if caller_role is null or (caller_role = 'admin' and new_role in ('owner', 'admin')) then
    raise exception 'forbidden' using errcode = '42501';
  elsif caller_role in ('editor', 'viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into "admin"."admin_users" (id, email, display_name, role, created_by)
  values (new_id, new_email, new_display_name, new_role, auth.uid())
  returning to_jsonb("admin_users".*) into result;

  return result;
end;
$$;

-- knowledge.* writes. table_name is matched against a hardcoded allowlist
-- (never interpolated from an unchecked client string) so this can't reach
-- any table outside the 8 knowledge tables.
create or replace function "public"."admin_knowledge_upsert"(table_name text, row_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = "knowledge", "admin", pg_temp
as $$
declare
  pk_col text;
  set_clause text;
  result jsonb;
begin
  if "admin"."current_role"() not in ('owner', 'admin', 'editor') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  pk_col := case table_name
    when 'involvement_paths' then 'path_key'
    when 'map_assets' then 'asset_key'
    when 'measures' then 'measure_key'
    when 'reading_playbook' then 'entry_key'
    when 'source_registry' then 'source_key'
    when 'strategy_frames' then 'frame'
    when 'strategy_pillars' then 'pillar_no'
    when 'town_facts' then 'fact_key'
    else null
  end;
  if pk_col is null then
    raise exception 'unknown knowledge table: %', table_name;
  end if;

  select string_agg(format('%1$I = excluded.%1$I', c.column_name), ', ')
    into set_clause
    from information_schema.columns c
    where c.table_schema = 'knowledge' and c.table_name = admin_knowledge_upsert.table_name
      and c.column_name <> pk_col;

  execute format(
    'insert into knowledge.%1$I as t select * from jsonb_populate_record(null::knowledge.%1$I, $1) ' ||
    'on conflict (%2$I) do update set %3$s returning to_jsonb(t.*)',
    table_name, pk_col, set_clause
  ) into result using row_data;

  return result;
end;
$$;

create or replace function "public"."admin_knowledge_delete"(table_name text, pk_value text)
returns jsonb
language plpgsql
security definer
set search_path = "knowledge", "admin", pg_temp
as $$
declare
  pk_col text;
  affected int;
begin
  if "admin"."current_role"() not in ('owner', 'admin', 'editor') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  pk_col := case table_name
    when 'involvement_paths' then 'path_key'
    when 'map_assets' then 'asset_key'
    when 'measures' then 'measure_key'
    when 'reading_playbook' then 'entry_key'
    when 'source_registry' then 'source_key'
    when 'strategy_frames' then 'frame'
    when 'strategy_pillars' then 'pillar_no'
    when 'town_facts' then 'fact_key'
    else null
  end;
  if pk_col is null then
    raise exception 'unknown knowledge table: %', table_name;
  end if;

  execute format('delete from knowledge.%I where %I::text = $1', table_name, pk_col) using pk_value;
  get diagnostics affected = row_count;
  return jsonb_build_object('deleted', affected);
end;
$$;

create or replace function "public"."admin_list_settings"()
returns jsonb
language plpgsql
stable
security definer
set search_path = "admin", pg_temp
as $$
begin
  if "admin"."current_role"() not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce(
    (select jsonb_agg(to_jsonb(s) order by s.key) from "admin"."admin_settings" s),
    '[]'::jsonb
  );
end;
$$;

create or replace function "public"."admin_set_setting"(setting_key text, setting_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path = "admin", pg_temp
as $$
declare
  result jsonb;
begin
  if "admin"."current_role"() not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into "admin"."admin_settings" (key, value) values (setting_key, setting_value)
    on conflict (key) do update set value = excluded.value
    returning to_jsonb("admin_settings".*) into result;
  return result;
end;
$$;

create or replace function "public"."admin_list_audit_log"(limit_n int default 100, offset_n int default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = "admin", pg_temp
as $$
begin
  if "admin"."current_role"() not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce(
    (select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (
      select * from "admin"."admin_audit_log"
      order by created_at desc
      limit greatest(limit_n, 0) offset greatest(offset_n, 0)
    ) a),
    '[]'::jsonb
  );
end;
$$;

-- Public (anon-reachable) maintenance-mode flag for api/chat.js. Returns a
-- safe default when no row exists yet, so this can never block the public
-- chat before an owner has configured anything.
create or replace function "public"."amasas_maintenance_status"()
returns jsonb
language sql
stable
security definer
set search_path = "admin", pg_temp
as $$
  select coalesce(
    (select value from "admin"."admin_settings" where key = 'maintenance_mode'),
    jsonb_build_object('enabled', false)
  );
$$;

-- ---------------------------------------------------------------------------
-- Grants: EXECUTE only, explicitly, no PUBLIC default.
-- ---------------------------------------------------------------------------

revoke all on function "public"."admin_whoami"() from public;
revoke all on function "public"."admin_list_users"() from public;
revoke all on function "public"."admin_set_user"(uuid, text, boolean) from public;
revoke all on function "public"."admin_register_user"(uuid, text, text, text) from public;
revoke all on function "public"."admin_knowledge_upsert"(text, jsonb) from public;
revoke all on function "public"."admin_knowledge_delete"(text, text) from public;
revoke all on function "public"."admin_list_settings"() from public;
revoke all on function "public"."admin_set_setting"(text, jsonb) from public;
revoke all on function "public"."admin_list_audit_log"(int, int) from public;
revoke all on function "public"."amasas_maintenance_status"() from public;

grant execute on function "public"."admin_whoami"() to authenticated;
grant execute on function "public"."admin_list_users"() to authenticated;
grant execute on function "public"."admin_set_user"(uuid, text, boolean) to authenticated;
grant execute on function "public"."admin_register_user"(uuid, text, text, text) to authenticated;
grant execute on function "public"."admin_knowledge_upsert"(text, jsonb) to authenticated;
grant execute on function "public"."admin_knowledge_delete"(text, text) to authenticated;
grant execute on function "public"."admin_list_settings"() to authenticated;
grant execute on function "public"."admin_set_setting"(text, jsonb) to authenticated;
grant execute on function "public"."admin_list_audit_log"(int, int) to authenticated;
grant execute on function "public"."amasas_maintenance_status"() to anon, authenticated;
