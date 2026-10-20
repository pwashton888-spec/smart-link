import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BriefcaseBusiness, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRawLinks, useRoles } from '@/hooks/data'
import { useAdminProfiles } from '@/hooks/admin'
import type { Role } from '@/lib/types'
import { cn, errorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge, RoleBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { COLORS, ColorPicker } from '@/components/color-picker'
import { AdminHeader } from './admin-header'

function RoleDialog({ role, open, onOpenChange, nextOrder }: { role: Role | null; open: boolean; onOpenChange: (o: boolean) => void; nextOrder: number }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [order, setOrder] = useState('0')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(role?.name ?? '')
    setCode(role?.code ?? '')
    setDescription(role?.description ?? '')
    setColor(role?.color ?? COLORS[0])
    setOrder(String(role?.sort_order ?? nextOrder))
    setActive(role?.is_active ?? true)
  }, [open, role, nextOrder])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^[a-z0-9_]{2,40}$/.test(code)) return toast.error('รหัสตำแหน่งใช้ได้เฉพาะ a-z 0-9 และ _ (2-40 ตัว)')
    setSaving(true)
    const row = { name: name.trim(), code, description: description.trim() || null, color, sort_order: Number(order) || 0, is_active: active }
    const { error } = role ? await supabase.from('roles').update(row).eq('id', role.id) : await supabase.from('roles').insert(row)
    setSaving(false)
    if (error) return toast.error(errorMessage(error))
    toast.success(role ? 'บันทึกตำแหน่งแล้ว' : 'เพิ่มตำแหน่งแล้ว')
    queryClient.invalidateQueries({ queryKey: ['roles'] })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? 'แก้ไขตำแหน่งงาน' : 'เพิ่มตำแหน่งงาน'}</DialogTitle>
          <DialogDescription>ปิดใช้งานตำแหน่งเพื่อระงับสิทธิ์ของตำแหน่งนี้ทั้งหมดชั่วคราว</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ชื่อตำแหน่ง *" htmlFor="role-name">
              <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </Field>
            <Field label="รหัส (ภาษาอังกฤษ) *" htmlFor="role-code" hint="เช่น hr, sales_manager">
              <Input id="role-code" value={code} onChange={(e) => setCode(e.target.value.toLowerCase())} required />
            </Field>
          </div>
          <Field label="คำอธิบาย" htmlFor="role-desc">
            <Textarea id="role-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
          <div className="space-y-2">
            <Label>สี</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <Field label="ลำดับการแสดง" htmlFor="role-order" className="w-32">
              <Input id="role-order" type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2.5 pb-2 text-sm">
              <Switch checked={active} onCheckedChange={setActive} /> เปิดใช้งาน
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" loading={saving}>บันทึก</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminRolesPage() {
  const queryClient = useQueryClient()
  const roles = useRoles()
  const { data: profiles = [] } = useAdminProfiles()
  const { data: links = [] } = useRawLinks()
  const [editing, setEditing] = useState<Role | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<Role | null>(null)

  const list = roles.data ?? []
  const usersOf = (id: string) => profiles.filter((p) => p.user_roles.some((r) => r.role_id === id)).length
  const linksOf = (id: string) => links.filter((l) => l.link_roles.some((r) => r.role_id === id)).length

  async function remove(r: Role) {
    const { error } = await supabase.from('roles').delete().eq('id', r.id)
    if (error) {
      toast.error(errorMessage(error))
      throw error
    }
    toast.success('ลบตำแหน่งแล้ว')
    queryClient.invalidateQueries()
  }

  return (
    <div className="space-y-6">
      <AdminHeader
        title="ตำแหน่งงาน"
        description="พนักงาน 1 คนมีได้หลายตำแหน่ง ระบบรวมสิทธิ์จากทุกตำแหน่งให้อัตโนมัติ"
        action={<Button onClick={() => setEditing(null)}><Plus /> เพิ่มตำแหน่ง</Button>}
      />
      {roles.error ? (
        <ErrorState message={(roles.error as Error).message} onRetry={() => roles.refetch()} />
      ) : roles.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      ) : !list.length ? (
        <EmptyState icon={BriefcaseBusiness} title="ยังไม่มีตำแหน่งงาน" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <div key={r.id} className={cn('rounded-2xl border bg-card/80 p-5 shadow-soft', !r.is_active && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <RoleBadge name={r.name} color={r.color} className="text-sm" />
                <div className="-mr-2 -mt-2 flex">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(r)} aria-label="แก้ไข"><Pencil /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleting(r)} aria-label="ลบ"><Trash2 /></Button>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{r.description || '-'}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">{usersOf(r.id)} พนักงาน</Badge>
                <Badge variant="secondary">{linksOf(r.id)} ลิงก์</Badge>
                <Badge variant="outline" className="font-mono">{r.code}</Badge>
                {!r.is_active && <Badge variant="destructive">ปิดใช้งาน</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
      <RoleDialog
        open={editing !== undefined}
        role={editing ?? null}
        nextOrder={(list.at(-1)?.sort_order ?? 0) + 1}
        onOpenChange={(o) => !o && setEditing(undefined)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="ลบตำแหน่งงาน?"
        description={
          deleting
            ? `พนักงาน ${usersOf(deleting.id)} คนจะถูกถอนตำแหน่ง “${deleting.name}” และลิงก์ ${linksOf(deleting.id)} รายการจะไม่ผูกกับตำแหน่งนี้อีก หากต้องการระงับชั่วคราว แนะนำให้ปิดใช้งานแทน`
            : undefined
        }
        confirmLabel="ลบตำแหน่ง"
        destructive
        onConfirm={() => deleting && remove(deleting)}
      />
    </div>
  )
}
