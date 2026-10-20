import { cn } from '@/lib/utils'

// eslint-disable-next-line react-refresh/only-export-components
export const COLORS = ['#0f2a5c', '#14a3a0', '#2563eb', '#7c3aed', '#059669', '#e11d48', '#0891b2', '#f59e0b', '#64748b']

export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((c) => (
        <button
          type="button"
          key={c}
          onClick={() => onChange(c)}
          className={cn('h-8 w-8 rounded-full ring-offset-2 ring-offset-background transition', value === c && 'ring-2 ring-ring')}
          style={{ backgroundColor: c }}
          aria-label={c}
        />
      ))}
    </div>
  )
}
