import { useEffect, useMemo, useState } from 'react'
import { CornerDownLeft, ExternalLink, Search } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { searchLinks, useMyLinks, useOpenLink } from '@/hooks/data'
import { cn, hostnameOf } from '@/lib/utils'
import { LinkIcon } from './link-icon'
import { useLinkActions } from './link-actions'

/** ค้นหาแบบ Real-time ทั้งระบบ (Ctrl/⌘ + K) เฉพาะลิงก์ที่มีสิทธิ์ */
export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data = [] } = useMyLinks()
  const openLink = useOpenLink()
  const { showDetail } = useLinkActions()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)

  const results = useMemo(() => {
    if (!q.trim()) {
      return [...data].filter((l) => l.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? '')).slice(0, 6)
    }
    return searchLinks(data, q).slice(0, 12)
  }, [data, q])

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[10vh] z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border bg-card shadow-lift data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <DialogPrimitive.Title className="sr-only">ค้นหาลิงก์</DialogPrimitive.Title>
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActive((a) => Math.min(a + 1, results.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActive((a) => Math.max(a - 1, 0))
                } else if (e.key === 'Enter' && results[active]) {
                  e.preventDefault()
                  openLink(results[active])
                  onOpenChange(false)
                }
              }}
              placeholder="ค้นหาชื่อเว็บไซต์ หมวดหมู่ แท็ก หรือตำแหน่ง..."
              className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">ESC</kbd>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin">
            {!q.trim() && results.length > 0 && <p className="px-2 pb-1 pt-1 text-xs text-muted-foreground">ใช้งานล่าสุด</p>}
            {results.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                {q.trim() ? `ไม่พบลิงก์ที่ตรงกับ “${q}”` : 'พิมพ์เพื่อเริ่มค้นหา'}
              </p>
            ) : (
              results.map((l, i) => (
                <div
                  key={l.id}
                  onMouseEnter={() => setActive(i)}
                  className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2', i === active && 'bg-accent')}
                  onClick={() => {
                    onOpenChange(false)
                    showDetail(l)
                  }}
                >
                  <LinkIcon title={l.title} url={l.url} iconUrl={l.icon_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[l.category?.name, hostnameOf(l.url)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openLink(l)
                      onOpenChange(false)
                    }}
                    className="rounded-lg p-2 text-teal hover:bg-teal/10"
                    title="เปิดทันที"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="hidden items-center gap-4 border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground sm:flex">
            <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> เปิดเว็บไซต์ทันที</span>
            <span>↑ ↓ เลือก</span>
            <span>คลิก ดูรายละเอียด</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
