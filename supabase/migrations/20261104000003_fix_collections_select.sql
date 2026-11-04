-- =====================================================================
-- Smart Link Workspace : แก้ "คุณไม่มีสิทธิ์ทำรายการนี้" ตอนสร้างชุดลิงก์
-- =====================================================================
-- กฎการอ่านชุดลิงก์เดิมเรียกฟังก์ชันที่ค้นหาแถวจากตาราง ซึ่งยังมองไม่เห็นแถวที่เพิ่งสร้าง
-- ในคำสั่งเดียวกัน (insert ... returning) จึงถูกปฏิเสธ แก้ให้ตรวจจากค่าของแถวโดยตรง
-- รันซ้ำได้ปลอดภัย
-- =====================================================================

drop policy if exists collections_select on public.collections;
create policy collections_select on public.collections for select to authenticated
  using (
    public.is_active_user()
    and (
      owner_id = auth.uid()
      or (owner_id is null and (
            public.is_admin()
            or cardinality(role_ids) = 0
            or exists (
              select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
              where ur.user_id = auth.uid() and r.is_active and ur.role_id = any (role_ids)
            )
      ))
    )
  );

-- จำกัดชุดส่วนตัว 50 ชุดต่อคน : นับผ่านฟังก์ชัน (กันกฎสิทธิ์อ้างถึงตารางตัวเองวนซ้ำ)
create or replace function public.my_collection_count()
returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from collections where owner_id = auth.uid();
$$;
revoke execute on function public.my_collection_count() from anon;

drop policy if exists collections_owner_insert on public.collections;
create policy collections_owner_insert on public.collections for insert to authenticated
  with check (owner_id = auth.uid() and public.is_active_user() and public.my_collection_count() < 50);
