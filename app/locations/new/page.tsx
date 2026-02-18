'use client'
import { useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useOrganization } from '../../context/OrganizationContext'
import { ArrowLeft, MapPin, Save, Plus } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function NewStoreContent() {
  const router = useRouter()
  const { organization } = useOrganization()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !organization) return
    
    setSaving(true)
    const { data, error } = await supabase.from('locations').insert([{ 
      name, 
      organization_id: organization.id 
    }]).select().single()
    
    setSaving(false)
    if (error) alert(error.message)
    else router.push(`/locations/${data.id}`) // Route directly to the new dossier
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        
        <div className="flex items-center gap-4 border-b border-gray-800 pb-6">
          <button onClick={() => router.back()} className="p-3 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-all"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic text-gray-100">Construct Store</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Define Physical Location</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="bg-[#0f0f0f] border border-gray-800 p-8 rounded-[2.5rem] space-y-8 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
             <MapPin size={18} className="text-purple-500" />
             <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Store Parameters</h2>
          </div>
          
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">Store Designation (Name)</label>
            <input 
              autoFocus
              required
              placeholder="e.g. Primary Pantry, Garage Rack A..."
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-lg text-gray-200" 
            />
          </div>

          <button disabled={saving} type="submit" className="w-full bg-purple-600 hover:bg-purple-500 py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95">
            {saving ? 'Constructing...' : <><Plus size={16} /> Establish Store</>}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function NewStorePage() { return <Suspense fallback={<div className="min-h-screen bg-black"/>}><NewStoreContent /></Suspense> }