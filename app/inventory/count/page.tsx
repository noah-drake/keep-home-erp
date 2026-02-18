'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import { useOrganization } from '../../context/OrganizationContext'
import { ClipboardCheck, MapPin, Save, Box, Search, Package, AlertTriangle } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function CountEngineContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultLocId = searchParams.get('location_id')
  const { organization } = useOrganization()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Master Data
  const [locations, setLocations] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [locationId, setLocationId] = useState(defaultLocId || '')
  
  // Audit State
  const [expectedStock, setExpectedStock] = useState<any[]>([])
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchBaseData = async () => {
      if (!organization) return
      setLoading(true)
      const [locRes, matRes] = await Promise.all([
        supabase.from('locations').select('*').eq('organization_id', organization.id).order('name'),
        supabase.from('materials').select('*').or(`organization_id.eq.${organization.id},organization_id.is.null`).eq('is_active', true).order('name')
      ])
      if (locRes.data) setLocations(locRes.data)
      if (matRes.data) setMaterials(matRes.data)
      setLoading(false)
    }
    fetchBaseData()
  }, [organization])

  useEffect(() => {
    const fetchLocationStock = async () => {
      if (!locationId || !organization) return
      const { data } = await supabase.from('view_stock_by_location').select('*').eq('location_id', locationId).gt('quantity', 0)
      if (data) {
        setExpectedStock(data)
        const initialCounts: Record<string, string> = {}
        data.forEach(item => initialCounts[item.material_id] = String(item.quantity))
        setCounts(initialCounts)
      }
    }
    fetchLocationStock()
  }, [locationId, organization])

  const handleAddZeroStockItem = (materialId: string) => {
    if (counts[materialId] !== undefined) return 
    const mat = materials.find(m => m.id === materialId)
    if (!mat) return
    
    setExpectedStock(prev => [{
      material_id: mat.id,
      material_name: mat.name,
      quantity: 0
    }, ...prev])
    setCounts(prev => ({ ...prev, [mat.id]: '0' }))
  }

  const handleSubmit = async () => {
    if (!locationId) return
    const adjustments: any[] = []
    
    expectedStock.forEach(item => {
      const actualRaw = counts[item.material_id]
      if (actualRaw === '' || actualRaw === undefined) return
      
      const actual = parseFloat(actualRaw)
      const delta = actual - item.quantity
      
      if (delta !== 0) {
        adjustments.push({
          organization_id: organization.id,
          material_id: item.material_id,
          location_id: locationId,
          quantity: delta,
          movement_type: delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          notes: `Audit Reconciliation (Counted: ${actual}, Expected: ${item.quantity})`
        })
      }
    })

    if (adjustments.length === 0) return alert("Ledger matches physical counts. No adjustments needed.")

    setSaving(true)
    const { error } = await supabase.from('inventory_movements').insert(adjustments)
    setSaving(false)

    if (error) alert(error.message)
    else {
      alert("Audit complete. Ledger adjusted.")
      router.push('/history')
    }
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-black tracking-widest uppercase">Opening Dossier...</div>

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <header className="border-b border-gray-800 pb-6 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">Stock Audit</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-1 flex items-center gap-2">
               <ClipboardCheck size={12} className="text-purple-500" /> Cycle Count Tool
            </p>
          </div>
          <button onClick={handleSubmit} disabled={saving || !locationId} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95">
            {saving ? 'RECORDING...' : 'COMMIT AUDIT'}
          </button>
        </header>

        <div className="bg-[#0f0f0f] border border-gray-800 p-6 rounded-[2.5rem] flex gap-6 items-center shadow-xl">
           <MapPin size={32} className="text-purple-500 shrink-0" />
           <select value={locationId} onChange={e => setLocationId(e.target.value)} className="w-full bg-black border border-gray-800 p-4 rounded-2xl font-bold text-white outline-none focus:border-purple-500 appearance-none">
             <option value="" className="bg-gray-900 text-white">-- Choose Store to Audit --</option>
             {locations.map(l => <option key={l.id} value={l.id} className="bg-gray-900 text-white">{l.name}</option>)}
           </select>
        </div>

        {locationId && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col md:flex-row gap-4 bg-[#0f0f0f] p-4 rounded-3xl border border-gray-800">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input placeholder="Filter items..." className="w-full bg-black border border-gray-800 p-3 pl-12 rounded-xl outline-none focus:border-purple-500 text-xs font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <select onChange={e => { handleAddZeroStockItem(e.target.value); e.target.value = ""; }} className="bg-purple-900/10 border border-purple-500/30 text-purple-400 p-3 rounded-xl text-[10px] font-black uppercase appearance-none">
                <option value="" className="bg-gray-900">+ Add Found Item</option>
                {materials.filter(m => !expectedStock.find(es => es.material_id === m.id)).map(m => (
                  <option key={m.id} value={m.id} className="bg-gray-900 text-white">{m.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {expectedStock.filter(i => i.material_name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                <div key={item.material_id} className="bg-[#0f0f0f] border border-gray-800 p-4 rounded-2xl flex justify-between items-center hover:border-gray-700 transition-colors">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-gray-200">{item.material_name}</h3>
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mt-1">Expected: {item.quantity}</p>
                  </div>
                  <input type="number" step="any" value={counts[item.material_id] ?? ''} onChange={e => setCounts({...counts, [item.material_id]: e.target.value})} className="w-24 bg-black border border-gray-800 p-3 rounded-xl text-center font-black text-xl text-purple-400 focus:border-purple-500 outline-none" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CountEnginePage() { return <Suspense fallback={<div className="min-h-screen bg-black" />}><CountEngineContent /></Suspense> }