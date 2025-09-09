'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, AlertCircle, Loader2, Ticket, Calendar, MapPin, User } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface TicketDetails {
  ticket_number: string
  event_title: string
  event_date: string
  event_time: string
  venue: string
  status: string
  ticket_type: string
  seat_number?: string
  row_number?: string
  section?: string
  verified_at?: string
  verified_by?: string
}

export default function TicketVerificationPage({ 
  params 
}: { 
  params: Promise<{ ticketNumber: string }>
}) {
  const resolvedParams = use(params)
  const ticketNumber = decodeURIComponent(resolvedParams.ticketNumber)
  const searchParams = useSearchParams()
  const eventId = searchParams.get('event')
  const ticketId = searchParams.get('id')
  
  const [isVerifying, setIsVerifying] = useState(true)
  const [ticketDetails, setTicketDetails] = useState<TicketDetails | null>(null)
  const [verificationStatus, setVerificationStatus] = useState<'valid' | 'used' | 'invalid' | 'expired' | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    verifyTicket()
  }, [ticketNumber, eventId, ticketId])

  const verifyTicket = async () => {
    try {
      setIsVerifying(true)
      setErrorMessage(null)

      // Build the QR data (URL format)
      const qrData = `${window.location.origin}/verify/ticket/${ticketNumber}${eventId ? `?event=${eventId}` : ''}${ticketId ? `&id=${ticketId}` : ''}`
      
      // Call simple verification API
      const response = await fetch('/api/tickets/verify-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrData })
      })

      const result = await response.json()

      if (!result.success) {
        setVerificationStatus(result.status === 'used' ? 'used' : 'invalid')
        setErrorMessage(result.message)
        return
      }

      // If verified, fetch full ticket details
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          *,
          bookings (
            user_name,
            user_email,
            user_phone
          ),
          events (
            title,
            date,
            time,
            venue,
            description
          )
        `)
        .eq('ticket_number', ticketNumber)
        .single()

      if (ticketError || !ticket) {
        setVerificationStatus('invalid')
        setErrorMessage('TICKET NOT AVAILABLE')
        return
      }

      // Verify event ID matches if provided
      if (eventId && ticket.event_id !== eventId) {
        setVerificationStatus('invalid')
        setErrorMessage('Ticket does not belong to this event')
        return
      }

      // Set ticket details for display
      setTicketDetails({
        ticket_number: ticket.ticket_number,
        event_title: ticket.events?.title || 'Unknown Event',
        event_date: ticket.events?.date || '',
        event_time: ticket.events?.time || '',
        venue: ticket.events?.venue || '',
        status: ticket.status,
        ticket_type: ticket.ticket_type || 'General',
        seat_number: ticket.seat_number,
        row_number: ticket.row_number,
        section: ticket.section,
        verified_at: ticket.verified_at,
        verified_by: ticket.verified_by
      })

      // Check ticket status
      if (ticket.status === 'used') {
        setVerificationStatus('used')
        setErrorMessage(`Ticket was already verified on ${new Date(ticket.verified_at).toLocaleString()}`)
      } else if (ticket.status === 'expired') {
        setVerificationStatus('expired')
        setErrorMessage('This ticket has expired')
      } else if (ticket.status === 'cancelled') {
        setVerificationStatus('invalid')
        setErrorMessage('This ticket has been cancelled')
      } else {
        setVerificationStatus('valid')
        
        // Auto-verify if accessed from QR code scan
        if (typeof window !== 'undefined') {
          const isFromQRScan = document.referrer === '' || 
                              !document.referrer.includes(window.location.hostname)
          
          if (isFromQRScan) {
            // Mark ticket as used
            await supabase
              .from('tickets')
              .update({
                status: 'used',
                verified_at: new Date().toISOString(),
                verified_by: 'QR Scanner'
              })
              .eq('id', ticket.id)
            
            setVerificationStatus('used')
            setTicketDetails(prev => prev ? {
              ...prev,
              status: 'used',
              verified_at: new Date().toISOString(),
              verified_by: 'QR Scanner'
            } : null)
          }
        }
      }
    } catch (error) {
      console.error('Error verifying ticket:', error)
      setVerificationStatus('invalid')
      setErrorMessage('An error occurred while verifying the ticket')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleManualVerify = async () => {
    if (!ticketDetails || verificationStatus !== 'valid') return

    try {
      setIsVerifying(true)
      
      const { error } = await supabase
        .from('tickets')
        .update({
          status: 'used',
          verified_at: new Date().toISOString(),
          verified_by: 'Manual Verification'
        })
        .eq('ticket_number', ticketNumber)

      if (!error) {
        setVerificationStatus('used')
        setTicketDetails(prev => prev ? {
          ...prev,
          status: 'used',
          verified_at: new Date().toISOString(),
          verified_by: 'Manual Verification'
        } : null)
      }
    } catch (error) {
      console.error('Error marking ticket as used:', error)
    } finally {
      setIsVerifying(false)
    }
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Verifying Ticket...
          </h2>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Verification Status Card */}
        <div className={`rounded-lg shadow-lg overflow-hidden mb-6 ${
          verificationStatus === 'valid' ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500' :
          verificationStatus === 'used' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-500' :
          'bg-red-50 dark:bg-red-900/20 border-2 border-red-500'
        }`}>
          <div className="p-6">
            <div className="flex items-center justify-center mb-4">
              {verificationStatus === 'valid' ? (
                <CheckCircle className="h-16 w-16 text-green-500" />
              ) : verificationStatus === 'used' ? (
                <AlertCircle className="h-16 w-16 text-yellow-500" />
              ) : (
                <XCircle className="h-16 w-16 text-red-500" />
              )}
            </div>
            
            <h1 className="text-2xl font-bold text-center mb-2">
              {verificationStatus === 'valid' ? 'Valid Ticket' :
               verificationStatus === 'used' ? 'Ticket Already Used' :
               verificationStatus === 'expired' ? 'Expired Ticket' :
               'Invalid Ticket'}
            </h1>
            
            {errorMessage && (
              <p className="text-center text-gray-600 dark:text-gray-400">
                {errorMessage}
              </p>
            )}
          </div>
        </div>

        {/* Ticket Details Card */}
        {ticketDetails && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
              <div className="flex items-center text-white">
                <Ticket className="h-6 w-6 mr-2" />
                <span className="font-semibold text-lg">{ticketDetails.ticket_number}</span>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {ticketDetails.event_title}
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start">
                  <Calendar className="h-5 w-5 text-gray-400 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Date & Time</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(ticketDetails.event_date).toLocaleDateString()}
                      {ticketDetails.event_time && ` at ${ticketDetails.event_time}`}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <MapPin className="h-5 w-5 text-gray-400 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Venue</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {ticketDetails.venue}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Seat Information */}
              {(ticketDetails.seat_number || ticketDetails.section) && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Seating Information</p>
                  <div className="grid grid-cols-3 gap-2">
                    {ticketDetails.section && (
                      <div>
                        <p className="text-xs text-gray-500">Section</p>
                        <p className="font-medium">{ticketDetails.section}</p>
                      </div>
                    )}
                    {ticketDetails.row_number && (
                      <div>
                        <p className="text-xs text-gray-500">Row</p>
                        <p className="font-medium">{ticketDetails.row_number}</p>
                      </div>
                    )}
                    {ticketDetails.seat_number && (
                      <div>
                        <p className="text-xs text-gray-500">Seat</p>
                        <p className="font-medium">{ticketDetails.seat_number}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Ticket Type */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Ticket Type</span>
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                    {ticketDetails.ticket_type}
                  </span>
                </div>
              </div>
              
              {/* Verification Info */}
              {ticketDetails.verified_at && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Verified on {new Date(ticketDetails.verified_at).toLocaleString()}
                    {ticketDetails.verified_by && ` by ${ticketDetails.verified_by}`}
                  </p>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="px-6 pb-6 space-y-3">
              {verificationStatus === 'valid' && (
                <button
                  onClick={handleManualVerify}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
                >
                  Mark as Used
                </button>
              )}
              
              <Link
                href={eventId ? `/verify/event/${eventId}` : '/admin/verify-tickets'}
                className="block w-full text-center bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium py-3 px-4 rounded-lg transition duration-200"
              >
                Back to Scanner
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}