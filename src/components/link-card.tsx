import { Copy, EllipsisVertical, ExternalLink, Eye, EyeOff, Pencil, Star, Trash2 } from 'lucide-react'
import type { AccessibleLink } from '@/lib/types'
import { useOpenLink, useSetHidden, useToggleFavorite } from '@/hooks/data'
import { cn, hostnameOf } from '@/lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { LinkIcon } from './link-icon'
import { copyUrl, useLinkActions } from './link-actions'

export type ViewMode = 'grid' | 'list'

function CardMenu({ link }: { link: AccessibleLink }) {
  const openLink = useOpenLink()
  const fav = useToggleFavorite()
  const hide = useSetHidden()
  const actions = useLinkActions()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-lg p-1.5 text-muted-foreground opacity-70 transition hover:bg-accent hover:text-foreground hover:opacity-100 focus-visible:opacity-100"
          onClick={(e) => e.stopPropagation()}
          aria-label="ตัวเลือกเพิ่มเติม"
        >
          <EllipsisVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => openLink(link)}><ExternalLink /> เปิดในแท็บใหม่</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copyUrl(link.url)}><Copy /> คัดลอก URL</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => fav.mutate({ linkId: link.id, favorite: !link.isFavorite })}>
          <Star /> {link.isFavorite ? 'เลิกปักหมุด' : 'ปักหมุดเป็นรายการโปรด'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => hide.mutate({ linkId: link.id, hidden: !link.isHidden })}>
          {link.isHidden ? <Eye /> : <EyeOff />} {link.isHidden ? 'แสดงบน Dashboard' : 'ซ่อนจาก Dashboard'}
        </DropdownMenuItem>
        {link.visibility === 'personal' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => actions.editPersonal(link)}><Pencil /> แก้ไข</DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={() => actions.deletePersonal(link)}><Trash2 /> ลบ</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function LinkCard({ link, view = 'grid', className }: { link: AccessibleLink; view?: ViewMode; className?: string }) {
  const openLink = useOpenLink()
  const fav = useToggleFavorite()
  const { showDetail } = useLinkActions()

  const quickLaunch = (
    <button
      onClick={(e) => {
        e.stopPropagation()
        openLink(link)
      }}
      className="inline-flex items-center gap-1 rounded-lg bg-teal/10 px-2.5 py-1.5 text-xs font-medium text-teal transition hover:bg-teal hover:text-teal-foreground"
      title="เปิดทันที (Quick Launch)"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      <span className={cn(view === 'grid' ? 'hidden sm:inline' : 'hidden md:inline')}>เปิด</span>
    </button>
  )
  const star = (
    <button
      onClick={(e) => {
        e.stopPropagation()
        fav.mutate({ linkId: link.id, favorite: !link.isFavorite })
      }}
      className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-amber-500"
      aria-label={link.isFavorite ? 'เลิกปักหมุด' : 'ปักหมุด'}
      title={link.isFavorite ? 'เลิกปักหมุด' : 'ปักหมุด'}
    >
      <Star className={cn('h-4 w-4', link.isFavorite && 'fill-amber-400 text-amber-400')} />
    </button>
  )

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') showDetail(link)
  }

  if (view === 'list') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => showDetail(link)}
        onKeyDown={onKey}
        className={cn(
          'group flex cursor-pointer items-center gap-3 rounded-xl border bg-card/80 px-3 py-2.5 shadow-sm transition hover:border-teal/40 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <LinkIcon title={link.title} url={link.url} iconUrl={link.icon_url} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{link.title}</p>
          <p className="truncate text-xs text-muted-foreground">{link.description || hostnameOf(link.url)}</p>
        </div>
        <div className="hidden shrink-0 gap-1 lg:flex">
          {link.category && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{link.category.name}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {star}
          {quickLaunch}
          <CardMenu link={link} />
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => showDetail(link)}
      onKeyDown={onKey}
      className={cn(
        'group relative flex cursor-pointer flex-col rounded-2xl border bg-card/80 p-4 shadow-sm backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-teal/40 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <LinkIcon title={link.title} url={link.url} iconUrl={link.icon_url} />
        <div className="-mr-1 -mt-1 flex items-center">
          {star}
          <CardMenu link={link} />
        </div>
      </div>
      <div className="mt-3 min-w-0 flex-1">
        <p className="line-clamp-1 font-medium">{link.title}</p>
        <p className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-muted-foreground">
          {link.description || hostnameOf(link.url)}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          {link.matchedRoles.slice(0, 2).map((r) => (
            <span key={r.id} className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} title={r.name} />
          ))}
          <span className="truncate text-[11px] text-muted-foreground">
            {link.visibility === 'global' ? 'ส่วนกลาง' : link.visibility === 'personal' ? 'ส่วนตัว' : link.matchedRoles.map((r) => r.name).join(', ') || 'เฉพาะคุณ'}
          </span>
        </div>
        {quickLaunch}
      </div>
    </div>
  )
}

export function LinkList({ links, view, className }: { links: AccessibleLink[]; view: ViewMode; className?: string }) {
  return (
    <div
      className={cn(
        view === 'grid' ? 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : 'flex flex-col gap-2',
        className,
      )}
    >
      {links.map((l) => (
        <LinkCard key={l.id} link={l} view={view} className="animate-fade-up" />
      ))}
    </div>
  )
}

export function LinkListSkeleton({ view = 'grid', count = 8 }: { view?: ViewMode; count?: number }) {
  return (
    <div className={view === 'grid' ? 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4' : 'flex flex-col gap-2'}>
      {Array.from({ length: count }).map((_, i) =>
        view === 'grid' ? (
          <div key={i} className="rounded-2xl border bg-card/60 p-4">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <Skeleton className="mt-3 h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-full" />
            <Skeleton className="mt-1 h-3 w-2/3" />
          </div>
        ) : (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ),
      )}
    </div>
  )
}
