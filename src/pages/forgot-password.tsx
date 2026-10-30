import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { AuthShell } from './auth-shell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) {
      setError('บัญชีแบบชื่อผู้ใช้ไม่มีอีเมล กรุณาติดต่อผู้ดูแลระบบเพื่อขอรหัสผ่านชั่วคราวใหม่')
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    // ไม่บอกว่ามีอีเมลนี้ในระบบหรือไม่ เพื่อความปลอดภัย
    if (error && !/not found/i.test(error.message)) setError(error.message)
    else setSent(true)
  }

  return (
    <AuthShell title="ลืมรหัสผ่าน" subtitle="กรอกอีเมลของคุณ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ (บัญชีแบบชื่อผู้ใช้ ให้ติดต่อผู้ดูแลระบบ)">
      {sent ? (
        <div className="space-y-4 rounded-2xl border bg-card p-6 text-center">
          <MailCheck className="mx-auto h-10 w-10 text-teal" />
          <p className="font-medium">ตรวจสอบอีเมลของคุณ</p>
          <p className="text-sm text-muted-foreground">หากอีเมลนี้มีบัญชีอยู่ในระบบ คุณจะได้รับลิงก์ตั้งรหัสผ่านใหม่ภายในไม่กี่นาที</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="อีเมล" htmlFor="email">
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>ส่งลิงก์ตั้งรหัสผ่านใหม่</Button>
        </form>
      )}
      <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> กลับไปหน้าเข้าสู่ระบบ
      </Link>
    </AuthShell>
  )
}
