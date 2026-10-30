import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toLoginEmail } from '@/lib/utils'
import { useAuth } from '@/providers/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { AuthShell } from './auth-shell'

export default function LoginPage() {
  const { session, profile } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session && profile) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: toLoginEmail(email), password })
    if (error) {
      setLoading(false)
      if (/banned/i.test(error.message)) setError('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ')
      else if (/invalid/i.test(error.message)) setError('ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง')
      else if (/confirm/i.test(error.message)) setError('บัญชียังไม่ได้ยืนยันอีเมล กรุณาตรวจสอบอีเมลเชิญ')
      else setError(error.message)
      return
    }
    supabase.rpc('record_login').then(() => undefined)
    setLoading(false)
  }

  return (
    <AuthShell title="เข้าสู่ระบบ" subtitle="ใช้ชื่อผู้ใช้ (หรืออีเมล) และรหัสผ่านที่ได้รับจากผู้ดูแลระบบ">
      <form onSubmit={submit} className="space-y-4">
        <Field label="ชื่อผู้ใช้หรืออีเมล" htmlFor="email">
          <Input id="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="somsri หรือ name@company.com" required autoFocus />
        </Field>
        <Field label="รหัสผ่าน" htmlFor="password">
          <div className="relative">
            <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground" aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>เข้าสู่ระบบ</Button>
        <div className="flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="font-medium text-teal hover:underline">ลืมรหัสผ่าน?</Link>
          <span className="text-muted-foreground">ยังไม่มีบัญชี? ติดต่อผู้ดูแลระบบ</span>
        </div>
      </form>
    </AuthShell>
  )
}
