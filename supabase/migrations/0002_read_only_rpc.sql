-- Read-only SQL gateway used by api/chat.js (Gemini function calling).
--
-- These are the ACTUAL functions extracted verbatim (pg_get_functiondef) from
-- the source database, not a reconstruction. Both are SECURITY INVOKER: they
-- run with the CALLER's privileges (the PostgREST `anon` role), so the real
-- security boundary is what `anon` is granted — anon has USAGE/SELECT only on
-- the amasas/ai/knowledge (open) data, and nothing on auth/storage/vault, so a
-- query like `select * from auth.users` fails with permission denied on its own.
-- The in-function checks (SELECT/WITH only, single statement, ai-schema guard,
-- 5s timeout, 500-row cap) are UX/defense-in-depth on top of that boundary.
--
-- anon/authenticated also need USAGE + SELECT on the data schemas for these to
-- return rows; those grants ship with the data-import migration (0003).

create or replace function public.ai_query(query text)
 returns jsonb
 language plpgsql
 set search_path to 'ai'
as $function$
declare
  q text := btrim(query, E' \n\r\t');
  result jsonb;
  errmsg text;
  cols jsonb;
  metrics jsonb;
begin
  if q !~* '^[\s]*(select|with)[\s(]' then
    return jsonb_build_object('error', 'SELECT/WITHで始まる読み取りクエリのみ実行できます');
  end if;
  if position(';' in rtrim(q, E'; \n\r\t')) > 0 then
    return jsonb_build_object('error', '複数ステートメントは実行できません');
  end if;
  if q ~* '(amasas|public|pg_catalog|information_schema)\s*\.' then
    return jsonb_build_object('error', 'aiスキーマのオブジェクトのみ参照できます(例: ai.facts, ai.kpis)。ai.catalogで一覧を確認してください');
  end if;
  perform set_config('statement_timeout', '5000', true);
  begin
    execute format('select coalesce(jsonb_agg(s), ''[]''::jsonb) from (select * from (%s) inner_q limit 500) s', rtrim(q, E'; \n\r\t'))
      into result;
    -- factsへの絞り込みが0件: dataset/metricの実在値を耳打ち
    if result = '[]'::jsonb and q ~* 'facts' and q ~* '(dataset|metric)' then
      select jsonb_agg(jsonb_build_array(dataset, metric) order by dataset, metric) into metrics
      from (select distinct dataset, metric from ai.facts) m;
      return jsonb_build_object(
        'rows', '[]'::jsonb,
        'hint', '0件でした。dataset/metricの値が実在と一致していない可能性があります。以下の実在一覧[dataset, metric]から選び直してください。「データがない」と答えるのは、一覧に該当が本当に無い場合だけにしてください',
        'existing_dataset_metric', metrics
      );
    end if;
    return result;
  exception when others then
    get stacked diagnostics errmsg = message_text;
    select coalesce(jsonb_object_agg(rel, col_list), '{}'::jsonb) into cols
    from (
      select distinct m[1] as rel,
        (select jsonb_agg(c.column_name order by c.ordinal_position)
         from information_schema.columns c
         where c.table_schema = 'ai' and c.table_name = m[1]) as col_list
      from regexp_matches(lower(q), '(?:ai\.)?([a-z_]+)', 'g') as m
    ) s
    where col_list is not null;
    return jsonb_build_object(
      'error', errmsg,
      'existing_columns', cols,
      'hint', 'existing_columnsにある実在の列名だけを使ってSQLを書き直してください'
    );
  end;
end;
$function$;

create or replace function public.amasas_query(query text)
 returns jsonb
 language plpgsql
 set search_path to 'amasas', 'public'
as $function$
declare
  q text := btrim(query, E' \n\r\t');
  result jsonb;
  errmsg text;
  cols jsonb;
begin
  if q !~* '^[\s]*(select|with)[\s(]' then
    return jsonb_build_object('error', 'SELECT/WITHで始まる読み取りクエリのみ実行できます');
  end if;
  if position(';' in rtrim(q, E'; \n\r\t')) > 0 then
    return jsonb_build_object('error', '複数ステートメントは実行できません');
  end if;
  perform set_config('statement_timeout', '5000', true);
  begin
    execute format('select coalesce(jsonb_agg(s), ''[]''::jsonb) from (select * from (%s) inner_q limit 500) s', rtrim(q, E'; \n\r\t'))
      into result;
    return result;
  exception when others then
    get stacked diagnostics errmsg = message_text;
    select coalesce(jsonb_object_agg(rel, col_list), '{}'::jsonb) into cols
    from (
      select distinct m[1] as rel,
        (select jsonb_agg(c.column_name order by c.ordinal_position)
         from information_schema.columns c
         where c.table_schema = 'amasas' and c.table_name = m[1]) as col_list
      from regexp_matches(lower(q), 'amasas\.([a-z0-9_]+)', 'g') as m
    ) s
    where col_list is not null;
    return jsonb_build_object(
      'error', errmsg,
      'existing_columns', cols,
      'hint', 'existing_columnsにある実在の列名だけを使ってSQLを書き直してください'
    );
  end;
end;
$function$;

grant execute on function public.amasas_query(text) to anon, authenticated, service_role;
grant execute on function public.ai_query(text) to anon, authenticated, service_role;
