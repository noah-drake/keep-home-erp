'use client'
import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/utils/supabase'

const OrganizationContext = createContext<any>(null)

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  
  const [organization, setOrganization] = useState<any>(null)
  const [allOrganizations, setAllOrganizations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSessionAndOrgs() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session && pathname !== '/login') {
        router.push('/login')
        return
      }

      if (session) {
        const { data: members, error } = await supabase.from('organization_members')
            .select('organizations(*)')
            .eq('user_id', session.user.id)
            
        const validOrgs = members ? members.map((m: any) => m.organizations).filter(Boolean) : []

        if (validOrgs.length > 0) {
            setAllOrganizations(validOrgs)
            const savedOrgId = localStorage.getItem('activeOrgId')
            const savedOrg = validOrgs.find((o: any) => o.id === savedOrgId)
            setOrganization(savedOrg || validOrgs[0])
        } else {
            // THE BOUNCER: If NO plants, explicitly nullify org and send to Settings/Onboarding
            setOrganization(null)
            setAllOrganizations([])
            if (pathname !== '/settings' && pathname !== '/login' && pathname !== '/profile') {
                router.push('/settings')
            }
        }
      }
      setLoading(false)
    }

    loadSessionAndOrgs()

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

  const handleSetOrganization = (org: any) => {
      setOrganization(org)
      if (org) {
          localStorage.setItem('activeOrgId', org.id)
          if (pathname !== '/') router.push('/')
      }
  }

  // Hide the UI until we know who they are, unless they are logging in
  if (loading && pathname !== '/login') {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center font-sans">
            <div className="animate-pulse font-black text-purple-500 tracking-widest uppercase text-xs">Securing Connection...</div>
        </div>
      )
  }

  return (
    <OrganizationContext.Provider value={{ organization, allOrganizations, setOrganization: handleSetOrganization, isLoading: loading }}>
      {children}
    </OrganizationContext.Provider>
  )
}

export const useOrganization = () => useContext(OrganizationContext)