import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
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

    // Fetch user's QR codes from database
    const { data: qrCodes, error: fetchError } = await supabase
      .from('qr_codes')
      .select(`
        id,
        qr_data,
        qr_type,
        description,
        created_at,
        metadata
      `)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (fetchError) {
      console.error('Error fetching QR codes:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch QR codes' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      qrCodes: qrCodes || [],
      count: qrCodes?.length || 0
    })

  } catch (error) {
    console.error('QR history fetch error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch QR history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
