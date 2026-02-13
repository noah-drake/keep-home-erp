'use client'
import React, { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, usePathname } from 'next/navigation' // Add these

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const OrganizationContext = createContext<any>(null)

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  
  const [organization, setOrganization] = useState<any>(null)
  const [allOrganizations, setAllOrganizations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSessionAndOrgs() {
      // 1. Check if the user is logged in
      const { data: { session } } = await supabase.auth.getSession()

      // 2. If no session AND they aren't already on the login page, kick them out
      if (!session && pathname !== '/login') {
        router.push('/login')
        return
      }

      // 3. If they are logged in, load their allowed plants
      if (session) {
        const { data: members } = await supabase.from('organization_members')
            .select('organizations(*)')
            .eq('user_id', session.user.id)
            
        if (members && members.length > 0) {
            const orgs = members.map((m: any) => m.organizations)
            setAllOrganizations(orgs)
            
            // Auto-select the first plant if none is selected
            const savedOrgId = localStorage.getItem('activeOrgId')
            const savedOrg = orgs.find((o: any) => o.id === savedOrgId)
            
            if (savedOrg) setOrganization(savedOrg)
            else setOrganization(orgs[0])
        } else if (pathname !== '/settings' && pathname !== '/login') {
            // Edge case: They are logged in, but belong to ZERO plants
            // Redirect them to settings so they can create one!
            router.push('/settings')
        }
      }
      setLoading(false)
    }

    loadSessionAndOrgs()

    // Listen for login/logout events
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            setOrganization(null)
            setAllOrganizations([])
            router.push('/login')
        } else if (event === 'SIGNED_IN') {
            loadSessionAndOrgs()
        }
    })

    return () => authListener.subscription.unsubscribe()
  }, [pathname, router])

  // Save selection to local storage so it survives page reloads
  const handleSetOrganization = (org: any) => {
      setOrganization(org)
      if (org) localStorage.setItem('activeOrgId', org.id)
  }

  if (loading && pathname !== '/login') return <div className="h-screen bg-black text-white flex items-center justify-center font-black animate-pulse">SECURING CONNECTION...</div>

  return (
    <OrganizationContext.Provider value={{ organization, allOrganizations, setOrganization: handleSetOrganization }}>
      {children}
    </OrganizationContext.Provider>
  )
}

export const useOrganization = () => useContext(OrganizationContext)