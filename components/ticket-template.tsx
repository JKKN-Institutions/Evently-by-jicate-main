'use client'

import { useEffect, useState } from 'react'
import { Calendar, MapPin, Clock, User, Ticket } from 'lucide-react'
import { formatDate, formatTime } from '@/lib/utils'
// Lazy load QR code generation
const generateQRCodeDataURL = async (data: string) => {
  const { generateQRCodeDataURL: qrGen } = await import('@/lib/qr-code')
  return qrGen(data)
}

// Lazy load heavy PDF generation
const generatePDF = async () => {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ])
  return { html2canvas, jsPDF }
}

interface TicketData {
  id: string
  ticket_number: string
  qr_code: string
  event: {
    title: string
    date: string
    time: string
    venue: string
    location: string
  }
  booking: {
    user_name: string
    user_email: string
  }
}

interface TicketTemplateProps {
  ticket: TicketData
  onDownload?: () => void
}

export default function TicketTemplate({ ticket, onDownload }: TicketTemplateProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')

  useEffect(() => {
    // Generate QR code
    generateQRCodeDataURL(ticket.qr_code).then(setQrCodeUrl).catch(console.error)
  }, [ticket.qr_code])

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = async () => {
    try {
      // Use the new enhanced ticket template download API
      const response = await fetch('/api/tickets/download-with-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId: ticket.id,
          format: 'pdf'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to download ticket')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ticket-${ticket.ticket_number}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      onDownload?.()
    } catch (error) {
      console.error('Error downloading ticket:', error)
      alert('Failed to download ticket. Please try again.')
    }
  }

  const downloadQRCode = async (format: 'png' | 'svg') => {
    try {
      const response = await fetch(`/api/tickets/${ticket.id}/qr-download?format=${format}&size=512`)
      
      if (!response.ok) {
        throw new Error('Failed to download QR code')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ticket-${ticket.ticket_number}-qr.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading QR code:', error)
      alert('Failed to download QR code. Please try again.')
    }
  }

  return (
    <>
      {/* Ticket Container */}
      <div
        id={`ticket-${ticket.id}`}
        className="bg-white border-2 border-gray-300 rounded-lg shadow-lg max-w-2xl mx-auto overflow-hidden print:shadow-none"
      >
        <div className="flex flex-col md:flex-row">
          {/* Left Section - Event Details */}
          <div className="flex-1 p-6 border-r-2 border-dashed border-gray-300">
            <div className="mb-4">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <Ticket className="h-5 w-5" />
                <span className="text-sm font-semibold">EVENT TICKET</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{ticket.event.title}</h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-gray-700">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span>{formatDate(ticket.event.date)}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Clock className="h-4 w-4 text-gray-500" />
                <span>{formatTime(ticket.event.time)}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <MapPin className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="font-semibold">{ticket.event.venue}</div>
                  <div className="text-gray-600">{ticket.event.location}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <User className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="font-semibold">{ticket.booking.user_name}</div>
                  <div className="text-gray-600">{ticket.booking.user_email}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">Ticket Number</div>
              <div className="font-mono text-sm font-semibold">{ticket.ticket_number}</div>
            </div>
          </div>

          {/* Right Section - QR Code */}
          <div className="w-full md:w-48 p-6 flex flex-col items-center justify-center bg-gray-50">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="Ticket QR Code" className="w-40 h-40" />
            ) : (
              <div className="w-40 h-40 bg-gray-200 animate-pulse rounded" />
            )}
            <p className="text-xs text-gray-600 mt-2 text-center">
              Scan this code at the venue
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-100 px-6 py-3 text-xs text-gray-600 flex justify-between items-center">
          <span>Powered by Evently</span>
          <span>Valid for one-time entry only</span>
        </div>
      </div>

      {/* Action Buttons (not printed) */}
      <div className="mt-6 flex flex-wrap justify-center gap-3 print:hidden">
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Ticket
        </button>
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download PDF
        </button>
        <button
          onClick={() => downloadQRCode('png')}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          QR PNG
        </button>
        <button
          onClick={() => downloadQRCode('svg')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          QR SVG
        </button>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #ticket-${ticket.id}, #ticket-${ticket.id} * {
            visibility: visible;
          }
          #ticket-${ticket.id} {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </>
  )
}
