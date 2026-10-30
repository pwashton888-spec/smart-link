import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/auth'
import { errorMessage, loginName } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthShell } from './auth-shell'
import { passwordProblem } from './reset-password'

/** บังคับตั้งรหัสผ่านใหม่หลังเข้าสู่ระบบด้วยรหัสผ่านชั่วคราวที่ผู้ดูแลกำหนด */
export default function ChangePasswordPage() {
  const { session, profile, loading, refresh, signOut } = useAuth()
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) {
    return (
      <AuthShell title="ตั้งรหัสผ่านใหม่">
        <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-11" /></div>
      </AuthShell>
    )
  }
  if (!session || !profile) return <Navigate to="/login" replace />
  if (!profile.must_change_password) return <Navigate to="/" replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const problem = passwordProblem(pw, confirm)
    setError(problem)
    if (problem) return
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) {
      setSaving(false)
      setError(/different/i.test(error.message) ? 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านชั่วคราว' : errorMessage(error))
      return
    }
    const { error: rpcError } = await supabase.rpc('clear_must_change_password')
    if (rpcError) {
      setSaving(false)
      setError(errorMessage(rpcError))
      return
    }
    await refresh()
    setSaving(false)
    toast.success('ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว')
    navigate('/', { replace: true })
  }

  return (
    <AuthShell title="ตั้งรหัสผ่านใหม่" subtitle="คุณเข้าสู่ระบบด้วยรหัสผ่านชั่วคราว กรุณาตั้งรหัสผ่านของคุณเองก่อนใช้งาน">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">บัญชี: <span className="font-medium text-foreground">{loginName(profile)}</span></p>
        <Field label="รหัสผ่านใหม่" htmlFor="pw" hint="อย่างน้อย 8 ตัวอักษร มีทั้งตัวอักษรและตัวเลข">
          <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required autoFocus />
        </Field>
        <Field label="ยืนยันรหัสผ่าน" htmlFor="pw2">
          <Input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={saving}>บันทึกรหัสผ่าน</Button>
        <button type="button" onClick={() => signOut()} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
          ออกจากระบบ
        </button>
      </form>
    </AuthShell>
  )
}
