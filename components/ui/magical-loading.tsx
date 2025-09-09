'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Star, Zap, Circle } from 'lucide-react'

interface MagicalLoadingProps {
  isLoading?: boolean
  message?: string
  size?: 'sm' | 'md' | 'lg' | 'full'
}

export function MagicalLoading({ 
  isLoading = true, 
  message = "Creating magic...", 
  size = 'md' 
}: MagicalLoadingProps) {
  const [mounted, setMounted] = useState(false)
  const [dots, setDots] = useState('')

  useEffect(() => {
    setMounted(true)
    
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return ''
        return prev + '.'
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-32 h-32',
    lg: 'w-48 h-48',
    full: 'w-64 h-64'
  }

  const particleCount = {
    sm: 6,
    md: 12,
    lg: 20,
    full: 30
  }

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-dark backdrop-blur-2xl">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="blob blob-yellow w-96 h-96 -top-48 -left-48 animate-blob opacity-30" />
        <div className="blob blob-green w-96 h-96 -bottom-48 -right-48 animate-blob animation-delay-2000 opacity-20" />
        <div className="blob blob-yellow w-64 h-64 top-1/2 left-1/3 animate-blob animation-delay-4000 opacity-25" />
      </div>

      <div className="relative flex flex-col items-center gap-8 z-10">
        {/* Main Loading Spinner */}
        <div className={`relative ${sizeClasses[size]} flex items-center justify-center`}>
          {/* Outer Rotating Ring */}
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#ffde59] border-r-[#0b6d41] animate-spin" />
          <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-[#f5c842] border-l-[#15a862] animate-spin animation-delay-500" style={{ animationDirection: 'reverse' }} />
          
          {/* Inner Pulsing Core */}
          <div className="relative w-16 h-16 bg-gradient-to-br from-[#ffde59] via-[#f5c842] to-[#0b6d41] rounded-full animate-pulse-glow shadow-2xl flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white animate-bounce" />
          </div>

          {/* Floating Particles */}
          {mounted && [...Array(particleCount[size])].map((_, i) => (
            <div
              key={i}
              className="absolute animate-float"
              style={{
                left: `${50 + (Math.cos((i * 360) / particleCount[size] * Math.PI / 180) * 60)}%`,
                top: `${50 + (Math.sin((i * 360) / particleCount[size] * Math.PI / 180) * 60)}%`,
                transform: 'translate(-50%, -50%)',
                animationDelay: `${i * 0.1}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
            >
              {i % 3 === 0 && <Sparkles className="w-3 h-3 text-[#ffde59]/70" />}
              {i % 3 === 1 && <Star className="w-2 h-2 text-[#0b6d41]/60" />}
              {i % 3 === 2 && <Circle className="w-1 h-1 text-[#f5c842]/50 fill-current" />}
            </div>
          ))}

          {/* Energy Waves */}
          <div className="absolute inset-0 rounded-full border border-[#ffde59]/30 animate-ping" />
          <div className="absolute inset-4 rounded-full border border-[#0b6d41]/20 animate-ping animation-delay-1000" />
          <div className="absolute inset-8 rounded-full border border-[#f5c842]/15 animate-ping animation-delay-2000" />
        </div>

        {/* Loading Text with Animation */}
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-black gradient-text-animated">
            {message.split(' ').map((word, i) => (
              <span key={i} className={`inline-block animate-bounce stagger-${i + 1}`} style={{ animationDelay: `${i * 0.1}s` }}>
                {word}&nbsp;
              </span>
            ))}
          </h2>
          
          <div className="flex items-center justify-center gap-2 text-white/80">
            <Zap className="w-4 h-4 animate-pulse text-[#ffde59]" />
            <span className="text-lg font-semibold">
              Loading{dots}
            </span>
            <Zap className="w-4 h-4 animate-pulse text-[#0b6d41]" />
          </div>

          {/* Progress Dots */}
          <div className="flex items-center gap-2 justify-center">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full bg-gradient-to-r from-[#ffde59] to-[#0b6d41] animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>

        {/* Magic Trails */}
        {mounted && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-[#ffde59] rounded-full animate-ping opacity-60"
                style={{
                  left: `${20 + Math.random() * 60}%`,
                  top: `${20 + Math.random() * 60}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random()}s`
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Alternative compact loading component
export function MagicalSpinner({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  }

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#ffde59] border-r-[#0b6d41] animate-spin" />
      <div className="absolute inset-1 rounded-full border-2 border-transparent border-b-[#f5c842] border-l-[#15a862] animate-spin animation-delay-300" style={{ animationDirection: 'reverse' }} />
      <div className="absolute inset-2 w-4 h-4 bg-gradient-to-br from-[#ffde59] to-[#0b6d41] rounded-full animate-pulse" />
    </div>
  )
}

// Page transition loading
export function PageTransitionLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[#0b6d41]/90 to-[#15a862]/90 backdrop-blur-xl">
      <div className="relative">
        <MagicalSpinner size="lg" />
        <div className="absolute -inset-4 rounded-full border border-[#ffde59]/30 animate-ping" />
        <div className="absolute -inset-8 rounded-full border border-[#0b6d41]/20 animate-ping animation-delay-1000" />
      </div>
    </div>
  )
}