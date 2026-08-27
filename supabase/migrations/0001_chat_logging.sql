-- Chat logging tables for the AMASAS chat demo.
-- These mirror EXACTLY what api/chat.js and api/feedback.js write, in the
-- `public` schema (the schema PostgREST exposes, which the code addresses with
-- unqualified table names like /rest/v1/amasas_chat_sessions).
--
-- NOTE: the AMASAS/ai/knowledge DATA schemas and the read-only RPC gateway
-- functions the app READS from (amasas_query, ai_query) are NOT created here.
-- They are an external dependency that must be imported from the source
-- database. See README ("DBについて") until that import lands.

create table if not exists public.amasas_chat_sessions (
  id text primary key,
  role_tag text,
  nickname text,
  created_at timestamptz not null default now()
);

create table if not exists public.amasas_chat_messages (
  id bigint generated always as identity primary key,
  session_id text not null references public.amasas_chat_sessions (id),
  turn integer not null,
  role text not null,
  content text,
  sql_log jsonb,
  data_layer text,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists idx_amasas_chat_messages_session
  on public.amasas_chat_messages (session_id, turn);

create table if not exists public.amasas_chat_feedback (
  id bigint generated always as identity primary key,
  message_id bigint not null references public.amasas_chat_messages (id),
  verdict text not null check (verdict in ('ok', 'ng')),
  comment text,
  created_at timestamptz not null default now()
);

-- Writes happen only server-side (api/*.js) with the service_role key, which
-- bypasses RLS. Enable RLS with no policies so the public anon key can neither
-- read nor write these logs.
alter table public.amasas_chat_sessions enable row level security;
alter table public.amasas_chat_messages enable row level security;
alter table public.amasas_chat_feedback enable row level security;
