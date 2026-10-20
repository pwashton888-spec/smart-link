import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Flame, Globe, Layers, Plus, Search, SearchX, Sparkles, Star, X } from 'lucide-react'
import { useAuth } from '@/providers/auth'
import { searchLinks, useMyLinks } from '@/hooks/data'
import type { AccessibleLink } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

import { Skeleton } from '@/components/ui/skeleton'
import { LinkList, LinkListSkeleton, type ViewMode } from '@/components/link-card'
import { ViewToggle, useViewMode } from '@/components/view-toggle'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { CategoryIcon } from '@/components/icons'
import { useLinkActions } from '@/components/link-actions'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'สวัสดีตอนเช้า'
  if (h < 17) return 'สวัสดีตอนบ่าย'
  return 'สวัสดีตอนเย็น'
}

function Section({
  title,
  icon: Icon,
  links,
  view,
  action,
  limit,
  color,
}: {
  title: string
  icon: typeof Star
  links: AccessibleLink[]
  view: ViewMode
  action?: React.ReactNode
  limit?: number
  color?: string
}) {
  if (!links.length) return null
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-blue-200" style={color ? { backgroundColor: `${color}1a`, color } : undefined}>
            <Icon className="h-4 w-4" />
          </span>
          {title}
          <span className="text-sm font-normal text-muted-foreground">({links.length})</span>
        </h2>
        {action}
      </div>
      <LinkList links={limit ? links.slice(0, limit) : links} view={view} />
    </section>
  )
}

type Filter = 'all' | 'global' | 'direct' | 'personal' | `role:${string}`

export default function DashboardPage() {
  const { profile, roles: myRoles } = useAuth()
  const { data, favoriteOrder, categories, isLoading, error, refetch } = useMyLinks()
  const { addPersonal } = useLinkActions()
  const [view, setView] = useViewMode()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const visible = useMemo(() => (data ?? []).filter((l) => !l.isHidden), [data])

  const filtered = useMemo(() => {
    // การค้นหาครอบคลุมลิงก์ที่ซ่อนไว้ด้วย (ซ่อนเฉพาะจาก Dashboard)
    let list = query.trim() ? data ?? [] : visible
    if (filter === 'global') list = list.filter((l) => l.visibility === 'global')
    else if (filter === 'personal') list = list.filter((l) => l.visibility === 'personal')
    else if (filter === 'direct') list = list.filter((l) => l.grantedToMe)
    else if (filter.startsWith('role:')) list = list.filter((l) => l.matchedRoles.some((r) => r.id === filter.slice(5)))
    return query.trim() ? searchLinks(list, query) : list
  }, [data, visible, filter, query])

  const favorites = useMemo(() => {
    const idx = new Map(favoriteOrder.map((id, i) => [id, i]))
    return visible.filter((l) => l.isFavorite).sort((a, b) => (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0))
  }, [visible, favoriteOrder])
  const recent = useMemo(
    () => visible.filter((l) => l.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? '')),
    [visible],
  )
  const frequent = useMemo(() => visible.filter((l) => l.openCount >= 3).sort((a, b) => b.openCount - a.openCount), [visible])
  const featured = visible.filter((l) => l.is_featured)
  const global = visible.filter((l) => l.visibility === 'global')
  const personal = visible.filter((l) => l.visibility === 'personal')
  const direct = visible.filter((l) => l.grantedToMe && !l.matchedRoles.length)

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of visible) if (l.category_id) m.set(l.category_id, (m.get(l.category_id) ?? 0) + 1)
    return m
  }, [visible])

  const filterChips: { key: Filter; label: string; color?: string }[] = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'global', label: 'ส่วนกลาง' },
    ...myRoles.map((r) => ({ key: `role:${r.id}` as Filter, label: r.name, color: r.color })),
    ...((data ?? []).some((l) => l.grantedToMe) ? [{ key: 'direct' as Filter, label: 'เฉพาะฉัน' }] : []),
    { key: 'personal', label: 'ส่วนตัว' },
  ]

  const isFiltering = !!query.trim() || filter !== 'all'

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <section className="brand-gradient relative overflow-hidden rounded-3xl p-6 text-white shadow-lift md:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-40 w-40 rounded-full bg-teal/30 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <p className="text-sm text-white/75">{greeting()} 👋</p>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{profile?.full_name}</h1>
            <div className="flex flex-wrap gap-1.5">
              {myRoles.length ? (
                myRoles.map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: r.color === '#0f2a5c' ? '#93c5fd' : r.color }} />
                    {r.name}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs">ยังไม่ได้รับตำแหน่งงาน</span>
              )}
              {profile?.is_admin && <span className="rounded-full bg-amber-400/90 px-3 py-1 text-xs text-amber-950">ผู้ดูแลระบบ</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              {isLoading ? <Skeleton className="h-7 w-10 bg-white/20" /> : <p className="text-2xl font-semibold">{data?.length ?? 0}</p>}
              <p className="text-xs text-white/70">ลิงก์ที่เข้าถึงได้</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              {isLoading ? <Skeleton className="h-7 w-10 bg-white/20" /> : <p className="text-2xl font-semibold">{favorites.length}</p>}
              <p className="text-xs text-white/70">รายการโปรด</p>
            </div>
            <Button onClick={addPersonal} className="hidden bg-white text-primary hover:bg-white/90 sm:inline-flex">
              <Plus /> เพิ่มลิงก์ส่วนตัว
            </Button>
          </div>
        </div>
      </section>

      {/* Search + filter */}
      <section className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาเว็บไซต์ คำอธิบาย หมวดหมู่ แท็ก หรือตำแหน่ง..."
              className="h-12 w-full rounded-2xl border bg-card/80 pl-12 pr-10 text-base shadow-soft outline-none backdrop-blur transition focus:border-teal/50 focus:ring-2 focus:ring-ring/30"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent" aria-label="ล้างคำค้นหา">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button onClick={addPersonal} size="icon" className="h-12 w-12 rounded-2xl sm:hidden" aria-label="เพิ่มลิงก์ส่วนตัว">
            <Plus className="!size-5" />
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
            {filterChips.map((c) => (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition',
                  filter === c.key ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'bg-card/70 text-muted-foreground hover:text-foreground',
                )}
              >
                {c.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />}
                {c.label}
              </button>
            ))}
          </div>
          <ViewToggle value={view} onChange={setView} />
        </div>
      </section>

      {error ? (
        <ErrorState message={(error as Error).message} onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-6 w-40" />
          <LinkListSkeleton view={view} />
        </div>
      ) : isFiltering ? (
        filtered.length ? (
          <Section title={query ? `ผลการค้นหา` : filterChips.find((c) => c.key === filter)?.label ?? ''} icon={Search} links={filtered} view={view} />
        ) : (
          <EmptyState icon={SearchX} title="ไม่พบลิงก์" description={query ? `ไม่มีลิงก์ที่ตรงกับ “${query}” ในสิทธิ์ของคุณ` : 'ยังไม่มีลิงก์ในกลุ่มนี้'} />
        )
      ) : !data?.length ? (
        <EmptyState
          icon={Layers}
          title="ยังไม่มีลิงก์สำหรับคุณ"
          description="เมื่อผู้ดูแลระบบเพิ่มลิงก์ให้ตำแหน่งของคุณ ลิงก์จะแสดงที่นี่ทันที หรือเริ่มเพิ่มลิงก์ส่วนตัวของคุณเอง"
          action={<Button onClick={addPersonal}><Plus /> เพิ่มลิงก์ส่วนตัว</Button>}
        />
      ) : (
        <div className="space-y-10">
          {favorites.length ? (
            <Section
              title="รายการโปรด"
              icon={Star}
              color="#f59e0b"
              links={favorites}
              view={view}
              action={<Link to="/workspace" className="text-sm text-teal hover:underline">จัดเรียง</Link>}
            />
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-card/40 px-4 py-3 text-sm text-muted-foreground">
              <Star className="h-4 w-4 shrink-0 text-amber-500" /> กดรูปดาวบนการ์ดลิงก์เพื่อปักหมุดเว็บไซต์ที่ใช้บ่อยไว้ด้านบนสุด
            </div>
          )}
          <Section title="ใช้งานล่าสุด" icon={Clock} links={recent} view={view} limit={view === 'grid' ? 5 : 6} />
          <Section title="ลิงก์แนะนำ" icon={Sparkles} color="#14a3a0" links={featured} view={view} />
          <Section title="ใช้บ่อย" icon={Flame} color="#f97316" links={frequent} view={view} limit={5} />
          <Section title="เว็บไซต์ส่วนกลาง" icon={Globe} links={global} view={view} />
          {myRoles.map((r) => (
            <Section
              key={r.id}
              title={`เว็บไซต์${r.name}`}
              icon={Layers}
              color={r.color}
              links={visible.filter((l) => l.matchedRoles.some((m) => m.id === r.id))}
              view={view}
            />
          ))}
          <Section title="มอบให้คุณโดยเฉพาะ" icon={Star} links={direct} view={view} />
          <Section
            title="เว็บไซต์ส่วนตัว"
            icon={Sparkles}
            links={personal}
            view={view}
            action={<Button variant="ghost" size="sm" onClick={addPersonal}><Plus /> เพิ่ม</Button>}
          />

          {categories.some((c) => categoryCounts.get(c.id)) && (
            <section className="space-y-3">
              <h2 className="text-base font-semibold">หมวดหมู่</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {categories
                  .filter((c) => c.is_active && categoryCounts.get(c.id))
                  .map((c) => (
                    <Link
                      key={c.id}
                      to={`/links?category=${c.slug}`}
                      className="group flex items-center gap-3 rounded-2xl border bg-card/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lift"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${c.color}1a`, color: c.color }}>
                        <CategoryIcon name={c.icon} className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{categoryCounts.get(c.id)} ลิงก์</p>
                      </div>
                    </Link>
                  ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

