'use client'
import { createClient } from '@supabase/supabase-js'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
    } else {
      router.push('/') // Redirect to dashboard on success
      router.refresh()
    }
  }

  const handleSignUp = async () => {
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) setMessage(error.message)
    else setMessage('Check your email for the confirmation link!')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
        <h1 className="text-2xl font-bold mb-6 text-center">🔐 Home ERP Login</h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input 
              type="email" 
              required
              className="w-full bg-gray-900 border border-gray-600 rounded p-2 focus:ring-2 focus:ring-purple-500 outline-none"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input 
              type="password" 
              required
              className="w-full bg-gray-900 border border-gray-600 rounded p-2 focus:ring-2 focus:ring-purple-500 outline-none"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {message && (
            <div className="p-3 bg-red-900/50 text-red-200 text-sm rounded border border-red-800">
              {message}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded transition-colors disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Log In'}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-gray-700 pt-4">
          <p className="text-gray-400 text-sm mb-2">Don't have an account?</p>
          <button 
            onClick={handleSignUp}
            disabled={loading}
            className="text-purple-400 hover:text-purple-300 text-sm font-bold"
          >
            Sign Up Now
          </button>
        </div>
      </div>
    </div>
  )
}