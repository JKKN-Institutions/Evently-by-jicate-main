import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Test getting current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      return NextResponse.json({ 
        error: 'Failed to get session',
        details: sessionError.message 
      }, { status: 500 })
    }
    
    // Test sign out
    const { error: signOutError } = await supabase.auth.signOut()
    
    if (signOutError) {
      return NextResponse.json({ 
        error: 'Failed to sign out',
        details: signOutError.message 
      }, { status: 500 })
    }
    
    // Verify session is cleared
    const { data: { session: newSession } } = await supabase.auth.getSession()
    
    return NextResponse.json({
      success: true,
      previousSession: session ? {
        email: session.user.email,
        id: session.user.id
      } : null,
      currentSession: newSession ? 'Session still exists!' : 'Session cleared successfully',
      message: 'Sign out test completed'
    })
  } catch (error) {
    console.error('Test sign out error:', error)
    return NextResponse.json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}