'use client'
import { createClient } from '@supabase/supabase-js'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Package, ArrowRight, Factory } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function LoginPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Form State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [plantName, setPlantName] = useState('')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
        if (isSignUp) {
            // 1. Create the User
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } }
            })
            if (authError) throw authError
            if (!authData.user) throw new Error("Failed to create account.")

            // 2. Provision their first Plant
            const { data: orgData, error: orgError } = await supabase.from('organizations')
                .insert([{ name: plantName }])
                .select()
                .single()
            if (orgError) throw orgError

            // 3. Make them the Admin of that Plant
            const { error: memberError } = await supabase.from('organization_members')
                .insert([{ organization_id: orgData.id, user_id: authData.user.id, role: 'admin' }])
            if (memberError) throw memberError

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
        setMessage(err.message || "An error occurred during authentication.")
    } finally {
        setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4 font-sans text-white">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 p-8 md:p-10 rounded-[2.5rem] shadow-2xl">
        
        <div className="flex justify-center mb-6">
            <div className="w-14 h-14 bg-purple-900/30 rounded-2xl flex items-center justify-center border border-purple-500/30">
                <Package size={28} className="text-purple-500" />
            </div>
        </div>

        <h1 className="text-3xl font-black uppercase tracking-tighter text-center mb-1">
            {isSignUp ? 'Initialize Workspace' : 'Welcome Back'}
        </h1>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center mb-8">
            {isSignUp ? 'Setup your first plant' : 'Enterprise Resource Planning'}
        </p>

        {message && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl text-xs font-bold text-center mb-6">
                {message}
            </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          
          {isSignUp && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in duration-300">
                 <div>
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-2 block mb-1">Your Name</label>
                    <input required className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-sm" placeholder="e.g. Jane" value={fullName} onChange={e => setFullName(e.target.value)} />
                 </div>
                 <div>
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-2 block mb-1 flex items-center gap-1"><Factory size={10}/> Plant Name</label>
                    <input required className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-sm" placeholder="e.g. Home Base" value={plantName} onChange={e => setPlantName(e.target.value)} />
                 </div>
              </div>
          )}

          <div>
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-2 block mb-1">Email Address</label>
            <input type="email" required className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-sm" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-2 block mb-1">Password</label>
            <input type="password" required minLength={6} className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-sm" value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          <button disabled={loading} className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase text-xs hover:bg-purple-600 hover:text-white transition-all mt-4 shadow-lg flex items-center justify-center gap-2 group">
            {loading ? 'Processing...' : (isSignUp ? 'Create Account & Plant' : 'Secure Login')}
            {!loading && <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-gray-800 pt-6">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3">
                {isSignUp ? 'Already have an account?' : 'New to the system?'}
            </p>
            <button onClick={() => {setIsSignUp(!isSignUp); setMessage('');}} className="text-xs font-black text-purple-500 uppercase tracking-widest hover:text-purple-400 transition-colors">
                {isSignUp ? 'Switch to Login' : 'Create a Workspace'}
            </button>
        </div>
      </div>
    </div>
  )
}