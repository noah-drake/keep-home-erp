'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useOrganization } from '../../context/OrganizationContext'
import { ArrowLeft, Save, Trash2, MapPin, Package, AlertTriangle, Edit2, X, Box, ArrowRightLeft, ClipboardCheck } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function StoreDossierContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const locId = params.id as string
  const { organization } = useOrganization()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true')
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Data State
  const [name, setName] = useState('')
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!organization || !locId) return
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      const [roleRes, locRes, itemsRes] = await Promise.all([
        user ? supabase.from('organization_members').select('role').eq('organization_id', organization.id).eq('user_id', user.id).single() : Promise.resolve({ data: null }),
        supabase.from('locations').select('*').eq('id', locId).single(),
        supabase.from('view_stock_by_location').select('*').eq('location_id', locId).gt('quantity', 0).order('material_name')
      ])

      if (roleRes.data) setIsAdmin(['admin', 'owner'].includes(roleRes.data.role))
      if (locRes.data) setName(locRes.data.name)
      if (itemsRes.data) setItems(itemsRes.data)
      
      setLoading(false)
    }
    fetchData()
  }, [organization, locId])

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('locations').update({ name }).eq('id', locId)
    setSaving(false)
    if (error) alert(error.message)
    else { setIsEditing(false); router.replace(`/locations/${locId}`) }
  }

  const handleDelete = async () => {
    if (!confirm(`CASCADE DANGER: Force demolish ${name}? This will permanently erase ALL transaction history referencing this location.`)) return
    await supabase.from('inventory_movements').delete().eq('location_id', locId)
    const { error } = await supabase.from('locations').delete().eq('id', locId)
    if (error) alert(error.message)
    else router.push('/locations')
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-black uppercase tracking-widest">Loading Dossier...</div>

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800 pb-6 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/locations')} className="p-3 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-all"><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter italic text-gray-100 flex items-center gap-3">{name}</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Store Master Dossier</p>
            </div>
          </div>
          <div className="flex gap-3">
             <button onClick={() => router.push(`/inventory?location_id=${locId}`)} className={btnSec}>
               <ArrowRightLeft size={14} /> Process Goods
             </button>
             <button onClick={() => router.push(`/inventory/count?location_id=${locId}`)} className={`${btnSec} text-blue-400`}>
               <ClipboardCheck size={14} /> Audit Store
             </button>
             {isAdmin && !isEditing && (
               <button onClick={() => setIsEditing(true)} className={btnMain}>
                 <Edit2 size={14} /> Edit Store
               </button>
             )}
             {isEditing && (
               <>
                 <button onClick={() => { setIsEditing(false); router.replace(`/locations/${locId}`) }} className={`${btnSec} text-red-400`}><X size={14} /> Cancel</button>
                 <button onClick={handleSave} disabled={saving} className={`${btnMain} bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-900/20`}><Save size={14} /> {saving ? 'Saving...' : 'Save File'}</button>
               </>
             )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <div className={`bg-[#0f0f0f] border p-6 rounded-[2.5rem] space-y-6 transition-colors ${isEditing ? 'border-purple-500/50' : 'border-gray-800'}`}>
               <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
                  <MapPin size={18} className="text-purple-500" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Core Identity</h2>
               </div>
               <div>
                 <label className={lbl}>Store Name</label>
                 {isEditing ? (
                   <input value={name} onChange={e => setName(e.target.value)} className={inpt} />
                 ) : (
                   <p className={val}>{name}</p>
                 )}
               </div>
            </div>

            {isAdmin && isEditing && (
              <div className="bg-red-950/10 border border-red-900/30 p-6 rounded-[2.5rem] space-y-4 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-2"><AlertTriangle size={14} className="text-red-500" /><h3 className="text-[10px] font-black uppercase tracking-widest text-red-500">Danger Zone</h3></div>
                <p className="text-[10px] text-red-400/70 font-bold leading-relaxed uppercase tracking-widest">Permanent demolition of this store and its history.</p>
                <button onClick={handleDelete} className="w-full bg-red-950/50 hover:bg-red-900 text-red-500 hover:text-white border border-red-900/50 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"><Trash2 size={14} /> Demolish Store</button>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="bg-[#0f0f0f] border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-xl">
              <div className="p-6 border-b border-gray-800/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Box size={18} className="text-gray-400"/>
                  <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Active Contents Inventory</h2>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-gray-900 text-gray-500 px-3 py-1 rounded-lg">
                  {items.length} SKUs
                </span>
              </div>
              
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.length === 0 ? (
                  <div className="col-span-full py-16 text-center">
                     <Package size={32} className="mx-auto text-gray-800 mb-3" />
                     <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">This store is currently empty.</p>
                  </div>
                ) : (
                  items.map(item => (
                    <div 
                      key={item.material_id} 
                      onClick={() => router.push(`/materials/${item.material_id}`)}
                      className="bg-black border border-gray-800 p-4 rounded-2xl flex justify-between items-center hover:border-purple-500/50 hover:bg-gray-900 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-purple-500 shrink-0">
                                <Package size={16} />
                            </div>
                            <div className="truncate">
                                <h3 className="text-xs font-black uppercase tracking-tight group-hover:text-purple-400 truncate">{item.material_name}</h3>
                                <span className="text-[9px] font-bold text-gray-600 uppercase truncate block">{item.category || 'Good'}</span>
                            </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                            <span className="block text-[8px] font-black text-gray-600 uppercase tracking-widest">Qty</span>
                            <span className="text-xl font-black font-mono text-white leading-none">{item.quantity}</span>
                        </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Reusable Tailwind classes for form elements
const lbl = "block text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2";
const inpt = "w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200";
const val = "font-bold text-sm text-gray-200 bg-black/50 p-4 rounded-2xl border border-gray-800/50";
const btnSec = "flex items-center gap-2 bg-[#0f0f0f] border border-gray-800 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all text-purple-400 hover:border-purple-500";
const btnMain = "flex items-center gap-2 bg-gray-900 border border-gray-800 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all text-white hover:bg-gray-800";

export default function StoreDossierPage() { return <Suspense fallback={<div className="min-h-screen bg-black"/>}><StoreDossierContent /></Suspense> }