import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import JSZip from 'jszip'

// Simplified PDF generation for performance
function generateSimpleTicketHTML(ticket: any, event: any, template: any): string {
  const primaryColor = template?.themeColor || '#0b6d41'
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ticket ${ticket.ticket_number}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .ticket {
      background: white;
      border-radius: 10px;
      padding: 30px;
      max-width: 600px;
      margin: 0 auto;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header {
      background: ${primaryColor};
      color: white;
      padding: 20px;
      margin: -30px -30px 20px -30px;
      border-radius: 10px 10px 0 0;
      text-align: center;
    }
    .title {
      font-size: 24px;
      font-weight: bold;
      margin: 0;
    }
    .event-info {
      font-size: 14px;
      margin-top: 10px;
      opacity: 0.9;
    }
    .ticket-number {
      font-size: 20px;
      font-weight: bold;
      color: ${primaryColor};
      margin: 20px 0;
      padding: 15px;
      background: #f0f8f5;
      border-radius: 5px;
      text-align: center;
    }
    .details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin: 20px 0;
    }
    .detail-item {
      padding: 10px;
      background: #fafafa;
      border-radius: 5px;
    }
    .detail-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
    }
    .detail-value {
      font-size: 14px;
      font-weight: 500;
      color: #333;
    }
    .status {
      display: inline-block;
      padding: 5px 15px;
      background: #10b981;
      color: white;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .qr-section {
      text-align: center;
      margin: 30px 0;
      padding: 20px;
      border: 2px dashed #ddd;
      border-radius: 10px;
    }
    .qr-code {
      font-family: monospace;
      font-size: 10px;
      color: #666;
      word-break: break-all;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="header">
      <h1 class="title">${event?.title || 'Event'}</h1>
      <div class="event-info">
        ${event?.date || ''} | ${event?.time || ''}<br>
        ${event?.venue || ''}
      </div>
    </div>
    
    <div class="ticket-number">
      TICKET: ${ticket.ticket_number || 'N/A'}
    </div>
    
    <div class="details">
      <div class="detail-item">
        <div class="detail-label">Type</div>
        <div class="detail-value">${ticket.ticket_type || 'General'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Level</div>
        <div class="detail-value">${ticket.ticket_level || 'Standard'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Status</div>
        <div class="detail-value">
          <span class="status">${ticket.status || 'Active'}</span>
        </div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Booking ID</div>
        <div class="detail-value">${ticket.booking_id?.slice(0, 8) || 'N/A'}</div>
      </div>
    </div>
    
    ${template?.includeQRCode !== false ? `
    <div class="qr-section">
      <div style="font-size: 14px; color: #666; margin-bottom: 10px;">QR Code</div>
      <div class="qr-code">${ticket.qr_code || ticket.ticket_number || 'N/A'}</div>
      <div style="font-size: 11px; color: #999; margin-top: 10px;">Scan at venue for entry</div>
    </div>
    ` : ''}
    
    <div class="footer">
      Generated with Evently | ${new Date().toLocaleDateString()}
    </div>
  </div>
</body>
</html>
  `
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { ticketIds, eventId, template } = await request.json()

    if (!ticketIds || ticketIds.length === 0) {
      return NextResponse.json({ error: 'No tickets selected' }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`Starting bulk download for ${ticketIds.length} tickets`)

    // Process tickets in chunks to avoid memory issues
    const CHUNK_SIZE = 50
    const chunks = []
    for (let i = 0; i < ticketIds.length; i += CHUNK_SIZE) {
      chunks.push(ticketIds.slice(i, i + CHUNK_SIZE))
    }

    // Fetch event details once
    let event = null
    if (eventId) {
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()
      event = eventData
    }

    // Create ZIP file with compression settings optimized for many files
    const zip = new JSZip()
    
    let processedCount = 0
    let errorCount = 0

    // Process each chunk
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} tickets)`)
      
      // Fetch tickets for this chunk
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('*')
        .in('id', chunk)

      if (ticketsError) {
        console.error(`Error fetching chunk ${chunkIndex + 1}:`, ticketsError)
        errorCount += chunk.length
        continue
      }

      // Generate HTML files for each ticket (much faster than PDF)
      for (const ticket of tickets || []) {
        try {
          // If no event was provided, try to get it from the ticket
          if (!event && ticket.event_id) {
            const { data: ticketEvent } = await supabase
              .from('events')
              .select('*')
              .eq('id', ticket.event_id)
              .single()
            if (ticketEvent) {
              event = ticketEvent
            }
          }

          const htmlContent = generateSimpleTicketHTML(
            ticket,
            event || { title: 'Event' },
            template || {}
          )
          
          // Add HTML file to ZIP (much smaller than PDF)
          const fileName = `ticket-${ticket.ticket_number || ticket.id}.html`
          zip.file(fileName, htmlContent)
          processedCount++
        } catch (error) {
          console.error(`Error processing ticket ${ticket.id}:`, error)
          errorCount++
        }
      }

      // Small delay between chunks to prevent overwhelming the system
      if (chunkIndex < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`Processed ${processedCount} tickets successfully, ${errorCount} errors`)

    // Add a manifest file
    const manifest = {
      event: event?.title || 'Event',
      date: new Date().toISOString(),
      requestedCount: ticketIds.length,
      processedCount: processedCount,
      errorCount: errorCount,
      format: 'HTML',
      note: 'Open HTML files in any browser to view or print tickets'
    }
    zip.file('README.txt', `
Ticket Download Summary
=======================
Event: ${manifest.event}
Date: ${manifest.date}
Total Tickets: ${manifest.processedCount}
Format: HTML

How to use:
1. Extract this ZIP file
2. Open any HTML file in your web browser
3. Use browser's print function (Ctrl+P) to print or save as PDF
4. For bulk printing, select multiple HTML files and print

Note: HTML files are provided for better performance with large quantities.
`)
    zip.file('manifest.json', JSON.stringify(manifest, null, 2))

    // Generate ZIP file as base64 for better compatibility
    const zipBase64 = await zip.generateAsync({
      type: 'base64',
      compression: 'DEFLATE',
      compressionOptions: { 
        level: 6 // Balanced compression (1-9, where 9 is slowest but smallest)
      }
    })
    
    // Convert base64 to buffer
    const zipBuffer = Buffer.from(zipBase64, 'base64')

    // Return ZIP file with appropriate headers
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="tickets-${processedCount}-${Date.now()}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
        'X-Processed-Count': processedCount.toString(),
        'X-Error-Count': errorCount.toString()
      }
    })

  } catch (error) {
    console.error('Bulk download error:', error)
    return NextResponse.json({
      error: 'Failed to generate bulk download',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}