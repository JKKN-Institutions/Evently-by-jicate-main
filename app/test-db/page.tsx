'use client'

import { useState } from 'react'

export default function TestDBPage() {
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const runDiagnostics = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/tickets/diagnose')
      const data = await response.json()
      setResults(data)
    } catch (error) {
      setResults({ error: String(error) })
    }
    setLoading(false)
  }

  const testForceGeneration = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/tickets/generate-force', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: 'b2cf7824-9b3e-488e-a0ca-f9a7fff039ae', // Use your event ID
          quantity: 1
        })
      })
      const data = await response.json()
      setResults(data)
    } catch (error) {
      setResults({ error: String(error) })
    }
    setLoading(false)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Database Test Page</h1>
      
      <div className="space-y-4 mb-6">
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Run Diagnostics
        </button>
        
        <button
          onClick={testForceGeneration}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 ml-4"
        >
          Test Force Generation
        </button>
      </div>

      {loading && <p>Loading...</p>}

      {results && (
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-bold mb-2">Results:</h2>
          <pre className="whitespace-pre-wrap text-sm">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}