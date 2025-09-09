# Universal Role Persistence Solution

## The Problem
Users' roles were reverting to their old values after logging out and back in, even though the roles were successfully updated in the admin panel. This affected ALL users, not just specific ones.

## Root Cause Analysis
1. **Database Triggers**: The `handle_new_user` trigger was firing on auth events and overwriting existing profile roles
2. **Metadata Conflicts**: Role data stored in `auth.users.raw_user_meta_data` was conflicting with the `profiles` table
3. **Multiple Sources of Truth**: Both auth metadata and profiles table were trying to manage roles

## The Solution

### Core Principle
**The `profiles` table is now the SINGLE SOURCE OF TRUTH for user roles**

### What We Fixed

1. **Removed Problematic Triggers**
   - Dropped all triggers that could modify existing user profiles
   - Created a safe trigger that ONLY creates profiles for NEW users
   - Existing users' profiles are NEVER modified by auth events

2. **Cleared Metadata Interference**
   - Removed all role data from `auth.users.raw_user_meta_data`
   - Auth metadata no longer stores or manages roles
   - Prevents any possibility of role override during login

3. **Updated Frontend Logic**
   - AuthContext always fetches roles directly from profiles table
   - Removed localStorage caching that could show stale roles
   - Clear cache on login events to ensure fresh data

4. **Safe Role Updates**
   - Created `update_user_role_safe()` function for database-level updates
   - API automatically clears auth metadata when updating roles
   - Ensures consistency across all systems

## How to Apply the Fix

### Step 1: Apply the SQL Migration
1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Copy ALL contents from `supabase/UNIVERSAL-fix-role-persistence.sql`
4. Run the query
5. You should see success messages showing:
   - Total users and profiles count
   - Confirmation that metadata roles are cleared
   - Instructions for safe role updates

### Step 2: Deploy Code Changes
The following files have been updated and need to be deployed:
- `contexts/AuthContext.tsx` - Always fetches fresh roles from database
- `app/api/users/update-role/route.ts` - Clears metadata on role updates
- `app/api/auth/refresh-role/route.ts` - Forces role refresh from database

### Step 3: Verify the Fix
After applying both SQL and code changes:
1. Update any user's role through the admin panel
2. Have that user log out completely
3. Have them log back in
4. Their new role should persist ✅

## How It Works Now

### For New Users
1. User signs up → Profile created with default 'user' role
2. Role stored ONLY in profiles table
3. No role data in auth metadata

### For Existing Users  
1. User logs in → Role fetched from profiles table
2. Auth metadata is ignored for roles
3. Profile table is the only source consulted

### For Role Updates
1. Admin updates role → Changed in profiles table
2. Auth metadata cleared of any role data
3. User sees new role immediately or after re-login

## Database Functions Created

### `update_user_role_safe(user_id, new_role)`
Safely updates a user's role and clears metadata:
```sql
SELECT update_user_role_safe('user-uuid-here', 'admin');
```

### `get_user_role_info(user_id)`
Debugging function to check user's role status:
```sql
SELECT * FROM get_user_role_info('user-uuid-here');
```

## Testing Different Scenarios

### Test 1: Regular User to Organizer
1. Find a user with 'user' role
2. Update to 'organizer' via admin panel
3. User logs out and back in
4. Should remain 'organizer' ✅

### Test 2: Organizer to Admin
1. Find a user with 'organizer' role
2. Update to 'admin' via admin panel
3. User logs out and back in
4. Should remain 'admin' ✅

### Test 3: Admin to User (Downgrade)
1. Find a user with 'admin' role
2. Update to 'user' via admin panel
3. User logs out and back in
4. Should remain 'user' ✅

## Troubleshooting

### If roles still revert:
1. Check if the SQL migration was fully applied:
   ```sql
   SELECT COUNT(*) FROM auth.users WHERE raw_user_meta_data ? 'role';
   ```
   This should return 0.

2. Verify no old triggers exist:
   ```sql
   SELECT tgname FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass;
   ```
   Should only show `on_auth_user_created_safe` or be empty.

3. Force clear all metadata roles:
   ```sql
   UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data - 'role';
   ```

### If specific user has issues:
Use the force fix endpoint:
```bash
curl -X POST http://your-domain/api/admin/force-fix-role \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","role":"admin"}'
```

## Key Benefits

1. **Permanent Fix**: Roles will never revert on login
2. **Single Source of Truth**: No more conflicts between systems
3. **Works for All Users**: Universal solution, not user-specific
4. **Future Proof**: New users automatically handled correctly
5. **Safe Updates**: Role changes are atomic and consistent

## Important Notes

- The profiles table is now the ONLY authoritative source for roles
- Auth metadata should NEVER contain role information
- All role checks should query the profiles table
- The fix is backward compatible with existing code

## Success Indicators

After applying this fix:
- ✅ Role updates persist through logout/login cycles
- ✅ All users maintain their assigned roles
- ✅ No role downgrades on authentication
- ✅ Admin panel shows correct roles
- ✅ User dashboards reflect proper access levels