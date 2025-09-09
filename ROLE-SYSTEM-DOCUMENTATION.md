# Role System - Permanent Solution Documentation

## Overview
This document explains the permanent solution for role persistence in the Evently application. The solution ensures that role updates work for ALL users without any hardcoded emails or special cases.

## Key Principles

1. **Single Source of Truth**: The `profiles` table is the ONLY source of truth for user roles
2. **No Hardcoded Users**: No special treatment for specific email addresses
3. **Database Integrity**: Roles persist across logins and sessions
4. **Real-time Updates**: Role changes reflect immediately via Supabase realtime

## How It Works

### 1. Database Level
- **Profiles Table**: Stores user profiles with roles (`user`, `organizer`, `admin`)
- **No Auth Metadata**: Role data is NOT stored in `auth.users.raw_user_meta_data`
- **Simple Trigger**: Only ONE trigger that creates profiles for new users (never updates existing)

### 2. Authentication Flow
```
User Signs In → Auth Context Initializes → Fetches Profile → Shows Correct UI
```

### 3. Role Update Flow
```
Admin Panel → Update Role API → Database Update → Realtime Broadcast → UI Updates
```

## Implementation Steps

### Step 1: Apply Database Fix
Run the SQL script `PERMANENT-ROLE-FIX.sql` in Supabase SQL editor:
```sql
-- This script:
-- 1. Removes all interfering triggers
-- 2. Creates simple profile creation for new users
-- 3. Sets up proper RLS policies
-- 4. Ensures profiles table is the source of truth
```

### Step 2: Auth Context
The auth context now:
- Uses `getUser()` instead of problematic `getSession()`
- Fetches profile directly from database
- Subscribes to realtime updates
- No caching that could cause stale data

### Step 3: Role Updates
Admins can update any user's role through:
1. Admin Panel UI (`/admin/users`)
2. Direct SQL: `SELECT update_user_role(user_id, 'admin');`

## Testing Role Updates

### For Admin Testing
1. Sign in as an admin user
2. Go to `/admin/users`
3. Update any user's role
4. Have that user refresh - they should see new permissions

### For Developer Testing
```sql
-- Make a user an admin
SELECT update_user_role('user-uuid-here', 'admin');

-- Make a user an organizer
SELECT update_user_role('user-uuid-here', 'organizer');

-- Revert to regular user
SELECT update_user_role('user-uuid-here', 'user');
```

## Troubleshooting

### Issue: Role not updating
**Solution**: Check browser console for errors, ensure RLS policies are applied

### Issue: Profile not found
**Solution**: The system auto-creates profiles for new users. For existing users without profiles, they're created on first login

### Issue: Can't access admin panel
**Solution**: Ensure your user has `admin` role in the profiles table

## Role Permissions

| Role | Permissions |
|------|------------|
| `user` | Browse events, book tickets, view own bookings |
| `organizer` | All user permissions + create events, manage own events, verify tickets |
| `admin` | All permissions + user management, view all events, access analytics |

## Important Notes

1. **New Users**: Always start with `user` role
2. **Role Promotion**: Must be done by an admin through the UI or SQL
3. **No Automatic Admins**: No emails get automatic admin access
4. **Persistence**: Roles persist across:
   - Page refreshes
   - Browser sessions
   - Login/logout cycles
   - Different devices

## Maintenance

### Checking System Health
```sql
-- Check if all users have profiles
SELECT COUNT(*) as users_without_profiles
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = au.id
);

-- Check role distribution
SELECT role, COUNT(*) as count
FROM profiles
GROUP BY role;

-- Check for role in auth metadata (should be 0)
SELECT COUNT(*) as users_with_metadata_role
FROM auth.users
WHERE raw_user_meta_data ? 'role';
```

## Security

- Only admins can change roles
- Users cannot modify their own role
- Service role key required for admin operations
- RLS policies prevent unauthorized access

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify database migrations are applied
3. Ensure environment variables are set correctly
4. Check Supabase logs for detailed errors