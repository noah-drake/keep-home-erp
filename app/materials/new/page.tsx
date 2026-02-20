'use client'
import { useState, Suspense, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useOrganization } from '../../context/OrganizationContext'
import { ArrowLeft, Box, Save, Search, Database } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function NewMaterialContent() {
  const router = useRouter()
  const { organization } = useOrganization()
  
  // Form State (Now using IDs, not strings)
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [reorderPoint, setReorderPoint] = useState('0')
  const [lotQuantity, setLotQuantity] = useState('1')
  const [defaultLocationId, setDefaultLocationId] = useState('')
  
  // Relational Master Data State
  const [locations, setLocations] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [globalItems, setGlobalItems] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      if (!organization) return
      const [locRes, catRes, unitRes, globalRes] = await Promise.all([
        supabase.from('locations').select('*').eq('organization_id', organization.id).order('name'),
        supabase.from('categories').select('*').or(`organization_id.eq.${organization.id},organization_id.is.null`).order('name'),
        supabase.from('units').select('*').or(`organization_id.eq.${organization.id},organization_id.is.null`).order('name'),
        supabase.from('materials').select('*').is('organization_id', null).eq('is_active', true).order('name')
      ])
      
      if (locRes.data) setLocations(locRes.data)
      if (catRes.data) setCategories(catRes.data)
      if (unitRes.data) setUnits(unitRes.data)
      if (globalRes.data) setGlobalItems(globalRes.data)
    }
    fetchData()
  }, [organization])

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

  const handleSelectGlobal = (globalId: string) => {
      if (!globalId) return
      const item = globalItems.find(i => i.material_id === globalId)
      if (item) {
          setName(item.name || '')
          setCategoryId(item.category_id || '')
          setUnitId(item.unit_id || '')
          setReorderPoint(item.reorder_point?.toString() || '0')
          setLotQuantity(item.lot_quantity?.toString() || '1')
      }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !organization) return
    setSaving(true)
    
    // We now save the strict IDs to the database
    const payload = {
      organization_id: organization.id,
      name,
      category_id: categoryId || null,
      unit_id: unitId || null,
      reorder_point: parseFloat(reorderPoint) || 0,
      lot_quantity: parseFloat(lotQuantity) || 1,
      default_location_id: defaultLocationId || null,
      is_active: true
    }

    const { data, error } = await supabase.from('materials').insert([payload]).select().single()
    setSaving(false)
    if (error) alert(error.message)
    else router.push(`/materials/${data.id || data.material_id}`) // Ensure proper redirect
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-3xl mx-auto space-y-8">
        
        <div className="flex items-center gap-4 border-b border-gray-800 pb-6">
          <button onClick={() => router.back()} className="p-3 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-all"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic text-gray-100">Define Good</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Master Data Registration</p>
          </div>
        </div>

        {/* GLOBAL SEARCH IMPORT */}
        <div className="bg-blue-950/10 border border-blue-900/30 p-6 rounded-[2.5rem] flex flex-col md:flex-row gap-6 items-center shadow-xl">
           <div className="w-14 h-14 bg-black border border-blue-900/50 rounded-2xl flex items-center justify-center text-blue-500 shrink-0">
             <Database size={24} />
           </div>
           <div className="flex-1 w-full relative">
             <label className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-2 block">Quick-Fill from Global Registry</label>
             <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                 <select onChange={(e) => handleSelectGlobal(e.target.value)} className="w-full bg-black border border-gray-800 p-4 pl-12 rounded-2xl outline-none focus:border-blue-500 transition-colors font-bold text-sm text-gray-200 appearance-none">
                   <option value="">-- Search standard templates... --</option>
                   {globalItems.map(g => <option key={g.material_id} value={g.material_id}>{g.name}</option>)}
                 </select>
             </div>
           </div>
        </div>

        <form onSubmit={handleSave} className="bg-[#0f0f0f] border border-gray-800 p-8 rounded-[2.5rem] space-y-8 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
             <Box size={18} className="text-purple-500" />
             <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Item Parameters</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className={lbl}>Material Name</label>
                <input required placeholder="e.g. Filtered Water" value={name} onChange={e => setName(e.target.value)} className={inpt} />
              </div>
              
              <div>
                <label className={lbl}>Category</label>
                <select value={categoryId} onChange={handleCategoryChange} className={inpt}>
                  <option value="">-- Select Category --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option disabled>──────────</option>
                  <option value="CREATE_NEW" className="text-purple-400 font-black">+ Create New Category</option>
                </select>
              </div>

              <div>
                <label className={lbl}>Unit of Measure</label>
                <select value={unitId} onChange={handleUnitChange} className={inpt}>
                  <option value="">-- Select Unit --</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                  <option disabled>──────────</option>
                  <option value="CREATE_NEW" className="text-purple-400 font-black">+ Create New Unit</option>
                </select>
              </div>

              <div>
                <label className={lbl}>Reorder Point (Min Stock)</label>
                <input type="number" step="any" value={reorderPoint} onChange={e => setReorderPoint(e.target.value)} className={inpt} />
              </div>

              <div>
                <label className={lbl}>Standard Procurement Lot</label>
                <input type="number" step="any" value={lotQuantity} onChange={e => setLotQuantity(e.target.value)} className={inpt} />
              </div>

              <div className="md:col-span-2">
                <label className={lbl}>Default Storage Chamber</label>
                <select value={defaultLocationId} onChange={e => setDefaultLocationId(e.target.value)} className={inpt}>
                  <option value="">-- No Default Location --</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
          </div>

          <button disabled={saving} type="submit" className="w-full bg-purple-600 hover:bg-purple-500 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20 active:scale-95 text-white mt-4">
            {saving ? 'Registering...' : <><Save size={16} /> Register Master Data</>}
          </button>
        </form>
      </div>
    </div>
  )
}

const lbl = "block text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2"
const inpt = "w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200 appearance-none"

export default function NewMaterialPage() { return <Suspense fallback={<div className="min-h-screen bg-black"/>}><NewMaterialContent /></Suspense> }