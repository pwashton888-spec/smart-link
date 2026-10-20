import { createContext, useContext, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { AccessibleLink } from '@/lib/types'
import { useDeletePersonalLink, useMyLinks } from '@/hooks/data'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { LinkDetailDialog } from './link-detail-dialog'
import { PersonalLinkDialog } from './personal-link-dialog'

interface LinkActions {
  showDetail: (link: AccessibleLink) => void
  addPersonal: () => void
  editPersonal: (link: AccessibleLink) => void
  deletePersonal: (link: AccessibleLink) => void
}

const Ctx = createContext<LinkActions | null>(null)

export async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.success('คัดลอก URL แล้ว')
  } catch {
    toast.error('คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง')
  }
}

/** ให้ทุกการ์ดลิงก์เรียก Popup / ฟอร์มลิงก์ส่วนตัว ได้จากที่เดียว */
export function LinkActionsProvider({ children }: { children: React.ReactNode }) {
  const { data } = useMyLinks()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editing, setEditing] = useState<AccessibleLink | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<AccessibleLink | null>(null)
  const del = useDeletePersonalLink()

  const detail = useMemo(() => data?.find((l) => l.id === detailId) ?? null, [data, detailId])

  const actions = useMemo<LinkActions>(
    () => ({
      showDetail: (l) => setDetailId(l.id),
      addPersonal: () => setEditing(null),
      editPersonal: (l) => {
        setDetailId(null)
        setEditing(l)
      },
      deletePersonal: (l) => {
        setDetailId(null)
        setDeleting(l)
      },
    }),
    [],
  )

  return (
    <Ctx.Provider value={actions}>
      {children}
      <LinkDetailDialog link={detail} onOpenChange={(o) => !o && setDetailId(null)} />
      <PersonalLinkDialog
        open={editing !== undefined}
        link={editing ?? null}
        onOpenChange={(o) => !o && setEditing(undefined)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="ลบลิงก์ส่วนตัว?"
        description={deleting ? `“${deleting.title}” จะถูกลบถาวร` : undefined}
        confirmLabel="ลบลิงก์"
        destructive
        onConfirm={async () => {
          if (deleting) await del.mutateAsync(deleting.id)
        }}
      />
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLinkActions() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLinkActions must be used inside LinkActionsProvider')
  return ctx
}
