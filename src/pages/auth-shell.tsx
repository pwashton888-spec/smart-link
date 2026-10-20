import { Link2, LockKeyhole, Search, Users } from 'lucide-react'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="brand-gradient relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-teal/40 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Link2 className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold">Smart Link Workspace</p>
            <p className="text-sm text-white/70">ศูนย์กลางลิงก์และเครื่องมือทำงานภายในองค์กร</p>
          </div>
        </div>
        <div className="relative max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-snug">ทุกเครื่องมือที่ใช้ทำงาน<br />รวมไว้ในที่เดียว</h2>
          <ul className="space-y-4 text-white/85">
            {[
              { icon: Users, text: 'เห็นลิงก์ของทุกตำแหน่งที่ได้รับมอบหมายในบัญชีเดียว' },
              { icon: Search, text: 'ค้นหาและเปิดเว็บไซต์ที่ต้องการได้ในไม่กี่วินาที' },
              { icon: LockKeyhole, text: 'ปลอดภัย ตรวจสอบสิทธิ์ที่ฐานข้อมูลทุกครั้ง' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><Icon className="h-4 w-4" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">สำหรับพนักงานภายในองค์กรเท่านั้น</p>
      </div>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-white"><Link2 className="h-5 w-5" /></div>
            <p className="font-semibold">Smart Link Workspace</p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
