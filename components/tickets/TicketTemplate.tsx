'use client'

import React from 'react'
import QRCode from 'qrcode'
import { Calendar, Clock, MapPin, User, Ticket, Shield, CreditCard } from 'lucide-react'

export interface TicketData {
  // Event Information
  eventName: string
  eventLogo?: string
  eventDate: string
  eventTime: string
  eventEndTime?: string
  venue: string
  venueAddress?: string
  hallRoom?: string
  
  // Ticket Information
  ticketNumber: string
  ticketType: 'General' | 'VIP' | 'Early Bird' | 'Student' | 'Premium' | 'Complimentary'
  seatNumber?: string
  zone?: string
  category?: string
  gateNumber?: string
  entryTime?: string
  
  // Attendee Information
  attendeeName: string
  attendeeEmail?: string
  attendeePhone?: string
  registrationId: string
  
  // Pricing Information
  price: number | 'Free'
  currency?: string
  paymentStatus?: 'Paid' | 'Pending' | 'Complimentary'
  paymentId?: string
  
  // Organization Information
  organizerName: string
  organizerLogo?: string
  organizerContact?: string
  sponsors?: Array<{ name: string; logo?: string }>
  
  // Additional Information
  website?: string
  socialMedia?: {
    facebook?: string
    twitter?: string
    instagram?: string
  }
  
  // Security
  qrData: string
  watermark?: boolean
  hologram?: boolean
  
  // Terms & Conditions
  terms?: string[]
  ageRestriction?: string
  idRequired?: boolean
  nonTransferable?: boolean
}

interface TicketTemplateProps {
  data: TicketData
  variant?: 'standard' | 'vip' | 'premium'
  size?: 'full' | 'compact'
}

export default function TicketTemplate({ data, variant = 'standard', size = 'full' }: TicketTemplateProps) {
  const [qrCodeUrl, setQrCodeUrl] = React.useState<string>('')
  
  // Generate QR code with optimized settings for camera scanning
  React.useEffect(() => {
    QRCode.toDataURL(data.qrData, {
      width: 250, // Increased from 150 to 250 for better camera scanning
      margin: 3, // Increased margin for better detection
      errorCorrectionLevel: 'M', // Medium error correction level for better balance
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      }
    }).then(setQrCodeUrl).catch(console.error)
  }, [data.qrData])
  
  // Get variant styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'vip':
        return 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-500'
      case 'premium':
        return 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-500'
      default:
        return 'bg-white border-gray-300'
    }
  }
  
  const getTicketTypeColor = () => {
    switch (data.ticketType) {
      case 'VIP':
        return 'bg-yellow-500 text-white'
      case 'Premium':
        return 'bg-purple-500 text-white'
      case 'Early Bird':
        return 'bg-green-500 text-white'
      case 'Student':
        return 'bg-blue-500 text-white'
      case 'Complimentary':
        return 'bg-gray-500 text-white'
      default:
        return 'bg-indigo-500 text-white'
    }
  }
  
  if (size === 'compact') {
    return <CompactTicket data={data} qrCodeUrl={qrCodeUrl} />
  }
  
  return (
    <div className={`ticket-container relative ${getVariantStyles()} border-2 rounded-lg shadow-2xl overflow-hidden`}>
      {/* Watermark */}
      {data.watermark && (
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <div className="text-8xl font-bold transform rotate-45">ORIGINAL</div>
        </div>
      )}
      
      {/* Header Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {data.eventLogo && (
              <img 
                src={data.eventLogo} 
                alt="Event Logo" 
                className="h-16 w-16 rounded-lg bg-white p-1"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold">{data.eventName}</h1>
              {data.organizerName && (
                <p className="text-sm opacity-90">Presented by {data.organizerName}</p>
              )}
            </div>
          </div>
          <div className={`px-4 py-2 rounded-full font-semibold ${getTicketTypeColor()}`}>
            {data.ticketType}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="p-6 grid grid-cols-3 gap-6">
        
        {/* Left Section - Event Details */}
        <div className="col-span-2 space-y-4">
          
          {/* Date & Time */}
          <div className="flex items-start gap-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="font-semibold">{data.eventDate}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-600" />
              <div>
                <p className="text-xs text-gray-500">Time</p>
                <p className="font-semibold">
                  {data.eventTime}
                  {data.eventEndTime && ` - ${data.eventEndTime}`}
                </p>
              </div>
            </div>
          </div>
          
          {/* Venue */}
          <div className="flex items-start gap-2">
            <MapPin className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-gray-500">Venue</p>
              <p className="font-semibold">{data.venue}</p>
              {data.venueAddress && (
                <p className="text-sm text-gray-600">{data.venueAddress}</p>
              )}
              <div className="flex gap-4 mt-1">
                {data.hallRoom && (
                  <span className="text-sm">
                    <span className="text-gray-500">Hall:</span> <span className="font-medium">{data.hallRoom}</span>
                  </span>
                )}
                {data.gateNumber && (
                  <span className="text-sm">
                    <span className="text-gray-500">Gate:</span> <span className="font-medium">{data.gateNumber}</span>
                  </span>
                )}
                {data.entryTime && (
                  <span className="text-sm">
                    <span className="text-gray-500">Entry:</span> <span className="font-medium">{data.entryTime}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Attendee Information */}
          <div className="border-t pt-4">
            <div className="flex items-start gap-2">
              <User className="h-5 w-5 text-indigo-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">Attendee Details</p>
                <p className="font-semibold">{data.attendeeName}</p>
                {data.attendeeEmail && (
                  <p className="text-sm text-gray-600">{data.attendeeEmail}</p>
                )}
                <div className="flex gap-4 mt-1">
                  {data.seatNumber && (
                    <span className="text-sm">
                      <span className="text-gray-500">Seat:</span> <span className="font-bold text-lg">{data.seatNumber}</span>
                    </span>
                  )}
                  {data.zone && (
                    <span className="text-sm">
                      <span className="text-gray-500">Zone:</span> <span className="font-medium">{data.zone}</span>
                    </span>
                  )}
                  {data.category && (
                    <span className="text-sm">
                      <span className="text-gray-500">Category:</span> <span className="font-medium">{data.category}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Pricing */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-indigo-600" />
                <div>
                  <p className="text-xs text-gray-500">Price</p>
                  <p className="font-bold text-xl">
                    {data.price === 'Free' ? 'FREE ENTRY' : `${data.currency || '₹'}${data.price}`}
                  </p>
                </div>
              </div>
              {data.paymentStatus && (
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  data.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' : 
                  data.paymentStatus === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 
                  'bg-gray-100 text-gray-800'
                }`}>
                  {data.paymentStatus}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Right Section - QR Code & Ticket Info */}
        <div className="space-y-4 border-l pl-6">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-2">Scan for Entry</p>
            {qrCodeUrl && (
              <img 
                src={qrCodeUrl} 
                alt="QR Code" 
                className="mx-auto border-2 border-gray-300 rounded-lg p-3 bg-white w-40 h-40 object-contain"
                style={{ minWidth: '160px', minHeight: '160px' }}
              />
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-indigo-600" />
              <div>
                <p className="text-xs text-gray-500">Ticket Number</p>
                <p className="font-mono font-bold text-lg">{data.ticketNumber}</p>
              </div>
            </div>
            
            <div>
              <p className="text-xs text-gray-500">Registration ID</p>
              <p className="font-mono text-sm">{data.registrationId}</p>
            </div>
            
            {data.paymentId && (
              <div>
                <p className="text-xs text-gray-500">Payment ID</p>
                <p className="font-mono text-xs">{data.paymentId}</p>
              </div>
            )}
          </div>
          
          {/* Security Features */}
          {(data.hologram || data.idRequired) && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-indigo-600" />
                <p className="text-xs font-semibold text-gray-700">Security</p>
              </div>
              <div className="space-y-1">
                {data.hologram && (
                  <p className="text-xs text-gray-600">✓ Hologram Protected</p>
                )}
                {data.idRequired && (
                  <p className="text-xs text-gray-600">✓ ID Proof Required</p>
                )}
                {data.nonTransferable && (
                  <p className="text-xs text-gray-600">✓ Non-Transferable</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer - Terms & Sponsors */}
      <div className="bg-gray-50 px-6 py-4 border-t">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {/* Terms & Conditions */}
            {data.terms && data.terms.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-gray-700 mb-1">Terms & Conditions:</p>
                <ul className="text-xs text-gray-600 space-y-0.5">
                  {data.terms.slice(0, 3).map((term, index) => (
                    <li key={index}>• {term}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Contact & Social */}
            <div className="flex items-center gap-4 text-xs text-gray-600">
              {data.organizerContact && (
                <span>📞 {data.organizerContact}</span>
              )}
              {data.website && (
                <span>🌐 {data.website}</span>
              )}
              {data.ageRestriction && (
                <span className="text-red-600 font-medium">Age: {data.ageRestriction}</span>
              )}
            </div>
          </div>
          
          {/* Sponsors */}
          {data.sponsors && data.sponsors.length > 0 && (
            <div className="flex items-center gap-3">
              <p className="text-xs text-gray-500">Sponsored by:</p>
              {data.sponsors.slice(0, 3).map((sponsor, index) => (
                sponsor.logo ? (
                  <img 
                    key={index}
                    src={sponsor.logo} 
                    alt={sponsor.name}
                    className="h-8 object-contain"
                  />
                ) : (
                  <span key={index} className="text-xs text-gray-600">{sponsor.name}</span>
                )
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Compact version for mobile/small prints
function CompactTicket({ data, qrCodeUrl }: { data: TicketData; qrCodeUrl: string }) {
  return (
    <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-4 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">{data.eventName}</h2>
        <span className="px-2 py-1 bg-indigo-500 text-white text-xs rounded-full">
          {data.ticketType}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-500">Date & Time</p>
            <p className="text-sm font-medium">{data.eventDate}</p>
            <p className="text-sm">{data.eventTime}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Venue</p>
            <p className="text-sm font-medium">{data.venue}</p>
            {data.seatNumber && (
              <p className="text-sm">Seat: <span className="font-bold">{data.seatNumber}</span></p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500">Attendee</p>
            <p className="text-sm font-medium">{data.attendeeName}</p>
          </div>
        </div>
        
        <div className="flex flex-col items-center justify-center">
          {qrCodeUrl && (
            <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32 border border-gray-300 rounded p-1 bg-white" />
          )}
          <p className="text-xs font-mono font-bold mt-2">{data.ticketNumber}</p>
        </div>
      </div>
      
      <div className="border-t mt-3 pt-2">
        <p className="text-xs text-gray-500 text-center">
          {data.nonTransferable && 'Non-transferable • '}
          {data.idRequired && 'ID Required • '}
          {data.organizerContact}
        </p>
      </div>
    </div>
  )
}