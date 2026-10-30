import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  FolderTree, History, Home, KeyRound, Layers, Link2, LogOut, Menu, Moon, Search, Shield, Sun, UserRound, Users, X,
  BriefcaseBusiness, DatabaseBackup, Sparkles,
} from 'lucide-react'
import { useAuth } from '@/providers/auth'
import { useTheme } from '@/providers/theme'
import { useMyLinks } from '@/hooks/data'
import { cn, initials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LinkActionsProvider } from './link-actions'
import { SearchDialog } from './search-dialog'
import { NotificationBell } from './notification-bell'
import { CategoryIcon } from './icons'

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-soft">
        <Link2 className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight">Smart Link</p>
        <p className="text-[11px] text-muted-foreground">Workspace</p>
      </div>
    </div>
  )
}

function NavItem({ to, icon: Icon, label, end, badge }: { to: string; icon: typeof Home; label: string; end?: boolean; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition',
          isActive ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && <span className="text-[11px] opacity-70">{badge}</span>}
    </NavLink>
  )
}

function SidebarContent() {
  const { isAdmin } = useAuth()
  const { data, categories } = useMyLinks()
  const counts = new Map<string, number>()
  for (const l of data ?? []) if (l.category_id) counts.set(l.category_id, (counts.get(l.category_id) ?? 0) + 1)
  const visibleCats = categories.filter((c) => c.is_active && (counts.get(c.id) ?? 0) > 0)

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5 scrollbar-thin">
      <Brand />
      <nav className="space-y-1">
        <NavItem to="/" end icon={Home} label="หน้าหลัก" />
        <NavItem to="/links" icon={Layers} label="ลิงก์ทั้งหมด" badge={data?.length} />
        <NavItem to="/workspace" icon={Sparkles} label="พื้นที่ส่วนตัว" />
      </nav>

      {visibleCats.length > 0 && (
        <div>
          <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">หมวดหมู่</p>
          <nav className="space-y-0.5">
            {visibleCats.map((c) => (
              <NavLink
                key={c.id}
                to={`/links?category=${c.slug}`}
                className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <CategoryIcon name={c.icon} className="h-4 w-4" style={{ color: c.color }} />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-[11px]">{counts.get(c.id)}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      {isAdmin && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Shield className="h-3 w-3" /> ผู้ดูแลระบบ
          </p>
          <nav className="space-y-1">
            <NavItem to="/admin/links" icon={Link2} label="จัดการลิงก์" />
            <NavItem to="/admin/users" icon={Users} label="จัดการพนักงาน" />
            <NavItem to="/admin/categories" icon={FolderTree} label="หมวดหมู่" />
            <NavItem to="/admin/roles" icon={BriefcaseBusiness} label="ตำแหน่งงาน" />
            <NavItem to="/admin/logs" icon={History} label="ประวัติการใช้งาน" />
            <NavItem to="/admin/backup" icon={DatabaseBackup} label="สำรอง/กู้คืนข้อมูล" />
          </nav>
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { profile, roles, signOut } = useAuth()
  if (!profile) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-accent">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal text-xs font-semibold text-teal-foreground">
            {initials(profile.full_name || profile.email)}
          </div>
          <div className="hidden text-left leading-tight md:block">
            <p className="max-w-[10rem] truncate text-sm font-medium">{profile.full_name}</p>
            <p className="max-w-[10rem] truncate text-[11px] text-muted-foreground">
              {roles.map((r) => r.name).join(', ') || (profile.is_admin ? 'ผู้ดูแลระบบ' : 'ยังไม่มีตำแหน่ง')}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium text-foreground">{profile.full_name}</p>
          <p className="truncate">{profile.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <NavLink to="/profile"><UserRound /> ข้อมูลของฉัน</NavLink>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <NavLink to="/profile#password"><KeyRound /> เปลี่ยนรหัสผ่าน</NavLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => signOut()}><LogOut /> ออกจากระบบ</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppLayout() {
  const { theme, toggle } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setMobileOpen(false), [location.pathname, location.search])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <LinkActionsProvider>
      <div className="min-h-screen">
        <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-64 border-r lg:block">
          <SidebarContent />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-in fade-in-0" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 border-r bg-card shadow-lift animate-in slide-in-from-left">
              <button className="absolute right-3 top-5 rounded-lg p-1.5 hover:bg-accent" onClick={() => setMobileOpen(false)} aria-label="ปิดเมนู">
                <X className="h-5 w-5" />
              </button>
              <SidebarContent />
            </aside>
          </div>
        )}

        <div className="lg:pl-64">
          <header className="glass sticky top-0 z-20 border-b">
            <div className="flex h-16 items-center gap-3 px-4 md:px-6">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="เปิดเมนู">
                <Menu className="h-5 w-5" />
              </Button>
              <button
                onClick={() => setSearchOpen(true)}
                className="flex h-10 flex-1 items-center gap-2 rounded-xl border bg-background/60 px-3 text-sm text-muted-foreground transition hover:border-teal/40 md:max-w-md"
              >
                <Search className="h-4 w-4" />
                <span className="flex-1 truncate text-left">ค้นหาลิงก์...</span>
                <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] sm:block">Ctrl K</kbd>
              </button>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={toggle} aria-label="สลับธีม" title={theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}>
                  {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
                <NotificationBell />
                <UserMenu />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8">
            <Outlet />
          </main>
        </div>
        <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </LinkActionsProvider>
  )
}
