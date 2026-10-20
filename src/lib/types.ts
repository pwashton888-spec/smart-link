export type LinkVisibility = 'global' | 'restricted' | 'personal'

export interface Profile {
  id: string
  email: string
  full_name: string
  job_title: string | null
  avatar_url: string | null
  is_active: boolean
  is_admin: boolean
  last_sign_in_at: string | null
  created_at: string
  updated_at: string
}

export interface Role {
  id: string
  code: string
  name: string
  description: string | null
  color: string
  sort_order: number
  is_active: boolean
}

export interface Category {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string
  color: string
  role_id: string | null
  sort_order: number
  is_system: boolean
  is_active: boolean
}

export interface LinkRow {
  id: string
  title: string
  url: string
  description: string | null
  usage_guide: string | null
  icon_url: string | null
  category_id: string | null
  visibility: LinkVisibility
  owner_id: string | null
  tags: string[]
  group_name: string | null
  is_featured: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  link_roles: { role_id: string }[]
  link_user_permissions: { user_id: string }[]
}

/** ลิงก์ที่ผ่านการรวมสิทธิ์แล้ว พร้อมข้อมูลส่วนตัวของผู้ใช้ */
export interface AccessibleLink extends LinkRow {
  category: Category | null
  roles: Role[]
  /** ตำแหน่งของผู้ใช้ที่ทำให้เห็นลิงก์นี้ */
  matchedRoles: Role[]
  grantedToMe: boolean
  isFavorite: boolean
  isHidden: boolean
  lastOpenedAt: string | null
  openCount: number
}

export interface Favorite {
  link_id: string
  sort_order: number
}

export interface Preference {
  link_id: string
  is_hidden: boolean
  last_opened_at: string | null
  open_count: number
}

export interface ActivityLog {
  id: number
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
  actor?: { full_name: string; email: string } | null
}
