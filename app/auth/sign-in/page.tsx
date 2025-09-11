'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { MagicalButton } from '@/components/ui/magical-button'

export default function SignInPage() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-100">
      <Suspense fallback={<div>Loading...</div>}>
        <SignInContent />
      </Suspense>
    </div>
  )
}

function SignInContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const urlError = searchParams.get('error')
    const errorMessage = searchParams.get('message')
    const errorDetails = searchParams.get('details')

    if (urlError) {
      const errorText =
        errorMessage || 'An unknown error occurred during sign-in.'
      setError(errorText)
      console.error('Sign-in error:', { urlError, errorMessage, errorDetails })
    }
  }, [searchParams])

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
      }
    } catch (err: any) {
      setError('Failed to sign in. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
      <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">
        Welcome Back
      </h1>
      <p className="mb-8 text-center text-gray-600">
        Sign in to manage your events and tickets.
      </p>

      {error && (
        <div
          className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          role="alert"
        >
          <p className="font-semibold">Authentication Error</p>
          <p>{error}</p>
        </div>
      )}

      <MagicalButton
        onClick={handleGoogleSignIn}
        loading={isLoading}
        disabled={isLoading}
        className="w-full"
        variant="secondary"
        size="lg"
      >
        Sign In with Google
      </MagicalButton>
    </div>
  )
}