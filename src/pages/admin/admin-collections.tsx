import { useMemo, useState } from 'react'
import { Globe, Library, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCategories, useRawLinks, useRoles } from '@/hooks/data'
import { useCollections, useDeleteCollection } from '@/hooks/collections'
import type { Collection } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge, RoleBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { CategoryIcon } from '@/components/icons'
import { LinkIcon } from '@/components/link-icon'
import { CollectionDialog, type PickableLink } from '@/components/collection-dialog'
import { AdminHeader } from './admin-header'

export default function AdminCollectionsPage() {
  const collections = useCollections()
  const links = useRawLinks()
  const { data: roles = [] } = useRoles()
  const { data: categories = [] } = useCategories()
  const del = useDeleteCollection()
  const [editing, setEditing] = useState<Collection | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<Collection | null>(null)

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles])
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const orgLinks = useMemo(() => (links.data ?? []).filter((l) => l.visibility !== 'personal'), [links.data])
  const linkById = useMemo(() => new Map(orgLinks.map((l) => [l.id, l])), [orgLinks])
  const org = (collections.data ?? []).filter((c) => !c.owner_id)
  const pickable = useMemo<PickableLink[]>(
    () =>
      orgLinks.map((l) => ({
        id: l.id,
        title: l.title,
        url: l.url,
        icon_url: l.icon_url,
        tags: l.tags,
        note: [l.category_id ? catById.get(l.category_id)?.name : null, l.is_active ? null : 'ปิดใช้งาน'].filter(Boolean).join(' · '),
      })),
    [orgLinks, catById],
  )

  return (
    <div className="space-y-6">
      <AdminHeader
        title="ชุดลิงก์"
        description="รวมลิงก์ที่ต้องใช้ร่วมกันตามลักษณะงานเป็นชุด และเลือกตำแหน่งที่มองเห็น พนักงานจะเห็นเฉพาะลิงก์ในชุดที่ตัวเองมีสิทธิ์เปิด"
        action={<Button onClick={() => setEditing(null)}><Plus /> สร้างชุดลิงก์</Button>}
      />

      {collections.error ? (
        <ErrorState
          message={`${(collections.error as Error).message} (ตรวจสอบว่ารันไฟล์ SQL ชุดลิงก์ใน Supabase แล้ว)`}
          onRetry={() => collections.refetch()}
        />
      ) : collections.isLoading || links.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : !org.length ? (
        <EmptyState
          icon={Library}
          title="ยังไม่มีชุดลิงก์ขององค์กร"
          description="เช่น “งานการเงิน” ที่รวมระบบบัญชี ธนาคาร และแบบฟอร์มเบิกจ่ายไว้ด้วยกัน"
          action={<Button onClick={() => setEditing(null)}><Plus /> สร้างชุดลิงก์</Button>}
        />
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl border bg-card/80 shadow-soft">
          {org.map((c) => {
            const items = c.collection_items.map((i) => linkById.get(i.link_id)).filter((l) => !!l)
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${c.color}1a`, color: c.color }}>
                  <CategoryIcon name={c.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name} <span className="font-normal text-muted-foreground">({items.length} ลิงก์)</span></p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {c.role_ids.length ? (
                      c.role_ids.map((id) => {
                        const r = roleById.get(id)
                        return r ? <RoleBadge key={id} name={r.name} color={r.color} /> : null
                      })
                    ) : (
                      <Badge variant="teal"><Globe className="h-3 w-3" /> ทุกตำแหน่ง</Badge>
                    )}
                  </div>
                </div>
                <div className="hidden -space-x-2 md:flex">
                  {items.slice(0, 6).map((l) => (
                    <LinkIcon key={l!.id} title={l!.title} url={l!.url} iconUrl={l!.icon_url} size="sm" className="ring-2 ring-card" />
                  ))}
                </div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(c)} aria-label="แก้ไข"><Pencil /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleting(c)} aria-label="ลบ"><Trash2 /></Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CollectionDialog
        open={editing !== undefined}
        collection={editing ?? null}
        scope="org"
        links={pickable}
        roles={roles}
        onOpenChange={(o) => !o && setEditing(undefined)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="ลบชุดลิงก์นี้?"
        description={deleting ? `ลบ “${deleting.name}” แล้ว พนักงานจะไม่เห็นชุดนี้ ลิงก์ที่อยู่ในชุดยังอยู่ครบ` : undefined}
        confirmLabel="ลบชุดลิงก์"
        destructive
        onConfirm={async () => {
          if (deleting) await del.mutateAsync(deleting.id)
        }}
      />
    </div>
  )
}
