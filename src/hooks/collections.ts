import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/auth'
import { errorMessage } from '@/lib/utils'
import type { AccessibleLink, Collection, LinkVersion } from '@/lib/types'

/** ชุดลิงก์ที่ผู้ใช้มองเห็น (RLS : ชุดขององค์กรตามตำแหน่ง + ชุดส่วนตัวของตัวเอง / ผู้ดูแลเห็นชุดขององค์กรทั้งหมด) */
export function useCollections() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['collections'],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('*, collection_items(link_id, sort_order)')
        .order('sort_order')
        .order('name')
      if (error) throw error
      return (data as Collection[]).map((c) => ({
        ...c,
        collection_items: [...c.collection_items].sort((a, b) => a.sort_order - b.sort_order),
      }))
    },
  })
}

/** ลิงก์ในชุดที่ผู้ใช้เปิดได้ ตามลำดับในชุด */
export function collectionLinks(c: Collection, linkById: Map<string, AccessibleLink>) {
  return c.collection_items.map((i) => linkById.get(i.link_id)).filter((l): l is AccessibleLink => !!l)
}

/** ชุดขององค์กรที่ตรงกับตำแหน่งของผู้ใช้ (ผู้ดูแลจัดการชุดทั้งหมดได้ที่หน้าผู้ดูแล) */
export function useMyCollections() {
  const { session, roles } = useAuth()
  const collections = useCollections()
  const myRoleIds = useMemo(() => new Set(roles.map((r) => r.id)), [roles])
  const data = useMemo(
    () =>
      (collections.data ?? []).filter(
        (c) => c.owner_id === session?.user.id || (!c.owner_id && (!c.role_ids.length || c.role_ids.some((id) => myRoleIds.has(id)))),
      ),
    [collections.data, session?.user.id, myRoleIds],
  )
  return { ...collections, data }
}

export interface CollectionInput {
  id?: string
  scope: 'org' | 'personal'
  name: string
  description: string
  icon: string
  color: string
  roleIds: string[]
  linkIds: string[]
}

export function useSaveCollection() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async (input: CollectionInput): Promise<string> => {
      const name = input.name.trim()
      if (!name) throw new Error('กรุณาตั้งชื่อชุดลิงก์')
      if (name.length > 80) throw new Error('ชื่อชุดลิงก์ยาวได้ไม่เกิน 80 ตัวอักษร')
      if (input.linkIds.length > 50) throw new Error('ชุดลิงก์หนึ่งชุดมีได้ไม่เกิน 50 ลิงก์')
      const row = {
        name,
        description: input.description.trim() || null,
        icon: input.icon,
        color: input.color,
        role_ids: input.scope === 'org' ? input.roleIds : [],
      }
      let id = input.id
      if (id) {
        const { error } = await supabase.from('collections').update(row).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('collections')
          .insert({
            ...row,
            owner_id: input.scope === 'personal' ? session!.user.id : null,
            sort_order: Math.floor(Date.now() / 1000),
          })
          .select('id')
          .single()
        if (error) throw error
        id = data.id as string
      }
      const { error } = await supabase.rpc('set_collection_items', { p_collection_id: id, p_link_ids: input.linkIds })
      if (error) throw error
      return id!
    },
    onSuccess: (_d, input) => toast.success(input.id ? 'บันทึกชุดลิงก์แล้ว' : 'สร้างชุดลิงก์แล้ว'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
  })
}

export function useDeleteCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('collections').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => toast.success('ลบชุดลิงก์แล้ว (ลิงก์ในชุดยังอยู่ครบ)'),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
  })
}

/** ประวัติเวอร์ชันของลิงก์ (ใหม่ → เก่า) */
export function useLinkVersions(linkId: string | null) {
  const { isAdmin } = useAuth()
  return useQuery({
    queryKey: ['link-versions', linkId],
    enabled: !!linkId,
    queryFn: async () => {
      // ผู้ดูแลเห็นชื่อผู้แก้ไข / พนักงานดูประวัติลิงก์ส่วนตัวของตัวเอง (ผู้แก้ไขคือตัวเอง)
      const { data, error } = await supabase
        .from('link_versions')
        .select(isAdmin ? '*, editor:profiles(full_name)' : '*')
        .eq('link_id', linkId!)
        .order('changed_at', { ascending: false })
        .order('id', { ascending: false })
      if (error) throw error
      return data as unknown as LinkVersion[]
    },
  })
}

export function useRestoreLinkVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (version: LinkVersion) => {
      const { error } = await supabase.rpc('restore_link_version', { p_version_id: version.id })
      if (error) throw error
    },
    onSuccess: () => toast.success('ย้อนกลับเป็นเวอร์ชันที่เลือกแล้ว (ค่าก่อนย้อนกลับถูกเก็บไว้ในประวัติ)'),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: (_d, _e, v) => {
      queryClient.invalidateQueries({ queryKey: ['links'] })
      queryClient.invalidateQueries({ queryKey: ['link-versions', v.link_id] })
    },
  })
}
