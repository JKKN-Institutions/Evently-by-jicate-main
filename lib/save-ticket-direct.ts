// Direct ticket save utility that bypasses RLS
export async function saveTicketDirect(
  ticketNumber: string,
  eventId?: string | null,
  attendeeName?: string
) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    const response = await fetch(`${baseUrl}/api/tickets/save-direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketNumber,
        eventId: eventId || null,
        attendeeName: attendeeName || 'Guest'
      })
    })
    
    const result = await response.json()
    
    if (result.success) {
      console.log(`✓ Ticket ${ticketNumber} saved to database`)
      return true
    } else {
      console.error('Failed to save ticket:', result.error)
      return false
    }
  } catch (error) {
    console.error('Error saving ticket:', error)
    return false
  }
}