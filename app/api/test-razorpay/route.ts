import { NextResponse } from 'next/server'

export async function GET() {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  
  // Only show partial keys for security
  const maskedKeyId = keyId ? `${keyId.substring(0, 12)}...` : 'NOT SET'
  const maskedKeySecret = keySecret ? `${keySecret.substring(0, 8)}...` : 'NOT SET'
  
  return NextResponse.json({
    razorpayKeyId: {
      isSet: !!keyId,
      isTestKey: keyId?.startsWith('rzp_test_') || false,
      masked: maskedKeyId
    },
    razorpayKeySecret: {
      isSet: !!keySecret,
      masked: maskedKeySecret
    },
    supabase: {
      url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    },
    nodeEnv: process.env.NODE_ENV
  })
}
