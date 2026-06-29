'use client'
import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/utils/supabase'
import type { Tables } from '@/types/database.types'

export type Organization = Tables<'organizations'>

export interface OrganizationContextValue {
  /** The plant the user is currently operating in, or null before one is selected. */
  organization: Organization | null
  /** Every plant the signed-in user can access. */
  allOrganizations: Organization[]
  setOrganization: (org: Organization | null) => void
  isLoading: boolean
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null)

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [organization, setOrganization] = useState<Organization | null>(null)
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSessionAndOrgs() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session && pathname !== '/login') {
        router.push('/login')
        return
      }

      if (session) {
        const { data: members } = await supabase.from('organization_members')
            .select('organizations(*)')
            .eq('user_id', session.user.id)

        // A member row embeds its organization; normalise to a flat, non-null list.
        const validOrgs: Organization[] = (members ?? []).flatMap((m) => {
          const orgs = m.organizations
          if (!orgs) return []
          return Array.isArray(orgs) ? orgs : [orgs]
        })

        if (validOrgs.length > 0) {
            setAllOrganizations(validOrgs)
            const savedOrgId = localStorage.getItem('activeOrgId')
            const savedOrg = validOrgs.find((o) => o.id === savedOrgId)
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

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
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

  const handleSetOrganization = (org: Organization | null) => {
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

export function useOrganization(): OrganizationContextValue {
  const ctx = useContext(OrganizationContext)
  if (!ctx) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return ctx
}
