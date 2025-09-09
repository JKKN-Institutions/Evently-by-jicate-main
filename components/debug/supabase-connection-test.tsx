'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle, Database, Users, RefreshCw } from 'lucide-react'

export function SupabaseConnectionTest() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const runTests = async () => {
    setLoading(true)
    setResults([])
    const testResults: any[] = []
    
    try {
      const supabase = createClient()

      // Test 1: Check authentication
      testResults.push({ test: 'Authentication Check', status: 'running' })
      
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        testResults[testResults.length - 1] = {
          test: 'Authentication Check',
          status: 'error',
          message: `Auth error: ${authError.message}`
        }
      } else if (user) {
        testResults[testResults.length - 1] = {
          test: 'Authentication Check',
          status: 'success',
          message: `Authenticated as: ${user.email}`
        }
      } else {
        testResults[testResults.length - 1] = {
          test: 'Authentication Check',
          status: 'warning',
          message: 'Not authenticated'
        }
      }

      // Test 2: Check profiles table access
      testResults.push({ test: 'Profiles Table Access', status: 'running' })
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, role')
        .limit(1)

      if (profilesError) {
        testResults[testResults.length - 1] = {
          test: 'Profiles Table Access',
          status: 'error',
          message: `Profiles error: ${profilesError.message} (Code: ${profilesError.code})`
        }
      } else {
        testResults[testResults.length - 1] = {
          test: 'Profiles Table Access',
          status: 'success',
          message: `Can access profiles table. Found ${profilesData?.length || 0} records`
        }
      }

      // Test 3: Check current user profile
      if (user) {
        testResults.push({ test: 'Current User Profile', status: 'running' })
        
        const { data: currentProfile, error: currentProfileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (currentProfileError) {
          testResults[testResults.length - 1] = {
            test: 'Current User Profile',
            status: 'error',
            message: `Profile error: ${currentProfileError.message}`,
            details: currentProfileError
          }
        } else if (currentProfile) {
          testResults[testResults.length - 1] = {
            test: 'Current User Profile',
            status: 'success',
            message: `Profile found: ${currentProfile.email} (${currentProfile.role})`,
            details: currentProfile
          }
        } else {
          testResults[testResults.length - 1] = {
            test: 'Current User Profile',
            status: 'warning',
            message: 'No profile found for current user'
          }
        }
      }

      // Test 4: Check profiles table count
      testResults.push({ test: 'Profiles Table Count', status: 'running' })
      
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      if (countError) {
        testResults[testResults.length - 1] = {
          test: 'Profiles Table Count',
          status: 'error',
          message: `Count error: ${countError.message}`
        }
      } else {
        testResults[testResults.length - 1] = {
          test: 'Profiles Table Count',
          status: 'success',
          message: `Total profiles in database: ${count || 0}`
        }
      }

      // Test 5: Check RLS policies
      testResults.push({ test: 'RLS Policy Check', status: 'running' })
      
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from('profiles')
        .select('id, email, role, created_at')
        .order('created_at', { ascending: false })

      if (allProfilesError) {
        testResults[testResults.length - 1] = {
          test: 'RLS Policy Check',
          status: 'error',
          message: `RLS error: ${allProfilesError.message}`,
          details: 'This might indicate RLS policies are too restrictive'
        }
      } else {
        testResults[testResults.length - 1] = {
          test: 'RLS Policy Check',
          status: 'success',
          message: `Can fetch ${allProfiles?.length || 0} profiles`,
          details: allProfiles
        }
      }

      // Test 6: Check table structure
      testResults.push({ test: 'Table Structure Check', status: 'running' })
      
      try {
        const { data: structureData } = await supabase.rpc('get_table_info', { table_name: 'profiles' }).single()
        testResults[testResults.length - 1] = {
          test: 'Table Structure Check',
          status: 'success',
          message: 'Table structure accessible',
          details: structureData
        }
      } catch (structureError) {
        testResults[testResults.length - 1] = {
          test: 'Table Structure Check',
          status: 'warning',
          message: 'Could not fetch table structure (this is usually fine)',
          details: structureError
        }
      }

    } catch (error) {
      testResults.push({
        test: 'General Error',
        status: 'error',
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      })
    }

    setResults(testResults)
    setLoading(false)
  }

  useEffect(() => {
    runTests()
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Database className="h-6 w-6" />
          Supabase Connection Test
        </h2>
        <button
          onClick={runTests}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Testing...' : 'Run Tests'}
        </button>
      </div>

      <div className="space-y-4">
        {results.map((result, index) => (
          <div
            key={index}
            className={`p-4 border rounded-lg ${
              result.status === 'success'
                ? 'border-green-200 bg-green-50'
                : result.status === 'error'
                ? 'border-red-200 bg-red-50'
                : result.status === 'warning'
                ? 'border-yellow-200 bg-yellow-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {result.status === 'success' && <CheckCircle className="h-5 w-5 text-green-600" />}
              {result.status === 'error' && <AlertCircle className="h-5 w-5 text-red-600" />}
              {result.status === 'warning' && <AlertCircle className="h-5 w-5 text-yellow-600" />}
              {result.status === 'running' && <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />}
              
              <span className="font-semibold text-gray-900">{result.test}</span>
            </div>
            
            <p className="text-gray-700 mb-2">{result.message}</p>
            
            {result.details && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                  Show Details
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(result.details, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>

      {results.length === 0 && loading && (
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-gray-600">Running connection tests...</p>
        </div>
      )}
    </div>
  )
}