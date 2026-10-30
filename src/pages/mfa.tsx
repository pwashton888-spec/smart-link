import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/providers/auth'
import { loginName } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { TotpChallenge, TotpEnroll } from '@/components/totp'
import { AuthShell } from './auth-shell'

/** ยืนยันตัวตน 2 ชั้น : กรอกรหัส 6 หลัก หรือบังคับตั้งค่าครั้งแรก (ตามนโยบาย) */
export default function MfaPage() {
  const { session, profile, mfa, loading, refresh, signOut } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return (
      <AuthShell title="ยืนยันตัวตน 2 ชั้น">
        <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-11" /></div>
      </AuthShell>
    )
  }
  if (!session || !profile) return <Navigate to="/login" replace />

  const done = async () => {
    await refresh()
    navigate('/', { replace: true })
  }

  const signOutButton = (
    <button type="button" onClick={() => signOut()} className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground">
      ออกจากระบบ
    </button>
  )

  if (mfa.needsChallenge) {
    return (
      <AuthShell title="ยืนยันตัวตน 2 ชั้น" subtitle={`เปิดแอป Authenticator แล้วกรอกรหัส 6 หลักของบัญชี ${loginName(profile)}`}>
        <TotpChallenge onDone={done} />
        {signOutButton}
      </AuthShell>
    )
  }

  if (mfa.required && !mfa.enrolled && !profile.must_change_password) {
    return (
      <AuthShell title="ตั้งค่ายืนยันตัวตน 2 ชั้น" subtitle="บัญชีนี้ต้องเปิด 2FA ก่อนใช้งาน เพื่อป้องกันกรณีรหัสผ่านหลุด">
        <TotpEnroll onDone={done} />
        {signOutButton}
      </AuthShell>
    )
  }

  return <Navigate to="/" replace />
}
