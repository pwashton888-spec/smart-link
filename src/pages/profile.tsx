import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, UserRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/auth'
import { errorMessage, formatDateTime, initials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, RoleBadge } from '@/components/ui/badge'
import { passwordProblem } from './reset-password'

export default function ProfilePage() {
  const { profile, roles, refresh } = useAuth()
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSaving, setPwSaving] = useState(false)

  useEffect(() => {
    setName(profile?.full_name ?? '')
    setJobTitle(profile?.job_title ?? '')
  }, [profile])

  if (!profile) return null

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.rpc('update_my_profile', { p_full_name: name, p_job_title: jobTitle })
    setSaving(false)
    if (error) return toast.error(errorMessage(error))
    toast.success('บันทึกข้อมูลแล้ว')
    refresh()
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    const problem = passwordProblem(pw, pw2)
    setPwError(problem)
    if (problem) return
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setPwSaving(false)
    if (error) return setPwError(errorMessage(error))
    setPw('')
    setPw2('')
    toast.success('เปลี่ยนรหัสผ่านแล้ว')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal text-xl font-semibold text-teal-foreground shadow-soft">
          {initials(profile.full_name || profile.email)}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{profile.full_name}</h1>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ตำแหน่งงานและสิทธิ์</CardTitle>
          <CardDescription>กำหนดโดยผู้ดูแลระบบ หากไม่ถูกต้องกรุณาติดต่อผู้ดูแล</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {roles.length ? roles.map((r) => <RoleBadge key={r.id} name={r.name} color={r.color} />) : <span className="text-sm text-muted-foreground">ยังไม่ได้รับตำแหน่ง</span>}
            {profile.is_admin && <Badge variant="warning">ผู้ดูแลระบบ</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">เข้าสู่ระบบล่าสุด: {formatDateTime(profile.last_sign_in_at)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserRound className="h-4 w-4" /> ข้อมูลส่วนตัว</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
            <Field label="ชื่อ-นามสกุล" htmlFor="name">
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="ชื่อตำแหน่งที่แสดง (ไม่บังคับ)" htmlFor="job">
              <Input id="job" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="เช่น ผู้จัดการฝ่าย" />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" loading={saving}>บันทึก</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card id="password">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> เปลี่ยนรหัสผ่าน</CardTitle>
          <CardDescription>อย่างน้อย 8 ตัวอักษร มีทั้งตัวอักษรและตัวเลข</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="grid gap-4 sm:grid-cols-2">
            <Field label="รหัสผ่านใหม่" htmlFor="pw">
              <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </Field>
            <Field label="ยืนยันรหัสผ่าน" htmlFor="pw2">
              <Input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </Field>
            {pwError && <p className="text-sm text-destructive sm:col-span-2">{pwError}</p>}
            <div className="sm:col-span-2">
              <Button type="submit" variant="outline" loading={pwSaving}>เปลี่ยนรหัสผ่าน</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
