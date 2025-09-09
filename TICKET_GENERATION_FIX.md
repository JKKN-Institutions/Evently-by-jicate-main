# Complete Ticket Generation Fix

## Issues Fixed

1. **RLS Policy Error**: Fixed Row-Level Security policies blocking ticket statistics updates
2. **QR Code Verification**: Updated QR code format to be compatible with the verification system
3. **Database Structure**: Added proper QR code tracking tables

## Changes Made

### 1. Updated Files

#### `app/api/tickets/generate-enhanced/route.ts`
- Added proper QR code generation with SHA256 hash
- Stores QR codes in `qr_codes` table for verification
- Handles RLS errors gracefully
- QR data format: JSON with ticket details

#### `app/api/tickets/generate-simple/route.ts`
- Added QR code generation matching enhanced format
- Stores QR codes in database for verification
- Compatible with ticket verification page

### 2. Database Migrations

Two SQL files need to be applied in order:

#### Step 1: Create QR Codes Table
File: `supabase/create-qr-codes-table.sql`
- Creates `qr_codes` table for storing QR code data
- Creates `qr_scan_records` table for tracking scans
- Sets up proper indexes and RLS policies

#### Step 2: Fix RLS Policies
File: `supabase/fix-verification-stats-rls.sql`
- Fixes RLS policies for `event_verification_stats`
- Adds SECURITY DEFINER to system functions
- Allows proper stats tracking

## How to Apply the Fix

### Step 1: Apply Database Migrations

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run these queries in order:

**First Query - Create QR Tables:**
```sql
-- Copy and paste contents of supabase/create-qr-codes-table.sql
```

**Second Query - Fix RLS:**
```sql
-- Copy and paste contents of supabase/fix-verification-stats-rls.sql
```

### Step 2: Restart Your Development Server

```bash
npm run dev
```

### Step 3: Test Ticket Generation

1. Navigate to `/admin/enhanced-ticket-generator`
2. Select an event
3. Generate tickets
4. Verify no errors appear in console

### Step 4: Test QR Code Verification

1. Navigate to `/admin/verify-tickets`
2. Use the generated QR code data
3. Verify the ticket is recognized

## QR Code Format

Generated tickets now include QR codes with this format:

```json
{
  "type": "ticket",
  "ticketNumber": "TKT-XXXX-XXXX",
  "eventId": "uuid",
  "bookingId": "uuid",
  "ticketId": "uuid",
  "timestamp": 1234567890
}
```

This data is:
- Stored as JSON in the `qr_code` field of tickets
- Hashed with SHA256 and stored in `qr_codes` table
- Verified against the hash during scanning

## Verification Flow

1. QR code is scanned
2. System generates SHA256 hash of the data
3. Hash is looked up in `qr_codes` table
4. If found and valid, ticket is verified
5. Scan is recorded in `qr_scan_records`

## Troubleshooting

### If tickets still fail to generate:
1. Check browser console for specific error messages
2. Ensure all database migrations were applied
3. Verify user has proper permissions (admin or organizer)

### If QR codes don't verify:
1. Ensure `qr_codes` table was created
2. Check that tickets include proper QR data
3. Verify the verification page is using `/api/qr-verify` endpoint

### If RLS errors persist:
1. Double-check the RLS fix migration was applied
2. You may need to temporarily disable RLS on `event_verification_stats` for testing
3. Ensure functions have SECURITY DEFINER attribute

## Testing Checklist

- [ ] Database migrations applied successfully
- [ ] Enhanced ticket generation works without errors
- [ ] Simple ticket generation works without errors  
- [ ] Generated QR codes contain proper JSON data
- [ ] QR codes verify correctly on verification page
- [ ] No RLS errors in console
- [ ] Ticket stats update properly

## Important Notes

- QR codes are now stored separately in `qr_codes` table
- This enables better tracking and verification
- Old tickets without proper QR codes may need migration
- The system falls back gracefully if QR storage fails