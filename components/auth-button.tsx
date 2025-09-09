'use client'

import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LogIn, LogOut, User as UserIcon, Sparkles, Star, Zap } from 'lucide-react'

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
    
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      router.refresh()
    })

    return () => subscription.unsubscribe()
  }, [router, supabase.auth])

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    
    if (error) {
      console.error('Error signing in:', error)
    }
  }

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error)
    }
    router.push('/')
  }

  if (loading) {
    return (
      <div className="relative overflow-hidden">
        <div className="loading-pulse"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <button
        onClick={handleSignIn}
        className="group relative overflow-hidden flex items-center gap-4 glass backdrop-blur-md border border-white/20 hover:border-[#ffde59]/50 px-8 py-4 rounded-2xl text-sm font-bold shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:scale-105 active:scale-95"
      >
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Shimmer Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        
        {/* Enhanced Google Icon */}
        <div className="relative flex items-center justify-center w-10 h-10 bg-white rounded-xl shadow-lg group-hover:shadow-xl group-hover:rotate-12 transition-all duration-300">
          <svg className="h-6 w-6 group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          
          {/* Floating sparkles around Google icon */}
          {mounted && (
            <div className="absolute inset-0 pointer-events-none">
              <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-[#ffde59] animate-pulse" />
              <Star className="absolute -bottom-1 -left-1 w-2 h-2 text-[#0b6d41] animate-bounce" />
            </div>
          )}
        </div>
        
        <div className="relative z-10 flex flex-col items-start">
          <span className="text-slate-700 group-hover:text-[#0b6d41] transition-colors duration-300 font-bold">
            Sign in with Google
          </span>
          <span className="text-xs text-slate-500 group-hover:text-[#ffde59] transition-colors duration-300">
            Join the community
          </span>
        </div>

        {/* Floating elements */}
        {mounted && (
          <div className="absolute top-2 right-2">
            <Zap className="w-4 h-4 text-[#ffde59]/60 animate-bounce" />
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-4">
      {/* Enhanced User Profile Display */}
      <div className="group relative overflow-hidden">
        <div className="flex items-center gap-4 glass backdrop-blur-md px-6 py-3 rounded-2xl border border-[#ffde59]/30 shadow-lg hover:shadow-xl transition-all duration-300">
          {/* Animated Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#ffde59]/10 to-[#0b6d41]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Enhanced Avatar */}
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-[#ffde59] to-[#0b6d41] rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:rotate-12 transition-all duration-300 animate-pulse-glow">
              <UserIcon className="h-6 w-6 text-white" />
            </div>
            
            {/* Status Indicator */}
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-ping">
              <div className="w-full h-full bg-green-500 rounded-full animate-pulse" />
            </div>
            
            {/* Floating elements around avatar */}
            {mounted && (
              <>
                <Star className="absolute -top-2 -left-2 w-3 h-3 text-[#ffde59] animate-float" />
                <Sparkles className="absolute -bottom-2 -right-2 w-3 h-3 text-[#0b6d41] animate-bounce" />
              </>
            )}
          </div>
          
          <div className="relative z-10 flex flex-col">
            <span className="font-bold text-slate-700 group-hover:text-[#0b6d41] transition-colors duration-300 max-w-32 truncate">
              {user.email}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-400">Authenticated</span>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Sign Out Button */}
      <button
        onClick={handleSignOut}
        className="group relative overflow-hidden flex items-center gap-3 glass backdrop-blur-md border border-red-200/30 hover:border-red-300/50 px-6 py-3 rounded-2xl text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
      >
        {/* Gradient Background on Hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-50 to-red-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Shimmer Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        
        {/* Enhanced Icon */}
        <div className="relative w-8 h-8 bg-gradient-to-br from-red-400 to-red-500 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:rotate-12 transition-all duration-300">
          <LogOut className="h-4 w-4 text-white group-hover:scale-110 transition-transform duration-300" />
        </div>
        
        <div className="relative z-10 flex flex-col items-start">
          <span className="text-slate-600 group-hover:text-red-600 transition-colors duration-300 font-bold">
            Sign Out
          </span>
          <span className="text-xs text-slate-400 group-hover:text-red-400 transition-colors duration-300">
            See you soon!
          </span>
        </div>

        {/* Warning indicator */}
        {mounted && (
          <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
          </div>
        )}
      </button>
    </div>
  )
}