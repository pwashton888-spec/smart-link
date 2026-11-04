import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Building2, ExternalLink, Info, Library, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { useAuth } from '@/providers/auth'
import { useMyLinks, useOpenLink } from '@/hooks/data'
import { collectionLinks, useDeleteCollection, useMyCollections } from '@/hooks/collections'
import type { AccessibleLink, Collection } from '@/lib/types'
import { hostnameOf } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { CategoryIcon } from '@/components/icons'
import { LinkIcon } from '@/components/link-icon'
import { useLinkActions } from '@/components/link-actions'
import { CollectionDialog, type PickableLink } from '@/components/collection-dialog'

function CollectionCard({
  collection,
  links,
  onEdit,
  onDelete,
}: {
  collection: Collection
  links: AccessibleLink[]
  onEdit?: () => void
  onDelete?: () => void
}) {
  const openLink = useOpenLink()
  const { showDetail } = useLinkActions()
  const color = collection.color
  return (
    <section id={`collection-${collection.id}`} className="flex scroll-mt-24 flex-col rounded-2xl border bg-card/80 shadow-soft">
      <div className="flex items-start gap-3 border-b p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}1a`, color }}>
          <CategoryIcon name={collection.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{collection.name}</h2>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {collection.description || `${links.length} ลิงก์`}
            {collection.description && ` · ${links.length} ลิงก์`}
          </p>
        </div>
        {onEdit && <Button variant="ghost" size="icon" onClick={onEdit} aria-label="แก้ไขชุดลิงก์"><Pencil /></Button>}
        {onDelete && <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={onDelete} aria-label="ลบชุดลิงก์"><Trash2 /></Button>}
      </div>
      <div className="flex-1 space-y-0.5 p-2">
        {links.length ? (
          links.map((l, i) => (
            <div key={l.id} className="group flex items-center gap-1 rounded-xl transition hover:bg-accent/70">
              <button
                onClick={() => openLink(l)}
                className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left"
                title={`เปิด ${l.title} ในแท็บใหม่`}
              >
                <span className="w-4 shrink-0 text-center text-[11px] text-muted-foreground">{i + 1}</span>
                <LinkIcon title={l.title} url={l.url} iconUrl={l.icon_url} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{l.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{hostnameOf(l.url)}</span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-teal opacity-60 transition group-hover:opacity-100" />
              </button>
              <button onClick={() => showDetail(l)} className="mr-1 rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-foreground" aria-label="รายละเอียด" title="รายละเอียด">
                <Info className="h-4 w-4" />
              </button>
            </div>
          ))
        ) : (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">ยังไม่มีลิงก์ในชุดนี้ที่คุณเปิดได้</p>
        )}
      </div>
    </section>
  )
}

export default function CollectionsPage() {
  const { session } = useAuth()
  const { data: links, isLoading: linksLoading } = useMyLinks()
  const collections = useMyCollections()
  const del = useDeleteCollection()
  const [editing, setEditing] = useState<Collection | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<Collection | null>(null)

  const linkById = useMemo(() => new Map((links ?? []).map((l) => [l.id, l])), [links])
  const org = collections.data.filter((c) => !c.owner_id)
  const mine = collections.data.filter((c) => c.owner_id === session?.user.id)
  const pickable = useMemo<PickableLink[]>(
    () =>
      (links ?? []).map((l) => ({
        id: l.id,
        title: l.title,
        url: l.url,
        icon_url: l.icon_url,
        tags: l.tags,
        note: l.visibility === 'personal' ? 'ส่วนตัว' : l.category?.name,
      })),
    [links],
  )

  const loading = collections.isLoading || linksLoading

  // มาจาก Dashboard : เลื่อนไปยังชุดที่กด
  const { hash } = useLocation()
  useEffect(() => {
    if (!loading && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loading, hash])
  const grid = 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ชุดลิงก์</h1>
          <p className="mt-1 text-sm text-muted-foreground">ลิงก์ที่ใช้ร่วมกันตามลักษณะงาน รวมไว้เป็นชุด กดที่ลิงก์เพื่อเปิดได้ทันที</p>
        </div>
        <Button onClick={() => setEditing(null)}><Plus /> สร้างชุดลิงก์ของฉัน</Button>
      </div>

      {collections.error ? (
        <ErrorState
          message={`${(collections.error as Error).message} (ถ้าเพิ่งอัปเดตระบบ ให้ผู้ดูแลรันไฟล์ SQL ชุดลิงก์ใน Supabase ก่อน)`}
          onRetry={() => collections.refetch()}
        />
      ) : loading ? (
        <div className={grid}>{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>
      ) : !org.length && !mine.length ? (
        <EmptyState
          icon={Library}
          title="ยังไม่มีชุดลิงก์"
          description="สร้างชุดลิงก์ของคุณเอง เช่น “งานปิดบัญชี” แล้วใส่ลิงก์ที่ใช้คู่กัน 5–10 รายการ หรือรอผู้ดูแลสร้างชุดลิงก์ให้ตำแหน่งของคุณ"
          action={<Button onClick={() => setEditing(null)}><Plus /> สร้างชุดลิงก์</Button>}
        />
      ) : (
        <>
          {org.length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Building2 className="h-4 w-4" /> ชุดลิงก์ขององค์กร</h2>
              <div className={grid}>
                {org.map((c) => <CollectionCard key={c.id} collection={c} links={collectionLinks(c, linkById)} />)}
              </div>
            </div>
          )}
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><UserRound className="h-4 w-4" /> ชุดลิงก์ของฉัน</h2>
            {mine.length ? (
              <div className={grid}>
                {mine.map((c) => (
                  <CollectionCard key={c.id} collection={c} links={collectionLinks(c, linkById)} onEdit={() => setEditing(c)} onDelete={() => setDeleting(c)} />
                ))}
              </div>
            ) : (
              <button onClick={() => setEditing(null)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground transition hover:border-teal/40 hover:text-foreground">
                <Plus className="h-4 w-4" /> สร้างชุดลิงก์ของคุณเอง (มองเห็นเฉพาะคุณ)
              </button>
            )}
          </div>
        </>
      )}

      <CollectionDialog
        open={editing !== undefined}
        collection={editing ?? null}
        scope="personal"
        links={pickable}
        onOpenChange={(o) => !o && setEditing(undefined)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="ลบชุดลิงก์นี้?"
        description={deleting ? `ลบ “${deleting.name}” แล้ว ลิงก์ที่อยู่ในชุดยังอยู่ครบ ไม่ถูกลบ` : undefined}
        confirmLabel="ลบชุดลิงก์"
        destructive
        onConfirm={async () => {
          if (deleting) await del.mutateAsync(deleting.id)
        }}
      />
    </div>
  )
}
