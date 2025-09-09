# Fix for Role Persistence Issue

## Problem
When updating a user's role through the admin panel, the role updates correctly and persists through page refreshes. However, when the user logs out and logs back in, their role reverts to the old value.

## Root Cause
The issue occurs because:
1. The `handle_new_user` trigger in the database was using `raw_user_meta_data` from `auth.users` table
2. This metadata wasn't being updated when roles changed in the `profiles` table
3. On login, the trigger would override the updated role with the stale metadata value
4. The AuthContext was sometimes using cached roles instead of fetching fresh data

## Complete Solution Applied (V2)

### 1. Database Changes (`supabase/fix-role-persistence-v2.sql`)
- **Redesigned trigger approach**: `handle_new_user` now ONLY handles NEW users, never updates existing profiles
- **Profile as source of truth**: The `profiles` table is now the single source of truth for roles
- **One-way sync**: Role changes sync FROM profiles TO auth metadata (never the reverse)
- **No override on login**: Login process cannot override existing profile roles
- Created helper functions for role management

### 2. Frontend Updates (`contexts/AuthContext.tsx`)
- **Always fetch fresh roles**: Removed localStorage caching on login
- **Direct database queries**: Always queries the profiles table for current role
- **Clear cache on auth events**: Clears stale cache on SIGNED_IN events
- **Auto-create profiles**: Creates missing profiles with default 'user' role

### 3. API Updates 
- **`app/api/users/update-role/route.ts`**: Updates both profile and auth metadata
- **`app/api/auth/refresh-role/route.ts`**: New endpoint to force-refresh user role from database

### 4. Admin Panel (`components/admin/user-management.tsx`)
- Shows clear message that users need to log out and back in for changes

## How to Apply the Fix

### IMPORTANT: Apply V2 Fix (Required)
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. **Copy the contents of `supabase/fix-role-persistence-v2.sql`** (NOT the v1 file)
4. Paste and run the query
5. You should see success messages in the output

### After applying the SQL:
1. Deploy the updated code (AuthContext.tsx and API routes)
2. Have users log out and log back in once
3. Role updates will now persist correctly

## Testing the Fix

1. **Update a user's role** through the admin panel
2. **Have the user log out** completely
3. **Have the user log back in**
4. **Verify the role persists** - the user should have their new role

## What This Fix Does

1. **Preserves existing roles** - The trigger no longer overwrites roles on login
2. **Syncs metadata** - Role changes are automatically synced to auth.users metadata
3. **Ensures consistency** - Both profiles table and auth metadata stay in sync

## Additional Notes

- Users may need to log out and back in once after the fix is applied for changes to take full effect
- The fix is backward compatible and won't affect existing functionality
- Real-time role updates will continue to work as before