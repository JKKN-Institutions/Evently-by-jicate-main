import Razorpay from 'razorpay'

// Server-side only Razorpay instance
let razorpayInstance: Razorpay | null = null

export function getRazorpayInstance(): Razorpay {
  if (!razorpayInstance) {
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      console.error('Razorpay credentials not found in environment variables')
      console.error('Key ID:', keyId ? 'Set' : 'Not set')
      console.error('Key Secret:', keySecret ? 'Set' : 'Not set')
      throw new Error('Razorpay credentials not configured')
    }

    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    })
  }

  return razorpayInstance
}
