import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    
    console.log('🧹 Starting auth reset...')
    
    // Get all cookies and clear auth-related ones
    const allCookies = cookieStore.getAll()
    const clearedCookies: string[] = []
    
    for (const cookie of allCookies) {
      if (cookie.name.includes('sb-') || 
          cookie.name.includes('auth') || 
          cookie.name.includes('supabase') ||
          cookie.name.includes('pkce')) {
        cookieStore.delete(cookie.name)
        clearedCookies.push(cookie.name)
      }
    }
    
    console.log(`🧹 Cleared ${clearedCookies.length} auth cookies:`, clearedCookies)
    
    // Create response with additional cookie clearing
    const response = NextResponse.redirect(
      new URL('/auth/sign-in?reset=true', 
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    )
    
    // Explicitly clear common auth cookies on the response
    const commonAuthCookies = [
      'sb-auth-token',
      'sb-refresh-token', 
      'sb-pkce-code-verifier',
      'supabase-auth-token',
      'supabase.auth.token'
    ]
    
    commonAuthCookies.forEach(cookieName => {
      response.cookies.delete(cookieName)
    })
    
    return response
  } catch (error) {
    console.error('Error resetting auth:', error)
    return NextResponse.json({ error: 'Failed to reset auth' }, { status: 500 })
  }
}