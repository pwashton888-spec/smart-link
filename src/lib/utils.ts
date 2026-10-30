import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** ตรวจ URL ก่อนบันทึกและก่อนเปิด : อนุญาตเฉพาะ http/https ที่มีโดเมนจริง */
export function validateUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const value = raw.trim()
  if (!value) return { ok: false, error: 'กรุณากรอก URL' }
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    return { ok: false, error: 'รูปแบบ URL ไม่ถูกต้อง' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'อนุญาตเฉพาะลิงก์ที่ขึ้นต้นด้วย http:// หรือ https://' }
  }
  if (!parsed.hostname || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
    return { ok: false, error: 'ไม่พบชื่อโดเมนใน URL' }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'ห้ามใส่ชื่อผู้ใช้หรือรหัสผ่านไว้ใน URL' }
  }
  if (withScheme.length > 2048) return { ok: false, error: 'URL ยาวเกินไป' }
  return { ok: true, url: parsed.toString() }
}

/** ระบบ Auth ต้องใช้อีเมล : บัญชีแบบชื่อผู้ใช้เก็บเป็น <ชื่อผู้ใช้>@smartlink.local (ต้องตรงกับ Edge Function admin-users) */
export const USERNAME_DOMAIN = 'smartlink.local'

/** ช่องเข้าสู่ระบบรับได้ทั้งอีเมลและชื่อผู้ใช้ */
export function toLoginEmail(value: string) {
  const v = value.trim().toLowerCase()
  return v.includes('@') ? v : `${v}@${USERNAME_DOMAIN}`
}

/** ชื่อที่ใช้เข้าสู่ระบบ สำหรับแสดงผล */
export function loginName(p: { username: string | null; email: string }) {
  return p.username ?? p.email
}

/** รหัสผ่านชั่วคราว 10 ตัว มีทั้งตัวอักษรและตัวเลข (ตัดตัวที่สับสนง่าย เช่น 0/O, 1/l) */
export function randomPassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const all = letters + digits
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length]
  const chars = [pick(letters), pick(digits), ...Array.from({ length: 8 }, () => pick(all))]
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function faviconFor(url: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostnameOf(url))}&sz=128`
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts
    .slice(0, 2)
    .map((p) => Array.from(p)[0])
    .join('')
    .toUpperCase()
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function relativeTime(value: string | null | undefined) {
  if (!value) return ''
  const diff = (Date.now() - new Date(value).getTime()) / 1000
  const rtf = new Intl.RelativeTimeFormat('th', { numeric: 'auto' })
  if (diff < 60) return 'เมื่อสักครู่'
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute')
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour')
  return rtf.format(-Math.round(diff / 86400), 'day')
}

export function errorMessage(error: unknown): string {
  if (!error) return 'เกิดข้อผิดพลาด'
  if (typeof error === 'string') return error
  const e = error as { message?: string; code?: string }
  if (e.code === '42501') return 'คุณไม่มีสิทธิ์ทำรายการนี้'
  if (e.code === '23505') return 'มีข้อมูลนี้อยู่แล้ว'
  if (e.code === '23514') return 'ข้อมูลไม่ผ่านการตรวจสอบ (เช่น URL ไม่ถูกต้อง)'
  if (e.message === 'Failed to fetch') return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต'
  return e.message ?? 'เกิดข้อผิดพลาด'
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
