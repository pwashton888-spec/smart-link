import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, FolderTree, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCategories, useRawLinks, useRoles } from '@/hooks/data'
import type { Category } from '@/lib/types'
import { cn, errorMessage, slugify } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/label'
import { Select, SELECT_NONE } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { CATEGORY_ICONS, CategoryIcon } from '@/components/icons'
import { AdminHeader } from './admin-header'
import { COLORS, ColorPicker } from '@/components/color-picker'

function CategoryDialog({ category, open, onOpenChange }: { category: Category | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient()
  const { data: roles = [] } = useRoles()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('Folder')
  const [color, setColor] = useState(COLORS[0])
  const [roleId, setRoleId] = useState(SELECT_NONE)
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(category?.name ?? '')
    setSlug(category?.slug ?? '')
    setDescription(category?.description ?? '')
    setIcon(category?.icon ?? 'Folder')
    setColor(category?.color ?? COLORS[0])
    setRoleId(category?.role_id ?? SELECT_NONE)
    setActive(category?.is_active ?? true)
  }, [open, category])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const finalSlug = slug.trim() || slugify(name) || `cat-${Date.now().toString(36)}`
    if (!/^[a-z0-9_-]{2,60}$/.test(finalSlug)) return toast.error('รหัสหมวดหมู่ใช้ได้เฉพาะ a-z 0-9 - _ (2-60 ตัว)')
    setSaving(true)
    const row = {
      name: name.trim(),
      slug: finalSlug,
      description: description.trim() || null,
      icon,
      color,
      role_id: roleId === SELECT_NONE ? null : roleId,
      is_active: active,
    }
    const { error } = category
      ? await supabase.from('categories').update(row).eq('id', category.id)
      : await supabase.from('categories').insert({ ...row, sort_order: 1000 })
    setSaving(false)
    if (error) return toast.error(errorMessage(error))
    toast.success(category ? 'บันทึกหมวดหมู่แล้ว' : 'เพิ่มหมวดหมู่แล้ว')
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{category ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ชื่อหมวดหมู่ *" htmlFor="cat-name">
              <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </Field>
            <Field label="รหัส (ภาษาอังกฤษ)" htmlFor="cat-slug" hint="ใช้ใน URL เว้นว่างเพื่อสร้างอัตโนมัติ">
              <Input id="cat-slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} disabled={category?.is_system} placeholder="เช่น hr-tools" />
            </Field>
          </div>
          <Field label="คำอธิบาย" htmlFor="cat-desc">
            <Textarea id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
          <Field label="ผูกกับตำแหน่ง (ไม่บังคับ)" hint="เมื่อเลือกหมวดนี้ในฟอร์มลิงก์ ระบบจะติ๊กตำแหน่งนี้ให้อัตโนมัติ">
            <Select value={roleId} onValueChange={setRoleId} options={[{ value: SELECT_NONE, label: 'ไม่ผูก' }, ...roles.map((r) => ({ value: r.id, label: r.name }))]} />
          </Field>
          <div className="space-y-2">
            <Label>ไอคอน</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {Object.keys(CATEGORY_ICONS).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setIcon(k)}
                  className={cn('flex h-9 items-center justify-center rounded-lg border transition hover:bg-accent', icon === k && 'border-teal bg-teal/10 text-teal')}
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
          <label className="flex items-center gap-2.5 text-sm">
            <Switch checked={active} onCheckedChange={setActive} /> เปิดใช้งาน
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" loading={saving}>บันทึก</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient()
  const categories = useCategories()
  const { data: links = [] } = useRawLinks()
  const { data: roles = [] } = useRoles()
  const [editing, setEditing] = useState<Category | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const list = categories.data ?? []
  const countFor = (id: string) => links.filter((l) => l.category_id === id && l.visibility !== 'personal').length

  async function move(index: number, dir: -1 | 1) {
    const ids = list.map((c) => c.id)
    const [item] = ids.splice(index, 1)
    ids.splice(index + dir, 0, item)
    queryClient.setQueryData<Category[]>(['categories'], (old) =>
      old ? [...old].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)) : old,
    )
    const { error } = await supabase.rpc('reorder_categories', { p_ids: ids })
    if (error) toast.error(errorMessage(error))
    queryClient.invalidateQueries({ queryKey: ['categories'] })
  }

  async function remove(c: Category) {
    const { error } = await supabase.from('categories').delete().eq('id', c.id)
    if (error) {
      toast.error(errorMessage(error))
      throw error
    }
    toast.success('ลบหมวดหมู่แล้ว ลิงก์ในหมวดนี้จะเป็น “ไม่ระบุหมวดหมู่”')
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    queryClient.invalidateQueries({ queryKey: ['links'] })
  }

  return (
    <div className="space-y-6">
      <AdminHeader
        title="หมวดหมู่เว็บไซต์"
        description="เพิ่ม แก้ไข และจัดเรียงหมวดหมู่ ลำดับนี้ใช้ทั้งเมนูและ Dashboard"
        action={<Button onClick={() => setEditing(null)}><Plus /> เพิ่มหมวดหมู่</Button>}
      />
      {categories.error ? (
        <ErrorState message={(categories.error as Error).message} onRetry={() => categories.refetch()} />
      ) : categories.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : !list.length ? (
        <EmptyState icon={FolderTree} title="ยังไม่มีหมวดหมู่" />
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl border bg-card/80 shadow-soft">
          {list.map((c, i) => {
            const role = roles.find((r) => r.id === c.role_id)
            return (
              <div key={c.id} className={cn('flex items-center gap-3 px-4 py-3', !c.is_active && 'opacity-60')}>
                <div className="flex flex-col">
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0} onClick={() => move(i, -1)} aria-label="เลื่อนขึ้น"><ArrowUp /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="เลื่อนลง"><ArrowDown /></Button>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${c.color}1a`, color: c.color }}>
                  <CategoryIcon name={c.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {c.name}
                    {c.is_system && <Badge variant="secondary"><Lock className="h-3 w-3" /> ระบบ</Badge>}
                    {!c.is_active && <Badge variant="destructive">ปิดใช้งาน</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {countFor(c.id)} ลิงก์{role && ` · ผูกกับ ${role.name}`}{c.description && ` · ${c.description}`}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEditing(c)} aria-label="แก้ไข"><Pencil /></Button>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={c.is_system} onClick={() => setDeleting(c)} aria-label="ลบ"><Trash2 /></Button>
              </div>
            )
          })}
        </div>
      )}
      <CategoryDialog open={editing !== undefined} category={editing ?? null} onOpenChange={(o) => !o && setEditing(undefined)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="ลบหมวดหมู่?"
        description={deleting ? `“${deleting.name}” จะถูกลบ ลิงก์ ${countFor(deleting.id)} รายการในหมวดนี้จะไม่ถูกลบ` : undefined}
        confirmLabel="ลบหมวดหมู่"
        destructive
        onConfirm={() => deleting && remove(deleting)}
      />
    </div>
  )
}
