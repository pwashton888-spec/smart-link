import { useState } from 'react'
import { cn, hostnameOf } from '@/lib/utils'

const PALETTE = ['#0f2a5c', '#14a3a0', '#2563eb', '#7c3aed', '#059669', '#e11d48', '#0891b2', '#d97706']

function colorFor(text: string) {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/** โลโก้เว็บไซต์ : ใช้ไอคอนที่ผู้ดูแลกำหนด ถ้าไม่มี/โหลดไม่ได้ จะแสดงตัวอักษรแทน */
export function LinkIcon({
  title,
  url,
  iconUrl,
  size = 'md',
  className,
}: {
  title: string
  url: string
  iconUrl: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const box = { sm: 'h-9 w-9 rounded-lg text-sm', md: 'h-11 w-11 rounded-xl text-base', lg: 'h-16 w-16 rounded-2xl text-2xl' }[size]
  const letter = Array.from(title.trim() || hostnameOf(url))[0]?.toUpperCase() ?? '?'
  const color = colorFor(hostnameOf(url))

  if (iconUrl && !failed) {
    return (
      <div className={cn('flex shrink-0 items-center justify-center border bg-white p-1.5 shadow-sm dark:bg-white/95', box, className)}>
        <img
          src={iconUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      </div>
    )
  }
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center font-semibold text-white shadow-sm', box, className)}
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
      aria-hidden
    >
      {letter}
    </div>
  )
}
