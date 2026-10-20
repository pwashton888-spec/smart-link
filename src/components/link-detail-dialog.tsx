import { Copy, ExternalLink, EyeOff, Eye, Info, Pencil, Star, Tag, Trash2, UserCheck } from 'lucide-react'
import type { AccessibleLink } from '@/lib/types'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge, RoleBadge } from '@/components/ui/badge'
import { useOpenLink, useSetHidden, useToggleFavorite } from '@/hooks/data'
import { cn, hostnameOf } from '@/lib/utils'
import { LinkIcon } from './link-icon'
import { CategoryIcon } from './icons'
import { copyUrl, useLinkActions } from './link-actions'

export function LinkDetailDialog({
  link,
  onOpenChange,
}: {
  link: AccessibleLink | null
  onOpenChange: (open: boolean) => void
}) {
  const openLink = useOpenLink()
  const fav = useToggleFavorite()
  const hide = useSetHidden()
  const actions = useLinkActions()

  return (
    <Dialog open={!!link} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0">
        {link && (
          <>
            <div className="brand-gradient relative overflow-hidden rounded-t-2xl px-6 pb-6 pt-7 text-white">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex items-start gap-4">
                <LinkIcon title={link.title} url={link.url} iconUrl={link.icon_url} size="lg" className="ring-4 ring-white/20" />
                <div className="min-w-0 flex-1 pr-6">
                  <DialogTitle className="text-xl text-white">{link.title}</DialogTitle>
                  <DialogDescription className="mt-1 truncate text-sm text-white/75">{hostnameOf(link.url)}</DialogDescription>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {link.category && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs">
                        <CategoryIcon name={link.category.icon} className="h-3.5 w-3.5" />
                        {link.category.name}
                      </span>
                    )}
                    {link.is_featured && <span className="rounded-full bg-amber-400/90 px-2.5 py-0.5 text-xs text-amber-950">แนะนำ</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5 px-6 pb-6">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {link.description || 'ยังไม่มีคำอธิบายสำหรับลิงก์นี้'}
              </p>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">สิทธิ์การเข้าถึง</p>
                <div className="flex flex-wrap gap-1.5">
                  {link.visibility === 'global' && <Badge variant="teal">ส่วนกลาง (ทุกคน)</Badge>}
                  {link.visibility === 'personal' && <Badge variant="secondary">ลิงก์ส่วนตัวของคุณ</Badge>}
                  {link.roles.map((r) => (
                    <RoleBadge key={r.id} name={r.name} color={r.color} />
                  ))}
                  {link.grantedToMe && (
                    <Badge variant="outline">
                      <UserCheck className="h-3 w-3" /> มอบให้คุณโดยเฉพาะ
                    </Badge>
                  )}
                </div>
              </div>

              {link.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  {link.tags.map((t) => (
                    <Badge key={t} variant="secondary">#{t}</Badge>
                  ))}
                </div>
              )}

              {link.usage_guide && (
                <div className="rounded-xl border bg-muted/40 p-4">
                  <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                    <Info className="h-4 w-4 text-teal" /> วิธีใช้งาน / ข้อมูลเพิ่มเติม
                  </p>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{link.usage_guide}</p>
                </div>
              )}

              <div className="rounded-xl border bg-background/60 px-3 py-2">
                <p className="break-all font-mono text-xs text-muted-foreground">{link.url}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button className="col-span-2" variant="teal" size="lg" onClick={() => openLink(link)}>
                  <ExternalLink /> เปิดเว็บไซต์
                </Button>
                <Button variant="outline" size="lg" onClick={() => copyUrl(link.url)}>
                  <Copy /> คัดลอก
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => fav.mutate({ linkId: link.id, favorite: !link.isFavorite })}
                >
                  <Star className={cn(link.isFavorite && 'fill-amber-400 text-amber-400')} />
                  {link.isFavorite ? 'เลิกปักหมุด' : 'ปักหมุด'}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="ghost" size="sm" onClick={() => hide.mutate({ linkId: link.id, hidden: !link.isHidden })}>
                  {link.isHidden ? <Eye /> : <EyeOff />}
                  {link.isHidden ? 'แสดงบน Dashboard' : 'ซ่อนจาก Dashboard'}
                </Button>
                {link.visibility === 'personal' && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => actions.editPersonal(link)}>
                      <Pencil /> แก้ไข
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => actions.deletePersonal(link)}>
                      <Trash2 /> ลบ
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
