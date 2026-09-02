-- Fixes: deleting an admin via admin_delete_user (0007) fails with a foreign
-- key violation for virtually every real account, because three references
-- to admin.admin_users(id) were left at the implicit default of NO ACTION:
--
--   admin_audit_log.actor_id  -- every login updates last_login_at, which is
--                                 itself audit-logged with the same user as
--                                 actor_id -- so any admin who has ever
--                                 signed in blocks their own deletion.
--   admin_settings.updated_by -- blocks deletion of any admin who has ever
--                                 saved a setting (e.g. maintenance mode).
--   admin_users.created_by    -- blocks deletion of any admin who has ever
--                                 invited another admin.
--
-- All three become ON DELETE SET NULL rather than CASCADE: the historical
-- record should survive the actor being deleted, not disappear with them
-- (admin_audit_log.actor_email is already a plain-text snapshot captured at
-- insert time for exactly this reason -- it's unaffected either way).

alter table "admin"."admin_audit_log" drop constraint if exists "admin_audit_log_actor_id_fkey";
alter table "admin"."admin_audit_log"
  add constraint "admin_audit_log_actor_id_fkey"
  foreign key ("actor_id") references "admin"."admin_users" ("id") on delete set null;

alter table "admin"."admin_settings" drop constraint if exists "admin_settings_updated_by_fkey";
alter table "admin"."admin_settings"
  add constraint "admin_settings_updated_by_fkey"
  foreign key ("updated_by") references "admin"."admin_users" ("id") on delete set null;

alter table "admin"."admin_users" drop constraint if exists "admin_users_created_by_fkey";
alter table "admin"."admin_users"
  add constraint "admin_users_created_by_fkey"
  foreign key ("created_by") references "admin"."admin_users" ("id") on delete set null;
