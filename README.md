# Smart Link Workspace

ศูนย์กลางลิงก์และเครื่องมือทำงานภายในองค์กร: React + TypeScript + Tailwind + shadcn/ui + Supabase (Auth, RLS, Storage)

## ฟีเจอร์ (MVP)

- **เข้าสู่ระบบ** ด้วยอีเมล/รหัสผ่าน, ลืมรหัสผ่าน, ตั้งรหัสผ่านจากอีเมลเชิญ, ออกจากระบบ (ปิดการสมัครเอง)
- **Multi-Role**: พนักงาน 1 คนมีหลายตำแหน่ง ระบบรวมลิงก์จากทุกตำแหน่ง + ลิงก์ส่วนกลาง + ลิงก์เฉพาะบุคคล + ลิงก์ส่วนตัว โดยไม่ซ้ำ และกรองตามตำแหน่งได้
- **Dashboard**: ข้อความต้อนรับ ตำแหน่ง จำนวนลิงก์ รายการโปรด ใช้งานล่าสุด ลิงก์แนะนำ ใช้บ่อย ส่วนกลาง แยกตามตำแหน่ง หมวดหมู่ มุมมอง Grid/List
- **Smart Search**: ค้นหาแบบ real-time จากชื่อ คำอธิบาย หมวดหมู่ แท็ก ตำแหน่ง (`Ctrl/⌘ + K` ได้ทุกหน้า)
- **Popup รายละเอียดลิงก์** + Quick Launch (เปิดทันทีโดยไม่ผ่าน Popup) ไม่ใช้ iframe
- **พื้นที่ส่วนตัว**: ปักหมุด/จัดเรียง Drag & Drop, ลิงก์ส่วนตัว (เพิ่ม/แก้/ลบ/จัดเรียง), ซ่อนลิงก์จาก Dashboard, ประวัติล่าสุด
- **Admin Panel**: จัดการลิงก์ (สิทธิ์หลายตำแหน่ง + รายบุคคล, ไอคอน/อัปโหลด, แท็ก, กลุ่ม, แนะนำ, เปิด/ปิด, จัดลำดับ, ทดสอบลิงก์), พนักงาน (เชิญ, หลายตำแหน่ง, สิทธิ์ผู้ดูแล, ระงับ, ส่งลิงก์รีเซ็ต, ประวัติเข้าสู่ระบบ), หมวดหมู่, ตำแหน่งงาน, ประวัติการใช้งาน, สำรอง/กู้คืนข้อมูล (JSON)
- **การแจ้งเตือน** (กระดิ่งมุมขวาบน, Realtime): ลิงก์ส่วนกลางใหม่ → พนักงานทุกคน / ตรวจพบลิงก์เสีย → ผู้ดูแลทุกคน
- **ตรวจสอบลิงก์ทั้งหมด** จากฝั่งเซิร์ฟเวอร์ (Edge Function `check-links`) แสดงป้ายลิงก์เสีย และกรองดูเฉพาะลิงก์เสียได้
- Dark/Light mode, Responsive, Loading skeleton, Empty/Error states, ภาษาไทยทั้งระบบ

## ความปลอดภัย

- สิทธิ์ตรวจที่ฐานข้อมูลด้วย **Row Level Security** ทุกตาราง (`supabase/migrations/20261020000001_schema.sql`) ไม่ใช่แค่ซ่อนเมนู
- สิทธิ์ผู้ดูแล (`profiles.is_admin`) แยกจากตำแหน่งงาน ผู้ใช้ทั่วไปแก้สิทธิ์ตัวเองไม่ได้ และมี trigger กันการปลดผู้ดูแลคนสุดท้าย
- ลิงก์ส่วนตัวเห็นได้เฉพาะเจ้าของ (ผู้ดูแลก็มองไม่เห็น และไม่ถูกบันทึกลง log)
- บัญชีที่ถูกระงับ: RLS ปฏิเสธทุกการอ่าน + ban ที่ระดับ Auth ผ่าน Edge Function
- ตรวจ URL (อนุญาตเฉพาะ http/https) ทั้งฝั่งหน้าเว็บและ check constraint ในฐานข้อมูล ก่อนบันทึกและก่อนเปิด
- Audit log อัตโนมัติด้วย trigger (เพิ่ม/แก้ไข/ลบ ลิงก์ หมวดหมู่ ตำแหน่ง สิทธิ์ บัญชี) + การเข้าสู่ระบบ
- ไม่มีรหัสผ่านเริ่มต้นใด ๆ ในโค้ด ไม่เก็บรหัสผ่านเว็บไซต์ภายนอก
- เมื่อผู้ดูแลเปลี่ยนสิทธิ์ หน้าเว็บของพนักงานโหลดสิทธิ์ใหม่ทันทีผ่าน Supabase Realtime (และทุกครั้งที่กลับมาที่หน้าต่าง)

## โครงสร้างฐานข้อมูล

`profiles`, `roles`, `user_roles` (M:N พนักงาน-ตำแหน่ง), `links`, `link_roles` (M:N ลิงก์-ตำแหน่ง), `link_user_permissions` (ลิงก์-พนักงาน), `categories`, `favorites`, `personal_link_preferences` (ซ่อน/ล่าสุด/จำนวนครั้ง), `activity_logs`, `notifications`, `link_checks` (ผลตรวจลิงก์ล่าสุด)

`links.visibility`: `global` (ส่วนกลาง) / `restricted` (ตามตำแหน่ง และ/หรือ เฉพาะบุคคล) / `personal` (ลิงก์ส่วนตัวของเจ้าของ)

## การติดตั้ง

> คู่มือภาษาไทยแบบทีละขั้นผ่าน Supabase Dashboard (ไม่ต้องใช้ CLI): [SETUP-TH.md](SETUP-TH.md)

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com)
2. รัน migration (เลือกวิธีใดวิธีหนึ่ง)
   - Supabase CLI: `npx supabase link --project-ref <ref>` แล้ว `npx supabase db push`
   - หรือคัดลอกไฟล์ใน `supabase/migrations/` ไปรันใน SQL Editor ตามลำดับ
3. Deploy Edge Functions: `npx supabase functions deploy admin-users` และ `npx supabase functions deploy check-links`
4. ตั้งค่า Auth ใน Dashboard
   - Authentication > Providers > Email: **ปิด "Allow new users to sign up"**
   - Authentication > URL Configuration: ตั้ง Site URL และเพิ่ม `https://<โดเมน>/reset-password` ใน Redirect URLs
   - ตั้งค่า SMTP ของบริษัท เพื่อให้ส่งอีเมลเชิญ/รีเซ็ตได้ไม่จำกัด
5. สร้างผู้ดูแลคนแรก (ไม่มีรหัสผ่านเริ่มต้น)
   - Authentication > Users > **Invite user** ใส่อีเมลผู้ดูแล → ผู้ดูแลตั้งรหัสผ่านเองจากอีเมล
   - รันใน SQL Editor: `update public.profiles set is_admin = true where email = 'admin@yourcompany.com';`
6. ตั้งค่าหน้าเว็บ: `cp .env.example .env.local` แล้วใส่ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY`
7. `npm install` แล้ว `npm run dev` (พัฒนา) หรือ `npm run build` (ไฟล์อยู่ใน `dist/` deploy ได้ที่ Vercel/Netlify/Cloudflare Pages โดยตั้ง SPA fallback ไปที่ `index.html`)

## การสำรองข้อมูล

- หน้า **ผู้ดูแลระบบ > สำรอง/กู้คืนข้อมูล**: ส่งออก/นำเข้า ลิงก์ หมวดหมู่ ตำแหน่ง และสิทธิ์เป็น JSON
- ฐานข้อมูลทั้งหมด: เปิด Daily Backups / Point-in-Time Recovery ใน Supabase หรือ `npx supabase db dump -f backup.sql`
- ข้อมูลก่อนแก้ไข/ลบ ถูกเก็บใน `activity_logs` (old_data/new_data) ใช้ตรวจสอบย้อนหลังได้
