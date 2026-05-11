import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { OrganizationProvider } from './context/OrganizationContext'
import Navigation from './components/Navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Keep Home ERP',
  description: 'Manage your home inventory',
  manifest: '/manifest.json',
  themeColor: '#0a0a0a',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Keep ERP',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        
        {/* Wrap everything in the Provider */}
        <OrganizationProvider>
          
          {/* Global Navigation */}
          <Navigation />

          <main className="max-w-6xl mx-auto pt-6 px-4">
            {children}
          </main>

        </OrganizationProvider>

      </body>
    </html>
  )
}