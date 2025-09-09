'use client'

import { ReactNode } from 'react'
import { useUser } from '@supabase/auth-helpers-react'
import { useUserRole, useIsAdmin, useIsOrganizerOrAdmin } from '@/lib/hooks/use-role'
import { UserRole } from '@/types'

interface RoleGuardProps {
  children: ReactNode
  allowedRoles?: UserRole[]
  requireAdmin?: boolean
  requireOrganizerOrAdmin?: boolean
  fallback?: ReactNode
  loading?: ReactNode
}

export function RoleGuard({
  children,
  allowedRoles,
  requireAdmin = false,
  requireOrganizerOrAdmin = false,
  fallback = null,
  loading = <div className="animate-pulse">Loading...</div>
}: RoleGuardProps) {
  const user = useUser()
  const { role, loading: roleLoading } = useUserRole(user)
  const { isAdmin, loading: adminLoading } = useIsAdmin(user)
  const { isOrganizerOrAdmin, loading: orgAdminLoading } = useIsOrganizerOrAdmin(user)

  // Show loading state
  if (roleLoading || adminLoading || orgAdminLoading) {
    return <>{loading}</>
  }

  // Check admin requirement
  if (requireAdmin && !isAdmin) {
    return <>{fallback}</>
  }

  // Check organizer or admin requirement
  if (requireOrganizerOrAdmin && !isOrganizerOrAdmin) {
    return <>{fallback}</>
  }

  // Check allowed roles
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface RoleBasedRenderProps {
  children: (props: {
    role: UserRole
    isAdmin: boolean
    isOrganizerOrAdmin: boolean
    loading: boolean
  }) => ReactNode
}

export function RoleBasedRender({ children }: RoleBasedRenderProps) {
  const user = useUser()
  const { role, loading: roleLoading } = useUserRole(user)
  const { isAdmin, loading: adminLoading } = useIsAdmin(user)
  const { isOrganizerOrAdmin, loading: orgAdminLoading } = useIsOrganizerOrAdmin(user)

  const loading = roleLoading || adminLoading || orgAdminLoading

  return <>{children({ role, isAdmin, isOrganizerOrAdmin, loading })}</>
}
