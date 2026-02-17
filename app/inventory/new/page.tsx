'use client'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import { useOrganization } from '../../context/OrganizationContext'
import { ArrowLeft, Plus, Trash2, Save, Shield, Package, MapPin, AlertCircle } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function TransactionEngine() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlMaterialId = searchParams.get('material_id')
  const { organization } = useOrganization()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [materials, setMaterials] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [stockByLoc, setStockByLoc] = useState<any[]>([])
  const [primaryMaterial, setPrimaryMaterial] = useState<any>(null)

  const [lines, setLines] = useState<any[]>([
    { id: Date.now(), material_id: urlMaterialId || '', location_id: '', to_location_id: '', quantity: '', type: 'OUTBOUND', notes: '' }
  ])

  useEffect(() => {
    const fetchData = async () => {
      if (!organization) return
      setLoading(true)
      
      const [matRes, locRes, sblRes] = await Promise.all([
        supabase.from('view_current_stock').select('*').eq('organization_id', organization.id).order('name'),
        supabase.from('locations').select('*').eq('organization_id', organization.id).order('name'),
        supabase.from('view_stock_by_location').select('*').eq('organization_id', organization.id)
      ])

      if (matRes.data) {
        setMaterials(matRes.data)
        if (urlMaterialId) {
          setPrimaryMaterial(matRes.data.find(m => m.material_id === urlMaterialId))
        }
      }
      if (locRes.data) setLocations(locRes.data)
      if (sblRes.data) setStockByLoc(sblRes.data)
      
      setLoading(false)
    }
    fetchData()
  }, [organization, urlMaterialId])

  const addLine = () => {
    setLines([...lines, { id: Date.now(), material_id: '', location_id: '', to_location_id: '', quantity: '', type: 'OUTBOUND', notes: '' }])
  }

  const updateLine = (id: number, field: string, value: any) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  // --- REBUILT VALIDATION (UUID FRIENDLY) ---
  const validateBatch = () => {
    // We use a Map with a pipe delimiter because UUIDs contain dashes
    const projectedChanges = new Map<string, number>()

    for (const line of lines) {
      if (!line.material_id || !line.location_id || !line.quantity) continue
      const qty = parseFloat(line.quantity)
      const key = `${line.material_id}|${line.location_id}`

      if (line.type === 'OUTBOUND' || line.type === 'TRANSFER') {
        projectedChanges.set(key, (projectedChanges.get(key) || 0) + qty)
      }
    }

    for (const [key, totalRequested] of projectedChanges.entries()) {
      const [mId, lId] = key.split('|')
      const currentAvailable = stockByLoc.find(s => s.material_id === mId && s.location_id === lId)?.quantity || 0
      
      if (totalRequested > currentAvailable) {
        const matName = materials.find(m => m.material_id === mId)?.name || "Item"
        const locName = locations.find(l => l.id === lId)?.name || "Location"
        alert(`STOCK REJECTED: You are trying to move ${totalRequested} of ${matName} from ${locName}, but only ${currentAvailable} exist in that chamber.`)
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
      if (line.type === 'TRANSFER') {
        movements.push(
          { organization_id: organization.id, material_id: line.material_id, location_id: line.location_id, quantity: -qty, movement_type: 'TRANSFER_OUT', notes: line.notes || 'Transfer Out' },
          { organization_id: organization.id, material_id: line.material_id, location_id: line.to_location_id, quantity: qty, movement_type: 'TRANSFER_IN', notes: line.notes || 'Transfer In' }
        )
      } else {
        movements.push({
          organization_id: organization.id,
          material_id: line.material_id,
          location_id: line.location_id,
          quantity: line.type === 'OUTBOUND' ? -qty : qty,
          movement_type: line.type,
          notes: line.notes || null
        })
      }
    })

    const { error } = await supabase.from('inventory_movements').insert(movements)
    if (error) alert(error.message)
    else router.push('/history')
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-black tracking-widest uppercase">Verifying Vault...</div>

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 text-white font-sans pb-32">
      <div className="max-w-[1440px] mx-auto space-y-8">
        
        <header className="border-b border-gray-800 pb-6 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">Ledger Entry</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-1">Batch Goods Movements</p>
          </div>
          <button onClick={handleSubmit} disabled={saving} className="bg-purple-600 hover:bg-purple-500 px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95">
            <Save size={16}/> {saving ? 'Recording...' : 'Commit Batch'}
          </button>
        </header>

        {primaryMaterial && (
          <div className="bg-purple-900/10 border border-purple-500/30 p-6 rounded-[2.5rem] flex items-center gap-6 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 bg-black border border-purple-500/50 rounded-2xl flex items-center justify-center text-purple-400">
               <Package size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Active Focus</p>
              <h2 className="text-2xl font-black uppercase tracking-tight leading-none">{primaryMaterial.name}</h2>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {lines.map((line) => {
            const activeStock = stockByLoc.filter(s => s.material_id === line.material_id && s.quantity > 0)

            return (
              <div key={line.id} className="bg-[#0f0f0f] border border-gray-800 p-4 rounded-[1.5rem] shadow-xl hover:border-gray-700 transition-colors">
                <div className="flex flex-wrap lg:flex-nowrap gap-4 items-end">
                  
                  {/* Type */}
                  <div className="w-full lg:w-44">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-600 mb-1.5 block">Operation</label>
                    <select value={line.type} onChange={e => updateLine(line.id, 'type', e.target.value)} className={`w-full bg-black border p-3 rounded-xl text-[10px] font-black uppercase outline-none transition-colors ${line.type === 'INBOUND' ? 'border-purple-500 text-purple-400' : line.type === 'OUTBOUND' ? 'border-yellow-500 text-yellow-500' : 'border-blue-500 text-blue-400'}`}>
                      <option value="OUTBOUND">Goods Issue (-)</option>
                      <option value="INBOUND">Goods Receipt (+)</option>
                      <option value="TRANSFER">Transfer (A → B)</option>
                    </select>
                  </div>

                  {/* Good */}
                  <div className="w-full lg:w-72">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-600 mb-1.5 block">Master Good</label>
                    <select value={line.material_id} onChange={e => updateLine(line.id, 'material_id', e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs font-bold outline-none focus:border-purple-500">
                      <option value="">-- Select Good --</option>
                      {materials.map(m => <option key={m.material_id} value={m.material_id}>{m.name}</option>)}
                    </select>
                  </div>

                  {/* Source */}
                  <div className="w-full lg:w-56">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-600 mb-1.5 block">{line.type === 'INBOUND' ? 'Destination Chamber' : 'Source Chamber'}</label>
                    <select required value={line.location_id} onChange={e => updateLine(line.id, 'location_id', e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs font-bold outline-none focus:border-purple-500">
                      <option value="">-- Choose --</option>
                      {line.type === 'INBOUND' ? locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>) :
                       activeStock.map(s => <option key={s.location_id} value={s.location_id}>{s.location_name} ({s.quantity})</option>)}
                    </select>
                  </div>

                  {/* Dest (Transfer Only) */}
                  {line.type === 'TRANSFER' && (
                    <div className="w-full lg:w-56 animate-in slide-in-from-left-2">
                      <label className="text-[8px] font-black uppercase tracking-widest text-gray-600 mb-1.5 block">Arrival Chamber</label>
                      <select required value={line.to_location_id} onChange={e => updateLine(line.id, 'to_location_id', e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs font-bold outline-none focus:border-blue-500">
                        <option value="">-- Choose --</option>
                        {locations.filter(l => l.id !== line.location_id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Qty */}
                  <div className="w-28">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-600 mb-1.5 block">Quantity</label>
                    <input type="number" step="any" value={line.quantity} onChange={e => updateLine(line.id, 'quantity', e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs font-black text-center outline-none focus:border-purple-500" />
                  </div>

                  {/* Notes (Single Line) */}
                  <div className="flex-1 min-w-[240px]">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-600 mb-1.5 block">Transaction Note</label>
                    <input 
                      placeholder="e.g. Weekly restock, Used for lunch..." 
                      value={line.notes} 
                      onChange={e => updateLine(line.id, 'notes', e.target.value)} 
                      className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs font-medium outline-none focus:border-purple-500 italic" 
                    />
                  </div>

                  {/* Remove Button */}
                  {lines.length > 1 && (
                    <button onClick={() => setLines(lines.filter(l => l.id !== line.id))} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors">
                      <Trash2 size={18}/>
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          <button onClick={addLine} className="w-full py-4 border-2 border-dashed border-gray-800 rounded-2xl text-gray-600 hover:border-purple-500/50 hover:text-purple-400 transition-all font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 group">
            <Plus size={16} /> Add Batch Line
          </button>
        </div>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  return <Suspense fallback={<div className="min-h-screen bg-black" />}><TransactionEngine /></Suspense>
}