'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Settings, ChevronDown, Database, LogOut, Package, MapPin, Grid, Scale, Shield } from 'lucide-react'
import { useOrganization } from '../context/OrganizationContext'
import { supabase } from '@/utils/supabase'

// Custom SVG Logo for 'Keep' - Borderless Castle Mark
const KeepLogo = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg group-hover:scale-105 transition-transform">
    <path d="M6 26V11H10V7H14V11H18V7H22V11H26V26H19V18.5C19 17.1193 17.8807 16 16.5 16H15.5C14.1193 16 13 17.1193 13 18.5V26H6Z" fill="url(#keep_gradient)" />
    <defs>
      <linearGradient id="keep_gradient" x1="6" y1="7" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop stopColor="#A855F7" /> {/* purple-500 */}
        <stop offset="1" stopColor="#6D28D9" /> {/* purple-700 */}
      </linearGradient>
    </defs>
  </svg>
)

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { organization, allOrganizations, setOrganization } = useOrganization()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isMasterOpen, setIsMasterOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (pathname === '/login') return null

  return (
    <nav className="bg-[#0a0a0a] border-b border-gray-800 p-4 sticky top-0 z-50 font-sans shadow-2xl">
      <div className="max-w-7xl mx-auto flex justify-between items-center text-white">
        
        {/* LEFT: LOGO, PLANT SWITCHER & MAIN NAVIGATION */}
        <div className="flex items-center gap-6">
          
          {/* Brand Identity */}
          <Link href="/" className="flex items-center gap-3 group">
            <KeepLogo />
            <span className="font-black text-2xl tracking-tighter uppercase italic text-gray-100 group-hover:text-purple-400 transition-colors">Keep</span>
          </Link>

          {/* Active Plant Switcher */}
          <div className="hidden md:flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 shadow-inner">
            <Shield size={14} className="text-purple-500" />
            <select 
              value={organization?.id || ''} 
              onChange={(e) => setOrganization(allOrganizations.find((o: any) => o.id === e.target.value))}
              className="bg-transparent text-[10px] font-black uppercase tracking-widest text-gray-300 outline-none cursor-pointer hover:text-purple-400 transition-colors truncate max-w-[120px]"
            >
              {allOrganizations.map((org: any) => <option key={org.id} value={org.id} className="bg-gray-900">{org.name}</option>)}
            </select>
          </div>
          
          <div className="hidden lg:flex items-center gap-6 text-[10px] font-black uppercase tracking-widest ml-4">
            <Link href="/" className={`transition-all ${pathname === '/' ? 'text-purple-400 border-b-2 border-purple-500 pb-1' : 'text-gray-400 hover:text-white'}`}>My Keep</Link>
            <Link href="/inventory" className={`transition-all ${pathname === '/inventory' ? 'text-purple-400 border-b-2 border-purple-500 pb-1' : 'text-gray-400 hover:text-white'}`}>Transactions</Link>
            <Link href="/shopping-list" className={`transition-all ${pathname === '/shopping-list' ? 'text-yellow-400 border-b-2 border-yellow-500 pb-1' : 'text-gray-400 hover:text-yellow-400'}`}>Shopping List</Link>
            <Link href="/history" className={`transition-all ${pathname === '/history' ? 'text-purple-400 border-b-2 border-purple-500 pb-1' : 'text-gray-400 hover:text-white'}`}>Ledger</Link>

            {/* MASTER DATA DROPDOWN */}
            <div className="relative">
                <button 
                  onClick={() => setIsMasterOpen(!isMasterOpen)}
                  className={`flex items-center gap-1 group focus:outline-none transition-all ${['/materials', '/locations', '/categories', '/units'].includes(pathname) ? 'text-purple-400' : 'text-gray-400 hover:text-white'}`}
                >
                  <Database size={14} className="text-gray-500 group-hover:text-purple-400 transition-colors" />
                  Master Data
                  <ChevronDown size={10} className={`transition-transform duration-200 ${isMasterOpen ? 'rotate-180' : ''}`} />
                </button>
                {isMasterOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsMasterOpen(false)}></div>
                    <div className="absolute left-0 mt-6 w-56 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl z-20 py-3 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <Link href="/materials" onClick={() => setIsMasterOpen(false)} className="flex items-center gap-3 px-6 py-3 text-xs font-bold hover:bg-gray-800 hover:text-purple-400 transition-colors text-gray-300">
                          <Package size={16} className="text-purple-500" /> Goods
                        </Link>
                        <Link href="/locations" onClick={() => setIsMasterOpen(false)} className="flex items-center gap-3 px-6 py-3 text-xs font-bold hover:bg-gray-800 hover:text-purple-400 transition-colors text-gray-300">
                          <MapPin size={16} className="text-blue-500" /> Stores
                        </Link>
                        <div className="border-t border-gray-800 my-2"></div>
                        <Link href="/categories" onClick={() => setIsMasterOpen(false)} className="flex items-center gap-3 px-6 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 hover:text-white transition-colors text-gray-500">
                          <Grid size={12} /> Categories
                        </Link>
                        <Link href="/units" onClick={() => setIsMasterOpen(false)} className="flex items-center gap-3 px-6 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 hover:text-white transition-colors text-gray-500">
                          <Scale size={12} /> Units
                        </Link>
                    </div>
                  </>
                )}
            </div>
          </div>
        </div>

        {/* RIGHT: SETTINGS & PROFILE */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <button 
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="p-2.5 bg-gray-900 rounded-xl hover:bg-gray-800 transition-all flex items-center justify-center group border border-gray-800 hover:border-purple-500/50"
            >
              <Settings size={18} className={`text-gray-400 group-hover:text-white ${isSettingsOpen ? 'rotate-90 text-white' : ''} transition-all duration-300`} />
            </button>

            {isSettingsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsSettingsOpen(false)}></div>
                <div className="absolute right-0 mt-4 w-64 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl z-20 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-5 py-3 border-b border-gray-800 mb-2 bg-[#0a0a0a]">
                        <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest">Keep Configuration</p>
                    </div>
                    
                    <Link href="/settings" onClick={() => setIsSettingsOpen(false)} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-800 text-sm font-bold transition-colors group">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                          <Settings size={16} className="text-purple-500" />
                        </div>
                        <div>
                            <span className="block text-gray-200">System Settings</span>
                            <span className="text-[9px] text-gray-500 font-normal uppercase tracking-wide">Manage Access & Profile</span>
                        </div>
                    </Link>

                    <div className="border-t border-gray-800 my-2"></div>
                    
                    <button onClick={() => { setIsSettingsOpen(false); handleLogout(); }} className="w-full flex items-center gap-3 px-6 py-3 hover:bg-red-500/10 text-sm font-bold transition-colors text-red-500 group">
                        <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="block">Secure Log Out</span>
                    </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}