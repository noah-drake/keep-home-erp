'use client'
import { useState, Suspense, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useOrganization } from '../../context/OrganizationContext'
import { ArrowLeft, Box, Save, Search, Check, X, CheckCircle2, Package, List, Copy, Settings2, ToggleLeft, ToggleRight } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function NewMaterialContent() {
  const router = useRouter()
  const { organization } = useOrganization()
  
  // Form State (Using strictly correct schema types)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [defaultLocationId, setDefaultLocationId] = useState('')
  
  // MRP State
  const [isMrpEnabled, setIsMrpEnabled] = useState(false)
  const [reorderPoint, setReorderPoint] = useState('')
  const [lotQuantity, setLotQuantity] = useState('')
  
  // Relational Data State
  const [locations, setLocations] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [allItems, setAllItems] = useState<any[]>([]) // Full list for cloning
  const [saving, setSaving] = useState(false)
  const [successData, setSuccessData] = useState<{ id: string, name: string } | null>(null)

  // Inline Creation UI State
  const [isCreatingCat, setIsCreatingCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [isCreatingUnit, setIsCreatingUnit] = useState(false)
  const [newUnitName, setNewUnitName] = useState('')
  const [isCreatingLoc, setIsCreatingLoc] = useState(false)
  const [newLocName, setNewLocName] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      if (!organization) return
      // Fetching GLOBAL (null) + LOCAL (org.id) to ensure complete data availability
      const [locRes, catRes, unitRes, itemsRes] = await Promise.all([
        supabase.from('locations').select('*').eq('organization_id', organization.id).order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('units').select('*').order('name'),
        supabase.from('materials').select('*').or(`organization_id.eq.${organization.id},organization_id.is.null`).eq('is_active', true).order('name')
      ])
      
      if (locRes.data) setLocations(locRes.data)
      if (catRes.data) setCategories(catRes.data)
      if (unitRes.data) setUnits(unitRes.data)
      if (itemsRes.data) setAllItems(itemsRes.data)
    }
    fetchData()
  }, [organization])

  // --- INLINE MASTER DATA CREATION LOGIC ---
  const saveNewCategory = async () => {
    if (!newCatName.trim()) return setIsCreatingCat(false)
    const { data, error } = await supabase.from('categories').insert([{ name: newCatName, organization_id: organization.id }]).select().single()
    if (data) {
      setCategories([...categories, data].sort((a, b) => a.name.localeCompare(b.name)))
      setCategoryId(String(data.id)) // Convert to string for the HTML select element
      setIsCreatingCat(false)
      setNewCatName('')
    } else alert(error?.message)
  }

  const saveNewUnit = async () => {
    if (!newUnitName.trim()) return setIsCreatingUnit(false)
    const { data, error } = await supabase.from('units').insert([{ name: newUnitName, organization_id: organization.id }]).select().single()
    if (data) {
      setUnits([...units, data].sort((a, b) => a.name.localeCompare(b.name)))
      setUnitId(data.id)
      setIsCreatingUnit(false)
      setNewUnitName('')
    } else alert(error?.message)
  }

  const saveNewLocation = async () => {
    if (!newLocName.trim()) return setIsCreatingLoc(false)
    const { data, error } = await supabase.from('locations').insert([{ name: newLocName, organization_id: organization.id }]).select().single()
    if (data) {
      setLocations([...locations, data].sort((a, b) => a.name.localeCompare(b.name)))
      setDefaultLocationId(data.id)
      setIsCreatingLoc(false)
      setNewLocName('')
    } else alert(error?.message)
  }

  // --- CLONE LOGIC ---
  const handleCloneItem = (sourceId: string) => {
      if (!sourceId) return
      const item = allItems.find(i => i.id === sourceId)
      if (item) {
          setName(item.name || '')
          setDescription(item.description || '')
          setCategoryId(item.category_id ? String(item.category_id) : '')
          setUnitId(item.unit_id || '')
          setDefaultLocationId(item.default_location_id || '')
          
          const isMrp = item.is_mrp_enabled ?? false
          setIsMrpEnabled(isMrp)
          if (isMrp) {
              setReorderPoint(item.reorder_point?.toString() || '0')
              setLotQuantity(item.lot_quantity?.toString() || '1')
          } else {
              setReorderPoint('')
              setLotQuantity('')
          }
      }
  }

  // --- SAVE ITEM ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !organization) return
    setSaving(true)
    
    // Strict relational payload
    const payload = {
      organization_id: organization.id,
      name,
      description: description || null,
      category_id: categoryId ? parseInt(categoryId) : null, // Ensures integer for categories
      unit_id: unitId || null,
      default_location_id: defaultLocationId || null,
      is_mrp_enabled: isMrpEnabled,
      reorder_point: isMrpEnabled && reorderPoint !== '' ? parseFloat(reorderPoint) : null,
      lot_quantity: isMrpEnabled && lotQuantity !== '' ? parseFloat(lotQuantity) : null,
      is_active: true
    }

    const { data, error } = await supabase.from('materials').insert([payload]).select().single()
    setSaving(false)
    
    if (error) {
      alert(error.message)
    } else {
      // Trigger the Success UI State
      setSuccessData({ id: data.id, name: data.name })
    }
  }

  const handleReset = () => {
    setName(''); setDescription(''); setCategoryId(''); setUnitId(''); setDefaultLocationId('')
    setIsMrpEnabled(false); setReorderPoint(''); setLotQuantity('')
    setSuccessData(null)
    window.scrollTo(0, 0)
  }

  // ==========================================
  // VIEW 1: SUCCESS STATE UI
  // ==========================================
  if (successData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-4 flex flex-col justify-center items-center text-white font-sans">
        <div className="bg-[#0f0f0f] border border-green-500/30 p-10 rounded-[3rem] shadow-2xl text-center max-w-lg w-full animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-500/10 border border-green-500/30 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-inner">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-2 text-gray-100">Item Registered</h1>
          <p className="text-sm font-bold text-gray-400 mb-10 leading-relaxed">"{successData.name}" has been successfully added to your master data.</p>
          
          <div className="space-y-4">
            <button onClick={handleReset} className="w-full bg-purple-600 hover:bg-purple-500 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all text-white flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 active:scale-95">
              <Package size={16} /> Add Another Item
            </button>
            <button onClick={() => router.push(`/materials/${successData.id}`)} className="w-full bg-gray-900 border border-gray-800 hover:border-purple-500/50 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all text-gray-300 flex items-center justify-center gap-2 active:scale-95">
              <Search size={16} /> View Item Master
            </button>
            <button onClick={() => router.push('/materials')} className="w-full bg-transparent hover:bg-gray-900 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all text-gray-500 flex items-center justify-center gap-2">
              <List size={16} /> Return to Registry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // VIEW 2: CREATION FORM
  // ==========================================
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

        {/* CLONE EXISTING ITEM */}
        <div className="bg-blue-950/10 border border-blue-900/30 p-6 rounded-[2.5rem] flex flex-col md:flex-row gap-6 items-center shadow-xl">
           <div className="w-14 h-14 bg-black border border-blue-900/50 rounded-2xl flex items-center justify-center text-blue-500 shrink-0">
             <Copy size={24} />
           </div>
           <div className="flex-1 w-full relative">
             <label className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-2 block">Clone Existing Master Data</label>
             <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                 <select onChange={(e) => handleCloneItem(e.target.value)} className="w-full bg-black border border-gray-800 p-4 pl-12 rounded-2xl outline-none focus:border-blue-500 transition-colors font-bold text-sm text-gray-200 appearance-none">
                   <option value="">-- Search global or local items to clone... --</option>
                   {allItems.map(g => <option key={g.id} value={g.id}>{g.name} {!g.organization_id && '(Global)'}</option>)}
                 </select>
             </div>
           </div>
        </div>

        <form onSubmit={handleSave} className="bg-[#0f0f0f] border border-gray-800 p-8 rounded-[2.5rem] space-y-8 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
             <Box size={18} className="text-purple-500" />
             <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Core Identity</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className={lbl}>Material Name</label>
                <input required placeholder="e.g. Filtered Water" value={name} onChange={e => setName(e.target.value)} className={inpt} />
              </div>

              <div className="md:col-span-2">
                <label className={lbl}>Description / Notes</label>
                <textarea placeholder="Optional details..." value={description} onChange={e => setDescription(e.target.value)} className={`${inpt} h-20 resize-none`} />
              </div>
              
              {/* CATEGORY FIELD */}
              <div>
                <label className={lbl}>Category</label>
                {isCreatingCat ? (
                  <div className="flex items-center gap-2">
                    <input autoFocus placeholder="New Category Name" value={newCatName} onChange={e=>setNewCatName(e.target.value)} className={`${inpt} py-3`} />
                    <button type="button" onClick={saveNewCategory} className="p-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-white transition-colors"><Check size={18}/></button>
                    <button type="button" onClick={()=>setIsCreatingCat(false)} className="p-3 bg-gray-900 hover:bg-red-950 hover:text-red-500 rounded-xl text-gray-500 transition-colors"><X size={18}/></button>
                  </div>
                ) : (
                  <select value={categoryId} onChange={(e) => e.target.value === 'CREATE_NEW' ? setIsCreatingCat(true) : setCategoryId(e.target.value)} className={`${inpt} appearance-none`}>
                    <option value="">-- Select Category --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name} {!c.organization_id && '(Global)'}</option>)}
                    <option disabled>──────────</option>
                    <option value="CREATE_NEW" className="text-purple-400 font-black">+ Create New Local Category</option>
                  </select>
                )}
              </div>

              {/* UNIT FIELD */}
              <div>
                <label className={lbl}>Unit of Measure</label>
                {isCreatingUnit ? (
                  <div className="flex items-center gap-2">
                    <input autoFocus placeholder="Name (e.g. Gallons)" value={newUnitName} onChange={e=>setNewUnitName(e.target.value)} className={`${inpt} py-3`} />
                    <button type="button" onClick={saveNewUnit} className="p-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-white transition-colors"><Check size={18}/></button>
                    <button type="button" onClick={()=>setIsCreatingUnit(false)} className="p-3 bg-gray-900 hover:bg-red-950 hover:text-red-500 rounded-xl text-gray-500 transition-colors"><X size={18}/></button>
                  </div>
                ) : (
                  <select value={unitId} onChange={(e) => e.target.value === 'CREATE_NEW' ? setIsCreatingUnit(true) : setUnitId(e.target.value)} className={`${inpt} appearance-none`}>
                    <option value="">-- Select Unit --</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name} {!u.organization_id && '(Global)'}</option>)}
                    <option disabled>──────────</option>
                    <option value="CREATE_NEW" className="text-purple-400 font-black">+ Create New Local Unit</option>
                  </select>
                )}
              </div>

              {/* LOCATION FIELD */}
              <div className="md:col-span-2">
                <label className={lbl}>Default Storage Chamber (Optional)</label>
                {isCreatingLoc ? (
                  <div className="flex items-center gap-2">
                    <input autoFocus placeholder="New Store/Location Name" value={newLocName} onChange={e=>setNewLocName(e.target.value)} className={`${inpt} py-3`} />
                    <button type="button" onClick={saveNewLocation} className="p-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-white transition-colors"><Check size={18}/></button>
                    <button type="button" onClick={()=>setIsCreatingLoc(false)} className="p-3 bg-gray-900 hover:bg-red-950 hover:text-red-500 rounded-xl text-gray-500 transition-colors"><X size={18}/></button>
                  </div>
                ) : (
                  <select value={defaultLocationId} onChange={(e) => e.target.value === 'CREATE_NEW' ? setIsCreatingLoc(true) : setDefaultLocationId(e.target.value)} className={`${inpt} appearance-none`}>
                    <option value="">-- No Default Location --</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    <option disabled>──────────</option>
                    <option value="CREATE_NEW" className="text-purple-400 font-black">+ Create New Location</option>
                  </select>
                )}
              </div>

              {/* MRP TOGGLE */}
              <div className="md:col-span-2 border-t border-gray-800/50 pt-6 mt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"><Settings2 size={16} className="text-blue-500" /> Material Requirements Planning (MRP)</h3>
                    <p className="text-[10px] font-bold text-gray-600 mt-1">Enable to set automated reorder thresholds and standard lot sizes.</p>
                  </div>
                  <button type="button" onClick={() => setIsMrpEnabled(!isMrpEnabled)} className="flex items-center gap-2 focus:outline-none">
                     {isMrpEnabled ? <ToggleRight size={36} className="text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-all" /> : <ToggleLeft size={36} className="text-gray-600 transition-all" />}
                  </button>
                </div>
              </div>

              {/* MRP HIDDEN FIELDS */}
              {isMrpEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:col-span-2 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <label className={lbl}>Reorder Point (Min Stock)</label>
                    <input type="number" step="any" value={reorderPoint} onChange={e => setReorderPoint(e.target.value)} className={`${inpt} focus:border-blue-500`} placeholder="e.g. 5" />
                  </div>
                  <div>
                    <label className={lbl}>Standard Procurement Lot</label>
                    <input type="number" step="any" value={lotQuantity} onChange={e => setLotQuantity(e.target.value)} className={`${inpt} focus:border-blue-500`} placeholder="e.g. 12" />
                  </div>
                </div>
              )}
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
const inpt = "w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200"

export default function NewMaterialPage() { return <Suspense fallback={<div className="min-h-screen bg-black"/>}><NewMaterialContent /></Suspense> }