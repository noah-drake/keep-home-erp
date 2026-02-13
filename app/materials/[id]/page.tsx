'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'
import { useOrganization } from '../../context/OrganizationContext'
import { ArrowLeft, Save, Trash2, Package, MapPin, Target, AlertTriangle, ArrowLeftRight } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function ItemMasterPage() {
  const router = useRouter()
  const params = useParams()
  const itemId = params.id as string
  const { organization } = useOrganization()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentStock, setCurrentStock] = useState(0)

  // Form State
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [reorderPoint, setReorderPoint] = useState<number | ''>('')
  const [lotQuantity, setLotQuantity] = useState<number | ''>('')

  // Dropdown Data
  const [categories, setCategories] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      
      // Fetch dropdown data
      const [catRes, unitRes, locRes, matRes, stockRes] = await Promise.all([
        supabase.from('categories').select('*').eq('organization_id', organization.id),
        supabase.from('units').select('*').eq('organization_id', organization.id),
        supabase.from('locations').select('*').eq('organization_id', organization.id),
        supabase.from('materials').select('*').eq('id', itemId).single(),
        supabase.from('view_current_stock').select('current_stock').eq('material_id', itemId).single()
      ])

      if (catRes.data) setCategories(catRes.data)
      if (unitRes.data) setUnits(unitRes.data)
      if (locRes.data) setLocations(locRes.data)
      
      if (stockRes.data) setCurrentStock(stockRes.data.current_stock || 0)

      if (matRes.data) {
        setName(matRes.data.name)
        setCategoryId(matRes.data.category_id || '')
        setUnitId(matRes.data.unit_id || '')
        setLocationId(matRes.data.default_location_id || '')
        setReorderPoint(matRes.data.reorder_point ?? '')
        setLotQuantity(matRes.data.lot_quantity ?? '')
      }
      setLoading(false)
    }

    if (organization && itemId) fetchData()
  }, [organization, itemId])

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('materials').update({
      name,
      category_id: categoryId || null,
      unit_id: unitId || null,
      default_location_id: locationId || null,
      reorder_point: reorderPoint === '' ? null : Number(reorderPoint),
      lot_quantity: lotQuantity === '' ? null : Number(lotQuantity)
    }).eq('id', itemId)

    setSaving(false)
    if (error) alert(error.message)
    else router.push('/materials')
  }

  const handleDelete = async () => {
    if (!confirm(`DANGER: Are you sure you want to delete ${name}? This will also delete all transaction history for this item.`)) return
    
    const { error } = await supabase.from('materials').delete().eq('id', itemId)
    if (error) alert(error.message)
    else router.push('/materials')
  }

  if (loading) return null // Prevent layout jump while loading

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* HEADER & NAVIGATION */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/materials')}
              className="p-3 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white hover:border-purple-500 transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter italic text-gray-100">{name}</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Master Data Configuration</p>
            </div>
          </div>
          
          <div className="flex gap-3">
             <button 
               onClick={() => router.push(`/inventory/new?material_id=${itemId}`)}
               className="hidden sm:flex items-center gap-2 bg-[#0f0f0f] border border-gray-800 hover:border-purple-500 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all text-purple-400"
             >
               <ArrowLeftRight size={14} /> Quick Transact
             </button>
             <button 
               onClick={handleSave} 
               disabled={saving}
               className="bg-purple-600 hover:bg-purple-500 px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-purple-900/20"
             >
               <Save size={14} /> {saving ? 'Saving...' : 'Save File'}
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* MAIN CONFIGURATION COLUMN */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Identity Box */}
            <div className="bg-[#0f0f0f] border border-gray-800 p-6 rounded-[2rem] space-y-6">
               <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
                  <Package size={16} className="text-purple-500" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Core Identity</h2>
               </div>
               
               <div className="space-y-4">
                 <div>
                   <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Item Name</label>
                   <input 
                     value={name} 
                     onChange={e => setName(e.target.value)} 
                     className="w-full bg-black border border-gray-800 p-4 rounded-xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200"
                   />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Category</label>
                     <select 
                       value={categoryId} 
                       onChange={e => setCategoryId(e.target.value)}
                       className="w-full bg-black border border-gray-800 p-4 rounded-xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200 appearance-none"
                     >
                       <option value="">Uncategorized</option>
                       {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Unit of Measure</label>
                     <select 
                       value={unitId} 
                       onChange={e => setUnitId(e.target.value)}
                       className="w-full bg-black border border-gray-800 p-4 rounded-xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200 appearance-none"
                     >
                       <option value="">No Unit Set</option>
                       {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                     </select>
                   </div>
                 </div>
               </div>
            </div>

            {/* Logistics & Rules Box */}
            <div className="bg-[#0f0f0f] border border-gray-800 p-6 rounded-[2rem] space-y-6">
               <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
                  <Target size={16} className="text-blue-500" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Logistics & Rules</h2>
               </div>
               
               <div className="space-y-4">
                 <div>
                   <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Default Chamber (Location)</label>
                   <select 
                     value={locationId} 
                     onChange={e => setLocationId(e.target.value)}
                     className="w-full bg-black border border-gray-800 p-4 rounded-xl outline-none focus:border-blue-500 transition-colors font-bold text-sm text-gray-200 appearance-none"
                   >
                     <option value="">No Location Assigned</option>
                     {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                   </select>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Reorder Point (MRP)</label>
                     <input 
                       type="number"
                       value={reorderPoint} 
                       onChange={e => setReorderPoint(e.target.value ? Number(e.target.value) : '')} 
                       placeholder="e.g. 5"
                       className="w-full bg-black border border-gray-800 p-4 rounded-xl outline-none focus:border-yellow-500 transition-colors font-bold text-sm text-gray-200"
                     />
                   </div>
                   <div>
                     <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Standard Lot Qty</label>
                     <input 
                       type="number"
                       value={lotQuantity} 
                       onChange={e => setLotQuantity(e.target.value ? Number(e.target.value) : '')} 
                       placeholder="e.g. 12"
                       className="w-full bg-black border border-gray-800 p-4 rounded-xl outline-none focus:border-blue-500 transition-colors font-bold text-sm text-gray-200"
                     />
                   </div>
                 </div>
               </div>
            </div>

          </div>

          {/* SIDEBAR COLUMN */}
          <div className="space-y-6">
             
             {/* Live Stock Widget */}
             <div className="bg-purple-900/10 border border-purple-500/30 p-6 rounded-[2rem] text-center space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Current Stock</p>
                <p className="text-6xl font-black tracking-tighter text-white">{currentStock}</p>
             </div>

             {/* Danger Zone */}
             <div className="bg-red-950/10 border border-red-900/30 p-6 rounded-[2rem] space-y-4 mt-8">
               <div className="flex items-center gap-2">
                 <AlertTriangle size={14} className="text-red-500" />
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-red-500">Danger Zone</h3>
               </div>
               <p className="text-xs text-red-400/70 font-bold leading-relaxed">
                 Deleting this material will erase its master file and permanently orphan its transaction history.
               </p>
               <button 
                 onClick={handleDelete}
                 className="w-full bg-red-950/50 hover:bg-red-900 text-red-500 hover:text-white border border-red-900/50 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
               >
                 Delete Material
               </button>
             </div>

          </div>
        </div>
      </div>
    </div>
  )
}