# Evently - Event Management System Documentation

## System Overview
Evently is a comprehensive event management platform built with Next.js, TypeScript, and Supabase. It provides ticketing, QR code verification, and event management capabilities with role-based access control.

## Tech Stack
- **Frontend**: Next.js 14, TypeScript, React
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth with OAuth (Google, GitHub)
- **QR Code**: node-qrcode library
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui

## User Roles & Access Control

### 1. Admin (Superuser)
- **Access Level**: Full system access
- **Permissions**:
  - Create, edit, delete all events
  - Access admin dashboard at `/admin`
  - Generate bulk tickets
  - View all analytics and reports
  - Manage all users and roles
  - Access ticket generator at `/admin/enhanced-ticket-generator`
  - View verification stats

### 2. Organizer
- **Access Level**: Event-specific management
- **Permissions**:
  - Create and manage own events
  - Access organizer dashboard at `/organizer`
  - Generate tickets for their events
  - View event-specific analytics
  - Scan and verify tickets
  - Export attendee lists

### 3. Scanner
- **Access Level**: Verification only
- **Permissions**:
  - Access scanner app at `/scanner`
  - Verify tickets via QR code scanning
  - View basic verification stats
  - Mark tickets as used
  - Cannot create or edit events

### 4. User (Attendee)
- **Access Level**: Basic user functions
- **Permissions**:
  - Browse public events
  - Purchase/register for tickets
  - View own tickets at `/my-tickets`
  - Download ticket PDFs with QR codes
  - Update profile information

## QR Code Generation & Ticket System

### QR Code Generation Process
1. **Ticket Creation**:
   - Unique ticket ID generated using UUID
   - QR data format: `${eventId}|${ticketId}|${userId}|${timestamp}`
   - QR code generated using `qrcode` library
   - Stored as base64 string in database

2. **QR Code Implementation** (`lib/qr-code.ts`):
```typescript
- generateQRCode(data: string): Creates QR with error correction level 'M'
- QR contains encrypted ticket verification data
- Includes event ID, ticket ID, user ID, and timestamp
```

3. **Ticket Storage Structure**:
   - Table: `tickets`
   - Fields: id, event_id, user_id, qr_code, ticket_number, status, created_at, verified_at
   - Status values: 'active', 'used', 'cancelled'

## Ticket Verification Process

### Verification Flow
1. **Scanner Interface** (`/scanner`):
   - Camera-based QR code scanning
   - Manual ticket ID input fallback
   - Real-time verification feedback

2. **Verification API** (`/api/tickets/verify`):
   - Validates QR code format
   - Checks ticket existence
   - Verifies event validity
   - Prevents double-usage
   - Updates verification timestamp
   - Records scanner user ID

3. **Verification States**:
   - ✅ **Valid**: Ticket exists, event active, not previously used
   - ❌ **Invalid**: Ticket doesn't exist or format incorrect
   - ⚠️ **Already Used**: Ticket previously verified
   - 🚫 **Event Inactive**: Event has ended or not started

## Database Schema

### Key Tables
1. **users**: id, email, role, full_name, avatar_url
2. **events**: id, title, description, date, venue, organizer_id, capacity
3. **tickets**: id, event_id, user_id, qr_code, ticket_number, status
4. **event_verification_stats**: event_id, total_tickets, verified_tickets, last_verified

### Row Level Security (RLS) Policies
- Admin: Full access to all tables
- Organizer: Access to own events and related tickets
- Scanner: Read access to tickets for verification
- User: Access to own tickets only

## API Endpoints

### Ticket Management
- `POST /api/tickets/generate-enhanced`: Bulk ticket generation (Admin)
- `POST /api/tickets/generate-simple`: Single ticket creation
- `POST /api/tickets/verify`: QR code verification
- `GET /api/tickets/download-with-template`: PDF ticket download
- `GET /api/tickets/[id]`: Get ticket details

### Event Management
- `GET /api/events`: List all events
- `POST /api/events`: Create new event
- `PUT /api/events/[id]`: Update event
- `DELETE /api/events/[id]`: Delete event

## Common Issues & Solutions

### 1. RLS Policy Errors
- **Issue**: "new row violates row-level security policy"
- **Solution**: Check user role and ensure proper RLS policies are configured
- **Fallback**: Use service role key for admin operations

### 2. QR Code Scanning Issues
- **Issue**: Camera permissions or scanning failures
- **Solution**: Ensure HTTPS connection, check browser permissions
- **Fallback**: Manual ticket ID input option available

### 3. OAuth Redirect Issues
- **Issue**: Supabase OAuth callback failures
- **Solution**: Verify redirect URLs in Supabase dashboard match deployment URL
- **Config**: Check `next.config.js` for proper rewrites

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
NEXT_PUBLIC_APP_URL=your_deployment_url
```

## Development Commands
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run lint`: Run ESLint
- `npm run typecheck`: Run TypeScript checks

## Deployment Notes
- Platform: Vercel
- Database: Supabase (PostgreSQL)
- File Storage: Supabase Storage for images
- Environment: Configure all env vars in Vercel dashboard

## Security Considerations
1. All QR codes are encrypted and unique
2. Tickets cannot be transferred without admin approval
3. Double-verification prevention implemented
4. Rate limiting on verification endpoints
5. HTTPS required for camera access
6. Service role key only used for admin operations

## Recent Updates
- Fixed OAuth redirect issues for Vercel deployment
- Implemented fallback for RLS policy errors in ticket generation
- Added simplified ticket creation flow
- Enhanced error handling in verification process