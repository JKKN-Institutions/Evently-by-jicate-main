import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Check if table already exists
    const { data: existingTable, error: checkError } = await supabase
      .from('printed_tickets')
      .select('id')
      .limit(1)

    if (!checkError) {
      return NextResponse.json({
        success: true,
        message: 'Printed tickets table already exists',
        tableExists: true
      })
    }

    // If table doesn't exist, provide setup instructions
    if (checkError.code === 'PGRST116' || checkError.message.includes('does not exist')) {
      return NextResponse.json({
        success: false,
        message: 'Printed tickets table does not exist',
        tableExists: false,
        instructions: {
          step1: 'Go to your Supabase dashboard',
          step2: 'Navigate to SQL Editor',
          step3: 'Run the SQL schema from supabase/printed-tickets-schema.sql',
          step4: 'Refresh this page after running the schema'
        },
        sqlFile: 'supabase/printed-tickets-schema.sql'
      })
    }

    // Other error
    return NextResponse.json(
      { error: 'Failed to check table status', details: checkError.message },
      { status: 500 }
    )

  } catch (error) {
    console.error('Error checking printed tickets table:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
