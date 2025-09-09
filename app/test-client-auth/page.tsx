'use client'

import { ClientAuthProvider, useClientAuth } from '@/contexts/client-auth-context'

function AuthDebugContent() {
  const { user, profile, loading, error } = useClientAuth()
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Client Auth Debug</h1>
      
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-2">Auth State:</h2>
          <pre className="text-xs overflow-auto bg-gray-50 p-2 rounded">
            {JSON.stringify({ 
              loading, 
              error,
              user: user ? { id: user.id, email: user.email } : null,
              profile 
            }, null, 2)}
          </pre>
        </div>
        
        {profile && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h2 className="font-semibold text-green-800 mb-2">Profile Loaded Successfully!</h2>
            <p>Email: {profile.email}</p>
            <p>Role: <strong className="text-green-600">{profile.role}</strong></p>
            <p>Name: {profile.full_name}</p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <h2 className="font-semibold text-red-800 mb-2">Error:</h2>
            <p className="text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TestClientAuthPage() {
  return (
    <ClientAuthProvider>
      <AuthDebugContent />
    </ClientAuthProvider>
  )
}