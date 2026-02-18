'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import { useOrganization } from '../context/OrganizationContext'
import { Plus, Trash2, Save, MapPin, ArrowRightLeft, Info, Package } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function TransactionEngine() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlMaterialId = searchParams.get('material_id')
  const urlLocationId = searchParams.get('location_id')
  const { organization } = useOrganization()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [materials, setMaterials] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [stockByLoc, setStockByLoc] = useState<any[]>([])
  const [lines, setLines] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!organization) return
      setLoading(true)
      const [matRes, locRes, sblRes] = await Promise.all([
        supabase.from('materials').select('*').or(`organization_id.eq.${organization.id},organization_id.is.null`).eq('is_active', true).order('name'),
        supabase.from('locations').select('*').eq('organization_id', organization.id).order('name'),
        supabase.from('view_stock_by_location').select('*').eq('organization_id', organization.id)
      ])
      if (matRes.data) setMaterials(matRes.data)
      if (locRes.data) setLocations(locRes.data)
      if (sblRes.data) setStockByLoc(sblRes.data)
      setLoading(false)
    }
    fetchData()
  }, [organization])

  useEffect(() => {
    if (!loading && lines.length === 0) {
      let defaultType = ''
      // If we are in a location that has NO stock, default to INBOUND (Receipt)
      if (urlLocationId) {
         const hasStock = stockByLoc.some(s => s.location_id === urlLocationId && s.quantity > 0)
         if (!hasStock) defaultType = 'INBOUND'
      }

      setLines([{ 
        id: Date.now(), 
        material_id: urlMaterialId || '', 
        location_id: urlLocationId || '', 
        to_location_id: '', 
        quantity: '', 
        type: defaultType, 
        notes: '', 
        showNotes: false 
      }])
    }
  }, [loading, urlMaterialId, urlLocationId, stockByLoc])

  const updateLine = (id: number, field: string, value: any) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const validateBatch = () => {
    const projectedChanges = new Map<string, number>()
    for (const line of lines) {
      if (!line.type || !line.material_id || !line.location_id || !line.quantity) {
        alert("VALIDATION FAILED: All fields are required.")
        return false
      }
      const qty = parseFloat(line.quantity)
      if (isNaN(qty) || qty <= 0) {
        alert("VALIDATION FAILED: Quantity must be greater than zero.")
        return false
      }
      if (line.type === 'OUTBOUND' || line.type === 'TRANSFER') {
        const key = `${line.material_id}|${line.location_id}`
        projectedChanges.set(key, (projectedChanges.get(key) || 0) + qty)
      }
    }
    for (const [key, totalRequested] of projectedChanges.entries()) {
      const [mId, lId] = key.split('|')
      const available = stockByLoc.find(s => s.material_id === mId && s.location_id === lId)?.quantity || 0
      if (totalRequested > available) {
        alert(`INSUFFICIENT STOCK: Only ${available} units available.`)
        return false
      }
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validateBatch()) return
    setSaving(true)
    const movements: any[] = []
    lines.forEach(line => {
      const qty = parseFloat(line.quantity)
      const common = { organization_id: organization.id, material_id: line.material_id, notes: line.notes || null }
      if (line.type === 'TRANSFER') {
        movements.push(
          { ...common, location_id: line.location_id, quantity: -qty, movement_type: 'TRANSFER_OUT' },
          { ...common, location_id: line.to_location_id, quantity: qty, movement_type: 'TRANSFER_IN' }
        )
      } else {
        movements.push({ ...common, location_id: line.location_id, quantity: line.type === 'OUTBOUND' ? -qty : qty, movement_type: line.type })
      }
    })
    const { error } = await supabase.from('inventory_movements').insert(movements)
    if (error) alert(error.message)
    else router.push('/history')
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-black uppercase tracking-widest">Opening Ledger...</div>

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-[1440px] mx-auto space-y-8">
        <header className="border-b border-gray-800 pb-6 flex justify-between items-center">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic text-gray-100">Ledger Entry</h1>
          <button onClick={handleSubmit} disabled={saving} className="bg-purple-600 hover:bg-purple-500 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-purple-900/20">
            <Save size={16}/> {saving ? 'Recording...' : 'Commit Batch'}
          </button>
        </header>

        <div className="space-y-3">
          {lines.map((line) => {
            const validLocations = (line.type === 'OUTBOUND' || line.type === 'TRANSFER') && line.material_id
               ? stockByLoc.filter(s => s.material_id === line.material_id && s.quantity > 0).map(s => ({ id: s.location_id, name: `${s.location_name} (${s.quantity})` }))
               : locations.map(l => ({ id: l.id, name: l.name }))

            return (
              <div key={line.id} className="bg-[#0f0f0f] border border-gray-800 p-6 rounded-[2.5rem] relative group shadow-xl hover:border-gray-700 transition-colors">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                  <div className="lg:col-span-2">
                    <label className={lbl}>Operation</label>
                    <div className="relative">
                      <select value={line.type} onChange={e => updateLine(line.id, 'type', e.target.value)} className={`w-full bg-black border p-4 rounded-2xl outline-none appearance-none font-black text-xs uppercase tracking-widest transition-colors ${line.type === 'INBOUND' ? 'border-purple-500 text-purple-400' : line.type === 'OUTBOUND' ? 'border-yellow-500 text-yellow-500' : line.type === 'TRANSFER' ? 'border-blue-500 text-blue-400' : 'border-gray-800 text-gray-500'}`}>
                        <option value="">-- Select --</option>
                        <option value="OUTBOUND">Issue (-)</option>
                        <option value="INBOUND">Receive (+)</option>
                        <option value="TRANSFER">Transfer</option>
                      </select>
                      <ArrowRightLeft className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" size={14} />
                    </div>
                  </div>

                  <div className="lg:col-span-3">
                    <label className={lbl}>Item</label>
                    <div className="relative">
                      <select value={line.material_id} onChange={e => updateLine(line.id, 'material_id', e.target.value)} className={inpt}>
                        <option value="">-- Choose Item --</option>
                        {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <Package className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" size={14} />
                    </div>
                  </div>

                  <div className={line.type === 'TRANSFER' ? 'lg:col-span-2' : 'lg:col-span-3'}>
                    <label className={lbl}>{line.type === 'INBOUND' ? 'Destination Store' : 'Source Store'}</label>
                    <div className="relative">
                      <select required value={line.location_id} onChange={e => updateLine(line.id, 'location_id', e.target.value)} className={inpt}>
                        <option value="">-- Select --</option>
                        {validLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                      <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" size={14} />
                    </div>
                  </div>

                  {line.type === 'TRANSFER' && (
                    <div className="lg:col-span-2 animate-in slide-in-from-left-2">
                      <label className={lbl}>Arrival Store</label>
                      <div className="relative">
                        <select required value={line.to_location_id} onChange={e => updateLine(line.id, 'to_location_id', e.target.value)} className={`${inpt} focus:border-blue-500`}>
                          <option value="">-- Select --</option>
                          {locations.filter(l => l.id !== line.location_id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                        <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" size={14} />
                      </div>
                    </div>
                  )}

                  <div className="lg:col-span-1">
                    <label className={lbl}>Qty</label>
                    <input type="number" step="any" value={line.quantity} onChange={e => updateLine(line.id, 'quantity', e.target.value)} className={`${inpt} text-center`} />
                  </div>

                  <div className="lg:col-span-1 flex justify-center">
                    <button onClick={() => updateLine(line.id, 'showNotes', !line.showNotes)} className={`p-4 rounded-2xl border transition-all ${line.showNotes ? 'bg-purple-600 text-white border-purple-500' : 'bg-gray-900 border-gray-800 text-gray-500'}`}><Info size={18} /></button>
                  </div>
                </div>

                {line.showNotes && <div className="mt-4 animate-in fade-in slide-in-from-top-2"><input placeholder="Transaction note..." value={line.notes} onChange={e => updateLine(line.id, 'notes', e.target.value)} className={`${inpt} italic`} /></div>}
                
                {lines.length > 1 && <button onClick={() => setLines(lines.filter(l => l.id !== line.id))} className="absolute -right-2 -top-2 w-8 h-8 bg-red-950 border border-red-900 text-red-500 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-lg"><Trash2 size={14}/></button>}
              </div>
            )
          })}
          <button onClick={() => setLines([...lines, { id: Date.now(), material_id: '', location_id: '', to_location_id: '', quantity: '', type: '', notes: '', showNotes: false }])} className="w-full py-6 border-2 border-dashed border-gray-800 rounded-[2rem] text-gray-600 hover:border-purple-500/50 hover:text-purple-400 transition-all font-black uppercase text-[10px] flex items-center justify-center gap-2 tracking-widest"><Plus size={16} /> Add Batch Line</button>
        </div>
      </div>
    </div>
  )
}

const lbl = "text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2 block"
const inpt = "w-full bg-black border border-gray-800 p-4 rounded-2xl outline-none focus:border-purple-500 transition-colors font-bold text-sm text-gray-200 appearance-none"
export default function InventoryPage() { return <Suspense fallback={<div className="min-h-screen bg-black" />}><TransactionEngine /></Suspense> }