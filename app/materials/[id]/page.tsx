'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useOrganization } from '../../context/OrganizationContext'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function MaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { organization } = useOrganization()
  const resolvedParams = use(params)
  const materialId = resolvedParams.id

  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [item, setItem] = useState<any>(null)
  const [locationBreakdown, setLocationBreakdown] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])

  const [form, setForm] = useState({
    name: '', description: '', category_id: '', default_location_id: '',
    unit: 'units', reorder_point: 0, lot_quantity: 1, active: true
  })

  // "On-the-fly" creation states
  const [isNewCat, setIsNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isNewLoc, setIsNewLoc] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [isNewUnit, setIsNewUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');

  useEffect(() => {
    async function loadAll() {
      if (!organization || materialId === 'undefined') return

      try {
        const { data: cats } = await supabase.from('categories').select('*').order('name')
        const { data: uns } = await supabase.from('units').select('*').order('name')
        const { data: locs } = await supabase.from('locations').select('*').eq('organization_id', organization.id).order('name')
        
        setCategories(cats || []); setUnits(uns || []); setLocations(locs || [])

        const { data: mat } = await supabase.from('materials').select('*, categories(name), locations(name)').eq('id', materialId).single()
        const { data: breakdown } = await supabase.from('view_stock_by_location').select('*').eq('material_id', materialId).gt('quantity', 0)
        const { data: moves } = await supabase.from('inventory_movements').select('*, locations(name)').eq('material_id', materialId).order('created_at', { ascending: false }).limit(10)

        if (mat) {
          setItem(mat)
          setForm({
            name: mat.name,
            description: mat.description || '',
            category_id: mat.category_id || '',
            default_location_id: mat.default_location_id || '',
            unit: mat.unit || 'units',
            reorder_point: mat.reorder_point || 0,
            lot_quantity: mat.lot_quantity || 1,
            active: mat.active
          })
        }
        setLocationBreakdown(breakdown || []); setHistory(moves || [])
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    loadAll()
  }, [materialId, organization])

  const handleSave = async () => {
    if (!organization) return
    setSaving(true)

    let finalCatId = form.category_id
    let finalLocId = form.default_location_id
    let finalUnit = form.unit

    if (isNewCat && newCatName.trim()) {
        const { data: c } = await supabase.from('categories').insert([{ name: newCatName, organization_id: organization.id }]).select().single()
        if (c) finalCatId = c.id
    }
    if (isNewLoc && newLocName.trim()) {
        const { data: l } = await supabase.from('locations').insert([{ name: newLocName, organization_id: organization.id }]).select().single()
        if (l) finalLocId = l.id
    }
    if (isNewUnit && newUnitName.trim()) {
        await supabase.from('units').insert([{ name: newUnitName, organization_id: organization.id }])
        finalUnit = newUnitName
    }

    const { error } = await supabase.from('materials').update({
      name: form.name,
      description: form.description,
      category_id: finalCatId || null,
      default_location_id: finalLocId || null,
      unit: finalUnit,
      reorder_point: form.reorder_point,
      lot_quantity: form.lot_quantity,
      active: form.active
    }).eq('id', materialId)

    if (!error) { setIsEditing(false); window.location.reload(); }
    setSaving(false)
  }

  if (loading) return <div className="p-8 text-white animate-pulse">Syncing Master Record...</div>
  const totalStock = locationBreakdown.reduce((acc, curr) => acc + curr.quantity, 0)

  return (
    <div className="min-h-screen text-white p-4 md:p-8 font-sans max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-10">
        <Link href="/materials" className="text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest">← Back</Link>
        <button onClick={() => setIsEditing(!isEditing)} className={`px-8 py-2 rounded-xl font-bold transition-all ${isEditing ? 'bg-red-950 text-red-400' : 'bg-white text-black'}`}>
          {isEditing ? 'Discard Changes' : 'Edit Material'}
        </button>
      </div>

      <div className="space-y-8">
        {/* HEADER AREA */}
        <section>
          {isEditing ? (
            <input className="text-5xl font-black bg-transparent border-b-2 border-purple-500 outline-none w-full mb-2" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          ) : (
            <h1 className="text-6xl font-black tracking-tighter uppercase">{item?.name}</h1>
          )}
          
          <div className="flex items-center gap-4 mt-2">
            {isEditing ? (
               <div className="flex items-center gap-2">
                 {isNewCat ? (
                    <input placeholder="New Category" className="bg-gray-800 text-xs p-1 rounded border border-purple-500" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                 ) : (
                    <select className="bg-gray-800 text-purple-400 text-xs font-bold px-3 py-1 rounded border border-purple-800" value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}>
                        <option value="">-- Select Category --</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 )}
                 <button onClick={() => setIsNewCat(!isNewCat)} className="text-[10px] text-gray-500 underline">{isNewCat ? 'Cancel' : '+ New'}</button>
               </div>
            ) : (
              <span className="bg-purple-900/20 text-purple-400 border border-purple-800 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                {item?.categories?.name || 'Uncategorized'}
              </span>
            )}
          </div>
        </section>

        {/* REPLENISHMENT & STOCK DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 text-center">
            <span className="text-[10px] font-black text-gray-500 uppercase block mb-2">Total Stock</span>
            <span className={`text-5xl font-black ${totalStock <= form.reorder_point ? 'text-red-500' : 'text-green-500'}`}>{totalStock}</span>
            <span className="block text-xs text-gray-600 font-bold mt-1 uppercase">{form.unit}</span>
          </div>

          {/* EDITABLE REORDER POINT */}
          <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 text-center">
            <span className="text-[10px] font-black text-gray-500 uppercase block mb-2">Min. Stock Level</span>
            {isEditing ? (
              <input type="number" className="bg-black border border-purple-500 text-3xl font-black w-full text-center rounded-xl p-1" value={form.reorder_point} onChange={e => setForm({...form, reorder_point: parseInt(e.target.value) || 0})} />
            ) : (
              <span className="text-4xl font-black text-gray-300">{item?.reorder_point}</span>
            )}
          </div>

          {/* EDITABLE BUY QUANTITY */}
          <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 text-center">
            <span className="text-[10px] font-black text-gray-500 uppercase block mb-2">Buy Qty (Lot)</span>
            {isEditing ? (
              <input type="number" className="bg-black border border-purple-500 text-3xl font-black w-full text-center rounded-xl p-1" value={form.lot_quantity} onChange={e => setForm({...form, lot_quantity: parseInt(e.target.value) || 1})} />
            ) : (
              <span className="text-4xl font-black text-blue-400">+{item?.lot_quantity}</span>
            )}
          </div>

          {/* STATUS TOGGLE */}
          <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 flex flex-col justify-center items-center">
            <span className="text-[10px] font-black text-gray-500 uppercase block mb-2">Active Status</span>
            <button 
              disabled={!isEditing} 
              onClick={() => setForm({...form, active: !form.active})}
              className={`text-xs font-black px-4 py-2 rounded-full border ${form.active ? 'bg-green-900/20 text-green-400 border-green-800' : 'bg-red-900/20 text-red-400 border-red-800'}`}
            >
              {form.active ? 'ACTIVE' : 'INACTIVE'}
            </button>
          </div>
        </div>

        {/* SECONDARY INFO: LOCATION & DESCRIPTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-900/50 p-8 rounded-3xl border border-gray-800 space-y-4">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Storage Logistics</h3>
            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
              <span className="text-sm text-gray-400">Default Primary Location:</span>
              {isEditing ? (
                <select className="bg-black border border-purple-500 text-sm p-2 rounded-lg" value={form.default_location_id} onChange={e => setForm({...form, default_location_id: e.target.value})}>
                  <option value="">-- Set Default --</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              ) : (
                <span className="font-black text-purple-400">{item?.locations?.name || 'NOT CONFIGURED'}</span>
              )}
            </div>
            
            <div className="space-y-2 pt-2">
                <span className="text-[10px] font-black text-gray-600 uppercase">Description</span>
                {isEditing ? (
                  <textarea className="w-full bg-black border border-gray-700 p-3 rounded-xl text-sm" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                ) : (
                  <p className="text-sm text-gray-400 italic">{item?.description || "No description provided."}</p>
                )}
            </div>
          </div>

          <div className="bg-gray-900/50 p-8 rounded-3xl border border-gray-800 overflow-hidden">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Stock Breakdown</h3>
            {locationBreakdown.length > 0 ? (
                <div className="divide-y divide-gray-800">
                  {locationBreakdown.map((loc, i) => (
                    <div key={i} className="py-3 flex justify-between items-center">
                        <span className="font-bold text-gray-300">{loc.location_name}</span>
                        <span className="font-mono text-xl">{loc.quantity} <span className="text-[10px] text-gray-600">{form.unit}</span></span>
                    </div>
                  ))}
                </div>
            ) : <p className="text-gray-600 text-sm italic">Physically out of stock in all locations.</p>}
          </div>
        </div>

        {isEditing && (
            <button onClick={handleSave} disabled={saving} className="w-full bg-green-600 py-6 rounded-3xl font-black text-2xl hover:bg-green-500 shadow-2xl transition-all">
                {saving ? 'UPDATING MASTER RECORD...' : 'AUTHORIZE CHANGES'}
            </button>
        )}
      </div>
    </div>
  )
}