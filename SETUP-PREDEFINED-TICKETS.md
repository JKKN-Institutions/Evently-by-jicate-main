# Setup Instructions for Predefined Tickets Feature

## Quick Fix

The error "Error loading tickets: {}" indicates that the `predefined_tickets` table doesn't exist in your Supabase database.

## Solution Steps

### 1. Run the Setup SQL Script

1. Open your **Supabase Dashboard**
2. Navigate to the **SQL Editor** (in the left sidebar)
3. Click **New Query**
4. Copy the entire contents of the file: `supabase/SETUP-PREDEFINED-TICKETS.sql`
5. Paste it into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)

### 2. Verify the Setup

After running the script, you should see:
- "Table created successfully" message
- A list of RLS policies created
- No error messages in red

### 3. Refresh the Page

Go back to your application and refresh the Predefined Tickets page:
```
http://localhost:3000/admin/predefined-tickets
```

## What the Script Does

The setup script creates:
- **predefined_tickets table** - Stores ticket templates
- **RLS policies** - Controls who can view/edit templates
- **Indexes** - Improves query performance
- **Triggers** - Auto-updates timestamps
- **Permissions** - Grants appropriate access

## Troubleshooting

### If you still see errors after running the script:

1. **Check your admin role:**
   - Make sure you're logged in as an admin user
   - Your user's role in the profiles table should be 'admin'

2. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

3. **Check Supabase connection:**
   - Verify your `.env.local` file has correct Supabase credentials
   - Make sure Supabase project is running

4. **Check for SQL errors:**
   - If the SQL script failed, check for error messages
   - Common issues:
     - Missing `events` table (run main database setup first)
     - Missing `profiles` table (run user setup first)

## Features After Setup

Once properly configured, you can:
- Upload ticket templates with custom designs
- Position QR codes on templates
- Generate tickets using templates
- Preview tickets with QR codes
- Manage Gold, Silver, and Bronze ticket types

## Need Help?

If you continue to experience issues:
1. Check the browser console for detailed error messages
2. Verify all database tables are created in Supabase
3. Ensure you have admin privileges in the system