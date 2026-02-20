'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useOrganization } from '../../context/OrganizationContext'
import { ArrowLeft, Save, Trash2, Package, MapPin, Target, AlertTriangle, ArrowRightLeft, Edit2, X, ToggleLeft, ToggleRight, History, ArrowDownLeft, ArrowUpRight } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function ItemMasterContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const itemId = params.id as string
  const { organization } = useOrganization()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true')
  const [isAdmin, setIsAdmin] = useState(false)
  
  const [currentStock, setCurrentStock] = useState(0)
  const [stockByLocation, setStockByLocation] = useState<Record<string, number>>({})
  const [recentHistory, setRecentHistory] = useState<any[]>([])

  // Form State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [categoryId, setCategoryId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [reorderPoint, setReorderPoint] = useState<number | ''>('')
  const [lotQuantity, setLotQuantity] = useState<number | ''>('')

  // Relational Master Data
  const [categories, setCategories] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!organization || !itemId) return
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      const [roleRes, catRes, unitRes, locRes, matRes, stockRes, sblRes, historyRes] = await Promise.all([
        user ? supabase.from('organization_members').select('role').eq('organization_id', organization.id).eq('user_id', user.id).single() : Promise.resolve({ data: null }),
        supabase.from('categories').select('*').or(`organization_id.eq.${organization.id},organization_id.is.null`).order('name'),
        supabase.from('units').select('*').or(`organization_id.eq.${organization.id},organization_id.is.null`).order('name'),
        supabase.from('locations').select('*').eq('organization_id', organization.id).order('name'),
        supabase.from('materials').select('*').eq('id', itemId).single(),
        supabase.from('view_current_stock').select('current_stock').eq('material_id', itemId).single(),
        supabase.from('view_stock_by_location').select('location_id, quantity').eq('material_id', itemId),
        supabase.from('inventory_movements').select('*, locations(name)').eq('material_id', itemId).order('created_at', { ascending: false }).limit(10)
      ])

      if (roleRes.data) setIsAdmin(['admin', 'owner'].includes(roleRes.data.role))
      if (catRes.data) setCategories(catRes.data)
      if (unitRes.data) setUnits(unitRes.data)
      if (locRes.data) setLocations(locRes.data)
      if (stockRes.data) setCurrentStock(stockRes.data.current_stock || 0)
      if (historyRes.data) setRecentHistory(historyRes.data)

      if (sblRes.data) {
        const subtotals: Record<string, number> = {}
        sblRes.data.forEach((tx: any) => {
          const loc = tx.location_id || 'unassigned'
          subtotals[loc] = (subtotals[loc] || 0) + tx.quantity
        })
        setStockByLocation(subtotals)
      }

      if (matRes.data) {
        setName(matRes.data.name)
        setDescription(matRes.data.description || '')
        setIsActive(matRes.data.is_active ?? true)
        setCategoryId(matRes.data.category_id || '')
        // Legacy Fallback: If it has a string unit but no unit_id, try to find the matching ID
        setUnitId(matRes.data.unit_id || (unitRes.data?.find((u: any) => u.name === matRes.data.unit)?.id) || '')
        setLocationId(matRes.data.default_location_id || '')
        setReorderPoint(matRes.data.reorder_point ?? '')
        setLotQuantity(matRes.data.lot_quantity ?? '')
      }
      setLoading(false)
    }
    fetchData()
  }, [organization, itemId])

  // INLINE CREATION LOGIC
  const handleCategoryChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (val === 'CREATE_NEW') {
      const newName = prompt("Enter new Category name (e.g., 'Dairy', 'Hardware'):")
      if (!newName) return
      const { data, error } = await supabase.from('categories').insert([{ name: newName, organization_id: organization.id }]).select().single()
      if (data) {
        setCategories([...categories, data].sort((a, b) => a.name.localeCompare(b.name)))
        setCategoryId(data.id)
      } else if (error) alert(error.message)
    } else {
      setCategoryId(val)
    }
  }

  const handleUnitChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (val === 'CREATE_NEW') {
      const newName = prompt("Enter Unit full name (e.g., 'Gallon'):")
      if (!newName) return
      const newAbbr = prompt("Enter Unit abbreviation (e.g., 'Gal'):") || newName
      const { data, error } = await supabase.from('units').insert([{ name: newName, abbreviation: newAbbr, organization_id: organization.id }]).select().single()
      if (data) {
        setUnits([...units, data].sort((a, b) => a.name.localeCompare(b.name)))
        setUnitId(data.id)
      } else if (error) alert(error.message)
    } else {
      setUnitId(val)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      name, 
      description: description || null, 
      is_active: isActive, 
      category_id: categoryId || null, 
      unit_id: unitId || null,
      default_location_id: locationId || null, 
      reorder_point: reorderPoint === '' ? null : Number(reorderPoint), 
      lot_quantity: lotQuantity === '' ? null : Number(lotQuantity)
    }
    const { error } = await supabase.from('materials').update(payload).eq('id', itemId)
    setSaving(false)
    if (error) alert(error.message)
    else { setIsEditing(false); router.replace(`/materials/${itemId}`) }
  }

  const handleDelete = async () => {
    if (!confirm(`CASCADE DANGER: Force delete ${name}? This will permanently erase ALL transaction history.`)) return
    await supabase.from('inventory_movements').delete().eq('material_id', itemId)
    const { error } = await supabase.from('materials').delete().eq('id', itemId)
    if (error) alert(error.message)
    else router.push('/materials')
  }

  const displayCategory = categories.find(c => c.id === categoryId)?.name || 'Uncategorized'
  const displayUnit = units.find(u => u.id === unitId)?.name || 'No Unit Set'
  const displayLocation = locations.find(l => l.id === locationId)?.name || 'No Default Store'

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-black uppercase tracking-widest">Loading Dossier...</div>

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800 pb-6 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/materials')} className="p-3 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white hover:border-purple-500 transition-all"><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter italic text-gray-100 flex items-center gap-3">
                {name} {!isActive && <span className="text-xs bg-red-950 text-red-500 border border-red-900 px-2 py-1 rounded-md">INACTIVE</span>}
              </h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Master Data Dossier</p>
            </div>
          </div>
          <div className="flex gap-3">
             <button onClick={() => router.push(`/inventory?material_id=${itemId}`)} className="flex items-center gap-2 bg-[#0f0f0f] border border-gray-800 hover:border-purple-500 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all text-purple-400"><ArrowRightLeft size={14} /> Quick Transact</button>
             {isAdmin && !isEditing && <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-gray-900 border border-gray-800 hover:bg-gray-800 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all text-white"><Edit2 size={14} /> Edit Details</button>}
             {isEditing && (
               <>
                 <button onClick={() => { setIsEditing(false); router.replace(`/materials/${itemId}`) }} className="flex items-center gap-2 bg-gray-900 border border-gray-800 hover:text-red-400 px-4 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all text-gray-400"><X size={14} /> Cancel</button>
                 <button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-500 px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all shadow-lg active:scale-95"><Save size={14} /> {saving ? 'Saving...' : 'Save File'}</button>
               </>
             )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* MAIN COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            {/* Identity Box */}
            <div className={`bg-[#0f0f0f] border p-6 rounded-[2.5rem] space-y-6 transition-colors ${isEditing ? 'border-purple-500/50' : 'border-gray-800'}`}>
               <div className="flex items-center justify-between border-b border-gray-800/50 pb-4">
                  <div className="flex items-center gap-3"><Package size={18} className="text-purple-500" /><h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Core Identity</h2></div>
                  {isEditing && (
                    <button onClick={() => setIsActive(!isActive)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                      {isActive ? <ToggleRight size={24} className="text-green-500" /> : <ToggleLeft size={24} className="text-gray-600" />} <span className={isActive ? 'text-green-500' : 'text-gray-500'}>{isActive ? 'Active Status' : 'Inactive'}</span>
                    </button>
                  )}
               </div>
               <div className="space-y-5">
                 <div><label className="lbl">Item Name</label>
                   {isEditing ? <input value={name} onChange={e => setName(e.target.value)} className={inpt} /> : <p className="val">{name}</p>}</div>
                 <div><label className="lbl">Description / Notes</label>
                   {isEditing ? <textarea value={description} onChange={e => setDescription(e.target.value)} className={`${inpt} h-24 resize-none`} placeholder="Add details..." /> : <p className="val italic text-gray-500">{description || 'No description provided.'}</p>}</div>
                 <div className="grid grid-cols-2 gap-6">
                   <div><label className="lbl">Category</label>
                     {isEditing ? (
                        <select value={categoryId} onChange={handleCategoryChange} className={`${inpt} appearance-none`}>
                          <option value="">-- Select Category --</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          <option disabled>──────────</option>
                          <option value="CREATE_NEW" className="text-purple-400 font-black">+ Create New Category</option>
                        </select>
                     ) : <p className="val">{displayCategory}</p>}
                   </div>
                   <div><label className="lbl">Unit of Measure</label>
                     {isEditing ? (
                        <select value={unitId} onChange={handleUnitChange} className={`${inpt} appearance-none`}>
                          <option value="">-- Select Unit --</option>
                          {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                          <option disabled>──────────</option>
                          <option value="CREATE_NEW" className="text-purple-400 font-black">+ Create New Unit</option>
                        </select>
                     ) : <p className="val">{displayUnit}</p>}
                   </div>
                 </div>
               </div>
            </div>
            {/* Logistics Box */}
            <div className={`bg-[#0f0f0f] border p-6 rounded-[2.5rem] space-y-6 transition-colors ${isEditing ? 'border-blue-500/50' : 'border-gray-800'}`}>
               <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4"><Target size={18} className="text-blue-500" /><h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Logistics & Rules</h2></div>
               <div className="space-y-5">
                 <div><label className="lbl">Default Store</label>
                   {isEditing ? (
                      <select value={locationId} onChange={e => setLocationId(e.target.value)} className={`${inpt} focus:border-blue-500 appearance-none`}>
                        <option value="">No Default Store</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                   ) : <p className="val flex items-center gap-2"><MapPin size={14} className="text-gray-600"/> {displayLocation}</p>}
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                   <div><label className="lbl">Reorder Point (MRP)</label>
                     {isEditing ? <input type="number" value={reorderPoint} onChange={e => setReorderPoint(e.target.value === '' ? '' : Number(e.target.value))} className={`${inpt} focus:border-yellow-500`} placeholder="e.g. 5" /> : <p className={`val ${reorderPoint !== '' ? 'text-yellow-500' : 'text-gray-600'}`}>{reorderPoint !== '' ? reorderPoint : 'Not Set'}</p>}</div>
                   <div><label className="lbl">Standard Lot Qty</label>
                     {isEditing ? <input type="number" value={lotQuantity} onChange={e => setLotQuantity(e.target.value === '' ? '' : Number(e.target.value))} className={`${inpt} focus:border-blue-500`} placeholder="e.g. 12" /> : <p className="val">{lotQuantity !== '' ? lotQuantity : 'Not Set'}</p>}</div>
                 </div>
               </div>
            </div>
          </div>

          {/* SIDEBAR COLUMN */}
          <div className="space-y-6">
             <div className="bg-[#1a0b2e] border border-purple-500/30 p-8 rounded-[2.5rem] text-center space-y-6 shadow-2xl">
                <div><p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Total Keep Stock</p><p className="text-7xl font-black tracking-tighter text-white leading-none">{currentStock}</p><p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-2">{displayUnit}</p></div>
                {Object.keys(stockByLocation).length > 0 && (
                  <div className="border-t border-purple-500/20 pt-4 space-y-2 text-left"><p className="text-[9px] font-black uppercase tracking-widest text-purple-400/70 mb-3">Store Distribution</p>
                    {Object.entries(stockByLocation).map(([locId, qty]) => {
                      if (qty <= 0) return null;
                      const locName = locId === 'unassigned' ? 'Unassigned' : locations.find(l => l.id === locId)?.name || 'Unknown'
                      return <div key={locId} className="flex justify-between items-center bg-black/40 px-3 py-2 rounded-xl border border-purple-500/10"><span className="text-xs font-bold text-gray-300 flex items-center gap-2"><MapPin size={10} className="text-purple-500" /> {locName}</span><span className="text-sm font-black text-purple-300">{qty}</span></div>
                    })}
                  </div>
                )}
             </div>
             {isAdmin && isEditing && (
               <div className="bg-red-950/10 border border-red-900/30 p-6 rounded-[2.5rem] space-y-4 animate-in fade-in slide-in-from-top-4">
                 <div className="flex items-center gap-2"><AlertTriangle size={14} className="text-red-500" /><h3 className="text-[10px] font-black uppercase tracking-widest text-red-500">Danger Zone</h3></div>
                 <p className="text-[10px] text-red-400/70 font-bold leading-relaxed uppercase tracking-widest">Permanent deletion of master data and transaction history.</p>
                 <button onClick={handleDelete} className="w-full bg-red-950/50 hover:bg-red-900 text-red-500 hover:text-white border border-red-900/50 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"><Trash2 size={14} /> Delete Material</button>
               </div>
             )}
          </div>
        </div>

        {/* RECENT HISTORY BLOCK */}
        <div className="bg-[#0f0f0f] border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-xl">
          <div className="p-6 border-b border-gray-800/50 flex items-center gap-3"><History size={18} className="text-gray-400"/><h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Recent Movements</h2></div>
          <table className="w-full text-left text-xs">
            <tbody className="divide-y divide-gray-800/50">
              {recentHistory.length === 0 ? <tr><td className="p-6 text-center text-gray-600 font-bold italic">No recent activity.</td></tr> : recentHistory.map(mov => (
                <tr key={mov.id} className="hover:bg-gray-800/30">
                  <td className="p-4 text-gray-500 font-bold">{new Date(mov.created_at).toLocaleDateString()}</td>
                  <td className="p-4"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase border ${mov.movement_type.includes('IN') ? 'bg-purple-900/20 text-purple-400 border-purple-500/30' : mov.movement_type.includes('TRANSFER') ? 'bg-blue-900/20 text-blue-400 border-blue-500/30' : 'bg-yellow-900/20 text-yellow-500 border-yellow-500/30'}`}>{mov.movement_type.includes('IN')?<ArrowDownLeft size={8}/>:mov.movement_type.includes('TRANSFER')?<ArrowRightLeft size={8}/>:<ArrowUpRight size={8}/>} {mov.movement_type.replace('_',' ')}</span></td>
                  <td className="p-4 text-gray-400 font-bold flex items-center gap-2"><MapPin size={12}/> {mov.locations?.name || 'Unassigned'}</td>
                  <td className={`p-4 text-right font-black ${mov.quantity>0?'text-purple-400':'text-yellow-500'}`}>{mov.quantity>0?`+${mov.quantity}`:mov.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}

// Reusable Tailwind classes for form elements
const lbl = "block text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2"
const inpt = "w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200"

export default function ItemMasterPage() { return <Suspense fallback={<div className="min-h-screen bg-black"/>}><ItemMasterContent /></Suspense> }