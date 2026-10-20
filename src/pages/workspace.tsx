import { useMemo } from 'react'
import { Clock, Eye, EyeOff, Plus, Sparkles, Star } from 'lucide-react'
import { useMyLinks, useReorderFavorites, useReorderPersonalLinks, useSetHidden } from '@/hooks/data'
import { relativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LinkCard, LinkListSkeleton } from '@/components/link-card'
import { SortableList } from '@/components/sortable-list'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { LinkIcon } from '@/components/link-icon'
import { useLinkActions } from '@/components/link-actions'

export default function WorkspacePage() {
  const { data, favoriteOrder, isLoading, error, refetch } = useMyLinks()
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
        <Button onClick={addPersonal}><Plus /> เพิ่มลิงก์ส่วนตัว</Button>
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

          <TabsContent value="personal" className="space-y-3">
            {personal.length ? (
              <>
                <p className="text-xs text-muted-foreground">ลิงก์ส่วนตัวมองเห็นได้เฉพาะคุณ ลากเพื่อจัดลำดับ</p>
                <SortableList items={personal} onReorder={(ids) => reorderPersonal.mutate(ids)} renderItem={(l) => <LinkCard link={l} view="list" />} />
              </>
            ) : (
              <EmptyState
                icon={Sparkles}
                title="ยังไม่มีลิงก์ส่วนตัว"
                description="เพิ่มเว็บไซต์ที่คุณใช้ทำงานเป็นประจำ ลิงก์จะแสดงเฉพาะในบัญชีของคุณ"
                action={<Button onClick={addPersonal}><Plus /> เพิ่มลิงก์ส่วนตัว</Button>}
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
    </div>
  )
}
