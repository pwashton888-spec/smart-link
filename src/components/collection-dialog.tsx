import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Plus, Search, X } from 'lucide-react'
import type { Collection, Role } from '@/lib/types'
import { useSaveCollection } from '@/hooks/collections'
import { cn, errorMessage, hostnameOf } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ColorPicker } from './color-picker'
import { CATEGORY_ICONS, CategoryIcon } from './icons'
import { LinkIcon } from './link-icon'

export interface PickableLink {
  id: string
  title: string
  url: string
  icon_url: string | null
  tags: string[]
  /** ข้อความเสริม เช่น หมวดหมู่ */
  note?: string
}

const MAX_LINKS = 50

/**
 * สร้าง / แก้ไขชุดลิงก์
 * scope = 'org'      : ผู้ดูแลสร้างชุดขององค์กร เลือกตำแหน่งที่มองเห็นได้
 * scope = 'personal' : พนักงานสร้างชุดของตัวเอง เลือกจากลิงก์ที่ตัวเองเปิดได้
 */
export function CollectionDialog({
  open,
  collection,
  scope,
  links,
  roles = [],
  onOpenChange,
}: {
  open: boolean
  collection: Collection | null
  scope: 'org' | 'personal'
  links: PickableLink[]
  roles?: Role[]
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveCollection()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('Folder')
  const [color, setColor] = useState('#14a3a0')
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [linkIds, setLinkIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!open) return
    setName(collection?.name ?? '')
    setDescription(collection?.description ?? '')
    setIcon(collection?.icon ?? 'Folder')
    setColor(collection?.color ?? '#14a3a0')
    setRoleIds(collection?.role_ids ?? [])
    // คงเฉพาะลิงก์ที่ยังเลือกได้ (ลิงก์ที่ถูกลบหรือหมดสิทธิ์จะหายไปเอง)
    const allowed = new Set(links.map((l) => l.id))
    setLinkIds((collection?.collection_items ?? []).map((i) => i.link_id).filter((id) => allowed.has(id)))
    setQuery('')
    setError(undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, collection])

  const linkById = useMemo(() => new Map(links.map((l) => [l.id, l])), [links])
  const selected = linkIds.map((id) => linkById.get(id)).filter((l): l is PickableLink => !!l)
  const candidates = useMemo(() => {
    const q = query.toLowerCase().trim()
    const chosen = new Set(linkIds)
    return links
      .filter((l) => !chosen.has(l.id))
      .filter((l) => !q || [l.title, l.url, l.note ?? '', l.tags.join(' ')].some((s) => s.toLowerCase().includes(q)))
      .slice(0, 100)
  }, [links, linkIds, query])

  function move(id: string, dir: -1 | 1) {
    setLinkIds((ids) => {
      const i = ids.indexOf(id)
      const j = i + dir
      if (j < 0 || j >= ids.length) return ids
      const next = [...ids]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('กรุณาตั้งชื่อชุดลิงก์')
    try {
      await save.mutateAsync({ id: collection?.id, scope, name, description, icon, color, roleIds, linkIds })
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{collection ? 'แก้ไขชุดลิงก์' : 'สร้างชุดลิงก์'}</DialogTitle>
          <DialogDescription>
            {scope === 'org'
              ? 'รวมลิงก์ที่ใช้ร่วมกันตามลักษณะงานเป็นชุด เช่น “งานการเงิน” พนักงานเปิดแต่ละลิงก์จากชุดได้ทันที'
              : 'รวมลิงก์ที่คุณใช้คู่กันเป็นชุด ชุดลิงก์ของคุณมองเห็นได้เฉพาะคุณ'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ชื่อชุดลิงก์ *" htmlFor="cl-name" error={error}>
              <Input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น งานการเงิน" maxLength={80} autoFocus />
            </Field>
            <Field label="คำอธิบาย" htmlFor="cl-desc">
              <Textarea id="cl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={1} maxLength={500} placeholder="เช่น ใช้ปิดบัญชีสิ้นเดือน" />
            </Field>
          </div>

          <div className="space-y-2">
              <Label>ไอคอน</Label>
              <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12">
                {Object.keys(CATEGORY_ICONS).map((k) => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setIcon(k)}
                    className={cn('flex h-8 items-center justify-center rounded-lg border transition hover:bg-accent', icon === k && 'border-teal bg-teal/10 text-teal')}
                    aria-label={k}
                  >
                    <CategoryIcon name={k} />
                  </button>
                ))}
              </div>
          </div>
          <div className="space-y-2">
            <Label>สี</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          {scope === 'org' && (
            <div className="space-y-2 rounded-2xl border bg-muted/30 p-4">
              <Label>ตำแหน่งที่มองเห็นชุดนี้</Label>
              <p className="text-xs text-muted-foreground">ไม่เลือกเลย = พนักงานทุกคนเห็น · พนักงานจะเห็นเฉพาะลิงก์ในชุดที่ตัวเองมีสิทธิ์เปิด</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {roles.map((r) => (
                  <label key={r.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent">
                    <Checkbox
                      checked={roleIds.includes(r.id)}
                      onCheckedChange={(c) => setRoleIds(c ? [...roleIds, r.id] : roleIds.filter((x) => x !== r.id))}
                    />
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                    <span className="text-sm">{r.name}</span>
                    {!r.is_active && <span className="text-xs text-muted-foreground">(ปิดใช้งาน)</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>ลิงก์ในชุด ({selected.length})</Label>
              <div className="max-h-72 min-h-[8rem] space-y-1 overflow-y-auto rounded-xl border p-1.5 scrollbar-thin">
                {selected.length ? (
                  selected.map((l, i) => (
                    <div key={l.id} className="flex items-center gap-2 rounded-lg bg-card px-2 py-1.5">
                      <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
                      <LinkIcon title={l.title} url={l.url} iconUrl={l.icon_url} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm">{l.title}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(l.id, -1)} aria-label="เลื่อนขึ้น"><ArrowUp /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === selected.length - 1} onClick={() => move(l.id, 1)} aria-label="เลื่อนลง"><ArrowDown /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setLinkIds(linkIds.filter((x) => x !== l.id))} aria-label="นำออก"><X /></Button>
                    </div>
                  ))
                ) : (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">ยังไม่มีลิงก์ เลือกจากรายการด้านขวา</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>เลือกลิงก์</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อ URL แท็ก" className="h-9 pl-8 text-sm" />
              </div>
              <div className="max-h-60 space-y-0.5 overflow-y-auto scrollbar-thin">
                {candidates.map((l) => (
                  <button
                    type="button"
                    key={l.id}
                    disabled={linkIds.length >= MAX_LINKS}
                    onClick={() => setLinkIds([...linkIds, l.id])}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-accent disabled:opacity-50"
                  >
                    <LinkIcon title={l.title} url={l.url} iconUrl={l.icon_url} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{l.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{hostnameOf(l.url)}{l.note && ` · ${l.note}`}</span>
                    </span>
                    <Plus className="h-4 w-4 shrink-0 text-teal" />
                  </button>
                ))}
                {!candidates.length && <p className="px-2 py-3 text-xs text-muted-foreground">ไม่พบลิงก์</p>}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" loading={save.isPending}>{collection ? 'บันทึก' : 'สร้างชุดลิงก์'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
