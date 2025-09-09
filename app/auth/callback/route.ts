import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/config/admin-emails'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/'
  const origin = requestUrl.origin

  console.log('🔄 OAuth callback - processing request')
  console.log('📍 Request URL:', requestUrl.toString())
  console.log('🔑 Code received:', code ? 'Yes' : 'No')
  console.log('🏠 Origin:', origin)
  console.log('➡️ Redirect to:', redirectTo)

  if (!code) {
    console.error('❌ No authorization code received')
    return NextResponse.redirect(`${origin}/auth/sign-in?error=no_code`)
  }

  try {
    const supabase = await createClient()
    console.log('🔄 OAuth callback - exchanging code for session')
    
    // The key fix: Use the proper server-side client for PKCE exchange
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('❌ OAuth exchange error:', error)
      console.error('❌ Error details:', JSON.stringify(error, null, 2))
      
      // More specific error handling
      if (error.message.includes('code verifier')) {
        console.error('🔧 PKCE code verifier issue - this suggests client/server config mismatch')
      }
      
      return NextResponse.redirect(`${origin}/auth/sign-in?error=oauth_exchange_failed&message=${encodeURIComponent(error.message)}`)
    }
    
    if (!data?.user) {
      console.error('❌ No user data after OAuth exchange')
      return NextResponse.redirect(`${origin}/auth/sign-in?error=no_user_data`)
    }
    
    console.log('✅ OAuth successful for user:', data.user.email)
    
    // Check if user profile exists
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()
    
    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('❌ Error checking profile:', profileError)
    }
    
    if (!existingProfile) {
      console.log('📝 Creating profile for new OAuth user')
      
      // Check if this email should be an admin
      const isAdmin = isAdminEmail(data.user.email)
      
      // Create profile for new OAuth user
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || '',
          role: isAdmin ? 'admin' : 'user',
          avatar_url: data.user.user_metadata?.avatar_url || null
        })
      
      if (insertError) {
        console.error('❌ Error creating profile:', insertError)
        // Don't fail the auth if profile creation fails - user is still authenticated
      } else {
        console.log(`✅ Profile created successfully with role: ${isAdmin ? 'admin' : 'user'}`)
      }
    } else {
      console.log('👤 Existing profile found:', {
        id: existingProfile.id,
        email: existingProfile.email,
        role: existingProfile.role
      })
    }
    
    // Get session to ensure it's properly set
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      console.error('❌ No session after OAuth exchange:', sessionError)
      return NextResponse.redirect(`${origin}/auth/sign-in?error=no_session_created`)
    }
    
    console.log('✅ Session confirmed for user:', session.user.email)
    
    // URL to redirect to after sign in process completes
    // Add query parameters to indicate we came from the callback and should clear cache
    const redirectUrl = new URL(redirectTo, origin)
    redirectUrl.searchParams.set('from_callback', 'true')
    redirectUrl.searchParams.set('clear_cache', 'true')
    
    console.log('✅ OAuth callback complete, redirecting to:', redirectUrl.toString())
    return NextResponse.redirect(redirectUrl.toString())
    
  } catch (error) {
    console.error('❌ Unexpected error in OAuth callback:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.redirect(`${origin}/auth/sign-in?error=callback_error&details=${encodeURIComponent(String(error))}`)
  }
}