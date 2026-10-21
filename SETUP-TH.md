# คู่มือตั้งค่า Smart Link Workspace กับ Supabase (ทำครั้งเดียว ประมาณ 10 นาที)

โปรเจกต์ Supabase: `https://enzunufmyowzlxnqkisc.supabase.co`

## ขั้นที่ 1 สร้างฐานข้อมูล
1. เปิด Supabase Dashboard > โปรเจกต์ของคุณ > **SQL Editor** > **New query**
2. เปิดไฟล์ [`supabase/setup.sql`](supabase/setup.sql) คัดลอก **ทั้งไฟล์** ไปวาง แล้วกด **Run**
3. ต้องขึ้นว่า `Success. No rows returned` ถ้ามี error ให้คัดลอกข้อความ error ส่งมาให้ Claude

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
