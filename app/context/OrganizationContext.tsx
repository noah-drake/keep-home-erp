'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface OrgContextType {
  organization: any | null
  setOrganization: (org: any) => void
  allOrganizations: any[]
  loading: boolean
}

const OrganizationContext = createContext<OrgContextType>({} as OrgContextType)

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [organization, setOrganization] = useState<any | null>(null)
  const [allOrganizations, setAllOrganizations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadOrgs() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // 1. Get IDs
      const { data: members } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)

      if (members && members.length > 0) {
        const orgIds = members.map((m: any) => m.organization_id)
        
        // 2. Get Details
        const { data: orgs } = await supabase
          .from('organizations')
          .select('*')
          .in('id', orgIds)
        
        if (orgs) {
          setAllOrganizations(orgs)
          
          // --- NEW: MEMORY LOGIC ---
          const savedId = typeof window !== 'undefined' ? localStorage.getItem('active_org_id') : null
          const savedOrg = orgs.find((o: any) => o.id === savedId)

          if (savedOrg) {
            setOrganization(savedOrg) // Restore saved choice
          } else {
            setOrganization(orgs[0]) // Default to first
          }
        }
      }
      setLoading(false)
    }

    loadOrgs()
  }, [])

  // --- NEW: WRAPPER TO SAVE CHOICE ---
  const handleSetOrganization = (org: any) => {
    setOrganization(org)
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_org_id', org.id)
    }
  }

  return (
    <OrganizationContext.Provider value={{ 
      organization, 
      setOrganization: handleSetOrganization, // Use the wrapper!
      allOrganizations, 
      loading 
    }}>
      {children}
    </OrganizationContext.Provider>
  )
}

export const useOrganization = () => useContext(OrganizationContext)