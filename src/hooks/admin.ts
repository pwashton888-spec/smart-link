import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/auth'
import type { LinkCheck, Profile } from '@/lib/types'

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

async function invokeFunction(name: string, body: Record<string, unknown>, fallback: string) {
  const { data, error } = await supabase.functions.invoke(name, { body })
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
    throw new Error(fallback)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

/** เรียก Edge Function สำหรับงานที่ต้องใช้ service role (เชิญพนักงาน / ระงับบัญชี) */
export function callAdminUsers(body: Record<string, unknown>) {
  return invokeFunction('admin-users', body, 'เรียกบริการจัดการบัญชีไม่สำเร็จ (ตรวจสอบว่า deploy Edge Function admin-users แล้ว)')
}

export interface CheckLinksResult {
  checked: number
  broken: { id: string; title: string; url: string; detail: string }[]
}

/** ตรวจลิงก์จากฝั่งเซิร์ฟเวอร์ : ส่ง url = ทดสอบ URL เดียว / ไม่ส่ง = ตรวจทุกลิงก์และบันทึกผล */
export function callCheckLinks(body: { url: string }): Promise<{ status: 'ok' | 'broken'; detail: string }>
export function callCheckLinks(body?: { link_ids?: string[] }): Promise<CheckLinksResult>
export function callCheckLinks(body: Record<string, unknown> = {}) {
  return invokeFunction('check-links', body, 'เรียกบริการตรวจลิงก์ไม่สำเร็จ (ตรวจสอบว่า deploy Edge Function check-links แล้ว)')
}

export function useLinkChecks() {
  const { isAdmin } = useAuth()
  return useQuery({
    queryKey: ['admin', 'link-checks'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from('link_checks').select('*')
      if (error) throw error
      return new Map((data as LinkCheck[]).map((c) => [c.link_id, c]))
    },
  })
}
