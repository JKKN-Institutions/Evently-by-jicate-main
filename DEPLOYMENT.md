# Evently Deployment Guide

## Environment Variables Required

Before deploying to Vercel, you need to set up the following environment variables:

### Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Razorpay Configuration (for payments)
```
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

### Next.js Configuration
```
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=https://your-domain.vercel.app
```

## Vercel Deployment Steps

1. **Connect your GitHub repository to Vercel**
2. **Set Environment Variables in Vercel Dashboard:**
   - Go to your project settings in Vercel
   - Navigate to "Environment Variables"
   - Add all the required variables listed above

3. **Deploy:**
   - Vercel will automatically deploy when you push to main branch
   - Or manually trigger deployment from Vercel dashboard

## Getting Your Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings → API
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Project API keys → anon/public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Getting Your Razorpay Credentials

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Go to Settings → API Keys
3. Generate/Copy:
   - Key ID → `RAZORPAY_KEY_ID`
   - Key Secret → `RAZORPAY_KEY_SECRET`

## Important Notes

- Make sure all environment variables are set before deployment
- The app uses `output: 'standalone'` for optimal Vercel deployment
- Static generation is disabled for pages requiring runtime environment variables
- Database setup and RLS policies must be configured in Supabase before deployment

## Troubleshooting

If you encounter build errors:
1. Check that all environment variables are properly set in Vercel
2. Ensure your Supabase project is active and accessible
3. Verify that your database schema matches the application requirements
4. Check the Vercel build logs for specific error messages
