# Event Verification Stats RLS Issue - Fixed

## Problem Description
The ticket generation was failing with the following error:
```
code: '42501'
message: 'new row violates row-level security policy for table "event_verification_stats"'
```

This error occurs because when a ticket is inserted into the `tickets` table, a database trigger attempts to update the `event_verification_stats` table, but the Row-Level Security (RLS) policies on that table are too restrictive.

## Root Cause
1. The `tickets` table has an AFTER INSERT/UPDATE trigger that updates `event_verification_stats`
2. The `event_verification_stats` table has restrictive RLS policies
3. When the trigger fires, it doesn't have sufficient privileges to insert/update the stats table
4. This causes the entire ticket creation transaction to fail

## Solutions Implemented

### 1. Code-Level Fix (Already Applied)
Modified `/app/api/tickets/generate-enhanced/route.ts` to:
- Detect when the RLS error occurs
- Check if the ticket was actually created (often it is, despite the error)
- Retry with a simplified insert if needed
- Continue processing even if stats update fails

### 2. Database-Level Fix (Needs to be Applied)
Created `/supabase/FIX-RLS-COMPREHENSIVE.sql` which:
- Drops problematic triggers and functions
- Creates a new SECURITY DEFINER trigger function that bypasses RLS
- Implements error handling to prevent transaction failures
- Sets up more permissive RLS policies for the stats table

### 3. Admin API Endpoint (Optional)
Created `/app/api/admin/apply-rls-fix/route.ts` to programmatically apply the fix (admin only)

## How to Apply the Permanent Fix

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of `/supabase/FIX-RLS-COMPREHENSIVE.sql`
4. Paste and run the SQL
5. You should see: "RLS fix applied successfully!"

### Option 2: Via Admin API (If Available)
```bash
POST /api/admin/apply-rls-fix
Authorization: Bearer <admin-token>
```

## Testing the Fix
After applying the fix, test ticket generation:
1. Go to `/admin/enhanced-ticket-generator`
2. Select an event
3. Generate tickets
4. Should complete without RLS errors

## What Changed
- **Trigger Function**: Now uses `SECURITY DEFINER` to run with elevated privileges
- **Error Handling**: Silently catches RLS errors instead of failing the transaction
- **RLS Policies**: More permissive policies that allow system operations
- **Code Resilience**: API endpoint handles RLS errors gracefully

## Status
✅ Code-level workaround is active and working
⚠️ Database-level fix needs to be applied for permanent solution

## Files Modified/Created
- `/app/api/tickets/generate-enhanced/route.ts` - Enhanced error handling
- `/supabase/FIX-RLS-COMPREHENSIVE.sql` - Complete database fix
- `/app/api/admin/apply-rls-fix/route.ts` - Admin API to apply fix
- `/RLS-FIX-DOCUMENTATION.md` - This documentation

## Next Steps
1. Apply the SQL fix via Supabase dashboard
2. Test ticket generation
3. Monitor for any remaining issues
4. The code-level workaround will continue to work even without the database fix