'use client'

import { usePathname } from 'next/navigation'

interface MinimalLayoutProps {
  children: React.ReactNode
}

export default function MinimalLayout({ children }: MinimalLayoutProps) {
  const pathname = usePathname()
  
  // If we're on auth pages, just render children without any wrapper
  const isOnAuthPage = pathname === '/login' || pathname.startsWith('/auth/')
  
  if (isOnAuthPage) {
    return <>{children}</>
  }
  
  // For other pages, provide a simple layout
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  )
}