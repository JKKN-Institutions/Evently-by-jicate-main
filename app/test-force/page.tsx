'use client'

import { useState } from 'react'

export default function TestForcePage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [eventId, setEventId] = useState('b2cf7824-9b3e-488e-a0ca-f9a7fff039ae')
  const [quantity, setQuantity] = useState(1)

  const generateTickets = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      console.log('Calling force generation endpoint...')
      const response = await fetch('/api/tickets/generate-force', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: eventId,
          quantity: quantity,
          template: {
            layoutStyle: 'modern',
            themeColor: '#0b6d41'
          }
        })
      })
      
      const data = await response.json()
      console.log('Force generation response:', data)
      setResult(data)
      
      if (data.success) {
        alert(`✅ Generated ${data.tickets?.length || 0} tickets!`)
      }
    } catch (error) {
      console.error('Error:', error)
      setResult({ error: String(error) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Force Ticket Generation Test</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-sm">
          This page tests the force generation method which bypasses database constraints.
          It will create simulated tickets if real tickets cannot be created.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Event ID</label>
          <input
            type="text"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Enter event ID"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Quantity</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            min="1"
            max="10"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <button
          onClick={generateTickets}
          disabled={loading || !eventId}
          className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating...' : 'Generate Tickets (Force Method)'}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Result:</h2>
          
          {result.success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="font-medium text-green-800">{result.message}</p>
              {result.note && <p className="text-sm text-green-600 mt-1">{result.note}</p>}
            </div>
          )}

          {result.warning && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">{result.warning}</p>
            </div>
          )}

          {result.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{result.error}</p>
            </div>
          )}

          {result.tickets && result.tickets.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Generated Tickets:</h3>
              <div className="space-y-2">
                {result.tickets.map((ticket: any, index: number) => (
                  <div key={index} className="bg-gray-50 p-3 rounded border">
                    <p className="font-mono text-sm">{ticket.ticket_number}</p>
                    <p className="text-xs text-gray-600">
                      Status: {ticket.status} | Via: {ticket.created_via}
                    </p>
                    {ticket.metadata?.note && (
                      <p className="text-xs text-yellow-600 mt-1">{ticket.metadata.note}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-600">Full Response (Debug)</summary>
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}