'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Factory, Plus, Save, UserPlus, Users, Trash2, Mail, Zap, AlertTriangle, ShieldCheck } from 'lucide-react'
import { useOrganization } from '../context/OrganizationContext'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function SettingsPage() {
  const router = useRouter()
  // We grab setOrganization so we can instantly log them in when they create a plant
  const { organization, allOrganizations, setOrganization, isLoading } = useOrganization()
  
  const [plantName, setPlantName] = useState('')
  const [newPlantName, setNewPlantName] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviteLink, setInviteLink] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { 
    if (organization) {
        setPlantName(organization.name)
        fetchTeamMembers()
    }
  }, [organization])

  const fetchTeamMembers = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
      const { data, error } = await supabase.rpc('get_team_roster', { org_id: organization.id })
      if (data) {
          const mappedMembers = data.map((m: any) => ({
              user_id: m.user_id, role: m.role, profiles: { email: m.email, full_name: m.full_name }
          }))
          setMembers(mappedMembers)
      }
  }

  // --- ACTIONS ---
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return
    const { error } = await supabase.from('organizations').update({ name: plantName }).eq('id', organization.id)
    if (error) alert(error.message)
    else { setMessage('Plant renamed successfully.'); setTimeout(() => setMessage(''), 3000) }
  }

  const handleCreatePlant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlantName.trim()) return
    setLoading(true)
    
    // 1. Create the Plant
    const { data: org, error } = await supabase.from('organizations').insert([{ name: newPlantName }]).select().single()
    if (org) {
        // 2. Assign the user as admin
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('organization_members').insert([{ organization_id: org.id, user_id: user?.id, role: 'admin' }])
        
        // 3. Auto-select this new plant so the app unlocks instantly
        setOrganization(org)
        router.push('/')
    } else alert(error?.message)
    setLoading(false)
  }

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return
    setLoading(true); setMessage(''); setInviteLink('')
    const { data, error } = await supabase.from('invites').insert([{ organization_id: organization.id, role: inviteRole }]).select().single()
    if (error) setMessage(error.message)
    else { setInviteLink(`${window.location.origin}/login?invite_id=${data.id}`); setMessage("Magic link generated!") }
    setLoading(false)
  }

  const handleRemoveMember = async (userId: string) => {
      if (!confirm("Revoke this user's access? They will be instantly disconnected.")) return
      const { error } = await supabase.from('organization_members').delete().eq('organization_id', organization.id).eq('user_id', userId)
      if (error) alert(error.message)
      else { setMembers(members.filter(m => m.user_id !== userId)); setMessage("Access revoked.") }
  }

  const handleDeletePlant = async () => {
    if (!organization) return
    const confirmName = prompt(`DANGER: This will delete ALL data for this plant. Type "${organization.name}" to confirm:`)
    if (confirmName === organization.name) {
        setLoading(true)
        const { error } = await supabase.from('organizations').delete().eq('id', organization.id)
        if (error) alert(error.message)
        else window.location.href = '/' 
        setLoading(false)
    } else alert("Name didn't match. Deletion cancelled.")
  }

  // --- RENDER LOGIC ---
  
  // Wait for Context to figure out who they are
  if (isLoading) return <div className="min-h-screen bg-[#0a0a0a]" />

  const isCurrentUserAdmin = members.find(m => m.user_id === currentUserId)?.role === 'admin'

  // ==========================================
  // SPLIT PERSONALITY 1: THE ONBOARDING WIZARD
  // ==========================================
  if (allOrganizations.length === 0) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col justify-center items-center p-4 text-white font-sans">
            <div className="w-full max-w-lg bg-[#0f0f0f] border border-gray-800 p-10 rounded-[3rem] shadow-2xl animate-in fade-in slide-in-from-bottom-8">
                <div className="w-20 h-20 bg-purple-900/20 border border-purple-500/30 rounded-3xl mx-auto mb-6 flex items-center justify-center">
                    <ShieldCheck size={40} className="text-purple-500" />
                </div>
                <h1 className="text-4xl font-black uppercase tracking-tighter text-center mb-2">Welcome to The Keep</h1>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center mb-10 leading-relaxed">
                    You have successfully secured your credentials. <br/>To begin managing inventory, you must establish a Plant.
                </p>

                <form onSubmit={handleCreatePlant} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 block mb-2">Initialize Plant Name</label>
                        <input 
                            required 
                            autoFocus
                            placeholder="e.g. Home Base, Primary Warehouse..." 
                            className="w-full bg-black border border-gray-800 p-5 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-lg text-white text-center"
                            value={newPlantName} 
                            onChange={e => setNewPlantName(e.target.value)} 
                        />
                    </div>
                    <button disabled={loading} className="w-full bg-purple-600 hover:bg-purple-500 py-5 rounded-2xl font-black uppercase text-xs tracking-widest text-white transition-all shadow-lg shadow-purple-900/20 active:scale-95 flex items-center justify-center gap-2">
                        {loading ? 'Initializing...' : <><Factory size={16}/> Construct Plant</>}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-800/50 text-center">
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-2">Were you invited by an administrator?</p>
                    <p className="text-[10px] font-bold text-gray-500 italic">Click the magic link in your email to instantly join their roster.</p>
                </div>
            </div>
        </div>
      )
  }

  // ==========================================
  // SPLIT PERSONALITY 2: THE SETTINGS DASHBOARD
  // ==========================================
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans max-w-5xl mx-auto space-y-10 pb-32">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 bg-[#0f0f0f] border border-gray-800 rounded-2xl flex items-center justify-center">
            <Factory size={32} className="text-purple-500" />
        </div>
        <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100">Keep Settings</h1>
            <p className="text-gray-500 font-black text-[10px] uppercase tracking-widest">Managing {organization?.name}</p>
        </div>
      </div>

      {message && (
        <div className="bg-purple-900/20 border border-purple-500/50 text-purple-400 p-4 rounded-xl font-black uppercase tracking-widest text-[10px] text-center animate-in fade-in">
            {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* RENAME PLANT */}
        <section className="bg-[#0f0f0f] p-8 rounded-[2.5rem] border border-gray-800 space-y-6 shadow-xl hover:border-gray-700 transition-colors">
          <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
             <Save size={18} className="text-purple-500" />
             <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Plant Identity</h2>
          </div>
          <form onSubmit={handleUpdateName} className="space-y-4">
            <input className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 font-bold text-sm transition-colors text-white" value={plantName} onChange={e => setPlantName(e.target.value)} />
            <button className="w-full bg-purple-600 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-purple-500 transition-all shadow-lg active:scale-95">Save Changes</button>
          </form>
        </section>

        {/* INVITE LINK */}
        <section className="bg-[#0f0f0f] p-8 rounded-[2.5rem] border border-gray-800 space-y-6 shadow-xl hover:border-gray-700 transition-colors">
          <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
             <UserPlus size={18} className="text-blue-500" />
             <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Invite Personnel</h2>
          </div>
          <form onSubmit={handleGenerateInvite} className="space-y-4">
            <div className="flex gap-4">
                <select className="bg-black border border-gray-800 p-4 rounded-2xl outline-none font-bold text-xs uppercase text-gray-300 focus:border-blue-500 transition-colors" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                </select>
                <button disabled={loading} className="flex-1 bg-blue-600 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-900/20">
                    {loading ? '...' : 'Create Link'}
                </button>
            </div>
          </form>

          {inviteLink && (
              <div className="mt-4 p-4 bg-blue-950/20 border border-blue-900/50 rounded-2xl animate-in fade-in zoom-in">
                  <input readOnly value={inviteLink} className="w-full bg-transparent text-blue-400 font-mono text-[10px] outline-none cursor-pointer mb-4" onClick={(e) => { (e.target as HTMLInputElement).select(); navigator.clipboard.writeText(inviteLink); setMessage("Copied!"); }} />
                  <a href={`https://mail.google.com/mail/?view=cm&fs=1&su=Invitation to join ${organization?.name}&body=Join my workspace on Keep:%0A%0A${inviteLink}`} target="_blank" rel="noopener noreferrer" className="w-full bg-blue-600/20 border border-blue-500/50 text-blue-400 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center gap-2">
                      <Mail size={14} /> Send via Gmail
                  </a>
              </div>
          )}
        </section>
      </div>

      {/* TEAM ROSTER */}
      <section className="bg-[#0f0f0f] p-8 rounded-[2.5rem] border border-gray-800 space-y-6 shadow-xl hover:border-gray-700 transition-colors">
        <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
             <Users size={18} className="text-yellow-500" />
             <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Authorized Personnel ({members.length})</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {members.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between p-4 bg-black border border-gray-800 rounded-2xl group hover:border-yellow-500/50 transition-colors">
                    <div>
                        <p className="font-black text-sm text-gray-200">{member.profiles?.full_name || 'System User'}</p>
                        <p className="text-[10px] text-gray-500 font-mono italic mt-0.5">{member.profiles?.email}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${member.role === 'admin' ? 'bg-purple-900/20 border-purple-500/30 text-purple-400' : 'bg-gray-900 border-gray-800 text-gray-400'}`}>
                            {member.role}
                        </span>
                        {isCurrentUserAdmin && member.user_id !== currentUserId && (
                            <button onClick={() => handleRemoveMember(member.user_id)} className="p-2 bg-red-950/30 text-red-500 border border-red-900/50 hover:bg-red-500 hover:text-white rounded-lg transition-colors">
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
      </section>

      {/* SYSTEM SHORTCUTS */}
      <section className="bg-[#0f0f0f] p-8 rounded-[2.5rem] border border-gray-800 space-y-4 shadow-xl hover:border-gray-700 transition-colors">
          <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
              <Zap size={18} className="text-purple-500" />
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">System Shortcuts</h2>
          </div>
          <button onClick={() => { localStorage.setItem('force_wizard', 'true'); router.push('/') }} className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-purple-400 transition-colors">
              <Zap size={14} /> Re-run Setup Wizard / Bulk Add from Global Registry
          </button>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* CREATE NEW PLANT */}
        <section className="bg-[#0f0f0f] p-8 rounded-[2.5rem] border border-gray-800 space-y-6 shadow-xl hover:border-gray-700 transition-colors">
          <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
              <Plus size={18} className="text-green-500" />
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Initialize New Plant</h2>
          </div>
          <form onSubmit={handleCreatePlant} className="flex flex-col gap-4">
            <input className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-green-500 font-bold text-sm transition-colors" placeholder="e.g. 'Second Base'" value={newPlantName} onChange={e => setNewPlantName(e.target.value)} />
            <button disabled={loading} className="w-full bg-gray-900 border border-gray-800 text-green-500 hover:bg-green-600 hover:text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg active:scale-95">Construct Building</button>
          </form>
        </section>

        {/* DANGER ZONE */}
        <section className="bg-red-950/10 p-8 rounded-[2.5rem] border border-red-900/30 space-y-6">
            <div className="flex items-center gap-3 border-b border-red-900/30 pb-4">
                <AlertTriangle size={18} className="text-red-500" />
                <h2 className="text-xs font-black text-red-500 uppercase tracking-widest">Danger Zone</h2>
            </div>
            <div className="flex flex-col gap-4">
                <div>
                    <p className="font-black text-sm text-red-200">Demolish {organization?.name}</p>
                    <p className="text-[9px] text-red-500/70 font-bold uppercase tracking-widest mt-1">Permanent destruction of all inventory and data.</p>
                </div>
                <button onClick={handleDeletePlant} className="w-full bg-red-950/50 border border-red-900/50 text-red-500 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-95">
                    Execute Nuclear Option
                </button>
            </div>
        </section>
      </div>
    </div>
  )
}