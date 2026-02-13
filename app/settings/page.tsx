'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Factory, Plus, Save, UserPlus, Users, Trash2, Mail } from 'lucide-react'
import { useOrganization } from '../context/OrganizationContext'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function SettingsPage() {
  const { organization } = useOrganization()
  
  const [plantName, setPlantName] = useState('')
  const [newPlantName, setNewPlantName] = useState('')
  
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviteLink, setInviteLink] = useState('')
  
  const [members, setMembers] = useState<any[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Load the Plant data AND the Team Roster
  useEffect(() => { 
    if (organization) {
        setPlantName(organization.name)
        fetchTeamMembers()
    }
  }, [organization])

  const fetchTeamMembers = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)

      // Fetch the VIP list and join it with the new "profiles" window we made in SQL
      const { data } = await supabase.from('organization_members')
        .select(`
            user_id,
            role,
            profiles:user_id (email, full_name)
        `)
        .eq('organization_id', organization.id)
      
      if (data) setMembers(data)
  }

  // 1. Rename Plant
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

  // 2. Create New Plant
  const handleCreatePlant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlantName.trim()) return
    setLoading(true)
    const { data: org, error } = await supabase.from('organizations').insert([{ name: newPlantName }]).select().single()
    if (org) {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('organization_members').insert([{ organization_id: org.id, user_id: user?.id, role: 'admin' }])
        window.location.reload()
    } else alert(error?.message)
    setLoading(false)
  }

  // 3. Generate Invite
  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return
    setLoading(true)
    setMessage('')
    setInviteLink('')
    
    const { data, error } = await supabase.from('invites').insert([
        { organization_id: organization.id, role: inviteRole }
    ]).select().single()

    if (error) setMessage(error.message)
    else { 
        setInviteLink(`${window.location.origin}/login?invite_id=${data.id}`)
        setMessage("Magic link generated!")
    }
    setLoading(false)
  }

  // 4. Revoke Access (Kick User Out)
  const handleRemoveMember = async (userId: string) => {
      if (!confirm("Are you sure you want to revoke this user's access to this plant?")) return;
      
      const { error } = await supabase.from('organization_members')
        .delete()
        .eq('organization_id', organization.id)
        .eq('user_id', userId)

      if (error) {
          alert("Failed to remove member: " + error.message)
      } else {
          // Instantly remove them from the screen
          setMembers(members.filter(m => m.user_id !== userId))
          setMessage("User access revoked.")
      }
  }

  // Check if the current user is an Admin of this plant
  const isCurrentUserAdmin = members.find(m => m.user_id === currentUserId)?.role === 'admin'

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
            <input className="w-full bg-black border border-gray-700 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-sm" value={plantName} onChange={e => setPlantName(e.target.value)} />
            <button className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase text-xs hover:bg-purple-600 hover:text-white transition-all shadow-lg">Save Name</button>
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
                <select className="bg-black border border-gray-700 p-4 rounded-2xl outline-none font-bold text-xs uppercase" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
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
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Secure Link Generated:</p>
                  <input readOnly value={inviteLink} className="w-full bg-transparent text-blue-400 font-mono text-xs outline-none cursor-pointer mb-4" onClick={(e) => { (e.target as HTMLInputElement).select(); navigator.clipboard.writeText(inviteLink); setMessage("Link copied!"); }} />
                  
                  {/* THE GMAIL INTEGRATION BUTTON */}
                  <a 
                      href={`https://mail.google.com/mail/?view=cm&fs=1&su=Invitation to join ${organization?.name}&body=Hey!%0A%0AHere is your secure invitation link to join my workspace on Home ERP:%0A%0A${inviteLink}%0A%0AThis is a single-use link.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-white text-black py-3 rounded-xl font-black uppercase text-[10px] hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                      <Mail size={14} /> Send via Gmail
                  </a>
              </div>
          )}
        </section>
      </div>

      {/* TEAM MEMBERS ROSTER */}
      <section className="bg-gray-900 p-8 rounded-[2.5rem] border border-gray-800 space-y-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
             <Users size={18} className="text-yellow-500" />
             <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Team Roster ({members.length})</h2>
        </div>
        
        <div className="space-y-2">
            {members.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between p-4 bg-black border border-gray-800 rounded-2xl">
                    <div>
                        <p className="font-bold text-sm">{member.profiles?.full_name || 'Unknown User'}</p>
                        <p className="text-[10px] text-gray-500 font-mono">{member.profiles?.email}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${member.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800 text-gray-400'}`}>
                            {member.role}
                        </span>
                        
                        {/* Only show the Revoke button if the CURRENT user is an Admin, and they aren't trying to delete themselves */}
                        {isCurrentUserAdmin && member.user_id !== currentUserId && (
                            <button 
                                onClick={() => handleRemoveMember(member.user_id)}
                                className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                                title="Revoke Access"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
      </section>

      {/* CREATE NEW PLANT */}
      <section className="bg-gray-900 p-8 rounded-[2.5rem] border border-gray-800 space-y-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
             <Plus size={18} className="text-green-500" />
             <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Create New Plant Entity</h2>
        </div>
        <form onSubmit={handleCreatePlant} className="flex flex-col md:flex-row gap-4">
          <input className="flex-1 bg-black border border-gray-700 p-4 rounded-2xl outline-none focus:border-green-500 font-bold text-sm" placeholder="e.g. 'Office Warehouse'" value={newPlantName} onChange={e => setNewPlantName(e.target.value)} />
          <button disabled={loading} className="bg-green-600 px-10 py-4 rounded-2xl font-black uppercase text-xs hover:bg-green-500 transition-all shadow-lg shadow-green-900/20">Initialize Plant</button>
        </form>
      </section>
    </div>
  )
}