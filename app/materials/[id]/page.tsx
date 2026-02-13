'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useOrganization } from '../../context/OrganizationContext'
import { ArrowLeft, Save, Trash2, Package, MapPin, Target, AlertTriangle, ArrowLeftRight, Edit2, X, Shield } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function ItemMasterContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const itemId = params.id as string
  const { organization } = useOrganization()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Read the URL parameter to see if we should auto-open edit mode
  const autoEdit = searchParams.get('edit') === 'true'
  const [isEditing, setIsEditing] = useState(autoEdit)
  const [isAdmin, setIsAdmin] = useState(false)
  
  const [currentStock, setCurrentStock] = useState(0)
  const [stockByLocation, setStockByLocation] = useState<Record<string, number>>({})

  // Form State
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [reorderPoint, setReorderPoint] = useState<number | ''>('')
  const [lotQuantity, setLotQuantity] = useState<number | ''>('')

  // Dropdown Master Data
  const [categories, setCategories] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      const [roleRes, catRes, unitRes, locRes, matRes, stockRes, txRes] = await Promise.all([
        user ? supabase.from('organization_members').select('role').eq('organization_id', organization.id).eq('user_id', user.id).single() : Promise.resolve({ data: null }),
        // Look for Plant-specific OR Global (null) categories and units
        supabase.from('categories').select('*').or(`organization_id.eq.${organization.id},organization_id.is.null`),
        supabase.from('units').select('*').or(`organization_id.eq.${organization.id},organization_id.is.null`),
        supabase.from('locations').select('*').eq('organization_id', organization.id),
        supabase.from('materials').select('*').eq('id', itemId).single(),
        supabase.from('view_current_stock').select('current_stock').eq('material_id', itemId).single(),
        supabase.from('inventory_transactions').select('location_id, quantity').eq('material_id', itemId)
      ])

      if (roleRes.data) setIsAdmin(['admin', 'owner'].includes(roleRes.data.role))
      if (catRes.data) setCategories(catRes.data)
      if (unitRes.data) setUnits(unitRes.data)
      if (locRes.data) setLocations(locRes.data)
      if (stockRes.data) setCurrentStock(stockRes.data.current_stock || 0)

      // Calculate subtotals by location
      if (txRes.data) {
        const subtotals: Record<string, number> = {}
        txRes.data.forEach(tx => {
          const loc = tx.location_id || 'unassigned'
          subtotals[loc] = (subtotals[loc] || 0) + tx.quantity
        })
        setStockByLocation(subtotals)
      }

      if (matRes.data) {
        setName(matRes.data.name)
        setCategoryId(matRes.data.category_id || '')
        setUnitId(matRes.data.unit_id || (unitRes.data?.find((u: any) => u.name === matRes.data.unit)?.id) || '')
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
    const payload = {
      name,
      category_id: categoryId || null,
      unit_id: unitId || null,
      default_location_id: locationId || null,
      reorder_point: reorderPoint === '' ? null : Number(reorderPoint),
      lot_quantity: lotQuantity === '' ? null : Number(lotQuantity)
    }

    const { error } = await supabase.from('materials').update(payload).eq('id', itemId)
    setSaving(false)
    if (error) alert(error.message)
    else {
      setIsEditing(false)
      // Remove ?edit=true from URL without refreshing
      router.replace(`/materials/${itemId}`)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`CASCADE DANGER: Are you sure you want to force delete ${name}? This will permanently erase ALL transaction history for this item. This cannot be undone.`)) return
    
    // 1. Explicitly wipe transaction history first to satisfy foreign key constraints
    await supabase.from('inventory_transactions').delete().eq('material_id', itemId)
    
    // 2. Delete the actual material
    const { error } = await supabase.from('materials').delete().eq('id', itemId)
    if (error) alert(error.message)
    else router.push('/materials')
  }

  const displayCategory = categories.find(c => c.id === categoryId)?.name || 'Uncategorized'
  const displayUnit = units.find(u => u.id === unitId)?.name || 'No Unit Set'
  const displayLocation = locations.find(l => l.id === locationId)?.name || 'No Chamber Assigned'

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-purple-500">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Shield size={40} />
          <p className="text-xs font-black uppercase tracking-widest text-gray-500">Loading Master Record...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800 pb-6 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/materials')} className="p-3 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white hover:border-purple-500 transition-all">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter italic text-gray-100">{name}</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Master Data Configuration</p>
            </div>
          </div>
          
          <div className="flex gap-3">
             <button onClick={() => router.push(`/inventory/new?material_id=${itemId}`)} className="flex items-center gap-2 bg-[#0f0f0f] border border-gray-800 hover:border-purple-500 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all text-purple-400">
               <ArrowLeftRight size={14} /> Transact
             </button>

             {isAdmin && !isEditing && (
               <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-gray-900 border border-gray-800 hover:bg-gray-800 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all text-white">
                 <Edit2 size={14} /> Edit Details
               </button>
             )}

             {isEditing && (
               <>
                 <button onClick={() => { setIsEditing(false); router.replace(`/materials/${itemId}`) }} className="flex items-center gap-2 bg-gray-900 border border-gray-800 hover:text-red-400 hover:border-red-900/50 px-4 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all text-gray-400">
                   <X size={14} /> Cancel
                 </button>
                 <button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-500 px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-purple-900/20">
                   <Save size={14} /> {saving ? 'Saving...' : 'Save File'}
                 </button>
               </>
             )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* MAIN CONFIGURATION COLUMN */}
          <div className="md:col-span-2 space-y-6">
            
            <div className={`bg-[#0f0f0f] border p-6 rounded-[2rem] space-y-6 transition-colors ${isEditing ? 'border-purple-500/50' : 'border-gray-800'}`}>
               <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
                  <Package size={16} className="text-purple-500" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Core Identity</h2>
               </div>
               
               <div className="space-y-4">
                 <div>
                   <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Item Name</label>
                   {isEditing ? (
                     <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-black border border-gray-800 p-4 rounded-xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200" />
                   ) : (
                     <p className="font-bold text-sm text-gray-200 bg-black/50 p-4 rounded-xl border border-gray-800/50">{name}</p>
                   )}
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Category</label>
                     {isEditing ? (
                       <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-black border border-gray-800 p-4 rounded-xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200 appearance-none">
                         <option value="">Uncategorized</option>
                         {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                     ) : (
                       <p className="font-bold text-sm text-gray-400 bg-black/50 p-4 rounded-xl border border-gray-800/50">{displayCategory}</p>
                     )}
                   </div>
                   <div>
                     <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Unit of Measure</label>
                     {isEditing ? (
                       <select value={unitId} onChange={e => setUnitId(e.target.value)} className="w-full bg-black border border-gray-800 p-4 rounded-xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200 appearance-none">
                         <option value="">No Unit Set</option>
                         {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                       </select>
                     ) : (
                       <p className="font-bold text-sm text-gray-400 bg-black/50 p-4 rounded-xl border border-gray-800/50">{displayUnit}</p>
                     )}
                   </div>
                 </div>
               </div>
            </div>

            <div className={`bg-[#0f0f0f] border p-6 rounded-[2rem] space-y-6 transition-colors ${isEditing ? 'border-blue-500/50' : 'border-gray-800'}`}>
               <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
                  <Target size={16} className="text-blue-500" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Logistics & Rules</h2>
               </div>
               
               <div className="space-y-4">
                 <div>
                   <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Default Chamber (Location)</label>
                   {isEditing ? (
                     <select value={locationId} onChange={e => setLocationId(e.target.value)} className="w-full bg-black border border-gray-800 p-4 rounded-xl outline-none focus:border-blue-500 transition-colors font-bold text-sm text-gray-200 appearance-none">
                       <option value="">No Location Assigned</option>
                       {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                     </select>
                   ) : (
                     <p className="font-bold text-sm text-gray-400 bg-black/50 p-4 rounded-xl border border-gray-800/50">{displayLocation}</p>
                   )}
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Reorder Point (MRP)</label>
                     {isEditing ? (
                       <input type="number" value={reorderPoint} onChange={e => setReorderPoint(e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 5" className="w-full bg-black border border-gray-800 p-4 rounded-xl outline-none focus:border-yellow-500 transition-colors font-bold text-sm text-gray-200" />
                     ) : (
                       <p className="font-bold text-sm text-yellow-500 bg-black/50 p-4 rounded-xl border border-gray-800/50">{reorderPoint !== '' ? reorderPoint : 'Not Set'}</p>
                     )}
                   </div>
                   <div>
                     <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Standard Lot Qty</label>
                     {isEditing ? (
                       <input type="number" value={lotQuantity} onChange={e => setLotQuantity(e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 12" className="w-full bg-black border border-gray-800 p-4 rounded-xl outline-none focus:border-blue-500 transition-colors font-bold text-sm text-gray-200" />
                     ) : (
                       <p className="font-bold text-sm text-gray-400 bg-black/50 p-4 rounded-xl border border-gray-800/50">{lotQuantity !== '' ? lotQuantity : 'Not Set'}</p>
                     )}
                   </div>
                 </div>
               </div>
            </div>

          </div>

          {/* SIDEBAR COLUMN */}
          <div className="space-y-6">
             
             {/* Live Stock & Subtotals Widget */}
             <div className="bg-[#1a0b2e] border border-purple-500/30 p-8 rounded-[2rem] text-center space-y-6 shadow-2xl shadow-purple-900/20">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Total Keep Stock</p>
                  <p className="text-7xl font-black tracking-tighter text-white leading-tight">{currentStock}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{displayUnit}</p>
                </div>
                
                {/* Location Subtotals List */}
                {Object.keys(stockByLocation).length > 0 && (
                  <div className="border-t border-purple-500/20 pt-4 space-y-2 text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-purple-400/70 mb-3">Chamber Distribution</p>
                    {Object.entries(stockByLocation).map(([locId, qty]) => {
                      if (qty <= 0) return null; // Don't show empty locations
                      const locName = locId === 'unassigned' ? 'Unassigned' : locations.find(l => l.id === locId)?.name || 'Unknown'
                      return (
                        <div key={locId} className="flex justify-between items-center bg-black/40 px-3 py-2 rounded-lg border border-purple-500/10">
                          <span className="text-xs font-bold text-gray-300 flex items-center gap-2">
                            <MapPin size={10} className="text-purple-500" /> {locName}
                          </span>
                          <span className="text-sm font-black text-purple-300">{qty}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
             </div>

             {isAdmin && isEditing && (
               <div className="bg-red-950/10 border border-red-900/30 p-6 rounded-[2rem] space-y-4 animate-in fade-in slide-in-from-top-4">
                 <div className="flex items-center gap-2">
                   <AlertTriangle size={14} className="text-red-500" />
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-red-500">Danger Zone</h3>
                 </div>
                 <p className="text-[10px] text-red-400/70 font-bold leading-relaxed uppercase tracking-widest">
                   Permanent deletion of master data and transaction history.
                 </p>
                 <button onClick={handleDelete} className="w-full bg-red-950/50 hover:bg-red-900 text-red-500 hover:text-white border border-red-900/50 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                   <Trash2 size={14} /> Delete Material
                 </button>
               </div>
             )}

          </div>
        </div>
      </div>
    </div>
  )
}

// Next 13+ requires useSearchParams to be wrapped in a Suspense boundary
export default function ItemMasterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <ItemMasterContent />
    </Suspense>
  )
}