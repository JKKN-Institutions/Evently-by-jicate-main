import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get current session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      return NextResponse.json({ 
        error: 'No active session', 
        details: sessionError?.message || 'Session not found' 
      }, { status: 401 })
    }
    
    const user = session.user

    console.log('🔍 Debug - User ID:', user.id)
    console.log('🔍 Debug - User Email:', user.email)

    // Get profile by ID
    const { data: profileById, error: idError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    console.log('🔍 Debug - Profile by ID:', profileById, 'Error:', idError)

    // Get profile by email
    const { data: profileByEmail, error: emailError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', user.email)
      .single()

    console.log('🔍 Debug - Profile by Email:', profileByEmail, 'Error:', emailError)

    // Get all profiles for this email (in case of duplicates)
    const { data: allProfiles, error: allError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', user.email)

    console.log('🔍 Debug - All profiles for email:', allProfiles, 'Error:', allError)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata
      },
      profileById: { data: profileById, error: idError },
      profileByEmail: { data: profileByEmail, error: emailError },
      allProfiles: { data: allProfiles, error: allError }
    })

  } catch (error) {
    console.error('Debug profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
