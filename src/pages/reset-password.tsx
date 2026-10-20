import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthShell } from './auth-shell'

export function passwordProblem(pw: string, confirm: string) {
  if (pw.length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข'
  if (pw !== confirm) return 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'
  return null
}

/** ใช้ทั้งกรณีรีเซ็ตรหัสผ่าน และกรณีพนักงานใหม่ตั้งรหัสผ่านครั้งแรกจากอีเมลเชิญ */
export default function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const problem = passwordProblem(pw, confirm)
    setError(problem)
    if (problem) return
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    supabase.rpc('record_login').then(() => undefined)
    toast.success('ตั้งรหัสผ่านเรียบร้อยแล้ว')
    navigate('/', { replace: true })
  }

  return (
    <AuthShell title="ตั้งรหัสผ่านใหม่" subtitle="รหัสผ่านอย่างน้อย 8 ตัวอักษร มีทั้งตัวอักษรและตัวเลข">
      {loading ? (
        <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-11" /></div>
      ) : !session ? (
        <div className="space-y-3 rounded-2xl border bg-card p-6 text-sm">
          <p className="font-medium">ลิงก์หมดอายุหรือไม่ถูกต้อง</p>
          <p className="text-muted-foreground">กรุณาขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้ง</p>
          <Link to="/forgot-password" className="font-medium text-teal hover:underline">ขอลิงก์ใหม่</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">บัญชี: <span className="font-medium text-foreground">{session.user.email}</span></p>
          <Field label="รหัสผ่านใหม่" htmlFor="pw">
            <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required autoFocus />
          </Field>
          <Field label="ยืนยันรหัสผ่าน" htmlFor="pw2">
            <Input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={saving}>บันทึกรหัสผ่าน</Button>
        </form>
      )}
    </AuthShell>
  )
}
