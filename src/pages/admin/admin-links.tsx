import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, ArrowDown, ArrowUp, Globe, Link2, Loader2, Pencil, Plus, Search, ShieldCheck, Star, Trash2, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCategories, useRawLinks, useRoles } from '@/hooks/data'
import { callCheckLinks, useAdminProfiles, useLinkChecks } from '@/hooks/admin'
import type { LinkRow } from '@/lib/types'
import { cn, errorMessage, formatDateTime, hostnameOf } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SELECT_NONE } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge, RoleBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { LinkIcon } from '@/components/link-icon'
import { LinkFormDialog } from './link-form-dialog'
import { AdminHeader } from './admin-header'

export default function AdminLinksPage() {
  const queryClient = useQueryClient()
  const links = useRawLinks()
  const { data: roles = [] } = useRoles()
  const { data: categories = [] } = useCategories()
  const { data: profiles = [] } = useAdminProfiles()
  const { data: checks } = useLinkChecks()
  const [searchParams] = useSearchParams()

  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState(SELECT_NONE)
  const [accessFilter, setAccessFilter] = useState(SELECT_NONE)
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? SELECT_NONE)
  const [checking, setChecking] = useState(false)
  const [editing, setEditing] = useState<LinkRow | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<LinkRow | null>(null)

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles])
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  // ผู้ดูแลจัดการเฉพาะลิงก์ขององค์กร (ลิงก์ส่วนตัวเป็นของพนักงานแต่ละคน)
  const orgLinks = useMemo(
    () => (links.data ?? []).filter((l) => l.visibility !== 'personal').sort((a, b) => a.sort_order - b.sort_order),
    [links.data],
  )
  const groupSuggestions = useMemo(
    () => Array.from(new Set(orgLinks.map((l) => l.group_name).filter((g): g is string => !!g))),
    [orgLinks],
  )

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return orgLinks.filter((l) => {
      if (catFilter !== SELECT_NONE && l.category_id !== catFilter) return false
      if (accessFilter === 'global' && l.visibility !== 'global') return false
      if (accessFilter === 'users' && !l.link_user_permissions.length) return false
      if (accessFilter.startsWith('role:') && !l.link_roles.some((r) => r.role_id === accessFilter.slice(5))) return false
      if (statusFilter === 'active' && !l.is_active) return false
      if (statusFilter === 'inactive' && l.is_active) return false
      if (statusFilter === 'featured' && !l.is_featured) return false
      if (statusFilter === 'broken' && checks?.get(l.id)?.status !== 'broken') return false
      if (!q) return true
      return [l.title, l.url, l.description ?? '', l.tags.join(' '), l.group_name ?? ''].some((s) => s.toLowerCase().includes(q))
    })
  }, [orgLinks, query, catFilter, accessFilter, statusFilter, checks])

  async function patch(link: LinkRow, values: Partial<LinkRow>, message: string) {
    queryClient.setQueryData<LinkRow[]>(['links'], (old) => old?.map((l) => (l.id === link.id ? { ...l, ...values } : l)))
    const { error } = await supabase.from('links').update(values).eq('id', link.id)
    if (error) toast.error(errorMessage(error))
    else toast.success(message)
    queryClient.invalidateQueries({ queryKey: ['links'] })
  }

  async function move(link: LinkRow, dir: -1 | 1) {
    const ids = orgLinks.map((l) => l.id)
    const i = ids.indexOf(link.id)
    // ขยับข้ามไปยังรายการถัดไปที่มองเห็นในตัวกรองปัจจุบัน
    const visibleIds = filtered.map((l) => l.id)
    const vi = visibleIds.indexOf(link.id)
    const neighbor = visibleIds[vi + dir]
    if (!neighbor) return
    const j = ids.indexOf(neighbor)
    ids.splice(i, 1)
    ids.splice(j, 0, link.id)
    queryClient.setQueryData<LinkRow[]>(['links'], (old) =>
      old?.map((l) => (ids.includes(l.id) ? { ...l, sort_order: ids.indexOf(l.id) + 1 } : l)),
    )
    const { error } = await supabase.rpc('reorder_links', { p_ids: ids })
    if (error) toast.error(errorMessage(error))
    queryClient.invalidateQueries({ queryKey: ['links'] })
  }

  async function checkAll() {
    setChecking(true)
    try {
      const res = await callCheckLinks()
      if (res.broken.length) {
        toast.error(`ตรวจ ${res.checked} ลิงก์ พบลิงก์เสีย ${res.broken.length} รายการ`)
        setStatusFilter('broken')
      } else {
        toast.success(`ตรวจ ${res.checked} ลิงก์ ทุกลิงก์เปิดได้ปกติ`)
      }
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setChecking(false)
      queryClient.invalidateQueries({ queryKey: ['admin', 'link-checks'] })
    }
  }

  const brokenCount = useMemo(() => orgLinks.filter((l) => checks?.get(l.id)?.status === 'broken').length, [orgLinks, checks])

  function CheckBadge({ l }: { l: LinkRow }) {
    const c = checks?.get(l.id)
    if (c?.status !== 'broken') return null
    return (
      <Badge variant="destructive" title={`${c.detail ?? ''} · ตรวจเมื่อ ${formatDateTime(c.checked_at)}`} className="shrink-0">
        <AlertTriangle className="h-3 w-3" /> ลิงก์เสีย
      </Badge>
    )
  }

  async function remove(link: LinkRow) {
    const { error } = await supabase.from('links').delete().eq('id', link.id)
    if (error) {
      toast.error(errorMessage(error))
      throw error
    }
    toast.success('ลบลิงก์แล้ว (ข้อมูลเดิมถูกเก็บไว้ในประวัติการใช้งาน)')
    queryClient.invalidateQueries({ queryKey: ['links'] })
  }

  function AccessCell({ l }: { l: LinkRow }) {
    if (l.visibility === 'global') return <Badge variant="teal"><Globe className="h-3 w-3" /> ส่วนกลาง</Badge>
    return (
      <div className="flex flex-wrap gap-1">
        {l.link_roles.map((r) => {
          const role = roleById.get(r.role_id)
          return role ? <RoleBadge key={r.role_id} name={role.name} color={role.color} /> : null
        })}
        {l.link_user_permissions.length > 0 && (
          <Badge variant="outline"><Users className="h-3 w-3" /> {l.link_user_permissions.length} คน</Badge>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AdminHeader
        title="จัดการลิงก์"
        description={`ลิงก์ขององค์กรทั้งหมด ${orgLinks.length} รายการ${brokenCount ? ` · ลิงก์เสีย ${brokenCount} รายการ` : ''}`}
        action={
          <>
            <Button variant="outline" onClick={checkAll} disabled={checking || !orgLinks.length} title="ตรวจว่าลิงก์ที่เปิดใช้งานทั้งหมดยังเปิดได้ และแจ้งเตือนผู้ดูแลเมื่อพบลิงก์เสีย">
              {checking ? <Loader2 className="animate-spin" /> : <ShieldCheck />} {checking ? 'กำลังตรวจลิงก์...' : 'ตรวจสอบลิงก์ทั้งหมด'}
            </Button>
            <Button onClick={() => setEditing(null)}><Plus /> เพิ่มลิงก์</Button>
          </>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_200px_200px_170px]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อ URL แท็ก..." className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter} options={[{ value: SELECT_NONE, label: 'ทุกหมวดหมู่' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
        <Select
          value={accessFilter}
          onValueChange={setAccessFilter}
          options={[
            { value: SELECT_NONE, label: 'ทุกสิทธิ์การเข้าถึง' },
            { value: 'global', label: 'ส่วนกลาง' },
            ...roles.map((r) => ({ value: `role:${r.id}`, label: `ตำแหน่ง: ${r.name}` })),
            { value: 'users', label: 'มอบเฉพาะบุคคล' },
          ]}
        />
        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={[
            { value: SELECT_NONE, label: 'ทุกสถานะ' },
            { value: 'active', label: 'เปิดใช้งาน' },
            { value: 'inactive', label: 'ปิดใช้งาน' },
            { value: 'featured', label: 'ลิงก์แนะนำ' },
            { value: 'broken', label: 'ลิงก์เสีย (จากการตรวจล่าสุด)' },
          ]}
        />
      </div>

      {links.error ? (
        <ErrorState message={(links.error as Error).message} onRetry={() => links.refetch()} />
      ) : links.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : !filtered.length ? (
        <EmptyState
          icon={Link2}
          title={orgLinks.length ? 'ไม่พบลิงก์ตามตัวกรอง' : 'ยังไม่มีลิงก์ในระบบ'}
          description={orgLinks.length ? undefined : 'เริ่มเพิ่มลิงก์แรกขององค์กร แล้วกำหนดตำแหน่งที่เข้าถึงได้'}
          action={!orgLinks.length && <Button onClick={() => setEditing(null)}><Plus /> เพิ่มลิงก์</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card/80 shadow-soft">
          <div className="hidden grid-cols-[72px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.6fr)_88px_88px_96px] items-center gap-3 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground lg:grid">
            <span>ลำดับ</span><span>ลิงก์</span><span>หมวดหมู่</span><span>สิทธิ์การเข้าถึง</span><span className="text-center">แนะนำ</span><span className="text-center">เปิดใช้</span><span className="text-right">จัดการ</span>
          </div>
          <div className="divide-y">
            {filtered.map((l, idx) => (
              <div
                key={l.id}
                className={cn(
                  'grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 lg:grid-cols-[72px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.6fr)_88px_88px_96px]',
                  !l.is_active && 'opacity-60',
                )}
              >
                <div className="hidden items-center gap-0.5 lg:flex">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => move(l, -1)} aria-label="เลื่อนขึ้น"><ArrowUp /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === filtered.length - 1} onClick={() => move(l, 1)} aria-label="เลื่อนลง"><ArrowDown /></Button>
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  <LinkIcon title={l.title} url={l.url} iconUrl={l.icon_url} size="sm" />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                      <CheckBadge l={l} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{hostnameOf(l.url)}{l.group_name && ` · ${l.group_name}`}</p>
                    <div className="mt-1 lg:hidden"><AccessCell l={l} /></div>
                  </div>
                </div>
                <span className="hidden truncate text-sm text-muted-foreground lg:block">{l.category_id ? catById.get(l.category_id)?.name : '-'}</span>
                <div className="hidden lg:block"><AccessCell l={l} /></div>
                <div className="hidden justify-center lg:flex">
                  <button onClick={() => patch(l, { is_featured: !l.is_featured }, l.is_featured ? 'ยกเลิกลิงก์แนะนำแล้ว' : 'ตั้งเป็นลิงก์แนะนำแล้ว')} aria-label="สลับลิงก์แนะนำ" className="rounded-lg p-1.5 hover:bg-accent">
                    <Star className={cn('h-4 w-4 text-muted-foreground', l.is_featured && 'fill-amber-400 text-amber-400')} />
                  </button>
                </div>
                <div className="hidden justify-center lg:flex">
                  <Switch checked={l.is_active} onCheckedChange={(v) => patch(l, { is_active: v }, v ? 'เปิดใช้งานลิงก์แล้ว' : 'ปิดใช้งานลิงก์แล้ว')} aria-label="เปิด/ปิดใช้งาน" />
                </div>
                <div className="flex justify-end gap-0.5">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(l)} aria-label="แก้ไข"><Pencil /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleting(l)} aria-label="ลบ"><Trash2 /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <LinkFormDialog
        open={editing !== undefined}
        link={editing ?? null}
        roles={roles}
        categories={categories}
        profiles={profiles}
        groupSuggestions={groupSuggestions}
        onOpenChange={(o) => !o && setEditing(undefined)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="ลบลิงก์นี้?"
        description={deleting ? `“${deleting.title}” จะถูกลบและพนักงานทุกคนจะมองไม่เห็น หากต้องการซ่อนชั่วคราว แนะนำให้ “ปิดใช้งาน” แทน` : undefined}
        confirmLabel="ลบถาวร"
        destructive
        onConfirm={() => deleting && remove(deleting)}
      />
    </div>
  )
}
