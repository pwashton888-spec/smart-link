import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { DatabaseBackup, Download, FileUp, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { AdminHeader } from './admin-header'

const FORMAT = 'smart-link-workspace-backup'
const VERSION = 1

interface Backup {
  format: typeof FORMAT
  version: number
  exported_at: string
  roles: Record<string, unknown>[]
  categories: Record<string, unknown>[]
  links: Record<string, unknown>[]
  link_roles: Record<string, unknown>[]
  link_user_permissions: Record<string, unknown>[]
  user_roles: Record<string, unknown>[]
}

async function fetchAll(table: string, excludePersonal = false) {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select('*').range(from, from + 999)
    if (excludePersonal) q = q.neq('visibility', 'personal')
    const { data, error } = await q
    if (error) throw error
    rows.push(...(data as Record<string, unknown>[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

export default function AdminBackupPage() {
  const queryClient = useQueryClient()
  const [exporting, setExporting] = useState(false)
  const [pending, setPending] = useState<Backup | null>(null)

  async function exportData() {
    setExporting(true)
    try {
      const [roles, categories, links, link_roles, link_user_permissions, user_roles] = await Promise.all([
        fetchAll('roles'),
        fetchAll('categories'),
        // ลิงก์ส่วนตัวของพนักงานไม่ถูกส่งออก (ผู้ดูแลไม่มีสิทธิ์อ่านอยู่แล้ว)
        fetchAll('links', true),
        fetchAll('link_roles'),
        fetchAll('link_user_permissions'),
        fetchAll('user_roles'),
      ])
      const backup: Backup = { format: FORMAT, version: VERSION, exported_at: new Date().toISOString(), roles, categories, links, link_roles, link_user_permissions, user_roles }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `smart-link-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success(`ส่งออกแล้ว: ${links.length} ลิงก์, ${categories.length} หมวดหมู่, ${roles.length} ตำแหน่ง`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  async function pickFile(file: File) {
    try {
      const data = JSON.parse(await file.text()) as Backup
      if (data.format !== FORMAT || !Array.isArray(data.links)) throw new Error('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ Smart Link Workspace')
      setPending(data)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function restore(data: Backup) {
    const strip = (rows: Record<string, unknown>[], drop: string[]) =>
      rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !drop.includes(k))))
    try {
      // ลำดับสำคัญ: ตำแหน่ง → หมวดหมู่ → ลิงก์ → ความสัมพันธ์
      const steps: [string, Record<string, unknown>[], string][] = [
        ['roles', strip(data.roles, ['created_at', 'updated_at']), 'id'],
        ['categories', strip(data.categories, ['created_at', 'updated_at']), 'id'],
        ['links', strip(data.links.filter((l) => l.visibility !== 'personal'), ['created_at', 'updated_at', 'created_by', 'updated_by', 'owner_id']), 'id'],
        ['link_roles', data.link_roles, 'link_id,role_id'],
      ]
      for (const [table, rows, onConflict] of steps) {
        if (!rows.length) continue
        const { error } = await supabase.from(table).upsert(rows, { onConflict })
        if (error) throw new Error(`${table}: ${error.message}`)
      }
      // สิทธิ์รายบุคคล / ตำแหน่งพนักงาน : กู้คืนเฉพาะพนักงานที่ยังมีบัญชีอยู่
      const { data: profiles } = await supabase.from('profiles').select('id')
      const ids = new Set((profiles ?? []).map((p) => p.id as string))
      const lup = strip(data.link_user_permissions.filter((r) => ids.has(r.user_id as string)), ['granted_by'])
      const ur = strip(data.user_roles.filter((r) => ids.has(r.user_id as string)), ['assigned_by'])
      if (lup.length) {
        const { error } = await supabase.from('link_user_permissions').upsert(lup, { onConflict: 'link_id,user_id' })
        if (error) throw new Error(`link_user_permissions: ${error.message}`)
      }
      if (ur.length) {
        const { error } = await supabase.from('user_roles').upsert(ur, { onConflict: 'user_id,role_id' })
        if (error) throw new Error(`user_roles: ${error.message}`)
      }
      toast.success('กู้คืนข้อมูลเรียบร้อย')
      queryClient.invalidateQueries()
    } catch (e) {
      toast.error(`กู้คืนไม่สำเร็จ: ${errorMessage(e)}`)
      throw e
    }
  }

  return (
    <div className="space-y-6">
      <AdminHeader title="สำรองและกู้คืนข้อมูล" description="ส่งออกลิงก์ หมวดหมู่ ตำแหน่ง และสิทธิ์ทั้งหมดเป็นไฟล์ JSON" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Download className="h-4 w-4 text-teal" /> สำรองข้อมูล</CardTitle>
            <CardDescription>ดาวน์โหลดข้อมูลการตั้งค่าทั้งหมดของระบบ แนะนำให้สำรองเป็นประจำและเก็บไฟล์ไว้ในที่ปลอดภัย</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportData} loading={exporting}><DatabaseBackup /> ดาวน์โหลดไฟล์สำรอง</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileUp className="h-4 w-4 text-teal" /> กู้คืนข้อมูล</CardTitle>
            <CardDescription>นำเข้าไฟล์สำรอง ข้อมูลที่มีอยู่จะถูกอัปเดตตามไฟล์ และรายการที่ถูกลบจะถูกเพิ่มกลับ (ไม่ลบข้อมูลใหม่)</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-medium hover:bg-accent">
              <FileUp className="h-4 w-4" /> เลือกไฟล์ .json
              <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { if (e.target.files?.[0]) pickFile(e.target.files[0]); e.target.value = '' }} />
            </label>
          </CardContent>
        </Card>
      </div>
      <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-muted-foreground">
          ไฟล์สำรองนี้ไม่รวมบัญชีผู้ใช้และรหัสผ่าน สำหรับการสำรองฐานข้อมูลทั้งหมด ให้เปิด Point-in-Time Recovery หรือ Daily Backups ใน Supabase Dashboard
          (ดูรายละเอียดใน README)
        </p>
      </div>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title="ยืนยันการกู้คืนข้อมูล?"
        description={pending ? `ไฟล์วันที่ ${new Date(pending.exported_at).toLocaleString('th-TH')} : ${pending.links.length} ลิงก์, ${pending.categories.length} หมวดหมู่, ${pending.roles.length} ตำแหน่ง` : undefined}
        confirmLabel="กู้คืน"
        onConfirm={() => pending && restore(pending)}
      />
    </div>
  )
}
