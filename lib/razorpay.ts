// This file should only contain client-side code
// Server-side Razorpay instance will be created where needed

// Client-side Razorpay configuration
let scriptLoaded = false
let scriptLoading: Promise<boolean> | null = null

export const loadRazorpayScript = (): Promise<boolean> => {
  if (scriptLoaded) {
    return Promise.resolve(true)
  }

  if (scriptLoading) {
    return scriptLoading
  }

  scriptLoading = new Promise((resolve) => {
    const existingScript = document.getElementById('razorpay-checkout-js')
    if (existingScript) {
      scriptLoaded = true
      resolve(true)
      return
    }

    const script = document.createElement('script')
    script.id = 'razorpay-checkout-js'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => {
      scriptLoaded = true
      resolve(true)
    }
    script.onerror = () => {
      scriptLoading = null
      resolve(false)
    }
    document.body.appendChild(script)
  })

  return scriptLoading
}

export interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  handler: (response: RazorpayResponse) => void
  prefill: {
    name: string
    email: string
    contact: string
  }
  theme: {
    color: string
  }
  modal?: {
    ondismiss?: () => void
    escape?: boolean
    backdropclose?: boolean
    confirm_close?: boolean
  }
  retry?: {
    enabled?: boolean
    max_count?: number
  }
}

export interface RazorpayResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open: () => void
      on: (event: string, callback: () => void) => void
    }
  }
}
