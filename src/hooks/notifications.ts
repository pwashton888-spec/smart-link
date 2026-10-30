import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/auth'
import { errorMessage } from '@/lib/utils'
import type { AppNotification } from '@/lib/types'

const KEY = ['notifications']

/** การแจ้งเตือนล่าสุดของผู้ใช้ + รับรายการใหม่ทันทีผ่าน Realtime */
export function useNotifications() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user.id

  const query = useQuery({
    queryKey: KEY,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as AppNotification[]
    },
  })

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as AppNotification
          toast(n.title, { description: n.body ?? undefined })
          queryClient.invalidateQueries({ queryKey: KEY })
          if (n.kind === 'link_broken') queryClient.invalidateQueries({ queryKey: ['admin', 'link-checks'] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, queryClient])

  return query
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient()
  return async (ids?: number[]) => {
    queryClient.setQueryData<AppNotification[]>(KEY, (old) =>
      old?.map((n) => (!ids || ids.includes(n.id) ? { ...n, is_read: true } : n)),
    )
    const { error } = await supabase.rpc('mark_notifications_read', { p_ids: ids ?? null })
    if (error) toast.error(errorMessage(error))
    queryClient.invalidateQueries({ queryKey: KEY })
  }
}

export function useClearNotifications() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  return async () => {
    queryClient.setQueryData<AppNotification[]>(KEY, [])
    const { error } = await supabase.from('notifications').delete().eq('user_id', session?.user.id ?? '')
    if (error) toast.error(errorMessage(error))
    queryClient.invalidateQueries({ queryKey: KEY })
  }
}
