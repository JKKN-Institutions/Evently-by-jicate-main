'use client'

import { useEffect, useState } from 'react'

export function MagicalCursor() {
  const [mounted, setMounted] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isPointer, setIsPointer] = useState(false)
  const [isClicking, setIsClicking] = useState(false)
  const [trails, setTrails] = useState<Array<{ x: number; y: number; id: number }>>([])

  useEffect(() => {
    setMounted(true)
    let trailId = 0

    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
      
      // Add trail point
      setTrails(prev => {
        const newTrail = { x: e.clientX, y: e.clientY, id: trailId++ }
        return [...prev.slice(-8), newTrail]
      })

      // Check if hovering over interactive element
      const target = e.target as HTMLElement
      const isInteractive = target.tagName === 'BUTTON' || 
                           target.tagName === 'A' || 
                           target.closest('button') || 
                           target.closest('a') ||
                           target.style.cursor === 'pointer' ||
                           getComputedStyle(target).cursor === 'pointer'
      setIsPointer(isInteractive)
    }

    const handleMouseDown = () => setIsClicking(true)
    const handleMouseUp = () => setIsClicking(false)

    document.addEventListener('mousemove', updateMousePosition)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', updateMousePosition)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Only show on desktop
  if (!mounted || window.innerWidth < 1024) return null

  return (
    <>
      {/* Trail Effect */}
      {trails.map((trail, index) => (
        <div
          key={trail.id}
          className="fixed pointer-events-none z-50 transition-opacity duration-300"
          style={{
            left: trail.x,
            top: trail.y,
            transform: 'translate(-50%, -50%)',
            opacity: (index + 1) / trails.length * 0.5
          }}
        >
          <div 
            className="w-2 h-2 rounded-full bg-gradient-to-r from-[#ffde59] to-[#0b6d41]"
            style={{
              transform: `scale(${(index + 1) / trails.length})`,
              filter: 'blur(0.5px)'
            }}
          />
        </div>
      ))}

      {/* Main Cursor */}
      <div
        className={`fixed pointer-events-none z-50 transition-all duration-200 ${
          isPointer ? 'scale-150' : 'scale-100'
        } ${isClicking ? 'scale-75' : ''}`}
        style={{
          left: mousePosition.x,
          top: mousePosition.y,
          transform: 'translate(-50%, -50%)'
        }}
      >
        {/* Outer Ring */}
        <div className={`absolute inset-0 w-8 h-8 rounded-full border-2 transition-all duration-200 ${
          isPointer 
            ? 'border-[#ffde59] bg-[#ffde59]/10 animate-pulse-glow' 
            : 'border-white/30 bg-white/5'
        }`} />
        
        {/* Inner Dot */}
        <div className={`absolute top-1/2 left-1/2 w-2 h-2 rounded-full transition-all duration-200 ${
          isPointer 
            ? 'bg-[#ffde59] shadow-lg animate-pulse' 
            : 'bg-white/50'
        }`} style={{ transform: 'translate(-50%, -50%)' }} />

        {/* Click Ripple */}
        {isClicking && (
          <div className="absolute inset-0 w-8 h-8 rounded-full border-2 border-[#ffde59] animate-ping" />
        )}

        {/* Sparkle Effect for Interactive Elements */}
        {isPointer && (
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '2s' }}>
            <div className="absolute -top-1 left-1/2 w-1 h-1 bg-[#ffde59] rounded-full animate-pulse" />
            <div className="absolute -right-1 top-1/2 w-1 h-1 bg-[#0b6d41] rounded-full animate-pulse animation-delay-300" />
            <div className="absolute -bottom-1 left-1/2 w-1 h-1 bg-[#f5c842] rounded-full animate-pulse animation-delay-600" />
            <div className="absolute -left-1 top-1/2 w-1 h-1 bg-[#15a862] rounded-full animate-pulse animation-delay-900" />
          </div>
        )}
      </div>
    </>
  )
}