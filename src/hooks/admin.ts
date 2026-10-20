import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/auth'
import type { Profile } from '@/lib/types'

export interface AdminProfile extends Profile {
  user_roles: { role_id: string }[]
}

export function useAdminProfiles() {
  const { isAdmin } = useAuth()
  return useQuery({
    queryKey: ['admin', 'profiles'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*, user_roles!user_roles_user_id_fkey(role_id)').order('full_name')
      if (error) throw error
      return data as AdminProfile[]
    },
  })
}

/** เรียก Edge Function สำหรับงานที่ต้องใช้ service role (เชิญพนักงาน / ระงับบัญชี) */
export async function callAdminUsers(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    // ดึงข้อความ error จาก response ของ function ถ้ามี
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const payload = await ctx.json()
        if (payload?.error) throw new Error(payload.error)
      } catch (e) {
        if (e instanceof Error && e.message) throw e
      }
    }
    throw new Error('เรียกบริการจัดการบัญชีไม่สำเร็จ (ตรวจสอบว่า deploy Edge Function admin-users แล้ว)')
  }
  if (data?.error) throw new Error(data.error)
  return data
}
