import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/auth'
import { errorMessage, validateUrl } from '@/lib/utils'
import type { AccessibleLink, Category, Favorite, LinkRow, Preference, Role } from '@/lib/types'

const LINK_SELECT = '*, link_roles(role_id), link_user_permissions(user_id)'

export function useRoles() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['roles'],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.from('roles').select('*').order('sort_order').order('name')
      if (error) throw error
      return data as Role[]
    },
  })
}

export function useCategories() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['categories'],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order').order('name')
      if (error) throw error
      return data as Category[]
    },
  })
}

/** ลิงก์ทั้งหมดที่ RLS อนุญาตให้อ่าน (ผู้ดูแลจะได้ลิงก์ขององค์กรทั้งหมด) */
export function useRawLinks() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['links'],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links')
        .select(LINK_SELECT)
        .order('sort_order')
        .order('title')
      if (error) throw error
      return data as LinkRow[]
    },
  })
}

function useFavorites() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['favorites'],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.from('favorites').select('link_id, sort_order').order('sort_order')
      if (error) throw error
      return data as Favorite[]
    },
  })
}

function usePreferences() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['prefs'],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personal_link_preferences')
        .select('link_id, is_hidden, last_opened_at, open_count')
      if (error) throw error
      return data as Preference[]
    },
  })
}

/**
 * รวมสิทธิ์จากทุกตำแหน่งของผู้ใช้ + สิทธิ์เฉพาะบุคคล + ลิงก์ส่วนกลาง + ลิงก์ส่วนตัว
 * โดยไม่ซ้ำกัน (RLS เป็นตัวบังคับสิทธิ์จริง ส่วนนี้ใช้จัดกลุ่มการแสดงผล
 * และกันไม่ให้ผู้ดูแลเห็นลิงก์ที่ตนเองไม่ได้รับสิทธิ์บน Dashboard ส่วนตัว)
 */
export function useMyLinks() {
  const { session, roles: myRoles } = useAuth()
  const links = useRawLinks()
  const roles = useRoles()
  const categories = useCategories()
  const favorites = useFavorites()
  const prefs = usePreferences()
  const me = session?.user.id

  const data = useMemo<AccessibleLink[] | undefined>(() => {
    if (!links.data || !roles.data || !categories.data || !favorites.data || !prefs.data) return undefined
    const roleById = new Map(roles.data.map((r) => [r.id, r]))
    const catById = new Map(categories.data.map((c) => [c.id, c]))
    const myRoleIds = new Set(myRoles.map((r) => r.id))
    const favById = new Map(favorites.data.map((f) => [f.link_id, f]))
    const prefById = new Map(prefs.data.map((p) => [p.link_id, p]))

    const result: AccessibleLink[] = []
    for (const l of links.data) {
      const linkRoles = l.link_roles.map((lr) => roleById.get(lr.role_id)).filter((r): r is Role => !!r)
      const matchedRoles = linkRoles.filter((r) => myRoleIds.has(r.id) && r.is_active)
      const grantedToMe = l.link_user_permissions.some((p) => p.user_id === me)
      const accessible =
        (l.visibility === 'personal' && l.owner_id === me) ||
        (l.is_active && l.visibility === 'global') ||
        (l.is_active && l.visibility === 'restricted' && (matchedRoles.length > 0 || grantedToMe))
      if (!accessible) continue
      const pref = prefById.get(l.id)
      result.push({
        ...l,
        category: l.category_id ? catById.get(l.category_id) ?? null : null,
        roles: linkRoles,
        matchedRoles,
        grantedToMe,
        isFavorite: favById.has(l.id),
        isHidden: pref?.is_hidden ?? false,
        lastOpenedAt: pref?.last_opened_at ?? null,
        openCount: pref?.open_count ?? 0,
      })
    }
    return result
  }, [links.data, roles.data, categories.data, favorites.data, prefs.data, myRoles, me])

  const favoriteOrder = useMemo(() => favorites.data?.map((f) => f.link_id) ?? [], [favorites.data])

  return {
    data,
    favoriteOrder,
    roles: roles.data ?? [],
    categories: categories.data ?? [],
    isLoading: links.isLoading || roles.isLoading || categories.isLoading || favorites.isLoading || prefs.isLoading,
    error: links.error ?? roles.error ?? categories.error ?? favorites.error ?? prefs.error,
    refetch: () => {
      links.refetch()
      favorites.refetch()
      prefs.refetch()
    },
  }
}

/** เปิดลิงก์ในแท็บใหม่ทันที แล้วค่อยบันทึกประวัติเบื้องหลัง (ไม่ทำให้การเปิดช้า) */
export function useOpenLink() {
  const queryClient = useQueryClient()
  return (link: Pick<AccessibleLink, 'id' | 'url'>) => {
    const checked = validateUrl(link.url)
    if (!checked.ok) {
      toast.error(`ไม่สามารถเปิดลิงก์ได้: ${checked.error}`)
      return
    }
    // ใช้ noopener เสมอ เพื่อไม่ให้เว็บภายนอกเข้าถึงหน้าต่างของระบบได้
    window.open(checked.url, '_blank', 'noopener,noreferrer')
    supabase
      .rpc('record_link_open', { p_link_id: link.id })
      .then(({ error }) => {
        if (!error) queryClient.invalidateQueries({ queryKey: ['prefs'] })
      })
  }
}

export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async ({ linkId, favorite }: { linkId: string; favorite: boolean }) => {
      if (favorite) {
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: session!.user.id, link_id: linkId, sort_order: Date.now() % 1_000_000_000 })
        if (error && error.code !== '23505') throw error
      } else {
        const { error } = await supabase.from('favorites').delete().eq('link_id', linkId).eq('user_id', session!.user.id)
        if (error) throw error
      }
    },
    onMutate: async ({ linkId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] })
      const prev = queryClient.getQueryData<Favorite[]>(['favorites'])
      queryClient.setQueryData<Favorite[]>(['favorites'], (old = []) =>
        favorite ? [...old, { link_id: linkId, sort_order: Number.MAX_SAFE_INTEGER }] : old.filter((f) => f.link_id !== linkId),
      )
      return { prev }
    },
    onError: (e, _v, ctx) => {
      queryClient.setQueryData(['favorites'], ctx?.prev)
      toast.error(errorMessage(e))
    },
    onSuccess: (_d, { favorite }) => toast.success(favorite ? 'ปักหมุดเป็นรายการโปรดแล้ว' : 'นำออกจากรายการโปรดแล้ว'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  })
}

export function useReorderFavorites() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('reorder_favorites', { p_link_ids: ids })
      if (error) throw error
    },
    onMutate: (ids) => {
      queryClient.setQueryData<Favorite[]>(['favorites'], ids.map((link_id, i) => ({ link_id, sort_order: i + 1 })))
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  })
}

export function useSetHidden() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async ({ linkId, hidden }: { linkId: string; hidden: boolean }) => {
      const { error } = await supabase
        .from('personal_link_preferences')
        .upsert({ user_id: session!.user.id, link_id: linkId, is_hidden: hidden }, { onConflict: 'user_id,link_id' })
      if (error) throw error
    },
    onSuccess: (_d, { hidden }) =>
      toast.success(hidden ? 'ซ่อนลิงก์จาก Dashboard แล้ว (ดูได้ที่ พื้นที่ส่วนตัว)' : 'แสดงลิงก์อีกครั้งแล้ว'),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['prefs'] }),
  })
}

export interface PersonalLinkInput {
  id?: string
  title: string
  url: string
  description: string
  tags: string[]
}

export function useSavePersonalLink() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const { data: categories } = useCategories()
  return useMutation({
    mutationFn: async (input: PersonalLinkInput) => {
      const checked = validateUrl(input.url)
      if (!checked.ok) throw new Error(checked.error)
      const personalCategory = categories?.find((c) => c.slug === 'personal')
      const row = {
        title: input.title.trim(),
        url: checked.url,
        description: input.description.trim() || null,
        tags: input.tags,
      }
      if (input.id) {
        const { error } = await supabase.from('links').update(row).eq('id', input.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('links').insert({
          ...row,
          visibility: 'personal',
          owner_id: session!.user.id,
          category_id: personalCategory?.id ?? null,
          sort_order: Math.floor(Date.now() / 1000),
        })
        if (error) throw error
      }
    },
    onSuccess: (_d, input) => toast.success(input.id ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มลิงก์ส่วนตัวแล้ว'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['links'] }),
  })
}

export function useDeletePersonalLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('links').delete().eq('id', id).eq('visibility', 'personal')
      if (error) throw error
    },
    onSuccess: () => toast.success('ลบลิงก์ส่วนตัวแล้ว'),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['links'] }),
  })
}

export function useReorderPersonalLinks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('reorder_personal_links', { p_link_ids: ids })
      if (error) throw error
    },
    onMutate: (ids) => {
      queryClient.setQueryData<LinkRow[]>(['links'], (old) =>
        old?.map((l) => {
          const idx = ids.indexOf(l.id)
          return idx >= 0 ? { ...l, sort_order: idx + 1 } : l
        }),
      )
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['links'] }),
  })
}

/** ค้นหาจาก ชื่อ คำอธิบาย หมวดหมู่ แท็ก ตำแหน่ง และโดเมน */
export function searchLinks(links: AccessibleLink[], query: string) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (!terms.length) return links
  const scored = links
    .map((l) => {
      const fields = {
        title: l.title.toLowerCase(),
        desc: (l.description ?? '').toLowerCase(),
        category: (l.category?.name ?? '').toLowerCase(),
        tags: l.tags.join(' ').toLowerCase(),
        roles: l.roles.map((r) => r.name).join(' ').toLowerCase(),
        url: l.url.toLowerCase(),
        group: (l.group_name ?? '').toLowerCase(),
      }
      let score = 0
      for (const t of terms) {
        let hit = 0
        if (fields.title.startsWith(t)) hit = 10
        else if (fields.title.includes(t)) hit = 7
        else if (fields.tags.includes(t)) hit = 5
        else if (fields.category.includes(t) || fields.roles.includes(t) || fields.group.includes(t)) hit = 4
        else if (fields.desc.includes(t)) hit = 3
        else if (fields.url.includes(t)) hit = 2
        if (!hit) return null
        score += hit
      }
      return { l, score: score + (l.isFavorite ? 1 : 0) }
    })
    .filter((x): x is { l: AccessibleLink; score: number } => !!x)
  return scored.sort((a, b) => b.score - a.score).map((x) => x.l)
}
