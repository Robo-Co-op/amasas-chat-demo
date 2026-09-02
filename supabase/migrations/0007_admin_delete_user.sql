-- Lets owner permanently remove another admin console user (unlike
-- admin_set_user's is_active toggle, which only blocks login but keeps the
-- account/row around). owner-only, deliberately not extended to admin --
-- matches the same escalation posture as admin_set_user/admin_register_user,
-- just stricter since deletion is irreversible.

create or replace function "public"."admin_delete_user"(target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = "admin", pg_temp
as $$
declare
  caller_role text := "admin"."current_role"();
  result jsonb;
begin
  if caller_role is null or caller_role <> 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target_id = auth.uid() then
    raise exception 'cannot delete your own account';
  end if;

  delete from "admin"."admin_users" where id = target_id
    returning to_jsonb("admin_users".*) into result;
  if result is null then
    raise exception 'user not found';
  end if;

  return result;
end;
$$;

revoke all on function "public"."admin_delete_user"(uuid) from public;
grant execute on function "public"."admin_delete_user"(uuid) to authenticated;
