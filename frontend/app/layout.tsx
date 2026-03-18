import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'FeetBusiness Studio',
  description: 'Professionele foto-editor en business tool voor content creators',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl" className="dark">
      <body className="min-h-screen bg-[#09090f] text-white overflow-x-hidden">
        {/* Animated background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-[#09090f]" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full filter blur-[128px]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/5 rounded-full filter blur-[128px]" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-purple-700/3 rounded-full filter blur-[96px]" />
        </div>

        <Sidebar />

        {/* Main content */}
        <main className="relative z-10 ml-64 min-h-screen">
          <div className="p-8">
            {children}
          </div>
        </main>

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(15, 15, 30, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              color: '#f8fafc',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: {
              iconTheme: {
                primary: '#a855f7',
                secondary: '#09090f',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#09090f',
              },
            },
          }}
        />
      </body>
    </html>
  )
}
