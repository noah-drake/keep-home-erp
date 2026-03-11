'use client'
import { supabase } from '@/utils/supabase'
import type { Tables, TablesInsert } from '@/types/database.types'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Package, ArrowRight, PartyPopper } from 'lucide-react'

/** Invite row with joined organization name (from select('*, organizations(name)')) */
type InviteRow = Tables<'invites'>
type InviteWithOrg = InviteRow & { organizations: { name: string } | null }

/** Insert payload for organization_members when claiming an invite */
type OrgMemberInsert = TablesInsert<'organization_members'>

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const inviteId = searchParams.get('invite_id')
  
    const [isSignUp, setIsSignUp] = useState(!!inviteId)
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState('')
    const [inviteData, setInviteData] = useState<InviteWithOrg | null>(null)
  
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
  
    // 1. MOVED claimInvite OUTSIDE so both useEffect and handleAuth can use it
    async function claimInvite(
        userId: string,
        inviteIdParam: string,
        role: string
    ): Promise<void> {
        const { data: invite, error: fetchErr } = await supabase
            .from('invites')
            .select('id, organization_id, role')
            .eq('id', inviteIdParam)
            .single()
  
        if (fetchErr || !invite?.organization_id) {
            throw new Error('Invalid or already used invite.')
        }
  
        const insertPayload: OrgMemberInsert = {
            organization_id: invite.organization_id,
            user_id: userId,
            role,
        }
        
        const { error: insertError } = await supabase
            .from('organization_members')
            .insert(insertPayload)
            
        if (insertError && insertError.code !== '23505') throw insertError
  
        await supabase.from('invites').delete().eq('id', inviteIdParam)
    }
  
    useEffect(() => {
        async function initializeFlow() {
            let currentInvite: InviteWithOrg | null = null
  
            if (inviteId) {
                const { data, error } = await supabase
                    .from('invites')
                    .select('*, organizations(name)')
                    .eq('id', inviteId)
                    .single()
                    
                if (error || !data) {
                    setMessage("This invite link is invalid or has already been used.")
                } else {
                    setInviteData(data as InviteWithOrg)
                    currentInvite = data as InviteWithOrg
                }
            }
  
            const { data: { session } } = await supabase.auth.getSession()
  
            if (session && currentInvite?.organization_id) {
                // Auto-claim if already logged in
                await claimInvite(session.user.id, inviteId!, currentInvite.role ?? 'viewer')
                router.push('/')
            } else if (session) {
                router.push('/')
            } else {
                setLoading(false)
            }
        }
        initializeFlow()
    }, [inviteId, router])
  
    const handleAuth = async (e: React.FormEvent) => {
      e.preventDefault()
      setLoading(true)
      setMessage('')
  
      try {
          if (isSignUp) {
              const { data: authData, error: authError } = await supabase.auth.signUp({
                  email, password, options: { data: { full_name: fullName } }
              })
              if (authError) throw authError
              if (!authData.user) throw new Error("Failed to create account.")
  
              if (inviteId) {
                  // 2. FIXED: Now dynamically grabs the role from the invite instead of hardcoding 'viewer'
                  await claimInvite(authData.user.id, inviteId, inviteData?.role ?? 'viewer')
              }
  
              router.push('/')
          } else {
              const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password })
              if (error) throw error
  
              if (inviteId && authData.user) {
                  await claimInvite(authData.user.id, inviteId, inviteData?.role ?? 'viewer')
              }
              router.push('/')
          }
      } catch (err: unknown) {
          setMessage(err instanceof Error ? err.message : "An error occurred.")
          setLoading(false)
      }
    }

  if (loading) return <div className="animate-pulse font-black text-purple-500 uppercase tracking-widest text-xs">Authenticating...</div>

  return (
    <div className="w-full max-w-md bg-[#0f0f0f] border border-gray-800 p-8 md:p-10 rounded-[2.5rem] shadow-2xl">
        <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-purple-900/20 rounded-2xl flex items-center justify-center border border-purple-500/30 shadow-inner">
                {inviteData ? <PartyPopper size={32} className="text-green-500" /> : <Package size={32} className="text-purple-500" />}
            </div>
        </div>

        <h1 className="text-3xl font-black uppercase tracking-tighter text-center mb-1 text-gray-100">
            {inviteData ? 'You are invited!' : (isSignUp ? 'Create Account' : 'Welcome Back')}
        </h1>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center mb-8">
            {inviteData ? `Join ${inviteData.organizations?.name}` : 'Enterprise Resource Planning'}
        </p>

        {message && <div className="bg-red-950/50 border border-red-900/50 text-red-400 p-4 rounded-xl text-xs font-bold text-center mb-6">{message}</div>}

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
              <div className="animate-in fade-in zoom-in duration-300">
                 <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-2 block mb-1">Your Name</label>
                 <input required className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200" placeholder="e.g. Jane" value={fullName} onChange={e => setFullName(e.target.value)} />
              </div>
          )}

          <div>
            <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-2 block mb-1">Email Address</label>
            <input type="email" required className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-2 block mb-1">Password</label>
            <input type="password" required minLength={6} className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200" value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          <button disabled={loading} className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-purple-500 transition-all mt-4 shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2 group active:scale-95">
            {isSignUp ? 'Create Account' : 'Secure Login'}
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="mt-8 text-center border-t border-gray-800/50 pt-6">
            <button type="button" onClick={() => {setIsSignUp(!isSignUp); setMessage('');}} className="text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-purple-400 transition-colors">
                {isSignUp ? 'Already have an account? Log In' : 'Need an account? Sign Up'}
            </button>
        </div>
    </div>
  )
}

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col justify-center items-center p-4 font-sans text-white">
            <Suspense fallback={<div className="animate-pulse font-black text-purple-500 uppercase tracking-widest text-xs">Loading Secure Portal...</div>}>
                <LoginForm />
            </Suspense>
        </div>
    )
}