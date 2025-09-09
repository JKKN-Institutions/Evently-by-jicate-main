'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, Plus, Ticket, User } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User as SupabaseUser } from '@supabase/supabase-js'

// Navigation items for authenticated users only
const userNavigationItems = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Events', href: '/events', icon: Calendar },
  { name: '', href: '/events/create', icon: Plus, isFab: true },
  { name: 'Bookings', href: '/bookings', icon: Ticket },
  { name: 'Profile', href: '/profile', icon: User },
]

export default function BottomNavigation() {
  const pathname = usePathname()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('Error checking user:', error)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  // Only show navigation for authenticated users
  const navigationItems = user ? userNavigationItems : []

  // Don't show navigation if user is not authenticated or loading
  if (isLoading || !user) {
    return null
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-2xl z-50">
      <div className="flex items-center justify-around h-16">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href))

          if (item.isFab) {
            // Central FAB placeholder
            return (
              <div key={item.href} className="w-14" />
            )
          }


          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full py-2 transition-all duration-200 group ${
                isActive 
                  ? 'text-[#0b6d41]' 
                  : 'text-slate-500 hover:text-[#0b6d41]'
              }`}
            >
              <div className={`relative ${
                isActive 
                  ? 'bg-gradient-to-r from-[#ffde59]/20 to-[#fff4a3]/20 rounded-full p-2' 
                  : 'group-hover:bg-gray-100 rounded-full p-2 transition-colors duration-200'
              }`}>
                <item.icon 
                  className={`h-5 w-5 transition-all duration-200 ${
                    isActive ? 'text-[#0b6d41]' : 'text-slate-500 group-hover:text-[#0b6d41] group-hover:scale-110'
                  }`} 
                />
                {isActive && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-[#ffde59] rounded-full"></div>
                )}
              </div>
              <span className={`text-xs mt-1 font-medium transition-all duration-200 ${
                isActive ? 'text-[#0b6d41]' : 'text-slate-500 group-hover:text-[#0b6d41]'
              }`}>
                {item.name}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
