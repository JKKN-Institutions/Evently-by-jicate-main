import { Suspense, lazy } from 'react'

// Lazy load footer
const Footer = lazy(() => import('@/components/layout/footer'))

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <main className="flex-1 pb-8">
            {children}
          </main>
          <Suspense fallback={null}>
            <Footer />
          </Suspense>
        </div>
      </body>
    </html>
  )
}
