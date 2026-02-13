'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useOrganization } from '../context/OrganizationContext'
import { 
  Castle, 
  Package, 
  MapPin, 
  History, 
  ShoppingCart, 
  ArrowLeftRight, 
  Settings,
  ChevronDown,
  Menu,
  X,
  ShieldCheck,
  Plus
} from 'lucide-react'

// --- THE LOGO COMPONENT ---
const KeepLogo = () => (
  <div className="flex items-center gap-2 group">
    <div className="relative">
      <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/40 group-hover:bg-purple-500 transition-colors">
        {/* Simplified Castle/Shield Icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 21V7L12 3L19 7V21L12 18L5 21Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 12V15" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M15 12V15" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-black" />
    </div>
    <span className="text-xl font-black uppercase tracking-tighter italic text-white group-hover:text-purple-400 transition-colors">
      Keep
    </span>
  </div>
)

export default function Navbar() {
  const pathname = usePathname()
  const { organization, allOrganizations, setOrganization } = useOrganization()
  const [isOpen, setIsOpen] = useState(false)
  const [showOrgDropdown, setShowOrgDropdown] = useState(false)

  const navItems = [
    { name: 'My Keep', href: '/', icon: Castle },
    { name: 'Transactions', href: '/inventory', icon: ArrowLeftRight },
    { name: 'Shopping List', href: '/shopping', icon: ShoppingCart },
    { name: 'Goods', href: '/materials', icon: Package },
    { name: 'Stores', href: '/locations', icon: MapPin },
    { name: 'Ledger', href: '/ledger', icon: History },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-gray-800 font-sans">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-20">
          
          {/* LEFT: LOGO & ORG SWITCHER */}
          <div className="flex items-center gap-8">
            <Link href="/">
              <KeepLogo />
            </Link>

            {/* ORG DROPDOWN (DESKTOP) */}
            <div className="hidden md:block relative">
              <button 
                onClick={() => setShowOrgDropdown(!showOrgDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl hover:border-purple-500/50 transition-all text-xs font-bold uppercase tracking-widest text-gray-400"
              >
                <ShieldCheck size={14} className="text-purple-500" />
                {organization?.name || 'Selecting...'}
                <ChevronDown size={14} className={`transition-transform ${showOrgDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showOrgDropdown && (
                <div className="absolute top-full mt-2 w-56 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in duration-200">
                  {allOrganizations.map((org: any) => (
                    <button
                      key={org.id}
                      onClick={() => { setOrganization(org); setShowOrgDropdown(false); }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${organization?.id === org.id ? 'bg-purple-600 text-white' : 'hover:bg-gray-800 text-gray-400'}`}
                    >
                      {org.name}
                    </button>
                  ))}
                  <div className="h-px bg-gray-800 my-2" />
                  <Link 
                    href="/settings" 
                    onClick={() => setShowOrgDropdown(false)}
                    className="flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                  >
                    <Plus size={12} /> New Plant
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* MIDDLE: NAV LINKS (DESKTOP) */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? 'text-purple-500 bg-purple-500/5' : 'text-gray-500 hover:text-white hover:bg-gray-900'}`}
                >
                  <Icon size={16} />
                  {item.name}
                </Link>
              )
            })}
          </div>

          {/* RIGHT: SETTINGS & MOBILE TOGGLE */}
          <div className="flex items-center gap-2">
            <Link 
              href="/settings"
              className={`hidden md:flex p-3 rounded-xl transition-all ${pathname === '/settings' ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800'}`}
            >
              <Settings size={20} />
            </Link>
            
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden p-3 bg-gray-900 rounded-xl text-white border border-gray-800"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU */}
      {isOpen && (
        <div className="lg:hidden bg-black border-t border-gray-800 p-4 space-y-2 animate-in slide-in-from-top duration-300">
          {/* Mobile Org Switcher */}
          <div className="mb-6 p-4 bg-gray-900 rounded-2xl border border-gray-800">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Active Workspace</p>
            <div className="flex flex-wrap gap-2">
              {allOrganizations.map((org: any) => (
                <button
                  key={org.id}
                  onClick={() => setOrganization(org)}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${organization?.id === org.id ? 'bg-purple-600 text-white' : 'bg-black text-gray-500 border border-gray-800'}`}
                >
                  {org.name}
                </button>
              ))}
            </div>
          </div>

          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-4 p-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${isActive ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'bg-gray-900 text-gray-400'}`}
              >
                <Icon size={18} />
                {item.name}
              </Link>
            )
          })}
          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-4 p-4 rounded-2xl text-xs font-black uppercase tracking-widest bg-gray-900 text-gray-400 border border-gray-800"
          >
            <Settings size={18} />
            Settings
          </Link>
        </div>
      )}
    </nav>
  )
}