'use client'
import React, { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, usePathname } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
        const { data: members, error } = await supabase.from('organization_members')
            .select('organizations(*)')
            .eq('user_id', session.user.id)
            
        // DEBUGGING: Print exactly what the database sees to your browser console
        console.log("DEBUG - User ID:", session.user.id);
        if (error) console.log("DEBUG - Database Error:", error);
        console.log("DEBUG - Database Members Data:", members);
            
        // Safely filter out any null organizations if RLS blocked them
        const validOrgs = members 
            ? members.map((m: any) => m.organizations).filter(Boolean) 
            : []

        if (validOrgs.length > 0) {
            setAllOrganizations(validOrgs)
            
            // Auto-select the last used plant, or default to the first one
            const savedOrgId = localStorage.getItem('activeOrgId')
            const savedOrg = validOrgs.find((o: any) => o.id === savedOrgId)
            
            if (savedOrg) {
                setOrganization(savedOrg)
            } else {
                setOrganization(validOrgs[0])
            }
            
        } else {
            // THE BOUNCER: If they have NO plants, only allow them on Settings, Profile, or Login
            if (pathname !== '/settings' && pathname !== '/login' && pathname !== '/profile') {
                router.push('/settings')
            }
        }
      }
      setLoading(false)
    }

    loadSessionAndOrgs()

    // Listen for login/logout events so the app updates instantly
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

  // Show a loading screen while we verify permissions (unless on login page)
  if (loading && pathname !== '/login') {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-sans">
            <div className="animate-pulse font-black text-purple-500 tracking-widest uppercase">
                Securing Connection...
            </div>
        </div>
      )
  }

  return (
    <OrganizationContext.Provider value={{ organization, allOrganizations, setOrganization: handleSetOrganization }}>
      {children}
    </OrganizationContext.Provider>
  )
}

export const useOrganization = () => useContext(OrganizationContext)