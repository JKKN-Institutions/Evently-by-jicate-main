import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('🔧 Testing Supabase connection...')
    
    // Test environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      urlStart: supabaseUrl?.substring(0, 30),
      keyStart: supabaseAnonKey?.substring(0, 20)
    })
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing environment variables',
        details: {
          hasUrl: !!supabaseUrl,
          hasAnonKey: !!supabaseAnonKey
        }
      }, { status: 500 })
    }
    
    // Test Supabase connection
    const supabase = await createClient()
    
    // Try a simple query to test connection
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('Supabase query error:', error)
      return NextResponse.json({
        success: false,
        error: 'Supabase query failed',
        details: error
      }, { status: 500 })
    }
    
    // Test auth session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    return NextResponse.json({
      success: true,
      message: 'Supabase connection successful',
      details: {
        queryWorked: !error,
        hasSession: !!session,
        sessionError: sessionError?.message || null,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('Test route error:', error)
    return NextResponse.json({
      success: false,
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}