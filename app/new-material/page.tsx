'use client'
import { createClient } from '@supabase/supabase-js'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useOrganization } from '../context/OrganizationContext'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function NewMaterialPage() {
  const router = useRouter()
  const { organization } = useOrganization()
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [reorderPoint, setReorderPoint] = useState(0)
  const [lotQuantity, setLotQuantity] = useState(1)
  
  const [categoryId, setCategoryId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [unitName, setUnitName] = useState('units')

  const [isNewCat, setIsNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [isNewLoc, setIsNewLoc] = useState(false)
  const [newLocName, setNewLocName] = useState('')
  const [isNewUnit, setIsNewUnit] = useState(false)
  const [newUnitName, setNewUnitName] = useState('')

  const [categories, setCategories] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchData() {
        if (!organization) return
        const { data: cats } = await supabase.from('categories').select('*').order('name')
        const { data: uns } = await supabase.from('units').select('*').order('name')
        const { data: locs } = await supabase.from('locations').select('*').eq('organization_id', organization.id).order('name')
        
        if (cats) setCategories(cats)
        if (uns) setUnits(uns)
        if (locs) setLocations(locs)
    }
    fetchData()
  }, [organization])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return
    setLoading(true)

    let finalCatId = categoryId
    let finalLocId = locationId
    let finalUnit = unitName

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

    const { error } = await supabase.from('materials').insert([{
        name,
        description,
        category_id: finalCatId || null,
        default_location_id: finalLocId || null,
        unit: finalUnit,
        reorder_point: reorderPoint,
        lot_quantity: lotQuantity,
        organization_id: organization.id,
        active: true
    }])

    if (error) alert(error.message)
    else router.push('/materials')
    setLoading(false)
  }

  return (
    <div className="min-h-screen text-white p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black mb-8 uppercase tracking-tighter">New Master Record</h1>
        <form onSubmit={handleSubmit} className="bg-gray-900 p-8 rounded-3xl border border-gray-800 space-y-8 shadow-2xl">
          <div className="space-y-4">
            <input required placeholder="Material Name" className="w-full bg-black border border-gray-700 p-4 rounded-2xl text-2xl font-black placeholder:text-gray-800" value={name} onChange={e => setName(e.target.value)} />
            <textarea placeholder="Description (Optional)..." className="w-full bg-black border border-gray-700 p-4 rounded-2xl h-24 text-gray-400 text-sm" value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between"><label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Category</label>
              <button type="button" onClick={() => setIsNewCat(!isNewCat)} className="text-[10px] text-purple-500 underline">{isNewCat ? 'Cancel' : '+ New'}</button></div>
              {isNewCat ? <input placeholder="New Category" className="w-full bg-black border-2 border-purple-900 p-3 rounded-xl" value={newCatName} onChange={e => setNewCatName(e.target.value)} /> :
              <select className="w-full bg-black border border-gray-700 p-3 rounded-xl" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                <option value="">-- Select --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between"><label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Private Location</label>
              <button type="button" onClick={() => setIsNewLoc(!isNewLoc)} className="text-[10px] text-purple-500 underline">{isNewLoc ? 'Cancel' : '+ New'}</button></div>
              {isNewLoc ? <input placeholder="Loc Name" className="w-full bg-black border-2 border-purple-900 p-3 rounded-xl" value={newLocName} onChange={e => setNewLocName(e.target.value)} /> :
              <select className="w-full bg-black border border-gray-700 p-3 rounded-xl" value={locationId} onChange={e => setLocationId(e.target.value)}>
                <option value="">-- Select --</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between"><label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Global Unit</label>
              <button type="button" onClick={() => setIsNewUnit(!isNewUnit)} className="text-[10px] text-purple-500 underline">{isNewUnit ? 'Cancel' : '+ New'}</button></div>
              {isNewUnit ? <input placeholder="e.g. Lbs" className="w-full bg-black border-2 border-purple-900 p-3 rounded-xl" value={newUnitName} onChange={e => setNewUnitName(e.target.value)} /> :
              <select className="w-full bg-black border border-gray-700 p-3 rounded-xl" value={unitName} onChange={e => setUnitName(e.target.value)}>
                {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 border-t border-gray-800 pt-8">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 block mb-2 tracking-widest">Min Reorder Point</label>
              <input type="number" className="w-full bg-black border border-gray-700 p-4 rounded-2xl font-mono text-2xl text-red-500" value={reorderPoint} onChange={e => setReorderPoint(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 block mb-2 tracking-widest">Buy Qty (Lot Size)</label>
              <input type="number" className="w-full bg-black border border-gray-700 p-4 rounded-2xl font-mono text-2xl text-blue-500" value={lotQuantity} onChange={e => setLotQuantity(parseInt(e.target.value) || 1)} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-white text-black py-6 rounded-3xl font-black text-2xl hover:bg-purple-600 hover:text-white transition-all transform active:scale-95 shadow-2xl">
            {loading ? 'SYNCHRONIZING...' : 'AUTHORIZE MASTER RECORD'}
          </button>
        </form>
      </div>
    </div>
  )
}