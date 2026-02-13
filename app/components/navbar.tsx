'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, User, Factory, ChevronDown, Database, LogOut } from 'lucide-react'
import { useOrganization } from '../context/OrganizationContext'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function Navbar() {
  const router = useRouter()
  const { organization, allOrganizations, setOrganization } = useOrganization()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isMasterOpen, setIsMasterOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="bg-gray-950 border-b border-gray-800 p-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center text-white font-sans">
        
        {/* LOGO & MAIN LINKS */}
        <div className="flex items-center gap-8">
          <Link href="/" className="font-black text-2xl tracking-tighter text-purple-500">HOME ERP</Link>
          
          <div className="hidden md:flex items-center gap-6 text-[10px] font-black uppercase tracking-widest">
            <Link href="/" className="hover:text-purple-400 transition-colors">Dashboard</Link>
            <Link href="/inventory" className="hover:text-purple-400 transition-colors">Transactions</Link>
            <Link href="/shopping-list" className="hover:text-yellow-400 text-yellow-500 transition-colors">🛒 Shopping List</Link>
            <Link href="/history" className="hover:text-yellow-400 text-yellow-500 transition-colors">History</Link>


            {/* MASTER DATA DROPDOWN */}
            <div className="relative">
                <button 
                  onClick={() => setIsMasterOpen(!isMasterOpen)}
                  className="flex items-center gap-1 hover:text-purple-400 group focus:outline-none transition-colors"
                >
                  <Database size={14} className="text-gray-500 group-hover:text-purple-400 transition-colors" />
                  Master Data
                  <ChevronDown size={10} />
                </button>
                {isMasterOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsMasterOpen(false)}></div>
                    <div className="absolute left-0 mt-4 w-48 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl z-20 py-2 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <Link href="/materials" onClick={() => setIsMasterOpen(false)} className="block px-6 py-3 text-xs font-bold hover:bg-gray-800 hover:text-purple-400 transition-colors">Materials</Link>
                        <Link href="/locations" onClick={() => setIsMasterOpen(false)} className="block px-6 py-3 text-xs font-bold hover:bg-gray-800 hover:text-purple-400 transition-colors">Locations</Link>
                        <div className="border-t border-gray-800 my-1"></div>
                        <Link href="/categories" onClick={() => setIsMasterOpen(false)} className="block px-6 py-3 text-xs font-bold hover:bg-gray-800 hover:text-purple-400 transition-colors text-gray-500">Categories</Link>
                        <Link href="/units" onClick={() => setIsMasterOpen(false)} className="block px-6 py-3 text-xs font-bold hover:bg-gray-800 hover:text-purple-400 transition-colors text-gray-500">Units</Link>
                    </div>
                  </>
                )}
            </div>
          </div>
        </div>

        {/* RIGHT SIDE CONTROLS */}
        <div className="flex items-center gap-4">
          
          {/* PLANT SELECTOR */}
          <div className="flex flex-col items-end">
             <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-1">Active Plant</span>
             <select 
                value={organization?.id || ''} 
                onChange={(e) => setOrganization(allOrganizations.find((o: any) => o.id === e.target.value))}
                className="bg-gray-900 border border-gray-700 text-[10px] font-black rounded-lg px-2 py-1 outline-none text-green-400 uppercase tracking-widest cursor-pointer hover:border-green-500 transition-colors max-w-[150px] truncate"
             >
                {allOrganizations.map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}
             </select>
          </div>

          {/* SETTINGS ICON DROPDOWN */}
          <div className="relative">
            <button 
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="p-3 bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center group border border-gray-800"
            >
              <Settings size={18} className={`text-gray-400 group-hover:text-white ${isSettingsOpen ? 'rotate-90 text-white' : ''} transition-all duration-300`} />
            </button>

            {isSettingsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsSettingsOpen(false)}></div>
                <div className="absolute right-0 mt-3 w-64 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl z-20 py-2 overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="px-4 py-3 border-b border-gray-800 mb-2 bg-gray-950/50">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Configuration</p>
                    </div>
                    
                    <Link href="/settings" onClick={() => setIsSettingsOpen(false)} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-800 text-sm font-bold transition-colors">
                        <Factory size={16} className="text-purple-500" />
                        <div>
                            <span className="block">Plant Settings</span>
                            <span className="text-[9px] text-gray-500 font-normal uppercase tracking-wide">Manage Access & Names</span>
                        </div>
                    </Link>

                    <Link href="/profile" onClick={() => setIsSettingsOpen(false)} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-800 text-sm font-bold transition-colors">
                        <User size={16} className="text-blue-500" />
                        <div>
                            <span className="block">My Profile</span>
                            <span className="text-[9px] text-gray-500 font-normal uppercase tracking-wide">Get My User UUID</span>
                        </div>
                    </Link>

                    <div className="border-t border-gray-800 my-2"></div>
                    
                    {/* SECURE LOG OUT */}
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