import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

function codeError(error: unknown) {
  const msg = errorMessage(error)
  return /invalid|expired/i.test(msg) ? 'รหัสไม่ถูกต้องหรือหมดเวลา กรุณาใช้รหัสล่าสุดในแอป' : msg
}

/** ช่องกรอกรหัส 6 หลักจากแอป Authenticator */
export function CodeInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <Field label="รหัส 6 หลักจากแอป" htmlFor="totp">
      <Input
        id="totp"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        className="text-center text-lg tracking-[0.5em]"
        autoFocus={autoFocus}
        required
      />
    </Field>
  )
}

/** ตั้งค่า 2FA : สแกน QR ด้วยแอป Authenticator แล้วกรอกรหัสยืนยัน */
export function TotpEnroll({ onDone }: { onDone: () => void }) {
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // ล้างการตั้งค่าที่ค้างไว้ (สแกนแล้วไม่ได้ยืนยัน) ก่อนเริ่มใหม่
      const { data: list } = await supabase.auth.mfa.listFactors()
      for (const f of list?.all ?? []) {
        if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Smart Link ${crypto.randomUUID().slice(0, 8)}`,
        issuer: 'Smart Link Workspace',
      })
      if (cancelled) return
      if (error) return setError(errorMessage(error))
      setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (!factor) return
    setError(null)
    setVerifying(true)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
    setVerifying(false)
    if (error) return setError(codeError(error))
    toast.success('เปิดใช้ 2FA เรียบร้อยแล้ว')
    onDone()
  }

  async function copySecret() {
    if (!factor) return
    await navigator.clipboard.writeText(factor.secret)
    toast.success('คัดลอกรหัสตั้งค่าแล้ว')
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>ติดตั้งแอป Google Authenticator หรือ Microsoft Authenticator บนมือถือ</li>
        <li>ในแอปกด + แล้วสแกน QR ด้านล่าง</li>
        <li>กรอกรหัส 6 หลักที่แอปแสดง</li>
      </ol>
      <div className="flex justify-center">
        {factor ? (
          <img src={factor.qr} alt="QR สำหรับตั้งค่า 2FA" className="h-44 w-44 rounded-lg border bg-white p-2" />
        ) : (
          <Skeleton className="h-44 w-44" />
        )}
      </div>
      {factor && (
        <div className="rounded-lg bg-muted px-3 py-2 text-xs">
          <p className="text-muted-foreground">สแกนไม่ได้? พิมพ์รหัสนี้ในแอปแทน</p>
          <button type="button" onClick={copySecret} className="mt-1 flex items-center gap-1.5 break-all font-mono text-foreground">
            {factor.secret} <Copy className="h-3 w-3 shrink-0" />
          </button>
        </div>
      )}
      <CodeInput value={code} onChange={setCode} />
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={verifying} disabled={!factor || code.length !== 6}>
        ยืนยันและเปิดใช้ 2FA
      </Button>
    </form>
  )
}

/** กรอกรหัส 6 หลักหลังเข้าสู่ระบบด้วยรหัสผ่าน */
export function TotpChallenge({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setVerifying(true)
    const { data: list, error: lErr } = await supabase.auth.mfa.listFactors()
    const factor = list?.totp[0]
    if (lErr || !factor) {
      setVerifying(false)
      return setError(lErr ? errorMessage(lErr) : 'ไม่พบการตั้งค่า 2FA กรุณาติดต่อผู้ดูแลระบบ')
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
    setVerifying(false)
    if (error) {
      setCode('')
      return setError(codeError(error))
    }
    onDone()
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <CodeInput value={code} onChange={setCode} autoFocus />
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={verifying} disabled={code.length !== 6}>
        ยืนยัน
      </Button>
      <p className="text-center text-xs text-muted-foreground">ทำมือถือหาย? ติดต่อผู้ดูแลระบบเพื่อรีเซ็ต 2FA</p>
    </form>
  )
}
