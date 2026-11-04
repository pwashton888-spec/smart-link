import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { AccessibleLink } from '@/lib/types'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Eye, Pencil, Star } from 'lucide-react'
import { useCategories, useMyLinks, useSavePersonalCategory, useSavePersonalLink, useToggleFavorite } from '@/hooks/data'
import { errorMessage, findDuplicateLinks, validateUrl } from '@/lib/utils'
import { TagInput } from './tag-input'
import { PERSONAL_CATEGORY_DEFAULT } from './personal-category-dialog'
import { DuplicateNotice, type DuplicateMatch } from './duplicate-notice'
import { useLinkActions } from './link-actions'

const NEW_CATEGORY = '__new'

export function PersonalLinkDialog({
  open,
  link,
  defaultCategoryId,
  onOpenChange,
}: {
  open: boolean
  link: AccessibleLink | null
  /** หมวดหมู่ที่เลือกไว้ล่วงหน้าเมื่อเพิ่มลิงก์ใหม่ */
  defaultCategoryId?: string
  onOpenChange: (open: boolean) => void
}) {
  const save = useSavePersonalLink()
  const saveCategory = useSavePersonalCategory()
  const { data: categories = [] } = useCategories()
  const { data: myLinks = [] } = useMyLinks()
  const fav = useToggleFavorite()
  const actions = useLinkActions()
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [errors, setErrors] = useState<{ title?: string; url?: string; category?: string }>({})

  const personalCategory = categories.find((c) => c.slug === 'personal')
  // เลือกได้ : "เว็บไซต์ส่วนตัว" + หมวดหมู่ที่สร้างเอง (+ หมวดเดิมของลิงก์ ถ้าเป็นหมวดอื่น)
  const options = useMemo(() => {
    const mine = categories.filter((c) => c.owner_id)
    const current = link?.category && !link.category.owner_id && link.category.id !== personalCategory?.id ? [link.category] : []
    return [
      ...(personalCategory ? [{ value: personalCategory.id, label: personalCategory.name }] : []),
      ...current.map((c) => ({ value: c.id, label: c.name })),
      ...mine.map((c) => ({ value: c.id, label: c.name })),
      { value: NEW_CATEGORY, label: '+ สร้างหมวดหมู่ใหม่…' },
    ]
  }, [categories, personalCategory, link])

  // ตรวจ URL ซ้ำกับลิงก์ที่คุณเห็นอยู่แล้ว (ลิงก์ขององค์กรที่มีสิทธิ์ + ลิงก์ส่วนตัวของคุณ)
  const duplicates = useMemo<DuplicateMatch[]>(() => {
    if (!validateUrl(url).ok) return []
    return findDuplicateLinks(url, myLinks, link?.id).map((d) => {
      const personal = d.visibility === 'personal'
      return {
        id: d.id,
        title: d.title,
        url: d.url,
        icon_url: d.icon_url,
        note: personal ? `ลิงก์ส่วนตัวของคุณ${d.category ? ` · ${d.category.name}` : ''}` : `ลิงก์ขององค์กร${d.category ? ` · ${d.category.name}` : ''}`,
        action: personal ? (
          <Button type="button" size="sm" variant="outline" onClick={() => actions.editPersonal(d)}>
            <Pencil /> แก้ไขรายการเดิม
          </Button>
        ) : d.isFavorite ? (
          <Button type="button" size="sm" variant="outline" onClick={() => { onOpenChange(false); actions.showDetail(d) }}>
            <Eye /> ดูลิงก์นี้
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              fav.mutate({ linkId: d.id, favorite: true })
              onOpenChange(false)
            }}
          >
            <Star /> ปักหมุดลิงก์นี้แทน
          </Button>
        ),
      }
    })
  }, [url, myLinks, link?.id, actions, fav, onOpenChange])

  useEffect(() => {
    if (!open) return
    setTitle(link?.title ?? '')
    setUrl(link?.url ?? '')
    setDescription(link?.description ?? '')
    setTags(link?.tags ?? [])
    setCategoryId(link?.category_id ?? defaultCategoryId ?? personalCategory?.id ?? '')
    setNewCategoryName('')
    setErrors({})
  }, [open, link, defaultCategoryId, personalCategory?.id])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!title.trim()) next.title = 'กรุณากรอกชื่อเว็บไซต์'
    const checked = validateUrl(url)
    if (!checked.ok) next.url = checked.error
    if (categoryId === NEW_CATEGORY && !newCategoryName.trim()) next.category = 'กรุณาตั้งชื่อหมวดหมู่ใหม่'
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      let target: string | null = categoryId || null
      if (categoryId === NEW_CATEGORY) {
        target = await saveCategory.mutateAsync({ name: newCategoryName, ...PERSONAL_CATEGORY_DEFAULT })
        setCategoryId(target)
      }
      await save.mutateAsync({ id: link?.id, title, url, description, tags, categoryId: target })
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
          <DuplicateNotice
            matches={duplicates}
            message={
              link
                ? 'URL นี้ซ้ำกับลิงก์อื่นที่คุณมีอยู่แล้ว'
                : 'คุณมีลิงก์ URL นี้อยู่แล้ว แนะนำให้ใช้รายการเดิมแทนการเพิ่มซ้ำ'
            }
          />
          <Field label="หมวดหมู่" htmlFor="pl-cat" error={errors.category} hint="สร้างหมวดหมู่ของคุณเองได้ หมวดหมู่ส่วนตัวมองเห็นเฉพาะคุณ">
            <div className="space-y-2">
              <Select id="pl-cat" value={categoryId} onValueChange={setCategoryId} options={options} placeholder="เลือกหมวดหมู่" />
              {categoryId === NEW_CATEGORY && (
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="ชื่อหมวดหมู่ใหม่ เช่น งานเอกสาร"
                  maxLength={60}
                  autoFocus
                />
              )}
            </div>
          </Field>
          <Field label="คำอธิบาย (ไม่บังคับ)" htmlFor="pl-desc">
            <Textarea id="pl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
          <Field label="คำสำคัญ (ไม่บังคับ)" hint="กด Enter เพื่อเพิ่มคำ ช่วยให้ค้นหาง่ายขึ้น">
            <TagInput value={tags} onChange={setTags} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" loading={save.isPending || saveCategory.isPending} variant={!link && duplicates.length ? 'outline' : 'default'}>
              {link ? 'บันทึก' : duplicates.length ? 'เพิ่มซ้ำต่อไป' : 'เพิ่มลิงก์'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
