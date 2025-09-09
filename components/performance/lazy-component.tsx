'use client'

import { lazy, Suspense, ComponentType } from 'react'

interface LazyComponentProps {
  loader: () => Promise<{ default: ComponentType<any> }>
  fallback?: React.ReactNode
  [key: string]: any
}

export default function LazyComponent({ 
  loader, 
  fallback = <div className="animate-pulse bg-gray-200 h-32 rounded-lg" />, 
  ...props 
}: LazyComponentProps) {
  const Component = lazy(loader)

  return (
    <Suspense fallback={fallback}>
      <Component {...props} />
    </Suspense>
  )
}

// Pre-configured lazy components for common heavy libraries
export const LazyQRScanner = (props: any) => (
  <LazyComponent
    loader={() => import('@/components/qr/mobile-qr-scanner')}
    fallback={
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
          <div className="animate-pulse">
            <div className="h-6 bg-white/20 rounded mb-2"></div>
            <div className="h-4 bg-white/20 rounded w-2/3"></div>
          </div>
        </div>
        <div className="p-4">
          <div className="animate-pulse">
            <div className="h-64 bg-gray-200 rounded-lg mb-4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    }
    {...props}
  />
)

export const LazyTicketTemplate = (props: any) => (
  <LazyComponent
    loader={() => import('@/components/ticket-template')}
    fallback={
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
          <div className="flex gap-2">
            <div className="h-10 bg-gray-200 rounded flex-1"></div>
            <div className="h-10 bg-gray-200 rounded flex-1"></div>
          </div>
        </div>
      </div>
    }
    {...props}
  />
)
