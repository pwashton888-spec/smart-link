import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, Bell, CheckCheck, Globe, Trash2 } from 'lucide-react'
import { useMyLinks } from '@/hooks/data'
import { useClearNotifications, useMarkNotificationsRead, useNotifications } from '@/hooks/notifications'
import type { AppNotification } from '@/lib/types'
import { cn, relativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useLinkActions } from './link-actions'

export function NotificationBell() {
  const { data = [] } = useNotifications()
  const { data: links } = useMyLinks()
  const markRead = useMarkNotificationsRead()
  const clearAll = useClearNotifications()
  const { showDetail } = useLinkActions()
  const navigate = useNavigate()
  const unread = data.filter((n) => !n.is_read).length

  function open(n: AppNotification) {
    if (!n.is_read) markRead([n.id])
    if (n.kind === 'link_broken') {
      navigate('/admin/links?status=broken')
      return
    }
    const link = links?.find((l) => l.id === n.link_id)
    if (link) showDetail(link)
    else toast.info('ลิงก์นี้ถูกปิดหรือลบไปแล้ว')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `การแจ้งเตือน ${unread} รายการใหม่` : 'การแจ้งเตือน'}>
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <p className="text-sm font-semibold">การแจ้งเตือน</p>
          {unread > 0 && (
            <button onClick={() => markRead()} className="flex items-center gap-1 text-xs text-teal hover:underline">
              <CheckCheck className="h-3.5 w-3.5" /> อ่านทั้งหมด
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="mx-0 my-0" />
        {!data.length ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">ยังไม่มีการแจ้งเตือน</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto p-1 scrollbar-thin">
            {data.map((n) => {
              const Icon = n.kind === 'link_broken' ? AlertTriangle : Globe
              return (
                <DropdownMenuItem key={n.id} onSelect={() => open(n)} className="items-start gap-3 py-2.5">
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      n.kind === 'link_broken' ? 'bg-destructive/10 text-destructive' : 'bg-teal/10 text-teal',
                    )}
                  >
                    <Icon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm leading-snug', !n.is_read && 'font-semibold')}>{n.title}</span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-muted-foreground">{relativeTime(n.created_at)}</span>
                  </span>
                  {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal" aria-label="ยังไม่อ่าน" />}
                </DropdownMenuItem>
              )
            })}
          </div>
        )}
        {data.length > 0 && (
          <>
            <DropdownMenuSeparator className="mx-0 my-0" />
            <div className="p-1">
              <DropdownMenuItem onSelect={() => clearAll()} className="justify-center text-xs text-muted-foreground">
                <Trash2 /> ล้างการแจ้งเตือนทั้งหมด
              </DropdownMenuItem>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
