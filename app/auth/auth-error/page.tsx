'use client'

import Link from 'next/link'

export default function AuthError() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-md">
        <h1 className="mb-4 text-3xl font-bold text-red-600">
          Authentication Error
        </h1>
        <p className="mb-6 text-gray-700">
          There was a problem signing you in. This might be due to an expired
          link or an incorrect configuration.
        </p>
        <p className="mb-8 text-sm text-gray-500">
          Please try signing in again. If the problem persists, please contact
          support.
        </p>
        <Link
          href="/auth/sign-in"
          className="rounded-md bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Return to Sign In
        </Link>
      </div>
    </div>
  )
}