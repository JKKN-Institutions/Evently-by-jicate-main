'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export default function AuthError() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b6d41] to-[#ffde59] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Authentication Error
          </h1>
          
          <p className="text-gray-600 mb-6">
            There was a problem signing you in. This might be due to an expired link or incorrect configuration.
          </p>
          
          <div className="space-y-3 w-full">
            <Link
              href="/auth/sign-in"
              className="block w-full bg-[#0b6d41] text-white py-3 px-4 rounded-lg hover:bg-[#0a5d37] transition-colors text-center font-medium"
            >
              Try Again
            </Link>
            
            <Link
              href="/"
              className="block w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors text-center font-medium"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}