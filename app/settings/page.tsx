'use client'
import { useEffect, useState, Suspense } from 'react'
import { 
  Factory, Plus, Save, UserPlus, Users, Trash2, Mail, Zap, 
  AlertTriangle, ShieldCheck, Lock, KeyRound, User, CheckCircle2,
  Building2, Shield
} from 'lucide-react'

import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useOrganization } from '../context/OrganizationContext'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function SettingsContent() {
  const router = useRouter()
  const { organization, allOrganizations, setOrganization, isLoading } = useOrganization()
  
  // --- STATE ---
  // Personal Identity
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Plant & Roster
  const [plantName, setPlantName] = useState('')
  const [newPlantName, setNewPlantName] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviteLink, setInviteLink] = useState('')
  const [members, setMembers] = useState<any[]>([])

  // UI Status
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // --- INITIALIZATION ---
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || null)
        setCurrentUserId(user.id)
        // Fetch personal profile data
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
        if (profile) setDisplayName(profile.full_name || '')
      }
    }
    fetchUser()
  }, [])

  useEffect(() => { 
    if (organization) {
        setPlantName(organization.name)
        fetchTeamMembers()
    }
  }, [organization])

  const fetchTeamMembers = async () => {
      const { data, error } = await supabase.rpc('get_team_roster', { org_id: organization?.id })
      if (data) {
          const mappedMembers = data.map((m: any) => ({
              user_id: m.user_id, role: m.role, profiles: { email: m.email, full_name: m.full_name }
          }))
          setMembers(mappedMembers)
      }
  }

  // --- PERSONAL ACTIONS ---
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setMessage('')
    
    // Call the SQL RPC to securely update the underlying auth.users metadata
    const { error } = await supabase.rpc('update_display_name', { new_name: displayName })
    
    if (error) setError(error.message)
    else setMessage('Operator identity updated.')
    setLoading(false)
  }

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setMessage('')
    if (newPassword !== confirmPassword) return setError("Security mismatch: Passwords do not match.")
    if (newPassword.length < 6) return setError("Protocol violation: Password must be at least 6 characters.")
    
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setError(error.message)
    else {
      setMessage("Authentication credentials successfully updated.")
      setNewPassword(''); setConfirmPassword('')
    }
    setLoading(false)
  }

  // --- PLANT ACTIONS (ADMIN ONLY) ---
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return
    setLoading(true); setError(''); setMessage('')
    const { error } = await supabase.from('organizations').update({ name: plantName }).eq('id', organization.id)
    if (error) setError(error.message)
    else setMessage('Chamber renamed successfully.')
    setLoading(false)
  }

  const handleCreatePlant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlantName.trim()) return
    setLoading(true); setError(''); setMessage('')
    
    const { data: org, error } = await supabase.from('organizations').insert([{ name: newPlantName }]).select().single()
    if (org) {
        await supabase.from('organization_members').insert([{ organization_id: org.id, user_id: currentUserId, role: 'admin' }])
        setOrganization(org)
        router.push('/')
    } else setError(error?.message || 'Failed to construct chamber.')
    setLoading(false)
  }

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return
    setLoading(true); setMessage(''); setError(''); setInviteLink('')
    const { data, error } = await supabase.from('invites').insert([{ organization_id: organization.id, role: inviteRole }]).select().single()
    if (error) setError(error.message)
    else { 
      setInviteLink(`https://keep.nexus/login?invite_id=${data?.id || 'mock-invite-123'}`)
      setMessage("Secure transmission link generated!") 
    }
    setLoading(false)
  }

  const handleRemoveMember = async (userId: string) => {
      if (!confirm("Revoke this operator's access? They will be instantly disconnected from this chamber.")) return
      const { error } = await supabase.from('organization_members').delete().eq('organization_id', organization?.id).eq('user_id', userId)
      if (error) alert(error.message)
      else { 
        setMembers(members.filter(m => m.user_id !== userId))
        setMessage("Access privileges revoked.") 
      }
  }

  const handleDeletePlant = async () => {
    if (!organization) return
    const confirmName = prompt(`DANGER: This will delete ALL inventory data for this plant. Type "${organization.name}" to confirm:`)
    if (confirmName === organization.name) {
        setLoading(true)
        const { error } = await supabase.from('organizations').delete().eq('id', organization.id)
        if (error) alert(error.message)
        else window.location.href = '/' 
        setLoading(false)
    } else alert("Name didn't match. Deletion cancelled.")
  }

  // --- RENDER LOGIC ---
  if (isLoading) return <div className="min-h-screen bg-[#0a0a0a]" />

  const isCurrentUserAdmin = members.find(m => m.user_id === currentUserId)?.role === 'admin' || members.find(m => m.user_id === currentUserId)?.role === 'owner'

  // ==========================================
  // STATE 1: THE ONBOARDING WIZARD
  // ==========================================
  if (allOrganizations.length === 0) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col justify-center items-center p-4 text-white font-sans">
            <div className="w-full max-w-lg bg-[#0f0f0f] border border-gray-800 p-10 rounded-[3rem] shadow-2xl animate-in fade-in slide-in-from-bottom-8">
                <div className="w-20 h-20 bg-purple-900/20 border border-purple-500/30 rounded-3xl mx-auto mb-6 flex items-center justify-center">
                    <ShieldCheck size={40} className="text-purple-500" />
                </div>
                <h1 className="text-4xl font-black uppercase tracking-tighter text-center mb-2">Welcome to Keep Home ERP</h1>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center mb-10 leading-relaxed">
                    You have successfully secured your credentials. <br/>To begin managing inventory, you must establish a Plant.
                </p>

                <form onSubmit={handleCreatePlant} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 block mb-2">Initialize Plant Name</label>
                        <input 
                            required autoFocus placeholder="e.g. Home Base, Primary Warehouse..." 
                            className="w-full bg-black border border-gray-800 p-5 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-lg text-white text-center"
                            value={newPlantName} onChange={e => setNewPlantName(e.target.value)} 
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
  // STATE 2: THE SETTINGS DASHBOARD
  // ==========================================
  const inputClass = "w-full bg-black border border-gray-800 focus:border-purple-500 p-3.5 rounded-xl outline-none transition-colors font-bold text-sm text-gray-200 placeholder-gray-700"
  const labelClass = "block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2"

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans max-w-[1400px] mx-auto space-y-8 pb-32">
      
      {/* HEADER */}
      <header className="border-b border-gray-800 pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-[#0f0f0f] border border-gray-800 rounded-2xl flex items-center justify-center shadow-lg">
              <Factory size={28} className="text-purple-500" />
          </div>
          <div>
              <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100 leading-none">Settings</h1>
              <p className="text-gray-500 font-black text-[10px] uppercase tracking-widest mt-2 flex items-center gap-2">
                <Shield size={12} className={isCurrentUserAdmin ? "text-purple-500" : "text-gray-500"} /> 
                {isCurrentUserAdmin ? 'Admin Clearance' : 'Viewer Clearance'} • {organization?.name}
              </p>
          </div>
        </div>
      </header>

      {/* GLOBAL STATUS ALERTS */}
      {(message || error) && (
        <div className={`p-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 animate-in fade-in slide-in-from-top-2 border ${error ? 'bg-red-950/20 border-red-900/50 text-red-400' : 'bg-green-950/20 border-green-900/50 text-green-400'}`}>
            {error ? <AlertTriangle size={16}/> : <CheckCircle2 size={16}/>}
            {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Personal Identity & Plant Switcher */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* PERSONAL IDENTITY (All Users) */}
          <section className="bg-[#0f0f0f] p-6 sm:p-8 rounded-[2rem] border border-gray-800/80 shadow-xl">
            <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4 mb-6">
              <User size={18} className="text-purple-500" />
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-200">Operator Identity</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <p className={labelClass}>Operator Email (Immutable)</p>
                <div className="bg-black border border-gray-800 p-3.5 rounded-xl flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <p className="text-sm font-bold text-gray-400">{userEmail || 'Fetching...'}</p>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile}>
                <label className={labelClass}>Display Name</label>
                <div className="flex gap-3">
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} placeholder="Enter full name" />
                  <button type="submit" disabled={loading} className="bg-gray-900 hover:bg-purple-900/30 text-gray-400 hover:text-purple-400 border border-gray-800 hover:border-purple-500/50 px-4 rounded-xl transition-all"><Save size={16}/></button>
                </div>
              </form>

              <form onSubmit={handlePasswordUpdate} className="border-t border-gray-800/50 pt-6 space-y-4">
                <div>
                  <label className={labelClass}>Update Passkey</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={`${inputClass} pl-10`} placeholder="New Password" />
                  </div>
                </div>
                <div>
                  <div className="relative">
                    <KeyRound size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`${inputClass} pl-10`} placeholder="Confirm Password" />
                  </div>
                </div>
                <button type="submit" disabled={loading || !newPassword} className="w-full bg-gray-900 border border-gray-800 hover:border-purple-500 text-gray-300 hover:text-white py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">Commit New Passkey</button>
              </form>
            </div>
          </section>

          {/* PLANT SWITCHER (All Users) */}
          <section className="bg-[#0f0f0f] p-6 sm:p-8 rounded-[2rem] border border-gray-800/80 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-800/50 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <Building2 size={18} className="text-blue-500" />
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-200">Your Chambers</h2>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 bg-gray-900 px-2 py-1 rounded-md">{allOrganizations.length} Access</span>
            </div>
            
            <div className="space-y-2">
              {allOrganizations.map(org => (
                <button 
                  key={org.id} 
                  onClick={() => { setOrganization(org); router.push('/') }}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${organization?.id === org.id ? 'bg-blue-900/10 border-blue-500/30' : 'bg-black border-gray-800 hover:border-gray-600'}`}
                >
                  <span className={`font-bold text-sm ${organization?.id === org.id ? 'text-blue-400' : 'text-gray-300'}`}>{org.name}</span>
                  {organization?.id === org.id && <span className="text-[8px] font-black uppercase tracking-widest text-blue-500 bg-blue-950/50 px-2 py-1 rounded">Active</span>}
                </button>
              ))}
            </div>
          </section>

        </div>

        {/* RIGHT COLUMN: Active Plant Management (Admin Gated features inside) */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* PERSONNEL & INVITES (Visible to all, actions gated) */}
          <section className="bg-[#0f0f0f] p-6 sm:p-8 rounded-[2rem] border border-gray-800/80 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/50 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <Users size={18} className="text-yellow-500" />
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-200">Personnel Roster</h2>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Active Chamber: <span className="text-gray-300">{organization?.name}</span></span>
            </div>

            {/* Invite Generator (Admin Only) */}
            {isCurrentUserAdmin && (
              <div className="mb-8 bg-black/50 border border-gray-800 p-5 rounded-2xl">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2"><UserPlus size={14} className="text-blue-500"/> Invite Operator</h3>
                <p className="text-xs text-gray-500 font-medium mb-4 leading-relaxed">Generate a secure link to grant a user access to <strong className="text-gray-300">{organization?.name}</strong>. If they do not have a Keep account, the link will prompt them to register first.</p>
                
                <form onSubmit={handleGenerateInvite} className="flex gap-3">
                  <select className={`${inputClass} max-w-[120px] uppercase text-[10px]`} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2">
                      {loading ? 'Processing...' : 'Generate Magic Link'}
                  </button>
                </form>

                {inviteLink && (
                  <div className="mt-4 p-4 bg-blue-950/20 border border-blue-900/50 rounded-xl animate-in fade-in zoom-in">
                    <input readOnly value={inviteLink} className="w-full bg-transparent text-blue-400 font-mono text-[10px] outline-none cursor-pointer mb-4" onClick={(e) => { (e.target as HTMLInputElement).select(); navigator.clipboard.writeText(inviteLink); setMessage("Link copied to clipboard!"); }} />
                    <a href={`https://mail.google.com/mail/?view=cm&fs=1&su=Invitation to join ${organization?.name}&body=You have been cleared for access to ${organization?.name} on Keep Home ERP.%0A%0AUse this secure link to log in or register:%0A${inviteLink}`} target="_blank" rel="noopener noreferrer" className="w-full bg-blue-600/20 border border-blue-500/50 text-blue-400 py-3 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center gap-2">
                        <Mail size={14} /> Send via Gmail
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* The Roster List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {members.map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between p-4 bg-black border border-gray-800 rounded-2xl group hover:border-yellow-500/30 transition-colors">
                        <div className="truncate pr-4">
                            <p className="font-black text-sm text-gray-200 truncate">
                              {member.profiles?.full_name || 'System Operator'} 
                              {member.user_id === currentUserId && <span className="ml-2 text-[9px] text-yellow-600 uppercase tracking-widest">(You)</span>}
                            </p>
                            <p className="text-[10px] text-gray-500 font-mono italic mt-0.5 truncate">{member.profiles?.email}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${member.role === 'admin' || member.role === 'owner' ? 'bg-purple-900/20 border-purple-500/30 text-purple-400' : 'bg-gray-900 border-gray-800 text-gray-400'}`}>
                                {member.role}
                            </span>
                            {isCurrentUserAdmin && member.user_id !== currentUserId && (
                                <button onClick={() => handleRemoveMember(member.user_id)} className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-950/30 rounded-lg transition-colors" title="Revoke Access">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
          </section>

          {/* PLANT ADMINISTRATION (Admin Only) */}
          {isCurrentUserAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* RENAME ACTIVE PLANT */}
              <section className="bg-[#0f0f0f] p-6 sm:p-8 rounded-[2rem] border border-gray-800/80 shadow-xl">
                <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4 mb-4">
                    <Save size={18} className="text-purple-500" />
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Update Chamber</h2>
                </div>
                <form onSubmit={handleUpdateName} className="space-y-4">
                  <input className={inputClass} value={plantName} onChange={e => setPlantName(e.target.value)} />
                  <button disabled={loading} className="w-full bg-gray-900 border border-gray-800 hover:border-purple-500 text-gray-300 hover:text-white py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-sm">Commit Name</button>
                </form>
              </section>

              {/* CREATE NEW PLANT */}
              <section className="bg-[#0f0f0f] p-6 sm:p-8 rounded-[2rem] border border-gray-800/80 shadow-xl">
                <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4 mb-4">
                    <Plus size={18} className="text-green-500" />
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">New Chamber</h2>
                </div>
                <form onSubmit={handleCreatePlant} className="space-y-4">
                  <input className={inputClass} placeholder="e.g. 'Second Base'" value={newPlantName} onChange={e => setNewPlantName(e.target.value)} />
                  <button disabled={loading} className="w-full bg-gray-900 border border-gray-800 text-green-500 hover:bg-green-600 hover:text-white py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-sm">Construct Structure</button>
                </form>
              </section>

              {/* SYSTEM SHORTCUTS */}
              <section className="md:col-span-2 bg-[#0f0f0f] p-6 rounded-[2rem] border border-gray-800/80 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                      <Zap size={18} className="text-purple-500" />
                      <div>
                        <h2 className="text-xs font-black text-gray-200 uppercase tracking-widest">Global Ingestion</h2>
                        <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">Re-run the initial setup wizard to bulk-import items.</p>
                      </div>
                  </div>
                  <button onClick={() => { localStorage.setItem('force_wizard', 'true'); router.push('/') }} className="bg-black border border-gray-800 hover:border-purple-500/50 hover:bg-purple-900/10 text-gray-400 hover:text-purple-400 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap">
                      Launch Wizard
                  </button>
              </section>

              {/* DANGER ZONE */}
              <section className="md:col-span-2 bg-red-950/10 p-6 sm:p-8 rounded-[2rem] border border-red-900/30 space-y-4">
                  <div className="flex items-center gap-3 border-b border-red-900/30 pb-4">
                      <AlertTriangle size={18} className="text-red-500" />
                      <h2 className="text-xs font-black text-red-500 uppercase tracking-widest">Danger Zone</h2>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                          <p className="font-black text-sm text-red-200">Demolish {organization?.name}</p>
                          <p className="text-[9px] text-red-500/70 font-bold uppercase tracking-widest mt-1">Permanent destruction of all inventory and data.</p>
                      </div>
                      <button onClick={handleDeletePlant} className="bg-red-950/50 border border-red-900/50 text-red-500 py-3.5 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-sm shrink-0">
                          Execute Nuclear Option
                      </button>
                  </div>
              </section>

            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <SettingsContent />
    </Suspense>
  )
}