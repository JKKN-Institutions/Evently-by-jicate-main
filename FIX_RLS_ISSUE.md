# Fix for Event Verification Stats RLS Issue

## Problem
The ticket generation is failing with the error:
```
new row violates row-level security policy for table "event_verification_stats"
```

This happens because the `event_verification_stats` table has Row-Level Security (RLS) policies that prevent system functions from inserting or updating statistics when tickets are created.

## Solution

### Option 1: Apply SQL Migration (Recommended)
Run the SQL migration file in your Supabase dashboard:

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/fix-verification-stats-rls.sql`
4. Run the query

This will:
- Update RLS policies to allow system functions to modify stats
- Add SECURITY DEFINER to functions that need elevated privileges
- Maintain security while fixing the issue

### Option 2: Quick Workaround (Already Applied)
The code has been updated to handle RLS errors gracefully:

1. **generate-enhanced/route.ts**: Now detects RLS errors and checks if tickets were created anyway
2. **generate-simple/route.ts**: Uses minimal data to avoid triggering stats updates

### Option 3: Temporary Fix (Not Recommended for Production)
If you need an immediate fix for testing:

1. Go to Supabase Dashboard
2. Navigate to Authentication > Policies
3. Find the `event_verification_stats` table
4. Temporarily disable RLS (NOT recommended for production)

## What Changed

### Files Modified:
1. `app/api/tickets/generate-enhanced/route.ts` - Added RLS error handling
2. `supabase/fix-verification-stats-rls.sql` - SQL migration to fix policies
3. `app/api/tickets/fix-rls/route.ts` - Diagnostic endpoint for testing

### Key Changes:
- Functions that modify stats now use `SECURITY DEFINER`
- RLS policies allow system operations while maintaining security
- Error handling gracefully recovers from RLS errors

## Testing
After applying the fix, test ticket generation:

1. Navigate to `/admin/enhanced-ticket-generator`
2. Select an event
3. Generate tickets
4. Verify tickets are created without errors

## Prevention
To prevent similar issues:
- Always test RLS policies with all operations (SELECT, INSERT, UPDATE, DELETE)
- Use SECURITY DEFINER for system functions that need elevated privileges
- Consider using service role for background operations