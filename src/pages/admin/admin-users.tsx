import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Ban, CheckCircle2, KeyRound, Pencil, Search, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/auth'
import { useRoles } from '@/hooks/data'
import { callAdminUsers, useAdminProfiles, type AdminProfile } from '@/hooks/admin'
import type { Role } from '@/lib/types'
import { cn, errorMessage, formatDateTime, initials, relativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/label'
import { Select, SELECT_NONE } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge, RoleBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { AdminHeader } from './admin-header'

function RolePicker({ roles, value, onChange }: { roles: Role[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {roles.map((r) => (
        <label
          key={r.id}
          className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 transition', value.includes(r.id) ? 'border-teal bg-teal/5' : 'hover:bg-accent')}
        >
          <Checkbox checked={value.includes(r.id)} onCheckedChange={(c) => onChange(c ? [...value, r.id] : value.filter((x) => x !== r.id))} />
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
          <span className="text-sm">{r.name}</span>
          {!r.is_active && <span className="text-xs text-muted-foreground">(ปิด)</span>}
        </label>
      ))}
    </div>
  )
}

function InviteDialog({ open, onOpenChange, roles }: { open: boolean; onOpenChange: (o: boolean) => void; roles: Role[] }) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setEmail('')
      setName('')
      setJobTitle('')
      setRoleIds([])
      setIsAdmin(false)
    }
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await callAdminUsers({
        action: 'invite',
        email,
        full_name: name,
        job_title: jobTitle,
        role_ids: roleIds,
        is_admin: isAdmin,
        redirect_to: `${window.location.origin}/reset-password`,
      })
      toast.success(`ส่งอีเมลเชิญไปที่ ${email} แล้ว`)
      queryClient.invalidateQueries({ queryKey: ['admin', 'profiles'] })
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>เพิ่มพนักงาน</DialogTitle>
          <DialogDescription>ระบบจะส่งอีเมลเชิญให้พนักงานตั้งรหัสผ่านเอง (ระบบไม่สร้างรหัสผ่านให้)</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ชื่อ-นามสกุล *" htmlFor="inv-name">
              <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </Field>
            <Field label="อีเมล *" htmlFor="inv-email">
              <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
          </div>
          <Field label="ชื่อตำแหน่งที่แสดง (ไม่บังคับ)" htmlFor="inv-job">
            <Input id="inv-job" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </Field>
          <div className="space-y-2">
            <Label>ตำแหน่งงาน (เลือกได้หลายตำแหน่ง)</Label>
            <RolePicker roles={roles} value={roleIds} onChange={setRoleIds} />
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <Switch checked={isAdmin} onCheckedChange={setIsAdmin} />
            <span className="text-sm">
              <span className="block font-medium">สิทธิ์ผู้ดูแลระบบ</span>
              <span className="text-xs text-muted-foreground">จัดการบัญชี ลิงก์ และสิทธิ์พนักงานทั้งหมดได้</span>
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" loading={saving}><UserPlus /> ส่งคำเชิญ</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LoginHistory({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'logins', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, created_at')
        .eq('actor_id', userId)
        .eq('action', 'login')
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data as { id: number; created_at: string }[]
    },
  })
  if (isLoading) return <Skeleton className="h-16" />
  if (!data?.length) return <p className="text-sm text-muted-foreground">ยังไม่มีประวัติการเข้าสู่ระบบ</p>
  return (
    <ul className="space-y-1 text-sm">
      {data.map((l) => (
        <li key={l.id} className="flex justify-between gap-2 text-muted-foreground">
          <span>{formatDateTime(l.created_at)}</span>
          <span className="text-xs">{relativeTime(l.created_at)}</span>
        </li>
      ))}
    </ul>
  )
}

function EditUserDialog({ user, roles, onOpenChange }: { user: AdminProfile | null; roles: Role[]; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient()
  const { profile: me, refresh } = useAuth()
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setName(user.full_name)
    setJobTitle(user.job_title ?? '')
    setRoleIds(user.user_roles.map((r) => r.role_id))
    setIsAdmin(user.is_admin)
  }, [user])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: name.trim(), job_title: jobTitle.trim() || null, is_admin: isAdmin })
        .eq('id', user.id)
      if (error) throw error
      const have = user.user_roles.map((r) => r.role_id)
      const add = roleIds.filter((r) => !have.includes(r))
      const del = have.filter((r) => !roleIds.includes(r))
      if (add.length) {
        const { error } = await supabase.from('user_roles').insert(add.map((role_id) => ({ user_id: user.id, role_id, assigned_by: me?.id })))
        if (error) throw error
      }
      if (del.length) {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', user.id).in('role_id', del)
        if (error) throw error
      }
      toast.success('บันทึกข้อมูลพนักงานแล้ว พนักงานจะเห็นสิทธิ์ใหม่ทันที')
      queryClient.invalidateQueries({ queryKey: ['admin', 'profiles'] })
      if (user.id === me?.id) refresh()
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {user && (
          <>
            <DialogHeader>
              <DialogTitle>แก้ไขข้อมูลพนักงาน</DialogTitle>
              <DialogDescription>{user.email}</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="ชื่อ-นามสกุล" htmlFor="eu-name">
                  <Input id="eu-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </Field>
                <Field label="ชื่อตำแหน่งที่แสดง" htmlFor="eu-job">
                  <Input id="eu-job" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                </Field>
              </div>
              <div className="space-y-2">
                <Label>ตำแหน่งงาน</Label>
                <RolePicker roles={roles} value={roleIds} onChange={setRoleIds} />
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                <Switch checked={isAdmin} onCheckedChange={setIsAdmin} />
                <span className="text-sm">
                  <span className="block font-medium">สิทธิ์ผู้ดูแลระบบ</span>
                  <span className="text-xs text-muted-foreground">แยกจากตำแหน่งงาน ระบบต้องมีผู้ดูแลอย่างน้อย 1 คนเสมอ</span>
                </span>
              </label>
              <div className="rounded-xl border p-3">
                <p className="mb-2 text-sm font-medium">ประวัติการเข้าสู่ระบบล่าสุด</p>
                <LoginHistory userId={user.id} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
                <Button type="submit" loading={saving}>บันทึก</Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const { profile: me } = useAuth()
  const profiles = useAdminProfiles()
  const { data: roles = [] } = useRoles()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState(SELECT_NONE)
  const [statusFilter, setStatusFilter] = useState(SELECT_NONE)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editing, setEditing] = useState<AdminProfile | null>(null)
  const [toggling, setToggling] = useState<AdminProfile | null>(null)
  const [resetting, setResetting] = useState<AdminProfile | null>(null)

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return (profiles.data ?? []).filter((p) => {
      if (roleFilter === 'admin' && !p.is_admin) return false
      if (roleFilter !== SELECT_NONE && roleFilter !== 'admin' && !p.user_roles.some((r) => r.role_id === roleFilter)) return false
      if (statusFilter === 'active' && !p.is_active) return false
      if (statusFilter === 'suspended' && p.is_active) return false
      return !q || p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    })
  }, [profiles.data, query, roleFilter, statusFilter])

  const total = profiles.data?.length ?? 0
  const active = profiles.data?.filter((p) => p.is_active).length ?? 0

  async function toggleActive(user: AdminProfile) {
    try {
      await callAdminUsers({ action: 'set_active', user_id: user.id, is_active: !user.is_active })
      toast.success(user.is_active ? `ระงับบัญชี ${user.full_name} แล้ว` : `เปิดใช้งานบัญชี ${user.full_name} แล้ว`)
      queryClient.invalidateQueries({ queryKey: ['admin', 'profiles'] })
    } catch (err) {
      toast.error(errorMessage(err))
      throw err
    }
  }

  async function sendReset(user: AdminProfile) {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/reset-password` })
    if (error) {
      toast.error(errorMessage(error))
      throw error
    }
    toast.success(`ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${user.email} แล้ว`)
  }

  return (
    <div className="space-y-6">
      <AdminHeader
        title="จัดการพนักงาน"
        description={`ทั้งหมด ${total} คน · ใช้งานอยู่ ${active} คน`}
        action={<Button onClick={() => setInviteOpen(true)}><UserPlus /> เพิ่มพนักงาน</Button>}
      />

      <div className="grid gap-2 sm:grid-cols-[1fr_200px_160px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อหรืออีเมล" className="pl-9" />
        </div>
        <Select
          value={roleFilter}
          onValueChange={setRoleFilter}
          options={[{ value: SELECT_NONE, label: 'ทุกตำแหน่ง' }, ...roles.map((r) => ({ value: r.id, label: r.name })), { value: 'admin', label: 'ผู้ดูแลระบบ' }]}
        />
        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={[{ value: SELECT_NONE, label: 'ทุกสถานะ' }, { value: 'active', label: 'ใช้งานอยู่' }, { value: 'suspended', label: 'ถูกระงับ' }]}
        />
      </div>

      {profiles.error ? (
        <ErrorState message={(profiles.error as Error).message} onRetry={() => profiles.refetch()} />
      ) : profiles.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : !filtered.length ? (
        <EmptyState icon={Users} title="ไม่พบพนักงาน" />
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl border bg-card/80 shadow-soft">
          {filtered.map((p) => (
            <div key={p.id} className={cn('flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center', !p.is_active && 'bg-muted/40')}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold', p.is_active ? 'bg-teal/15 text-teal' : 'bg-muted text-muted-foreground')}>
                  {initials(p.full_name || p.email)}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {p.full_name}
                    {p.id === me?.id && <span className="text-xs font-normal text-muted-foreground">(คุณ)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{p.email}{p.job_title && ` · ${p.job_title}`}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 md:w-[34%]">
                {p.is_admin && <Badge variant="warning"><ShieldCheck className="h-3 w-3" /> ผู้ดูแล</Badge>}
                {p.user_roles.map((r) => {
                  const role = roleById.get(r.role_id)
                  return role ? <RoleBadge key={r.role_id} name={role.name} color={role.color} /> : null
                })}
                {!p.is_admin && !p.user_roles.length && <span className="text-xs text-muted-foreground">ยังไม่มีตำแหน่ง</span>}
              </div>
              <div className="flex items-center justify-between gap-2 md:w-[30%] md:justify-end">
                <div className="text-left md:text-right">
                  {p.is_active ? <Badge variant="teal">ใช้งานอยู่</Badge> : <Badge variant="destructive">ถูกระงับ</Badge>}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {p.last_sign_in_at ? `เข้าใช้ ${relativeTime(p.last_sign_in_at)}` : 'ยังไม่เคยเข้าใช้'}
                  </p>
                </div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(p)} title="แก้ไข" aria-label="แก้ไข"><Pencil /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setResetting(p)} title="ส่งลิงก์ตั้งรหัสผ่านใหม่" aria-label="ส่งลิงก์ตั้งรหัสผ่านใหม่"><KeyRound /></Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={p.id === me?.id}
                    onClick={() => setToggling(p)}
                    title={p.is_active ? 'ระงับบัญชี' : 'เปิดใช้งานบัญชี'}
                    aria-label={p.is_active ? 'ระงับบัญชี' : 'เปิดใช้งานบัญชี'}
                    className={p.is_active ? 'text-destructive hover:text-destructive' : 'text-teal'}
                  >
                    {p.is_active ? <Ban /> : <CheckCircle2 />}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} roles={roles} />
      <EditUserDialog user={editing} roles={roles} onOpenChange={(o) => !o && setEditing(null)} />
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.is_active ? 'ระงับบัญชีพนักงาน?' : 'เปิดใช้งานบัญชี?'}
        description={
          toggling?.is_active
            ? `${toggling.full_name} จะออกจากระบบและเข้าใช้งานไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง (ข้อมูลไม่ถูกลบ)`
            : `${toggling?.full_name} จะกลับมาเข้าสู่ระบบได้ตามสิทธิ์เดิม`
        }
        confirmLabel={toggling?.is_active ? 'ระงับบัญชี' : 'เปิดใช้งาน'}
        destructive={toggling?.is_active}
        onConfirm={() => toggling && toggleActive(toggling)}
      />
      <ConfirmDialog
        open={!!resetting}
        onOpenChange={(o) => !o && setResetting(null)}
        title="ส่งลิงก์ตั้งรหัสผ่านใหม่?"
        description={resetting ? `ระบบจะส่งอีเมลไปที่ ${resetting.email}` : undefined}
        confirmLabel="ส่งลิงก์"
        onConfirm={() => resetting && sendReset(resetting)}
      />
    </div>
  )
}
