-- Admin Analytics dashboard: traffic/activity tracking for the public chat
-- app. Two genuinely new signals (landing_view, chat_started) plus one new
-- column so every session can be tied to a visitor. Everything else the
-- dashboard needs (message counts/timing, feedback counts) is already fully
-- captured in amasas_chat_messages/amasas_chat_feedback -- not duplicated
-- here. See README "アクセス解析" section for the human-facing version.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

create table "public"."amasas_analytics_events" (
  "id" bigint generated always as identity primary key,
  "session_id" text,
  "visitor_id" text,
  "event_type" text not null check (event_type in ('landing_view', 'chat_started')),
  "device_type" text,
  "browser" text,
  "os" text,
  "country" text,
  "region" text,
  "referrer" text,
  "metadata" jsonb,
  "created_at" timestamptz not null default now()
);
create index "idx_amasas_analytics_events_type_created" on "public"."amasas_analytics_events" ("event_type", "created_at");
create index "idx_amasas_analytics_events_visitor" on "public"."amasas_analytics_events" ("visitor_id", "created_at");
create index "idx_amasas_analytics_events_session" on "public"."amasas_analytics_events" ("session_id");

-- RLS on, zero policies: written only server-side via the service-role key
-- (bypasses RLS, same as amasas_chat_sessions/messages/feedback), read only
-- through the admin-only SECURITY DEFINER RPCs below -- never exposed
-- directly to anon/authenticated via PostgREST.
alter table "public"."amasas_analytics_events" enable row level security;

alter table "public"."amasas_chat_sessions" add column "visitor_id" text;
create index "idx_amasas_chat_sessions_visitor" on "public"."amasas_chat_sessions" ("visitor_id");

-- ---------------------------------------------------------------------------
-- Read RPCs (owner/admin only -- same tier as users/settings/audit)
-- ---------------------------------------------------------------------------

-- One-shot KPI bundle for the selected date range.
create or replace function "public"."admin_analytics_summary"(from_ts timestamptz, to_ts timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = "admin", "public", pg_temp
as $$
declare
  total_sessions bigint;
  total_messages bigint;
  total_landing_views bigint;
  total_chat_started bigint;
  visitor_count bigint;
  new_count bigint;
  avg_duration numeric;
  fb_ok bigint;
  fb_ng bigint;
begin
  if "admin"."current_role"() is null or "admin"."current_role"() not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*) into total_sessions from "public"."amasas_chat_sessions"
    where created_at >= from_ts and created_at < to_ts;
  select count(*) into total_messages from "public"."amasas_chat_messages"
    where created_at >= from_ts and created_at < to_ts;
  select count(*) into total_landing_views from "public"."amasas_analytics_events"
    where event_type = 'landing_view' and created_at >= from_ts and created_at < to_ts;
  select count(*) into total_chat_started from "public"."amasas_analytics_events"
    where event_type = 'chat_started' and created_at >= from_ts and created_at < to_ts;
  select count(*) filter (where verdict = 'ok'), count(*) filter (where verdict = 'ng')
    into fb_ok, fb_ng
    from "public"."amasas_chat_feedback" where created_at >= from_ts and created_at < to_ts;

  with activity as (
    select visitor_id, created_at from "public"."amasas_chat_sessions" where visitor_id is not null
    union all
    select visitor_id, created_at from "public"."amasas_analytics_events" where visitor_id is not null
  ),
  first_seen as (
    select visitor_id, min(created_at) as first_seen from activity group by visitor_id
  ),
  in_range as (
    select distinct visitor_id from activity where created_at >= from_ts and created_at < to_ts
  )
  select count(*), count(*) filter (where fs.first_seen >= from_ts and fs.first_seen < to_ts)
    into visitor_count, new_count
    from in_range v join first_seen fs on fs.visitor_id = v.visitor_id;

  select avg(duration) into avg_duration from (
    select extract(epoch from (max(created_at) - min(created_at))) as duration
    from "public"."amasas_chat_messages"
    where created_at >= from_ts and created_at < to_ts
    group by session_id
  ) d;

  return jsonb_build_object(
    'total_sessions', total_sessions,
    'total_messages', total_messages,
    'total_landing_views', total_landing_views,
    'total_chat_started', total_chat_started,
    'unique_visitors', visitor_count,
    'new_visitors', new_count,
    'returning_visitors', visitor_count - new_count,
    'avg_session_duration_seconds', coalesce(round(avg_duration::numeric), 0),
    'feedback_ok', fb_ok,
    'feedback_ng', fb_ng
  );
end;
$$;

-- Time-bucketed series (granularity: day | week | month) for every chart
-- that plots something over time.
create or replace function "public"."admin_analytics_timeseries"(from_ts timestamptz, to_ts timestamptz, granularity text default 'day')
returns jsonb
language plpgsql
stable
security definer
set search_path = "admin", "public", pg_temp
as $$
declare
  result jsonb;
  g text := granularity;
begin
  if "admin"."current_role"() is null or "admin"."current_role"() not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if g not in ('day', 'week', 'month') then
    g := 'day';
  end if;

  with activity as (
    select visitor_id, created_at from "public"."amasas_chat_sessions" where visitor_id is not null
    union all
    select visitor_id, created_at from "public"."amasas_analytics_events" where visitor_id is not null
  ),
  first_seen as (
    select visitor_id, min(created_at) as first_seen from activity group by visitor_id
  ),
  visitor_buckets as (
    select date_trunc(g, a.created_at) as bucket, a.visitor_id, fs.first_seen
    from activity a join first_seen fs on fs.visitor_id = a.visitor_id
    where a.created_at >= from_ts and a.created_at < to_ts
  ),
  per_bucket_visitors as (
    select bucket,
      count(distinct visitor_id) as unique_visitors,
      count(distinct visitor_id) filter (where date_trunc(g, first_seen) = bucket) as new_visitors
    from visitor_buckets
    group by bucket
  ),
  per_bucket_sessions as (
    select date_trunc(g, created_at) as bucket, count(*) as sessions
    from "public"."amasas_chat_sessions"
    where created_at >= from_ts and created_at < to_ts
    group by 1
  ),
  per_bucket_messages as (
    select date_trunc(g, created_at) as bucket, count(*) as n
    from "public"."amasas_chat_messages"
    where created_at >= from_ts and created_at < to_ts
    group by 1
  ),
  per_bucket_landing as (
    select date_trunc(g, created_at) as bucket, count(*) as n
    from "public"."amasas_analytics_events"
    where event_type = 'landing_view' and created_at >= from_ts and created_at < to_ts
    group by 1
  ),
  all_buckets as (
    select bucket from per_bucket_sessions
    union select bucket from per_bucket_visitors
    union select bucket from per_bucket_messages
    union select bucket from per_bucket_landing
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'bucket', to_char(b.bucket, 'YYYY-MM-DD'),
      'sessions', coalesce(ps.sessions, 0),
      'unique_visitors', coalesce(pv.unique_visitors, 0),
      'new_visitors', coalesce(pv.new_visitors, 0),
      'returning_visitors', coalesce(pv.unique_visitors, 0) - coalesce(pv.new_visitors, 0),
      'messages', coalesce(pm.n, 0),
      'landing_views', coalesce(pl.n, 0)
    ) order by b.bucket), '[]'::jsonb)
    into result
    from all_buckets b
    left join per_bucket_sessions ps on ps.bucket = b.bucket
    left join per_bucket_visitors pv on pv.bucket = b.bucket
    left join per_bucket_messages pm on pm.bucket = b.bucket
    left join per_bucket_landing pl on pl.bucket = b.bucket;

  return result;
end;
$$;

-- Flexible breakdown by one dimension -- covers device/browser/OS/country
-- distribution, most-used features, and usage-by-role charts with a single
-- function instead of five near-identical ones.
create or replace function "public"."admin_analytics_breakdown"(from_ts timestamptz, to_ts timestamptz, dimension text)
returns jsonb
language plpgsql
stable
security definer
set search_path = "admin", "public", pg_temp
as $$
declare
  result jsonb;
begin
  if "admin"."current_role"() is null or "admin"."current_role"() not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if dimension = 'device_type' then
    select coalesce(jsonb_agg(jsonb_build_object('key', coalesce(device_type, 'unknown'), 'count', n) order by n desc), '[]'::jsonb) into result
      from (select device_type, count(*) as n from "public"."amasas_analytics_events"
            where created_at >= from_ts and created_at < to_ts group by device_type) x;
  elsif dimension = 'browser' then
    select coalesce(jsonb_agg(jsonb_build_object('key', coalesce(browser, 'unknown'), 'count', n) order by n desc), '[]'::jsonb) into result
      from (select browser, count(*) as n from "public"."amasas_analytics_events"
            where created_at >= from_ts and created_at < to_ts group by browser) x;
  elsif dimension = 'os' then
    select coalesce(jsonb_agg(jsonb_build_object('key', coalesce(os, 'unknown'), 'count', n) order by n desc), '[]'::jsonb) into result
      from (select os, count(*) as n from "public"."amasas_analytics_events"
            where created_at >= from_ts and created_at < to_ts group by os) x;
  elsif dimension = 'country' then
    select coalesce(jsonb_agg(jsonb_build_object('key', coalesce(country, 'unknown'), 'count', n) order by n desc), '[]'::jsonb) into result
      from (select country, count(*) as n from "public"."amasas_analytics_events"
            where created_at >= from_ts and created_at < to_ts group by country) x;
  elsif dimension = 'event_type' then
    select coalesce(jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc), '[]'::jsonb) into result
      from (
        select event_type as key, count(*) as n from "public"."amasas_analytics_events"
          where created_at >= from_ts and created_at < to_ts group by event_type
        union all
        select 'message_sent', count(*) from "public"."amasas_chat_messages"
          where created_at >= from_ts and created_at < to_ts and role = 'user'
        union all
        select 'feedback_given', count(*) from "public"."amasas_chat_feedback"
          where created_at >= from_ts and created_at < to_ts
      ) x;
  elsif dimension = 'role_tag' then
    select coalesce(jsonb_agg(jsonb_build_object('key', coalesce(role_tag, 'unknown'), 'count', n) order by n desc), '[]'::jsonb) into result
      from (select role_tag, count(*) as n from "public"."amasas_chat_sessions"
            where created_at >= from_ts and created_at < to_ts group by role_tag) x;
  else
    raise exception 'invalid dimension: %', dimension;
  end if;

  return result;
end;
$$;

-- Per-visitor activity table (search/filter by nickname, role_tag, status;
-- date-ranged; paginated). "active" = seen within the last 24h -- a fixed
-- product-analytics convention, independent of the 30-minute chat-session
-- idle timeout (a different concept: that resets the live conversation,
-- this describes whether the visitor has been back recently at all).
create or replace function "public"."admin_analytics_visitors"(
  from_ts timestamptz, to_ts timestamptz,
  search text default null, role_tag_filter text default null, status_filter text default null,
  limit_n int default 50, offset_n int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = "admin", "public", pg_temp
as $$
declare
  result jsonb;
begin
  if "admin"."current_role"() is null or "admin"."current_role"() not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with session_activity as (
    select s.id as session_id, s.visitor_id, s.nickname, s.role_tag, s.created_at,
           coalesce(max(m.created_at), s.created_at) as last_active
    from "public"."amasas_chat_sessions" s
    left join "public"."amasas_chat_messages" m on m.session_id = s.id
    where s.visitor_id is not null and s.created_at >= from_ts and s.created_at < to_ts
    group by s.id, s.visitor_id, s.nickname, s.role_tag, s.created_at
  ),
  per_visitor as (
    select
      visitor_id,
      (array_agg(nickname order by last_active desc))[1] as nickname,
      (array_agg(role_tag order by last_active desc))[1] as role_tag,
      min(created_at) as first_seen,
      max(last_active) as last_active,
      count(*) as session_count
    from session_activity
    group by visitor_id
  ),
  filtered as (
    select *, case when last_active >= now() - interval '24 hours' then 'active' else 'inactive' end as status
    from per_visitor
    where (search is null or search = '' or nickname ilike '%' || search || '%')
      and (role_tag_filter is null or role_tag_filter = '' or role_tag = role_tag_filter)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'visitor_id', visitor_id, 'nickname', nickname, 'role_tag', role_tag,
      'first_seen', first_seen, 'last_active', last_active,
      'session_count', session_count, 'status', status
    ) order by last_active desc), '[]'::jsonb)
    into result
    from (
      select * from filtered
      where status_filter is null or status_filter = '' or status = status_filter
      order by last_active desc
      limit limit_n offset offset_n
    ) page;

  return result;
end;
$$;

revoke all on function "public"."admin_analytics_summary"(timestamptz, timestamptz) from public;
revoke all on function "public"."admin_analytics_timeseries"(timestamptz, timestamptz, text) from public;
revoke all on function "public"."admin_analytics_breakdown"(timestamptz, timestamptz, text) from public;
revoke all on function "public"."admin_analytics_visitors"(timestamptz, timestamptz, text, text, text, int, int) from public;

grant execute on function "public"."admin_analytics_summary"(timestamptz, timestamptz) to authenticated;
grant execute on function "public"."admin_analytics_timeseries"(timestamptz, timestamptz, text) to authenticated;
grant execute on function "public"."admin_analytics_breakdown"(timestamptz, timestamptz, text) to authenticated;
grant execute on function "public"."admin_analytics_visitors"(timestamptz, timestamptz, text, text, text, int, int) to authenticated;
