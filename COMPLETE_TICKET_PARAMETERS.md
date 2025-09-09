# Complete Ticket Parameters Documentation

## All Ticket Parameters Now Included

### 1. Unique Identifiers
- **Ticket ID**: Unique UUID for each ticket (`ticketId`)
- **Ticket Number**: Human-readable unique number (`ticketNumber`)
- **Booking ID**: Links ticket to booking (`bookingId`)
- **Event ID**: Links ticket to event (`eventId`)

### 2. QR Code Data (Encrypted)
Each QR code contains:
```json
{
  "ticketId": "uuid",
  "ticketNumber": "TKT-XXX-XXX",
  "eventId": "event-uuid",
  "bookingId": "booking-uuid",
  "seatNumber": "A15",
  "section": "VIP",
  "row": "5",
  "timestamp": 1234567890
}
```

### 3. Seat Information
- **Seat Number**: Specific seat assigned (`seatNumber`)
- **Row Number**: Row in venue (`rowNumber`)
- **Section**: Section/area of venue (`section`)
- **Zone**: Zone designation (`zone`)
- **Gate Number**: Entry gate (`gateNumber`)

### 4. Event Details
- **Event Title**: Name of event
- **Event Date**: Date of event
- **Event Time**: Start time
- **Venue**: Venue name
- **Location**: Full address

### 5. Attendee Information
- **Attendee Name**: Name of ticket holder
- **User Email**: Contact email
- **User Phone**: Contact phone
- **User ID**: System user ID

### 6. Ticket Metadata
- **Ticket Type**: VIP, General, Premium, etc.
- **Status**: valid, used, cancelled
- **Created At**: Timestamp of creation
- **Price**: Ticket price
- **Currency**: Currency code

### 7. Template Information
- **Theme Colors**: Primary and secondary colors
- **Layout Style**: modern, classic, minimal
- **Organization Info**: Organizer name and contact
- **Terms**: Refund policy, age restrictions, etc.

## How Tickets Are Generated

### Step 1: Booking Created
When a booking is made:
1. Seats are allocated (if event has seat allocation)
2. Booking is linked to event
3. Payment is processed

### Step 2: Ticket Generation
For each ticket in booking:
1. Generate unique ticket ID (UUID)
2. Generate unique ticket number
3. Fetch allocated seat (if applicable)
4. Create encrypted QR code with all data
5. Store ticket with all parameters

### Step 3: Ticket Download
When downloading ticket:
1. Fetch ticket with all relationships
2. Include seat information in PDF
3. Embed QR code with complete data
4. Show all parameters on ticket

## Database Structure

```sql
tickets table:
- id (UUID)
- booking_id
- event_id  
- ticket_number
- qr_code (encrypted)
- status
- ticket_type
- seat_number
- row_number
- section
- zone
- metadata (JSONB with all additional data)
```

## PDF Output Includes

1. **Header Section**:
   - Event title
   - Ticket type badge
   - QR code (small)

2. **Body Section**:
   - Date and time
   - Venue and location
   - Attendee name
   - **Seat information** (NEW):
     - Section
     - Row
     - Seat number
     - Gate number
   - Large QR code

3. **Footer Section**:
   - Ticket number
   - Terms and conditions
   - Organizer information

## Testing Checklist

- [x] Each ticket has unique ID
- [x] Each ticket has unique ticket number
- [x] QR codes contain complete information
- [x] Seat numbers are properly assigned
- [x] Allocated seats from booking are used
- [x] PDF shows all seat information
- [x] Metadata includes all parameters
- [x] Download includes all ticket data

## Example Ticket Data

```javascript
{
  ticketId: "550e8400-e29b-41d4-a716-446655440000",
  ticketNumber: "TKT-550e8400-1234567890-abcd",
  eventId: "event-123",
  bookingId: "booking-456",
  
  // Seat Information
  seatNumber: "15",
  rowNumber: "A",
  section: "VIP",
  zone: "North",
  gateNumber: "3",
  
  // Event Details
  eventTitle: "Summer Music Festival",
  eventDate: "2024-07-15",
  eventTime: "19:00",
  venue: "Madison Square Garden",
  location: "New York, NY",
  
  // Attendee
  attendeeName: "John Doe",
  userEmail: "john@example.com",
  userPhone: "+1234567890",
  
  // Status
  status: "valid",
  ticketType: "VIP",
  createdAt: "2024-01-15T10:30:00Z"
}
```

## Verification

All tickets now include:
✅ Unique ticket ID for each ticket
✅ Unique QR code with encrypted data
✅ Seat allocation from booking
✅ Complete event information
✅ Full attendee details
✅ Template customization
✅ All parameters in PDF download