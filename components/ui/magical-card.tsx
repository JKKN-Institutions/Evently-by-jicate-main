'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { Sparkles, Star, Zap } from 'lucide-react'

interface MagicalCardProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'glass' | 'gradient' | 'neon' | 'floating'
  hover3D?: boolean
  sparkleEffect?: boolean
  glowEffect?: boolean
  onClick?: () => void
}

export function MagicalCard({ 
  children, 
  className = '', 
  variant = 'default',
  hover3D = true,
  sparkleEffect = true,
  glowEffect = false,
  onClick 
}: MagicalCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return
    
    const rect = cardRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    
    setMousePosition({ x, y })
  }

  const getVariantClasses = () => {
    switch (variant) {
      case 'glass':
        return 'glass backdrop-blur-xl border border-white/20 shadow-2xl'
      case 'gradient':
        return 'bg-gradient-to-br from-[#ffde59]/10 via-[#f5c842]/5 to-[#0b6d41]/10 border border-[#ffde59]/20 shadow-xl'
      case 'neon':
        return 'glass border-2 border-[#ffde59] shadow-neon bg-black/20'
      case 'floating':
        return 'glass backdrop-blur-md shadow-2xl border border-white/10 bg-white/5'
      default:
        return 'bg-white border border-gray-200 shadow-lg'
    }
  }

  return (
    <div
      ref={cardRef}
      className={`
        relative overflow-hidden rounded-3xl transition-all duration-500 cursor-pointer
        ${getVariantClasses()}
        ${hover3D ? 'transform-gpu hover:scale-[1.02] hover:-rotate-1' : ''}
        ${glowEffect ? 'animate-pulse-glow' : ''}
        ${className}
      `}
      style={{
        transform: hover3D && isHovered 
          ? `perspective(1000px) rotateX(${(mousePosition.y - 50) * 0.1}deg) rotateY(${(mousePosition.x - 50) * 0.1}deg) translateZ(20px)`
          : undefined
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Interactive Gradient Overlay */}
      <div 
        className="absolute inset-0 opacity-0 hover:opacity-30 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(255, 222, 89, 0.3) 0%, rgba(11, 109, 65, 0.1) 50%, transparent 70%)`
        }}
      />

      {/* Shimmer Effect */}
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-700 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000" />
      </div>

      {/* Sparkle Effects */}
      {sparkleEffect && mounted && isHovered && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce-in"
              style={{
                left: `${20 + Math.random() * 60}%`,
                top: `${20 + Math.random() * 60}%`,
                animationDelay: `${Math.random() * 0.5}s`
              }}
            >
              {i % 3 === 0 && <Sparkles className="w-3 h-3 text-[#ffde59]/70 animate-pulse" />}
              {i % 3 === 1 && <Star className="w-2 h-2 text-[#0b6d41]/60 animate-pulse" />}
              {i % 3 === 2 && <Zap className="w-2 h-2 text-[#f5c842]/50 animate-pulse" />}
            </div>
          ))}
        </div>
      )}

      {/* Glow Border */}
      {glowEffect && (
        <div className="absolute inset-0 rounded-3xl border-2 border-[#ffde59]/50 animate-pulse-glow" />
      )}

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>

      {/* Corner Decorations */}
      {variant === 'neon' && (
        <>
          <div className="absolute top-4 right-4 w-2 h-2 bg-[#ffde59] rounded-full animate-ping" />
          <div className="absolute bottom-4 left-4 w-1 h-1 bg-[#0b6d41] rounded-full animate-ping animation-delay-1000" />
        </>
      )}
    </div>
  )
}

// Specialized card variants
export function GlassCard({ children, className = '', ...props }: Omit<MagicalCardProps, 'variant'>) {
  return <MagicalCard variant="glass" className={className} {...props}>{children}</MagicalCard>
}

export function GradientCard({ children, className = '', ...props }: Omit<MagicalCardProps, 'variant'>) {
  return <MagicalCard variant="gradient" className={className} {...props}>{children}</MagicalCard>
}

export function NeonCard({ children, className = '', ...props }: Omit<MagicalCardProps, 'variant'>) {
  return <MagicalCard variant="neon" className={className} {...props}>{children}</MagicalCard>
}

export function FloatingCard({ children, className = '', ...props }: Omit<MagicalCardProps, 'variant'>) {
  return <MagicalCard variant="floating" className={className} {...props}>{children}</MagicalCard>
}