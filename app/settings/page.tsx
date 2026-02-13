'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Factory, Plus, Save, UserPlus } from 'lucide-react'
import { useOrganization } from '../context/OrganizationContext'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function SettingsPage() {
  const { organization } = useOrganization()
  
  const [plantName, setPlantName] = useState('')
  const [newPlantName, setNewPlantName] = useState('')
  
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviteLink, setInviteLink] = useState('')
  
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

  // 2. Create a totally new plant
  const handleCreatePlant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlantName.trim()) return
    setLoading(true)
    
    const { data: org, error } = await supabase.from('organizations').insert([{ name: newPlantName }]).select().single()
    
    if (org) {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('organization_members').insert([{ 
            organization_id: org.id, 
            user_id: user?.id, 
            role: 'admin' 
        }])
        window.location.reload()
    } else {
        alert(error?.message)
    }
    setLoading(false)
  }

  // 3. Generate a Magic Invite Link for the active plant
  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return
    setLoading(true)
    setMessage('')
    setInviteLink('')
    
    const { data, error } = await supabase.from('invites').insert([
        { organization_id: organization.id, role: inviteRole }
    ]).select().single()

    if (error) {
        setMessage(error.message)
    } else { 
        const link = `${window.location.origin}/login?invite_id=${data.id}`
        setInviteLink(link)
        setMessage("Magic link generated!")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen p-4 md:p-8 text-white font-sans max-w-5xl mx-auto space-y-12 pb-24">
      <div className="flex items-center gap-4 mb-8">
        <Factory size={40} className="text-purple-500" />
        <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">System Settings</h1>
            <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest">Configuration for {organization?.name}</p>
        </div>
      </div>

      {message && (
        <div className="bg-purple-500/20 border border-purple-500 text-purple-400 p-4 rounded-xl font-bold uppercase text-xs text-center animate-in fade-in">
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
                className="w-full bg-black border border-gray-700 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-sm" 
                value={plantName} 
                onChange={e => setPlantName(e.target.value)} 
            />
            <button className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase text-xs hover:bg-purple-600 hover:text-white transition-all shadow-lg">
                Save Name
            </button>
          </form>
        </section>

        {/* MAGIC INVITE LINK */}
        <section className="bg-gray-900 p-8 rounded-[2.5rem] border border-gray-800 space-y-6 shadow-xl">
          <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
             <UserPlus size={18} className="text-blue-500" />
             <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Invite to {organization?.name}</h2>
          </div>
          
          <form onSubmit={handleGenerateInvite} className="space-y-4">
            <div className="flex gap-4">
                <select 
                    className="bg-black border border-gray-700 p-4 rounded-2xl outline-none font-bold text-xs uppercase" 
                    value={inviteRole} 
                    onChange={e => setInviteRole(e.target.value)}
                >
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                </select>
                <button disabled={loading} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20">
                    {loading ? 'Creating...' : 'Generate Link'}
                </button>
            </div>
          </form>

          {inviteLink && (
              <div className="mt-4 p-4 bg-black border border-blue-500/50 rounded-2xl animate-in fade-in zoom-in duration-300">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Copy & Send this link:</p>
                  <input 
                      readOnly 
                      value={inviteLink} 
                      className="w-full bg-transparent text-blue-400 font-mono text-xs outline-none cursor-pointer" 
                      onClick={(e) => {
                          (e.target as HTMLInputElement).select(); 
                          navigator.clipboard.writeText(inviteLink);
                          setMessage("Link copied to clipboard!");
                      }} 
                  />
              </div>
          )}
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
            className="flex-1 bg-black border border-gray-700 p-4 rounded-2xl outline-none focus:border-green-500 font-bold text-sm" 
            placeholder="e.g. 'Office Warehouse' or 'Vacation Home'" 
            value={newPlantName} 
            onChange={e => setNewPlantName(e.target.value)} 
          />
          <button disabled={loading} className="bg-green-600 px-10 py-4 rounded-2xl font-black uppercase text-xs hover:bg-green-500 transition-all shadow-lg shadow-green-900/20">
            {loading ? 'Initializing...' : 'Initialize Plant'}
          </button>
        </form>
      </section>
    </div>
  )
}