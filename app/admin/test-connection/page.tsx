'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react'

export default function TestConnectionPage() {
  const [results, setResults] = useState<any>({})
  const [testing, setTesting] = useState(false)

  const runTests = async () => {
    setTesting(true)
    const testResults: any = {}
    const supabase = createClient()

    // Test 1: Check if Supabase client is created
    try {
      testResults.clientCreated = { 
        success: true, 
        message: 'Supabase client created successfully',
        url: process.env.NEXT_PUBLIC_SUPABASE_URL
      }
    } catch (error: any) {
      testResults.clientCreated = { 
        success: false, 
        message: error.message 
      }
    }

    // Test 2: Check authentication
    try {
      console.log('Testing authentication...')
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      
      testResults.auth = {
        success: true,
        message: session ? `Authenticated as: ${session.user.email}` : 'No active session',
        hasSession: !!session,
        userId: session?.user?.id
      }
    } catch (error: any) {
      testResults.auth = {
        success: false,
        message: `Auth error: ${error.message}`
      }
    }

    // Test 3: Check current user
    try {
      console.log('Getting current user...')
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      
      testResults.currentUser = {
        success: true,
        message: user ? `Current user: ${user.email}` : 'No user logged in',
        hasUser: !!user
      }
    } catch (error: any) {
      testResults.currentUser = {
        success: false,
        message: `User error: ${error.message}`
      }
    }

    // Test 4: Check profile access
    if (testResults.currentUser?.hasUser) {
      try {
        console.log('Fetching user profile...')
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          
          if (error) throw error
          
          testResults.profile = {
            success: true,
            message: `Profile found: ${profile.email} (${profile.role})`,
            role: profile.role
          }
        }
      } catch (error: any) {
        testResults.profile = {
          success: false,
          message: `Profile error: ${error.message}`
        }
      }
    }

    // Test 5: Test profiles table query
    try {
      console.log('Testing profiles table query...')
      const { data, error, count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
      
      if (error) throw error
      
      testResults.profilesTable = {
        success: true,
        message: `Profiles table accessible. Total count: ${count}`,
        count: count
      }
    } catch (error: any) {
      testResults.profilesTable = {
        success: false,
        message: `Table error: ${error.message}`
      }
    }

    // Test 6: Test fetching users (with limit)
    try {
      console.log('Fetching users with limit...')
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role')
        .limit(5)
      
      if (error) throw error
      
      testResults.fetchUsers = {
        success: true,
        message: `Successfully fetched ${data?.length || 0} users`,
        users: data
      }
    } catch (error: any) {
      testResults.fetchUsers = {
        success: false,
        message: `Fetch error: ${error.message}`
      }
    }

    // Test 7: Test role_assignments table - ALL records
    try {
      console.log('Testing role_assignments table...')
      const { data, error } = await supabase
        .from('role_assignments')
        .select('*')
      
      if (error) throw error
      
      testResults.roleAssignmentsAll = {
        success: true,
        message: `Role assignments table accessible. Total records: ${data?.length || 0}`,
        data: data,
        count: data?.length || 0
      }
    } catch (error: any) {
      testResults.roleAssignmentsAll = {
        success: false,
        message: `Role assignments error: ${error.message}`,
        code: error.code,
        details: error.details
      }
    }

    // Test 8: Test role_assignments - Event Controllers only
    try {
      console.log('Testing event controllers in role_assignments...')
      const { data, error } = await supabase
        .from('role_assignments')
        .select('*')
        .eq('role_type', 'event_controller')
        .eq('is_active', true)
      
      if (error) throw error
      
      testResults.eventControllers = {
        success: true,
        message: `Event controllers found: ${data?.length || 0}`,
        data: data,
        count: data?.length || 0
      }
    } catch (error: any) {
      testResults.eventControllers = {
        success: false,
        message: `Event controllers error: ${error.message}`,
        code: error.code,
        details: error.details
      }
    }

    // Test 9: Test current user's event controller assignments
    if (testResults.auth?.userId) {
      try {
        const userId = testResults.auth.userId
        console.log('Testing current user event controller assignments for:', userId)
        const { data, error } = await supabase
          .from('role_assignments')
          .select('*')
          .eq('user_id', userId)
          .eq('role_type', 'event_controller')
          .eq('is_active', true)
        
        if (error) throw error
        
        testResults.userEventControllerAssignments = {
          success: true,
          message: `User has ${data?.length || 0} event controller assignments`,
          data: data,
          userId: userId,
          count: data?.length || 0
        }
      } catch (error: any) {
        testResults.userEventControllerAssignments = {
          success: false,
          message: `User assignments error: ${error.message}`,
          code: error.code,
          details: error.details
        }
      }
    }

    // Test 10: Test events table
    try {
      console.log('Testing events table...')
      const { data, error } = await supabase
        .from('events')
        .select('id, title')
        .limit(10)
      
      if (error) throw error
      
      testResults.eventsTable = {
        success: true,
        message: `Events table accessible. Sample events: ${data?.length || 0}`,
        data: data,
        count: data?.length || 0
      }
    } catch (error: any) {
      testResults.eventsTable = {
        success: false,
        message: `Events error: ${error.message}`,
        code: error.code,
        details: error.details
      }
    }

    setResults(testResults)
    setTesting(false)
  }

  useEffect(() => {
    runTests()
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Supabase Connection Test</h1>
          <button
            onClick={runTests}
            disabled={testing}
            className="px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#085530] disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Testing...' : 'Run Tests'}
          </button>
        </div>

        <div className="space-y-4">
          {Object.entries(results).map(([key, result]: [string, any]) => (
            <div key={key} className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{result.message}</p>
                  {(result.users || result.data) && (
                    <div className="mt-2 text-xs">
                      <pre className="bg-gray-100 p-2 rounded overflow-x-auto max-h-40">
                        {JSON.stringify(result.users || result.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {Object.keys(results).length === 0 && !testing && (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-2" />
            <p>Click "Run Tests" to check Supabase connection</p>
          </div>
        )}
      </div>
    </div>
  )
}