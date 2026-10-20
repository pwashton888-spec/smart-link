import { useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ActivityLog } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select, SELECT_NONE } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { AdminHeader } from './admin-header'

const PAGE = 50

const ENTITY: Record<string, string> = {
  links: 'ลิงก์',
  link_roles: 'สิทธิ์ลิงก์ตามตำแหน่ง',
  link_user_permissions: 'สิทธิ์ลิงก์รายบุคคล',
  user_roles: 'ตำแหน่งของพนักงาน',
  roles: 'ตำแหน่งงาน',
  categories: 'หมวดหมู่',
  profiles: 'บัญชีพนักงาน',
  auth: 'การเข้าสู่ระบบ',
}
const ACTION: Record<string, { label: string; variant: 'teal' | 'default' | 'destructive' | 'secondary' | 'warning' }> = {
  insert: { label: 'เพิ่ม', variant: 'teal' },
  update: { label: 'แก้ไข', variant: 'default' },
  delete: { label: 'ลบ', variant: 'destructive' },
  login: { label: 'เข้าสู่ระบบ', variant: 'secondary' },
  invite: { label: 'เชิญพนักงาน', variant: 'teal' },
  suspend: { label: 'ระงับบัญชี', variant: 'destructive' },
  activate: { label: 'เปิดใช้งานบัญชี', variant: 'teal' },
}

function summarize(log: ActivityLog) {
  const d = (log.new_data ?? log.old_data ?? {}) as Record<string, unknown>
  const name = (d.title ?? d.name ?? d.full_name ?? d.email) as string | undefined
  if (log.action === 'update' && log.old_data && log.new_data) {
    const changed = Object.keys(log.new_data).filter(
      (k) => !['updated_at', 'updated_by'].includes(k) && JSON.stringify(log.new_data![k]) !== JSON.stringify(log.old_data![k]),
    )
    return `${name ?? ''}${changed.length ? ` (เปลี่ยน: ${changed.join(', ')})` : ''}`
  }
  return name ?? log.entity_id ?? ''
}

export default function AdminLogsPage() {
  const [entity, setEntity] = useState(SELECT_NONE)
  const [expanded, setExpanded] = useState<number | null>(null)

  const logs = useInfiniteQuery({
    queryKey: ['admin', 'logs', entity],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from('activity_logs')
        .select('*, actor:profiles(full_name, email)')
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE - 1)
      if (entity !== SELECT_NONE) q = q.eq('entity_type', entity)
      const { data, error } = await q
      if (error) throw error
      return data as ActivityLog[]
    },
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
  })

  const rows = useMemo(() => logs.data?.pages.flat() ?? [], [logs.data])

  return (
    <div className="space-y-6">
      <AdminHeader title="ประวัติการใช้งาน" description="บันทึกการเพิ่ม แก้ไข ลบ และการเข้าสู่ระบบ (ไม่รวมลิงก์ส่วนตัวของพนักงาน)" />
      <div className="max-w-xs">
        <Select
          value={entity}
          onValueChange={setEntity}
          options={[{ value: SELECT_NONE, label: 'ทุกประเภท' }, ...Object.entries(ENTITY).map(([value, label]) => ({ value, label }))]}
        />
      </div>
      {logs.error ? (
        <ErrorState message={(logs.error as Error).message} onRetry={() => logs.refetch()} />
      ) : logs.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : !rows.length ? (
        <EmptyState icon={History} title="ยังไม่มีประวัติ" />
      ) : (
        <>
          <div className="divide-y overflow-hidden rounded-2xl border bg-card/80 shadow-soft">
            {rows.map((log) => {
              const a = ACTION[log.action] ?? { label: log.action, variant: 'secondary' as const }
              return (
                <div key={log.id} className="px-4 py-3">
                  <button className="flex w-full flex-col gap-1 text-left sm:flex-row sm:items-center sm:gap-3" onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                    <span className="w-36 shrink-0 text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Badge variant={a.variant}>{a.label}</Badge>
                      <span className="text-xs text-muted-foreground">{ENTITY[log.entity_type] ?? log.entity_type}</span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{summarize(log)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">โดย {log.actor?.full_name ?? 'ระบบ'}</span>
                  </button>
                  {expanded === log.id && (log.old_data || log.new_data) && (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {log.old_data && (
                        <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-[11px]"><b>ก่อน</b>{'\n'}{JSON.stringify(log.old_data, null, 2)}</pre>
                      )}
                      {log.new_data && (
                        <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-[11px]"><b>หลัง</b>{'\n'}{JSON.stringify(log.new_data, null, 2)}</pre>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {logs.hasNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => logs.fetchNextPage()} loading={logs.isFetchingNextPage}>โหลดเพิ่ม</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
