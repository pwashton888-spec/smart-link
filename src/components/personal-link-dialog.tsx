import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AccessibleLink } from '@/lib/types'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { useSavePersonalLink } from '@/hooks/data'
import { errorMessage, validateUrl } from '@/lib/utils'
import { TagInput } from './tag-input'

export function PersonalLinkDialog({
  open,
  link,
  onOpenChange,
}: {
  open: boolean
  link: AccessibleLink | null
  onOpenChange: (open: boolean) => void
}) {
  const save = useSavePersonalLink()
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({})

  useEffect(() => {
    if (!open) return
    setTitle(link?.title ?? '')
    setUrl(link?.url ?? '')
    setDescription(link?.description ?? '')
    setTags(link?.tags ?? [])
    setErrors({})
  }, [open, link])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!title.trim()) next.title = 'กรุณากรอกชื่อเว็บไซต์'
    const checked = validateUrl(url)
    if (!checked.ok) next.url = checked.error
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      await save.mutateAsync({ id: link?.id, title, url, description, tags })
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{link ? 'แก้ไขลิงก์ส่วนตัว' : 'เพิ่มลิงก์ส่วนตัว'}</DialogTitle>
          <DialogDescription>ลิงก์ส่วนตัวมองเห็นได้เฉพาะคุณเท่านั้น</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="ชื่อเว็บไซต์" htmlFor="pl-title" error={errors.title}>
            <Input id="pl-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ระบบลางาน" autoFocus />
          </Field>
          <Field label="URL" htmlFor="pl-url" error={errors.url} hint="ระบบจะเติม https:// ให้อัตโนมัติถ้าไม่ได้ใส่">
            <Input id="pl-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." inputMode="url" />
          </Field>
          <Field label="คำอธิบาย (ไม่บังคับ)" htmlFor="pl-desc">
            <Textarea id="pl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
          <Field label="คำสำคัญ (ไม่บังคับ)" hint="กด Enter เพื่อเพิ่มคำ ช่วยให้ค้นหาง่ายขึ้น">
            <TagInput value={tags} onChange={setTags} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" loading={save.isPending}>{link ? 'บันทึก' : 'เพิ่มลิงก์'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
