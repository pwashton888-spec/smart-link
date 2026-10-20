import { LayoutGrid, List } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ViewMode } from './link-card'

// eslint-disable-next-line react-refresh/only-export-components
export function useViewMode(): [ViewMode, (v: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem('slw-view') === 'list' ? 'list' : 'grid'
    } catch {
      return 'grid'
    }
  })
  return [
    view,
    (v) => {
      setView(v)
      try {
        localStorage.setItem('slw-view', v)
      } catch {
        /* ignore */
      }
    },
  ]
}

export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-lg border bg-card/70 p-0.5" role="group" aria-label="รูปแบบการแสดงผล">
      {(['grid', 'list'] as const).map((v) => {
        const Icon = v === 'grid' ? LayoutGrid : List
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition',
              value === v && 'bg-primary text-primary-foreground shadow-sm',
            )}
            aria-pressed={value === v}
            title={v === 'grid' ? 'มุมมองตาราง' : 'มุมมองรายการ'}
          >
            <Icon className="h-4 w-4" />
          </button>
        )
      })}
    </div>
  )
}
