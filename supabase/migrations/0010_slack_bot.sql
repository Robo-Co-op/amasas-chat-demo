-- Storage for the Amasas Slack bot (api/slack/events.js).
--
-- Deliberately separate from the web chat's amasas_chat_* tables: Slack
-- history is keyed by workspace + DM/channel thread and must never mix with
-- web sessions. Same trust model as 0001: RLS on with no policies, so only the
-- server-side service_role key can touch these; anon/authenticated get nothing.

-- One row per Slack conversation. key = "<team>:<channel>:<thread_ts|dm>".
-- lock_owner/lock_expires serialize turns within a conversation so two
-- overlapping messages can't interleave their history writes; the lock
-- expires on its own if a function instance dies mid-turn.
create table if not exists public.slack_conversations (
  key text primary key,
  team_id text not null,
  channel_id text not null,
  thread_ts text,
  is_dm boolean not null default false,
  lock_owner text,
  lock_expires timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_slack_conversations_lock
  on public.slack_conversations (lock_expires);

create table if not exists public.slack_messages (
  id bigint generated always as identity primary key,
  conversation_key text not null references public.slack_conversations (key) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  slack_user text,
  slack_ts text,
  sql_log jsonb,
  data_layer text,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists idx_slack_messages_conversation
  on public.slack_messages (conversation_key, id);

-- Dedup ledger. event_key = "<team>:<channel>:<message ts>", so a Slack retry
-- of the same delivery AND the app_mention + message.channels pair Slack sends
-- for one mention in a thread both collapse to a single reply.
create table if not exists public.slack_events (
  event_key text primary key,
  event_id text,
  conversation_key text,
  status text not null default 'processing'
    check (status in ('processing', 'done', 'failed', 'rejected')),
  error text,
  duration_ms integer,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists idx_slack_events_created on public.slack_events (created_at);

alter table public.slack_conversations enable row level security;
alter table public.slack_messages enable row level security;
alter table public.slack_events enable row level security;

-- Atomically record an event; true only for the first delivery.
create or replace function public.slack_claim_event(p_event_key text, p_event_id text, p_conversation_key text)
 returns boolean
 language plpgsql
as $function$
begin
  insert into public.slack_events (event_key, event_id, conversation_key)
  values (p_event_key, p_event_id, p_conversation_key)
  on conflict (event_key) do nothing;
  return found;
end;
$function$;

-- Take the per-conversation turn lock, bounded by a global cap on concurrent
-- Slack turns so Slack can't eat the Gemini quota the web chat also uses.
-- Returns 'ok' | 'busy_conversation' | 'busy_global'. The advisory lock makes
-- the count-then-take step atomic across concurrent function instances.
create or replace function public.slack_acquire_turn(
  p_key text, p_team text, p_channel text, p_thread_ts text, p_is_dm boolean,
  p_owner text, p_ttl_seconds integer, p_max_concurrent integer)
 returns text
 language plpgsql
as $function$
declare
  cur record;
  active integer;
begin
  perform pg_advisory_xact_lock(hashtext('slack_acquire_turn'));

  insert into public.slack_conversations (key, team_id, channel_id, thread_ts, is_dm)
  values (p_key, p_team, p_channel, p_thread_ts, p_is_dm)
  on conflict (key) do nothing;

  select lock_owner, lock_expires into cur from public.slack_conversations where key = p_key for update;
  if cur.lock_expires is not null and cur.lock_expires > now() and cur.lock_owner is distinct from p_owner then
    return 'busy_conversation';
  end if;

  select count(*) into active from public.slack_conversations
  where lock_expires > now() and key <> p_key;
  if active >= p_max_concurrent then
    return 'busy_global';
  end if;

  update public.slack_conversations
  set lock_owner = p_owner, lock_expires = now() + make_interval(secs => p_ttl_seconds), updated_at = now()
  where key = p_key;
  return 'ok';
end;
$function$;

create or replace function public.slack_release_turn(p_key text, p_owner text)
 returns void
 language sql
as $function$
  update public.slack_conversations
  set lock_owner = null, lock_expires = null, updated_at = now()
  where key = p_key and lock_owner = p_owner;
$function$;

-- Functions in public are callable over PostgREST by default; these are for
-- the server's service_role key only.
revoke execute on function public.slack_claim_event(text, text, text) from public, anon, authenticated;
revoke execute on function public.slack_acquire_turn(text, text, text, text, boolean, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.slack_release_turn(text, text) from public, anon, authenticated;
grant execute on function public.slack_claim_event(text, text, text) to service_role;
grant execute on function public.slack_acquire_turn(text, text, text, text, boolean, text, integer, integer) to service_role;
grant execute on function public.slack_release_turn(text, text) to service_role;
