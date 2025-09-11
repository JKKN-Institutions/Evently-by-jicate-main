'use client'

import { useAuth } from '@/contexts/auth-context'
import { useState } from 'react'

export default function TestSignOut() {
  const { user, profile, signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignOut = async () => {
    console.log('🚪 Test Sign Out - Button clicked')
    setIsSigningOut(true)
    setError(null)
    
    try {
      console.log('🚪 Test Sign Out - Calling signOut function')
      await signOut()
      console.log('✅ Test Sign Out - Sign out successful')
    } catch (err) {
      console.error('❌ Test Sign Out - Error:', err)
      setError(err instanceof Error ? err.message : 'Sign out failed')
      setIsSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Sign Out Test Page</h1>
        
        <div className="mb-6 p-4 bg-gray-50 rounded">
          <h2 className="font-semibold mb-2">Current Auth State:</h2>
          <p>User: {user ? user.email : 'Not logged in'}</p>
          <p>Profile: {profile ? `${profile.email} (${profile.role})` : 'No profile'}</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
            Error: {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleSignOut}
            disabled={isSigningOut || !user}
            className={`px-6 py-3 rounded font-medium transition-colors ${
              isSigningOut || !user
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </button>

          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
          >
            Refresh Page
          </button>
        </div>

        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <h3 className="font-semibold mb-2">Debug Info:</h3>
          <p className="text-sm">Check the browser console for detailed logs</p>
          <p className="text-sm">signOut function available: {signOut ? 'Yes' : 'No'}</p>
          <p className="text-sm">User authenticated: {user ? 'Yes' : 'No'}</p>
        </div>
      </div>
    </div>
  )
}