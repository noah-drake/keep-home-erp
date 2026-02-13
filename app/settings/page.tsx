'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Factory, 
  Plus, 
  Save, 
  UserPlus, 
  Users, 
  Trash2, 
  Mail, 
  Zap, 
  AlertTriangle 
} from 'lucide-react'
import { useOrganization } from '../context/OrganizationContext'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function SettingsPage() {
  const router = useRouter()
  const { organization } = useOrganization()
  
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

      // Uses the secure RPC function we created in SQL
      const { data, error } = await supabase.rpc('get_team_roster', { org_id: organization.id })
      
      if (error) {
          console.error("Error fetching team:", error)
          return
      }

      if (data) {
          const mappedMembers = data.map((m: any) => ({
              user_id: m.user_id,
              role: m.role,
              profiles: {
                  email: m.email,
                  full_name: m.full_name
              }
          }))
          setMembers(mappedMembers)
      }
  }

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return
    const { error } = await supabase.from('organizations').update({ name: plantName }).eq('id', organization.id)
    if (error) alert(error.message)
    else {
        setMessage('Plant renamed successfully.')
        setTimeout(() => setMessage(''), 3000)
    }
  }

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

  const handleRemoveMember = async (userId: string) => {
      if (!confirm("Revoke this user's access? They will be instantly disconnected.")) return
      const { error } = await supabase.from('organization_members')
        .delete()
        .eq('organization_id', organization.id)
        .eq('user_id', userId)

      if (error) alert(error.message)
      else {
          setMembers(members.filter(m => m.user_id !== userId))
          setMessage("Access revoked.")
      }
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
    } else {
        alert("Name didn't match. Deletion cancelled.")
    }
  }

  const handleRelaunchWizard = () => {
    localStorage.setItem('force_wizard', 'true')
    router.push('/')
  }

  const isCurrentUserAdmin = members.find(m => m.user_id === currentUserId)?.role === 'admin'

  return (
    <div className="min-h-screen p-4 md:p-8 text-white font-sans max-w-5xl mx-auto space-y-10 pb-32">
      <div className="flex items-center gap-4 mb-4">
        <Factory size={40} className="text-purple-500" />
        <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">Keep Settings</h1>
            <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest">Managing {organization?.name}</p>
        </div>
      </div>

      {message && (
        <div className="bg-purple-500/20 border border-purple-500 text-purple-400 p-4 rounded-xl font-bold uppercase text-xs text-center animate-in fade-in">
            {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* RENAME PLANT */}
        <section className="bg-gray-900 p-8 rounded-[2.5rem] border border-gray-800 space-y-6 shadow-xl">
          <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
             <Save size={18} className="text-purple-500" />
             <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Plant Identity</h2>
          </div>
          <form onSubmit={handleUpdateName} className="space-y-4">
            <input className="w-full bg-black border border-gray-700 p-4 rounded-2xl outline-none focus:border-purple-500 font-bold text-sm" value={plantName} onChange={e => setPlantName(e.target.value)} />
            <button className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase text-xs hover:bg-purple-600 hover:text-white transition-all shadow-lg">Save Changes</button>
          </form>
        </section>

        {/* INVITE LINK */}
        <section className="bg-gray-900 p-8 rounded-[2.5rem] border border-gray-800 space-y-6 shadow-xl">
          <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
             <UserPlus size={18} className="text-blue-500" />
             <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Invite Personnel</h2>
          </div>
          <form onSubmit={handleGenerateInvite} className="space-y-4">
            <div className="flex gap-4">
                <select className="bg-black border border-gray-700 p-4 rounded-2xl outline-none font-bold text-xs uppercase" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                </select>
                <button disabled={loading} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs hover:bg-blue-500 transition-all">
                    {loading ? '...' : 'Create Link'}
                </button>
            </div>
          </form>

          {inviteLink && (
              <div className="mt-4 p-4 bg-black border border-blue-500/50 rounded-2xl animate-in fade-in zoom-in">
                  <input readOnly value={inviteLink} className="w-full bg-transparent text-blue-400 font-mono text-[10px] outline-none cursor-pointer mb-4" onClick={(e) => { (e.target as HTMLInputElement).select(); navigator.clipboard.writeText(inviteLink); setMessage("Copied!"); }} />
                  <a href={`https://mail.google.com/mail/?view=cm&fs=1&su=Invitation to join ${organization?.name}&body=Join my workspace on Keep:%0A%0A${inviteLink}`} target="_blank" rel="noopener noreferrer" className="w-full bg-white text-black py-3 rounded-xl font-black uppercase text-[10px] hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2">
                      <Mail size={14} /> Send via Gmail
                  </a>
              </div>
          )}
        </section>
      </div>

      {/* TEAM ROSTER */}
      <section className="bg-gray-900 p-8 rounded-[2.5rem] border border-gray-800 space-y-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
             <Users size={18} className="text-yellow-500" />
             <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Authorized Personnel ({members.length})</h2>
        </div>
        <div className="space-y-2">
            {members.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between p-4 bg-black border border-gray-800 rounded-2xl">
                    <div>
                        <p className="font-bold text-sm">{member.profiles?.full_name || 'System User'}</p>
                        <p className="text-[10px] text-gray-500 font-mono italic">{member.profiles?.email}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${member.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800 text-gray-400'}`}>
                            {member.role}
                        </span>
                        {isCurrentUserAdmin && member.user_id !== currentUserId && (
                            <button onClick={() => handleRemoveMember(member.user_id)} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors">
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
      </section>

      {/* SYSTEM SHORTCUTS */}
      <section className="bg-gray-900 p-8 rounded-[2.5rem] border border-gray-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
              <Zap size={18} className="text-purple-500" />
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">System Shortcuts</h2>
          </div>
          <button onClick={handleRelaunchWizard} className="flex items-center gap-2 text-xs font-black text-purple-500 uppercase tracking-widest hover:text-purple-400 transition-colors">
              <Zap size={14} /> Re-run Setup Wizard / Bulk Add from Global Registry
          </button>
      </section>

      {/* CREATE NEW PLANT */}
      <section className="bg-gray-900 p-8 rounded-[2.5rem] border border-gray-800 space-y-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
             <Plus size={18} className="text-green-500" />
             <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Initialize New Plant</h2>
        </div>
        <form onSubmit={handleCreatePlant} className="flex flex-col md:flex-row gap-4">
          <input className="flex-1 bg-black border border-gray-700 p-4 rounded-2xl outline-none focus:border-green-500 font-bold text-sm" placeholder="e.g. 'Second Base'" value={newPlantName} onChange={e => setNewPlantName(e.target.value)} />
          <button disabled={loading} className="bg-green-600 px-10 py-4 rounded-2xl font-black uppercase text-xs hover:bg-green-500 transition-all shadow-lg">Create</button>
        </form>
      </section>

      {/* DANGER ZONE */}
      <section className="bg-red-950/10 p-8 rounded-[2.5rem] border border-red-900/30 space-y-6">
          <div className="flex items-center gap-3 border-b border-red-900/30 pb-4">
              <AlertTriangle size={18} className="text-red-500" />
              <h2 className="text-xs font-black text-red-500 uppercase tracking-widest">Danger Zone</h2>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                  <p className="font-bold text-sm text-red-200">Delete {organization?.name}</p>
                  <p className="text-[10px] text-red-500/70 font-bold uppercase tracking-widest">Permanent destruction of all inventory and data.</p>
              </div>
              <button onClick={handleDeletePlant} className="bg-red-600 px-8 py-3 rounded-xl font-black uppercase text-[10px] hover:bg-red-500 transition-all shadow-lg">
                  Nuclear Option
              </button>
          </div>
      </section>
    </div>
  )
}