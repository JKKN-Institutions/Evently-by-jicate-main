# Supabase OAuth Configuration Fix

## The Problem
You're getting `{"error":"requested path is invalid"}` because Supabase is incorrectly redirecting to:
```
https://sdkdi...supabase.co/evently-by-jicate.vercel.app?code=...
```

Instead of:
```
https://evently-by-jicate.vercel.app/auth/callback?code=...
```

## CRITICAL FIX REQUIRED IN SUPABASE DASHBOARD

### ⚠️ IMPORTANT: You MUST configure these settings in Supabase Dashboard

### Step 1: Go to Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**

### Step 2: Set Redirect URLs
Add these URLs to the **Redirect URLs** section:

For Production (Vercel):
```
https://evently-by-jicate.vercel.app/auth/callback
```

For Local Development:
```
http://localhost:3000/auth/callback
http://localhost:3001/auth/callback
```

### Step 3: Configure Site URL
In the same section, set your **Site URL** to:
```
https://evently-by-jicate.vercel.app
```

### Step 4: Save Changes
Click **Save** to apply the configuration.

## What I've Fixed in the Code

1. **Created `/app/auth/callback/page.tsx`**: A client-side page that properly handles the OAuth callback
2. **Updated authentication flow**: The callback page now:
   - Extracts the code from URL parameters
   - Exchanges it for a session using Supabase client
   - Creates user profile if needed
   - Redirects to the intended page

## Testing the Fix

1. **Deploy to Vercel**:
   ```bash
   git add .
   git commit -m "Fix OAuth callback handling"
   git push
   ```

2. **Wait for deployment** to complete on Vercel

3. **Test authentication**:
   - Go to https://evently-by-jicate.vercel.app
   - Click "Sign in with Google"
   - You should be redirected back to your app after authentication

## Environment Variables in Vercel

### CRITICAL: Update these in Vercel Dashboard
1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add/Update these variables:

```
NEXT_PUBLIC_APP_URL = https://evently-by-jicate.vercel.app
NEXT_PUBLIC_SUPABASE_URL = https://sdkdimqmzunfmyawtqfy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = [your anon key]
SUPABASE_SERVICE_ROLE_KEY = [your service role key]
```

⚠️ **IMPORTANT**: The `NEXT_PUBLIC_APP_URL` MUST be set to your Vercel URL, not localhost!

## Important Notes
- The callback URL in your OAuth provider settings (Google) should match exactly
- Always use HTTPS for production URLs
- The callback page handles both new and existing users