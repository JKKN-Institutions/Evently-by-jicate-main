# Evently Setup Guide

## Environment Variables Setup

Create a `.env.local` file in the root directory with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Razorpay Configuration (Test Mode)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_secret_key_here

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Evently
```

## Getting Razorpay Test Keys

1. Sign up at [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Navigate to **Settings > API Keys**
3. Generate test API keys
4. Copy the **Key ID** (starts with `rzp_test_`) and **Key Secret**
5. Add them to your `.env.local` file

## Important Notes

- Make sure your Razorpay key starts with `rzp_test_` for test mode
- Never commit your `.env.local` file to version control
- Restart your development server after changing environment variables

## Test Payment Details

When testing payments, use these card details:
- **Card Number**: 4111 1111 1111 1111
- **CVV**: Any 3 digits (e.g., 123)
- **Expiry**: Any future date (e.g., 12/25)
- **Name**: Any name
- **Email**: Any email
- **Phone**: Any 10-digit number
