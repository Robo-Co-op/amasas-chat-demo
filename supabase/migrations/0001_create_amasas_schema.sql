-- Creates the `amasas` schema in the shared Robo Co-op Supabase database (rzuvdnishrxosjkopcyp).
-- Mirrors the existing per-project convention already used by `robocoop` and `shimaai`
-- (admin_users / analytics_events / forms / form_questions / form_submissions / site_content),
-- plus chat-app tables matching what api/chat.js and api/feedback.js already write
-- (previously logged to a separate Supabase project as amasas_chat_sessions/messages/feedback).

create schema if not exists amasas;

-- === Admin dashboard / CMS tables (matches robocoop schema shape) ===

create table amasas.admin_users (
  id bigserial primary key,
  email text not null,
  name text not null,
  password_hash text not null default '',
  role text not null default 'viewer',
  status text not null default 'active',
  invite_token text,
  invite_expires_at timestamptz,
  reset_token text,
  reset_expires_at timestamptz,
  created_at timestamptz default now(),
  last_login timestamptz,
  constraint admin_users_email_key unique (email)
);

create table amasas.analytics_events (
  id bigserial primary key,
  session_id text,
  event_type text,
  page text,
  lang text,
  referrer text,
  user_agent text,
  created_at timestamptz default now()
);
create index idx_amasas_analytics_event_type on amasas.analytics_events (event_type, created_at desc);
create index idx_amasas_analytics_created_at on amasas.analytics_events (created_at desc);

create table amasas.forms (
  id bigserial primary key,
  slug text not null,
  lang text not null default 'en',
  title text not null,
  description text default '',
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint forms_slug_key unique (slug)
);

create table amasas.form_questions (
  id bigserial primary key,
  form_id bigint not null references amasas.forms(id),
  sort_order integer default 0,
  step integer default 1,
  field_name text not null,
  field_type text not null default 'text',
  label text not null default '',
  hint text default '',
  placeholder text default '',
  required integer default 0,
  options_json text default '[]',
  max_length integer,
  active integer default 1,
  created_at timestamptz default now()
);
create index idx_amasas_form_questions_form_id on amasas.form_questions (form_id, sort_order);

create table amasas.form_submissions (
  id bigserial primary key,
  form_id bigint references amasas.forms(id),
  form_slug text,
  data_json text default '{}',
  name text,
  email text,
  lang text default 'en',
  submitted_at timestamptz default now(),
  ip_address text,
  notes text,
  status text default 'new'
);
create index idx_amasas_form_submissions_slug on amasas.form_submissions (form_slug, submitted_at desc);

create table amasas.site_content (
  id bigserial primary key,
  content_key text not null,
  lang text not null default 'en',
  value text,
  updated_at timestamptz default now(),
  constraint site_content_content_key_lang_key unique (content_key, lang)
);

-- === Chat app tables (matches current api/chat.js + api/feedback.js writes) ===

create table amasas.chat_sessions (
  id text primary key,
  role_tag text,
  nickname text,
  created_at timestamptz default now()
);

create table amasas.chat_messages (
  id bigserial primary key,
  session_id text not null references amasas.chat_sessions(id),
  turn integer not null,
  role text not null,
  content text,
  sql_log jsonb,
  data_layer text,
  model text,
  created_at timestamptz default now()
);
create index idx_amasas_chat_messages_session on amasas.chat_messages (session_id, turn);

create table amasas.chat_feedback (
  id bigserial primary key,
  message_id bigint not null references amasas.chat_messages(id),
  verdict text not null check (verdict in ('ok', 'ng')),
  comment text,
  created_at timestamptz default now()
);
