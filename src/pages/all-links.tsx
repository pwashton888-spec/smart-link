import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SearchX } from 'lucide-react'
import { searchLinks, useMyLinks } from '@/hooks/data'
import { useAuth } from '@/providers/auth'
import type { AccessibleLink } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Select, SELECT_NONE } from '@/components/ui/select'
import { LinkList, LinkListSkeleton } from '@/components/link-card'
import { ViewToggle, useViewMode } from '@/components/view-toggle'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { CategoryIcon } from '@/components/icons'

type Sort = 'order' | 'name' | 'popular' | 'recent'

export default function AllLinksPage() {
  const { roles: myRoles } = useAuth()
  const { data, categories, isLoading, error, refetch } = useMyLinks()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useViewMode()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('order')

  const categorySlug = params.get('category') ?? SELECT_NONE
  const roleId = params.get('role') ?? SELECT_NONE
  const category = categories.find((c) => c.slug === categorySlug)

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value === SELECT_NONE) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const results = useMemo(() => {
    let list = data ?? []
    if (category) list = list.filter((l) => l.category_id === category.id)
    if (roleId !== SELECT_NONE) list = list.filter((l) => l.matchedRoles.some((r) => r.id === roleId))
    if (query.trim()) return searchLinks(list, query)
    const sorted = [...list]
    if (sort === 'name') sorted.sort((a, b) => a.title.localeCompare(b.title, 'th'))
    if (sort === 'popular') sorted.sort((a, b) => b.openCount - a.openCount)
    if (sort === 'recent') sorted.sort((a, b) => (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? ''))
    return sorted
  }, [data, category, roleId, query, sort])

  // จัดกลุ่มลิงก์ที่เกี่ยวข้องกัน (group_name) เมื่อไม่ได้ค้นหา
  const groups = useMemo(() => {
    if (query.trim() || !results.some((l) => l.group_name)) return null
    const m = new Map<string, AccessibleLink[]>()
    for (const l of results) {
      const key = l.group_name || 'อื่น ๆ'
      m.set(key, [...(m.get(key) ?? []), l])
    }
    return [...m.entries()].sort(([a], [b]) => (a === 'อื่น ๆ' ? 1 : b === 'อื่น ๆ' ? -1 : a.localeCompare(b, 'th')))
  }, [results, query])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {category && (
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${category.color}1a`, color: category.color }}>
            <CategoryIcon name={category.icon} className="h-5 w-5" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{category?.name ?? 'ลิงก์ทั้งหมด'}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{category?.description ?? 'ทุกลิงก์ที่คุณมีสิทธิ์เข้าถึง รวมจากทุกตำแหน่ง'}</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_200px_180px_160px_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหา..." className="pl-9" />
        </div>
        <Select
          value={categorySlug}
          onValueChange={(v) => setParam('category', v)}
          options={[{ value: SELECT_NONE, label: 'ทุกหมวดหมู่' }, ...categories.filter((c) => c.is_active).map((c) => ({ value: c.slug, label: c.name }))]}
        />
        <Select
          value={roleId}
          onValueChange={(v) => setParam('role', v)}
          options={[{ value: SELECT_NONE, label: 'ทุกตำแหน่ง' }, ...myRoles.map((r) => ({ value: r.id, label: r.name }))]}
        />
        <Select
          value={sort}
          onValueChange={(v) => setSort(v as Sort)}
          options={[
            { value: 'order', label: 'เรียงตามระบบ' },
            { value: 'name', label: 'ชื่อ ก-ฮ' },
            { value: 'popular', label: 'ใช้บ่อยที่สุด' },
            { value: 'recent', label: 'ใช้ล่าสุด' },
          ]}
        />
        <div className="flex justify-end"><ViewToggle value={view} onChange={setView} /></div>
      </div>

      {error ? (
        <ErrorState message={(error as Error).message} onRetry={refetch} />
      ) : isLoading ? (
        <LinkListSkeleton view={view} />
      ) : !results.length ? (
        <EmptyState icon={SearchX} title="ไม่พบลิงก์" description="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" />
      ) : groups ? (
        <div className="space-y-8">
          {groups.map(([name, links]) => (
            <section key={name} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">{name} <span className="font-normal">({links.length})</span></h2>
              <LinkList links={links} view={view} />
            </section>
          ))}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">พบ {results.length} ลิงก์</p>
          <LinkList links={results} view={view} />
        </>
      )}
    </div>
  )
}
