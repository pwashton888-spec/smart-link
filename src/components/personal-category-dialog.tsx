import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Category } from '@/lib/types'
import { useSavePersonalCategory } from '@/hooks/data'
import { cn, errorMessage } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/label'
import { ColorPicker } from './color-picker'
import { CATEGORY_ICONS, CategoryIcon } from './icons'

// eslint-disable-next-line react-refresh/only-export-components
export const PERSONAL_CATEGORY_DEFAULT = { color: '#14a3a0', icon: 'Folder' }

/** สร้าง / แก้ไขหมวดหมู่ส่วนตัวของพนักงาน */
export function PersonalCategoryDialog({
  open,
  category,
  onOpenChange,
}: {
  open: boolean
  category: Category | null
  onOpenChange: (open: boolean) => void
}) {
  const save = useSavePersonalCategory()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(PERSONAL_CATEGORY_DEFAULT.icon)
  const [color, setColor] = useState(PERSONAL_CATEGORY_DEFAULT.color)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!open) return
    setName(category?.name ?? '')
    setIcon(category?.icon ?? PERSONAL_CATEGORY_DEFAULT.icon)
    setColor(category?.color ?? PERSONAL_CATEGORY_DEFAULT.color)
    setError(undefined)
  }, [open, category])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('กรุณากรอกชื่อหมวดหมู่')
    try {
      await save.mutateAsync({ id: category?.id, name, icon, color })
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{category ? 'แก้ไขหมวดหมู่ของฉัน' : 'สร้างหมวดหมู่ใหม่'}</DialogTitle>
          <DialogDescription>หมวดหมู่ที่คุณสร้างมองเห็นได้เฉพาะคุณ ใช้จัดกลุ่มลิงก์ส่วนตัว</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="ชื่อหมวดหมู่" htmlFor="pc-name" error={error}>
            <Input id="pc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น งานเอกสาร" maxLength={60} autoFocus />
          </Field>
          <div className="space-y-2">
            <Label>ไอคอน</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {Object.keys(CATEGORY_ICONS).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setIcon(k)}
                  className={cn('flex h-9 items-center justify-center rounded-lg border transition hover:bg-accent', icon === k && 'border-teal bg-teal/10 text-teal')}
                  aria-label={k}
                >
                  <CategoryIcon name={k} />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>สี</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" loading={save.isPending}>{category ? 'บันทึก' : 'สร้างหมวดหมู่'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
