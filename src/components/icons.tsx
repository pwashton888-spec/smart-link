import {
  BarChart3, BookOpen, Briefcase, Building2, Calculator, CalendarClock, Cloud, Crown, Database, FileText, Flame,
  Folder, Globe, Headphones, Lightbulb, Mail, Megaphone, Shield, ShoppingCart, Star, User, Users, Wallet, Wrench,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Globe, Crown, CalendarClock, Wallet, Megaphone, Briefcase, User, Flame, Folder, FileText, BarChart3, Mail, Users,
  ShoppingCart, Building2, Calculator, Shield, Wrench, BookOpen, Cloud, Database, Star, Lightbulb, Headphones,
}

export function CategoryIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = CATEGORY_ICONS[name] ?? Folder
  return <Icon className={cn('h-4 w-4', className)} style={style} />
}
