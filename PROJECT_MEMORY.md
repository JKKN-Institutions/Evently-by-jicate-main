# Evently - Event Management Platform

## Project Overview
Evently is a full-stack event management and ticketing platform built with Next.js 15, TypeScript, Supabase, and Razorpay. It allows users to discover, book, and manage events while enabling organizers to create events, sell tickets, and track attendance.

## Technology Stack

### Frontend
- **Framework**: Next.js 15.5.0 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **UI Components**: Custom components with Lucide React icons
- **Forms**: React Hook Form with Zod validation
- **Fonts**: Geist Sans & Geist Mono

### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Payment Processing**: Razorpay
- **API**: Next.js API Routes

### Key Dependencies
- `@supabase/supabase-js`: Database and auth client
- `razorpay` & `react-razorpay`: Payment integration
- `qrcode`: QR code generation for tickets
- `html2canvas` & `jspdf`: PDF generation
- `date-fns`: Date manipulation
- `crypto-js`: Encryption utilities

## Project Structure

```
Evently-by-jicate-main/
├── app/                    # Next.js App Router
│   ├── (app)/             # Protected routes with app layout
│   │   ├── bookings/      # User bookings page
│   │   ├── events/        # Events listing
│   │   ├── profile/       # User profile
│   │   └── tickets/       # User tickets
│   ├── api/               # API routes
│   │   ├── bookings/      # Booking endpoints
│   │   ├── events/        # Event CRUD operations
│   │   ├── payments/      # Payment processing
│   │   └── tickets/       # Ticket validation
│   ├── auth/              # Authentication callback
│   ├── events/            # Public event pages
│   │   ├── [id]/          # Event details & booking
│   │   ├── create/        # Create new event
│   │   └── scan/          # QR code scanner
│   └── payments/          # Payment pages
├── components/            # React components
│   ├── layout/           # Layout components
│   │   ├── app-layout.tsx
│   │   ├── sidebar.tsx
│   │   ├── bottom-navigation.tsx
│   │   └── floating-action-button.tsx
│   ├── auth-button.tsx
│   └── ticket-template.tsx
├── lib/                   # Utilities and configurations
│   ├── supabase/         # Supabase client setup
│   ├── validations/      # Zod schemas
│   ├── razorpay.ts       # Payment integration
│   └── qr-code.ts        # QR generation
├── types/                # TypeScript definitions
├── supabase/             # Database schemas
└── public/               # Static assets
```

## Database Schema

### Core Tables

#### profiles
- User profiles linked to Supabase Auth
- Fields: id, email, full_name, avatar_url, role
- Roles: user, organizer, admin

#### events
- Event information
- Fields: id, title, description, date, time, venue, location, price, max_attendees, current_attendees, image_url, organizer_id, category, status
- Status: draft, published, cancelled

#### bookings
- Event bookings/reservations
- Fields: id, event_id, user_id, user_email, user_name, user_phone, quantity, total_amount, payment_id, payment_status, booking_status
- Payment Status: pending, completed, failed, refunded
- Booking Status: confirmed, cancelled

#### payments
- Payment transactions via Razorpay
- Fields: id, booking_id, razorpay_order_id, razorpay_payment_id, amount, currency, status, error details, metadata
- Tracks complete payment lifecycle

#### payment_logs
- Audit trail for payment events
- Fields: id, payment_id, booking_id, event_type, event_data, ip_address, user_agent

#### tickets (if implemented)
- Individual tickets for bookings
- QR code validation support

### Database Features
- Row Level Security (RLS) enabled
- Automatic timestamp updates via triggers
- Foreign key relationships with CASCADE deletes
- Comprehensive indexes for performance

## Key Features

### User Features
- Browse and search events by category
- Book tickets for events
- Make secure payments via Razorpay
- View booking history
- Access digital tickets with QR codes
- User profile management

### Organizer Features
- Create and publish events
- Set pricing and capacity
- View event dashboard
- Track bookings and revenue
- Scan QR codes for check-ins
- Manage event staff

### Technical Features
- Server-side rendering with Next.js
- Real-time data with Supabase
- Secure authentication flow
- Payment webhook handling
- Responsive mobile-first design
- Progressive Web App capabilities

## API Endpoints

### Events
- `GET /api/events` - List published events
- `POST /api/events` - Create new event
- `GET /api/events/[id]` - Get event details
- `PUT /api/events/[id]` - Update event
- `DELETE /api/events/[id]` - Delete event

### Bookings
- `GET /api/bookings` - User's bookings
- `POST /api/bookings` - Create booking

### Payments
- `POST /api/payments/create-order` - Initialize Razorpay order
- `POST /api/payments/verify` - Verify payment signature
- `POST /api/payments/failed` - Handle failed payments

### Tickets
- `POST /api/tickets/validate` - Validate QR code

## Configuration

### Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `RAZORPAY_KEY_ID` - Razorpay API key
- `RAZORPAY_KEY_SECRET` - Razorpay secret key
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` - Public Razorpay key

### Scripts
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run start` - Production server
- `npm run lint` - ESLint checking

## Security Features
- Row Level Security in database
- Authentication required for protected routes
- Payment signature verification
- CSRF protection via Supabase
- Input validation with Zod schemas
- Secure session management

## Mobile Responsiveness
- Adaptive layout with sidebar (desktop) and bottom navigation (mobile)
- Floating action button for mobile
- Touch-optimized interfaces
- QR code scanner for mobile devices

## Payment Flow
1. User selects event and quantity
2. Booking created with pending status
3. Razorpay order initialized
4. User completes payment
5. Payment verified server-side
6. Booking status updated
7. Digital ticket generated

## Development Notes
- TypeScript strict mode enabled
- Path aliases configured (@/* for root)
- ESLint configured for code quality
- Tailwind CSS 4 with PostCSS
- Git repository (not initialized)

## Future Enhancements
- Email notifications
- Social sharing
- Event recommendations
- Analytics dashboard
- Refund processing
- Multi-language support
- Advanced search filters
- Recurring events

## Known Issues/TODOs
- Payment tracking tables may need setup
- Email verification flow
- Image upload for events
- Advanced ticket types (VIP, Early Bird)
- Event capacity management
- Waitlist functionality