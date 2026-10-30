-- =====================================================================
-- Smart Link Workspace : ยืนยันตัวตน 2 ชั้น (2FA แบบแอป Authenticator / TOTP)
-- =====================================================================
--   * ผู้ที่เปิด 2FA แล้ว ต้องกรอกรหัส 6 หลักทุกครั้งที่เข้าสู่ระบบ จึงจะอ่าน/แก้ข้อมูลได้
--   * นโยบาย (private.settings key = 'mfa_policy')
--       'admins'   ผู้ดูแลต้องเปิด 2FA ก่อนใช้งาน พนักงานเลือกเปิดเองได้ (ค่าเริ่มต้น)
--       'everyone' ทุกบัญชีต้องเปิด 2FA
--       'none'     ไม่บังคับใคร
--     เปลี่ยนได้ด้วย: update private.settings set value = 'everyone' where key = 'mfa_policy';
--   * ตรวจที่ฐานข้อมูล (RLS) ไม่ใช่แค่หน้าเว็บ
--
-- ถ้าผู้ดูแลทำมือถือหายและไม่มีผู้ดูแลคนอื่นรีเซ็ตให้ ลบ 2FA ได้ใน SQL Editor:
--   delete from auth.mfa_factors where user_id = (select id from public.profiles where email = '<อีเมลผู้ดูแล>');
-- =====================================================================

insert into private.settings (key, value) values ('mfa_policy', 'admins')
on conflict (key) do nothing;

create or replace function public.mfa_policy()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select value from private.settings where key = 'mfa_policy'), 'admins');
$$;
revoke execute on function public.mfa_policy() from public, anon;
grant execute on function public.mfa_policy() to authenticated;

-- ผ่านเมื่อ: ยืนยันรหัส 6 หลักแล้วในรอบนี้ (aal2)
--        หรือ ยังไม่ได้เปิด 2FA และนโยบายไม่บังคับบัญชีนี้
create or replace function public.mfa_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or (
        not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
        and case public.mfa_policy()
              when 'everyone' then false
              when 'none' then true
              else not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
            end
      );
$$;
revoke execute on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;

-- ฟังก์ชันตรวจสิทธิ์เดิมต้องผ่าน 2FA ด้วย (ครอบคลุม RPC ที่ข้าม RLS)
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (select 1 from profiles where id = auth.uid() and is_active);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (select 1 from profiles where id = auth.uid() and is_active and is_admin);
$$;

-- กฎเสริม (restrictive) ทุกตาราง : ยังไม่ผ่าน 2FA = เห็นได้แค่ profile ของตัวเอง
do $$
declare
  t text;
begin
  foreach t in array array[
    'roles', 'user_roles', 'categories', 'links', 'link_roles', 'link_user_permissions',
    'favorites', 'personal_link_preferences', 'activity_logs', 'notifications', 'link_checks', 'backup_snapshots'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_mfa', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.mfa_ok()) with check (public.mfa_ok())',
      t || '_mfa', t
    );
  end loop;
end $$;

drop policy if exists profiles_mfa on public.profiles;
create policy profiles_mfa on public.profiles as restrictive for all to authenticated
  using (id = auth.uid() or public.mfa_ok())
  with check (public.mfa_ok());

-- ผู้ดูแลดูได้ว่าใครเปิด 2FA แล้ว
create or replace function public.admin_mfa_users()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select distinct f.user_id from auth.mfa_factors f
  where f.status = 'verified' and public.is_admin();
$$;
revoke execute on function public.admin_mfa_users() from public, anon;
grant execute on function public.admin_mfa_users() to authenticated;
