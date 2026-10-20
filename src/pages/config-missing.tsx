export default function ConfigMissingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-lg rounded-2xl border bg-card p-8 shadow-soft">
        <h1 className="text-xl font-semibold">ยังไม่ได้ตั้งค่า Supabase</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          สร้างไฟล์ <code className="rounded bg-muted px-1.5 py-0.5">.env.local</code> ที่โฟลเดอร์โปรเจกต์ แล้วใส่ค่าจาก Supabase Dashboard &gt; Project Settings &gt; API
        </p>
        <pre className="mt-4 overflow-auto rounded-lg bg-muted p-4 text-xs">{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}</pre>
        <p className="mt-4 text-sm text-muted-foreground">จากนั้นรัน <code className="rounded bg-muted px-1.5 py-0.5">npm run dev</code> ใหม่อีกครั้ง</p>
      </div>
    </div>
  )
}
