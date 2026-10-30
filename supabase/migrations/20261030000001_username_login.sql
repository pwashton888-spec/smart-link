-- =====================================================================
-- Smart Link Workspace : บัญชีแบบชื่อผู้ใช้ + รหัสผ่านชั่วคราว
-- =====================================================================
--   * ผู้ดูแลสร้างบัญชีให้พนักงานด้วยชื่อผู้ใช้และรหัสผ่านชั่วคราว (ผ่าน Edge Function admin-users)
--     ระบบ Auth ต้องใช้อีเมล จึงเก็บเป็น <ชื่อผู้ใช้>@smartlink.local (ไม่มีการส่งอีเมลจริง)
--   * must_change_password = true : พนักงานต้องตั้งรหัสผ่านใหม่ก่อนใช้งาน
-- =====================================================================

alter table public.profiles
  add column username text unique check (username ~ '^[a-z0-9._-]{3,30}$'),
  add column must_change_password boolean not null default false;

-- พนักงานยืนยันว่าตั้งรหัสผ่านใหม่แล้ว (แก้ได้เฉพาะของตัวเอง)
create or replace function public.clear_must_change_password()
returns void language sql security definer set search_path = public as $$
  update profiles set must_change_password = false where id = auth.uid();
$$;
revoke execute on function public.clear_must_change_password() from anon;
