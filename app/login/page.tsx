'use client'
import { createClient } from '@supabase/supabase-js'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Package, ArrowRight, Factory, PartyPopper } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// We wrap the main form in a component so Next.js handles the URL params correctly
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteId = searchParams.get('invite_id')

  const [isSignUp, setIsSignUp] = useState(!!inviteId) // Auto-switch to Sign Up if invited
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [inviteData, setInviteData] = useState<any>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [plantName, setPlantName] = useState('')

  // Check if the invite is valid when the page loads
  useEffect(() => {
      async function checkInvite() {
          if (inviteId) {
              const { data } = await supabase.from('invites').select('*, organizations(name)').eq('id', inviteId).single()
              if (data) setInviteData(data)
              else setMessage("This invite link is invalid or has already been used.")
          }
      }
      checkInvite()
  }, [inviteId])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
        if (isSignUp) {
            // 1. Create the User
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email, password, options: { data: { full_name: fullName } }
            })
            if (authError) throw authError
            if (!authData.user) throw new Error("Failed to create account.")

            if (inviteData) {
                // 2A. They were invited -> Join existing plant
                const { error: memberError } = await supabase.from('organization_members').insert([
                    { organization_id: inviteData.organization_id, user_id: authData.user.id, role: inviteData.role }
                ])
                if (memberError) throw memberError
                
                // Destroy the single-use invite
                await supabase.from('invites').delete().eq('id', inviteId)
            } else {
                // 2B. Normal Sign Up -> Create their own plant
                const { data: orgData, error: orgError } = await supabase.from('organizations').insert([{ name: plantName }]).select().single()
                if (orgError) throw orgError

                const { error: memberError } = await supabase.from('organization_members').insert([
                    { organization_id: orgData.id, user_id: authData.user.id, role: 'admin' }
                ])
                if (memberError) throw memberError
            }

            router.push('/')
            router.refresh()

        } else {
            // Standard Login
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) throw error
            router.push('/')
            router.refresh()
        }
    } catch (err: any) {
        setMessage(err.message || "An error occurred.")
    } finally {
        setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-gray-900 border border-gray-800 p-8 md:p-10 rounded-[2.5rem] shadow-2xl">
        <div className="flex justify-center mb-6">
            <div className="w-14 h-14 bg-purple-900/30 rounded-2xl flex items-center justify-center border border-purple-500/30">
                {inviteData ? <PartyPopper size={28} className="text-green-500" /> : <Package size={28} className="text-purple-500" />}
            </div>
        </div>

        <h1 className="text-3xl font-black uppercase tracking-tighter text-center mb-1">
            {inviteData ? 'You are invited!' : (isSignUp ? 'Initialize Workspace' : 'Welcome Back')}
        </h1>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center mb-8">
            {inviteData ? `Join ${inviteData.organizations?.name}` : (isSignUp ? 'Setup your first plant' : 'Enterprise Resource Planning')}
        </p>

        {message && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl text-xs font-bold text-center mb-6">{message}</div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
              <div className={`grid ${inviteData ? 'grid-cols-1' : 'grid-cols-2'} gap-4 animate-in fade-in zoom-in duration-300`}>
                 <div>
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-2 block mb-1">Your Name</label>
                    <input required className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 font-bold text-sm" placeholder="e.g. Jane" value={fullName} onChange={e => setFullName(e.target.value)} />
                 </div>
                 {/* Only ask for a plant name if they ARE NOT invited */}
                 {!inviteData && (
                     <div>
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-2 mb-1 flex items-center gap-1"><Factory size={10}/> Plant Name</label>
                        <input required className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 font-bold text-sm" placeholder="e.g. Home Base" value={plantName} onChange={e => setPlantName(e.target.value)} />
                     </div>
                 )}
              </div>
          )}

          <div>
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-2 block mb-1">Email Address</label>
            <input type="email" required className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 font-bold text-sm" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-2 block mb-1">Password</label>
            <input type="password" required minLength={6} className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 font-bold text-sm" value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          <button disabled={loading} className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase text-xs hover:bg-purple-600 hover:text-white transition-all mt-4 shadow-lg flex items-center justify-center gap-2 group">
            {loading ? 'Processing...' : (isSignUp ? 'Complete Registration' : 'Secure Login')}
            {!loading && <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        {!inviteData && (
            <div className="mt-8 text-center border-t border-gray-800 pt-6">
                <button onClick={() => {setIsSignUp(!isSignUp); setMessage('');}} className="text-xs font-black text-purple-500 uppercase tracking-widest hover:text-purple-400 transition-colors">
                    {isSignUp ? 'Switch to Login' : 'Create a Workspace'}
                </button>
            </div>
        )}
    </div>
  )
}

// Wrapper to satisfy Next.js client-side Suspense requirements for searchParams
export default function LoginPage() {
    return (
        <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4 font-sans text-white">
            <Suspense fallback={<div className="animate-pulse font-black text-purple-500">LOADING SECURE PORTAL...</div>}>
                <LoginForm />
            </Suspense>
        </div>
    )
}