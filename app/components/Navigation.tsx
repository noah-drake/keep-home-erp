'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, ArrowRightLeft, ClipboardCheck, ShoppingCart, History, Menu, X,
  Database, Package, MapPin, Grid, Scale, ChevronDown, Settings, User, LogOut, Shield, Check,
} from 'lucide-react'
import { supabase } from '@/utils/supabase'
import { useOrganization, type Organization } from '../context/OrganizationContext'

const navLinks = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory', label: 'Transact', icon: ArrowRightLeft },
  { href: '/inventory/count', label: 'Audit', icon: ClipboardCheck },
  { href: '/shopping-list', label: 'Shopping List', icon: ShoppingCart },
  { href: '/history', label: 'Ledger', icon: History },
]

// Master Data: the independent registries for goods, stores, and their tags.
const masterLinks = [
  { href: '/materials', label: 'Goods', icon: Package },
  { href: '/locations', label: 'Stores', icon: MapPin },
  { href: '/categories', label: 'Categories', icon: Grid },
  { href: '/units', label: 'Units', icon: Scale },
]

export default function Navigation() {
  const pathname = usePathname()
  const { organization, allOrganizations, setOrganization } = useOrganization()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [masterOpen, setMasterOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))
  const masterActive = masterLinks.some((l) => pathname.startsWith(l.href))

  const closeAll = () => { setMobileMenuOpen(false); setMasterOpen(false); setAccountOpen(false) }

  const switchOrg = (org: Organization) => { closeAll(); setOrganization(org) }
  const handleLogout = async () => { closeAll(); await supabase.auth.signOut() }

  // No global chrome on the login screen. (Hooks above run unconditionally — Rules of Hooks.)
  if (pathname === '/login') return null

  return (
    <nav className="sticky top-0 z-50 bg-[#0a0a0a] border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo */}
          <Link
            href="/"
            className="text-2xl font-black uppercase tracking-tighter text-white hover:text-purple-400 transition-colors shrink-0"
            onClick={closeAll}
          >
            Keep
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${
                    isActive(link.href)
                      ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Icon size={14} />
                  <span>{link.label}</span>
                </Link>
              )
            })}

            {/* Master Data dropdown */}
            <div className="relative">
              <button
                onClick={() => { setMasterOpen((o) => !o); setAccountOpen(false) }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${
                  masterActive
                    ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Database size={14} />
                <span>Master Data</span>
                <ChevronDown size={12} className={`transition-transform ${masterOpen ? 'rotate-180' : ''}`} />
              </button>
              {masterOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMasterOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 bg-[#0f0f0f] border border-gray-800 rounded-2xl shadow-2xl z-20 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    {masterLinks.map((link) => {
                      const Icon = link.icon
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMasterOpen(false)}
                          className={`flex items-center gap-3 px-5 py-3 text-xs font-bold transition-colors ${
                            pathname.startsWith(link.href)
                              ? 'text-purple-400 bg-purple-600/10'
                              : 'text-gray-300 hover:bg-gray-800 hover:text-purple-400'
                          }`}
                        >
                          <Icon size={16} className="text-purple-500" />
                          <span>{link.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right side: active Keep + account menu (desktop) */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {organization && (
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 max-w-[160px] truncate">
                <Shield size={12} className="text-purple-500 shrink-0" />
                <span className="truncate">{organization.name}</span>
              </span>
            )}
            <div className="relative">
              <button
                onClick={() => { setAccountOpen((o) => !o); setMasterOpen(false) }}
                className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 font-black flex items-center justify-center hover:bg-purple-600/30 transition-all"
                aria-label="Account menu"
              >
                {email ? email.charAt(0).toUpperCase() : <User size={16} />}
              </button>
              {accountOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAccountOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-[#0f0f0f] border border-gray-800 rounded-2xl shadow-2xl z-20 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <AccountMenuContents
                      email={email}
                      organization={organization}
                      allOrganizations={allOrganizations}
                      onSwitch={switchOrg}
                      onNavigate={() => setAccountOpen(false)}
                      onLogout={handleLogout}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-800 animate-in slide-in-from-top-2">
            <div className="grid grid-cols-1 gap-2">
              {navLinks.map((link) => {
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                      isActive(link.href)
                        ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{link.label}</span>
                  </Link>
                )
              })}

              {/* Master Data section */}
              <div className="mt-2 pt-3 border-t border-gray-800">
                <p className="px-4 pb-2 text-[9px] font-black uppercase tracking-widest text-gray-600 flex items-center gap-2">
                  <Database size={12} /> Master Data
                </p>
                {masterLinks.map((link) => {
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                        pathname.startsWith(link.href)
                          ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                    >
                      <Icon size={16} />
                      <span>{link.label}</span>
                    </Link>
                  )
                })}
              </div>

              {/* Account section */}
              <div className="mt-2 pt-3 border-t border-gray-800">
                <AccountMenuContents
                  email={email}
                  organization={organization}
                  allOrganizations={allOrganizations}
                  onSwitch={switchOrg}
                  onNavigate={() => setMobileMenuOpen(false)}
                  onLogout={handleLogout}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

/** Shared account/Keep menu body, used by both the desktop dropdown and the mobile menu. */
function AccountMenuContents({
  email,
  organization,
  allOrganizations,
  onSwitch,
  onNavigate,
  onLogout,
}: {
  email: string | null
  organization: Organization | null
  allOrganizations: Organization[]
  onSwitch: (org: Organization) => void
  onNavigate: () => void
  onLogout: () => void
}) {
  return (
    <div>
      {/* Signed-in identity */}
      <div className="px-4 py-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Signed in as</p>
        <p className="text-xs font-bold text-gray-200 truncate">{email ?? '—'}</p>
      </div>

      {/* Keep switcher */}
      {allOrganizations.length > 0 && (
        <div className="px-2 py-2 border-t border-gray-800 mt-1">
          <p className="px-2 pb-1 text-[9px] font-black uppercase tracking-widest text-gray-600">
            {allOrganizations.length > 1 ? 'Switch Keep' : 'Active Keep'}
          </p>
          {allOrganizations.map((org) => {
            const active = organization?.id === org.id
            return (
              <button
                key={org.id}
                onClick={() => onSwitch(org)}
                disabled={active}
                className={`w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg text-xs font-bold transition-colors ${
                  active ? 'text-purple-400 bg-purple-600/10' : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Shield size={14} className={active ? 'text-purple-500' : 'text-gray-500'} />
                  <span className="truncate">{org.name}</span>
                </span>
                {active && <Check size={14} className="text-purple-500 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}

      {/* Account actions */}
      <div className="border-t border-gray-800 mt-1 pt-1">
        <Link
          href="/settings"
          onClick={onNavigate}
          className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-gray-300 hover:bg-gray-800 hover:text-purple-400 transition-colors"
        >
          <Settings size={16} className="text-purple-500" /> Settings
        </Link>
        <Link
          href="/profile"
          onClick={onNavigate}
          className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-gray-300 hover:bg-gray-800 hover:text-purple-400 transition-colors"
        >
          <User size={16} className="text-purple-500" /> Profile &amp; Invite ID
        </Link>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  )
}
