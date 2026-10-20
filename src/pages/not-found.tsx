import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="ไม่พบหน้าที่ต้องการ"
      description="หน้านี้อาจถูกย้ายหรือคุณไม่มีสิทธิ์เข้าถึง"
      action={<Button asChild><Link to="/">กลับหน้าหลัก</Link></Button>}
      className="mt-10"
    />
  )
}
