import { AlertTriangle } from 'lucide-react'
import { hostnameOf } from '@/lib/utils'
import { LinkIcon } from './link-icon'

export interface DuplicateMatch {
  id: string
  title: string
  url: string
  icon_url: string | null
  /** ข้อความเสริม เช่น หมวดหมู่ / ลิงก์ส่วนตัวของคุณ */
  note?: string
  /** ปุ่มแนะนำให้ใช้รายการเดิม */
  action?: React.ReactNode
}

/** แจ้งเตือนเมื่อ URL ที่กำลังเพิ่มมีอยู่ในระบบแล้ว และแนะนำให้ใช้รายการเดิม */
export function DuplicateNotice({ matches, message }: { matches: DuplicateMatch[]; message: string }) {
  if (!matches.length) return null
  return (
    <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3" role="status">
      <p className="flex items-start gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{message}</span>
      </p>
      <div className="space-y-1.5">
        {matches.slice(0, 3).map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-2.5 rounded-lg bg-card/80 px-2.5 py-2">
            <LinkIcon title={m.title} url={m.url} iconUrl={m.icon_url} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.title}</p>
              <p className="truncate text-xs text-muted-foreground">{hostnameOf(m.url)}{m.note && ` · ${m.note}`}</p>
            </div>
            {m.action}
          </div>
        ))}
        {matches.length > 3 && <p className="text-xs text-muted-foreground">และอีก {matches.length - 3} รายการ</p>}
      </div>
    </div>
  )
}
