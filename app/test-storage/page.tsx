'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { checkStorageHealth } from '@/lib/supabase/storage-helper'

export default function TestStoragePage() {
  const [status, setStatus] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [testResult, setTestResult] = useState<string>('')

  useEffect(() => {
    checkStorage()
  }, [])

  const checkStorage = async () => {
    setLoading(true)
    const supabase = createClient()
    
    try {
      // 1. Check authentication
      const { data: { user } } = await supabase.auth.getUser()
      
      // 2. Check storage health
      const health = await checkStorageHealth()
      
      // 3. Try to list buckets
      let buckets = []
      let bucketError = null
      try {
        const { data, error } = await supabase.storage.listBuckets()
        buckets = data || []
        bucketError = error
      } catch (err) {
        bucketError = err
      }

      setStatus({
        authenticated: !!user,
        userId: user?.id || 'Not logged in',
        storageHealth: health,
        buckets: buckets,
        bucketError: bucketError?.message || null,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
      })
    } catch (error) {
      setStatus({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  const runStorageTest = async () => {
    setTestResult('Testing...')
    const supabase = createClient()
    
    try {
      // Create a test file
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const testPath = `test-${Date.now()}.txt`
      
      // Try to upload
      const { data, error } = await supabase.storage
        .from('event-images')
        .upload(testPath, testFile)
      
      if (error) {
        setTestResult(`❌ Upload failed: ${error.message}`)
        return
      }
      
      // Try to get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('event-images')
        .getPublicUrl(testPath)
      
      // Try to delete
      const { error: deleteError } = await supabase.storage
        .from('event-images')
        .remove([testPath])
      
      if (deleteError) {
        setTestResult(`⚠️ Upload worked but delete failed: ${deleteError.message}`)
        return
      }
      
      setTestResult('✅ Storage is working perfectly!')
      
    } catch (error) {
      setTestResult(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (loading) return <div className="p-8">Loading storage status...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Storage Configuration Test</h1>
        
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Authentication Status */}
          <div>
            <h2 className="text-xl font-semibold mb-2">Authentication</h2>
            <div className="bg-gray-100 p-3 rounded">
              <p className={status.authenticated ? 'text-green-600' : 'text-red-600'}>
                {status.authenticated ? '✅ Authenticated' : '❌ Not authenticated'}
              </p>
              {status.userId && (
                <p className="text-sm text-gray-600">User ID: {status.userId}</p>
              )}
            </div>
          </div>

          {/* Storage Health */}
          <div>
            <h2 className="text-xl font-semibold mb-2">Storage Health</h2>
            <div className="bg-gray-100 p-3 rounded">
              {status.storageHealth && (
                <>
                  <p className={status.storageHealth.isHealthy ? 'text-green-600' : 'text-red-600'}>
                    {status.storageHealth.isHealthy ? '✅ Healthy' : '❌ Not healthy'}
                  </p>
                  <p className="text-sm mt-1">
                    Bucket exists: {status.storageHealth.bucket ? '✅' : '❌'}
                  </p>
                  <p className="text-sm">
                    Can upload: {status.storageHealth.canUpload ? '✅' : '❌'}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    {status.storageHealth.message}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Buckets */}
          <div>
            <h2 className="text-xl font-semibold mb-2">Storage Buckets</h2>
            <div className="bg-gray-100 p-3 rounded">
              {status.bucketError ? (
                <p className="text-red-600">❌ Error: {status.bucketError}</p>
              ) : (
                <>
                  <p className="text-sm text-gray-600">Found {status.buckets?.length || 0} buckets</p>
                  {status.buckets?.map((bucket: any) => (
                    <div key={bucket.id} className="mt-2 p-2 bg-white rounded">
                      <p className="font-mono text-sm">{bucket.id}</p>
                      <p className="text-xs text-gray-500">
                        Public: {bucket.public ? 'Yes' : 'No'} | 
                        Size limit: {(bucket.file_size_limit / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Supabase URL */}
          <div>
            <h2 className="text-xl font-semibold mb-2">Configuration</h2>
            <div className="bg-gray-100 p-3 rounded">
              <p className="text-xs font-mono break-all">{status.supabaseUrl}</p>
            </div>
          </div>

          {/* Test Upload */}
          <div>
            <h2 className="text-xl font-semibold mb-2">Test Upload</h2>
            <button
              onClick={runStorageTest}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Run Storage Test
            </button>
            {testResult && (
              <div className="mt-3 p-3 bg-gray-100 rounded">
                <p>{testResult}</p>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="border-t pt-6">
            <h2 className="text-xl font-semibold mb-2">Fix Instructions</h2>
            <div className="bg-amber-50 border border-amber-200 p-4 rounded">
              <p className="font-semibold text-amber-800 mb-2">If storage is not working:</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Go to your Supabase Dashboard</li>
                <li>Navigate to SQL Editor</li>
                <li>Run the script: <code className="bg-amber-100 px-1">supabase/URGENT-fix-storage-error.sql</code></li>
                <li>Refresh this page and test again</li>
              </ol>
              <div className="mt-4 p-3 bg-white rounded">
                <p className="text-xs font-mono text-gray-600">
                  Project URL: https://sdkdimqmzunfmyawtqfy.supabase.co
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}