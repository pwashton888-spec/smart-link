import { useMemo, useState } from 'react'
import { Clock, Eye, EyeOff, FolderPlus, Pencil, Plus, Sparkles, Star, Trash2 } from 'lucide-react'
import { useDeletePersonalCategory, useMyLinks, useReorderFavorites, useReorderPersonalLinks, useSetHidden } from '@/hooks/data'
import type { AccessibleLink, Category } from '@/lib/types'
import { relativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LinkCard, LinkListSkeleton } from '@/components/link-card'
import { SortableList } from '@/components/sortable-list'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { LinkIcon } from '@/components/link-icon'
import { useLinkActions } from '@/components/link-actions'
import { CategoryIcon } from '@/components/icons'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { PersonalCategoryDialog } from '@/components/personal-category-dialog'

export default function WorkspacePage() {
  const { data, favoriteOrder, categories, isLoading, error, refetch } = useMyLinks()
  const deleteCategory = useDeletePersonalCategory()
  const [editingCategory, setEditingCategory] = useState<Category | null | undefined>(undefined)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)
  const reorderFav = useReorderFavorites()
  const reorderPersonal = useReorderPersonalLinks()
  const unhide = useSetHidden()
  const { addPersonal, showDetail } = useLinkActions()

  const favorites = useMemo(() => {
    const idx = new Map(favoriteOrder.map((id, i) => [id, i]))
    return (data ?? []).filter((l) => l.isFavorite).sort((a, b) => (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0))
  }, [data, favoriteOrder])
  const personal = useMemo(
    () => (data ?? []).filter((l) => l.visibility === 'personal').sort((a, b) => a.sort_order - b.sort_order),
    [data],
  )
  // ลิงก์ส่วนตัวแยกตามหมวดหมู่ : เว็บไซต์ส่วนตัว → หมวดที่สร้างเอง → หมวดอื่น
  const personalGroups = useMemo(() => {
    const personalCat = categories.find((c) => c.slug === 'personal') ?? null
    const mine = categories.filter((c) => c.owner_id)
    const byCat = new Map<string, AccessibleLink[]>()
    for (const l of personal) {
      const key = l.category_id && l.category_id !== personalCat?.id ? l.category_id : 'personal'
      byCat.set(key, [...(byCat.get(key) ?? []), l])
    }
    const groups: { key: string; category: Category | null; links: AccessibleLink[] }[] = []
    if (byCat.has('personal') || !mine.length) groups.push({ key: 'personal', category: personalCat, links: byCat.get('personal') ?? [] })
    for (const c of mine) groups.push({ key: c.id, category: c, links: byCat.get(c.id) ?? [] })
    for (const [key, links] of byCat) {
      if (key === 'personal' || mine.some((c) => c.id === key)) continue
      groups.push({ key, category: links[0].category, links })
    }
    return groups
  }, [personal, categories])
  const hidden = (data ?? []).filter((l) => l.isHidden)
  const recent = (data ?? [])
    .filter((l) => l.lastOpenedAt)
    .sort((a, b) => (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? ''))
    .slice(0, 30)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">พื้นที่ส่วนตัว</h1>
          <p className="mt-1 text-sm text-muted-foreground">จัดการรายการโปรดและลิงก์ส่วนตัว การปรับแต่งนี้ไม่กระทบพนักงานคนอื่น</p>
        </div>
        <Button onClick={() => addPersonal()}><Plus /> เพิ่มลิงก์ส่วนตัว</Button>
      </div>

      {error ? (
        <ErrorState message={(error as Error).message} onRetry={refetch} />
      ) : isLoading ? (
        <LinkListSkeleton view="list" count={6} />
      ) : (
        <Tabs defaultValue="favorites" className="space-y-4">
          <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
            <TabsTrigger value="favorites"><Star className="h-4 w-4" /> รายการโปรด ({favorites.length})</TabsTrigger>
            <TabsTrigger value="personal"><Sparkles className="h-4 w-4" /> ลิงก์ส่วนตัว ({personal.length})</TabsTrigger>
            <TabsTrigger value="recent"><Clock className="h-4 w-4" /> ล่าสุด</TabsTrigger>
            <TabsTrigger value="hidden"><EyeOff className="h-4 w-4" /> ที่ซ่อนไว้ ({hidden.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="favorites" className="space-y-3">
            {favorites.length ? (
              <>
                <p className="text-xs text-muted-foreground">ลากที่ไอคอน ⋮⋮ เพื่อจัดลำดับ ลำดับนี้จะแสดงบน Dashboard</p>
                <SortableList items={favorites} onReorder={(ids) => reorderFav.mutate(ids)} renderItem={(l) => <LinkCard link={l} view="list" />} />
              </>
            ) : (
              <EmptyState icon={Star} title="ยังไม่มีรายการโปรด" description="กดรูปดาวบนการ์ดลิงก์เพื่อปักหมุดไว้ที่นี่" />
            )}
          </TabsContent>

          <TabsContent value="personal" className="space-y-6">
            {personal.length || categories.some((c) => c.owner_id) ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">ลิงก์ส่วนตัวมองเห็นได้เฉพาะคุณ แยกตามหมวดหมู่ ลากเพื่อจัดลำดับในแต่ละหมวด</p>
                  <Button variant="outline" size="sm" onClick={() => setEditingCategory(null)}><FolderPlus /> สร้างหมวดหมู่</Button>
                </div>
                {personalGroups.map((g) => {
                  const own = !!g.category?.owner_id
                  const color = g.category?.color ?? '#14a3a0'
                  return (
                    <section key={g.key} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}1a`, color }}>
                          <CategoryIcon name={g.category?.icon ?? 'User'} />
                        </span>
                        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {g.category?.name ?? 'เว็บไซต์ส่วนตัว'} <span className="font-normal text-muted-foreground">({g.links.length})</span>
                        </h2>
                        <Button variant="ghost" size="sm" onClick={() => addPersonal(g.category?.id)}><Plus /> เพิ่มลิงก์</Button>
                        {own && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => setEditingCategory(g.category)} aria-label="แก้ไขหมวดหมู่"><Pencil /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeletingCategory(g.category)} aria-label="ลบหมวดหมู่"><Trash2 /></Button>
                          </>
                        )}
                      </div>
                      {g.links.length ? (
                        <SortableList items={g.links} onReorder={(ids) => reorderPersonal.mutate(ids)} renderItem={(l) => <LinkCard link={l} view="list" />} />
                      ) : (
                        <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">ยังไม่มีลิงก์ในหมวดนี้</p>
                      )}
                    </section>
                  )
                })}
              </>
            ) : (
              <EmptyState
                icon={Sparkles}
                title="ยังไม่มีลิงก์ส่วนตัว"
                description="เพิ่มเว็บไซต์ที่คุณใช้ทำงานเป็นประจำ และสร้างหมวดหมู่ของคุณเองเพื่อแยกลิงก์ ลิงก์จะแสดงเฉพาะในบัญชีของคุณ"
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => addPersonal()}><Plus /> เพิ่มลิงก์ส่วนตัว</Button>
                    <Button variant="outline" onClick={() => setEditingCategory(null)}><FolderPlus /> สร้างหมวดหมู่</Button>
                  </div>
                }
              />
            )}
          </TabsContent>

          <TabsContent value="recent">
            {recent.length ? (
              <div className="divide-y rounded-2xl border bg-card/80">
                {recent.map((l) => (
                  <button key={l.id} onClick={() => showDetail(l)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent/60">
                    <LinkIcon title={l.title} url={l.url} iconUrl={l.icon_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                      <p className="text-xs text-muted-foreground">เปิดแล้ว {l.openCount} ครั้ง</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(l.lastOpenedAt)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon={Clock} title="ยังไม่มีประวัติการเปิดลิงก์" />
            )}
          </TabsContent>

          <TabsContent value="hidden">
            {hidden.length ? (
              <div className="flex flex-col gap-2">
                {hidden.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 rounded-xl border bg-card/80 px-3 py-2.5">
                    <LinkIcon title={l.title} url={l.url} iconUrl={l.icon_url} size="sm" />
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{l.title}</p>
                    <Button variant="outline" size="sm" onClick={() => unhide.mutate({ linkId: l.id, hidden: false })}>
                      <Eye /> แสดงอีกครั้ง
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={EyeOff} title="ไม่มีลิงก์ที่ซ่อนไว้" description="ลิงก์ที่ซ่อนจะไม่แสดงบน Dashboard แต่ยังค้นหาได้ และไม่กระทบข้อมูลต้นฉบับ" />
            )}
          </TabsContent>
        </Tabs>
      )}

      <PersonalCategoryDialog open={editingCategory !== undefined} category={editingCategory ?? null} onOpenChange={(o) => !o && setEditingCategory(undefined)} />
      <ConfirmDialog
        open={!!deletingCategory}
        onOpenChange={(o) => !o && setDeletingCategory(null)}
        title="ลบหมวดหมู่นี้?"
        description={deletingCategory ? `ลบ “${deletingCategory.name}” แล้ว ลิงก์ในหมวดนี้จะย้ายไป “เว็บไซต์ส่วนตัว” ลิงก์ไม่หาย` : undefined}
        confirmLabel="ลบหมวดหมู่"
        destructive
        onConfirm={async () => {
          if (deletingCategory) await deleteCategory.mutateAsync(deletingCategory.id)
        }}
      />
    </div>
  )
}
