import { useState } from 'react'
import { History, RotateCcw } from 'lucide-react'
import type { LinkVersion } from '@/lib/types'
import { useLinkVersions, useRestoreLinkVersion } from '@/hooks/collections'
import { formatDateTime, relativeTime } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { EmptyState, ErrorState } from './empty-state'

type Snapshot = Pick<LinkVersion, 'title' | 'url' | 'description'>

const FIELDS: { key: keyof Snapshot; label: string; mono?: boolean }[] = [
  { key: 'title', label: 'ชื่อ' },
  { key: 'url', label: 'URL', mono: true },
  { key: 'description', label: 'คำอธิบาย' },
]

function changedFields(before: Snapshot, after: Snapshot) {
  return FIELDS.filter((f) => (before[f.key] ?? '') !== (after[f.key] ?? ''))
}

/** แสดงความแตกต่างของแต่ละช่อง : ค่าเดิม (แดง ขีดฆ่า) → ค่าใหม่ (เขียว) */
function Diff({ before, after }: { before: Snapshot; after: Snapshot }) {
  const fields = changedFields(before, after)
  if (!fields.length) return <p className="text-xs text-muted-foreground">ไม่มีความแตกต่าง</p>
  return (
    <div className="space-y-2">
      {fields.map((f) => (
        <div key={f.key} className="grid gap-1 text-sm sm:grid-cols-[88px_1fr]">
          <span className="text-xs font-medium text-muted-foreground sm:pt-1">{f.label}</span>
          <div className="min-w-0 space-y-1">
            <p className={`break-all rounded-md bg-destructive/10 px-2 py-1 text-destructive line-through decoration-destructive/50 ${f.mono ? 'font-mono text-xs' : ''}`}>
              {before[f.key] || <span className="italic opacity-70">(ว่าง)</span>}
            </p>
            <p className={`break-all rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300 ${f.mono ? 'font-mono text-xs' : ''}`}>
              {after[f.key] || <span className="italic opacity-70">(ว่าง)</span>}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * ประวัติเวอร์ชันของลิงก์ : แต่ละรายการคือการแก้ไข 1 ครั้ง
 * แสดงค่าก่อน → หลังแก้ และย้อนกลับไปใช้ค่าก่อนแก้ได้
 */
export function LinkHistoryDialog({
  link,
  onOpenChange,
}: {
  link: ({ id: string } & Snapshot) | null
  onOpenChange: (open: boolean) => void
}) {
  const versions = useLinkVersions(link?.id ?? null)
  const restore = useRestoreLinkVersion()
  const [restoring, setRestoring] = useState<LinkVersion | null>(null)
  const list = versions.data ?? []

  return (
    <Dialog open={!!link} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-teal" /> ประวัติเวอร์ชัน</DialogTitle>
          <DialogDescription>
            {link?.title} · ระบบบันทึกค่าเดิมทุกครั้งที่ชื่อ URL หรือคำอธิบายเปลี่ยน (เก็บ 50 ครั้งล่าสุด)
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1 scrollbar-thin">
          {versions.error ? (
            <ErrorState message={(versions.error as Error).message} onRetry={() => versions.refetch()} />
          ) : versions.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : !list.length ? (
            <EmptyState icon={History} title="ยังไม่มีการแก้ไข" description="เมื่อมีการเปลี่ยนชื่อ URL หรือคำอธิบาย ค่าเดิมจะแสดงที่นี่ และย้อนกลับได้" />
          ) : (
            link &&
            list.map((v, i) => {
              // ค่าหลังการแก้ไขครั้งนี้ = เวอร์ชันที่ใหม่กว่าถัดไป หรือค่าปัจจุบัน
              const after: Snapshot = i === 0 ? link : list[i - 1]
              const sameAsCurrent = !changedFields(v, link).length
              return (
                <div key={v.id} className="space-y-3 rounded-xl border bg-card/80 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={v.is_restore ? 'warning' : 'default'}>{v.is_restore ? 'ย้อนกลับ' : 'แก้ไข'}</Badge>
                    <span className="text-sm" title={formatDateTime(v.changed_at)}>
                      {formatDateTime(v.changed_at)} <span className="text-muted-foreground">({relativeTime(v.changed_at)})</span>
                    </span>
                    {v.editor?.full_name && <span className="text-xs text-muted-foreground">โดย {v.editor.full_name}</span>}
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      disabled={sameAsCurrent || restore.isPending}
                      title={sameAsCurrent ? 'ค่าปัจจุบันตรงกับเวอร์ชันนี้แล้ว' : 'ใช้ค่าก่อนการแก้ไขครั้งนี้'}
                      onClick={() => setRestoring(v)}
                    >
                      <RotateCcw /> ย้อนกลับเป็นค่าก่อนแก้
                    </Button>
                  </div>
                  <Diff before={v} after={after} />
                </div>
              )
            })
          )}
        </div>
      </DialogContent>

      <ConfirmDialog
        open={!!restoring}
        onOpenChange={(o) => !o && setRestoring(null)}
        title="ย้อนกลับเป็นเวอร์ชันนี้?"
        description={
          restoring && link ? (
            <div className="space-y-3">
              <p>ค่าปัจจุบันจะเปลี่ยนดังนี้ (ค่าปัจจุบันจะถูกเก็บไว้ในประวัติ ย้อนกลับมาได้อีก)</p>
              <Diff before={link} after={restoring} />
            </div>
          ) : undefined
        }
        confirmLabel="ย้อนกลับ"
        onConfirm={async () => {
          if (restoring) await restore.mutateAsync(restoring)
        }}
      />
    </Dialog>
  )
}
