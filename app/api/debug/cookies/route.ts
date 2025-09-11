import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('sb-') || 
      cookie.name.includes('auth') || 
      cookie.name.includes('supabase') ||
      cookie.name.includes('pkce')
    )
    
    return NextResponse.json({
      totalCookies: allCookies.length,
      authCookies: authCookies.map(c => ({
        name: c.name,
        hasValue: !!c.value,
        valueLength: c.value?.length || 0
      })),
      allCookieNames: allCookies.map(c => c.name)
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read cookies' }, { status: 500 })
  }
}
