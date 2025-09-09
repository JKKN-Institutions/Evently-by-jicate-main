'use client'

import { ReactNode, useState, useRef, useEffect } from 'react'
import { Sparkles, Star, Zap } from 'lucide-react'

interface MagicalButtonProps {
  children: ReactNode
  className?: string
  variant?: 'primary' | 'secondary' | 'glass' | 'gradient' | 'neon' | 'ghost'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  disabled?: boolean
  loading?: boolean
  rippleEffect?: boolean
  sparkleEffect?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
}

export function MagicalButton({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  rippleEffect = true,
  sparkleEffect = true,
  onClick,
  type = 'button'
}: MagicalButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([])
  const [isHovered, setIsHovered] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleClick = (e: React.MouseEvent) => {
    if (disabled || loading) return
    
    if (rippleEffect && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const rippleId = Date.now()
      
      setRipples(prev => [...prev, { id: rippleId, x, y }])
      
      setTimeout(() => {
        setRipples(prev => prev.filter(ripple => ripple.id !== rippleId))
      }, 600)
    }
    
    onClick?.()
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-4 py-2 text-sm rounded-xl'
      case 'md':
        return 'px-6 py-3 text-base rounded-2xl'
      case 'lg':
        return 'px-8 py-4 text-lg rounded-2xl'
      case 'xl':
        return 'px-12 py-6 text-xl rounded-3xl'
      default:
        return 'px-6 py-3 text-base rounded-2xl'
    }
  }

  const getVariantClasses = () => {
    if (disabled) {
      return 'bg-gray-300 text-gray-500 cursor-not-allowed'
    }

    switch (variant) {
      case 'primary':
        return 'bg-gradient-to-r from-[#ffde59] via-[#f5c842] to-[#ffeb8f] text-[#0b6d41] font-bold shadow-lg hover:shadow-xl animate-gradient'
      case 'secondary':
        return 'bg-gradient-to-r from-[#0b6d41] to-[#15a862] text-white font-bold shadow-lg hover:shadow-xl'
      case 'glass':
        return 'glass backdrop-blur-xl border border-white/20 text-white font-semibold shadow-xl hover:shadow-2xl'
      case 'gradient':
        return 'bg-gradient-to-br from-[#ffde59]/20 to-[#0b6d41]/20 border-2 border-[#ffde59] text-[#0b6d41] font-bold hover:bg-gradient-to-br hover:from-[#ffde59] hover:to-[#f5c842]'
      case 'neon':
        return 'glass border-2 border-[#ffde59] text-[#ffde59] font-bold shadow-neon hover:bg-[#ffde59] hover:text-[#0b6d41]'
      case 'ghost':
        return 'bg-transparent border-2 border-[#0b6d41] text-[#0b6d41] font-semibold hover:bg-[#0b6d41] hover:text-white'
      default:
        return 'bg-gradient-to-r from-[#ffde59] to-[#f5c842] text-[#0b6d41] font-bold shadow-lg hover:shadow-xl'
    }
  }

  return (
    <button
      ref={buttonRef}
      type={type}
      disabled={disabled || loading}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative overflow-hidden transition-all duration-300 transform
        ${getSizeClasses()}
        ${getVariantClasses()}
        ${!disabled && !loading ? 'hover:scale-105 active:scale-95' : ''}
        ${className}
      `}
    >
      {/* Background Gradient Animation */}
      {variant === 'primary' && (
        <div className="absolute inset-0 bg-gradient-to-r from-[#ffde59] via-[#f5c842] to-[#ffeb8f] animate-gradient" />
      )}

      {/* Shimmer Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

      {/* Ripple Effects */}
      {ripples.map(ripple => (
        <div
          key={ripple.id}
          className="absolute rounded-full bg-white/30 animate-ping"
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20
          }}
        />
      ))}

      {/* Loading Spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-inherit rounded-inherit">
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Sparkle Effects */}
      {sparkleEffect && mounted && isHovered && !disabled && !loading && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce-in"
              style={{
                left: `${15 + Math.random() * 70}%`,
                top: `${15 + Math.random() * 70}%`,
                animationDelay: `${Math.random() * 0.3}s`
              }}
            >
              {i % 3 === 0 && <Sparkles className="w-2 h-2 text-white/80 animate-pulse" />}
              {i % 3 === 1 && <Star className="w-2 h-2 text-white/60 animate-pulse" />}
              {i % 3 === 2 && <Zap className="w-1 h-1 text-white/70 animate-pulse" />}
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <span className={`relative z-10 flex items-center gap-2 justify-center ${loading ? 'opacity-0' : ''}`}>
        {children}
      </span>

      {/* Glow Effect for Neon Variant */}
      {variant === 'neon' && isHovered && (
        <div className="absolute inset-0 rounded-inherit border-2 border-[#ffde59] animate-pulse-glow" />
      )}

      {/* Floating Elements */}
      {(variant === 'primary' || variant === 'gradient') && isHovered && mounted && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#0b6d41] rounded-full animate-bounce opacity-80" />
      )}
    </button>
  )
}

// Specialized button variants
export function PrimaryButton(props: Omit<MagicalButtonProps, 'variant'>) {
  return <MagicalButton variant="primary" {...props} />
}

export function SecondaryButton(props: Omit<MagicalButtonProps, 'variant'>) {
  return <MagicalButton variant="secondary" {...props} />
}

export function GlassButton(props: Omit<MagicalButtonProps, 'variant'>) {
  return <MagicalButton variant="glass" {...props} />
}

export function NeonButton(props: Omit<MagicalButtonProps, 'variant'>) {
  return <MagicalButton variant="neon" {...props} />
}

export function GhostButton(props: Omit<MagicalButtonProps, 'variant'>) {
  return <MagicalButton variant="ghost" {...props} />
}