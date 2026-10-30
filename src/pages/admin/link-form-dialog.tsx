import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Globe, ImageUp, Loader2, Lock, Search, Wand2, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Category, LinkRow, Role } from '@/lib/types'
import { callCheckLinks, type AdminProfile } from '@/hooks/admin'
import { cn, errorMessage, faviconFor, validateUrl } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/label'
import { Select, SELECT_NONE } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { TagInput } from '@/components/tag-input'
import { LinkIcon } from '@/components/link-icon'

type Access = 'global' | 'restricted'

interface FormState {
  title: string
  url: string
  description: string
  usage_guide: string
  icon_url: string
  category_id: string
  access: Access
  role_ids: string[]
  user_ids: string[]
  tags: string[]
  group_name: string
  is_featured: boolean
  is_active: boolean
}

const empty: FormState = {
  title: '',
  url: '',
  description: '',
  usage_guide: '',
  icon_url: '',
  category_id: SELECT_NONE,
  access: 'restricted',
  role_ids: [],
  user_ids: [],
  tags: [],
  group_name: '',
  is_featured: false,
  is_active: true,
}

type Reach = 'idle' | 'checking' | 'ok' | 'fail'

export function LinkFormDialog({
  open,
  link,
  roles,
  categories,
  profiles,
  groupSuggestions,
  onOpenChange,
}: {
  open: boolean
  link: LinkRow | null
  roles: Role[]
  categories: Category[]
  profiles: AdminProfile[]
  groupSuggestions: string[]
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [reach, setReach] = useState<Reach>('idle')
  const [reachDetail, setReachDetail] = useState('')
  const [userQuery, setUserQuery] = useState('')

  useEffect(() => {
    if (!open) return
    setErrors({})
    setReach('idle')
    setUserQuery('')
    setForm(
      link
        ? {
            title: link.title,
            url: link.url,
            description: link.description ?? '',
            usage_guide: link.usage_guide ?? '',
            icon_url: link.icon_url ?? '',
            category_id: link.category_id ?? SELECT_NONE,
            access: link.visibility === 'global' ? 'global' : 'restricted',
            role_ids: link.link_roles.map((r) => r.role_id),
            user_ids: link.link_user_permissions.map((u) => u.user_id),
            tags: link.tags,
            group_name: link.group_name ?? '',
            is_featured: link.is_featured,
            is_active: link.is_active,
          }
        : empty,
    )
  }, [open, link])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  // เลือกหมวดหมู่ที่ผูกกับตำแหน่ง → ติ๊กตำแหน่งนั้นให้อัตโนมัติ
  function onCategory(value: string) {
    set('category_id', value)
    const cat = categories.find((c) => c.id === value)
    if (cat?.slug === 'global') set('access', 'global')
    if (cat?.role_id && !form.role_ids.includes(cat.role_id)) {
      setForm((f) => ({ ...f, category_id: value, access: 'restricted', role_ids: [...f.role_ids, cat.role_id!] }))
    }
  }

  const filteredProfiles = useMemo(() => {
    const q = userQuery.toLowerCase().trim()
    const active = profiles.filter((p) => p.is_active || form.user_ids.includes(p.id))
    if (!q) return active
    return active.filter((p) => p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
  }, [profiles, userQuery, form.user_ids])

  async function checkReachable() {
    const checked = validateUrl(form.url)
    if (!checked.ok) {
      setErrors((e) => ({ ...e, url: checked.error }))
      return
    }
    setReach('checking')
    setReachDetail('')
    try {
      // ตรวจจากเซิร์ฟเวอร์ (เห็นรหัสตอบกลับจริง เช่น 404)
      const res = await callCheckLinks({ url: checked.url })
      setReach(res.status === 'ok' ? 'ok' : 'fail')
      setReachDetail(res.detail)
      return
    } catch {
      // ยังไม่ได้ deploy check-links : ตรวจจากเบราว์เซอร์แทน
    }
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 8000)
      // no-cors : ตรวจได้แค่ว่าเซิร์ฟเวอร์ตอบกลับหรือไม่ (ไม่อ่านเนื้อหา)
      await fetch(checked.url, { mode: 'no-cors', signal: ctrl.signal, cache: 'no-store' })
      clearTimeout(t)
      setReach('ok')
    } catch {
      setReach('fail')
    }
  }

  async function uploadIcon(file: File) {
    if (file.size > 1024 * 1024) return toast.error('ไฟล์ต้องมีขนาดไม่เกิน 1MB')
    if (!file.type.startsWith('image/')) return toast.error('รองรับเฉพาะไฟล์รูปภาพ')
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `links/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('link-icons').upload(path, file, { contentType: file.type, upsert: false })
    setUploading(false)
    if (error) return toast.error(errorMessage(error))
    const { data } = supabase.storage.from('link-icons').getPublicUrl(path)
    set('icon_url', data.publicUrl)
    toast.success('อัปโหลดไอคอนแล้ว')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!form.title.trim()) next.title = 'กรุณากรอกชื่อเว็บไซต์'
    const checked = validateUrl(form.url)
    if (!checked.ok) next.url = checked.error
    if (form.icon_url && !/^https?:\/\//i.test(form.icon_url)) next.icon_url = 'URL ไอคอนต้องขึ้นต้นด้วย http(s)://'
    if (form.access === 'restricted' && !form.role_ids.length && !form.user_ids.length) {
      next.role_ids = 'กรุณาเลือกอย่างน้อย 1 ตำแหน่ง หรือ 1 พนักงาน'
    }
    setErrors(next)
    if (Object.keys(next).length || !checked.ok) return

    setSaving(true)
    try {
      const row = {
        title: form.title.trim(),
        url: checked.url,
        description: form.description.trim() || null,
        usage_guide: form.usage_guide.trim() || null,
        icon_url: form.icon_url.trim() || null,
        category_id: form.category_id === SELECT_NONE ? null : form.category_id,
        visibility: form.access,
        tags: form.tags,
        group_name: form.group_name.trim() || null,
        is_featured: form.is_featured,
        is_active: form.is_active,
      }
      let id = link?.id
      if (id) {
        const { error } = await supabase.from('links').update(row).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('links')
          .insert({ ...row, sort_order: Math.floor(Date.now() / 1000) })
          .select('id')
          .single()
        if (error) throw error
        id = data.id as string
      }

      // ซิงก์สิทธิ์ตามตำแหน่ง / รายบุคคล
      const wantRoles = form.access === 'global' ? [] : form.role_ids
      const wantUsers = form.access === 'global' ? [] : form.user_ids
      const haveRoles = link?.link_roles.map((r) => r.role_id) ?? []
      const haveUsers = link?.link_user_permissions.map((u) => u.user_id) ?? []
      const addRoles = wantRoles.filter((r) => !haveRoles.includes(r))
      const delRoles = haveRoles.filter((r) => !wantRoles.includes(r))
      const addUsers = wantUsers.filter((u) => !haveUsers.includes(u))
      const delUsers = haveUsers.filter((u) => !wantUsers.includes(u))

      const ops = []
      if (addRoles.length) ops.push(supabase.from('link_roles').insert(addRoles.map((role_id) => ({ link_id: id, role_id }))))
      if (delRoles.length) ops.push(supabase.from('link_roles').delete().eq('link_id', id!).in('role_id', delRoles))
      if (addUsers.length) ops.push(supabase.from('link_user_permissions').insert(addUsers.map((user_id) => ({ link_id: id, user_id }))))
      if (delUsers.length) ops.push(supabase.from('link_user_permissions').delete().eq('link_id', id!).in('user_id', delUsers))
      const results = await Promise.all(ops)
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error

      toast.success(link ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มลิงก์แล้ว')
      queryClient.invalidateQueries({ queryKey: ['links'] })
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{link ? 'แก้ไขลิงก์' : 'เพิ่มลิงก์ใหม่'}</DialogTitle>
          <DialogDescription>กำหนดรายละเอียดและสิทธิ์การเข้าถึงของลิงก์</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ชื่อเว็บไซต์ *" htmlFor="lf-title" error={errors.title}>
              <Input id="lf-title" value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus />
            </Field>
            <Field label="หมวดหมู่" htmlFor="lf-cat">
              <Select
                id="lf-cat"
                value={form.category_id}
                onValueChange={onCategory}
                options={[
                  { value: SELECT_NONE, label: 'ไม่ระบุหมวดหมู่' },
                  ...categories.filter((c) => c.slug !== 'personal').map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </Field>
          </div>

          <Field label="URL *" htmlFor="lf-url" error={errors.url}>
            <div className="flex gap-2">
              <Input
                id="lf-url"
                value={form.url}
                onChange={(e) => {
                  set('url', e.target.value)
                  setReach('idle')
                }}
                placeholder="https://..."
                inputMode="url"
              />
              <Button type="button" variant="outline" onClick={checkReachable} disabled={reach === 'checking'} className="shrink-0">
                {reach === 'checking' ? <Loader2 className="animate-spin" /> : reach === 'ok' ? <CheckCircle2 className="text-emerald-500" /> : reach === 'fail' ? <XCircle className="text-destructive" /> : null}
                ทดสอบลิงก์
              </Button>
            </div>
            {reach === 'ok' && <p className="text-xs text-emerald-600">เซิร์ฟเวอร์ตอบกลับ ลิงก์น่าจะเปิดได้{reachDetail && ` (${reachDetail})`}</p>}
            {reach === 'fail' && <p className="text-xs text-destructive">{reachDetail || 'เชื่อมต่อไม่ได้ อาจเป็นเว็บภายในที่ต้องใช้ VPN หรือ URL ไม่ถูกต้อง'}</p>}
          </Field>

          <Field label="คำอธิบาย" htmlFor="lf-desc">
            <Textarea id="lf-desc" value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
          </Field>

          <Field label="วิธีใช้งาน / ข้อมูลเพิ่มเติม" htmlFor="lf-guide" hint="แสดงใน Popup รายละเอียด (ห้ามใส่รหัสผ่าน)">
            <Textarea id="lf-guide" value={form.usage_guide} onChange={(e) => set('usage_guide', e.target.value)} rows={3} />
          </Field>

          <div className="space-y-1.5">
            <Label>ไอคอน / โลโก้</Label>
            <div className="flex flex-wrap items-center gap-3">
              <LinkIcon title={form.title || '?'} url={form.url || 'https://x'} iconUrl={form.icon_url || null} key={form.icon_url} />
              <Input value={form.icon_url} onChange={(e) => set('icon_url', e.target.value)} placeholder="URL รูปไอคอน (ไม่บังคับ)" className="min-w-[12rem] flex-1" />
              <Button type="button" variant="outline" size="sm" disabled={!validateUrl(form.url).ok} onClick={() => set('icon_url', faviconFor(validateUrl(form.url).ok ? form.url : ''))}>
                <Wand2 /> favicon อัตโนมัติ
              </Button>
              <label className={cn('inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-medium hover:bg-accent', uploading && 'opacity-50')}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />} อัปโหลด
                <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && uploadIcon(e.target.files[0])} />
              </label>
            </div>
            {errors.icon_url && <p className="text-xs text-destructive">{errors.icon_url}</p>}
          </div>

          {/* Access */}
          <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
            <Label>สิทธิ์การเข้าถึง</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { v: 'global', icon: Globe, t: 'ลิงก์ส่วนกลาง', d: 'พนักงานทุกคนมองเห็น' },
                { v: 'restricted', icon: Lock, t: 'กำหนดสิทธิ์', d: 'ตามตำแหน่ง และ/หรือ เฉพาะบุคคล' },
              ] as const).map(({ v, icon: Icon, t, d }) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => set('access', v)}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border bg-card p-3 text-left transition',
                    form.access === v ? 'border-teal ring-2 ring-teal/30' : 'hover:border-teal/40',
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 text-teal" />
                  <span>
                    <span className="block text-sm font-medium">{t}</span>
                    <span className="block text-xs text-muted-foreground">{d}</span>
                  </span>
                </button>
              ))}
            </div>

            {form.access === 'restricted' && (
              <div className="grid gap-4 pt-1 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">ตำแหน่งที่เข้าถึงได้</p>
                  <div className="space-y-1.5">
                    {roles.map((r) => (
                      <label key={r.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent">
                        <Checkbox
                          checked={form.role_ids.includes(r.id)}
                          onCheckedChange={(c) => set('role_ids', c ? [...form.role_ids, r.id] : form.role_ids.filter((x) => x !== r.id))}
                        />
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                        <span className="text-sm">{r.name}</span>
                        {!r.is_active && <span className="text-xs text-muted-foreground">(ปิดใช้งาน)</span>}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    มอบให้พนักงานเฉพาะราย {form.user_ids.length > 0 && `(${form.user_ids.length} คน)`}
                  </p>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="ค้นหาพนักงาน" className="h-8 pl-8 text-xs" />
                  </div>
                  <div className="max-h-40 space-y-0.5 overflow-y-auto scrollbar-thin">
                    {filteredProfiles.map((p) => (
                      <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent">
                        <Checkbox
                          checked={form.user_ids.includes(p.id)}
                          onCheckedChange={(c) => set('user_ids', c ? [...form.user_ids, p.id] : form.user_ids.filter((x) => x !== p.id))}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{p.full_name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{p.email}</span>
                        </span>
                      </label>
                    ))}
                    {!filteredProfiles.length && <p className="px-2 py-2 text-xs text-muted-foreground">ไม่พบพนักงาน</p>}
                  </div>
                </div>
                {errors.role_ids && <p className="text-xs text-destructive md:col-span-2">{errors.role_ids}</p>}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="คำสำคัญ (Tags)" hint="กด Enter เพื่อเพิ่ม">
              <TagInput value={form.tags} onChange={(t) => set('tags', t)} />
            </Field>
            <Field label="กลุ่มลิงก์ที่เกี่ยวข้อง" htmlFor="lf-group" hint="เช่น ระบบบัญชี, โซเชียลมีเดีย">
              <Input id="lf-group" list="lf-groups" value={form.group_name} onChange={(e) => set('group_name', e.target.value)} />
              <datalist id="lf-groups">
                {groupSuggestions.map((g) => <option key={g} value={g} />)}
              </datalist>
            </Field>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2.5 text-sm">
              <Switch checked={form.is_featured} onCheckedChange={(v) => set('is_featured', v)} /> ลิงก์แนะนำ
            </label>
            <label className="flex items-center gap-2.5 text-sm">
              <Switch checked={form.is_active} onCheckedChange={(v) => set('is_active', v)} /> เปิดใช้งาน
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" loading={saving}>{link ? 'บันทึก' : 'เพิ่มลิงก์'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
