# Supabase Setup Instructions

## ⚠️ IMPORTANT: Your app is not fetching data because Supabase is not configured!

## Quick Setup Guide

### Step 1: Create .env.local file
1. Copy `.env.local.example` to `.env.local`
2. This file should be in the root directory of your project

### Step 2: Get Supabase Credentials
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a new project or select existing one
3. Go to **Settings > API**
4. Copy these values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Key** → `SUPABASE_SERVICE_ROLE_KEY`

### Step 3: Setup Database Tables
Run the SQL scripts in the `/supabase` folder in this order:
1. `schema.sql` - Basic tables
2. `enhanced-role-schema.sql` - Role management
3. `payment-tracking.sql` - Payment tables
4. `ticketing-schema.sql` - Ticketing system

### Step 4: Enable Row Level Security (RLS)
For each table, ensure RLS is enabled:
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
```

### Step 5: Create RLS Policies
Example policies for the profiles table:
```sql
-- Allow users to view all profiles
CREATE POLICY "Profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);
```

### Step 6: Enable Authentication
1. Go to **Authentication > Providers** in Supabase
2. Enable **Email** provider
3. Enable **Google** provider (optional)
   - Add Google OAuth credentials
   - Set redirect URL

### Step 7: Restart Development Server
```bash
npm run dev
```

## Testing Connection
Visit `/test-connection` page to verify Supabase is working correctly.

## Common Issues

### Issue: "No data showing"
- Check if `.env.local` file exists
- Verify environment variables are set correctly
- Restart the development server after adding `.env.local`

### Issue: "Authentication error"
- Check if anon key is correct
- Verify Supabase project is active

### Issue: "Table doesn't exist"
- Run the SQL scripts in `/supabase` folder
- Check Supabase dashboard > Table Editor

### Issue: "Permission denied"
- Enable RLS on tables
- Create appropriate RLS policies
- Check if service role key is set (for admin operations)

## Environment Variables Required

```env
# Required for all features
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Required for admin features
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Required for payments
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx
```

## Need Help?
1. Check Supabase logs: Dashboard > Logs > API Logs
2. Check browser console for errors
3. Use `/test-connection` page to debug
4. Verify all environment variables are set