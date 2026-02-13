'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { User, Factory, Plus, Save, UserPlus, HelpCircle } from 'lucide-react'
import { useOrganization } from '../context/OrganizationContext'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function SettingsPage() {
  const { organization } = useOrganization()
  
  const [plantName, setPlantName] = useState('')
  const [newPlantName, setNewPlantName] = useState('')
  
  const [inviteUserId, setInviteUserId] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { 
    if (organization) setPlantName(organization.name) 
  }, [organization])

  // 1. Rename the currently active plant
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return
    const { error } = await supabase.from('organizations').update({ name: plantName }).eq('id', organization.id)
    
    if (error) alert(error.message)
    else {
        setMessage('Plant renamed successfully.')
        setTimeout(() => window.location.reload(), 1000)
    }
  }

  // 2. Create a totally new plant (e.g. "Summer Home")
  const handleCreatePlant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlantName.trim()) return
    setLoading(true)
    
    // Create Org
    const { data: org, error } = await supabase.from('organizations').insert([{ name: newPlantName }]).select().single()
    
    if (org) {
        // Assign Creator as Admin
        const { data: user } = await supabase.auth.getUser()
        await supabase.from('organization_members').insert([{ 
            organization_id: org.id, 
            user_id: user.user?.id, 
            role: 'admin' 
        }])
        window.location.reload()
    } else {
        alert(error?.message)
    }
    setLoading(false)
  }

  // 3. Invite a user to the CURRENT plant
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization || !inviteUserId.trim()) return
    
    // Check if already a member
    const { data: existing } = await supabase.from('organization_members')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('user_id', inviteUserId)
        .single()

    if (existing) return alert("User is already a member of this plant.")

    const { error } = await supabase.from('organization_members').insert([
        { organization_id: organization.id, user_id: inviteUserId, role: inviteRole }
    ])

    if (error) alert(error.message)
    else { 
        setMessage("User added successfully!")
        setInviteUserId('')
        setTimeout(() => setMessage(''), 3000)
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8 text-white font-sans max-w-5xl mx-auto space-y-12">
      <div className="flex items-center gap-4 mb-8">
        <Factory size={40} className="text-purple-500" />
        <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">System Settings</h1>
            <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest">Configuration for {organization?.name}</p>
        </div>
      </div>

      {message && (
        <div className="bg-green-500/20 border border-green-500 text-green-400 p-4 rounded-xl font-bold uppercase text-xs text-center animate-pulse">
            {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* RENAME CURRENT PLANT */}
        <section className="bg-gray-900 p-8 rounded-[2.5rem] border border-gray-800 space-y-6 shadow-xl">
          <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
             <Save size={18} className="text-purple-500" />
             <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Active Plant Name</h2>
          </div>
          <form onSubmit={handleUpdateName} className="space-y-4">
            <input 
                className="w-full bg-black border border-gray-700 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold" 
                value={plantName} 
                onChange={e => setPlantName(e.target.value)} 
            />
            <button className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase text-xs hover:bg-purple-600 hover:text-white transition-all">
                Save Name
            </button>
          </form>
        </section>

        {/* INVITE USERS */}
        <section className="bg-gray-900 p-8 rounded-[2.5rem] border border-gray-800 space-y-6 shadow-xl">
          <div className="flex justify-between items-center border-b border-gray-800 pb-4">
             <div className="flex items-center gap-3">
                <UserPlus size={18} className="text-blue-500" />
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Add Member</h2>
             </div>
             <Link href="/profile" className="flex items-center gap-1 text-[9px] font-bold text-gray-600 hover:text-blue-400 uppercase transition-colors">
                <HelpCircle size={10} /> Find UUID?
             </Link>
          </div>
          
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
                <label className="text-[9px] font-bold text-gray-500 uppercase ml-2 mb-1 block">User UUID (From their Profile)</label>
                <input 
                    className="w-full bg-black border border-gray-700 p-4 rounded-2xl outline-none focus:border-blue-500 transition-colors font-mono text-xs text-blue-300" 
                    placeholder="e.g. 8f92j-29..." 
                    value={inviteUserId} 
                    onChange={e => setInviteUserId(e.target.value)} 
                />
            </div>
            <div className="flex gap-4">
                <select 
                    className="bg-black border border-gray-700 p-4 rounded-2xl outline-none font-bold text-xs uppercase" 
                    value={inviteRole} 
                    onChange={e => setInviteRole(e.target.value)}
                >
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                </select>
                <button className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20">
                    Grant Access
                </button>
            </div>
          </form>
        </section>
      </div>

      {/* CREATE NEW PLANT */}
      <section className="bg-gray-900 p-8 rounded-[2.5rem] border border-gray-800 space-y-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
             <Plus size={18} className="text-green-500" />
             <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Create New Plant Entity</h2>
        </div>
        <form onSubmit={handleCreatePlant} className="flex flex-col md:flex-row gap-4">
          <input 
            className="flex-1 bg-black border border-gray-700 p-4 rounded-2xl outline-none focus:border-green-500 font-bold" 
            placeholder="e.g. 'Office Warehouse' or 'Vacation Home'" 
            value={newPlantName} 
            onChange={e => setNewPlantName(e.target.value)} 
          />
          <button disabled={loading} className="bg-green-600 px-10 py-4 rounded-2xl font-black uppercase text-xs hover:bg-green-500 transition-all shadow-lg shadow-green-900/20">
            {loading ? 'Creating...' : 'Initialize Plant'}
          </button>
        </form>
      </section>
    </div>
  )
}