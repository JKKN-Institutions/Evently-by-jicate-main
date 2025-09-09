'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Plus, X, Calendar, Ticket, QrCode, Sparkles, Zap, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

const fabActions = [
  { 
    label: 'Create Event', 
    href: '/events/create', 
    icon: Calendar, 
    gradient: 'from-[#ffde59] to-[#f5c842]',
    delay: 'delay-100'
  },
  { 
    label: 'My Tickets', 
    href: '/tickets', 
    icon: Ticket, 
    gradient: 'from-[#0b6d41] to-[#15a862]',
    delay: 'delay-150'
  },
  { 
    label: 'Scan Ticket', 
    href: '/scan', 
    icon: QrCode, 
    gradient: 'from-[#f5c842] to-[#0b6d41]',
    delay: 'delay-200'
  },
]

export default function FloatingActionButton() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const fabRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
    
    // Check user authentication
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
    
    const handleClickOutside = (event: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
      }
    }

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExpanded, supabase])

  // Don't show FAB if user is not authenticated or loading
  if (isLoading || !user) {
    return null
  }

  return (
    <>
      {/* Enhanced overlay with blur */}
      {isExpanded && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-all duration-300 animate-slide-in"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* FAB Container with floating particles */}
      <div 
        ref={fabRef}
        className="lg:hidden fixed bottom-16 right-4 z-50"
      >
        {/* Floating Particles */}
        {mounted && isExpanded && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-float"
                style={{
                  left: `${Math.random() * 150 - 30}px`,
                  top: `${Math.random() * 150 - 30}px`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${3 + Math.random() * 2}s`
                }}
              >
                <Sparkles className="w-2 h-2 text-[#ffde59]/60" />
              </div>
            ))}
          </div>
        )}

        {/* Enhanced Sub-actions */}
        <div className={`absolute bottom-12 right-0 transition-all duration-500 ${
          isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
        }`}>
          <div className="flex flex-col items-end gap-3">
            {fabActions.map((action, index) => (
              <Link
                key={action.href}
                href={action.href}
                onClick={() => setIsExpanded(false)}
                className={`group relative overflow-hidden flex items-center gap-2 glass-dark backdrop-blur-xl rounded-xl shadow-2xl px-3 py-2 transform transition-all duration-500 hover:scale-110 hover:-rotate-2 border border-white/20 ${
                  isExpanded 
                    ? `translate-y-0 animate-bounce-in ${action.delay}` 
                    : 'translate-y-8'
                }`}
              >
                {/* Glow Effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className={`absolute inset-0 bg-gradient-to-r ${action.gradient} opacity-20 rounded-2xl blur-xl`} />
                </div>

                <span className="relative text-xs font-bold text-white whitespace-nowrap group-hover:text-[#ffde59] transition-colors duration-300 z-10">
                  {action.label}
                </span>
                
                {/* Enhanced Icon Container */}
                <div className="relative">
                  <div className={`w-8 h-8 bg-gradient-to-br ${action.gradient} rounded-xl flex items-center justify-center shadow-xl group-hover:shadow-2xl transition-all duration-300 group-hover:rotate-12`} style={{ minWidth: '32px', minHeight: '32px' }}>
                    <action.icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#ffde59] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-ping">
                    <Star className="w-1 h-1 text-[#0b6d41] m-1" />
                  </div>
                </div>

                {/* Shimmer Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </Link>
            ))}
          </div>
        </div>

        {/* Enhanced Main FAB Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`group relative w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transform transition-all duration-500 hover:scale-125 active:scale-95 overflow-hidden ${
            isExpanded 
              ? 'rotate-180 bg-gradient-to-br from-red-500 to-red-600 animate-pulse-glow' 
              : 'bg-gradient-to-br from-[#ffde59] via-[#f5c842] to-[#ffeb8f] animate-gradient hover:shadow-neon'
          }`}
          style={{ width: '48px', height: '48px' }}
          aria-label={isExpanded ? 'Close menu' : 'Open menu'}
        >
          {/* Background Animation */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          
          {/* Floating Elements Around FAB */}
          {mounted && !isExpanded && (
            <div className="absolute inset-0 animate-spin" style={{ animationDuration: '20s' }}>
              <Sparkles className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-3 h-3 text-white/60" />
              <Zap className="absolute top-1/2 -right-1 transform -translate-y-1/2 w-2 h-2 text-white/40" />
              <Star className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 text-white/50" />
            </div>
          )}

          {/* Icon with Animation */}
          <div className="relative z-10">
            {isExpanded ? (
              <X className="h-5 w-5 font-bold text-white animate-rotate-in" />
            ) : (
              <Plus className="h-5 w-5 font-bold text-[#0b6d41] group-hover:animate-bounce" />
            )}
          </div>

          {/* Pulsing Ring */}
          <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping opacity-50" />
          
          {/* Inner Glow */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
        </button>

        {/* Magical Trail Effect */}
        {mounted && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-[#ffde59] rounded-full animate-ping" style={{ animationDelay: '0s' }} />
            <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-[#0b6d41] rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
            <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-[#f5c842] rounded-full animate-ping" style={{ animationDelay: '1s' }} />
          </div>
        )}
      </div>
    </>
  )
}