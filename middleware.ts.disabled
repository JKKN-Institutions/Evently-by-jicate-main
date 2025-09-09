import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  const publicPaths = [
    '/auth/sign-in',
    '/auth/signin', 
    '/auth/callback',
    '/api/auth',
  ]
  
  const isPublicPath = publicPaths.some(path => 
    request.nextUrl.pathname === path || 
    request.nextUrl.pathname.startsWith('/api/auth') ||
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.includes('.')
  )
  
  if (isPublicPath) {
    return response
  }
  
  const hasAuthCookie = request.cookies.has('sb-access-token') || 
                        request.cookies.has('sb-refresh-token')
  
  if (!hasAuthCookie && !isPublicPath) {
    const redirectUrl = new URL('/auth/sign-in', request.url)
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }
  
  if (hasAuthCookie && request.nextUrl.pathname.startsWith('/auth/sign-in')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}