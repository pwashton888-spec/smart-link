-- =====================================================================
-- ข้อมูลเริ่มต้น : ตำแหน่งงาน 5 ตำแหน่ง และหมวดหมู่ 8 หมวด
-- (ไม่มีการสร้างบัญชีผู้ใช้หรือรหัสผ่านใด ๆ ในไฟล์นี้)
-- =====================================================================

insert into public.roles (code, name, description, color, sort_order) values
  ('ceo',            'CEO',              'ประธานเจ้าหน้าที่บริหาร',            '#0f2a5c', 1),
  ('secretary',      'เลขานุการ',         'งานเลขานุการและประสานงาน',           '#7c3aed', 2),
  ('finance',        'การเงิน',           'งานการเงินและบัญชี',                 '#059669', 3),
  ('marketing',      'การตลาด',           'งานการตลาดและการสื่อสาร',            '#e11d48', 4),
  ('exec_assistant', 'ผู้ช่วยผู้บริหาร',     'งานสนับสนุนผู้บริหาร',               '#0891b2', 5)
on conflict (code) do nothing;

insert into public.categories (slug, name, description, icon, color, role_id, sort_order, is_system) values
  ('global',         'เว็บไซต์ส่วนกลาง',        'ลิงก์ที่พนักงานทุกคนใช้ร่วมกัน',      'Globe',         '#0f2a5c', null, 1, true),
  ('ceo',            'เว็บไซต์ CEO',           'ลิงก์สำหรับ CEO',                    'Crown',         '#0f2a5c', (select id from public.roles where code = 'ceo'), 2, false),
  ('secretary',      'เว็บไซต์เลขานุการ',        'ลิงก์สำหรับเลขานุการ',                'CalendarClock', '#7c3aed', (select id from public.roles where code = 'secretary'), 3, false),
  ('finance',        'เว็บไซต์การเงิน',          'ลิงก์สำหรับฝ่ายการเงิน',              'Wallet',        '#059669', (select id from public.roles where code = 'finance'), 4, false),
  ('marketing',      'เว็บไซต์การตลาด',         'ลิงก์สำหรับฝ่ายการตลาด',             'Megaphone',     '#e11d48', (select id from public.roles where code = 'marketing'), 5, false),
  ('exec_assistant', 'เว็บไซต์ผู้ช่วยผู้บริหาร',    'ลิงก์สำหรับผู้ช่วยผู้บริหาร',           'Briefcase',     '#0891b2', (select id from public.roles where code = 'exec_assistant'), 6, false),
  ('personal',       'เว็บไซต์ส่วนตัว',          'ลิงก์ที่พนักงานเพิ่มเอง',              'User',          '#14a3a0', null, 7, true),
  ('frequent',       'เว็บไซต์ที่ใช้บ่อย',        'ลิงก์ที่ใช้งานเป็นประจำ',              'Flame',         '#f59e0b', null, 8, true)
on conflict (slug) do nothing;
