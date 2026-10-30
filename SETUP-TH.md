# คู่มือตั้งค่า Smart Link Workspace กับ Supabase (ทำครั้งเดียว ประมาณ 10 นาที)

โปรเจกต์ Supabase: `https://enzunufmyowzlxnqkisc.supabase.co`

## ขั้นที่ 1 สร้างฐานข้อมูล
1. เปิด Supabase Dashboard > โปรเจกต์ของคุณ > **SQL Editor** > **New query**
2. เปิดไฟล์ [`supabase/setup.sql`](supabase/setup.sql) คัดลอก **ทั้งไฟล์** ไปวาง แล้วกด **Run**
3. ต้องขึ้นว่า `Success. No rows returned` ถ้ามี error ให้คัดลอกข้อความ error ส่งมาให้ Claude

4. รันคำสั่งนี้อีกครั้งใน New query เพื่อให้งานตรวจลิงก์อัตโนมัติทุกเช้ารู้ที่อยู่โปรเจกต์ (anon key ดูได้ที่ Project Settings > API)
   ```sql
   insert into private.settings (key, value) values
     ('project_url', 'https://<project-ref>.supabase.co'),
     ('anon_key', '<anon key>')
   on conflict (key) do update set value = excluded.value;
   ```

ขั้นนี้จะสร้างตารางทั้งหมด, Row Level Security, ประวัติการใช้งาน, ที่เก็บไอคอน และข้อมูลเริ่มต้น (5 ตำแหน่ง, 8 หมวดหมู่)

## ขั้นที่ 2 ตั้งค่าการเข้าสู่ระบบ
1. **Authentication > Sign In / Providers > Email**: ปิด **Allow new users to sign up** (ให้เฉพาะผู้ดูแลสร้างบัญชี) แล้วกด Save
2. **Authentication > URL Configuration**
   - **Site URL**: ที่อยู่เว็บที่ใช้งานจริง (ถ้ายังไม่มี ใช้ `http://localhost:5173` ไปก่อน)
   - **Redirect URLs**: เพิ่ม `http://localhost:5173/reset-password` และ `https://<โดเมนจริง>/reset-password`
3. (แนะนำ) **Project Settings > Authentication > SMTP Settings**: ใส่ SMTP ของบริษัท เพราะอีเมลของ Supabase เองส่งได้จำกัดต่อชั่วโมง

## ขั้นที่ 3 เปิดบริการเชิญพนักงาน/ระงับบัญชี (Edge Function)
1. **Edge Functions > Deploy a new function > Via Editor**
2. ตั้งชื่อ function ว่า `admin-users` (ต้องตรงตัวนี้)
3. ลบโค้ดตัวอย่าง แล้ววางโค้ดจากไฟล์ [`supabase/functions/admin-users/index.ts`](supabase/functions/admin-users/index.ts) กด **Deploy**
4. ไม่ต้องตั้งค่า key เพิ่ม Supabase ใส่ `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ให้อัตโนมัติ
5. ทำซ้ำอีกครั้งสำหรับ function ตรวจลิงก์: ตั้งชื่อ `check-links` แล้ววางโค้ดจาก [`supabase/functions/check-links/index.ts`](supabase/functions/check-links/index.ts)

> ในหน้า Editor ชื่อไฟล์ทางซ้ายต้องเป็น `index.ts` เสมอ ส่วนชื่อ function (`admin-users` / `check-links`) ใส่ในช่องชื่อ function

## ขั้นที่ 4 สร้างผู้ดูแลระบบคนแรก (ไม่มีรหัสผ่านเริ่มต้น)
1. **Authentication > Users > Add user > Send invitation** ใส่อีเมลของคุณ
2. เปิดอีเมลเชิญ กดลิงก์ แล้วตั้งรหัสผ่านเอง
3. กลับไปที่ **SQL Editor** รันคำสั่งนี้ (เปลี่ยนอีเมลให้ตรง):
   ```sql
   update public.profiles set is_admin = true where email = 'pw.ashton888@gmail.com';
   ```
4. เข้าสู่ระบบในเว็บ จะเห็นเมนู "ผู้ดูแลระบบ" จากนั้นเพิ่มพนักงานคนอื่นได้จากหน้า **จัดการพนักงาน**

## ขั้นที่ 5 เปิดใช้งานเว็บ
**ทดลองในเครื่อง**

Windows: ดับเบิลคลิกไฟล์ `start-windows.bat` ในโฟลเดอร์โปรเจกต์ (ติดตั้งและเปิดเว็บให้อัตโนมัติ)

Mac/Linux:
```bash
npm install
cp .env.example .env.local   # แล้วใส่ค่าด้านล่าง
npm run dev                  # เปิด http://localhost:5173
```

**ขึ้นเว็บจริง (เช่น Vercel)**: Import repo `smart-link` แล้วตั้ง Environment Variables 2 ตัว (มีไฟล์ `vercel.json` ให้แล้ว)
```
VITE_SUPABASE_URL=https://enzunufmyowzlxnqkisc.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key ของโปรเจกต์>
```
anon key เป็น key สาธารณะที่ใช้ฝั่งเว็บได้ (ข้อมูลถูกป้องกันด้วย RLS) **ห้าม** ใส่ service role key ในเว็บเด็ดขาด

## อัปเดตระบบแจ้งเตือน (สำหรับผู้ที่ติดตั้งก่อน 29 ต.ค. 2569)
ถ้าเคยรัน `setup.sql` ไปแล้ว **ไม่ต้องรันใหม่ทั้งไฟล์** (จะขึ้น error ว่าตารางมีอยู่แล้ว) ให้ทำ 3 อย่างนี้แทน
1. **SQL Editor** > New query > วางไฟล์ [`supabase/migrations/20261029000001_notifications.sql`](supabase/migrations/20261029000001_notifications.sql) แล้วกด **Run**
2. Deploy Edge Function `check-links` ตามขั้นที่ 3 ข้อ 5
3. ปิดหน้าต่าง start-windows.bat เดิม แล้วเปิดเว็บจากไฟล์โปรเจกต์ชุดใหม่ (หรือ Vercel จะ deploy ใหม่ให้เองเมื่อโค้ดอัปเดต)

**ใช้งาน**
- ไอคอนกระดิ่งมุมขวาบน: แจ้งเตือนเมื่อมีลิงก์ส่วนกลางใหม่ (พนักงานทุกคนได้รับ ยกเว้นผู้สร้าง) และเมื่อพบลิงก์เสีย (เฉพาะผู้ดูแลระบบ)
- หน้า **จัดการลิงก์** > ปุ่ม **ตรวจสอบลิงก์ทั้งหมด**: ตรวจทุกลิงก์ที่เปิดใช้งาน ลิงก์ที่เปิดไม่ได้จะขึ้นป้าย "ลิงก์เสีย" และแจ้งเตือนผู้ดูแลทุกคน (ลิงก์ที่เสียต่อเนื่องจะไม่แจ้งซ้ำ)
- การตรวจทำจากเซิร์ฟเวอร์ของ Supabase เว็บภายในที่ต้องใช้ VPN จึงอาจขึ้นว่าเสียทั้งที่เปิดได้ในออฟฟิศ ส่วนเว็บที่ต้องเข้าสู่ระบบก่อน (ตอบกลับ 401/403) ถือว่าใช้ได้

## อัปเดตบัญชีชื่อผู้ใช้ + งานอัตโนมัติ (สำหรับผู้ที่ติดตั้งก่อน 30 ต.ค. 2569)
1. **SQL Editor** > New query > วางไฟล์ [`20261030000001_username_login.sql`](supabase/migrations/20261030000001_username_login.sql) แล้ว Run
2. New query > วางไฟล์ [`20261030000002_scheduled_jobs.sql`](supabase/migrations/20261030000002_scheduled_jobs.sql) แล้ว Run จากนั้นรันคำสั่ง `insert into private.settings ...` ตามขั้นที่ 1 ข้อ 4
3. อัปเดตโค้ด Edge Function ทั้ง 2 ตัว: Edge Functions > เลือก function > แท็บ **Code** > วางโค้ดใหม่จาก [`admin-users`](supabase/functions/admin-users/index.ts) และ [`check-links`](supabase/functions/check-links/index.ts) แล้วกด **Deploy updates**

**ใช้งาน**
- **จัดการพนักงาน > เพิ่มพนักงาน > ชื่อผู้ใช้ + รหัสผ่าน**: ตั้งชื่อผู้ใช้และรหัสผ่านชั่วคราว (กดสุ่มได้) แล้วกดคัดลอกข้อมูลส่งให้พนักงาน เมื่อพนักงานเข้าสู่ระบบครั้งแรก ระบบจะบังคับให้ตั้งรหัสผ่านใหม่
- ปุ่มรูปกุญแจในรายชื่อพนักงาน: ตั้งรหัสผ่านชั่วคราวใหม่ให้พนักงานที่ลืมรหัสผ่าน
- ตรวจลิงก์อัตโนมัติทุกวัน 08:00 น. และแจ้งผู้ดูแลเมื่อพบลิงก์เสีย
- สำรองข้อมูลอัตโนมัติทุกคืนวันอาทิตย์ ดู ดาวน์โหลด หรือกู้คืนได้ที่หน้า **สำรอง/กู้คืนข้อมูล** (เก็บ 8 สัปดาห์ล่าสุด)
- ล้างการแจ้งเตือนที่อ่านแล้วเกิน 90 วันทุกต้นเดือน
- ดูสถานะงานอัตโนมัติได้ที่ Supabase > **Integrations > Cron**

## อัปเดตยืนยันตัวตน 2 ชั้น (2FA) (สำหรับผู้ที่ติดตั้งก่อน 31 ต.ค. 2569)
1. **SQL Editor** > New query > วางไฟล์ [`20261031000001_mfa.sql`](supabase/migrations/20261031000001_mfa.sql) แล้ว Run
2. อัปเดตโค้ด Edge Function ทั้ง 2 ตัวอีกครั้ง ([`admin-users`](supabase/functions/admin-users/index.ts) และ [`check-links`](supabase/functions/check-links/index.ts)) แล้วกด **Deploy updates**

**ใช้งาน**
- ผู้ดูแลระบบต้องตั้ง 2FA ก่อนใช้งาน: เข้าสู่ระบบแล้วสแกน QR ด้วยแอป Google Authenticator หรือ Microsoft Authenticator แล้วกรอกรหัส 6 หลัก
- พนักงานเปิด 2FA เองได้ที่หน้า **โปรไฟล์**
- พนักงานทำมือถือหาย: **จัดการพนักงาน** > ปุ่มรูปโล่ (รีเซ็ต 2FA)
- เปลี่ยนนโยบาย: `update private.settings set value = 'everyone' where key = 'mfa_policy';` (`admins` = บังคับผู้ดูแล, `everyone` = บังคับทุกคน, `none` = ไม่บังคับ)
- ผู้ดูแลคนเดียวทำมือถือหาย: SQL Editor รัน `delete from auth.mfa_factors where user_id = (select id from public.profiles where email = '<อีเมลผู้ดูแล>');`
