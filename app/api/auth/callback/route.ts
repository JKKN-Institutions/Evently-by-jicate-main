import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin
  
  console.log('Auth callback received:', { code: !!code, origin })
  
  if (code) {
    try {
      const supabase = await createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Auth exchange error:', error)
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error.message)}`)
      }
      
      console.log('Auth exchange successful')
      
      // Get the user information
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.error('Failed to get user after auth:', userError)
        return NextResponse.redirect(`${origin}/auth/error?message=Failed to retrieve user information`)
      }
      
      console.log('User retrieved:', { id: user.id, email: user.email })
      
      // Check if user profile exists, create if not
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        console.log('Creating new user profile')
        const { error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email!,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            avatar_url: user.user_metadata?.avatar_url || null,
            role: 'user'
          })
        
        if (createError) {
          console.error('Failed to create user profile:', createError)
          return NextResponse.redirect(`${origin}/auth/error?message=Failed to create user profile`)
        }
        
        console.log('User profile created successfully')
      } else if (profileError) {
        console.error('Failed to fetch user profile:', profileError)
        return NextResponse.redirect(`${origin}/auth/error?message=Database error`)
      } else {
        console.log('User profile exists:', { role: profile?.role })
      }
      
    } catch (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(`${origin}/auth/error?message=Authentication failed`)
    }
  } else {
    console.log('No code provided in callback')
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  // URL to redirect to after sign in process completes
  console.log('Redirecting to home page')
  return NextResponse.redirect(`${origin}/`)
}