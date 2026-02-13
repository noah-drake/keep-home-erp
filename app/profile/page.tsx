'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser()
      if (data?.user) setUser(data.user)
    }
    getUser()
  }, [])

  const copyId = () => {
    if (user) {
      navigator.clipboard.writeText(user.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!user) return <div className="p-8 text-white">Loading Profile...</div>

  return (
    <div className="min-h-screen p-8 text-white font-sans max-w-2xl mx-auto flex flex-col justify-center">
      <div className="bg-gray-900 border border-gray-800 p-10 rounded-[3rem] shadow-2xl space-y-8">
        <div className="text-center">
            <div className="w-20 h-20 bg-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-black">
                {user.email?.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">{user.email}</h1>
        </div>

        <div className="bg-black p-6 rounded-2xl border border-gray-800 text-center">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Your Personal User UUID</label>
            <p className="font-mono text-xs text-purple-400 break-all mb-4 selection:bg-purple-500 selection:text-white">
                {user.id}
            </p>
            <button 
                onClick={copyId}
                className={`w-full py-3 rounded-xl font-bold transition-all ${copied ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
                {copied ? '✓ COPIED TO CLIPBOARD' : 'COPY UUID FOR INVITES'}
            </button>
        </div>

        <p className="text-[10px] text-center text-gray-600 leading-relaxed font-bold uppercase tracking-tighter">
            Send this UUID to a plant administrator to be added to their Home Base or Cabin locations.
        </p>

        <Link href="/" className="block text-center text-xs font-black text-gray-500 hover:text-white underline uppercase">
            Return to Dashboard
        </Link>
      </div>
    </div>
  )
}