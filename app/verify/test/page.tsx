'use client'

import { useState } from 'react'

export default function TestVerifyPage() {
  const [ticketNumber, setTicketNumber] = useState('')
  const [eventId, setEventId] = useState('')

  const testUrls = [
    'http://localhost:3000/verify/ticket/TEST-123456',
    'http://localhost:3000/verify/ticket/EVT20250120-1734-001?event=123',
    'http://localhost:3000/verify/ticket/BB4B-MEWY372X-Q887?event=PRED'
  ]

  const testVerification = async (url: string) => {
    try {
      // Test the verify-simple API
      const response = await fetch('/api/tickets/verify-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrData: url })
      })
      const result = await response.json()
      alert(`URL: ${url}\nResult: ${result.message}`)
    } catch (error) {
      alert(`Error testing ${url}`)
    }
  }

  const buildAndTest = () => {
    const url = `http://localhost:3000/verify/ticket/${ticketNumber}${eventId ? `?event=${eventId}` : ''}`
    testVerification(url)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">QR Verification Test Page</h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Build Custom URL</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Ticket Number</label>
              <input
                type="text"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
                placeholder="e.g., EVT20250120-1734-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Event ID (optional)</label>
              <input
                type="text"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
                placeholder="e.g., 123 or PRED"
              />
            </div>
            <button
              onClick={buildAndTest}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
            >
              Test This URL
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Test Sample URLs</h2>
          <div className="space-y-2">
            {testUrls.map((url, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <code className="text-sm text-blue-600 dark:text-blue-400 break-all">{url}</code>
                <button
                  onClick={() => testVerification(url)}
                  className="ml-4 px-4 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                >
                  Test
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Expected URL Format:</h3>
          <code className="text-sm">http://localhost:3000/verify/ticket/[TICKET_NUMBER]?event=[EVENT_ID]&id=[TICKET_ID]</code>
        </div>
      </div>
    </div>
  )
}