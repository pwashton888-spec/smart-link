-- =====================================================================
-- Smart Link Workspace : เพิ่มตำแหน่งงาน HR (ฝ่ายบุคคล) + หมวด "เว็บไซต์ HR"
-- รันซ้ำได้ปลอดภัย (ถ้ามีอยู่แล้วจะไม่สร้างซ้ำ)
-- =====================================================================

insert into public.roles (code, name, description, color, sort_order) values
  ('hr', 'HR', 'งานทรัพยากรบุคคล', '#2563eb', 6)
on conflict (code) do nothing;

-- เลื่อนหมวดระบบ (ส่วนตัว / ที่ใช้บ่อย) ลงไป 1 ลำดับ ให้หมวด HR อยู่ต่อจากหมวดตำแหน่งอื่น
update public.categories set sort_order = sort_order + 1
where slug in ('personal', 'frequent') and sort_order in (7, 8)
  and not exists (select 1 from public.categories where slug = 'hr');

insert into public.categories (slug, name, description, icon, color, role_id, sort_order, is_system) values
  ('hr', 'เว็บไซต์ HR', 'ลิงก์สำหรับฝ่าย HR', 'Users', '#2563eb', (select id from public.roles where code = 'hr'), 7, false)
on conflict (slug) do nothing;
