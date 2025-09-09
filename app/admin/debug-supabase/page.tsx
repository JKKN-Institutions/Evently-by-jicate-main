'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DebugSupabasePage() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const supabase = createClient()

  useEffect(() => {
    runDiagnostics()
  }, [])

  const runDiagnostics = async () => {
    const diagnostics = []
    setLoading(true)

    try {
      // Test 1: Check environment variables
      diagnostics.push({
        test: 'Environment Variables',
        status: 'info',
        result: {
          supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
          supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing'
        }
      })

      // Test 2: Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      diagnostics.push({
        test: 'Authentication',
        status: authError ? 'error' : user ? 'success' : 'warning',
        result: {
          user: user ? { id: user.id, email: user.email } : null,
          error: authError
        }
      })

      // Test 3: Check database connection
      try {
        const { data: tables, error: dbError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .limit(1)

        diagnostics.push({
          test: 'Database Connection',
          status: dbError ? 'error' : 'success',
          result: {
            connected: !dbError,
            error: dbError,
            sample_tables: tables
          }
        })
      } catch (error) {
        diagnostics.push({
          test: 'Database Connection',
          status: 'error',
          result: {
            connected: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      }

      // Test 4: Try to access events table
      try {
        const { data: events, error: eventsError } = await supabase
          .from('events')
          .select('id')
          .limit(1)

        diagnostics.push({
          test: 'Events Table Access',
          status: eventsError ? 'error' : 'success',
          result: {
            accessible: !eventsError,
            error: eventsError,
            sample_data: events
          }
        })
      } catch (error) {
        diagnostics.push({
          test: 'Events Table Access',
          status: 'error',
          result: {
            accessible: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      }

      // Test 5: Try to access events table with specific columns
      try {
        const { data: eventsWithCategory, error: categoryError } = await supabase
          .from('events')
          .select('id, title, date, category')
          .limit(1)

        diagnostics.push({
          test: 'Events Table with Category',
          status: categoryError ? 'error' : 'success',
          result: {
            accessible: !categoryError,
            error: categoryError,
            sample_data: eventsWithCategory
          }
        })
      } catch (error) {
        diagnostics.push({
          test: 'Events Table with Category',
          status: 'error',
          result: {
            accessible: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      }

      // Test 6: Check profiles table
      if (user) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

          diagnostics.push({
            test: 'User Profile Access',
            status: profileError ? 'error' : 'success',
            result: {
              accessible: !profileError,
              error: profileError,
              profile: profile
            }
          })
        } catch (error) {
          diagnostics.push({
            test: 'User Profile Access',
            status: 'error',
            result: {
              accessible: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          })
        }
      }

      setResults(diagnostics)
    } catch (error) {
      diagnostics.push({
        test: 'Overall Diagnostics',
        status: 'error',
        result: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      setResults(diagnostics)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50'
      case 'error': return 'text-red-600 bg-red-50'
      case 'warning': return 'text-yellow-600 bg-yellow-50'
      default: return 'text-blue-600 bg-blue-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      default: return 'ℹ️'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41] mx-auto"></div>
          <p className="mt-4 text-gray-600">Running Supabase diagnostics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Supabase Diagnostics</h1>
              <p className="text-gray-600">Debug Supabase connection and permissions</p>
            </div>
            <button
              onClick={runDiagnostics}
              className="px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors"
            >
              Re-run Tests
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {results.map((result, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getStatusIcon(result.status)}</span>
                  <h2 className="text-lg font-semibold text-gray-900">{result.test}</h2>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(result.status)}`}>
                  {result.status.toUpperCase()}
                </span>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-sm text-gray-700 overflow-auto">
                  {JSON.stringify(result.result, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {results.filter(r => r.status === 'success').length}
              </div>
              <div className="text-sm text-gray-500">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {results.filter(r => r.status === 'error').length}
              </div>
              <div className="text-sm text-gray-500">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {results.filter(r => r.status === 'warning').length}
              </div>
              <div className="text-sm text-gray-500">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {results.filter(r => r.status === 'info').length}
              </div>
              <div className="text-sm text-gray-500">Info</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}