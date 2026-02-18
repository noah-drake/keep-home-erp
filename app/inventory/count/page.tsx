'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import { useOrganization } from '../../context/OrganizationContext'
import { ClipboardCheck, MapPin, Save, AlertTriangle, Box, Plus, Search } from 'lucide-react'

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
  // expected: what the DB thinks is there. counts: what the user types.
  const [expectedStock, setExpectedStock] = useState<any[]>([])
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchBaseData = async () => {
      if (!organization) return
      setLoading(true)
      const [locRes, matRes] = await Promise.all([
        supabase.from('locations').select('*').eq('organization_id', organization.id).order('name'),
        supabase.from('materials').select('*').eq('organization_id', organization.id).eq('is_active', true)
      ])
      if (locRes.data) setLocations(locRes.data)
      if (matRes.data) setMaterials(matRes.data)
      setLoading(false)
    }
    fetchBaseData()
  }, [organization])

  // When location changes, fetch the expected stock for that specific room
  useEffect(() => {
    const fetchLocationStock = async () => {
      if (!locationId || !organization) return
      
      const { data } = await supabase
        .from('view_stock_by_location')
        .select('*')
        .eq('location_id', locationId)
        .gt('quantity', 0)
        
      if (data) {
        setExpectedStock(data)
        // Pre-fill the count inputs with the expected numbers to save time
        const initialCounts: Record<string, string> = {}
        data.forEach(item => {
          initialCounts[item.material_id] = String(item.quantity)
        })
        setCounts(initialCounts)
      }
    }
    fetchLocationStock()
  }, [locationId, organization])

  // Allows adding an item to the count that the system currently thinks has 0 stock
  const handleAddZeroStockItem = (materialId: string) => {
    if (counts[materialId] !== undefined) return // Already in list
    const mat = materials.find(m => m.id === materialId)
    if (!mat) return
    
    // Add a dummy record to expected stock with 0 quantity
    setExpectedStock(prev => [...prev, {
      material_id: mat.id,
      material_name: mat.name,
      quantity: 0
    }])
    setCounts(prev => ({ ...prev, [mat.id]: '0' }))
  }

  const handleUpdateCount = (materialId: string, value: string) => {
    setCounts(prev => ({ ...prev, [materialId]: value }))
  }

  const handleSubmit = async () => {
    if (!locationId) return alert("Please select a store to audit.")
    
    // Calculate the deltas (Actual - Expected)
    const adjustments: any[] = []
    let hasErrors = false

    expectedStock.forEach(item => {
      const actualRaw = counts[item.material_id]
      if (actualRaw === '' || actualRaw === undefined) return // Skipped
      
      const actualQty = parseFloat(actualRaw)
      if (isNaN(actualQty) || actualQty < 0) {
        hasErrors = true
        return
      }

      const expectedQty = item.quantity
      const delta = actualQty - expectedQty

      if (delta !== 0) {
        adjustments.push({
          organization_id: organization.id,
          material_id: item.material_id,
          location_id: locationId,
          quantity: delta,
          movement_type: delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          notes: `Cycle Count Reconciliation (Counted: ${actualQty}, Expected: ${expectedQty})`
        })
      }
    })

    if (hasErrors) return alert("Please ensure all counted quantities are valid numbers (0 or higher).")
    if (adjustments.length === 0) return alert("No discrepancies found. The physical count matches the digital ledger perfectly.")

    if (!confirm(`You are about to commit ${adjustments.length} ledger adjustments. Proceed?`)) return

    setSaving(true)
    const { error } = await supabase.from('inventory_movements').insert(adjustments)
    setSaving(false)

    if (error) alert(error.message)
    else {
      alert("Audit complete. Ledger adjusted.")
      router.push('/history')
    }
  }

  const filteredExpected = expectedStock.filter(item => 
    item.material_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-black tracking-widest uppercase">Initializing Audit...</div>

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
          <button 
            onClick={handleSubmit} 
            disabled={saving || !locationId} 
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95"
          >
            <Save size={16}/> {saving ? 'Reconciling...' : 'Commit Audit'}
          </button>
        </header>

        {/* CHAMBER SELECTION */}
        <div className="bg-[#0f0f0f] border border-gray-800 p-6 rounded-[2.5rem] flex flex-col md:flex-row gap-6 items-center shadow-xl">
           <div className="w-16 h-16 bg-black border border-gray-800 rounded-2xl flex items-center justify-center text-purple-500 shrink-0">
             <MapPin size={32} />
           </div>
           <div className="flex-1 w-full">
             <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Target Store / Chamber</label>
             <select 
               value={locationId} 
               onChange={e => setLocationId(e.target.value)} 
               className="w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-lg text-white appearance-none"
             >
               <option value="" className="bg-gray-900 text-white">-- Select Store to Audit --</option>
               {locations.map(l => <option key={l.id} value={l.id} className="bg-gray-900 text-white">{l.name}</option>)}
             </select>
           </div>
        </div>

        {/* AUDIT GRID */}
        {locationId && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#0f0f0f] p-4 rounded-3xl border border-gray-800">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input 
                  placeholder="Filter active stock..." 
                  className="w-full bg-black border border-gray-800 p-3 pl-12 rounded-xl outline-none focus:border-purple-500 text-xs font-bold transition-colors"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Add Missing Item Dropdown */}
              <div className="w-full md:w-64">
                <select 
                  onChange={e => { handleAddZeroStockItem(e.target.value); e.target.value = ""; }}
                  className="w-full bg-purple-900/10 border border-purple-500/30 text-purple-400 p-3 rounded-xl outline-none focus:border-purple-500 text-xs font-black uppercase tracking-widest appearance-none"
                >
                  <option value="" className="bg-gray-900 text-white">+ Found Missing Item</option>
                  {materials.filter(m => !expectedStock.find(es => es.material_id === m.id)).map(m => (
                    <option key={m.id} value={m.id} className="bg-gray-900 text-white">{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {filteredExpected.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-[2.5rem]">
                  <Box size={32} className="mx-auto text-gray-700 mb-3" />
                  <p className="text-gray-500 font-black uppercase tracking-widest text-[10px]">No active inventory matching search.</p>
                </div>
              ) : (
                filteredExpected.map((item) => {
                  const expected = item.quantity
                  const actualRaw = counts[item.material_id]
                  const actual = actualRaw === '' ? 0 : parseFloat(actualRaw)
                  const delta = isNaN(actual) ? 0 : actual - expected

                  return (
                    <div key={item.material_id} className="bg-[#0f0f0f] border border-gray-800 p-4 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 group hover:border-gray-700 transition-colors">
                      
                      <div className="flex-1 min-w-0 w-full">
                        <h3 className="text-sm font-black uppercase tracking-tight text-gray-200 truncate">{item.material_name}</h3>
                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mt-1">
                          System Expected: <span className="text-gray-400">{expected}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                        
                        {/* Delta Indicator */}
                        <div className="text-right w-20">
                          {delta !== 0 ? (
                            <span className={`text-lg font-black tracking-tighter flex items-center justify-end gap-1 ${delta > 0 ? 'text-green-500' : 'text-yellow-500'}`}>
                              {delta > 0 ? '+' : ''}{delta}
                            </span>
                          ) : (
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 flex items-center justify-end gap-1">
                              Match
                            </span>
                          )}
                        </div>

                        {/* Input Field */}
                        <div className="relative">
                          <label className="absolute -top-2.5 left-3 bg-[#0f0f0f] px-1 text-[8px] font-black uppercase tracking-widest text-purple-500 z-10">Actual</label>
                          <input 
                            type="number"
                            step="any"
                            value={counts[item.material_id] ?? ''}
                            onChange={(e) => handleUpdateCount(item.material_id, e.target.value)}
                            className={`w-28 bg-black border p-4 rounded-2xl text-xl font-black text-center outline-none transition-colors relative z-0 ${
                              delta !== 0 ? (delta > 0 ? 'border-green-500/50 text-green-400 focus:border-green-500' : 'border-yellow-500/50 text-yellow-400 focus:border-yellow-500') 
                              : 'border-gray-800 focus:border-purple-500 text-white'
                            }`}
                          />
                        </div>

                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* AUDIT SUMMARY ALERT */}
            {expectedStock.some(item => parseFloat(counts[item.material_id]) !== item.quantity && !isNaN(parseFloat(counts[item.material_id]))) && (
              <div className="bg-yellow-950/20 border border-yellow-900/50 p-6 rounded-[2rem] flex items-center gap-4 animate-in zoom-in-95">
                <AlertTriangle className="text-yellow-500 shrink-0" size={24} />
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mb-1">Discrepancies Detected</h4>
                  <p className="text-xs font-bold text-yellow-500/70">Committing this audit will create correcting ledger entries to match your physical counts.</p>
                </div>
              </div>
            )}
            
          </div>
        )}

      </div>
    </div>
  )
}

export default function CountEnginePage() { return <Suspense fallback={<div className="min-h-screen bg-black" />}><CountEngineContent /></Suspense> }