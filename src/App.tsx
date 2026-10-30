import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/providers/auth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { AppLayout } from '@/components/app-layout'
import LoginPage from '@/pages/login'
import ForgotPasswordPage from '@/pages/forgot-password'
import ResetPasswordPage from '@/pages/reset-password'
import ChangePasswordPage from '@/pages/change-password'
import DashboardPage from '@/pages/dashboard'
import ConfigMissingPage from '@/pages/config-missing'
import NotFoundPage from '@/pages/not-found'

const AllLinksPage = lazy(() => import('@/pages/all-links'))
const WorkspacePage = lazy(() => import('@/pages/workspace'))
const ProfilePage = lazy(() => import('@/pages/profile'))
const AdminLinksPage = lazy(() => import('@/pages/admin/admin-links'))
const AdminUsersPage = lazy(() => import('@/pages/admin/admin-users'))
const AdminCategoriesPage = lazy(() => import('@/pages/admin/admin-categories'))
const AdminRolesPage = lazy(() => import('@/pages/admin/admin-roles'))
const AdminLogsPage = lazy(() => import('@/pages/admin/admin-logs'))
const AdminBackupPage = lazy(() => import('@/pages/admin/admin-backup'))

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-teal" />
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (!session || !profile) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  // รหัสผ่านชั่วคราวจากผู้ดูแล : ต้องตั้งรหัสผ่านใหม่ก่อนใช้งาน
  if (profile.must_change_password) return <Navigate to="/change-password" replace />
  return <>{children}</>
}

/** ซ่อนหน้าผู้ดูแลจากผู้ใช้ทั่วไป (การป้องกันจริงอยู่ที่ RLS ในฐานข้อมูล) */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

const page = (el: React.ReactNode) => <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-teal" /></div>}>{el}</Suspense>

export default function App() {
  if (!isSupabaseConfigured) return <ConfigMissingPage />
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="links" element={page(<AllLinksPage />)} />
          <Route path="workspace" element={page(<WorkspacePage />)} />
          <Route path="profile" element={page(<ProfilePage />)} />
          <Route path="admin" element={<RequireAdmin><Navigate to="/admin/links" replace /></RequireAdmin>} />
          <Route path="admin/links" element={<RequireAdmin>{page(<AdminLinksPage />)}</RequireAdmin>} />
          <Route path="admin/users" element={<RequireAdmin>{page(<AdminUsersPage />)}</RequireAdmin>} />
          <Route path="admin/categories" element={<RequireAdmin>{page(<AdminCategoriesPage />)}</RequireAdmin>} />
          <Route path="admin/roles" element={<RequireAdmin>{page(<AdminRolesPage />)}</RequireAdmin>} />
          <Route path="admin/logs" element={<RequireAdmin>{page(<AdminLogsPage />)}</RequireAdmin>} />
          <Route path="admin/backup" element={<RequireAdmin>{page(<AdminBackupPage />)}</RequireAdmin>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
