'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { RefreshCw, Shield } from 'lucide-react'
import { useState } from 'react'

export function RoleRefresher() {
  const { role, refreshProfile, forceRefresh } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      // Call the API to ensure we get fresh data
      const response = await fetch('/api/auth/refresh-role', {
        method: 'POST'
      })
      const data = await response.json()
      console.log('Role refreshed from API:', data)
      
      // Then refresh the context
      await refreshProfile()
      
      // For immediate update, you might want to reload
      if (data.role !== role) {
        window.location.reload()
      }
    } catch (error) {
      console.error('Error refreshing role:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const getRoleBadgeColor = () => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'organizer':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-gray-600" />
        <span className="text-sm text-gray-600">Role:</span>
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor()}`}>
          {role.toUpperCase()}
        </span>
      </div>
      <Button
        onClick={handleRefresh}
        variant="outline"
        size="sm"
        disabled={isRefreshing}
        className="flex items-center gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Refreshing...' : 'Refresh Role'}
      </Button>
    </div>
  )
}