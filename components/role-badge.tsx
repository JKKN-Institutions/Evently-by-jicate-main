'use client'

import { UserRole } from '@/types'
import { Shield, Crown, User } from 'lucide-react'

interface RoleBadgeProps {
  role: UserRole
  className?: string
}

export function RoleBadge({ role, className = '' }: RoleBadgeProps) {
  const getRoleConfig = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return {
          label: 'Admin',
          icon: Crown,
          className: 'bg-red-100 text-red-800 border-red-200'
        }
      case 'organizer':
        return {
          label: 'Organizer',
          icon: Shield,
          className: 'bg-blue-100 text-blue-800 border-blue-200'
        }
      case 'user':
      default:
        return {
          label: 'User',
          icon: User,
          className: 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }
  }

  const config = getRoleConfig(role)
  const Icon = config.icon

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${config.className} ${className}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}

interface RoleIndicatorProps {
  role: UserRole
  size?: 'sm' | 'md' | 'lg'
}

export function RoleIndicator({ role, size = 'md' }: RoleIndicatorProps) {
  const getRoleConfig = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return {
          color: 'bg-red-500',
          label: 'Admin'
        }
      case 'organizer':
        return {
          color: 'bg-blue-500',
          label: 'Organizer'
        }
      case 'user':
      default:
        return {
          color: 'bg-gray-500',
          label: 'User'
        }
    }
  }

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4'
  }

  const config = getRoleConfig(role)

  return (
    <div className="flex items-center gap-2">
      <div
        className={`rounded-full ${config.color} ${sizeClasses[size]}`}
        title={config.label}
      />
      <span className="text-sm text-gray-600">{config.label}</span>
    </div>
  )
}
