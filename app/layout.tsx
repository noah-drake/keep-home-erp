import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { OrganizationProvider } from './context/OrganizationContext' // Import Provider
import Navbar from './components/navbar' // Import your new Navbar

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
          
          {/* Drop in the new Navbar */}
          <Navbar />

          <main className="max-w-6xl mx-auto pt-6 px-4">
            {children}
          </main>

        </OrganizationProvider>

      </body>
    </html>
  )
}