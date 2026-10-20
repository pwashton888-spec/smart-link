import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Profile, Role } from '@/lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  /** ตำแหน่งงานที่ใช้งานอยู่ทั้งหมดของผู้ใช้ */
  roles: Role[]
  isAdmin: boolean
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function loadProfile(userId: string) {
  const [{ data: profile, error }, { data: roleRows }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('user_roles').select('role:roles(*)').eq('user_id', userId),
  ])
  if (error) throw error
  const roles = ((roleRows ?? []) as unknown as { role: Role | null }[])
    .map((r) => r.role)
    .filter((r): r is Role => !!r && r.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
  return { profile: profile as Profile | null, roles }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef<string | null>(null)

  const hydrate = useCallback(async (s: Session | null) => {
    if (s && s.user.id !== userIdRef.current) setLoading(true)
    setSession(s)
    userIdRef.current = s?.user.id ?? null
    if (!s) {
      setProfile(null)
      setRoles([])
      setLoading(false)
      return
    }
    try {
      const result = await loadProfile(s.user.id)
      if (!result.profile || !result.profile.is_active) {
        toast.error('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ')
        await supabase.auth.signOut()
        return
      }
      setProfile(result.profile)
      setRoles(result.roles)
    } catch (e) {
      console.error(e)
      toast.error('โหลดข้อมูลบัญชีไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => hydrate(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'TOKEN_REFRESHED') {
        setSession(s)
        return
      }
      if (event === 'SIGNED_OUT') queryClient.clear()
      if (event === 'PASSWORD_RECOVERY' && !window.location.pathname.startsWith('/reset-password')) {
        window.location.replace('/reset-password')
      }
      // เรียกนอก callback เพื่อไม่ให้ supabase-js deadlock
      setTimeout(() => hydrate(s), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [hydrate, queryClient])

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    await hydrate(data.session)
  }, [hydrate])

  // เมื่อผู้ดูแลเปลี่ยนตำแหน่ง/สิทธิ์/สถานะบัญชี ให้ตรวจสิทธิ์ใหม่และโหลดข้อมูลทันที
  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    const onChange = () => {
      refresh()
      queryClient.invalidateQueries()
    }
    const channel = supabase
      .channel(`perm-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${userId}` }, onChange)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'link_user_permissions', filter: `user_id=eq.${userId}` }, () =>
        queryClient.invalidateQueries({ queryKey: ['links'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'links' }, () =>
        queryClient.invalidateQueries({ queryKey: ['links'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'link_roles' }, () =>
        queryClient.invalidateQueries({ queryKey: ['links'] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, refresh, queryClient])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      roles,
      isAdmin: !!profile?.is_admin && !!profile.is_active,
      loading,
      refresh,
      signOut,
    }),
    [session, profile, roles, loading, refresh, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
