'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, Shield, AlertCircle, CheckCircle, RefreshCw, ChevronDown, User, Search, Filter, Users, Crown, UserCheck } from 'lucide-react'

interface User {
  id: string
  email: string
  full_name?: string | null
  role: 'user' | 'organizer' | 'admin'
  created_at?: string
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [showRoleDropdown, setShowRoleDropdown] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'organizer' | 'admin'>('all')

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showRoleDropdown && !(event.target as Element).closest('.role-dropdown')) {
        setShowRoleDropdown(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showRoleDropdown])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      
             // Check if user is authenticated
       const { data: { user } } = await supabase.auth.getUser()
       if (!user) {
         throw new Error('Not authenticated')
       }

       // Fetch current user's role to verify admin access
       const { data: currentUserProfile } = await supabase
         .from('profiles')
         .select('role')
         .eq('id', user.id)
         .single()

       if (currentUserProfile?.role !== 'admin') {
         throw new Error('Unauthorized: Admin access required')
       }
       
       // Fetch all users
       const { data, error } = await supabase
         .from('profiles')
         .select('id, email, full_name, role, created_at')
         .order('created_at', { ascending: false })

       if (error) {
         console.error('Supabase error:', error)
         throw error
       }
       
       console.log('Fetched users:', data)
       setUsers(data || [])
       setFilteredUsers(data || [])
      
         } catch (err) {
       console.error('Error fetching users:', err)
       setError(err instanceof Error ? err.message : 'Failed to fetch users')
     } finally {
      setLoading(false)
    }
  }

  // Filter users based on search term and role filter
  useEffect(() => {
    let filtered = users

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter)
    }

    setFilteredUsers(filtered)
  }, [users, searchTerm, roleFilter])

  // Get user statistics
  const getUserStats = () => {
    const total = users.length
    const admins = users.filter(u => u.role === 'admin').length
    const organizers = users.filter(u => u.role === 'organizer').length
    const regularUsers = users.filter(u => u.role === 'user').length
    
    return { total, admins, organizers, regularUsers }
  }

  const handlePromoteToOrganizer = async (userId: string) => {
    try {
      setPromoting(userId)
      const supabase = createClient()
      
      // Update user role to organizer
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'organizer' })
        .eq('id', userId)

      if (error) throw error
      
      // Refresh users list
      await fetchUsers()
    } catch (err) {
      console.error('Error promoting user:', err)
      setError(err instanceof Error ? err.message : 'Failed to promote user')
    } finally {
      setPromoting(null)
    }
  }

  const handleRoleUpdate = async (userId: string, newRole: 'user' | 'organizer' | 'admin') => {
    try {
      setUpdatingRole(userId)
      setShowRoleDropdown(null)
      
      const response = await fetch('/api/users/update-role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, newRole }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update role')
      }

      // Show success message
      console.log(`✅ Role updated successfully to ${newRole}`)
      
      // Refresh the users list to ensure we have the latest data
      await fetchUsers()
      
      // Show success notification with additional info if reauth is required
      if (data.requiresReauth) {
        alert(`User role updated to ${newRole}. The user needs to log out and log back in to see the changes take effect.`)
      } else {
        alert(`User role updated to ${newRole}. The user will see the changes after refreshing their page.`)
      }
      
    } catch (err) {
      console.error('Error updating user role:', err)
      setError(err instanceof Error ? err.message : 'Failed to update user role')
      // Refresh users list to get correct state
      await fetchUsers()
    } finally {
      setUpdatingRole(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error && error.includes('Unauthorized')) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>Access Denied: Admin privileges required</span>
        </div>
      </div>
    )
  }

  const stats = getUserStats()

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Shield className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Admins</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.admins}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Crown className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Organizers</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.organizers}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Regular Users</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.regularUsers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main User Management Panel */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-[#0b6d41]" />
              <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
            </div>
            <button
              onClick={fetchUsers}
              className="p-2 text-gray-600 hover:text-[#0b6d41] hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
          
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
              />
            </div>
            
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'all' | 'user' | 'organizer' | 'admin')}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Roles</option>
                <option value="user">Users</option>
                <option value="organizer">Organizers</option>
                <option value="admin">Admins</option>
              </select>
            </div>
          </div>
          
          <p className="text-gray-600 mt-4">
            Showing {filteredUsers.length} of {stats.total} users
          </p>
        </div>

      <div className="p-6">
        {error && !error.includes('Unauthorized') && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
              <button
                onClick={fetchUsers}
                className="text-red-700 hover:text-red-900"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-gradient-to-br from-[#ffde59] to-[#0b6d41] rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">
                    {user.full_name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-gray-900">
                    {user.full_name || 'No name'}
                  </h3>
                  <p className="text-xs text-gray-600">{user.email}</p>
                  {user.created_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      Joined {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  )}
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'admin' 
                        ? 'bg-red-100 text-red-800'
                        : user.role === 'organizer'
                        ? 'bg-[#ffde59]/20 text-[#0b6d41]'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                      {user.role === 'organizer' && <Crown className="h-3 w-3 mr-1" />}
                      {user.role === 'user' && <User className="h-3 w-3 mr-1" />}
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative role-dropdown">
                  <button
                    onClick={() => setShowRoleDropdown(showRoleDropdown === user.id ? null : user.id)}
                    disabled={updatingRole === user.id}
                    className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                      user.role === 'admin' 
                        ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
                        : user.role === 'organizer'
                        ? 'bg-[#ffde59]/20 text-[#0b6d41] border-[#ffde59] hover:bg-[#ffde59]/30'
                        : 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {user.role === 'admin' ? (
                      <Shield className="h-4 w-4" />
                    ) : user.role === 'organizer' ? (
                      <UserPlus className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                    {updatingRole === user.id ? 'Updating...' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  {showRoleDropdown === user.id && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                      <div className="py-1">
                        <button
                          onClick={() => handleRoleUpdate(user.id, 'user')}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 ${
                            user.role === 'user' ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'text-gray-700'
                          }`}
                          disabled={user.role === 'user'}
                        >
                          <User className="h-4 w-4" />
                          User
                          {user.role === 'user' && <CheckCircle className="h-3 w-3 ml-auto" />}
                        </button>
                        <button
                          onClick={() => handleRoleUpdate(user.id, 'organizer')}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 ${
                            user.role === 'organizer' ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'text-gray-700'
                          }`}
                          disabled={user.role === 'organizer'}
                        >
                          <UserPlus className="h-4 w-4" />
                          Organizer
                          {user.role === 'organizer' && <CheckCircle className="h-3 w-3 ml-auto" />}
                        </button>
                        <button
                          onClick={() => handleRoleUpdate(user.id, 'admin')}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 ${
                            user.role === 'admin' ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'text-gray-700'
                          }`}
                          disabled={user.role === 'admin'}
                        >
                          <Shield className="h-4 w-4" />
                          Admin
                          {user.role === 'admin' && <CheckCircle className="h-3 w-3 ml-auto" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredUsers.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            {searchTerm || roleFilter !== 'all' ? 'No users match your search criteria' : 'No users found'}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}