import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing Supabase Connection...')
    
    const supabase = await createClient()
    
    const tests = {
      connection: false,
      events: { success: false, count: 0, error: null as string | null },
      tickets: { success: false, count: 0, error: null as string | null },
      profiles: { success: false, count: 0, error: null as string | null },
      stats: { success: false, error: null as string | null, needsFix: false }
    }
    
    // Test 1: Basic connection - check events table
    const { data: events, error: eventsError, count: eventsCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
    
    if (!eventsError) {
      tests.connection = true
      tests.events.success = true
      tests.events.count = eventsCount || 0
    } else {
      tests.events.error = eventsError.message
    }
    
    // Test 2: Check tickets table
    const { count: ticketsCount, error: ticketsError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
    
    if (!ticketsError) {
      tests.tickets.success = true
      tests.tickets.count = ticketsCount || 0
    } else {
      tests.tickets.error = ticketsError.message
    }
    
    // Test 3: Check profiles table
    const { count: profilesCount, error: profilesError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
    
    if (!profilesError) {
      tests.profiles.success = true
      tests.profiles.count = profilesCount || 0
    } else {
      tests.profiles.error = profilesError.message
    }
    
    // Test 4: Check event_verification_stats (this is where RLS issues occur)
    const { data: stats, error: statsError } = await supabase
      .from('event_verification_stats')
      .select('*')
      .limit(1)
    
    if (!statsError) {
      tests.stats.success = true
    } else {
      tests.stats.error = statsError.message
      if (statsError.code === '42501') {
        tests.stats.needsFix = true
      }
    }
    
    // Get Supabase project info
    const projectInfo = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      appName: process.env.NEXT_PUBLIC_APP_NAME
    }
    
    return NextResponse.json({
      success: tests.connection,
      message: tests.connection 
        ? '✅ Successfully connected to Supabase!' 
        : '❌ Failed to connect to Supabase',
      projectInfo,
      tests,
      recommendations: [
        tests.stats.needsFix ? '⚠️ RLS fix needed for event_verification_stats table' : null,
        !tests.connection ? '❌ Check your Supabase credentials in .env.local' : null,
        tests.connection ? '✅ Your Supabase connection is working' : null
      ].filter(Boolean)
    })
    
  } catch (error: any) {
    console.error('Connection test error:', error)
    return NextResponse.json({
      success: false,
      message: '❌ Connection test failed',
      error: error.message,
      projectInfo: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    }, { status: 500 })
  }
}