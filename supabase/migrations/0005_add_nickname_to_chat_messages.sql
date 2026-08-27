-- ニックネーム・お立場を会話ログ(amasas_chat_messages)に直接持たせる。
-- 従来はamasas_chat_sessions側にしかなく、messagesだけを見ても
-- 誰の会話かは分からなかった（joinしないと出てこなかった）
alter table public.amasas_chat_messages
  add column if not exists nickname text,
  add column if not exists role_tag text;

-- 既存行は、それぞれが属するセッション側の値で埋める
update public.amasas_chat_messages m
set nickname = s.nickname,
    role_tag = s.role_tag
from public.amasas_chat_sessions s
where m.session_id = s.id
  and (m.nickname is distinct from s.nickname or m.role_tag is distinct from s.role_tag);
